import {
    parse,
    format,
    addYears,
    isBefore,
    setYear,
    isValid,
} from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';

const VANCOUVER_TZ = 'America/Vancouver';

/**
 * Common date formats found on Vancouver venue websites.
 * Ordered from most specific to least specific.
 */
const DATE_FORMATS = [
    // Full formats with year
    'EEEE, MMMM d, yyyy h:mm a',  // "Friday, January 12, 2024 7:30 PM"
    'MMMM d, yyyy h:mm a',         // "January 12, 2024 7:30 PM"
    'MMM d, yyyy h:mm a',          // "Jan 12, 2024 7:30 PM"
    'MMMM d, yyyy',                // "January 12, 2024" (no time)
    'MMM d, yyyy',                 // "Jan 12, 2024" (no time)
    'yyyy-MM-dd HH:mm',            // "2024-01-12 19:30"
    'yyyy-MM-dd',                  // "2024-01-12"

    // Without year
    'EEEE, MMMM d h:mm a',         // "Friday, January 12 7:30 PM"
    'EEEE MMMM d h:mm a',          // "Sunday January 4 12:30 pm"
    'MMMM d h:mm a',               // "January 12 7:30 PM"
    'MMM d h:mm a',                // "Jan 12 7:30 PM"
    'EEEE, MMMM d',                // "Friday, January 12"
    'MMMM d',                      // "January 12"
    'MMM d',                       // "Jan 12"

    // Time only
    'h:mm a',                      // "7:30 PM"
    'h a',                         // "7 PM" (normalized from 7pm)
    'ha',                          // "7PM"
];

/**
 * Parse a raw date string from a Vancouver venue into a proper Date object.
 * Handles timezone conversion and year inference for dates without years.
 * 
 * @param raw - The raw date string scraped from the venue
 * @param referenceDate - Optional reference date for year inference (defaults to now)
 * @returns A Date object in Vancouver timezone, or null if parsing fails
 */
export function parseVancouverDate(
    raw: string,
    referenceDate: Date = new Date()
): Date | null {
    if (!raw || typeof raw !== 'string') {
        return null;
    }

    // Normalize the input
    const normalized = raw
        .trim()
        .replace(/\s+/g, ' ')           // collapse whitespace
        .replace(/,\s*/g, ', ')         // normalize comma spacing
        .replace(/(\d+)(st|nd|rd|th)/gi, '$1') // remove ordinal suffixes: 23rd -> 23
        .replace(/\./g, '')                    // remove dots: "p.m." -> "pm"
        .replace(/(\d)(am|pm)/gi, '$1 $2') // "7pm" -> "7 pm"
        .replace(/doors?\s*(?:@|at|:)?\s*/gi, '') // remove "Doors @/at/:" prefix
        .replace(/show\s*(?:@|at|:)?\s*/gi, '')   // remove "Show @/at/:" prefix
        .trim();

    let parsed: Date | null = null;
    let usedFormatWithYear = false;

    // Try each format until one works
    for (const fmt of DATE_FORMATS) {
        try {
            const result = parse(normalized, fmt, referenceDate);
            if (isValid(result)) {
                parsed = result;
                usedFormatWithYear = fmt.includes('yyyy');
                break;
            }
        } catch {
            // Continue to next format
        }
    }

    if (!parsed) {
        // console.warn(`[parseVancouverDate] Failed to parse: "${raw}" normalized to "${normalized}"`);
        return null;
    }

    // Year inference: if format didn't include year, infer from context
    if (!usedFormatWithYear) {
        parsed = inferYear(parsed, referenceDate);
    }

    // Interpret the parsed local time as being in Vancouver timezone
    return fromZonedTime(parsed, VANCOUVER_TZ);
}

/**
 * Infer the correct year for a date that was parsed without a year.
 * If the date is in the past (relative to reference), assume next year.
 * 
 * Example: Parsing "Jan 5" on Dec 20, 2025 returns Jan 5, 2026.
 */
function inferYear(date: Date, referenceDate: Date): Date {
    // Start with the reference year
    let result = setYear(date, referenceDate.getFullYear());

    // If this date is more than 2 weeks in the past, assume next year
    const twoWeeksAgo = new Date(referenceDate);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    if (isBefore(result, twoWeeksAgo)) {
        result = addYears(result, 1);
    }

    return result;
}

/**
 * Format a date as an ISO 8601 string in Vancouver timezone.
 */
export function toVancouverISO(date: Date): string {
    return formatInTimeZone(date, VANCOUVER_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * Format a date for display (human-readable, Vancouver timezone).
 */
export function formatForDisplay(date: Date): string {
    return formatInTimeZone(date, VANCOUVER_TZ, 'EEE, MMM d @ h:mm a');
}

/**
 * Extract doors time from strings like "Doors 7pm, Show 8pm".
 * Returns both times if found.
 */
export function extractDoorsAndShow(raw: string): {
    doors: Date | null;
    show: Date | null;
} {
    const doorsMatch = raw.match(/doors?\s*(?:@|at|:)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    const showMatch = raw.match(/(?:show|music|start)\s*(?:@|at|:)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);

    return {
        doors: doorsMatch ? parseVancouverDate(doorsMatch[1]) : null,
        show: showMatch ? parseVancouverDate(showMatch[1]) : null,
    };
}
