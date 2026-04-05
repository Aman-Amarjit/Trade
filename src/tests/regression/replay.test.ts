// Regression test suite using replay mode (MockAdapter as deterministic source)
// Validates: Requirements 29.3, 30.7

import { describe, it, expect } from 'vitest';
import { MockAdapter } from '../../data/adapters/MockAdapter.js';
import { PipelineOrchestrator } from '../../pipeline/PipelineOrchestrator.js';
import { assembleBundle } from '../../data/bundleAssembler.js';
import type { RollingStats } from '../../data/bundleAssembler.js';

describe('Regression: deterministic replay', () => {
    it('same input bundle produces identical output on two separate runs', async () => {
        const adapter = new MockAdapter();
        const rollingStats: RollingStats = {
            rollingMeanVolume: 500, rollingATR: 200,
            rollingDeltaStd: 10, atrPercentile: 0.5,
            bandwidth: 0.04, previousCvd: 0,
        };

        const bars = await adapter.fetchOHLCV('BTC', '1m', 5);
        const bar = bars[bars.length - 1];
        const orderflow = await adapter.fetchOrderflow('BTC');
        const volatility = await adapter.fetchVolatilityMetrics('BTC');
        const macro = await adapter.fetchMacroIndicators();

        const bundle = assembleBundle({
            bar, orderflow, volatility, macro,
            swings: [], trend: 'RANGE',
            internalSwings: [], externalSwings: [],
            fvg: [], stopClusters: [], liqShelves: [],
            sessionType: 'NEWYORK', sessionVolatilityPattern: 0.5,
        }, 1, rollingStats);

        // Run 1
        const orchestrator1 = new PipelineOrchestrator();
        const result1 = await orchestrator1.run(bundle);

        // Run 2 — fresh orchestrator, same bundle
        const orchestrator2 = new PipelineOrchestrator();
        const result2 = await orchestrator2.run(bundle);

        // Deterministic outputs must match (excluding timestamps and durationMs)
        expect(result1.context.globalStress).toBe(result2.context.globalStress);
        expect(result1.context.macroBias).toBe(result2.context.macroBias);
        expect(result1.context.volatilityRegime).toBe(result2.context.volatilityRegime);
        expect(result1.decision.scoring.probability).toBe(result2.decision.scoring.probability);
        expect(result1.decision.risk.hardReject).toBe(result2.decision.risk.hardReject);
        expect(result1.decision.state.state).toBe(result2.decision.state.state);
    });

    it('processes multiple candles in strict chronological order', async () => {
        const adapter = new MockAdapter();
        const orchestrator = new PipelineOrchestrator();
        const rollingStats: RollingStats = {
            rollingMeanVolume: 500, rollingATR: 200,
            rollingDeltaStd: 10, atrPercentile: 0.5,
            bandwidth: 0.04, previousCvd: 0,
        };

        const bars = await adapter.fetchOHLCV('BTC', '1m', 10);
        const orderflow = await adapter.fetchOrderflow('BTC');
        const volatility = await adapter.fetchVolatilityMetrics('BTC');
        const macro = await adapter.fetchMacroIndicators();

        const seqs: number[] = [];
        for (let i = 0; i < bars.length; i++) {
            const bundle = assembleBundle({
                bar: bars[i], orderflow, volatility, macro,
                swings: [], trend: 'RANGE',
                internalSwings: [], externalSwings: [],
                fvg: [], stopClusters: [], liqShelves: [],
                sessionType: 'NEWYORK', sessionVolatilityPattern: 0.5,
            }, i + 1, rollingStats);

            const result = await orchestrator.run(bundle);
            seqs.push(result.bundleSeq);
        }

        // Sequence numbers must be strictly increasing
        for (let i = 1; i < seqs.length; i++) {
            expect(seqs[i]).toBeGreaterThan(seqs[i - 1]);
        }
    });
});
