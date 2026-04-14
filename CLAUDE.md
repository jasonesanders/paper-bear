# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server at localhost:4321
npm run build        # Production build (requires ASTRO_DB_REMOTE_URL + ASTRO_DB_APP_TOKEN)
npm run preview      # Preview production build

# Testing
bun test             # Run unit tests (Vitest + Bun)
bun test src/lib/utils/date-parser.test.ts  # Run a single test file
npm run test:e2e     # Playwright end-to-end tests

# Database
npm run seed         # Seed initial venue rows (db/seed.ts)
npm run verify       # Inspect DB contents (scripts/verify-db.ts)
npm run db:reset     # Drop and re-seed the DB

# Scraping
npm run scrape       # Trigger /api/scrape endpoint locally (requires SCRAPE_SECRET in env)
```

## Required Environment Variables

```
ASTRO_DB_REMOTE_URL=   # libSQL / Turso connection URL
ASTRO_DB_APP_TOKEN=    # Turso auth token
SCRAPE_SECRET=         # Token required by /api/scrape (must match X-Scrape-Token header)
```

For local dev, put these in `.env`. For Docker, they are loaded via `env_file: .env` in docker-compose.yml.

**Important:** Runtime env vars in Astro Node SSR must be read with `process.env`, not `import.meta.env`.

## Architecture

This is a Vancouver community events calendar — **The Week Ahead** (`theweekahead.ca`). It scrapes event listings from local venues and displays a 7-day rolling calendar.

### Stack

- **Astro** (SSR via `@astrojs/node` standalone adapter, deployed in Docker)
- **Astro DB** (libSQL / Turso) — three tables: `Venue`, `Event`, `ScrapeLog`
- **Tailwind + DaisyUI** for styling
- **Playwright** + **Cheerio** for web scraping
- **Vitest + Bun** for unit tests

### Data Flow

```
/api/scrape (GET, authenticated) 
  → EthicalScraper.runScraper(venue)
      → venue.scrape(page, html)           # per-venue extraction
  → normalizeEvents()                      # parse dates, classify type, sanitize URL
  → dedup via Event.hash (MD5)             # prevent re-inserting known events
  → db.insert(Event)
```

The scraper runs every 6 hours via cron (see `scripts/setup-cron.sh`). The `/api/scrape` endpoint requires `X-Scrape-Token` matching `SCRAPE_SECRET`.

### Frontend

`src/pages/index.astro` calls `getWeekEvents()` on every request (server-side). It supports `?venue=` and `?genre=` query params for filtering. Data is grouped into 7 `DayData` objects and rendered via `DayColumn.astro`.

All dates are stored as UTC in the DB. All display and grouping logic converts to **America/Vancouver** using `date-fns-tz`.

### Venue Scrapers

Each venue is a module in `src/lib/venues/` implementing `VenueScraper` (defined in `src/lib/utils/scraper-core.ts`):

```ts
interface VenueScraper {
    id: string;           // slug used as DB primary key
    name: string;
    url: string;
    enabled: boolean;
    needsBrowser?: boolean;  // false = skip Playwright (REST API venues)
    scrape(page: Page | null, html: string | null): Promise<RawEvent[]>;
}
```

Register venues in `src/config/venues.ts`. Two scraping strategies:
- **`needsBrowser` (default true):** `EthicalScraper` launches Playwright, fetches the page, passes `page` + HTML to `scrape()`.
- **`needsBrowser: false`:** `scrape()` is called with `null, null` and fetches its own data (e.g., Rio Theatre hits a WordPress REST API).

### Date Parsing

`src/lib/utils/date-parser.ts` → `parseVancouverDate(raw)` handles ~25 date formats found across venue websites. It has a fast path for ISO 8601 strings and year inference for dates without an explicit year. When adding scrapers, prefer passing ISO strings as `dateRaw` when available.

### Deduplication

`generateEventHash(venueId, date, title)` produces an MD5 of `venueId|YYYY-MM-DD|normalized_title` (using Vancouver local date, not UTC). The `Event.hash` column has a unique constraint.

### Security

- `/api/scrape` is token-gated (`SCRAPE_SECRET`).
- `sanitizeEventUrl()` strips non-http/https schemes before storing URLs.
- Security headers (X-Frame-Options, Referrer-Policy, etc.) are set in `src/middleware.ts`.
