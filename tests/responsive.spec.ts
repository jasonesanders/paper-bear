import { test, expect } from '@playwright/test';

/**
 * Responsive Layout Tests for Paper Bear
 * 
 * Following TDD: These tests are written FIRST to fail, 
 * then we implement responsive changes to make them pass.
 */

test.describe('Responsive Layout', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test.describe('Mobile (375px)', () => {

        test('day columns should scroll horizontally', async ({ page }) => {
            const main = page.locator('main');

            // Main container should allow horizontal scroll
            const overflowX = await main.evaluate(el =>
                window.getComputedStyle(el).overflowX
            );
            expect(overflowX).toBe('auto');

            // Should have horizontal scrollbar (content wider than viewport)
            const scrollWidth = await main.evaluate(el => el.scrollWidth);
            const clientWidth = await main.evaluate(el => el.clientWidth);
            expect(scrollWidth).toBeGreaterThan(clientWidth);
        });

        test('day column should be ~88% viewport width', async ({ page }) => {
            const dayColumn = page.locator('section').first();
            const columnWidth = await dayColumn.evaluate(el => el.getBoundingClientRect().width);
            const viewportWidth = 375;

            // Column should be approximately 88% of viewport (allowing 5% tolerance)
            const expectedWidth = viewportWidth * 0.88;
            expect(columnWidth).toBeGreaterThan(expectedWidth - viewportWidth * 0.05);
            expect(columnWidth).toBeLessThan(expectedWidth + viewportWidth * 0.05);
        });

        test('event cards should have compact padding', async ({ page }) => {
            const eventCard = page.locator('main a').first();

            // Skip if no events displayed
            const count = await eventCard.count();
            if (count === 0) {
                test.skip();
                return;
            }

            const padding = await eventCard.evaluate(el =>
                window.getComputedStyle(el).padding
            );

            // Compact padding should be ~10px (2.5 * 4px = 10px from p-2.5)
            // Parse padding value (e.g., "10px" or "10px 10px 10px 10px")
            const paddingValue = parseFloat(padding);
            expect(paddingValue).toBeLessThanOrEqual(12); // Compact for mobile
        });
    });

    test.describe('Tablet (640px)', () => {

        test('should show at least 2 day columns without scrolling', async ({ page }) => {
            const dayColumns = page.locator('section');
            const columnCount = await dayColumns.count();

            // Should have 7 day columns
            expect(columnCount).toBe(7);

            // First two columns should be fully visible
            const firstColumn = dayColumns.first();
            const secondColumn = dayColumns.nth(1);

            const firstRect = await firstColumn.evaluate(el => el.getBoundingClientRect());
            const secondRect = await secondColumn.evaluate(el => el.getBoundingClientRect());

            // Both columns should be within viewport (640px width)
            expect(firstRect.right).toBeLessThanOrEqual(640);
            expect(secondRect.left).toBeGreaterThanOrEqual(0);
            expect(secondRect.right).toBeLessThanOrEqual(640 + 50); // Small tolerance for partial visibility
        });

        test('header filter dropdowns should be visible', async ({ page }) => {
            const filterForm = page.locator('header form');

            // Filter form should be visible on tablet
            await expect(filterForm).toBeVisible();

            // Venue select should be visible
            const venueSelect = filterForm.locator('select[name="venue"]');
            await expect(venueSelect).toBeVisible();
        });
    });

    test.describe('Desktop (1280px)', () => {

        test('all 7 day columns should be visible without scroll', async ({ page }) => {
            const main = page.locator('main');

            // Should not have horizontal scroll (content fits)
            const scrollWidth = await main.evaluate(el => el.scrollWidth);
            const clientWidth = await main.evaluate(el => el.clientWidth);
            expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px tolerance for borders
        });

        test('all day columns should be equal width (flex-1)', async ({ page }) => {
            const dayColumns = page.locator('section');
            const count = await dayColumns.count();

            expect(count).toBe(7);

            const widths: number[] = [];
            for (let i = 0; i < count; i++) {
                const width = await dayColumns.nth(i).evaluate(el =>
                    el.getBoundingClientRect().width
                );
                widths.push(width);
            }

            // All widths should be approximately equal (within 2px)
            const avgWidth = widths.reduce((a, b) => a + b, 0) / widths.length;
            for (const width of widths) {
                expect(Math.abs(width - avgWidth)).toBeLessThan(3);
            }
        });

        test('header should show all elements including Add a Venue', async ({ page }) => {
            const addVenueLink = page.locator('header a:has-text("Add a Venue")');
            await expect(addVenueLink).toBeVisible();
        });
    });
});
