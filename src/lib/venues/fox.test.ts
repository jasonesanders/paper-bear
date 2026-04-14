import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FoxCabaret } from './fox';
import type { Page } from 'playwright';

const mockPage = {
    waitForSelector: vi.fn(),
    $$eval: vi.fn(),
} as unknown as Page;

describe('FoxCabaret Scraper', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('returns events extracted from the list page', async () => {
        (mockPage.$$eval as any).mockResolvedValue([
            { title: 'Show One', dateRaw: 'January 10, 2026 8:00 PM', url: 'https://www.foxcabaret.com/show-one', doorsRaw: '7:00 PM', priceRaw: '$15' },
            { title: 'Show Two', dateRaw: 'January 11, 2026 9:00 PM', url: 'https://www.foxcabaret.com/show-two', doorsRaw: undefined, priceRaw: undefined },
        ]);

        const events = await FoxCabaret.scrape(mockPage);

        expect(events).toHaveLength(2);
        expect(events[0].title).toBe('Show One');
        expect(events[0].dateRaw).toBe('January 10, 2026 8:00 PM');
        expect(events[0].doorsRaw).toBe('7:00 PM');
        expect(events[1].title).toBe('Show Two');
    });

    it('filters out events without titles', async () => {
        (mockPage.$$eval as any).mockResolvedValue([
            { title: '', dateRaw: 'January 10, 2026', url: '', doorsRaw: undefined, priceRaw: undefined },
            { title: 'Real Show', dateRaw: 'January 11, 2026 8:00 PM', url: 'https://www.foxcabaret.com/real', doorsRaw: undefined, priceRaw: undefined },
        ]);

        const events = await FoxCabaret.scrape(mockPage);
        expect(events).toHaveLength(1);
        expect(events[0].title).toBe('Real Show');
    });
});
