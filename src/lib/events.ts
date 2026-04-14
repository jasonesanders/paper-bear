import { db, Event, Venue, eq, and, gte, lt, asc } from 'astro:db';
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';

const VANCOUVER_TZ = 'America/Vancouver';

export interface UIEvent {
    title: string;
    date: Date;
    venue: string;
    venueId: string;
    url: string | null;
    eventType: string;
    timeStr: string;
}

export interface DayData {
    date: Date;
    events: UIEvent[];
}

export interface FilterOptions {
    venue?: string;
    genre?: string;
}

export async function getWeekEvents(startDate: Date, filters: FilterOptions = {}): Promise<DayData[]> {
    // Ensure start date is set to beginning of day in Vancouver time
    const vancouverNow = toZonedTime(startDate, VANCOUVER_TZ);
    vancouverNow.setHours(0, 0, 0, 0);
    const start = fromZonedTime(vancouverNow, VANCOUVER_TZ);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    // Build conditions array
    const conditions = [
        gte(Event.date, start),
        lt(Event.date, end)
    ];

    // Add venue filter if specified
    if (filters.venue) {
        conditions.push(eq(Event.venueId, filters.venue));
    }

    // Add genre filter (eventType) if specified
    if (filters.genre) {
        conditions.push(eq(Event.eventType, filters.genre));
    }

    const rawEvents = await db.select({
        title: Event.title,
        date: Event.date,
        venue: Venue.name,
        venueId: Event.venueId,
        url: Event.url,
        eventType: Event.eventType,
    })
        .from(Event)
        .innerJoin(Venue, eq(Event.venueId, Venue.id))
        .where(and(...conditions))
        .orderBy(asc(Event.date));

    // Group by day
    const days: DayData[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        // We store the date as a "Vancouver wall-clock" date for grouping
        days.push({ date: toZonedTime(d, VANCOUVER_TZ), events: [] });
    }

    for (const event of rawEvents) {
        // Convert to Vancouver time for correct day matching
        const eventDate = new Date(event.date);
        const vancouverDate = toZonedTime(eventDate, VANCOUVER_TZ);
        const day = days.find(d => isSameDay(d.date, vancouverDate));

        if (day) {
            day.events.push({
                ...event,
                timeStr: formatTime(eventDate)
            });
        }
    }

    return days;
}

function isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

function formatTime(d: Date): string {
    // Convert to Vancouver time and format
    const vancouverTime = toZonedTime(d, VANCOUVER_TZ);
    return format(vancouverTime, 'h:mm a').toLowerCase();
}
