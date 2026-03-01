import type { VenueScraper, RawEvent } from '../utils/scraper-core';
import type { Page } from 'playwright';

/**
 * Rio Theatre Scraper
 *
 * Target: https://riotheatre.ca/calendar
 * Platform: WordPress + "Barker" events plugin
 *
 * Strategy: Hit the WordPress REST API directly instead of scraping HTML.
 * The calendar UI is JS-rendered with no hrefs in the DOM, but the underlying
 * API returns clean JSON with ISO timestamps, titles, and ticket links.
 *
 * API endpoint:
 *   GET https://riotheatre.ca/wp-json/barker/v1/listings
 *   ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 *
 * Response shape (per listing):
 * {
 *   id: number,
 *   event: { id: number, title: string, link: string },   // riotheatre.ca detail page
 *   start_time: string,   // ISO 8601 UTC: "2026-03-01T02:30:00+00:00"
 *   tickets_link: string, // riotheatretickets.ca ticket URL
 *   premiere: boolean,
 *   extra: string
 * }
 *
 * Note: start_time is UTC — the existing normalizeEvents() pipeline converts to
 * Vancouver time via date-fns-tz before storing, so this Just Works™.
 *
 * Note: event.title may contain HTML entities (e.g., &#8220; for "). These are
 * decoded before storing.
 */

/** How many days ahead to fetch. 30 days covers ~4 weeks of upcoming events. */
const FETCH_DAYS_AHEAD = 30;

const API_BASE = 'https://riotheatre.ca/wp-json/barker/v1/listings';

interface BarkerListing {
    id: number;
    event: {
        id: number;
        title: string;
        link: string;
    };
    start_time: string;
    end_time: string;
    tickets_link: string;
    premiere: boolean;
    extra: string;
}

/**
 * Decode HTML entities in a string (e.g. &#8220; → ", &amp; → &).
 * Covers the most common entities returned by the WordPress API.
 */
function decodeHtmlEntities(str: string): string {
    return str
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#038;/g, '&');
}

/**
 * Format a Date as YYYY-MM-DD in UTC (for the API's start_date / end_date params).
 */
function toApiDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export const RioTheatre: VenueScraper = {
    id: 'rio-theatre',
    name: 'Rio Theatre',
    url: 'https://riotheatre.ca/calendar',
    enabled: true,

    async scrape(_page: Page | null): Promise<RawEvent[]> {
        console.log('   🎬 Fetching Rio Theatre events from REST API...');

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + FETCH_DAYS_AHEAD);

        const params = new URLSearchParams({
            start_date: toApiDate(startDate),
            end_date: toApiDate(endDate),
        });

        const apiUrl = `${API_BASE}?${params.toString()}`;

        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'TheWeekAhead/1.0 (Vancouver Community Events Bot; hello@theweekahead.ca)',
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Rio Theatre API error: HTTP ${response.status} ${response.statusText}`);
        }

        const listings: BarkerListing[] = await response.json();

        console.log(`   Found ${listings.length} listings from Rio Theatre API`);

        const events: RawEvent[] = listings.map((listing) => {
            const title = decodeHtmlEntities(listing.event.title);

            // start_time is ISO UTC — pass it directly as dateRaw.
            // parseVancouverDate() handles ISO strings and converts to Vancouver time.
            const dateRaw = listing.start_time;

            // Prefer the riotheatre.ca detail page; fall back to ticket link.
            const url = listing.event.link || listing.tickets_link || '';

            return {
                title,
                dateRaw,
                url,
            };
        });

        // Filter out any entries without a title (shouldn't happen, but defensive)
        const validEvents = events.filter((e) => e.title.length > 0);

        console.log(`   ✅ ${validEvents.length} valid Rio Theatre events`);

        return validEvents;
    },
};
