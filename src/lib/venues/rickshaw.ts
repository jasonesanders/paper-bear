import type { Page } from 'playwright';
import type { VenueScraper, RawEvent } from '../utils/scraper-core';

/**
 * Rickshaw Theatre Scraper
 * 
 * Site: https://rickshawtheatre.com/
 * Note: Events are on the home page, not /events/
 * Structure: WordPress Divi theme with custom listing blocks
 * 
 * Selectors:
 * - Container: #listing_wrapper
 * - Event item: article.listing_block
 * - Title: h2.listing_title a
 * - Date: span.listing_list_date + span.listing_list_time
 * - Tickets link: a.listing_link
 * - Event page: h2.listing_title a (href)
 * - Sold out: span.special_type (contains "Sold Out")
 */
export const RickshawTheatre: VenueScraper = {
    id: 'rickshaw-theatre',
    name: 'Rickshaw Theatre',
    url: 'https://rickshawtheatre.com/', // Not /events/
    enabled: true,

    async scrape(page: Page | null): Promise<RawEvent[]> {
        if (!page) {
            throw new Error('Rickshaw Theatre requires Playwright (dynamic scraping)');
        }

        // Wait for events to load
        await page.waitForSelector('article.listing_block', { timeout: 15000 });

        // Scroll to load all events (lazy loading)
        await autoScroll(page);

        // Extract all events
        const events = await page.$$eval('article.listing_block', (articles) => {
            return articles.map((article) => {
                // Title
                const titleEl = article.querySelector('h2.listing_title a');
                const title = titleEl?.textContent?.trim() || '';

                // Date (combine date + time/year spans)
                const dateEl = article.querySelector('span.listing_list_date');
                const timeEl = article.querySelector('span.listing_list_time');
                const datePart = dateEl?.textContent?.trim() || '';
                const yearPart = timeEl?.textContent?.trim() || '';
                const dateRaw = `${datePart} ${yearPart}`.trim();

                // Event detail URL
                const url = titleEl?.getAttribute('href') || '';

                // Tickets URL (external)
                const ticketsEl = article.querySelector('a.listing_link');
                const ticketsUrl = ticketsEl?.getAttribute('href') || '';

                // Supporting acts
                const supportEl = article.querySelector('p.listing_presented');
                const supportingActs = supportEl?.textContent?.trim() || '';

                // Sold out status
                const soldOutEl = article.querySelector('span.special_type');
                const isSoldOut = soldOutEl?.textContent?.toLowerCase().includes('sold out') || false;

                return {
                    title: supportingActs ? `${title} (w/ ${supportingActs})` : title,
                    dateRaw,
                    url,
                    ticketsUrl,
                    isSoldOut,
                };
            });
        });

        // Filter out events without titles
        return events.filter((e) => e.title.length > 0);
    },
};

/**
 * Auto-scroll to trigger lazy loading of all events.
 */
async function autoScroll(page: Page): Promise<void> {
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 400;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });

    // Wait a moment for any final content to load
    await page.waitForTimeout(500);
}
