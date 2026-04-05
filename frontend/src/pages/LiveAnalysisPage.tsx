// LiveAnalysisPage — orchestrates data flow via useLiveAnalysis hook
// Requirements: 21.1–21.6

import React from 'react';
import { useLiveAnalysis } from '../hooks/useLiveAnalysis';
import { useLiveStore } from '../state/liveStore';
import { PredictionGraph } from '../components/PredictionGraph';
import { SliderPanel } from '../components/SliderPanel';
import { LiquidityMapPanel } from '../components/LiquidityMapPanel';
import { GeometryPanel } from '../components/GeometryPanel';
import { MicrostructurePanel } from '../components/MicrostructurePanel';
import { AlertsPanel } from '../components/AlertsPanel';

const SYMBOL = import.meta.env.VITE_DEFAULT_SYMBOL ?? 'BTC-USDT';
const TIMEFRAME = import.meta.env.VITE_DEFAULT_TIMEFRAME ?? '1m';
const TOKEN = import.meta.env.VITE_API_TOKEN ?? '';

export function LiveAnalysisPage(): React.ReactElement {
    useLiveAnalysis(SYMBOL, TIMEFRAME, TOKEN);

    const isStale = useLiveStore(s => s.isStale);
    const lastUpdated = useLiveStore(s => s.lastUpdated);

    return (
        <main className="hud-layout" role="main">
            <header className="hud-header">
                <span className="hud-title">Analytical HUD — {SYMBOL} {TIMEFRAME}</span>
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
            </div>
        </main>
    );
}

