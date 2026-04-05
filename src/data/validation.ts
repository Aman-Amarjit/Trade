// Data Layer validation functions
// Requirements: 5.3, 5.4, 6.3, 6.4, 6.5, 15.5

import type { OHLCVBar, OrderflowSnapshot } from './adapters/DataAdapter.js';
import type { UnifiedDataBundle } from '../../shared/types/index.js';

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

const MAX_BUNDLE_BYTES = 1_048_576; // 1MB

/**
 * Validate OHLCV bar integrity.
 * Rules: high >= max(open, close), low <= min(open, close), volume >= 0, no NaN.
 * Requirements: 6.4
 */
export function validateOHLCV(bar: OHLCVBar): ValidationResult {
    const errors: string[] = [];

    const fields: Array<[string, number]> = [
        ['open', bar.open],
        ['high', bar.high],
        ['low', bar.low],
        ['close', bar.close],
        ['volume', bar.volume],
    ];

    for (const [name, value] of fields) {
        if (isNaN(value)) {
            errors.push(`NaN value in field '${name}': ${value}`);
        }
    }

    if (!isNaN(bar.high) && !isNaN(bar.open) && !isNaN(bar.close)) {
        const maxOC = Math.max(bar.open, bar.close);
        if (bar.high < maxOC) {
            errors.push(`high (${bar.high}) < max(open, close) (${maxOC})`);
        }
    }

    if (!isNaN(bar.low) && !isNaN(bar.open) && !isNaN(bar.close)) {
        const minOC = Math.min(bar.open, bar.close);
        if (bar.low > minOC) {
            errors.push(`low (${bar.low}) > min(open, close) (${minOC})`);
        }
    }

    if (!isNaN(bar.volume) && bar.volume < 0) {
        errors.push(`volume (${bar.volume}) < 0`);
    }

    if (errors.length > 0) {
        console.warn('[Validation] OHLCV validation failed:', errors, 'bar:', bar);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate orderflow snapshot integrity.
 * Rules: bid >= 0, ask >= 0, delta === ask - bid, CVD increments correctly.
 * Requirements: 6.5
 */
export function validateOrderflow(
    snapshot: OrderflowSnapshot,
    previousCvd?: number,
): ValidationResult {
    const errors: string[] = [];

    if (isNaN(snapshot.bid)) errors.push(`NaN in bid: ${snapshot.bid}`);
    if (isNaN(snapshot.ask)) errors.push(`NaN in ask: ${snapshot.ask}`);
    if (isNaN(snapshot.delta)) errors.push(`NaN in delta: ${snapshot.delta}`);
    if (isNaN(snapshot.cvd)) errors.push(`NaN in cvd: ${snapshot.cvd}`);

    if (!isNaN(snapshot.bid) && snapshot.bid < 0) {
        errors.push(`bid (${snapshot.bid}) < 0`);
    }
    if (!isNaN(snapshot.ask) && snapshot.ask < 0) {
        errors.push(`ask (${snapshot.ask}) < 0`);
    }

    if (!isNaN(snapshot.bid) && !isNaN(snapshot.ask) && !isNaN(snapshot.delta)) {
        const expectedDelta = snapshot.ask - snapshot.bid;
        if (Math.abs(snapshot.delta - expectedDelta) > 1e-9) {
            errors.push(
                `delta (${snapshot.delta}) !== ask - bid (${expectedDelta})`,
            );
        }
    }

    // CVD increment check: cvd should equal previousCvd + delta
    if (previousCvd !== undefined && !isNaN(snapshot.delta) && !isNaN(snapshot.cvd)) {
        const expectedCvd = previousCvd + snapshot.delta;
        if (Math.abs(snapshot.cvd - expectedCvd) > 1e-9) {
            errors.push(
                `CVD (${snapshot.cvd}) does not increment correctly from previous (${previousCvd}) + delta (${snapshot.delta}) = ${expectedCvd}`,
            );
        }
    }

    if (errors.length > 0) {
        console.warn('[Validation] Orderflow validation failed:', errors, 'snapshot:', snapshot);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate that timestamps are strictly increasing, no duplicates,
 * and no gaps larger than the expected candle interval.
 * Requirements: 5.3, 5.4
 */
export function validateTimestampOrdering(
    timestamps: string[],
    expectedIntervalMs?: number,
): ValidationResult {
    const errors: string[] = [];

    if (timestamps.length < 2) {
        return { valid: true, errors: [] };
    }

    const times = timestamps.map((t) => new Date(t).getTime());

    for (let i = 1; i < times.length; i++) {
        const prev = times[i - 1];
        const curr = times[i];

        if (isNaN(prev) || isNaN(curr)) {
            errors.push(`Invalid timestamp at index ${i}: '${timestamps[i]}'`);
            continue;
        }

        if (curr <= prev) {
            errors.push(
                `Timestamp not strictly increasing at index ${i}: '${timestamps[i]}' <= '${timestamps[i - 1]}'`,
            );
        }

        if (expectedIntervalMs !== undefined && curr > prev) {
            const gap = curr - prev;
            if (gap > expectedIntervalMs * 1.5) {
                errors.push(
                    `Gap too large between index ${i - 1} and ${i}: ${gap}ms > expected ${expectedIntervalMs}ms`,
                );
            }
        }
    }

    if (errors.length > 0) {
        console.warn('[Validation] Timestamp ordering validation failed:', errors);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate that the serialized bundle does not exceed 1MB.
 * Requirements: 15.5
 */
export function validateBundleSize(bundle: UnifiedDataBundle): ValidationResult {
    const errors: string[] = [];

    const serialized = JSON.stringify(bundle);
    const byteLength = Buffer.byteLength(serialized, 'utf-8');

    if (byteLength > MAX_BUNDLE_BYTES) {
        const msg = `Bundle size (${byteLength} bytes) exceeds 1MB limit (${MAX_BUNDLE_BYTES} bytes)`;
        errors.push(msg);
        console.warn('[Validation] Bundle size validation failed:', msg);
    }

    return { valid: errors.length === 0, errors };
}
