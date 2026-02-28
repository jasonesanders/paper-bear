# Astro Security Patterns

Astro's unique architecture (Partial Hydration, Server-First) has specific security properties.

## 1. Zero-JS by Default (Do Not Flag)
Astro components (`.astro`) are strictly server-side. Unless there's a client directive (`client:load`, etc.), the JavaScript in the frontmatter **never** reaches the client. This is a massive feature for security.

| Pattern | Security Property |
|---------|-------------------|
| Frontmatter code | Stays on server. Safe to use secrets (API keys) if not passed to client-side components. |
| Template expressions | Auto-escaped by default. |

## 2. Server-Side Rendering (SSR) Logic
If `output: 'server'` or `'hybrid'` is used, Astro runs on a request-by-request basis.

### SSR Injection
```astro
---
// VULNERABLE: Direct use of query param in SSR logic
const { id } = Astro.url.searchParams.get('id');
const data = await db.query(`SELECT * FROM x WHERE id = ${id}`);
---
```
**Fix:** Use parameterized queries or ORM calls just like in Node.js.

### Open Redirects
```astro
---
// VULNERABLE: Unvalidated redirect
const next = Astro.url.searchParams.get('next');
if (next) return Astro.redirect(next);
---
```
**Fix:** Validate `next` against an allowlist or ensure it's a relative path.

## 3. Client Directives and Hydration
When using `client:load`, `client:visible`, etc.,props are passed from the server to the client.

| Directive | Risk |
|-----------|------|
| `client:only` | Component runs ONLY on client. SSR sanitization won't happen. |
| prop injection | If you pass a server-side object to a client component, ensure it doesn't leak sensitive data (e.g., `user` object with `hashed_password`). |

## 4. API Routes (Endpoints)
Astro allows creating `.ts` / `.js` files in `src/pages/` that export a `GET`, `POST`, etc.

### Authorization
Astro doesn't provide built-in auth. Each endpoint must manually check sessions.
```typescript
// VULNERABLE: No auth check
export const GET: APIRoute = async ({ request }) => {
  const data = await db.all();
  return new Response(JSON.stringify(data));
};
```
**Fix:** Implement a middleware or helper function to check cookies/headers before processing.

## 5. Security Headers
Astro doesn't set security headers automatically.

**Fix:** Use a middleware (`src/middleware.ts`) to set CSP, HSTS, X-Frame-Options, etc.

```typescript
// src/middleware.ts
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  response.headers.set('Content-Security-Policy', "default-src 'self'...");
  return response;
});
```

## Quick Patterns for Astro Review

### Check for `bypassSecurityTrust` or `set:html`
Astro's equivalent of `innerHTML` is `set:html`.
```astro
<!-- VULNERABLE: set:html with user input -->
<div set:html={Astro.url.searchParams.get('content')} />

<!-- SAFE: use only for trusted/sanitized content -->
<div set:html={trustedContent} />
```

### Check for `is:raw` and `<script>` tags
Astro components can contain `<script>` tags. If user-controlled data is injected into a `<script>`, it's reflected XSS.
```astro
<script define:vars={{ userInput }}>
  // VULNERABLE if userInput isn't sanitized
  console.log(userInput);
</script>
```
**Fix:** Use `define:vars` correctly (Astro automatically JSON serializes/safens basic types) or avoid injecting directly into listener strings.
