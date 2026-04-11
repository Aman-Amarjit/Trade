// REST API server — all endpoints under /api/v1
// Requirements: 19.1–19.12, 28.1–28.6

import express from 'express';
import type { Request, Response } from 'express';
import { bearerAuth } from './auth.js';
import { helmetMiddleware, corsMiddleware, jsonBodyParser, requestIdMiddleware, sanitizeQueryParams, requestLogger } from './security.js';
import { Contract_Version } from '../../shared/types/index.js';
import type { PipelineResult, LiveAnalysisResponse } from '../../shared/types/index.js';
import type { Journal, JournalQueryParams } from '../journal/Journal.js';

// ── Rate limiter (per-client, token bucket) ──────────────────────────────────

const clientBuckets = new Map<string, { tokens: number; lastRefill: number }>();
// Rate limit: 120 req/min — frontend with 3 symbols + dashboard polls ~90 req/min
const RATE_LIMIT_CAPACITY = parseInt(process.env['RATE_LIMIT_RPM'] ?? '120', 10);
const RATE_LIMIT_REFILL_PER_MS = RATE_LIMIT_CAPACITY / 60000;

// Prune stale buckets every 5 minutes to prevent unbounded memory growth
// (a DDoS with many unique IPs would otherwise fill the Map indefinitely)
setInterval(() => {
    const staleThreshold = Date.now() - 5 * 60 * 1000;
    for (const [ip, bucket] of clientBuckets) {
        if (bucket.lastRefill < staleThreshold) clientBuckets.delete(ip);
    }
}, 5 * 60 * 1000).unref();

function checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    let bucket = clientBuckets.get(clientId);
    if (!bucket) {
        bucket = { tokens: RATE_LIMIT_CAPACITY, lastRefill: now };
        clientBuckets.set(clientId, bucket);
    }
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(RATE_LIMIT_CAPACITY, bucket.tokens + elapsed * RATE_LIMIT_REFILL_PER_MS);
    bucket.lastRefill = now;
    if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return true;
    }
    return false;
}

function rateLimitMiddleware(req: Request, res: Response, next: express.NextFunction): void {
    const clientId = req.ip ?? 'unknown';
    if (!checkRateLimit(clientId)) {
        res.setHeader('Retry-After', '60');
        res.status(429).json({ error: 'Too Many Requests', retryAfter: 60 });
        return;
    }
    next();
}

// ── Performance tracking ─────────────────────────────────────────────────────

const cycleDurations: number[] = [];
const MAX_DURATIONS = 100;

export function recordCycleDuration(ms: number): void {
    cycleDurations.push(ms);
    if (cycleDurations.length > MAX_DURATIONS) cycleDurations.shift();
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}

// ── Replay state ─────────────────────────────────────────────────────────────

let replayMode = false;
let replayCandleIndex = 0;

// ── Server factory ───────────────────────────────────────────────────────────

export interface ApiServerOptions {
    journal: Journal;
    getLatestResult: (symbol: string, timeframe: string) => PipelineResult | undefined;
    getAllLatestResults: () => Map<string, PipelineResult>;
    engineVersions: Record<string, string>;
    stepReplay?: () => Promise<PipelineResult | undefined>;
    seekReplay?: (index: number) => Promise<PipelineResult | undefined>;
}

