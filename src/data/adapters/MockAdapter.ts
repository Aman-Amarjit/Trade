// MockAdapter — deterministic mock adapter for testing
// Requirements: 8.3

import type {
    DataAdapter,
    OHLCVBar,
    OrderflowSnapshot,
    VolumeProfile,
    VolatilityMetrics,
    MacroIndicators,
    DerivativesData,
    SessionData,
} from './DataAdapter.js';

/**
 * Deterministic mock adapter.
 * Returns fixed data based on input parameters — no randomness.
 * Suitable for unit tests and property-based tests.
 */
export class MockAdapter implements DataAdapter {
    async fetchOHLCV(_symbol: string, _timeframe: string, limit: number): Promise<OHLCVBar[]> {
        const bars: OHLCVBar[] = [];
        const baseTime = new Date('2024-01-01T00:00:00.000Z').getTime();
        for (let i = 0; i < limit; i++) {
            const open = 50000 + i * 10;
            const close = open + 50;
            const high = close + 25;
            const low = open - 25;
            bars.push({
                timestamp: new Date(baseTime + i * 60_000).toISOString(),
                open,
                high,
                low,
                close,
                volume: 500,
            });
        }
        return bars;
    }

    async fetchOrderflow(_symbol: string): Promise<OrderflowSnapshot> {
        return {
            timestamp: '2024-01-01T00:00:00.000Z',
            bid: 250,
            ask: 250,
            delta: 0,
            cvd: 0,
        };
    }

    async fetchVolumeProfile(_symbol: string, _timeframe: string): Promise<VolumeProfile> {
        return {
            timestamp: '2024-01-01T00:00:00.000Z',
            levels: [
                { price: 49900, volume: 200 },
                { price: 50000, volume: 500 },
                { price: 50100, volume: 200 },
            ],
            poc: 50000,
            vah: 50100,
            val: 49900,
        };
    }

    async fetchVolatilityMetrics(_symbol: string): Promise<VolatilityMetrics> {
        return {
            timestamp: '2024-01-01T00:00:00.000Z',
            atr: 200,
            atrPercentile: 0.5,
            bandwidth: 0.04,
            historicalVolatility: 0.5,
        };
    }

    async fetchMacroIndicators(): Promise<MacroIndicators> {
        return {
            timestamp: '2024-01-01T00:00:00.000Z',
            dxy: 100,
            vix: 20,
            spx: 5000,
            gold: 2000,
            sentiment: 0.5,
            fundingRate: 0.0001,
            etfFlows: 0,
        };
    }

    async fetchDerivativesData(_symbol: string): Promise<DerivativesData> {
        return {
            timestamp: '2024-01-01T00:00:00.000Z',
            openInterest: 1_000_000,
            fundingRate: 0.0001,
            liquidationLevels: [
                { price: 48000, size: 5_000_000, side: 'LONG' },
                { price: 52000, size: 5_000_000, side: 'SHORT' },
            ],
        };
    }

    async fetchSessionData(timestamp: string): Promise<SessionData> {
        return {
            timestamp,
            sessionType: 'NEWYORK',
            volatilityPattern: 0.5,
        };
    }
}
