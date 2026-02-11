import { chromium } from 'playwright';
import { RioTheatre } from '../src/lib/venues/rio';

async function run() {
    console.log('🚀 Starting Manual Rio Scraper Test...');

    // Launch browser
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'PaperBear/1.0 (Vancouver Community Events Bot; contact@paperbear.dev)',
    });
    const page = await context.newPage();

    try {
        console.log(`📡 Navigating to ${RioTheatre.url}...`);
        await page.goto(RioTheatre.url, { waitUntil: 'networkidle', timeout: 30000 });

        console.log('🔍 Scraping events...');
        const events = await RioTheatre.scrape(page, null);

        console.log(`\n✅ Scrape Complete! Found ${events.length} events.\n`);

        console.log('📅 Sample Events (first 10):');
        events.slice(0, 10).forEach((e, i) => {
            console.log(`   ${i + 1}. ${e.title}`);
            console.log(`      Date: ${e.dateRaw}`);
            console.log(`      Doors: ${e.doorsRaw || 'N/A'}`);
            console.log(`      Price: ${e.priceRaw || 'N/A'}`);
            console.log(`      URL: ${e.url}`);
            console.log('');
        });

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        if (browser) await browser.close();
    }
}

run();
