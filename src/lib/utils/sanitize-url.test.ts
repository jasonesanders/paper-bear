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
