/**
 * Sanitize a URL to ensure it uses a safe scheme (http/https only).
 * Returns null for invalid, empty, or dangerous URLs.
 *
 * Used to prevent javascript:, data:, and other dangerous schemes
 * from being rendered as clickable links in EventCard.
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
