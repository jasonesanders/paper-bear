import { chromium } from 'playwright';
import type { Browser, Page, BrowserContext } from 'playwright';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';

/**
 * Configuration for the EthicalScraper.
 */
export interface ScraperConfig {
    userAgent: string;
    delayMs: number;
    maxRetries: number;
    timeout: number;
}

/**
 * Raw event data as scraped from a venue (before normalization).
 */
export interface RawEvent {
    title: string;
    dateRaw: string;
    url?: string;
    priceRaw?: string;
    doorsRaw?: string;
}

/**
 * The interface every venue scraper must implement.
 */
export interface VenueScraper {
    id: string;              // slug: 'rickshaw-theatre'
    name: string;            // display: 'Rickshaw Theatre'
    url: string;             // calendar URL
    enabled: boolean;

    /**
     * Scrape events from the venue.
     * @param page - Playwright page (for dynamic sites) or null (for static sites)
     * @param html - Raw HTML (for static sites using Cheerio)
     * @returns Array of raw events
     */
    scrape(page: Page | null, html: string | null): Promise<RawEvent[]>;
}

/**
 * Result of a scrape operation.
 */
export interface ScrapeResult {
    venueId: string;
    status: 'success' | 'error' | 'skipped';
    events: RawEvent[];
    errorMessage?: string;
    durationMs: number;
}

/**
 * Default configuration loaded from environment.
 */
const DEFAULT_CONFIG: ScraperConfig = {
    userAgent: process.env.SCRAPER_USER_AGENT ||
        'PaperBear/1.0 (Vancouver Community Events Bot; contact@paperbear.dev)',
    delayMs: parseInt(process.env.SCRAPER_DELAY_MS || '1500', 10),
    maxRetries: 3,
    timeout: 30000,
};

/**
 * EthicalScraper - Core scraping infrastructure with built-in protections.
 * 
 * Features:
 * - Rate limiting (configurable delay between requests)
 * - Custom User-Agent identification
 * - Exponential backoff on failure
 * - Graceful error handling
 */
export class EthicalScraper {
    private config: ScraperConfig;
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private lastRequestTime = 0;

    constructor(config: Partial<ScraperConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Initialize the browser (call once before scraping).
     */
    async init(): Promise<void> {
        this.browser = await chromium.launch({
            headless: true,
        });
        this.context = await this.browser.newContext({
            userAgent: this.config.userAgent,
        });
    }

    /**
     * Clean up browser resources.
     */
    async close(): Promise<void> {
        if (this.context) await this.context.close();
        if (this.browser) await this.browser.close();
        this.browser = null;
        this.context = null;
    }

    /**
     * Enforce rate limiting between requests.
     */
    private async rateLimit(): Promise<void> {
        const now = Date.now();
        const elapsed = now - this.lastRequestTime;
        const remaining = this.config.delayMs - elapsed;

        if (remaining > 0) {
            await new Promise((resolve) => setTimeout(resolve, remaining));
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * Fetch a page with Playwright (for JavaScript-rendered sites).
     */
    async fetchDynamic(url: string): Promise<{ page: Page; html: string }> {
        if (!this.context) {
            throw new Error('EthicalScraper not initialized. Call init() first.');
        }

        await this.rateLimit();

        const page = await this.context.newPage();
        await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: this.config.timeout,
        });

        const html = await page.content();
        return { page, html };
    }

    /**
     * Fetch a page with simple HTTP (for static sites, faster).
     */
    async fetchStatic(url: string): Promise<string> {
        await this.rateLimit();

        const response = await fetch(url, {
            headers: {
                'User-Agent': this.config.userAgent,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.text();
    }

    /**
     * Run a venue scraper with error handling and retry logic.
     */
    async runScraper(venue: VenueScraper): Promise<ScrapeResult> {
        const startTime = Date.now();

        if (!venue.enabled) {
            return {
                venueId: venue.id,
                status: 'skipped',
                events: [],
                durationMs: Date.now() - startTime,
            };
        }

        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                console.log(`[${venue.name}] Scraping attempt ${attempt}/${this.config.maxRetries}...`);

                // Fetch the page
                const { page, html } = await this.fetchDynamic(venue.url);

                try {
                    // Run the venue-specific scraper
                    const events = await venue.scrape(page, html);

                    console.log(`[${venue.name}] Found ${events.length} events`);

                    return {
                        venueId: venue.id,
                        status: 'success',
                        events,
                        durationMs: Date.now() - startTime,
                    };
                } finally {
                    await page.close();
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.error(`[${venue.name}] Attempt ${attempt} failed:`, lastError.message);

                // Exponential backoff
                if (attempt < this.config.maxRetries) {
                    const backoffMs = this.config.delayMs * Math.pow(2, attempt - 1);
                    console.log(`[${venue.name}] Retrying in ${backoffMs}ms...`);
                    await new Promise((resolve) => setTimeout(resolve, backoffMs));
                }
            }
        }

        return {
            venueId: venue.id,
            status: 'error',
            events: [],
            errorMessage: lastError?.message || 'Unknown error',
            durationMs: Date.now() - startTime,
        };
    }
}

/**
 * Generate a deduplication hash for an event.
 * Uses MD5 of venueId + date + title (normalized).
 */
export function generateEventHash(
    venueId: string,
    date: Date,
    title: string
): string {
    const normalizedTitle = title.toLowerCase().trim().replace(/\s+/g, ' ');
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const input = `${venueId}|${dateStr}|${normalizedTitle}`;
    return createHash('md5').update(input).digest('hex');
}

/**
 * Create a Cheerio instance from HTML for static scraping.
 */
export function parseHTML(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
}
