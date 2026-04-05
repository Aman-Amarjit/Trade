// Unit tests for useLiveAnalysis hook
// Requirements: 21.3–21.6

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLiveStore } from '../state/liveStore';
import { useLiveAnalysis } from './useLiveAnalysis.js';

const mockResponse = {
    symbol: 'BTC-USDT',
    timeframe: '1m',
    prediction: { strictLine: 0.5, min: 0, max: 1, band50: [0.25, 0.75] as [number, number], band80: [0.1, 0.9] as [number, number], band95: [0.05, 0.95] as [number, number], liquidityBias: 0, volatilityAdjustment: 0, smoothed: 0.5, decayed: 0.5, timestamp: new Date().toISOString() },
    risk: { edd: 0, stopDistance: 0, targetDistance: 0, ev: 0, probability: 85, volatilityRegime: 'NORMAL' as const, globalStress: 'SAFE' as const, geometryStable: true, microstructureComplete: true, hardReject: false, rejectReasons: [] },
    state: { state: 'IDLE' as const, previousState: null, timestamp: new Date().toISOString(), reason: 'test', cooldownRemaining: 0, alignmentScore: 0 },
    liquidity: { zones: [], premiumZone: [0, 0] as [number, number], discountZone: [0, 0] as [number, number], structureBounds: [0, 0] as [number, number] },
    geometry: { curvature: null, imbalance: null, rotation: null, structurePressure: null, rotationPressure: null, collapseProb: null, breakoutProb: null, geometryRegime: null, microState: null, isStable: false },
    microstructure: { sweep: false, divergence: false, cvdDivergence: false, bosDetected: false, retestZone: false, htfAlignment: false, alignmentScore: 0 },
    timestamp: new Date().toISOString(),
};

describe('useLiveAnalysis', () => {
    beforeEach(() => {
        useLiveStore.setState({
            consecutiveFailures: 0,
            isStale: false,
            prediction: null,
        });
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('increments consecutiveFailures on API failure', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

        renderHook(() => useLiveAnalysis('BTC-USDT', '1m', 'test-token'));

        await act(async () => { await vi.runAllTimersAsync(); });

        expect(useLiveStore.getState().consecutiveFailures).toBeGreaterThan(0);
    });

    it('sets isStale after 3 consecutive failures', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

        renderHook(() => useLiveAnalysis('BTC-USDT', '1m', 'test-token'));

        // Trigger 3 poll cycles
        for (let i = 0; i < 3; i++) {
            await act(async () => { await vi.runAllTimersAsync(); });
        }

        expect(useLiveStore.getState().isStale).toBe(true);
    });

    it('resets failures and updates store on successful response', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        }));

        useLiveStore.setState({ consecutiveFailures: 2, isStale: false });

        renderHook(() => useLiveAnalysis('BTC-USDT', '1m', 'test-token'));

        await act(async () => { await vi.runAllTimersAsync(); });

        const state = useLiveStore.getState();
        expect(state.consecutiveFailures).toBe(0);
        expect(state.prediction).not.toBeNull();
    });
});

