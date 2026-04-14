import { RioTheatre } from '../src/lib/venues/rio';

async function run() {
    console.log('🚀 Starting Manual Rio Scraper Test...');

    try {
        const events = await RioTheatre.scrape(null, null);

        console.log(`\n✅ Scrape Complete! Found ${events.length} events.\n`);

        console.log('📅 Sample Events (first 10):');
        events.slice(0, 10).forEach((e, i) => {
            console.log(`   ${i + 1}. ${e.title}`);
            console.log(`      Date: ${e.dateRaw}`);
            console.log(`      URL: ${e.url}`);
            console.log('');
        });

    } catch (err) {
        console.error('❌ Error:', err);
    }
}

run();
