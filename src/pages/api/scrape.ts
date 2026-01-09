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
                    // Note: In a larger DB we might want to filter by venueId first
                    // But for now, we just fetch all hashes for this venue's scraped events?
                    // Better: fetch all hashes for this VENUE from DB to checking against.
                    const existingVenueEvents = await db.select({ hash: Event.hash })
                        .from(Event)
                        .where(eq(Event.venueId, venue.id));

                    const existingHashes = new Set(existingVenueEvents.map(e => e.hash));

                    const newEvents = normalized.filter(e => !existingHashes.has(e.hash));

                    if (newEvents.length > 0) {
                        await db.insert(Event).values(newEvents);
                        console.log(`   ✅ Inserted ${newEvents.length} new events for ${venue.name}`);
                        report.insertedEvents += newEvents.length;
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
        const date = parseVancouverDate(raw.dateRaw);
        if (!date) continue; // Skip unparsable

        const { price, isFree } = parsePrice(raw.priceRaw);
        const eventType = classifyEventType(raw.title);
        const hash = generateEventHash(venueId, date, raw.title);

        normalized.push({
            id: randomUUID(),
            venueId,
            title: raw.title,
            date,
            doorsTime: raw.doorsRaw ? parseVancouverDate(raw.doorsRaw) : null,
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
