// Security middleware — helmet headers, CORS policy, body size limit, request ID
// Apply this FIRST in createApiServer() before any route definitions.

import helmet from 'helmet';
import cors from 'cors';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// ── CORS ─────────────────────────────────────────────────────────────────────
const rawOrigins = process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:5173';
const allowedOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

export const corsMiddleware = cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin '${origin}' is not allowed`));
        }
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization', 'Content-Type', 'If-None-Match'],
    exposedHeaders: ['X-Contract-Version', 'Retry-After', 'ETag', 'X-Request-Id'],
    maxAge: 86400,
});

// ── Helmet (HTTP Security Headers) ───────────────────────────────────────────
export const helmetMiddleware = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'none'"],
            scriptSrc: ["'none'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
        },
    },
    strictTransportSecurity: {
        maxAge: 31_536_000,
        includeSubDomains: true,
        preload: true,
    },
    xContentTypeOptions: true,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
    // Disable X-Powered-By to avoid fingerprinting
    hidePoweredBy: true,
    // Prevent IE from executing downloads in the site's context
    ieNoOpen: true,
    // Don't allow DNS prefetching
    dnsPrefetchControl: { allow: false },
    // Prevent cross-origin reads
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
});

// ── Body Size Cap ─────────────────────────────────────────────────────────────
export const jsonBodyParser = express.json({ limit: '100kb' });

// ── Request ID ────────────────────────────────────────────────────────────────
// Attaches a unique X-Request-Id to every request for tracing.
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    const id = (req.headers['x-request-id'] as string) || randomUUID();
    res.setHeader('X-Request-Id', id);
    (req as Request & { requestId: string }).requestId = id;
    next();
}

// ── Query Parameter Sanitization ─────────────────────────────────────────────
// Strips any query param value that exceeds 200 chars or contains control characters.
// Prevents log injection and oversized input attacks.
export function sanitizeQueryParams(req: Request, _res: Response, next: NextFunction): void {
    for (const key of Object.keys(req.query)) {
        const val = req.query[key];
        if (typeof val === 'string') {
            // Remove control characters and truncate
            req.query[key] = val.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200);
        }
    }
    next();
}

// ── Request Logging ───────────────────────────────────────────────────────────
// Logs method, path, status, and duration for every request.
// Never logs Authorization headers or token values.
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;
        const id = res.getHeader('X-Request-Id') ?? '-';
        // Only log non-health-check requests to avoid noise
        if (req.path !== '/health') {
            console.log(`[API] ${req.method} ${req.path} ${res.statusCode} ${ms}ms req=${id}`);
        }
    });
    next();
}
