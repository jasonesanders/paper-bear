
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

async function debugRickshaw() {
    console.log('🐞 Debugging Rickshaw (Analyzing Dumped HTML)...');

    try {
        const filePath = path.resolve('rickshaw_full.html');
        const html = fs.readFileSync(filePath, 'utf-8');
        const $ = cheerio.load(html);

        // Log all unique classes on 'article' tags to find the pattern
        const articleClasses = new Set();
        $('article').each((i, el) => {
            const cls = $(el).attr('class');
            if (cls) articleClasses.add(cls);
        });
        console.log("Article Classes found:", Array.from(articleClasses));

        // Let's assume common Squarespace/Events Calendar patterns
        const events = $('article');

        events.each((i, el) => {
            if (i >= 5) return;

            // Extract EVERYTHING that might be a date
            const textContent = $(el).text().replace(/\s+/g, ' ').trim();
            const timeTag = $(el).find('time').attr('datetime');

            console.log(`\n--- Event ${i + 1} ---`);
            console.log(`   [Class]: "${$(el).attr('class')}"`);
            console.log(`   [Time Tag]: "${timeTag}"`);
            console.log(`   [Text Snippet]: "${textContent.substring(0, 150)}..."`);
        });

    } catch (e) {
        console.error("Analysis failed:", e);
    }
}

debugRickshaw();
