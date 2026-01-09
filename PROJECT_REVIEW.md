# Paper-Bear Project Review

**Date:** January 8, 2026  
**Reviewer:** Antigravity

---

## Executive Summary

Paper-Bear is a Vancouver event aggregator that scrapes local venue calendars and normalizes them into a unified database. The codebase is **well-structured** with clear separation of concerns, but has **zero test coverage** and some **architectural gaps** that should be addressed before production use.

| Aspect | Rating | Notes |
|--------|--------|-------|
| Code Quality | ⭐⭐⭐⭐ | Clean, well-documented, consistent patterns |
| Test Coverage | ⭐ | No tests exist |
| Type Safety | ⭐⭐⭐ | Good, with one Astro DB import issue |
| Error Handling | ⭐⭐⭐ | Adequate, could be more robust |
| Architecture | ⭐⭐⭐⭐ | Modular design, extensible venue pattern |

---

## Architecture Overview

```
paper-bear/
├── scripts/scrape.ts      # Orchestrator - runs all scrapers
├── src/
│   ├── config/venues.ts   # Venue registry
│   ├── lib/
│   │   ├── utils/
│   │   │   ├── scraper-core.ts   # EthicalScraper + interfaces
│   │   │   ├── date-parser.ts    # Vancouver timezone handling
│   │   │   └── classifier.ts     # Event type + price parsing
│   │   └── venues/
│   │       ├── rickshaw.ts       # ✅ Active
│   │       ├── rio.ts            # ✅ Active
│   │       └── fox.ts            # ✅ Active (new)
│   └── pages/index.astro         # Placeholder frontend
└── db/
    ├── config.ts                 # Astro DB schema
    └── seed.ts                   # Initial venue data
```

---

## File-by-File Analysis

### 1. `src/lib/utils/scraper-core.ts` ⭐⭐⭐⭐

**Strengths:**
- Clean `EthicalScraper` class with rate limiting and retry logic
- Well-defined interfaces (`VenueScraper`, `RawEvent`, `ScrapeResult`)
- Configurable via environment variables
- Proper browser lifecycle management

**Issues:**
1. **No parallel scraping** - Venues are scraped sequentially. Could parallelize with queue.
2. **Browser reuse** - Opens new page per venue but shares context. Good.
3. **Missing static scraping path** - `fetchStatic()` exists but venue scrapers don't use it.

**Recommendations:**
```typescript
// Add a scrape mode to VenueScraper interface
type ScrapeMode = 'dynamic' | 'static';
```

---

### 2. `src/lib/utils/date-parser.ts` ⭐⭐⭐⭐⭐

**Strengths:**
- Excellent normalization (ordinals, whitespace, am/pm variants)
- Smart year inference for dates without years
- Comprehensive format list covering all venue variations
- Proper Vancouver timezone handling with `date-fns-tz`

**Issues:**
1. **No tests** - All these formats should have unit tests
2. **extractDoorsAndShow()** - Not currently used by any scraper

**Test Cases Needed:**
```typescript
// These should all parse correctly:
"Friday, January 12, 2024 7:30 PM"  → Jan 12 2024 19:30 PST
"Sunday January 4 12:30 pm"         → (Rio style, no comma)
"Jan 12 7:30 PM"                    → (infer year)
"Doors @ 7pm"                       → (should strip prefix)
"23rd January 2024"                 → (ordinal removal)
```

---

### 3. `src/lib/utils/classifier.ts` ⭐⭐⭐

**Strengths:**
- Simple keyword-based classification (easy to extend)
- Price parsing handles common formats ($15, free, PWYC)
- Returns price in cents (good for currency handling)

**Issues:**
1. **Keyword overlap** - "dance party" matches `theatre` (dance keyword) instead of `music`
2. **No tie-breaker** - If music and theatre both score 1, arbitrary winner
3. **Missing keywords**: "rave", "party", "night", "club" should be music

**Recommendations:**
```typescript
// Add weighted keywords for more accurate classification
const KEYWORDS: Record<EventType, { keyword: string; weight: number }[]> = {
  music: [
    { keyword: 'concert', weight: 3 },
    { keyword: 'dj', weight: 2 },
    { keyword: 'party', weight: 1 },  // Add this
  ],
  // ...
};
```

---

### 4. `src/lib/venues/rickshaw.ts` ⭐⭐⭐⭐

**Strengths:**
- Excellent documented selectors
- Auto-scroll for lazy loading
- Fetches detail pages for doors/price
- Graceful fallback if detail fetch fails

**Issues:**
1. **No deduplication** - Same event could appear if page has duplicates
2. **Hard-coded URL in goBack()** - If venue URL changes, would break

---

### 5. `src/lib/venues/rio.ts` ⭐⭐⭐

