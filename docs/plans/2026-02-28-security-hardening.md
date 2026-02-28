# Security Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 3 vulnerabilities identified in the [security review](file:///Users/jasonsanders/.gemini/antigravity/brain/414d635e-c164-41a4-a737-e6c78439903e/security-review.md) (1 Critical, 1 Medium, 1 Low).

**Architecture:** Token-gated scrape endpoint, URL sanitization utility applied at scrape-time and render-time, Astro middleware for security headers.

**Tech Stack:** Astro 5, TypeScript, Astro DB (libSQL/Turso), Playwright

---

## Task 1: Protect `/api/scrape` with Token Auth (VULN-001 — Critical)

**Files:**
- Modify: `src/pages/api/scrape.ts:1-15`
- Modify: `.env.example` (add `SCRAPE_SECRET`)

**Step 1: Add `SCRAPE_SECRET` to `.env.example`**

Append to `.env.example`:
```env
# Scrape Endpoint Auth
SCRAPE_SECRET=generate_a_random_secret_here
```

**Step 2: Run server to verify it starts cleanly**

```bash
npm run dev
```
Expected: Server starts with no errors.

**Step 3: Add token check to `scrape.ts`**

Replace the handler signature and add the guard at the top of the function body in `src/pages/api/scrape.ts`:

```typescript
export const GET: APIRoute = async ({ request }) => {
    // VULN-001 fix: Require auth token
    const token = request.headers.get('X-Scrape-Token');
    const secret = import.meta.env.SCRAPE_SECRET;

    if (!secret || token !== secret) {
        console.warn('🚫 Scrape attempt rejected: invalid or missing token');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    console.log('🐻 API Scraper Triggered (authenticated)');
    // ...rest of existing handler unchanged
```

**Step 4: Manually verify the guard works**

```bash
# Should return 401
curl -s http://localhost:4321/api/scrape | head -5

# Should return 200 (with your actual secret)
curl -s -H "X-Scrape-Token: YOUR_SECRET" http://localhost:4321/api/scrape | head -5
```
Expected: First returns `{"error":"Unauthorized"}`. Second starts scraping.

**Step 5: Commit**

```bash
git add src/pages/api/scrape.ts .env.example
git commit -m "security: protect /api/scrape with bearer token (VULN-001)"
```

---

## Task 2: Add URL Sanitization Utility (VULN-002 — Medium)

**Files:**
- Create: `src/lib/utils/sanitize-url.ts`
- Create: `src/lib/utils/sanitize-url.test.ts`
- Modify: `src/lib/venues/rio.ts:71`
- Modify: `src/lib/venues/fox.ts:79`
- Modify: `src/lib/venues/rickshaw.ts:62`
- Modify: `src/components/EventCard.astro:14-15`

### Step 1: Write the failing test

Create `src/lib/utils/sanitize-url.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeEventUrl } from './sanitize-url';

describe('sanitizeEventUrl', () => {
    it('accepts valid https URLs', () => {
        expect(sanitizeEventUrl('https://riotheatretickets.ca/event/123')).toBe('https://riotheatretickets.ca/event/123');
    });

    it('accepts valid http URLs (legacy venues)', () => {
        expect(sanitizeEventUrl('http://riotheatretickets.ca/event/123')).toBe('http://riotheatretickets.ca/event/123');
    });

    it('rejects javascript: scheme', () => {
        expect(sanitizeEventUrl('javascript:alert(1)')).toBeNull();
    });

    it('rejects data: scheme', () => {
        expect(sanitizeEventUrl('data:text/html,<h1>hi</h1>')).toBeNull();
    });

    it('rejects empty strings', () => {
        expect(sanitizeEventUrl('')).toBeNull();
    });

    it('handles null input', () => {
        expect(sanitizeEventUrl(null)).toBeNull();
    });

    it('handles undefined input', () => {
        expect(sanitizeEventUrl(undefined)).toBeNull();
    });

    it('rejects ftp: scheme', () => {
        expect(sanitizeEventUrl('ftp://example.com/file')).toBeNull();
    });

    it('rejects malformed URLs', () => {
        expect(sanitizeEventUrl('not a url at all')).toBeNull();
    });
});
```

