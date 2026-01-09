import { describe, it, expect } from 'vitest';
import { parseVancouverDate, extractDoorsAndShow } from './date-parser';
import { format } from 'date-fns';

describe('parseVancouverDate', () => {
    // Helper to verify date is correct in Vancouver time (without worrying about local timezone of runner)
    const verifyDate = (date: Date | null, expectedISO: string) => {
        expect(date).not.toBeNull();
        // Check standard ISO string matches YYYY-MM-DD
        const iso = date!.toISOString();
        expect(iso).toContain(expectedISO);
    };

    it('parses full format: "Friday, January 12, 2024 7:30 PM"', () => {
        const date = parseVancouverDate('Friday, January 12, 2024 7:30 PM');
        // 7:30 PM PST is 03:30 UTC next day
        // 2024-01-12 19:30 PST = 2024-01-13 03:30 UTC
        expect(date?.toISOString()).toBe('2024-01-13T03:30:00.000Z');
    });

    it('parses format without day name: "January 12, 2024 7:30 PM"', () => {
        const date = parseVancouverDate('January 12, 2024 7:30 PM');
        expect(date?.toISOString()).toBe('2024-01-13T03:30:00.000Z');
    });

    it('parses Rio style: "Sunday January 4 12:30 pm" (infer year)', () => {
        const refDate = new Date('2024-01-01T00:00:00Z'); // Reference: Jan 1 2024
        // Jan 4 should be 2024
        const date = parseVancouverDate('Sunday January 4 12:30 pm', refDate);
        // 12:30 PM PST = 20:30 UTC
        expect(date?.toISOString()).toBe('2024-01-04T20:30:00.000Z');
    });

    it('infers next year for past dates', () => {
        const refDate = new Date('2023-12-25T00:00:00Z'); // Dec 25 2023
        // "Jan 4" is clearly next year (2024)
        const date = parseVancouverDate('Jan 4 8:00 PM', refDate);
        expect(date?.getFullYear()).toBe(2024);
    });

    it('normalizes "doors @ 7pm"', () => {
        const refDate = new Date('2024-01-01T00:00:00Z');
        const date = parseVancouverDate('Doors @ 7pm', refDate);
        // 7pm PST = 03:00 UTC next day (Jan 2)
        expect(date?.toISOString()).toBe('2024-01-02T03:00:00.000Z');
    });
});

describe('extractDoorsAndShow', () => {
    it('extracts doors and show times from string', () => {
        const text = "Doors 7:00pm Show 8:00pm";
        const { doors, show } = extractDoorsAndShow(text);

        expect(doors).not.toBeNull();
        expect(show).not.toBeNull();

        // 7pm PST = 03:00 UTC
        expect(doors?.getUTCHours()).toBe(3);
        // 8pm PST = 04:00 UTC
        expect(show?.getUTCHours()).toBe(4);
    });

    it('handles "Doors at 7pm"', () => {
        const { doors } = extractDoorsAndShow("Doors at 7pm");
        expect(doors?.getUTCHours()).toBe(3);
    });
});
