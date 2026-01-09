import type { Page } from 'playwright';
import type { VenueScraper, RawEvent } from '../utils/scraper-core';

/**
 * Fox Cabaret Scraper
 * 
 * Target: https://www.foxcabaret.com/monthly-calendar
 * Platform: Squarespace (YUI3 calendar block)
 * 
 * Calendar Page Structure:
 * - Main container: div.sqs-block-calendar
 * - Day cells: td.yui3-calendar-day (data-pnum contains day number)
 * - Event items: li.item (inside each day cell)
 * - Event link: a.item-link
 * - Title: .item-title
 * - Time: .item-time--12hr (e.g., "10:30 PM")
 * - Month/Year: table.yui3-calendar-grid[aria-label] (e.g., "January 2026")
 * 
 * Detail Page Structure:
 * - URL pattern: /monthly-calendar-list/[year]/[event-slug]
 * - Title: h1.eventitem-title
 * - Date: time.event-date (datetime attr = "2025-12-31")
 * - Time: time.event-time-12hr
 * - Description: article.eventitem (body text contains doors/price)
 * 
 * Notes:
 * - Price often in Eventbrite iframe or body text
 * - Doors time usually in description ("Doors 7:00pm")
 */

export const FoxCabaret: VenueScraper = {
    id: 'fox-cabaret',
    name: 'Fox Cabaret',
    url: 'https://www.foxcabaret.com/monthly-calendar',
    enabled: true,

    async scrape(page: Page | null): Promise<RawEvent[]> {
        if (!page) {
            throw new Error('Fox Cabaret requires Playwright (dynamic scraping)');
        }

        // Wait for calendar to load
        await page.waitForSelector('.sqs-block-calendar', { timeout: 15000 });
        await page.waitForTimeout(1500); // Allow JS to hydrate

        // Get current month/year from calendar header
        const monthYear = await page.evaluate(() => {
            const table = document.querySelector('table.yui3-calendar-grid');
            return table?.getAttribute('aria-label') || '';
        });
        console.log(`   📅 Scanning calendar: ${monthYear}`);

        // Extract all events from calendar grid
        const calendarEvents = await page.evaluate(() => {
            const items: {
                title: string;
                time: string;
                dayNum: string;
                href: string;
            }[] = [];
            const seenHrefs = new Set<string>();

            const dayCells = document.querySelectorAll('td.yui3-calendar-day');
            dayCells.forEach((cell) => {
                const dayNum = cell.getAttribute('data-pnum') || '';
                const events = cell.querySelectorAll('li.item');

                events.forEach((event) => {
                    const link = event.querySelector('a.item-link') as HTMLAnchorElement;
                    if (!link) return;

                    const title = link.querySelector('.item-title')?.textContent?.trim() || '';
                    const time = link.querySelector('.item-time--12hr')?.textContent?.trim() || '';
                    const href = link.getAttribute('href') || '';

                    if (title && !seenHrefs.has(href)) {
                        seenHrefs.add(href);
                        items.push({ title, time, dayNum, href });
                    }
                });
            });

            return items;
        });

        // Deduplicate events (Squarespace often renders duplicates)
        const uniqueEvents = new Map<string, typeof calendarEvents[0]>();
        for (const event of calendarEvents) {
            if (!uniqueEvents.has(event.href)) {
                uniqueEvents.set(event.href, event);
            }
        }
        const dedupedEvents = Array.from(uniqueEvents.values());

        console.log(`   Found ${dedupedEvents.length} events on calendar (deduplicated from ${calendarEvents.length}). Fetching details...`);

        const enrichedEvents: RawEvent[] = [];
        const baseUrl = 'https://www.foxcabaret.com';

        // Limit for safety during development
        const maxEvents = Math.min(dedupedEvents.length, 50);

        for (let i = 0; i < maxEvents; i++) {
            const event = dedupedEvents[i];
            const eventUrl = event.href.startsWith('http') ? event.href : `${baseUrl}${event.href}`;

            try {
                // Navigate to detail page
                await page.goto(eventUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                await page.waitForTimeout(500);

                // Extract details from event page
                const details = await page.evaluate(() => {
                    const article = document.querySelector('article.eventitem');
                    if (!article) return { dateRaw: '', priceRaw: undefined, doorsRaw: undefined };

                    // Date from meta
                    const dateEl = article.querySelector('time.event-date');
                    const dateAttr = dateEl?.getAttribute('datetime') || '';
                    const dateText = dateEl?.textContent?.trim() || '';

                    // Time from meta
                    const timeEl = article.querySelector('time.event-time-12hr');
                    const timeText = timeEl?.textContent?.trim() || '';

                    // Combined date
                    const dateRaw = `${dateText} ${timeText}`.trim();

                    // Scan body text for doors and price
                    const bodyText = article.textContent || '';

                    // Doors pattern: "Doors 7:00pm" or "Doors: 7:00 PM"
                    const doorsMatch = bodyText.match(/Doors[:\s]+(\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)/i);
                    const doorsRaw = doorsMatch ? doorsMatch[1] : undefined;

                    // Price pattern: "$15" or "$15 advance / $20 door"
                    const priceMatch = bodyText.match(/\$(\d+(?:\.\d{2})?)/);
                    const priceRaw = priceMatch ? priceMatch[0] : undefined;

                    return { dateRaw, priceRaw, doorsRaw };
                });

                enrichedEvents.push({
                    title: event.title,
                    dateRaw: details.dateRaw || `${monthYear} ${event.dayNum} ${event.time}`,
                    url: eventUrl,
                    priceRaw: details.priceRaw,
                    doorsRaw: details.doorsRaw,
                });

                // Progress indicator
                if ((i + 1) % 10 === 0) {
                    console.log(`   📄 Progress: ${i + 1}/${maxEvents} events`);
                }

            } catch (err) {
                // If detail fetch fails, still include with calendar data
                console.warn(`   ⚠️ Failed to fetch details for "${event.title}"`);
                enrichedEvents.push({
                    title: event.title,
                    dateRaw: `${monthYear} ${event.dayNum} ${event.time}`,
                    url: eventUrl,
                });
            }
        }

        // Navigate back to calendar for next scraper
        await page.goto('https://www.foxcabaret.com/monthly-calendar', {
            waitUntil: 'domcontentloaded'
        });

        return enrichedEvents;
    },
};
