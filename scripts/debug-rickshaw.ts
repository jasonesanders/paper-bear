
import * as cheerio from 'cheerio';
import { parseVancouverDate } from '../src/lib/utils/date-parser';

async function debugRickshaw() {
    console.log('🐞 Debugging Rickshaw Theatre Time Parsing...');

    // 1. Fetch raw HTML
    const url = 'https://rickshawtheatre.com/events/';
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // 2. Select events
    const events = $('.tribe-events-calendar-list__event-row');
    console.log(`Found ${events.length} events in HTML`);

    events.each((i, el) => {
        const title = $(el).find('.tribe-events-calendar-list__event-title').text().trim();
        const dateRaw = $(el).find('.tribe-event-date-start').text().trim();
        const timeRaw = $(el).find('.tribe-event-time').text().trim(); // Rickshaw specific?

        // 3. Log extraction attempts
        console.log(`\n--- Event ${i + 1}: ${title} ---`);
        console.log(`   raw date text: "${dateRaw}"`);
        console.log(`   raw time text: "${timeRaw}"`);

        // 4. Test current parser
        const parsed = parseVancouverDate(dateRaw);
        console.log(`   parsed date:   ${parsed?.toLocaleString('en-US', { timeZone: 'America/Vancouver' })}`);

        // 5. Look for other time signals in description
        const desc = $(el).find('.tribe-events-calendar-list__event-description').text();
        const doorsMatch = desc.match(/doors\s*:?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
        if (doorsMatch) {
            console.log(`   found doors in desc: "${doorsMatch[0]}" -> "${doorsMatch[1]}"`);
        }
    });
}

debugRickshaw();
