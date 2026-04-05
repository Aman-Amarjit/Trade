// HTTPS server bootstrap — "bring your own certificate" design.
// Only activated when TLS_CERT_PATH and TLS_KEY_PATH are set in the environment.
// Falls back transparently to HTTP for local development.

import https from 'node:https';
import fs from 'node:fs';
import type { Application } from 'express';

export interface TlsConfig {
    certPath: string;
    keyPath: string;
}

/**
 * Reads TLS certificate and key from the file system.
 * Throws a descriptive error if the files cannot be read so the process
 * fails fast at startup rather than silently falling back to HTTP.
 */
function loadTlsFiles(config: TlsConfig): { cert: Buffer; key: Buffer } {
    try {
        const cert = fs.readFileSync(config.certPath);
        const key = fs.readFileSync(config.keyPath);
        return { cert, key };
    } catch (err) {
        throw new Error(
            `[HTTPS] Failed to read TLS files.\n` +
            `  cert: ${config.certPath}\n` +
            `  key:  ${config.keyPath}\n` +
            `  Reason: ${String(err)}`,
        );
    }
}

/**
 * Starts the Express app as an HTTPS server.
 *
 * Usage — set these in your .env:
 *   TLS_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
 *   TLS_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
 */
export function startHttpsServer(app: Application, port: number, config: TlsConfig): void {
    const { cert, key } = loadTlsFiles(config);

    const server = https.createServer({ cert, key }, app);

    server.listen(port, () => {
        console.log(`[Server] HTTPS server running on https://0.0.0.0:${port}`);
        console.log(`[Server] TLS cert: ${config.certPath}`);
    });

    // Surface TLS errors without crashing the process silently.
    server.on('tlsClientError', (err) => {
        console.warn('[HTTPS] TLS client error:', err.message);
    });
}

/**
 * Returns the TLS config from environment variables, or null if not configured.
 * The caller uses this to decide between HTTP and HTTPS at startup.
 */
export function getTlsConfigFromEnv(): TlsConfig | null {
    const certPath = process.env['TLS_CERT_PATH'];
    const keyPath = process.env['TLS_KEY_PATH'];

    if (certPath && keyPath) {
        return { certPath, keyPath };
    }

    return null;
}