**Strengths:**
- Good calendar grid parsing
- Click-through to detail pages
- Price extraction via regex

**Issues:**
1. **Stale element risk** - `page.goBack()` then re-querying `.an-event` may miss or duplicate events
2. **Match by title+time** - Fragile; two events with same name at same time would conflict
3. **No error recovery** - If one event fails mid-loop, catches but may leave page in wrong state

**Recommendation:** Use URL collection → batch visit pattern instead of click-back loop.

---

### 6. `src/lib/venues/fox.ts` ⭐⭐⭐ (New)

**Strengths:**
- Well-documented Squarespace selectors
- Extracts doors/price from body text
- Handles missing article gracefully

**Issues:**
1. **DUPLICATE EVENTS** 🔴 - Each event appears twice (Squarespace DOM quirk)
2. **Unused dateAttr** - Line 108 extracts `datetime` attribute but doesn't use it
3. **All events same doorsTime** - The date parser is applying doors extraction incorrectly

**Fix for duplicates:**
```typescript
// Deduplicate by href before processing
const seenUrls = new Set<string>();
const calendarEvents = /* ... */.filter(e => {
  if (seenUrls.has(e.href)) return false;
  seenUrls.add(e.href);
  return true;
});
```

---

### 7. `db/config.ts` ⭐⭐⭐⭐

**Strengths:**
- Clean Astro DB schema
- Proper foreign key references
- Deduplication via hash column
- Audit trail via ScrapeLog table

**Issues:**
1. **EventType as text** - Could use Astro DB enum if available
2. **updatedAt default** - Won't update automatically on upsert

---

### 8. `db/seed.ts` ⭐⭐ 

**Issues:**
1. **Import error** - `import { db, Venue } from 'astro:db'` fails (Venue not exported)
2. **URLs mismatch** - Fox URL listed as `/events/` but scraper uses `/monthly-calendar`
3. **Hardcoded dates** - `createdAt: new Date()` creates different dates each run

**Fix:**
```typescript
// Use the correct import
import { db } from 'astro:db';
import { Venue } from './config';
```

---

### 9. `scripts/scrape.ts` ⭐⭐⭐⭐

**Strengths:**
- Clean orchestration flow
- Good progress reporting
- Normalization layer between raw and final events

**Issues:**
1. **No database insertion** - Just outputs JSON to console
2. **No deduplication** - Relies on hash, but doesn't check existing events
3. **toVancouverISO unused** - Imported but not called

---

### 10. `src/pages/index.astro` ⭐

**Status:** Placeholder only. No actual UI implemented.

---

## Critical Bugs

| Priority | Issue | Location | Fix |
|----------|-------|----------|-----|
| 🔴 High | Fox scraper produces duplicate events | `fox.ts` | Dedupe by href |
| 🔴 High | `db/seed.ts` fails to compile | `seed.ts:1` | Fix Astro DB import |
| 🟡 Medium | Rio scraper may have stale elements | `rio.ts` | Refactor to URL-collect pattern |
| 🟡 Medium | Doors time parsed incorrectly in Fox | `fox.ts` | Captured but applied to wrong events |

---

## Missing Features

1. **Test Suite** - Zero test files in `src/`
2. **Database Integration** - Scraper outputs JSON but doesn't persist
3. **Frontend UI** - Only placeholder exists
4. **Pagination** - Fox/Rio only scrape current month
5. **Caching** - Re-scrapes everything each run

---

## Recommendations

### Immediate (This Sprint)
1. Fix Fox duplicate events bug
2. Fix `db/seed.ts` import error
3. Add unit tests for `date-parser.ts` and `classifier.ts`

### Short Term (Next Sprint)
1. Implement database insertion in orchestrator
2. Add URL deduplication to all scrapers
3. Build basic event listing frontend

### Long Term
1. Add more venues (Park, Hero's Welcome)
2. Implement incremental scraping (only new events)
3. Add LLM-based event classification
4. Add email/webhook notifications for new events

---

## Test Plan

```typescript
// Recommended test structure
src/
├── lib/
│   ├── utils/
│   │   ├── date-parser.test.ts     # Pure function tests
│   │   └── classifier.test.ts      # Pure function tests
│   └── venues/
│       ├── __mocks__/              # Mock HTML fixtures
│       └── venues.test.ts          # Integration tests with mocked pages
```

Run with: `bun test`

---

## Conclusion

Paper-Bear has a **solid foundation** with clean code architecture and good separation of concerns. The main gaps are:

1. **No tests** - High risk for regressions
2. **Fox duplicate bug** - Needs immediate fix
3. **No database integration** - Scraper is standalone

The codebase is ready for the next phase: productionizing with tests, DB sync, and a user-facing frontend.
