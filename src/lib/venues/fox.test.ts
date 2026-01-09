import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FoxCabaret } from './fox';
import type { Page } from 'playwright';

// Mock Playwright Page
const mockPage = {
    waitForSelector: vi.fn(),
    waitForTimeout: vi.fn(),
    evaluate: vi.fn(),
    goto: vi.fn(),
} as unknown as Page;

describe('FoxCabaret Scraper', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should deduplicate events that appear twice (list items and flyouts)', async () => {
        // Mock 1: Month/Year header
        const mockMonthYear = 'January 2026';

        // Mock 2: Calendar scraping (simulating duplicates)
        // Squarespace often has duplicate nodes for the same event in the DOM
        const mockCalendarEvents = [
            { title: 'Duplicate Event', time: '8:00 PM', dayNum: '10', href: '/event-1' },
            { title: 'Duplicate Event', time: '8:00 PM', dayNum: '10', href: '/event-1' }, // Duplicate!
            { title: 'Unique Event', time: '9:00 PM', dayNum: '11', href: '/event-2' }
        ];

        // Mock 3: Detail page scraping
        const mockDetails = {
            dateRaw: 'January 10, 2026 8:00 PM',
            priceRaw: '$15',
            doorsRaw: '7:00 PM'
        };

        (mockPage.evaluate as any)
            .mockResolvedValueOnce(mockMonthYear)      // 1. Header
            .mockResolvedValueOnce(mockCalendarEvents) // 2. Calendar grid
            .mockResolvedValue(mockDetails);           // 3. Detail pages (repeated)

        const events = await FoxCabaret.scrape(mockPage);

        // Expectation: Duplicates should be removed
        expect(events).toHaveLength(2); // Should be 2, currently will be 3 (FAIL)
        expect(events.map(e => e.title)).toEqual(['Duplicate Event', 'Unique Event']);
    });
});
