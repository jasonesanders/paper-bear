
import { db, Event, ScrapeLog, desc } from 'astro:db';

export default async function verify() {
    console.log('🔍 Verifying Database Content...\n');

    // Check Events
    const events = await db.select().from(Event).limit(5);
    console.log(`✅ Found ${events.length} events (sample):`);
    events.forEach(e => console.log(`   - ${e.title} (${e.date})`));

    // Check Logs
    const logs = await db.select().from(ScrapeLog).orderBy(desc(ScrapeLog.timestamp)).limit(5);
    console.log(`\n✅ Found ${logs.length} scrape logs:`);
    logs.forEach(l => console.log(`   - ${l.venueId}: ${l.status} (${l.itemsFound} items)`));
}
