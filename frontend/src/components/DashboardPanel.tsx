// DashboardPanel — multi-asset overview (Section 9.9)
// Requirements: 19.5, 9.9
// Supports asset switching via activeSymbol + onSelectSymbol props

import React, { useEffect, useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const TOKEN = import.meta.env.VITE_API_TOKEN ?? '';

const SYMBOLS = (import.meta.env.VITE_SYMBOLS ?? import.meta.env.VITE_DEFAULT_SYMBOL ?? 'BTC-USDT')
    .split(',').map((s: string) => s.trim()).filter(Boolean);

interface AssetSummary {
    symbol: string;
    available: boolean;
    probability?: number;
    volatilityRegime?: string;
    globalStress?: string;
    state?: string;
    expectedMove?: number;
    timeWindow?: string;
    degraded?: boolean;
    timestamp?: string;
}

interface DashboardPanelProps {
    activeSymbol?: string;
    onSelectSymbol?: (symbol: string) => void;
}

const REGIME_CLASS: Record<string, string> = {
    LOW: 'regime-low',
    NORMAL: 'regime-normal',
    HIGH: 'regime-high',
    EXTREME: 'regime-extreme',
};

const STRESS_CLASS: Record<string, string> = {
    SAFE: 'stress-safe',
    CAUTION: 'stress-caution',
    HALT: 'stress-halt',
};

const STATE_CLASS: Record<string, string> = {
    IDLE: 'state-idle',
    WAITING_FOR_RETEST: 'state-waiting',
    IN_TRADE: 'state-active',
    COOLDOWN: 'state-cooldown',
};

// Display labels for state names — IN_TRADE is shown as "HIGH ALIGNMENT" in the UI
// to reflect its meaning (high signal alignment), while the backend API name is unchanged.
const STATE_LABELS: Record<string, string> = {
    IDLE: 'IDLE',
    WAITING_FOR_RETEST: 'WAITING',
    IN_TRADE: 'HIGH ALIGNMENT',
    COOLDOWN: 'COOLDOWN',
};

export function DashboardPanel({ activeSymbol, onSelectSymbol }: DashboardPanelProps): React.ReactElement {
    const [summaries, setSummaries] = useState<AssetSummary[]>([]);
    const [lastFetch, setLastFetch] = useState<string | null>(null);

    const fetchDashboard = useCallback(async () => {
        try {
            const res = await fetch(
                `${API_BASE}/analysis/dashboard?symbols=${SYMBOLS.join(',')}`,
                { headers: { Authorization: `Bearer ${TOKEN}` } },
            );
            if (res.ok) {
                const data = await res.json() as AssetSummary[];
                setSummaries(data);
                setLastFetch(new Date().toLocaleTimeString());
            }
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchDashboard();
        const timer = setInterval(fetchDashboard, 5000);
        return () => clearInterval(timer);
    }, [fetchDashboard]);

    return (
        <div className="panel dashboard-panel" role="region" aria-label="Multi-Asset Dashboard">
            <div className="panel-title-row">
                <h2 className="panel-title">Multi-Asset Overview</h2>
                {lastFetch && <span className="dashboard-updated">Updated: {lastFetch}</span>}
            </div>

            {summaries.length === 0 ? (
                <span className="no-data">Awaiting dashboard data…</span>
            ) : (
                <div className="dashboard-grid">
                    {summaries.map(s => {
                        const isActive = s.symbol === activeSymbol;
                        return (
                            <div
                                key={s.symbol}
                                className={`dashboard-card ${s.degraded ? 'degraded' : ''} ${isActive ? 'active-asset' : ''}`}
                                onClick={() => onSelectSymbol?.(s.symbol)}
                                role="button"
                                tabIndex={0}
                                aria-pressed={isActive}
                                onKeyDown={e => e.key === 'Enter' && onSelectSymbol?.(s.symbol)}
                                style={{ cursor: onSelectSymbol ? 'pointer' : 'default' }}
                            >
                                <div className="dashboard-symbol-row">
                                    <span className="dashboard-symbol">{s.symbol}</span>
                                    {isActive && <span className="dashboard-active-badge">ACTIVE</span>}
                                </div>

                                {!s.available ? (
                                    <span className="no-data" style={{ fontSize: '11px' }}>No data</span>
                                ) : (
                                    <>
                                        <div className="dashboard-prob">
                                            <span className="dashboard-prob-label">Probability</span>
                                            <div className="dashboard-prob-bar-track">
                                                <div
                                                    className={`dashboard-prob-bar ${(s.probability ?? 0) >= 80 ? 'high' : (s.probability ?? 0) >= 50 ? 'medium' : 'low'}`}
                                                    style={{ width: `${s.probability ?? 0}%` }}
                                                />
                                            </div>
                                            <span className="dashboard-prob-value">{(s.probability ?? 0).toFixed(1)}</span>
                                        </div>

                                        <div className="dashboard-badges">
                                            {s.volatilityRegime && (
                                                <span className={`badge ${REGIME_CLASS[s.volatilityRegime] ?? ''}`}>
                                                    {s.volatilityRegime}
                                                </span>
                                            )}
                                            {s.globalStress && (
                                                <span className={`badge ${STRESS_CLASS[s.globalStress] ?? ''}`}>
                                                    {s.globalStress}
                                                </span>
                                            )}
                                            {s.state && (
                                                <span className={`badge ${STATE_CLASS[s.state] ?? ''}`}>
                                                    {STATE_LABELS[s.state] ?? s.state.replace(/_/g, ' ')}
                                                </span>
                                            )}
                                        </div>

                                        {(s.expectedMove !== undefined || s.timeWindow) && (
                                            <div className="dashboard-meta">
                                                {s.expectedMove !== undefined && (
                                                    <span className="dashboard-meta-item">
                                                        EDD: <strong>{s.expectedMove.toFixed(2)}</strong>
                                                    </span>
                                                )}
                                                {s.timeWindow && (
                                                    <span className="dashboard-meta-item">
                                                        Window: <strong>{s.timeWindow}</strong>
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {s.degraded && (
                                            <span className="dashboard-degraded">⚠ Degraded</span>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
