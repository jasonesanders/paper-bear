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
