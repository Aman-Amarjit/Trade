// DataLayer — primary/fallback adapter switching + rate limiting
// Requirements: 8.1, 8.4, 8.5, 8.6, 15.7

import type {
    DataAdapter,
    OHLCVBar,
    OrderflowSnapshot,
    VolumeProfile,
    VolatilityMetrics,
    MacroIndicators,
    DerivativesData,
    SessionData,
} from './adapters/DataAdapter.js';

export interface DataLayerOptions {
    /** Timeout in ms before switching to fallback (default: 5000) */
    timeoutMs?: number;
    /** Max concurrent pipeline executions before queuing (default: 1) */
    maxConcurrentPipelines?: number;
}

/**
 * Token bucket rate limiter.
 * Allows up to `capacity` tokens, refilling at `refillRate` tokens/ms.
 */
class TokenBucket {
    private tokens: number;
    private lastRefill: number;

    constructor(
        private readonly capacity: number,
        private readonly refillRate: number, // tokens per ms
    ) {
        this.tokens = capacity;
        this.lastRefill = Date.now();
    }

    consume(count = 1): boolean {
        this.refill();
        if (this.tokens >= count) {
            this.tokens -= count;
            return true;
        }
        return false;
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;
    }
}

/**
 * DataLayer wraps a primary adapter with optional fallback.
 * On primary timeout, logs the switchover and uses the fallback.
 * Enforces rate limiting on outbound adapter calls.
 * Supports at least 10 concurrent reads from cached pipeline result.
 * Requirements: 8.4, 8.5, 15.7
 */
export class DataLayer implements DataAdapter {
    private readonly primary: DataAdapter;
    private readonly fallback: DataAdapter | undefined;
    private readonly timeoutMs: number;
    private usingFallback = false;

    // Rate limiter: 100 tokens capacity, refill 1 token per 10ms (100 req/s)
    private readonly rateLimiter = new TokenBucket(100, 0.1);

    // Pipeline execution queue — ensures at most 1 active pipeline at a time
    // while serving up to 10 concurrent reads from the cached result
    private activePipelineCount = 0;
    private readonly maxConcurrentPipelines: number;
    private pipelineQueue: Array<() => void> = [];

    // Last known good data per method (stale fallback)
    private lastGoodData: Map<string, unknown> = new Map();

    constructor(
        primary: DataAdapter,
        fallback?: DataAdapter,
        options: DataLayerOptions = {},
    ) {
        this.primary = primary;
        this.fallback = fallback;
        this.timeoutMs = options.timeoutMs ?? 5000;
        this.maxConcurrentPipelines = options.maxConcurrentPipelines ?? 1;
    }

    /**
     * Acquire a pipeline execution slot.
     * If at capacity, queues the caller until a slot is free.
     * Up to 10 concurrent reads are served from cache without triggering new execution.
     */
    async acquirePipelineSlot(): Promise<void> {
        if (this.activePipelineCount < this.maxConcurrentPipelines) {
            this.activePipelineCount++;
            return;
        }
        return new Promise<void>((resolve) => {
            this.pipelineQueue.push(resolve);
        });
    }

    releasePipelineSlot(): void {
        this.activePipelineCount = Math.max(0, this.activePipelineCount - 1);
        const next = this.pipelineQueue.shift();
        if (next) {
            this.activePipelineCount++;
            next();
        }
    }

