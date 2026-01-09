import type { EventType } from '../../../db/config';

/**
 * Keyword-based event type classifier.
 * Uses simple heuristics to categorize events.
 * Can be upgraded to LLM-based classification later.
 */

const KEYWORDS: Record<EventType, string[]> = {
    music: [
        'concert', 'live music', 'band', 'dj', 'album', 'tour', 'singer',
        'jazz', 'rock', 'punk', 'metal', 'hip hop', 'rap', 'electronic',
        'folk', 'country', 'indie', 'funk', 'soul', 'r&b', 'reggae',
        'orchestra', 'symphony', 'acoustic', 'vinyl', 'record',
    ],
    comedy: [
        'comedy', 'stand-up', 'standup', 'comedian', 'improv', 'sketch',
        'laugh', 'funny', 'comic', 'open mic comedy', 'roast',
    ],
    theatre: [
        'theatre', 'theater', 'play', 'musical', 'drama', 'stage',
        'performance', 'act', 'production', 'playwright', 'ballet',
        'dance', 'opera', 'burlesque', 'cabaret', 'drag',
    ],
    screening: [
        'film', 'movie', 'screening', 'cinema', 'documentary', 'short',
        'premiere', 'watch party', 'matinee',
    ],
    other: [], // fallback, no keywords
};

/**
 * Classify an event based on its title.
 * Returns the most likely event type.
 */
export function classifyEventType(title: string): EventType {
    const normalized = title.toLowerCase();

    // Count keyword matches for each type
    const scores: Record<EventType, number> = {
        music: 0,
        comedy: 0,
        theatre: 0,
        screening: 0,
        other: 0,
    };

    for (const [type, keywords] of Object.entries(KEYWORDS) as [EventType, string[]][]) {
        for (const keyword of keywords) {
            if (normalized.includes(keyword)) {
                scores[type]++;
            }
        }
    }

    // Find the type with the highest score
    let bestType: EventType = 'other';
    let bestScore = 0;

    for (const [type, score] of Object.entries(scores) as [EventType, number][]) {
        if (score > bestScore) {
            bestScore = score;
            bestType = type;
        }
    }

    return bestType;
}

/**
 * Parse a price string into a structured format.
 * Returns price in cents, or null if unparseable.
 */
export function parsePrice(raw: string | undefined): {
    price: number | null;
    isFree: boolean;
} {
    if (!raw) {
        return { price: null, isFree: false };
    }

    const normalized = raw.toLowerCase().trim();

    // Check for free indicators
    if (
        normalized.includes('free') ||
        normalized === 'pwyc' ||
        normalized === 'pay what you can' ||
        normalized === '$0' ||
        normalized === '0'
    ) {
        return { price: 0, isFree: true };
    }

    // Try to extract a numeric price
    // Handles: "$15", "$15.00", "15", "$15-$25" (takes first)
    const priceMatch = normalized.match(/\$?(\d+(?:\.\d{2})?)/);
    if (priceMatch) {
        const dollars = parseFloat(priceMatch[1]);
        return { price: Math.round(dollars * 100), isFree: false };
    }

    return { price: null, isFree: false };
}
