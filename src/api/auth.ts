// Bearer token authentication middleware
// Requirements: 19.2, 19.3, 28.1, 28.2, 28.3, 28.4, 28.5

import type { Request, Response, NextFunction } from 'express';

// Token store — in production, replace with a proper token registry
const validTokens = new Set<string>();

/** Register a valid Bearer token (call at startup) */
export function registerToken(token: string): void {
    validTokens.add(token);
}

/** Revoke a token without service restart */
export function revokeToken(token: string): void {
    validTokens.delete(token);
}

/** Mask a token for safe logging — never log the full value */
function maskToken(token: string): string {
    if (token.length <= 8) return '***';
    return token.slice(0, 4) + '***' + token.slice(-4);
}

/**
 * Bearer token authentication middleware.
 * Validates Authorization: Bearer <token> header.
 * Returns HTTP 401 for missing or invalid tokens.
 * Requirements: 19.2, 19.3, 28.1–28.5
 */
export function bearerAuth(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
        });
        return;
    }

    const token = authHeader.slice(7).trim();

    if (!validTokens.has(token)) {
        console.warn(`[Auth] Invalid token attempt: ${maskToken(token)}`);
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired Bearer token',
        });
        return;
    }

    next();
}
