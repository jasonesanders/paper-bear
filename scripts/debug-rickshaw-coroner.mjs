
import { chromium } from 'playwright';
import path from 'path';

async function debugRickshawSpecific() {
    console.log('🕵️‍♀️ Debugging Rickshaw "Coroner" Event (with Scroll)...');

    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        console.log('Navigating to main events page...');
        await page.goto('https://rickshawtheatre.com/events/', { waitUntil: 'domcontentloaded' });

        // Auto-scroll logic
        console.log('Scrolling to find event...');
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 300;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight || totalHeight > 15000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        await page.waitForTimeout(2000);

        // Find Coroner link
        const coronerLink = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const coroner = links.find(a => a.textContent?.toLowerCase().includes('coroner'));
            return coroner ? coroner.href : null;
        });

        if (!coronerLink) {
            console.error('❌ Could not find "Coroner" event URL even after scrolling.');
            // Dump titles just to see what we DID find
            const titles = await page.evaluate(() => Array.from(document.querySelectorAll('h2, h3')).map(h => h.textContent));
            console.log('Found titles:', titles.slice(0, 10));
            return;
        }

        console.log(`Found Coroner URL: ${coronerLink}`);

        // Analyze specific event page
        console.log(`Navigating to ${coronerLink}...`);
        await page.goto(coronerLink, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);

        const details = await page.evaluate(() => {
            const descEl = document.querySelector('.show_description');

            // Text content of description
            const descText = descEl ? descEl.innerText : 'NO DESCRIPTION FOUND';

            // h4 specific content
            const h4s = descEl ? Array.from(descEl.querySelectorAll('h4')).map(h => h.textContent) : [];

            // Stream time (fallback)
            const streamTime = document.querySelector('#stream_time')?.textContent;

            return {
                descTextSubstring: descText.substring(0, 500),
                h4s,
                streamTime
            };
        });

        console.log('\n--- Extraction Analysis ---');
        console.log('1. Description Text (first 500 chars):');
        console.log(`"${details.descTextSubstring}"`);
        console.log('2. .show_description h4 contents:', details.h4s);
        console.log('3. #stream_time content:', `"${details.streamTime}"`);

        // Test regex
        const doorsRegex = /(?:doors?|show|start|music)\s*(?:@|at|:)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
        console.log('\n--- Regex Testing ---');
        console.log('Match on Description Text:', details.descTextSubstring.match(doorsRegex));

    } catch (e) {
        console.error("Playwright failed:", e);
    } finally {
        if (browser) await browser.close();
    }
}

debugRickshawSpecific();
