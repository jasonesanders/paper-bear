export const prerender = false;

import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getWeekEvents } from '../../lib/events';

export const GET: APIRoute = async ({ url, site }) => {
    const venue = url.searchParams.get('venue') || '';
    const genre = url.searchParams.get('genre') || '';

    const today = new Date();
    const weekData = await getWeekEvents(today, { venue, genre });

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
        title: 'Paper Bear Events',
        description: 'Upcoming events in Vancouver',
        site: site?.toString() || 'https://paperbear.dev',
        items: allEvents,
        customData: `<language>en-us</language>`,
    });
};
