import type { Page } from 'playwright';
import type { VenueScraper, RawEvent } from '../utils/scraper-core';

/**
 * Rio Theatre Scraper
 * 
 * Target: https://riotheatre.ca/calendar/
 * Structure: Month grid view. Events are clickable divs with no direct valid hrefs in the calendar.
 * Method: 
 * 1. Scrape the calendar grid for "Day" + "Title" + "Time"
 * 2. Click each event to navigate to the detail page (or construct URL if predictable)
 * 3. Extract price/details from the detail page
 * 
 * Selectors:
 * - Event item: .an-event
 * - Title: .an-event__title
 * - Time: .an-event__time
 * - Date: Parent .day -> .day__label--full-date (e.g., "Thursday January 8")
 * - Detail Page Price: .event-meta__price (common in similar themes, need to verify)
 */

export const RioTheatre: VenueScraper = {
    id: 'rio-theatre',
    name: 'Rio Theatre',
    url: 'https://riotheatre.ca/calendar/',
    enabled: true,

    async scrape(page: Page | null): Promise<RawEvent[]> {
        if (!page) {
            throw new Error('Rio Theatre requires Playwright (dynamic scraping)');
        }

        // Wait for calendar to load
        await page.waitForSelector('.schedule', { timeout: 15000 });

        // Allow a moment for the JS to hydrate the events
        await page.waitForTimeout(2000);

        // Initial scrape of the calendar grid
        console.log('   🗓️  Scanning calendar grid...');
        const calendarItems = await page.evaluate(() => {
            const items: {
                title: string;
                datePart: string;
                time: string;
                elementIndex: number
            }[] = [];

            const days = document.querySelectorAll('.day');
            days.forEach((day, dayIndex) => {
                // Extract date label (e.g. "Thursday January 8")
                const dateLabel = day.querySelector('.day__label--full-date')?.textContent?.trim() || '';

                const events = day.querySelectorAll('.an-event');
                events.forEach((event, eventIndex) => {
                    const title = event.querySelector('.an-event__title')?.textContent?.trim() || '';
                    const time = event.querySelector('.an-event__time')?.textContent?.trim() || '';

                    if (title) {
                        // We store the specific indices to locate and click these elements later
                        // Note: This matches based on the flattened list order logic we'll re-run
                        items.push({
                            title,
                            datePart: dateLabel,
                            time,
                            elementIndex: -1 // Placeholder
                        });
                    }
                });
            });
            return items;
        });

        console.log(`   Found ${calendarItems.length} events on calendar. Visiting details...`);

        const enrichedEvents: RawEvent[] = [];
        const eventCount = await page.locator('.an-event').count();

        // Limit to first 20 events to avoid timeouts during development/testing (optional)
        // For production, we'd iterate all.
        const maxEvents = Math.min(eventCount, 50);

        for (let i = 0; i < maxEvents; i++) {
            // Re-locate elements fresh each loop to avoid stale handles
            const eventLocator = page.locator('.an-event').nth(i);

            // Extract info from grid again to match our list
            // Note: This assumes the order hasn't changed.
            const title = await eventLocator.locator('.an-event__title').textContent();
            const time = await eventLocator.locator('.an-event__time').textContent();

            // Find the date context
            // This is tricky with locators. Better to rely on our first pass for date context
            // if we can map them 1:1. 
            // Strategy: Match by title+time from our `calendarItems`.
            const match = calendarItems.find(c => c.title === title?.trim() && c.time === time?.trim());
            const dateRaw = match ? `${match.datePart} ${time}` : '';

            if (!match) {
                console.warn(`   ⚠️ Could not match event at index ${i} to calendar scan.`);
                continue;
            }

            try {
                // Click to navigate to detail page
                // We need to command-click (mac) or control-click to open in new tab? 
                // Or just click, scrape, and go back.
                await eventLocator.click();
                await page.waitForTimeout(1000); // Wait for nav

                const currentUrl = page.url();

                // Scrape Details
                // Price is often in the content or sidebar
                const priceRaw = await page.evaluate(() => {
                    const body = document.body.innerText;
                    // Look for price patterns
                    const match = body.match(/\$(\d+(\.\d{2})?)/);
                    return match ? match[0] : undefined;
                });

                enrichedEvents.push({
                    title: match.title,
                    dateRaw: dateRaw.trim(),
                    url: currentUrl,
                    priceRaw,
                    doorsRaw: undefined // Rio usually lists showtime, doors rarely separate on cal
                });

                // Go back to calendar
                await page.goBack({ waitUntil: 'domcontentloaded' });
                await page.waitForSelector('.schedule');
                await page.waitForTimeout(500); // Wait for re-render

            } catch (err) {
                console.error(`   ❌ Failed to scrape detail for "${match.title}":`, err);
                // Try to recover state
                if (!page.url().includes('calendar')) {
                    await page.goto('https://riotheatre.ca/calendar/');
                    await page.waitForSelector('.schedule');
                }
            }
        }

        return enrichedEvents;
    },
};