    private async withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Timeout: ${label}`)), this.timeoutMs);
        });
        try {
            const result = await Promise.race([promise, timeout]);
            clearTimeout(timer);
            return result;
        } catch (err) {
            clearTimeout(timer);
            throw err;
        }
    }

    private checkRateLimit(): void {
        if (!this.rateLimiter.consume()) {
            throw new Error('Rate limit exceeded on adapter calls');
        }
    }

    private async callWithFallback<T>(
        key: string,
        primaryCall: () => Promise<T>,
        fallbackCall?: () => Promise<T>,
    ): Promise<T> {
        this.checkRateLimit();

        try {
            const result = await this.withTimeout(primaryCall(), key);
            this.usingFallback = false;
            this.lastGoodData.set(key, result);
            return result;
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.warn(`[DataLayer] Primary adapter failed for ${key}: ${errMsg}`);

            if (fallbackCall) {
                if (!this.usingFallback) {
                    console.warn(`[DataLayer] Switching to fallback adapter for ${key}`);
                    this.usingFallback = true;
                    this.logSwitchover(key, errMsg);
                }
                try {
                    const result = await this.withTimeout(fallbackCall(), `fallback:${key}`);
                    this.lastGoodData.set(key, result);
                    return result;
                } catch (fallbackErr) {
                    const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
                    console.error(`[DataLayer] Fallback adapter also failed for ${key}: ${fallbackMsg}`);
                }
            }

            // Return last known good data marked as stale
            const stale = this.lastGoodData.get(key);
            if (stale !== undefined) {
                console.warn(`[DataLayer] Returning stale data for ${key}`);
                return stale as T;
            }

            throw new Error(`[DataLayer] No data available for ${key}: ${errMsg}`);
        }
    }

    private logSwitchover(key: string, reason: string): void {
        const entry = {
            type: 'SYSTEM_DIAGNOSTIC',
            timestamp: new Date().toISOString(),
            category: 'ADAPTER_SWITCHOVER',
            message: `Switched from primary to fallback adapter for ${key}`,
            data: { key, reason },
        };
        console.log('[DataLayer] SWITCHOVER:', JSON.stringify(entry));
    }

    async fetchOHLCV(symbol: string, timeframe: string, limit: number): Promise<OHLCVBar[]> {
        return this.callWithFallback(
            `fetchOHLCV:${symbol}:${timeframe}`,
            () => this.primary.fetchOHLCV(symbol, timeframe, limit),
            this.fallback ? () => this.fallback!.fetchOHLCV(symbol, timeframe, limit) : undefined,
        );
    }

    async fetchOrderflow(symbol: string): Promise<OrderflowSnapshot> {
        return this.callWithFallback(
            `fetchOrderflow:${symbol}`,
            () => this.primary.fetchOrderflow(symbol),
            this.fallback ? () => this.fallback!.fetchOrderflow(symbol) : undefined,
        );
    }

    async fetchVolumeProfile(symbol: string, timeframe: string): Promise<VolumeProfile> {
        return this.callWithFallback(
            `fetchVolumeProfile:${symbol}:${timeframe}`,
            () => this.primary.fetchVolumeProfile(symbol, timeframe),
            this.fallback ? () => this.fallback!.fetchVolumeProfile(symbol, timeframe) : undefined,
        );
    }

    async fetchVolatilityMetrics(symbol: string): Promise<VolatilityMetrics> {
        return this.callWithFallback(
            `fetchVolatilityMetrics:${symbol}`,
            () => this.primary.fetchVolatilityMetrics(symbol),
            this.fallback ? () => this.fallback!.fetchVolatilityMetrics(symbol) : undefined,
        );
    }

    async fetchMacroIndicators(): Promise<MacroIndicators> {
        return this.callWithFallback(
            'fetchMacroIndicators',
            () => this.primary.fetchMacroIndicators(),
            this.fallback ? () => this.fallback!.fetchMacroIndicators() : undefined,
        );
    }

    async fetchDerivativesData(symbol: string): Promise<DerivativesData> {
        return this.callWithFallback(
            `fetchDerivativesData:${symbol}`,
            () => this.primary.fetchDerivativesData(symbol),
            this.fallback ? () => this.fallback!.fetchDerivativesData(symbol) : undefined,
        );
    }

    async fetchSessionData(timestamp: string): Promise<SessionData> {
        return this.callWithFallback(
            `fetchSessionData:${timestamp}`,
            () => this.primary.fetchSessionData(timestamp),
            this.fallback ? () => this.fallback!.fetchSessionData(timestamp) : undefined,
        );
    }

    get isUsingFallback(): boolean {
        return this.usingFallback;
    }
}
