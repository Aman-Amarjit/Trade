// Caching layer with per-tier TTL
// Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7

import { createHash } from 'crypto';
import type { UnifiedDataBundle } from '../../shared/types/index.js';

// ---------------------------------------------------------------------------
// TTL tiers (in milliseconds)
// ---------------------------------------------------------------------------

/** Per-candle engines: invalidated on every new candle close */
const PER_CANDLE_ENGINES = new Set([
    'MicroStructureEngine',
    'OrderflowEngine',
    'GeometryClassifier',
    'LiquidityMapEngine',
    'MarketStructureContextEngine',
    'PredictionEngine',
]);

/** Low-frequency engines: 5–15 minute TTL */
const LOW_FREQUENCY_ENGINES = new Set([
    'MacroBiasEngine',
    'GlobalStressEngine',
    'SectorRotationEngine',
]);

/** Per-session engines */
const PER_SESSION_ENGINES = new Set(['AssetProfileEngine']);

const LOW_FREQUENCY_TTL_MS = 10 * 60 * 1000; // 10 minutes (configurable midpoint)
const PER_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// ---------------------------------------------------------------------------
// Cache key computation
// ---------------------------------------------------------------------------

/**
 * Compute a SHA-256 cache key from relevant bundle fields.
 * Uses deterministic serialization with stable key ordering.
 * Requirements: 16.1
 */
export function computeCacheKey(engineName: string, bundle: UnifiedDataBundle): string {
    // Select fields relevant to cache key — stable subset
    const relevant = {
        engineName,
        seq: bundle.seq,
        timestamp: bundle.timestamp,
        price: {
            open: bundle.price.open,
            high: bundle.price.high,
            low: bundle.price.low,
            close: bundle.price.close,
        },
        volume: { raw: bundle.volume.raw },
        orderflow: { bid: bundle.orderflow.bid, ask: bundle.orderflow.ask },
        volatility: { atr: bundle.volatility.atr, atrPercentile: bundle.volatility.atrPercentile },
        macro: bundle.macro,
        session: bundle.session,
    };

    // Stable serialization: sort keys recursively
    const serialized = stableStringify(relevant);
    return createHash('sha256').update(serialized).digest('hex');
}

function stableStringify(value: unknown): string {
    if (value === null || value === undefined) return JSON.stringify(value);
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) {
        return '[' + value.map(stableStringify).join(',') + ']';
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

// ---------------------------------------------------------------------------
// Cache entry
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
    value: T;
    expiresAt: number; // epoch ms, 0 = per-candle (invalidated externally)
    bundleSeq: number; // seq at time of caching (for per-candle invalidation)
}

// ---------------------------------------------------------------------------
// EngineCache
// ---------------------------------------------------------------------------

/**
 * Per-engine cache with TTL tiers.
 * Requirements: 16.1–16.7
 */
export class EngineCache {
    private readonly store = new Map<string, CacheEntry<unknown>>();
    private readonly hitCounts = new Map<string, number>();
    private readonly missCounts = new Map<string, number>();

    /**
     * Get a cached value by key.
     * Returns undefined on miss or expiry.
     * Requirements: 16.5
     */
    get<T>(key: string): T | undefined {
        try {
            const entry = this.store.get(key) as CacheEntry<T> | undefined;
            if (!entry) return undefined;
            if (entry.expiresAt !== 0 && Date.now() > entry.expiresAt) {
                this.store.delete(key);
                return undefined;
            }
            return entry.value;
        } catch (err) {
            console.error('[Cache] Read failure, falling back to recomputation:', err);
            return undefined;
        }
    }

    /**
     * Store a value with a TTL in milliseconds.
     * Pass ttl=0 for per-candle entries (invalidated via invalidate()).
     * Requirements: 16.2, 16.3, 16.4
     */
    set<T>(key: string, value: T, ttl: number, bundleSeq = 0): void {
        const expiresAt = ttl === 0 ? 0 : Date.now() + ttl;
        this.store.set(key, { value, expiresAt, bundleSeq });
    }

    /**
     * Invalidate all per-candle entries for a given engine.
     * Called on every new candle close for high/medium frequency engines.
     * Requirements: 16.3
     */
    invalidate(engineName: string): void {
        for (const [key] of this.store) {
            if (key.startsWith(`${engineName}:`)) {
                this.store.delete(key);
            }
        }
    }

    /**
     * Invalidate all per-candle engine entries when a new candle arrives.
     * Requirements: 16.3
     */
    invalidatePerCandleEngines(): void {
        for (const engineName of PER_CANDLE_ENGINES) {
            this.invalidate(engineName);
        }
    }

    /**
     * Track hit/miss rates per engine.
     * Requirements: 16.6
     */
    trackHitMiss(engineName: string, hit: boolean): void {
        if (hit) {
            this.hitCounts.set(engineName, (this.hitCounts.get(engineName) ?? 0) + 1);
        } else {
            this.missCounts.set(engineName, (this.missCounts.get(engineName) ?? 0) + 1);
        }
    }

    /** Get hit/miss stats for an engine */
    getStats(engineName: string): { hits: number; misses: number; hitRate: number } {
        const hits = this.hitCounts.get(engineName) ?? 0;
        const misses = this.missCounts.get(engineName) ?? 0;
        const total = hits + misses;
        return { hits, misses, hitRate: total === 0 ? 0 : hits / total };
    }

    /** Clear all entries */
    clear(): void {
        this.store.clear();
    }
}

// ---------------------------------------------------------------------------
// TTL helpers
// ---------------------------------------------------------------------------

/**
 * Get the appropriate TTL for an engine.
 * Returns 0 for per-candle engines (invalidated externally).
 */
export function getTtlForEngine(engineName: string): number {
    if (PER_CANDLE_ENGINES.has(engineName)) return 0;
    if (LOW_FREQUENCY_ENGINES.has(engineName)) return LOW_FREQUENCY_TTL_MS;
    if (PER_SESSION_ENGINES.has(engineName)) return PER_SESSION_TTL_MS;
    // Default: per-candle
    return 0;
}

export { PER_CANDLE_ENGINES, LOW_FREQUENCY_ENGINES, PER_SESSION_ENGINES, LOW_FREQUENCY_TTL_MS, PER_SESSION_TTL_MS };
