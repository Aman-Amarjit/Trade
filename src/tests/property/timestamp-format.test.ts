// Property 4: Timestamp Format Invariant
// Validates: Requirements 5.1
// Feature: multi-layer-analytical-architecture, Property 4: Timestamp Format Invariant

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { MockAdapter } from '../../data/adapters/MockAdapter.js';
import { PipelineOrchestrator } from '../../pipeline/PipelineOrchestrator.js';
import { assembleBundle } from '../../data/bundleAssembler.js';
import type { RollingStats } from '../../data/bundleAssembler.js';

// UTC ISO 8601 with millisecond precision: 2024-01-01T00:00:00.000Z
const ISO8601_MS_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function collectTimestamps(obj: unknown): string[] {
    const timestamps: string[] = [];
    const str = JSON.stringify(obj);
    const matches = str.match(/"timestamp":"([^"]+)"/g) ?? [];
    for (const m of matches) {
        const ts = m.replace(/"timestamp":"/, '').replace(/"$/, '');
        timestamps.push(ts);
    }
    return timestamps;
}

describe('Property 4: Timestamp Format Invariant', () => {
    it('all timestamps in pipeline output are UTC ISO 8601 with millisecond precision', async () => {
        const adapter = new MockAdapter();
        const orchestrator = new PipelineOrchestrator();

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 20 }),
                async (seq) => {
                    const bars = await adapter.fetchOHLCV('BTC', '1m', 3);
                    const bar = bars[bars.length - 1];
                    const orderflow = await adapter.fetchOrderflow('BTC');
                    const volatility = await adapter.fetchVolatilityMetrics('BTC');
                    const macro = await adapter.fetchMacroIndicators();

                    const rollingStats: RollingStats = {
                        rollingMeanVolume: 500, rollingATR: 200,
                        rollingDeltaStd: 10, atrPercentile: 0.5,
                        bandwidth: 0.04, previousCvd: 0,
                    };

                    const bundle = assembleBundle({
                        bar, orderflow, volatility, macro,
                        swings: [], trend: 'RANGE',
                        internalSwings: [], externalSwings: [],
                        fvg: [], stopClusters: [], liqShelves: [],
                        sessionType: 'NEWYORK', sessionVolatilityPattern: 0.5,
                    }, seq, rollingStats);

                    const result = await orchestrator.run(bundle);
                    const timestamps = collectTimestamps(result);

                    for (const ts of timestamps) {
                        expect(ts).toMatch(ISO8601_MS_REGEX);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
