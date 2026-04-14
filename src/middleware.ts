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

    // Note: Strict-Transport-Security is intentionally delegated to the proxy/Cloudflare layer.
    // Setting it in SSR middleware has no effect in non-HTTPS local dev, and HTTPS enforcement
    // is better handled at the edge where it can apply to all responses including redirects.

    // Note: CSP omitted intentionally — GTM requires unsafe-inline.
    // Recommend configuring CSP at Cloudflare/reverse-proxy level with nonce support.

    return response;
});
