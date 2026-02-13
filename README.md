# 🐻 Paper Bear

**A brutalist event calendar for Vancouver's independent music, film, and comedy scene.**

Paper Bear scrapes event listings from local venues across East Van and displays them in a week-view calendar. Built with [Astro](https://astro.build), server-side rendered, and styled with TailwindCSS + DaisyUI (`lofi` theme) for a bold, print-inspired aesthetic.

**Live at:** `paperbear.dev` (not yet deployed)

---

## Architecture Overview

```
┌──────────────────────────────────────────────┐
│  Browser (Desktop / Mobile)                  │
│  ┌──────────────────────────────────────┐    │
│  │  index.astro → Layout + DayColumn    │    │
│  │  Header.astro (filters, RSS, logo)   │    │
│  │  EventCard.astro (event tiles)       │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
                    │
          GET / (SSR)│  GET /api/scrape
                    ▼
┌──────────────────────────────────────────────┐
│  Astro SSR (Node.js adapter, standalone)     │
│  ┌──────────────────────────────────────┐    │
│  │  src/lib/events.ts    (query layer)  │    │
│  │  src/pages/api/scrape.ts (orchestr.) │    │
│  │  src/pages/api/rss.xml.ts (RSS feed) │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │  EthicalScraper (scraper-core.ts)    │    │
│  │  ├── Playwright (dynamic sites)      │    │
│  │  ├── Cheerio (static sites)          │    │
│  │  ├── Rate Limiting + Retries         │    │
│  │  └── Dedup Hash (MD5)                │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │  Venue Scrapers                      │    │
│  │  ├── rickshaw.ts (Playwright)        │    │
│  │  ├── rio.ts      (Playwright)        │    │
│  │  └── fox.ts      (Static/Cheerio)    │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────┐
│  Astro DB (libSQL / Turso)                   │
│  ┌──────────────────────────────────────┐    │
│  │  Venue  │  Event  │  ScrapeLog       │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer       | Technology                                  |
|-------------|---------------------------------------------|
| Framework   | Astro 5.x (SSR, `output: 'server'`)         |
| Adapter     | `@astrojs/node` (standalone)                |
| Database    | Astro DB (`@astrojs/db`) — libSQL / Turso   |
| Styling     | TailwindCSS 4.x + DaisyUI 5.x (`lofi`)     |
| Fonts       | Oswald (display), Space Mono (monospace)     |
| Scraping    | Playwright (dynamic), Cheerio (static)      |
| Dates       | date-fns + date-fns-tz (Vancouver TZ)       |
| Testing     | Vitest (unit), Playwright Test (E2E)        |
| RSS         | @astrojs/rss                                |

---

## Project Structure

```
paper-bear/
├── astro.config.mjs          # SSR + Node adapter + DB integration
├── tailwind.config.mjs       # Oswald/Space Mono fonts, DaisyUI lofi theme
├── db/
│   ├── config.ts             # ⭐ DATABASE SCHEMA (Venue, Event, ScrapeLog)
│   └── seed.ts               # Seeds Venue records on first boot
├── src/
│   ├── config/
│   │   └── venues.ts         # ⭐ VENUE REGISTRY (add new scrapers here)
│   ├── components/
│   │   ├── Header.astro      # Logo, filters (venue/genre), RSS link, mobile toggle
│   │   ├── Footer.astro      # Branding
│   │   ├── DayColumn.astro   # One day column in the week view
│   │   └── EventCard.astro   # Single event tile
│   ├── layouts/
│   │   └── Layout.astro      # HTML shell
│   ├── lib/
│   │   ├── events.ts         # ⭐ QUERY LAYER — getWeekEvents() with filters
│   │   ├── utils/
│   │   │   ├── scraper-core.ts   # ⭐ EthicalScraper class + VenueScraper interface
│   │   │   ├── date-parser.ts    # parseVancouverDate() — robust multi-format parser
│   │   │   ├── date-parser.test.ts
│   │   │   └── classifier.ts     # classifyEvent() — title → genre mapping
│   │   └── venues/
│   │       ├── rickshaw.ts   # Rickshaw Theatre scraper (Playwright, w/ detail pages)
│   │       ├── rio.ts        # Rio Theatre scraper (Playwright)
│   │       ├── fox.ts        # Fox Cabaret scraper (static/Cheerio)
│   │       └── fox.test.ts
│   ├── pages/
│   │   ├── index.astro       # Main page — 7-day horizontal scroll calendar
│   │   ├── terms.astro       # Terms of use
│   │   └── api/
│   │       ├── scrape.ts     # ⭐ POST /api/scrape — scraper orchestrator
│   │       └── rss.xml.ts    # GET /api/rss.xml — filtered RSS feed
│   └── styles/
│       └── global.css
├── scripts/
│   ├── reset-db.ts           # Wipe all Event + ScrapeLog data
│   ├── verify-db.ts          # Print DB contents for debugging
│   ├── debug-rickshaw*.mjs   # Debug scripts (Playwright-based)
│   └── debug-rio.mjs         # Debug scripts (Playwright-based)
├── tests/
│   └── responsive.spec.ts    # E2E tests for responsive layout
├── public/
│   └── logo.svg              # Paper Bear logo
├── docs/
│   ├── architecture.md       # Architecture notes
│   └── database.md           # Database design notes
└── .env.example              # Environment variable template
```

---

## Database Schema

Defined in `db/config.ts` using Astro DB's `defineTable()`:

### `Venue`
| Column         | Type      | Notes                        |
|----------------|-----------|------------------------------|
| `id`           | text (PK) | Slug: `'rickshaw-theatre'`   |
| `name`         | text      | Display: `'Rickshaw Theatre'`|
| `city`         | text      | Default: `'Vancouver'`      |
| `url`          | text      | Calendar URL to scrape       |
| `enabled`      | boolean   | Toggle scraping on/off       |
| `lastScrapedAt`| date?     | Last successful scrape time  |
| `createdAt`    | date      | Auto-set                     |

### `Event`
| Column      | Type        | Notes                                  |
|-------------|-------------|----------------------------------------|
| `id`        | text (PK)   | UUID                                   |
| `venueId`   | text (FK)   | References `Venue.id`                  |
| `title`     | text        | Event title                            |
| `date`      | date        | Event start (UTC, displayed in Van TZ) |
| `doorsTime` | date?       | Doors open time (nullable)             |
| `url`       | text?       | Event detail page URL                  |
| `eventType` | text        | `'music'│'comedy'│'screening'│'other'` |
| `hash`      | text (uniq) | MD5 dedup: `venueId│localDate│title`   |
| `createdAt` | date        | Auto-set                               |
| `updatedAt` | date        | Auto-set                               |

### `ScrapeLog`
| Column        | Type      | Notes                              |
|---------------|-----------|------------------------------------|
| `id`          | text (PK) | UUID                               |
| `venueId`     | text (FK) | References `Venue.id`              |
| `timestamp`   | date      | When scrape ran                    |
| `status`      | text      | `'success'│'error'│'skipped'`      |
| `itemsFound`  | number    | Events found                       |
| `errorMessage`| text?     | Error detail if failed             |
| `durationMs`  | number?   | Scrape duration                    |

---

## Venue Scrapers

Each scraper implements the `VenueScraper` interface from `scraper-core.ts`:

```typescript
interface VenueScraper {
    id: string;       // slug
    name: string;     // display name
    url: string;      // page to scrape
    enabled: boolean;
    scrape(page: Page | null, html: string | null): Promise<RawEvent[]>;
}
```

### Current Venues

| Venue              | File            | Method       | Notes                                       |
|--------------------|-----------------|--------------|---------------------------------------------|
| Rickshaw Theatre   | `rickshaw.ts`   | Playwright   | Scrolls for lazy-loaded events, visits each detail page for doors time |
| Rio Theatre        | `rio.ts`        | Playwright   | Scrapes riotheatretickets.ca, "Time - Day, Date" format |
| Fox Cabaret        | `fox.ts`        | Static/fetch | Uses Cheerio, no JS needed                  |

### How to Add a New Venue

1. Create `src/lib/venues/your-venue.ts` implementing `VenueScraper`
2. Register it in `src/config/venues.ts` (import + add to `venues` array)
3. Add the venue record to `db/seed.ts`
4. Run `npm run seed` then `npm run scrape`

---

## Key Utilities

### `date-parser.ts` — `parseVancouverDate(raw: string)`
Parses human-readable date strings into UTC `Date` objects, always in `America/Vancouver` timezone.

**Handles formats including:**
- `"Friday, January 12, 2024 7:30 PM"`
- `"Jan 12 7:30pm"` (infers current year)
- `"9:00pm - Tuesday, Feb 10, 2026"` (Rio's "Time - Date" format, auto-normalized)

**Important:** Year inference logic adds +1 year if the parsed date is >30 days in the past.

### `scraper-core.ts` — `EthicalScraper`
Wraps Playwright/Cheerio with:
- **Rate limiting** (configurable via `SCRAPER_DELAY_MS`, default 1500ms)
- **Exponential backoff** on retries (max 3 attempts)
- **Custom User-Agent** identification
- **Deduplication** via `generateEventHash()` using MD5 of `venueId|localDate|normalizedTitle`

### `classifier.ts` — `classifyEvent(title: string)`
Keyword-based genre classifier. Maps event titles to: `music`, `comedy`, `screening`, or `other`.

---

## Commands

| Command                | Action                                    |
|------------------------|-------------------------------------------|
| `npm install`          | Install dependencies                      |
| `npm run dev`          | Start dev server at `localhost:4321`       |
| `npm run build`        | Build production bundle to `./dist/`       |
| `npm run scrape`       | Trigger scraper via `GET /api/scrape`      |
| `npm run seed`         | Seed venue records into DB                 |
| `npm run verify`       | Dump DB contents for debugging             |
| `npm run db:reset`     | Wipe all events and scrape logs            |
| `npm test`             | Run unit tests (Vitest via Bun)            |
| `npm run test:e2e`     | Run E2E tests (Playwright)                |

### First-time Setup

```bash
# Clone and install
git clone <repo-url> && cd paper-bear
npm install
npx playwright install chromium

# Configure environment
cp .env.example .env

# Start dev server (also initializes DB)
npm run dev

# In another terminal: seed venues then scrape
npm run seed
npm run scrape
```

---

## Environment Variables

```env
# .env
SCRAPER_USER_AGENT=PaperBear/1.0 (Vancouver Community Events Bot; contact@paperbear.dev)
SCRAPER_DELAY_MS=1500
```

The app uses **Astro DB** which auto-manages the database connection. In dev mode, it uses a local libSQL file. For production, configure the `ASTRO_DB_REMOTE_URL` and `ASTRO_DB_APP_TOKEN` for Turso.

---

## UI Design

- **Brutalist aesthetic** — Heavy borders, monochrome `lofi` DaisyUI theme, Oswald headings
- **Desktop:** 7-column grid, each column = one day, all events visible at once
- **Mobile:** Horizontal snap-scroll with "peek" effect (shows edges of adjacent days)
- **Filters:** Venue and Genre dropdowns in header (desktop visible, mobile toggle)
- **RSS:** Dynamic RSS feed at `/api/rss.xml` respecting current filter params

---

## Known Issues & Technical Debt

1. **`priceRaw` lint error in `rickshaw.ts`** — The `RawEvent` interface doesn't include `priceRaw`, but Rickshaw's scraper still returns it. The field is extracted but not stored. Either add `priceRaw` to `RawEvent` or remove extraction.

2. **No cron/scheduled scraping** — Scraping is triggered manually via `npm run scrape` or `GET /api/scrape`. Needs a cron job or similar for production.

3. **Playwright in production** — Requires Chromium binary. For containerized deployment, use a Docker image with Playwright pre-installed (e.g., `mcr.microsoft.com/playwright`).

4. **Astro DB limitations** — Astro DB is tied to Astro's build/deploy lifecycle. For production with remote Turso, ensure `@astrojs/db` is configured with remote credentials.

5. **No auth on `/api/scrape`** — Anyone can trigger a scrape. Add API key auth or rate limiting for production.

6. **Debug scripts in `/scripts/`** — Several `debug-*.mjs` files are development artifacts. Safe to ignore.

---

## Planned / Future Work

- [ ] **Deployment** — Containerize with Docker, deploy to homelab or Vercel + Turso
- [ ] **Cron scraping** — Automated daily scrape (cron job / GitHub Actions / container scheduler)
- [ ] **More venues** — Park Theatre, Heros Welcome, Cobalt, Biltmore, etc.
- [ ] **Event detail pages** — Individual event pages with full description, price, links
- [ ] **Price tracking** — Add `priceRaw` / `priceFormatted` columns to Event table
- [ ] **Search** — Full-text search across events
- [ ] **Notifications** — Email/push alerts for new events from followed venues
- [ ] **Admin dashboard** — View scrape logs, toggle venues, monitor health

---

## Handover Notes for Claude Code

### Critical Files to Understand First
1. **`db/config.ts`** — The schema is the source of truth
2. **`src/config/venues.ts`** — Where scrapers are registered
3. **`src/lib/utils/scraper-core.ts`** — The `VenueScraper` interface and `EthicalScraper` class
4. **`src/pages/api/scrape.ts`** — The orchestrator that ties everything together

### Gotchas
- **Timezone handling is paramount.** All dates are stored as UTC but displayed in `America/Vancouver`. The dedup hash uses Vancouver local date, not UTC. See `generateEventHash()` in `scraper-core.ts`.
- **Playwright requires Chromium.** If you hit `EPERM` errors in temp dirs, set `TMPDIR=$(pwd)/.tmp` before running.
- **Rickshaw Theatre** is the most complex scraper. It lazy-loads events (requires auto-scroll), then visits individual detail pages to extract doors/show time. The time extraction searches `.show_description` inner text, not just `<h4>` tags.
- **Rio Theatre** uses a non-standard date format: `"9:00pm - Tuesday, Feb 10, 2026"`. The `date-parser.ts` normalizes this before parsing.
- **`npm run scrape`** calls `curl -s http://localhost:4321/api/scrape` — the dev server must be running.
- **Astro DB** in dev mode uses a local file (`.astro/content.db`). No separate database setup needed for development.

### Dev Workflow
```bash
# Terminal 1: Dev server
npm run dev

# Terminal 2: Scrape (after server is up)
npm run scrape

# Terminal 3: Tests
npm test              # Unit tests
npm run test:e2e      # E2E (Playwright)
```

### Adding a Venue (Step by Step)
```bash
# 1. Study target site's HTML structure (use browser DevTools)
# 2. Create scraper file
touch src/lib/venues/new-venue.ts

# 3. Implement VenueScraper interface:
#    - id: 'new-venue' (slug)
#    - name: 'New Venue' (display)
#    - url: 'https://...' (calendar page)
#    - scrape(): extract title, dateRaw, url, doorsRaw from HTML

# 4. Register in src/config/venues.ts
# 5. Add seed record in db/seed.ts
# 6. Test: npm run seed && npm run scrape
```

---

## License

MIT
