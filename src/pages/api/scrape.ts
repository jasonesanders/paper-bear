import type { APIRoute } from 'astro';
import { db, Event, ScrapeLog, Venue, eq, inArray } from 'astro:db';
import { EthicalScraper, generateEventHash } from '../../lib/utils/scraper-core';
import { parseVancouverDate } from '../../lib/utils/date-parser';
import { classifyEventType, parsePrice } from '../../lib/utils/classifier';
import { getEnabledVenues } from '../../config/venues';
import type { ScrapeResult, RawEvent } from '../../lib/utils/scraper-core';
import { randomUUID } from 'crypto';

export const GET: APIRoute = async () => {
    console.log('🐻 API Scraper Triggered');

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
    price: number | null;
    isFree: boolean;
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
        // raw.doorsRaw is like "7:00pm" or "7:00 PM"
        if (raw.doorsRaw) {
            const timeMatch = raw.doorsRaw.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
            if (timeMatch) {
                let hours = parseInt(timeMatch[1], 10);
                const minutes = parseInt(timeMatch[2], 10);
                const meridiem = timeMatch[3]?.toLowerCase();

                // Convert to 24-hour format
                if (meridiem === 'pm' && hours !== 12) hours += 12;
                if (meridiem === 'am' && hours === 12) hours = 0;

                // Create new date with the correct time
                date = new Date(date);
                date.setHours(hours, minutes, 0, 0);
            }
        }

        const { price, isFree } = parsePrice(raw.priceRaw);
        const eventType = classifyEventType(raw.title);
        const hash = generateEventHash(venueId, date, raw.title);

        normalized.push({
            id: randomUUID(),
            venueId,
            title: raw.title,
            date,
            doorsTime: null, // Could store separately if needed
            url: raw.url || null,
            price,
            isFree,
            eventType,
            hash,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    return normalized;
}
