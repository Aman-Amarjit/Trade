// Unit tests for useLiveAnalysis hook
// Requirements: 21.3–21.6

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLiveStore } from '../state/liveStore';
import { useLiveAnalysis } from './useLiveAnalysis.js';

const mockResponse = {
    symbol: 'BTC-USDT',
    timeframe: '1m',
    prediction: {
        strictLine: 0.5, min: 0, max: 1,
        band50: [0.25, 0.75] as [number, number],
        band80: [0.1, 0.9] as [number, number],
        band95: [0.05, 0.95] as [number, number],
        liquidityBias: 0, volatilityAdjustment: 0,
        smoothed: 0.5, decayed: 0.5,
        timestamp: new Date().toISOString(),
    },
    risk: {
        edd: 0, stopDistance: 0, targetDistance: 0, ev: 0,
        probability: 85, volatilityRegime: 'NORMAL' as const,
        globalStress: 'SAFE' as const, geometryStable: true,
        microstructureComplete: true, hardReject: false, rejectReasons: [],
    },
    state: {
        state: 'IDLE' as const, previousState: null,
        timestamp: new Date().toISOString(), reason: 'test',
        cooldownRemaining: 0, alignmentScore: 0,
    },
    liquidity: {
        zones: [],
        premiumZone: [0, 0] as [number, number],
        discountZone: [0, 0] as [number, number],
        structureBounds: [0, 0] as [number, number],
    },
    geometry: {
        curvature: null, imbalance: null, rotation: null,
        structurePressure: null, rotationPressure: null,
        collapseProb: null, breakoutProb: null,
        geometryRegime: null, microState: null, isStable: false,
    },
    microstructure: {
        sweep: false, divergence: false, cvdDivergence: false,
        bosDetected: false, retestZone: false,
        htfAlignment: false, alignmentScore: 0,
    },
    timestamp: new Date().toISOString(),
};

describe('useLiveAnalysis', () => {
    beforeEach(() => {
        useLiveStore.setState({
            consecutiveFailures: 0,
            isStale: false,
            prediction: null,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('increments consecutiveFailures on API failure', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

        const { unmount } = renderHook(() => useLiveAnalysis('BTC-USDT', '1m', 'test-token'));

        await waitFor(() => {
            expect(useLiveStore.getState().consecutiveFailures).toBeGreaterThan(0);
        }, { timeout: 3000 });

        unmount();
    });

    it('sets isStale after 3 consecutive failures', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

        const { unmount } = renderHook(() => useLiveAnalysis('BTC-USDT', '1m', 'test-token'));

        await waitFor(() => {
            expect(useLiveStore.getState().isStale).toBe(true);
        }, { timeout: 10000 });

        unmount();
    });

    it('resets failures and updates store on successful response', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        }));

        useLiveStore.setState({ consecutiveFailures: 2, isStale: false });

        const { unmount } = renderHook(() => useLiveAnalysis('BTC-USDT', '1m', 'test-token'));

        await waitFor(() => {
            expect(useLiveStore.getState().prediction).not.toBeNull();
        }, { timeout: 3000 });

        unmount();
        expect(useLiveStore.getState().consecutiveFailures).toBe(0);
    });
});
