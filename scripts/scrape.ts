/**
 * Scraper Orchestrator
 * 
 * This script runs all enabled venue scrapers, normalizes the data,
 * and prepares it for insertion into Astro DB.
 * 
 * Usage: npx tsx scripts/scrape.ts
 */

import { EthicalScraper, generateEventHash } from '../src/lib/utils/scraper-core';
import { parseVancouverDate, toVancouverISO } from '../src/lib/utils/date-parser';
import { classifyEventType, parsePrice } from '../src/lib/utils/classifier';
import { getEnabledVenues } from '../src/config/venues';
import type { ScrapeResult, RawEvent } from '../src/lib/utils/scraper-core';
import { randomUUID } from 'crypto';

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
}

interface ScrapeReport {
    startTime: Date;
    endTime: Date;
    totalEvents: number;
    results: ScrapeResult[];
    normalizedEvents: NormalizedEvent[];
}

async function main(): Promise<void> {
    console.log('🐻 Paper-Bear Scraper Starting...\n');

    const scraper = new EthicalScraper();
    const venues = getEnabledVenues();
    const report: ScrapeReport = {
        startTime: new Date(),
        endTime: new Date(),
        totalEvents: 0,
        results: [],
        normalizedEvents: [],
    };

    console.log(`📍 Found ${venues.length} enabled venue(s):\n`);
    venues.forEach((v) => console.log(`   - ${v.name}`));
    console.log('');

    try {
        // Initialize browser
        console.log('🌐 Initializing browser...');
        await scraper.init();

        // Run each scraper
        for (const venue of venues) {
            console.log(`\n━━━ ${venue.name} ━━━`);
            const result = await scraper.runScraper(venue);
            report.results.push(result);

            if (result.status === 'success') {
                // Normalize events
                const normalized = normalizeEvents(venue.id, result.events);
                report.normalizedEvents.push(...normalized);
                console.log(`   ✅ Normalized ${normalized.length} events`);
            } else if (result.status === 'error') {
                console.log(`   ❌ Error: ${result.errorMessage}`);
            } else {
                console.log(`   ⏭️  Skipped (disabled)`);
            }
        }
    } finally {
        // Clean up
        await scraper.close();
    }

    report.endTime = new Date();
    report.totalEvents = report.normalizedEvents.length;

    // Print summary
    printSummary(report);

    // Output normalized events as JSON (for now)
    console.log('\n📦 Normalized Events JSON:\n');
    console.log(JSON.stringify(report.normalizedEvents, null, 2));
}

function normalizeEvents(venueId: string, rawEvents: RawEvent[]): NormalizedEvent[] {
    const normalized: NormalizedEvent[] = [];

    for (const raw of rawEvents) {
        // Parse date
        const date = parseVancouverDate(raw.dateRaw);
        if (!date) {
            console.warn(`   ⚠️  Skipping event "${raw.title}" - could not parse date: "${raw.dateRaw}"`);
            continue;
        }

        // Parse price
        const { price, isFree } = parsePrice(raw.priceRaw);

        // Classify event type
        const eventType = classifyEventType(raw.title);

        // Generate dedup hash
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
        });
    }

    return normalized;
}

function printSummary(report: ScrapeReport): void {
    const durationMs = report.endTime.getTime() - report.startTime.getTime();
    const durationSec = (durationMs / 1000).toFixed(1);

    console.log('\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('               📊 SUMMARY               ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total Events: ${report.totalEvents}`);
    console.log(`   Duration: ${durationSec}s`);
    console.log('');

    for (const result of report.results) {
        const statusIcon = result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : '⏭️';
        console.log(`   ${statusIcon} ${result.venueId}: ${result.events.length} events (${result.durationMs}ms)`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
