import { defineDb, defineTable, column } from 'astro:db';

/**
 * Venue - The physical location where events take place.
 * Each venue has its own scraper module.
 */
export const Venue = defineTable({
  columns: {
    id: column.text({ primaryKey: true }), // slug: 'rickshaw-theatre'
    name: column.text(),                    // display name: 'Rickshaw Theatre'
    url: column.text(),                     // calendar URL we scrape
    enabled: column.boolean({ default: true }),
    createdAt: column.date({ default: new Date() }),
  },
});

/**
 * Event Types - Normalized categories for filtering.
 */
export type EventType = 'music' | 'comedy' | 'theatre' | 'screening' | 'other';

/**
 * Event - A single event scraped from a venue.
 * The 'hash' column is used for deduplication (MD5 of venueId + date + title).
 */
export const Event = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),  // UUID
    venueId: column.text({ references: () => Venue.columns.id }),
    title: column.text(),
    date: column.date(),                     // event start date/time
    doorsTime: column.date({ optional: true }), // doors open time (nullable)
    url: column.text({ optional: true }),    // event detail page
    price: column.number({ optional: true }), // price in cents (null = unknown)
    isFree: column.boolean({ default: false }),
    eventType: column.text({ default: 'other' }), // EventType enum stored as text
    hash: column.text({ unique: true }),     // deduplication hash
    createdAt: column.date({ default: new Date() }),
    updatedAt: column.date({ default: new Date() }),
  },
});

/**
 * ScrapeLog - Audit trail for scraper runs.
 * Used for the health check dashboard.
 */
export const ScrapeLog = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),  // UUID
    venueId: column.text({ references: () => Venue.columns.id }),
    timestamp: column.date(),
    status: column.text(),                   // 'success' | 'error' | 'skipped'
    itemsFound: column.number({ default: 0 }),
    errorMessage: column.text({ optional: true }),
    durationMs: column.number({ optional: true }),
  },
});

// https://astro.build/db/config
export default defineDb({
  tables: { Venue, Event, ScrapeLog },
});
