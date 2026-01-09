# Jules Prompts for Paper-Bear

A collection of prompts for Jules to review code quality, run tests, and improve the codebase.

---

## 1. Code Review: Fox Cabaret Scraper

```
Review the new Fox Cabaret scraper at `src/lib/venues/fox.ts`:

1. Compare it against the existing patterns in `rickshaw.ts` and `rio.ts`
2. Check for error handling completeness
3. Identify any potential race conditions or stale element issues
4. Review the CSS selectors for robustness (Squarespace may change classes)
5. Suggest improvements for maintainability

Focus on: consistency with existing scrapers, edge case handling, and selector brittleness.
```

---

## 2. Test Coverage Analysis

```
Analyze the test coverage for the paper-bear scraper project:

1. Check what tests exist in the codebase (look for *.test.ts, *.spec.ts files)
2. Identify which modules have no test coverage:
   - src/lib/utils/scraper-core.ts
   - src/lib/utils/date-parser.ts
   - src/lib/utils/classifier.ts
   - src/lib/venues/*.ts
3. Propose a testing strategy using vitest (already in devDependencies)
4. Create unit tests for the pure functions in date-parser.ts and classifier.ts

Run: `bun test` to execute any existing tests.
```

---

## 3. Fix Duplicate Events Issue

```
The Fox Cabaret scraper produces duplicate events. Investigate and fix:

1. Run the scraper: `~/.bun/bin/bun run scripts/scrape.ts`
2. Observe the Fox Cabaret output - events appear twice
3. Analyze `src/lib/venues/fox.ts` to find where duplicates originate
4. The Squarespace calendar has a hidden `.flyoutitemlist` that may cause double-counting
5. Implement deduplication either:
   - At scrape time (filter duplicate hrefs/titles)
   - Using the existing hash field in post-processing

Verify the fix by running the scraper again and confirming unique events only.
```

---

## 4. Date Parser Edge Cases

```
Review and test the date parser at `src/lib/utils/date-parser.ts`:

1. Read the parseVancouverDate function
2. Identify edge cases that might fail:
   - Different date formats from each venue
   - Missing year information
   - 12hr vs 24hr time formats
   - Timezone handling (Vancouver is PST/PDT)
3. Write unit tests for discovered edge cases
4. Check if Fox Cabaret dates parse correctly (format: "Saturday, January 4, 2025 10:30 PM")

Run tests with: `bun test`
```

---

## 5. Scraper Core Improvements

```
Review `src/lib/utils/scraper-core.ts` for potential improvements:

1. The EthicalScraper uses page.goto with networkidle - is this optimal?
2. Review retry logic with exponential backoff
3. Check if browser context is properly reused across venues
4. Suggest improvements for:
   - Memory management (browser cleanup)
   - Parallel scraping (currently sequential)
   - Caching of already-scraped events
5. Consider adding a dry-run mode for testing without network

Propose changes as a PR if warranted.
```

---

## 6. Type Safety Audit

```
Audit TypeScript type safety across the codebase:

1. Run `npx tsc --noEmit` and fix any type errors
2. Check for uses of `any` type that could be more specific
3. Review the RawEvent interface - is it comprehensive enough?
4. Ensure all venue scrapers implement VenueScraper interface correctly
5. Add stricter tsconfig options if beneficial

Note: There's a known issue in db/seed.ts with Astro DB types.
```

---

## 7. Add End-to-End Scraper Test

```
Create an E2E test for the scraper system:

1. Create a test file: `scripts/scrape.test.ts`
2. Mock the Playwright browser to avoid real network calls
3. Test the flow: venue config → scraper execution → event normalization
4. Verify that:
   - All enabled venues are scraped
   - Events are properly normalized (have id, hash, date, etc.)
   - Errors are caught and reported correctly
5. Use vitest for the test framework

The test should run quickly without hitting real websites.
```

---

## Usage

Copy any prompt above and paste it to Jules. Each prompt is self-contained and focuses on a specific aspect of the codebase.
