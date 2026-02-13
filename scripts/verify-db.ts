import { db, Event, ScrapeLog, Venue, desc, eq } from 'astro:db';

export default async function verify() {
    console.log('🔍 Verifying Database Content...');

    const venues = await db.select().from(Venue);
    console.log(`\n✅ Found ${venues.length} venues:`);
    venues.forEach(v => console.log(`   - ${v.id}: ${v.name}`));

    // Check Events per venue
    console.log('\n📊 Event Counts and Date Ranges:');
    const now = new Date();
    for (const v of venues) {
        const evs = await db.select().from(Event).where(eq(Event.venueId, v.id)).orderBy(Event.date);
        console.log(`   - ${v.name}: ${evs.length} events`);
        if (evs.length > 0) {
            console.log(`     Earliest: ${evs[0].date.toDateString()}`);
            console.log(`     Latest:   ${evs[evs.length - 1].date.toDateString()}`);

            const upcoming = evs.filter(e => e.date >= now);
            console.log(`     Upcoming (from now): ${upcoming.length}`);
            if (upcoming.length > 0) {
                console.log(`     Next up: ${upcoming[0].title} on ${upcoming[0].date.toDateString()}`);
            }
        }
    }

    // Check Logs
    const logs = await db.select().from(ScrapeLog).orderBy(desc(ScrapeLog.timestamp)).limit(5);
    console.log(`\n✅ Found ${logs.length} scrape logs:`);
    logs.forEach(l => console.log(`   - ${l.venueId}: ${l.status} (${l.itemsFound} items)`));
}
