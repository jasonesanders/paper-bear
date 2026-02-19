
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import fs from 'fs';

async function debugRio() {
    console.log('🐞 Debugging Rio Theatre...');

    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        const url = 'https://riotheatretickets.ca/';
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        try {
            await page.waitForSelector('div.single-event', { timeout: 10000 });
            console.log('✅ Found div.single-event');
        } catch (e) {
            console.log('⚠️  Timed out waiting for div.single-event');
        }

        const html = await page.content();
        fs.writeFileSync('rio_full.html', html);
        console.log(`✅ HTML dumped to rio_full.html (${html.length} bytes)`);

        const $ = cheerio.load(html);
        const events = $('div.single-event');
        console.log(`Found ${events.length} events with div.single-event`);

        // Check for ANY event-like structure if main selector fails
        if (events.length === 0) {
            const audit = $('body').text().substring(0, 500);
            console.log("Body snippet:", audit);
        }

        events.each((i, el) => {
            if (i >= 3) return;

            const title = $(el).find('p.event-headline').text().trim();
            const date = $(el).find('p.event-date').text().trim();

            console.log(`\n--- Event ${i + 1}: ${title} ---`);
            console.log(`   [Date]: "${date}"`);
        });

    } catch (e) {
        console.error("Playwright failed:", e);
    } finally {
        if (browser) await browser.close();
    }
}

debugRio();
