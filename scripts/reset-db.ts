import { db, Event, ScrapeLog } from 'astro:db';

export default async function reset() {
    console.log('🗑️  Clearing database...');

    try {
        await db.delete(Event);
        console.log('✅ Cleared Events');

        await db.delete(ScrapeLog);
        console.log('✅ Cleared Scrape Logs');

        console.log('\n✨ Database is now clean.');
    } catch (err) {
        console.error('❌ Failed to reset database:', err);
    }
}
