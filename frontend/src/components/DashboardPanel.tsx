// DashboardPanel — multi-asset overview (Section 9.9)
// Requirements: 19.5, 9.9
// Refactored to Section 9 Table format: Symbol | Align | Stress | Net Profit | Action

import React, { useEffect, useState } from 'react';

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
    degraded?: boolean;
}

interface DashboardPanelProps {
    activeSymbol?: string;
    onSelectSymbol?: (symbol: string) => void;
}

const STRESS_CLASS: Record<string, string> = {
    SAFE: 'status-green',
    CAUTION: 'status-yellow',
    HALT: 'status-red',
};

const STATE_CLASS: Record<string, string> = {
    IDLE: '',
    WAITING_FOR_RETEST: 'status-yellow',
    IN_TRADE: 'status-green',
    COOLDOWN: 'status-blue',
};

export function DashboardPanel({ activeSymbol, onSelectSymbol }: DashboardPanelProps): React.ReactElement {
    const [summaries, setSummaries] = useState<AssetSummary[]>([]);
    const [lastFetch, setLastFetch] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const refresh = async () => {
            try {
                const res = await fetch(
                    `${API_BASE}/analysis/dashboard?symbols=${SYMBOLS.join(',')}`,
                    { headers: { Authorization: `Bearer ${TOKEN}` } },
                );
                if (res.ok && isMounted) {
                    const data = await res.json() as AssetSummary[];
                    setSummaries(data);
                    setLastFetch(new Date().toLocaleTimeString());
                }
            } catch { /* silently ignore fetch errors — retry on next interval */ }
        };
        refresh();
        const timer = setInterval(refresh, 5000);
        return () => { isMounted = false; clearInterval(timer); };
    }, []);

    return (
        <div className="panel dashboard-panel-v2" role="region" aria-label="Section 9 Dashboard">
            <div className="panel-title-row">
                <h2 className="panel-title" style={{ border: 'none', padding: 0 }}>
                    <span className="panel-title-icon">📋</span> Multi-Asset Summary
                </h2>
                {lastFetch && <span className="timestamp-badge">LIVESTREAM: {lastFetch}</span>}
            </div>

            <div className="dashboard-table-container">
                <table className="dashboard-table">
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Align</th>
                            <th>Stress</th>
                            <th>Profit (EDD)</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {summaries.length === 0 ? (
                            <tr><td colSpan={5} className="no-data-cell">Awaiting stream data...</td></tr>
                        ) : (
                            summaries.map(s => {
                                const isActive = s.symbol === activeSymbol;
                                const prob = s.probability ?? 0;
                                const probClass = prob >= 80 ? 'status-green' : prob >= 50 ? 'status-yellow' : 'status-red';
                                
                                return (
                                    <tr 
                                        key={s.symbol} 
                                        className={isActive ? 'active-row' : ''}
                                        onClick={() => onSelectSymbol?.(s.symbol)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td className="cell-symbol">
                                            <div className="symbol-with-dot">
                                                <div className={`status-dot ${s.degraded ? 'degraded' : 'active'}`} />
                                                {s.symbol}
                                            </div>
                                        </td>
                                        <td className={`cell-align ${probClass}`}>
                                            <div className="align-box">
                                                <div className="align-bar" style={{ width: `${prob}%` }} />
                                                <span>{prob.toFixed(1)}%</span>
                                            </div>
                                        </td>
                                        <td className="cell-stress">
                                            <span className={`status-pill ${STRESS_CLASS[s.globalStress ?? ''] ?? ''}`}>
                                                {s.globalStress ?? '—'}
                                            </span>
                                        </td>
                                        <td className="cell-profit">
                                            {s.expectedMove != null ? `${s.expectedMove.toFixed(2)}%` : '—'}
                                        </td>
                                        <td className="cell-action">
                                            <span className={`action-pill ${STATE_CLASS[s.state ?? ''] ?? ''}`}>
                                                {s.state?.replace(/_/g, ' ') ?? 'IDLE'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
