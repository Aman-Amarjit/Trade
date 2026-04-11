// useLiveAnalysis — polls /api/v1/analysis/live and commits to liveStore
// Requirements: 21.3, 21.4, 21.5, 21.6, 30.5

import { useEffect, useRef } from 'react';
import { useLiveStore } from '../state/liveStore';
import type { LiveAnalysisResponse, RangeState } from '../types/index';
import { playBOS, playSweep, playRegimeChange, playStressChange, playCollapseWarning, playRetestZone } from '../utils/sounds';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const POLL_INTERVAL_MS = 1500; // 1.5 seconds (configurable)

export function useLiveAnalysis(symbol: string, timeframe: string, token: string): void {
    const { setLiveData, incrementFailures, addAlert, isReplayMode } = useLiveStore();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);
    // Track previous values to detect changes for alerts (Section 9.8)
    const prevVolatilityRegime = useRef<string | null>(null);
    const prevGlobalStress = useRef<string | null>(null);
    const prevSweep = useRef(false);
    const prevBos = useRef(false);
    const prevRetestZone = useRef(false);
    const prevBreakoutState = useRef<RangeState | null>(null);
    const prevRetestLevel = useRef<number | null>(null);
    const prevInvalidated = useRef(false);
    const prevStopLoss = useRef<number | null>(null);
    const prevTp1 = useRef<number | null>(null);
    const prevTp2 = useRef<number | null>(null);
    const prevClose = useRef<number | null>(null);
    const prevCollapseProb = useRef(0);
    const prevResistantCount = useRef(0);
    const prevHighProbAlert = useRef(false);

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
                    // In replay mode, 501 means no CSV configured — don't spam alerts
                    if (isReplayMode && res.status === 501) {
                        // Stop auto-polling in replay mode — user steps manually via ReplayPanel
                        return;
                    }
                    incrementFailures();
                } else {
                    const data = (await res.json()) as LiveAnalysisResponse;

                    // Reject stale responses — if the symbol changed while this request was in flight,
                    // discard the response so previous asset data never overwrites the new asset
                    const currentActiveSymbol = useLiveStore.getState().activeSymbol;
                    if (!isReplayMode && currentActiveSymbol && currentActiveSymbol !== symbol) {
                        return;
                    }
                    setLiveData({
                        prediction: data.prediction,
                        risk: data.risk,
                        state: data.state,
                        liquidity: data.liquidity,
                        geometry: data.geometry,
                        microstructure: data.microstructure,
                        breakoutCycle: data.breakoutCycle ?? null,
                        scoring: data.scoring,
                        engineRate: data.engineRate ?? null,
                        rejectionRatio: data.rejectionRatio ?? null,
                        dailyDrawdown: data.dailyDrawdown,
                        dailyDrawdownCap: data.dailyDrawdownCap,
                        timestamp: data.timestamp,
                    });

                    // ── Section 9.8 — Specific alert types ──────────────────
                    const ts = data.timestamp;
                    const expire = Date.now() + 8_000;

                    // Sweep detected
                    if (data.microstructure.sweep && !prevSweep.current) {
                        addAlert({ message: 'Sweep detected — liquidity taken beyond swing point', severity: 'info', timestamp: ts, expiresAt: expire });
                        playSweep();
                    }
                    prevSweep.current = data.microstructure.sweep;

                    // BOS confirmed
                    if (data.microstructure.bosDetected && !prevBos.current) {
                        addAlert({ message: 'Break of Structure confirmed', severity: 'info', timestamp: ts, expiresAt: expire });
                        playBOS();
                    }
                    prevBos.current = data.microstructure.bosDetected;

                    // Retest zone available
                    if (data.microstructure.retestZone && !prevRetestZone.current) {
                        addAlert({ message: 'Retest zone available — price inside liquidity zone', severity: 'info', timestamp: ts, expiresAt: expire });
                        playRetestZone();
                    }
                    prevRetestZone.current = data.microstructure.retestZone;

                    const breakout = data.breakoutCycle;
                    if (breakout) {
                        // BREAKOUT DETECTED (Req 13.1)
                        if (breakout.rangeState === 'BREAKOUT' && !breakout.invalidated && prevBreakoutState.current !== 'BREAKOUT') {
                            addAlert({ message: 'BREAKOUT DETECTED', severity: 'info', timestamp: ts, expiresAt: expire });
                        }
                        // RETEST AVAILABLE (Req 13.2)
                        if (breakout.retestLevel != null && !breakout.invalidated && prevRetestLevel.current == null) {
                            addAlert({ message: 'RETEST AVAILABLE', severity: 'info', timestamp: ts, expiresAt: expire });
                        }
                        // STOP LOSS UPDATE (Req 13.3)
                        if (breakout.stopLoss != null && prevStopLoss.current !== breakout.stopLoss && (breakout.rangeState === 'BREAKOUT' || breakout.rangeState === 'RETEST')) {
                            addAlert({ message: 'STOP LOSS UPDATE', severity: 'warning', timestamp: ts, expiresAt: expire });
                        }
                        // TP1 HIT (Req 13.4, 13.5)
                        if (breakout.tp1 != null && prevClose.current != null) {
                            if (breakout.breakoutDirection === 'LONG' && prevClose.current < breakout.tp1 && data.currentPrice >= breakout.tp1) {
                                addAlert({ message: 'TP1 HIT', severity: 'info', timestamp: ts, expiresAt: expire });
                            } else if (breakout.breakoutDirection === 'SHORT' && prevClose.current > breakout.tp1 && data.currentPrice <= breakout.tp1) {
                                addAlert({ message: 'TP1 HIT', severity: 'info', timestamp: ts, expiresAt: expire });
                            }
                        }
                        // TP2 HIT (Req 13.6, 13.7)
                        if (breakout.tp2 != null && prevClose.current != null) {
                            if (breakout.breakoutDirection === 'LONG' && prevClose.current < breakout.tp2 && data.currentPrice >= breakout.tp2) {
                                addAlert({ message: 'TP2 HIT', severity: 'info', timestamp: ts, expiresAt: expire });
                            } else if (breakout.breakoutDirection === 'SHORT' && prevClose.current > breakout.tp2 && data.currentPrice <= breakout.tp2) {
                                addAlert({ message: 'TP2 HIT', severity: 'info', timestamp: ts, expiresAt: expire });
                            }
                        }
                        // BREAKOUT INVALIDATED (Req 13.8)
                        if (breakout.invalidated && !prevInvalidated.current) {
                            addAlert({ message: 'BREAKOUT INVALIDATED', severity: 'critical', timestamp: ts, expiresAt: expire });
                        }
                        prevBreakoutState.current = breakout.rangeState;
                        prevRetestLevel.current = breakout.retestLevel;
                        prevStopLoss.current = breakout.stopLoss;
                        prevTp1.current = breakout.tp1;
                        prevTp2.current = breakout.tp2;
                        prevInvalidated.current = breakout.invalidated;
                    }
                    prevClose.current = data.currentPrice;

                    // Standalone high-probability alert (Req 11.1, 11.2, 11.3)
                    const highProb = data.scoring.probability >= 80 && !data.risk.hardReject;
                    if (highProb && !prevHighProbAlert.current) {
                        addAlert({ message: `High-probability setup detected — ${data.scoring.probability.toFixed(1)}%`, severity: 'info', timestamp: ts, expiresAt: expire });
                    }
                    prevHighProbAlert.current = highProb;

                    // Volatility regime change
                    const newRegime = data.risk.volatilityRegime;
                    if (prevVolatilityRegime.current !== null && prevVolatilityRegime.current !== newRegime) {
                        const severity = newRegime === 'EXTREME' ? 'critical' : newRegime === 'HIGH' ? 'warning' : 'info';
                        addAlert({ message: `Volatility regime changed: ${prevVolatilityRegime.current} → ${newRegime}`, severity, timestamp: ts, expiresAt: expire });
                        playRegimeChange(newRegime === 'EXTREME');
                    }
                    prevVolatilityRegime.current = newRegime;

                    // Stress state change
                    const newStress = data.risk.globalStress;
                    if (prevGlobalStress.current !== null && prevGlobalStress.current !== newStress) {
                        const severity = newStress === 'HALT' ? 'critical' : newStress === 'CAUTION' ? 'warning' : 'info';
                        addAlert({ message: `Global stress changed: ${prevGlobalStress.current} → ${newStress}`, severity, timestamp: ts, expiresAt: expire });
                        playStressChange(newStress === 'HALT');
                    }
                    prevGlobalStress.current = newStress;

                    // Geometry collapse warning
                    const collapseProb = data.geometry.collapseProb ?? 0;
                    if (collapseProb > 0.7 && prevCollapseProb.current <= 0.7) {
                        addAlert({ message: `Geometry collapse warning — collapse probability ${(collapseProb * 100).toFixed(0)}%`, severity: 'warning', timestamp: ts, expiresAt: expire });
                        playCollapseWarning();
                    }
                    prevCollapseProb.current = collapseProb;

                    // Resistant cluster interaction (Section 9.8)
                    const resistantCount = data.liquidity.zones.filter(z => z.type === 'RESISTANT_CLUSTER').length;
                    if (resistantCount > prevResistantCount.current) {
                        addAlert({ message: `Resistant cluster detected — ${resistantCount} overlapping liquidity zone${resistantCount !== 1 ? 's' : ''}`, severity: 'info', timestamp: ts, expiresAt: expire });
                    }
                    prevResistantCount.current = resistantCount;

                    // Pipeline degraded
                    if (data.degraded && data.failedEngines?.length) {
                        const existing = useLiveStore.getState().alerts.find(a => a.message.startsWith('Pipeline degraded'));
                        if (!existing) {
                            addAlert({
                                message: `Pipeline degraded — failed engines: ${data.failedEngines.join(', ')}`,
                                severity: 'warning',
                                timestamp: ts,
                                expiresAt: Date.now() + 10_000,
                            });
                        }
                    }
                }
            } catch {
                incrementFailures();
            }

            if (mountedRef.current) {
                // In replay mode, don't auto-poll — user steps manually via ReplayPanel
                if (!isReplayMode) {
                    timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
                }
            }
        }

        poll();

        return () => {
            mountedRef.current = false;
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [symbol, timeframe, token, isReplayMode, setLiveData, incrementFailures, addAlert]);
}

