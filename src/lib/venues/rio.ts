import type { Page } from 'playwright';
import type { VenueScraper, RawEvent } from '../utils/scraper-core';

/**
 * Rio Theatre Scraper
 * 
 * Target: https://riotheatretickets.ca/
 * Platform: Static HTML ticketing site (simpler than the main calendar)
 * 
 * Page Structure:
 * - Event container: div.single-event
 * - Title: p.event-headline
 * - Date/Time: p.event-date (e.g., "12:45pm - Sunday, Feb 8, 2026")
 * - Description: div.event-description (contains doors/price info)
 * - Ticket link: div.event-buttons-wrapper a.button
 * 
 * Notes:
 * - All events load on a single page (no pagination)
 * - Doors time often in description (e.g., "Doors 12:15 pm | Movie 12:45 pm")
 * - Prices sometimes in description or on ticket detail pages
 */

export const RioTheatre: VenueScraper = {
    id: 'rio-theatre',
    name: 'Rio Theatre',
    url: 'https://riotheatretickets.ca/',
    enabled: true,

    async scrape(page: Page | null): Promise<RawEvent[]> {
        if (!page) {
            throw new Error('Rio Theatre requires Playwright (dynamic scraping)');
        }

        // Wait for events to load
        await page.waitForSelector('div.single-event', { timeout: 15000 });

        console.log('   🎬 Scanning Rio Theatre tickets page...');

        // Extract all events from the page
        const events = await page.$$eval('div.single-event', (eventNodes) => {
            return eventNodes.map((event) => {
                // Title
                const titleEl = event.querySelector('p.event-headline');
                const title = titleEl?.textContent?.trim() || '';

                // Date/Time string (e.g., "12:45pm - Sunday, Feb 8, 2026")
                const dateEl = event.querySelector('p.event-date');
                const dateRaw = dateEl?.textContent?.trim() || '';

                // Description (may contain doors/price info)
                const descEl = event.querySelector('div.event-description');
                const description = descEl?.textContent?.trim() || '';

                // Ticket link
                const linkEl = event.querySelector('div.event-buttons-wrapper a.button') as HTMLAnchorElement;
                const href = linkEl?.getAttribute('href') || '';

                // Extract doors time from description
                // Pattern: "Doors 12:15 pm" or "Doors: 7:00pm"
                const doorsMatch = description.match(/Doors[:\s]+([\d:]+\s*(?:AM|PM|am|pm)?)/i);
                const doorsRaw = doorsMatch ? doorsMatch[1].trim() : undefined;

                // Extract price from description
                // Pattern: "$12" or "$25 + s/c"
                const priceMatch = description.match(/\$(\d+(?:\.\d{2})?)/);
                const priceRaw = priceMatch ? priceMatch[0] : undefined;

                return {
                    title,
                    dateRaw,
                    url: href.startsWith('http') ? href : `https://riotheatretickets.ca${href}`,
                    doorsRaw,
                    priceRaw,
                };
            });
        });

        // Filter out events without titles
        const validEvents = events.filter((e) => e.title.length > 0);

        console.log(`   Found ${validEvents.length} events on Rio Theatre tickets page`);

        return validEvents;
    },
};