### Step 2: Run test to verify it fails

```bash
npx vitest run src/lib/utils/sanitize-url.test.ts
```
Expected: FAIL — module not found.

### Step 3: Write minimal implementation

Create `src/lib/utils/sanitize-url.ts`:

```typescript
/**
 * Sanitize a URL to ensure it uses a safe scheme (http/https only).
 * Returns null for invalid, empty, or dangerous URLs.
 */
export function sanitizeEventUrl(url: string | null | undefined): string | null {
    if (!url || url.trim().length === 0) return null;

    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
            return url;
        }
        return null;
    } catch {
        return null;
    }
}
```

### Step 4: Run test to verify it passes

```bash
npx vitest run src/lib/utils/sanitize-url.test.ts
```
Expected: All 9 tests PASS.

### Step 5: Apply sanitization in venue scrapers

In `src/lib/venues/rio.ts`, replace line 71:
```typescript
// Before
url: href.startsWith('http') ? href : `https://riotheatretickets.ca${href}`,

// After
import { sanitizeEventUrl } from '../utils/sanitize-url';
// ...
url: sanitizeEventUrl(href.startsWith('http') ? href : `https://riotheatretickets.ca${href}`) || '',
```

In `src/lib/venues/fox.ts`, replace line 79:
```typescript
// Before
url: href.startsWith('http') ? href : `https://www.foxcabaret.com${href}`,

// After
import { sanitizeEventUrl } from '../utils/sanitize-url';
// ...
url: sanitizeEventUrl(href.startsWith('http') ? href : `https://www.foxcabaret.com${href}`) || '',
```

In `src/lib/venues/rickshaw.ts`, line 62 already reads `url` from `getAttribute('href')`. Add sanitization in the return at line 79:
```typescript
// Before
url,

// After
import { sanitizeEventUrl } from '../utils/sanitize-url';
// ...
url: sanitizeEventUrl(url) || '',
```

### Step 6: Add `rel="noopener noreferrer"` to EventCard

In `src/components/EventCard.astro`, update the `<a>` tag (line 14):

```astro
<a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    data-venue={venueId}
```

### Step 7: Verify build passes

```bash
npm run build
```
Expected: No TypeScript errors, clean build.

### Step 8: Commit

```bash
git add src/lib/utils/sanitize-url.ts src/lib/utils/sanitize-url.test.ts \
        src/lib/venues/rio.ts src/lib/venues/fox.ts src/lib/venues/rickshaw.ts \
        src/components/EventCard.astro
git commit -m "security: add URL sanitization for scraped event links (VULN-002)"
```

---

## Task 3: Add Security Headers Middleware (VULN-003 — Low)

**Files:**
- Create: `src/middleware.ts`

### Step 1: Create the middleware

Create `src/middleware.ts`:

```typescript
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (_context, next) => {
    const response = await next();

    // Prevent clickjacking
    response.headers.set('X-Frame-Options', 'DENY');

    // Control referrer information
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Restrict browser features
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // Prevent MIME-type sniffing
    response.headers.set('X-Content-Type-Options', 'nosniff');

    // Note: CSP omitted intentionally — GTM requires unsafe-inline.
    // Recommend configuring CSP at Cloudflare/reverse-proxy level with nonce support.

    return response;
});
```

### Step 2: Verify middleware loads

```bash
npm run dev
```
Expected: Server starts cleanly.

### Step 3: Verify headers are present

```bash
curl -sI http://localhost:4321/ | grep -E '(X-Frame|Referrer|Permissions|X-Content)'
```
Expected output:
```
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-Content-Type-Options: nosniff
```

### Step 4: Commit

```bash
git add src/middleware.ts
git commit -m "security: add security response headers middleware (VULN-003)"
```

---

## Post-Implementation Checklist

- [ ] All 3 tasks committed
- [ ] `npm run build` passes cleanly
- [ ] `npx vitest run` passes all tests
- [ ] Manual smoke test: homepage loads, events display, RSS works
- [ ] Manual smoke test: `/api/scrape` returns 401 without token
