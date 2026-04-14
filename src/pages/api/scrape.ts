export const prerender = false;

import type { APIRoute } from 'astro';
import { db, Event, ScrapeLog, Venue, eq, inArray } from 'astro:db';
import { EthicalScraper, generateEventHash } from '../../lib/utils/scraper-core';
import { parseVancouverDate } from '../../lib/utils/date-parser';
import { classifyEventType } from '../../lib/utils/classifier';
import { sanitizeEventUrl } from '../../lib/utils/sanitize-url';
import { getEnabledVenues } from '../../config/venues';
import type { ScrapeResult, RawEvent } from '../../lib/utils/scraper-core';
import { randomUUID, timingSafeEqual } from 'crypto';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const VANCOUVER_TZ = 'America/Vancouver';

export const GET: APIRoute = async ({ request }) => {
    // VULN-001 fix: Require auth token to prevent unauthenticated scraping
    // process.env (not import.meta.env) is needed for runtime env vars in Astro Node standalone SSR
    const token = request.headers.get('X-Scrape-Token');
    const secret = process.env.SCRAPE_SECRET;

    const isValidToken = !!token && !!secret &&
        token.length === secret.length &&
        timingSafeEqual(Buffer.from(token), Buffer.from(secret));

    if (!isValidToken) {
        console.warn('🚫 Scrape attempt rejected: invalid or missing token');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    console.log('🐻 API Scraper Triggered (authenticated)');

    const scraper = new EthicalScraper();
    const venues = getEnabledVenues();
    const report = {
        startTime: new Date(),
        endTime: new Date(),
        totalEvents: 0,
        insertedEvents: 0,
        results: [] as any[],
        errors: [] as string[],
    };

    try {
        await scraper.init();

        for (const venue of venues) {
            console.log(`\n━━━ Scraping ${venue.name} ━━━`);
            const startTime = Date.now();
            const result = await scraper.runScraper(venue);
            const durationMs = Date.now() - startTime;

            report.results.push({
                venue: venue.name,
                status: result.status,
                found: result.events.length,
                durationMs
            });

            // Log attempt
            await db.insert(ScrapeLog).values({
                id: randomUUID(),
                venueId: venue.id,
                timestamp: new Date(),
                status: result.status,
                itemsFound: result.events.length,
                errorMessage: result.errorMessage,
                durationMs
            });

            if (result.status === 'success') {
                // Update lastScrapedAt
                await db.update(Venue)
                    .set({ lastScrapedAt: new Date() })
                    .where(eq(Venue.id, venue.id));

                const normalized = normalizeEvents(venue.id, result.events);

                if (normalized.length > 0) {
                    // Fetch existing hashes to verify duplicates
                    // Better: fetch all hashes for this VENUE from DB to checking against.
                    const existingHashesInDb = await db.select({ hash: Event.hash })
                        .from(Event)
                        .where(eq(Event.venueId, venue.id));

                    const existingHashSet = new Set(existingHashesInDb.map(e => e.hash));

                    // Filter duplicates from DB
                    let uniqueEvents = normalized.filter(e => !existingHashSet.has(e.hash));

                    // Filter duplicates within the current batch (Self-deduplication)
                    const batchHashes = new Set();
                    uniqueEvents = uniqueEvents.filter(e => {
                        if (batchHashes.has(e.hash)) return false;
                        batchHashes.add(e.hash);
                        return true;
                    });

                    if (uniqueEvents.length > 0) {
                        await db.insert(Event).values(uniqueEvents);
                        console.log(`   ✅ Inserted ${uniqueEvents.length} new events for ${venue.name}`);
                        report.insertedEvents += uniqueEvents.length;
                    } else {
                        console.log(`   ℹ️  No new events for ${venue.name} (all ${normalized.length} duplicates)`);
                    }
                }
            } else {
                report.errors.push(`${venue.name}: ${result.errorMessage}`);
            }
        }

    } catch (e: any) {
        console.error('Scrape API Error:', e);
        report.errors.push(`Fatal: ${e.message}`);
        return new Response(JSON.stringify(report, null, 2), { status: 500 });
    } finally {
        await scraper.close();
    }

    report.endTime = new Date();
    report.totalEvents = report.results.reduce((acc, r) => acc + r.found, 0);

    return new Response(JSON.stringify(report, null, 2), {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        }
    });
};

// Helper: Normalize Logic (Duplicated from script for now to ensure self-contained API)
interface NormalizedEvent {
    id: string;
    venueId: string;
    title: string;
    date: Date;
    doorsTime: Date | null;
    url: string | null;
    eventType: string;
    hash: string;
    createdAt: Date;
    updatedAt: Date;
}

function normalizeEvents(venueId: string, rawEvents: RawEvent[]): NormalizedEvent[] {
    const normalized: NormalizedEvent[] = [];

    for (const raw of rawEvents) {
        let date = parseVancouverDate(raw.dateRaw);

        // Diagnostic logging for debugging year/time issues
        console.log(`   [DEBUG] ${venueId} | "${raw.title.slice(0, 30)}..." | dateRaw="${raw.dateRaw}" | doorsRaw="${raw.doorsRaw}" | parsed=${date?.toISOString()}`);

        if (!date) continue; // Skip unparsable

        // If we have a doors time, combine it with the calendar date
        // raw.doorsRaw is like "7:00pm", "7:00 PM", or "7pm"
        if (raw.doorsRaw) {
            // Try time with colon first, then without
            const timeMatch = raw.doorsRaw.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i)
                || raw.doorsRaw.match(/(\d{1,2})()\s*(am|pm)/i); // "7pm" — empty capture for minutes
            if (timeMatch) {
                let hours = parseInt(timeMatch[1], 10);
                const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
                const meridiem = timeMatch[3]?.toLowerCase();

                // Convert to 24-hour format
                if (meridiem === 'pm' && hours !== 12) hours += 12;
                if (meridiem === 'am' && hours === 12) hours = 0;

                // date is UTC. Convert to Vancouver local time, set hours, convert back.
                const vanDate = toZonedTime(date, VANCOUVER_TZ);
                vanDate.setHours(hours, minutes, 0, 0);
                date = fromZonedTime(vanDate, VANCOUVER_TZ);
            }
        }

        const eventType = classifyEventType(raw.title);
        const hash = generateEventHash(venueId, date, raw.title);

        normalized.push({
            id: randomUUID(),
            venueId,
            title: raw.title,
            date,
            doorsTime: null, // Could store separately if needed
            url: sanitizeEventUrl(raw.url), // VULN-002: validate URL scheme
            eventType,
            hash,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    return normalized;
}