export function createApiServer(opts: ApiServerOptions): express.Application {
    const app = express();

    // ── Security middleware (must be first) ──────────────────────────────────
    app.use(helmetMiddleware);
    app.use(corsMiddleware);
    app.use(jsonBodyParser);
    app.use(requestIdMiddleware);
    app.use(sanitizeQueryParams);
    app.use(requestLogger);

    // Attach Contract-Version header to all responses
    app.use((_req, res, next) => {
        res.setHeader('X-Contract-Version', Contract_Version);
        next();
    });

    // ── Public endpoint (no auth) ────────────────────────────────────────────

    // GET /api/v1/system/versions — Requirements: 19.10, 28.6, 20.1
    app.get('/api/v1/system/versions', (_req, res) => {
        res.json({
            contractVersion: Contract_Version,
            engines: opts.engineVersions,
        });
    });

    // ── Auth + rate limit for all other routes ───────────────────────────────
    app.use('/api/v1', rateLimitMiddleware, bearerAuth);

    // ── GET /api/v1/analysis/live — Requirements: 19.1, 19.4, 19.6, 19.7, 18.11
    app.get('/api/v1/analysis/live', (req, res) => {
        const { symbol, timeframe } = req.query as Record<string, string>;
        if (!symbol || !timeframe) {
            res.status(400).json({ error: 'Missing required query params: symbol, timeframe' });
            return;
        }

        // Validate symbol format — only allow alphanumeric, dash, underscore (max 20 chars)
        if (!/^[A-Z0-9_-]{1,20}$/i.test(symbol)) {
            res.status(400).json({ error: 'Invalid symbol format' });
            return;
        }

        // The backend runs a single configured timeframe. Return 400 if the requested
        // timeframe doesn't match — prevents silently returning data with a wrong label.
        const configuredTimeframe = process.env['TIMEFRAME'] ?? '1m';
        if (timeframe !== configuredTimeframe) {
            res.status(400).json({
                error: `Timeframe mismatch: backend is configured for '${configuredTimeframe}', requested '${timeframe}'. Update TIMEFRAME env var to change the pipeline timeframe.`,
            });
            return;
        }

        const result = opts.getLatestResult(symbol, timeframe);
        if (!result) {
            res.status(503).json({ error: 'No pipeline result available yet' });
            return;
        }

        // ETag based on bundleSeq — allows clients to skip redundant processing via 304
        const etag = `"${result.bundleSeq}"`;
        if (req.headers['if-none-match'] === etag) {
            res.status(304).end();
            return;
        }
        res.setHeader('ETag', etag);

        const response: LiveAnalysisResponse = {
            symbol,
            timeframe,
            prediction: result.decision.prediction,
            risk: result.decision.risk,
            state: result.decision.state,
            liquidity: result.structure.liquidityMap,
            geometry: result.geometry.geometry,
            microstructure: result.geometry.microstructure,
            breakoutCycle: result.geometry.breakoutCycle,
            currentPrice: result.currentPrice,
            scoring: result.decision.scoring,
            timestamp: result.timestamp,
            degraded: result.degraded,
            failedEngines: result.failedEngines,
            engineRate: result.engineRate,
            rejectionRatio: result.rejectionRatio,
            dailyDrawdown: result.decision.risk.dailyDrawdown,
            dailyDrawdownCap: result.decision.risk.dailyDrawdownCap,
        };

        res.json(response);
    });

    // ── GET /api/v1/analysis/dashboard — Requirements: 19.5
    app.get('/api/v1/analysis/dashboard', (req, res) => {
        const symbolsParam = (req.query['symbols'] as string) ?? '';
        // Cap at 20 symbols to prevent DoS via large symbol lists
        const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);

        const all = opts.getAllLatestResults();
        const summaries = symbols.map(sym => {
            const result = all.get(sym);
            if (!result) return { symbol: sym, available: false };

            // expectedMove = EDD (ATR × volatilityFactor) — per-asset expected adverse move
            const edd = result.decision.risk.edd;
            // timeWindow: session-based expected duration (Section 9.9)
            const sessionTimeWindows: Record<string, string> = {
                ASIA: '0–8h UTC',
                LONDON: '8–13h UTC',
                NEWYORK: '13–21h UTC',
                POSTNY: '21–24h UTC',
                WEEKEND: 'Weekend',
            };
            const timeWindow = sessionTimeWindows[result.context.sessionType] ?? 'Unknown';

            return {
                symbol: sym,
                available: true,
                probability: result.decision.scoring.probability,
                volatilityRegime: result.context.volatilityRegime,
                globalStress: result.context.globalStress,
                state: result.decision.state.state,
                geometryRegime: result.geometry.geometry.geometryRegime ?? null,
                expectedMove: edd,
                timeWindow,
                degraded: result.degraded,
                timestamp: result.timestamp,
            };
        });

        res.json(summaries);
    });

    // ── GET /api/v1/diagnostics/performance — Requirements: 19.11
    app.get('/api/v1/diagnostics/performance', (_req, res) => {
        const sorted = [...cycleDurations].sort((a, b) => a - b);
        res.json({
            last100: cycleDurations,
            p50: percentile(sorted, 50),
            p95: percentile(sorted, 95),
            p99: percentile(sorted, 99),
        });
    });

    // ── GET /api/v1/diagnostics/journal — Requirements: 19.12, 17.8
    app.get('/api/v1/diagnostics/journal', async (req, res) => {
        const rawPage = req.query['page'] ? parseInt(req.query['page'] as string, 10) : undefined;
        const rawPageSize = req.query['pageSize'] ? parseInt(req.query['pageSize'] as string, 10) : undefined;

        // Validate pagination params — reject NaN and out-of-range values
        if (rawPage !== undefined && (isNaN(rawPage) || rawPage < 1)) {
            res.status(400).json({ error: 'page must be a positive integer' });
            return;
        }
        if (rawPageSize !== undefined && (isNaN(rawPageSize) || rawPageSize < 1 || rawPageSize > 500)) {
            res.status(400).json({ error: 'pageSize must be between 1 and 500' });
            return;
        }

        const params: JournalQueryParams = {
            engine: req.query['engine'] as string | undefined,
            from: req.query['from'] as string | undefined,
            to: req.query['to'] as string | undefined,
            page: rawPage,
            pageSize: rawPageSize,
        };

        try {
            const result = await opts.journal.query(params);
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: 'Journal query failed', message: String(err) });
        }
    });

    // ── POST /api/v1/replay/activate — toggle replay mode on/off
    app.post('/api/v1/replay/activate', (req, res) => {
        const { active } = req.body as { active?: boolean };
        if (typeof active !== 'boolean') {
            res.status(400).json({ error: 'active must be a boolean' });
            return;
        }
        replayMode = active;
        replayCandleIndex = 0;
        res.json({ replayMode, message: active ? 'Replay mode activated' : 'Replay mode deactivated' });
    });

    // ── POST /api/v1/replay/step — Requirements: 30.3, 30.6
    app.post('/api/v1/replay/step', async (_req, res) => {
        if (!replayMode) {
            res.status(400).json({ error: 'Replay mode is not active. POST /api/v1/replay/activate with { "active": true } first.' });
            return;
        }
        if (!opts.stepReplay) {
            res.status(501).json({ error: 'Replay not configured — no CSV file provided to the server' });
            return;
        }
        const result = await opts.stepReplay();
        replayCandleIndex++;
        res.json({ candleIndex: replayCandleIndex, result: result ?? null });
    });

    // ── POST /api/v1/replay/seek — Requirements: 30.3, 30.6
    app.post('/api/v1/replay/seek', async (req, res) => {
        if (!replayMode) {
            res.status(400).json({ error: 'Replay mode is not active. POST /api/v1/replay/activate with { "active": true } first.' });
            return;
        }
        if (!opts.seekReplay) {
            res.status(501).json({ error: 'Replay not configured — no CSV file provided to the server' });
            return;
        }
        const { candleIndex } = req.body as { candleIndex?: number };
        if (typeof candleIndex !== 'number' || !isFinite(candleIndex) || candleIndex < 0 || candleIndex > 1_000_000) {
            res.status(400).json({ error: 'candleIndex must be a non-negative finite number (max 1,000,000)' });
            return;
        }
        const result = await opts.seekReplay(candleIndex);
        replayCandleIndex = candleIndex;
        res.json({ candleIndex, result: result ?? null });
    });

    return app;
}

export function setReplayMode(active: boolean): void {
    replayMode = active;
    replayCandleIndex = 0;
}
