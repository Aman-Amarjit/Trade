// useLiveAnalysis — polls /api/v1/analysis/live and commits to liveStore
// Requirements: 21.3, 21.4, 21.5, 21.6, 30.5

import { useEffect, useRef } from 'react';
import { useLiveStore } from '../state/liveStore';
import type { LiveAnalysisResponse } from '../types/index';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const POLL_INTERVAL_MS = 1500; // 1.5 seconds (configurable)

export function useLiveAnalysis(symbol: string, timeframe: string, token: string): void {
    const { setLiveData, incrementFailures, addAlert, isReplayMode } = useLiveStore();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;

        async function poll(): Promise<void> {
            if (!mountedRef.current) return;

            const endpoint = isReplayMode
                ? `${API_BASE}/replay/step`
                : `${API_BASE}/analysis/live?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`;

            const method = isReplayMode ? 'POST' : 'GET';

            try {
                const res = await fetch(endpoint, {
                    method,
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (!res.ok) {
                    incrementFailures();
                } else {
                    const data = (await res.json()) as LiveAnalysisResponse;
                    setLiveData({
                        prediction: data.prediction,
                        risk: data.risk,
                        state: data.state,
                        liquidity: data.liquidity,
                        geometry: data.geometry,
                        microstructure: data.microstructure,
                        timestamp: data.timestamp,
                    });

                    if (data.degraded && data.failedEngines?.length) {
                        // Only add if not already showing a degraded alert
                        const existing = useLiveStore.getState().alerts.find(a => a.message.startsWith('Pipeline degraded'));
                        if (!existing) {
                            addAlert({
                                message: `Pipeline degraded — failed engines: ${data.failedEngines.join(', ')}`,
                                severity: 'warning',
                                timestamp: data.timestamp,
                                expiresAt: Date.now() + 10_000,
                            });
                        }
                    }
                }
            } catch {
                incrementFailures();
            }

            if (mountedRef.current) {
                timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
            }
        }

        poll();

        return () => {
            mountedRef.current = false;
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [symbol, timeframe, token, isReplayMode]);
}

