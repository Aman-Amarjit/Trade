// Security middleware — helmet headers, CORS policy, body size limit
// Apply this FIRST in createApiServer() before any route definitions.

import helmet from 'helmet';
import cors from 'cors';
import express from 'express';

// ── CORS ─────────────────────────────────────────────────────────────────────
// Allowed origins are read from the environment so production deployments can
// whitelist their own domains without touching source code.
//
// Example .env entry:
//   ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
//
// Falls back to localhost Vite dev server when the variable is not set.

const rawOrigins = process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:5173';
const allowedOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

export const corsMiddleware = cors({
    origin: (origin, callback) => {
        // Allow server-to-server requests (no Origin header) and whitelisted origins.
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin '${origin}' is not allowed`));
        }
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    // Do not expose sensitive headers to the browser.
    exposedHeaders: ['X-Contract-Version', 'Retry-After'],
    maxAge: 86400, // Preflight cached for 24hrs to reduce OPTIONS overhead
});

// ── Helmet (HTTP Security Headers) ───────────────────────────────────────────
// Configures 12 OWASP-recommended headers including:
//   X-Content-Type-Options: nosniff
//   X-Frame-Options: DENY
//   Strict-Transport-Security (HSTS)
//   Content-Security-Policy
//   Referrer-Policy: no-referrer
//   X-DNS-Prefetch-Control: off

export const helmetMiddleware = helmet({
    // This API only serves JSON — CSP locks it down tightly.
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'none'"],
            scriptSrc: ["'none'"],
            objectSrc: ["'none'"],
        },
    },
    // Enforce HTTPS for 1 year in production; safe to set even in dev.
    strictTransportSecurity: {
        maxAge: 31_536_000, // 1 year in seconds
        includeSubDomains: true,
    },
    // Prevent browsers from sniffing content type away from the declared one.
    xContentTypeOptions: true,
    // Disallow this API from being embedded in any frame.
    frameguard: { action: 'deny' },
    // Do not send referrer info when navigating away.
    referrerPolicy: { policy: 'no-referrer' },
});

// ── Body Size Cap ─────────────────────────────────────────────────────────────
// Limits JSON payloads to 100kb — protects against payload flooding attacks.
// The replay endpoints POST a candle index (a small number), so 100kb is
// orders of magnitude more than any legitimate consumer needs.

export const jsonBodyParser = express.json({ limit: '100kb' });
