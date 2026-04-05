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

export function LiveAnalysisPage(): React.ReactElement {
    const [activeSymbol, setActiveSymbol] = useState(SYMBOLS[0] ?? 'BTC-USDT');
    const clearData = useLiveStore(s => s.clearData);
    const setStoreActiveSymbol = useLiveStore(s => s.setActiveSymbol);

    // Set initial active symbol in store on mount
    React.useEffect(() => {
        setStoreActiveSymbol(SYMBOLS[0] ?? 'BTC-USDT');
    }, []);

    const handleSelectSymbol = (sym: string) => {
        if (sym === activeSymbol) return;
        // Set the active symbol in the store FIRST so the hook rejects in-flight responses
        setStoreActiveSymbol(sym);
        clearData();
        setActiveSymbol(sym);
    };

    useLiveAnalysis(activeSymbol, TIMEFRAME, TOKEN);

    const isStale = useLiveStore(s => s.isStale);
    const lastUpdated = useLiveStore(s => s.lastUpdated);
    const isReplayMode = useLiveStore(s => s.isReplayMode);

    return (
        <main className="hud-layout" role="main">
            <header className="hud-header">
                <span className="hud-title">Analytical HUD</span>

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
                {isReplayMode && <span className="replay-indicator">Replay</span>}
                {isStale && <span className="stale-indicator" role="alert">⚠ Stale Data</span>}
                {lastUpdated && <span className="last-updated">Updated: {new Date(lastUpdated).toLocaleTimeString()}</span>}
            </header>

            <div className="hud-grid">
                <PredictionGraph />
                <SliderPanel />
                <LiquidityMapPanel />
                <GeometryPanel />
                <MicrostructurePanel />
                <AlertsPanel />
                {/* Last row: Dashboard spans 2 cols, Replay spans 1 */}
                <div style={{ gridColumn: 'span 2' }}>
                    <DashboardPanel activeSymbol={activeSymbol} onSelectSymbol={handleSelectSymbol} />
                </div>
                <ReplayPanel />
            </div>
        </main>
    );
}
