// LiveAnalysisPage — orchestrates data flow via useLiveAnalysis hook
// Requirements: 21.1–21.6, 12.8, 9.9

import React, { useState } from 'react';
import { useLiveAnalysis } from '../hooks/useLiveAnalysis';
import { useLiveStore } from '../state/liveStore';
import { PredictionGraph } from '../components/PredictionGraph';
import { SliderPanel } from '../components/SliderPanel';
import { LiquidityMapPanel } from '../components/LiquidityMapPanel';
import { GeometryPanel } from '../components/GeometryPanel';
import { MicrostructurePanel } from '../components/MicrostructurePanel';
import { AlertsPanel } from '../components/AlertsPanel';
import { ReplayPanel } from '../components/ReplayPanel';
import { DashboardPanel } from '../components/DashboardPanel';

const SYMBOLS = (import.meta.env.VITE_SYMBOLS ?? import.meta.env.VITE_DEFAULT_SYMBOL ?? 'BTC-USDT')
    .split(',').map((s: string) => s.trim()).filter(Boolean);
const TIMEFRAME = import.meta.env.VITE_DEFAULT_TIMEFRAME ?? '1m';
const TOKEN = import.meta.env.VITE_API_TOKEN ?? '';

const STRESS_PILL: Record<string, string> = {
    SAFE: 'pill-green', CAUTION: 'pill-yellow', HALT: 'pill-red',
};
const REGIME_PILL: Record<string, string> = {
    LOW: 'pill-accent', NORMAL: 'pill-accent', HIGH: 'pill-yellow', EXTREME: 'pill-red',
};

export function LiveAnalysisPage(): React.ReactElement {
    const [activeSymbol, setActiveSymbol] = useState(SYMBOLS[0] ?? 'BTC-USDT');
    const clearData = useLiveStore(s => s.clearData);
    const setStoreActiveSymbol = useLiveStore(s => s.setActiveSymbol);

    React.useEffect(() => { setStoreActiveSymbol(SYMBOLS[0] ?? 'BTC-USDT'); }, []);

    const handleSelectSymbol = (sym: string) => {
        if (sym === activeSymbol) return;
        setStoreActiveSymbol(sym);
        clearData();
        setActiveSymbol(sym);
    };

    useLiveAnalysis(activeSymbol, TIMEFRAME, TOKEN);

    const isStale = useLiveStore(s => s.isStale);
    const lastUpdated = useLiveStore(s => s.lastUpdated);
    const isReplayMode = useLiveStore(s => s.isReplayMode);
    const prediction = useLiveStore(s => s.prediction);
    const risk = useLiveStore(s => s.risk);
    const state = useLiveStore(s => s.state);

    // Key metrics for sticky header
    const alignScore = prediction ? (prediction.smoothed * 100).toFixed(1) + '%' : '—';
    const alignClass = prediction
        ? prediction.smoothed >= 0.7 ? 'pill-green' : prediction.smoothed >= 0.4 ? 'pill-yellow' : 'pill-red'
        : '';
    const stressClass = risk ? (STRESS_PILL[risk.globalStress] ?? '') : '';
    const regimeClass = risk ? (REGIME_PILL[risk.volatilityRegime] ?? '') : '';
    const stateLabel = state?.state === 'IN_TRADE' ? 'HIGH ALIGN'
        : state?.state === 'WAITING_FOR_RETEST' ? 'WAITING'
            : state?.state ?? '—';

    return (
        <main className="hud-layout" role="main">
            <header className="hud-header">
                <span className="hud-title">Analytical HUD</span>
                <div className="hud-header-divider" />

                {/* Symbol selector */}
                <div className="symbol-tabs" role="tablist" aria-label="Asset selector">
                    {SYMBOLS.map((sym: string) => (
                        <button
                            key={sym}
                            role="tab"
                            aria-selected={sym === activeSymbol}
                            className={`symbol-tab ${sym === activeSymbol ? 'active' : ''}`}
                            onClick={() => handleSelectSymbol(sym)}
                        >
                            {sym}
                        </button>
                    ))}
                </div>

                <span className="hud-timeframe">{TIMEFRAME}</span>
                <div className="hud-header-divider" />

                {/* Sticky key metrics */}
                <div className="hud-key-metrics">
                    {prediction && (
                        <div className={`hud-metric-pill ${alignClass}`}>
                            <span className="pill-label">Align</span>
                            <span className="pill-value">{alignScore}</span>
                        </div>
                    )}
                    {risk && (
                        <>
                            <div className={`hud-metric-pill ${stressClass}`}>
                                <span className="pill-label">Stress</span>
                                <span className="pill-value">{risk.globalStress}</span>
                            </div>
                            <div className={`hud-metric-pill ${regimeClass}`}>
                                <span className="pill-label">Vol</span>
                                <span className="pill-value">{risk.volatilityRegime}</span>
                            </div>
                        </>
                    )}
                    {state && (
                        <div className={`hud-metric-pill ${state.state === 'IN_TRADE' ? 'pill-green' : state.state === 'IDLE' ? '' : 'pill-yellow'}`}>
                            <span className="pill-label">State</span>
                            <span className="pill-value">{stateLabel}</span>
                        </div>
                    )}
                </div>

                {isReplayMode && <span className="replay-indicator">⏮ Replay</span>}
                {isStale && <span className="stale-indicator" role="alert">⚠ Stale</span>}
                {lastUpdated && (
                    <span className="last-updated">
                        {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                )}
            </header>

            <div className="hud-grid">
                <PredictionGraph />
                <SliderPanel />
                <LiquidityMapPanel />
                <GeometryPanel />
                <MicrostructurePanel />
                <AlertsPanel />
                <div style={{ gridColumn: 'span 2' }}>
                    <DashboardPanel activeSymbol={activeSymbol} onSelectSymbol={handleSelectSymbol} />
                </div>
                <ReplayPanel />
            </div>
        </main>
    );
}
