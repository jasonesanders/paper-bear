import type { Page } from 'playwright';
import type { VenueScraper, RawEvent } from '../utils/scraper-core';

/**
 * Fox Cabaret Scraper
 * 
 * Target: https://www.foxcabaret.com/monthly-calendar-list
 * Platform: Squarespace (eventlist block)
 * 
 * Page Structure (List View - much simpler than calendar grid):
 * - Event container: article.eventlist-event
 * - Title: a.eventlist-title-link (inside h1.eventlist-title)
 * - Date: time.event-date (datetime attribute = ISO date)
 * - Time: .event-time-12hr (inside .eventlist-meta-time)
 * - Description: .eventlist-excerpt
 * - Event URL: a.eventlist-title-link (href attribute)
 * 
 * Notes:
 * - All ~75 events load on a single page (no pagination)
 * - Doors time often in description (e.g., "Doors 7:00pm")
 * - Price often in description or on ticket link
 */

export const FoxCabaret: VenueScraper = {
    id: 'fox-cabaret',
    name: 'Fox Cabaret',
    url: 'https://www.foxcabaret.com/monthly-calendar-list',
    enabled: true,

    async scrape(page: Page | null): Promise<RawEvent[]> {
        if (!page) {
            throw new Error('Fox Cabaret requires Playwright (dynamic scraping)');
        }

        // Wait for event list to load
        await page.waitForSelector('article.eventlist-event', { timeout: 15000 });

        console.log('   🦊 Scanning Fox Cabaret event list...');

        // Extract all events from the list page
        const events = await page.$$eval('article.eventlist-event', (eventNodes) => {
            return eventNodes.map((event) => {
                // Title and URL
                const titleLink = event.querySelector('a.eventlist-title-link') as HTMLAnchorElement;
                const title = titleLink?.textContent?.trim() || '';
                const href = titleLink?.getAttribute('href') || '';

                // Date from time element
                const dateEl = event.querySelector('time.event-date');
                const dateAttr = dateEl?.getAttribute('datetime') || '';
                const dateText = dateEl?.textContent?.trim() || '';

                // Time from 12hr format
                const timeEl = event.querySelector('.event-time-12hr');
                let timeText = timeEl?.textContent?.trim() || '';
                // Sanitize time string: replace non-breaking spaces with standard space
                timeText = timeText.replace(/[\u00a0\u202f]/g, ' ').trim();

                // Combined date string
                const dateRaw = `${dateText} ${timeText}`.trim();

                // Description/excerpt
                const excerptEl = event.querySelector('.eventlist-excerpt');
                const description = excerptEl?.textContent?.trim() || '';

                // Extract doors time from description
                // Pattern: "Doors 7:00pm" or "Doors: 7:00 PM"
                const doorsMatch = description.match(/Doors[:\s]+([\d:]+\s*(?:AM|PM|am|pm)?)/i);
                const doorsRaw = doorsMatch ? doorsMatch[1].trim() : undefined;

                // Extract price from description
                // Pattern: "$15" or "$20 advance"
                const priceMatch = description.match(/\$(\d+(?:\.\d{2})?)/);
                const priceRaw = priceMatch ? priceMatch[0] : undefined;

                return {
                    title,
                    dateRaw,
                    url: href.startsWith('http') ? href : `https://www.foxcabaret.com${href}`,
                    doorsRaw,
                    priceRaw,
                };
            });
        });

        // Filter out events without titles
        const validEvents = events.filter((e) => e.title.length > 0);

        console.log(`   Found ${validEvents.length} events on Fox Cabaret list page`);

        return validEvents;
    },
};
