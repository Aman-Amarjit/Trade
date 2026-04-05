// Property 3: Forbidden String Absence in All Outputs
// Validates: Requirements 1.2
// Feature: multi-layer-analytical-architecture, Property 3: Forbidden String Absence in All Outputs

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { MockAdapter } from '../../data/adapters/MockAdapter.js';
import { PipelineOrchestrator } from '../../pipeline/PipelineOrchestrator.js';
import { assembleBundle } from '../../data/bundleAssembler.js';
import type { RollingStats } from '../../data/bundleAssembler.js';

const FORBIDDEN = ['Buy', 'Sell', 'Long', 'Short', 'Entry', 'Exit', 'PnL'];

function containsForbidden(obj: unknown): string | null {
    const str = JSON.stringify(obj);
    for (const term of FORBIDDEN) {
        // Case-sensitive word boundary check
        const regex = new RegExp(`\\b${term}\\b`);
        if (regex.test(str)) return term;
    }
    return null;
}

describe('Property 3: Forbidden String Absence', () => {
    it('no forbidden terms appear in any pipeline output', async () => {
        const adapter = new MockAdapter();
        const orchestrator = new PipelineOrchestrator();

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 50 }),
                async (limit) => {
                    const bars = await adapter.fetchOHLCV('BTC', '1m', limit);
                    const bar = bars[bars.length - 1];
                    const orderflow = await adapter.fetchOrderflow('BTC');
                    const volatility = await adapter.fetchVolatilityMetrics('BTC');
                    const macro = await adapter.fetchMacroIndicators();

                    const rollingStats: RollingStats = {
                        rollingMeanVolume: 500,
                        rollingATR: 200,
                        rollingDeltaStd: 10,
                        atrPercentile: 0.5,
                        bandwidth: 0.04,
                        previousCvd: 0,
                    };

                    const bundle = assembleBundle({
                        bar, orderflow, volatility, macro,
                        swings: [], trend: 'RANGE',
                        internalSwings: [], externalSwings: [],
                        fvg: [], stopClusters: [], liqShelves: [],
                        sessionType: 'NEWYORK', sessionVolatilityPattern: 0.5,
                    }, limit, rollingStats);

                    const result = await orchestrator.run(bundle);
                    const forbidden = containsForbidden(result);
                    expect(forbidden).toBeNull();
                }
            ),
            { numRuns: 100 }
        );
    });
});
