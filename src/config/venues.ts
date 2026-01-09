/**
 * Venue Registry - Central configuration for all venue scrapers.
 * To add a venue: import its module and add to the `venues` array.
 * To disable a venue: set `enabled: false` in its module.
 */

import type { VenueScraper } from '../lib/utils/scraper-core';

// Import venue scrapers
import { RickshawTheatre } from '../lib/venues/rickshaw';
import { RioTheatre } from '../lib/venues/rio';
// import { ParkTheatre } from '../lib/venues/park';
// import { HerosWelcome } from '../lib/venues/heros-welcome';
// import { FoxCabaret } from '../lib/venues/fox-cabaret';

/**
 * All registered venue scrapers.
 * The orchestrator will iterate through this list.
 */
export const venues: VenueScraper[] = [
    RickshawTheatre,
    RioTheatre,
    // ParkTheatre,
    // HerosWelcome,
    // FoxCabaret,
];

/**
 * Get only enabled venues.
 */
export function getEnabledVenues(): VenueScraper[] {
    return venues.filter((v) => v.enabled);
}

/**
 * Get a venue by its ID (slug).
 */
export function getVenueById(id: string): VenueScraper | undefined {
    return venues.find((v) => v.id === id);
}
