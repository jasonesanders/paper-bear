import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Paper Bear responsive layout testing.
 * Defines three projects for mobile, tablet, and desktop viewports.
 */
export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',

    use: {
        baseURL: 'http://localhost:4321',
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: 'mobile',
            use: {
                ...devices['iPhone SE'],
                viewport: { width: 375, height: 667 },
            },
        },
        {
            name: 'tablet',
            use: {
                viewport: { width: 640, height: 800 },
            },
        },
        {
            name: 'desktop',
            use: {
                viewport: { width: 1280, height: 720 },
            },
        },
    ],

    /* Run dev server before starting tests */
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:4321',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});
