export const prerender = true;

import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getWeekEvents } from '../../lib/events';

export const GET: APIRoute = async ({ site }) => {
    const today = new Date();
    const weekData = await getWeekEvents(today);

    // Flatten events from all days
    const allEvents = weekData.flatMap(day => {
        return day.events.map(event => ({
            title: `${event.venue.toUpperCase()}: ${event.title}`,
            pubDate: day.date,
            description: event.timeStr,
            link: event.url || site?.toString() || '',
        }));
    });

    // Sort by date then title
    allEvents.sort((a, b) => a.pubDate.getTime() - b.pubDate.getTime());

    return rss({
        title: 'The Week Ahead Events',
        description: 'Upcoming events in Vancouver',
        site: site?.toString() || 'https://theweekahead.ca',
        items: allEvents,
        customData: `<language>en-us</language>`,
    });
};
