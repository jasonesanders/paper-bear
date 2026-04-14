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
    'EEEE, MMMM d, yyyy',          // "Sunday, February 8, 2026"
    'EEEE MMMM d, yyyy',           // "Sunday February 8, 2026"
    'MMMM yyyy d h:mm a',          // "February 2026 1 7:00 PM" (fallback format)
    'yyyy-MM-dd HH:mm',            // "2024-01-12 19:30"
    'yyyy-MM-dd',                  // "2024-01-12"

    // Without year
    'EEEE, MMMM d h:mm a',         // "Friday, January 12 7:30 PM"
    'EEEE MMMM d h:mm a',          // "Sunday January 4 12:30 pm"
    'EEE, MMM d h:mm a',           // "Thu, Feb 27 7:00 PM"
    'EEE MMM d h:mm a',            // "Thu Feb 27 7:00 PM"
    'MMMM d h:mm a',               // "January 12 7:30 PM"
    'MMM d h:mm a',                // "Jan 12 7:30 PM"
    'EEEE, MMMM d',                // "Friday, January 12"
    'EEE, MMM d',                  // "Thu, Feb 27"
    'EEE MMM d',                   // "Thu Feb 27"
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
        .replace(/[\u00a0\u202f]/g, ' ') // explicitly replace non-breaking spaces
        .replace(/\s+/g, ' ')           // collapse whitespace
        .replace(/,\s*/g, ', ')         // normalize comma spacing
        .replace(/(\d+)(st|nd|rd|th)/gi, '$1') // remove ordinal suffixes: 23rd -> 23
        .replace(/\./g, '')                    // remove dots: "p.m." -> "pm"
        .replace(/(\d)(am|pm)/gi, '$1 $2') // "7pm" -> "7 pm"
        .replace(/doors?\s*(?:@|at|:)?\s*/gi, '') // remove "Doors @/at/:" prefix
        .replace(/show\s*(?:@|at|:)?\s*/gi, '')   // remove "Show @/at/:" prefix
        .trim();

    // Specific fix for Rio Theatre: "9:00pm - Tuesday, Feb 10, 2026"
    // Regex matches: (Time)(separator)(Date) -> (Date) (Time)
    const timeFirstMatch = normalized.match(/^(\d{1,2}:\d{2}\s*(?:am|pm)?)\s*[-\u2013\u2014]\s*(.*)$/i);
    if (timeFirstMatch) {
        // "Tuesday, Feb 10, 2026 9:00pm"
        return parseVancouverDate(`${timeFirstMatch[2]} ${timeFirstMatch[1]}`, referenceDate);
    }

    // Fast-path: ISO 8601 strings (e.g. "2026-03-01T02:30:00+00:00" from the Rio API).
    // new Date() handles these correctly — no format-trial needed.
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw.trim())) {
        const isoDate = new Date(raw.trim());
        return isValid(isoDate) ? isoDate : null;
    }

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
 * Strategy: Try current year, next year, and previous year, then pick the one 
 * closest to the reference date. This handles January shows scraped in December 
 * AND December shows scraped in January (due to calendar trailing days).
 */
function inferYear(date: Date, referenceDate: Date): Date {
    const refYear = referenceDate.getFullYear();
    const candidateYears = [refYear, refYear + 1, refYear - 1];

    let bestDate = setYear(date, refYear);
    let minDiff = Math.abs(bestDate.getTime() - referenceDate.getTime());

    for (const year of candidateYears) {
        const candidate = setYear(date, year);
        const diff = Math.abs(candidate.getTime() - referenceDate.getTime());
        if (diff < minDiff) {
            minDiff = diff;
            bestDate = candidate;
        }
    }

    return bestDate;
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
export function extractDoorsAndShow(raw: string, referenceDate: Date = new Date()): {
    doors: Date | null;
    show: Date | null;
} {
    // Permissive regex for times: 7, 7pm, 7:00, 7:00 PM, 19:00 etc.
    const timeRegex = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;

    const doorsMatch = raw.match(new RegExp(`doors?\\s*(?:@|at|:)?\\s*${timeRegex.source}`, 'i'));
    const showMatch = raw.match(new RegExp(`(?:show|music|start|performance)\\s*(?:@|at|:)?\\s*${timeRegex.source}`, 'i'));

    return {
        doors: doorsMatch ? parseVancouverDate(doorsMatch[1], referenceDate) : null,
        show: showMatch ? parseVancouverDate(showMatch[1], referenceDate) : null,
    };
}
