// Prediction Graph Panel — rich chart with details
// Requirements: 22.1–22.4

import React, { useState } from 'react';
import { useLiveStore } from '../state/liveStore';
import { PredictionChart } from './PredictionChart';

const pct = (v: number | null | undefined) =>
    v != null ? `${(v * 100).toFixed(1)}%` : '—';

export function PredictionGraph(): React.ReactElement {
    const prediction = useLiveStore(s => s.prediction);
    const liquidity = useLiveStore(s => s.liquidity);
    const breakoutCycle = useLiveStore(s => s.breakoutCycle);
    const [showBands, setShowBands] = useState(true);

    if (!prediction) {
        return (
            <div className="panel prediction-graph">
                <h2 className="panel-title"><span className="panel-title-icon">📊</span> Prediction</h2>
                <span className="no-data">Awaiting data…</span>
            </div>
        );
    }

    const { strictLine, smoothed, decayed, liquidityBias, min, max, band50, band80, band95 } = prediction;

    const alignColor = smoothed >= 0.7 ? 'var(--green)'
        : smoothed >= 0.4 ? 'var(--yellow)'
            : 'var(--red)';

    const alignLabel = smoothed >= 0.7 ? 'HIGH' : smoothed >= 0.4 ? 'MID' : 'LOW';
    const alignBadgeClass = smoothed >= 0.7 ? 'green' : smoothed >= 0.4 ? 'yellow' : 'red';

    return (
        <div className="panel prediction-graph" role="region" aria-label="Prediction Graph">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border2)' }}>
                <h2 className="panel-title" style={{ border: 'none', padding: 0 }}>
                    <span className="panel-title-icon">📊</span> Prediction
                </h2>
                <span className={`badge ${alignBadgeClass}`}>{alignLabel} ALIGNMENT</span>
            </div>

            <PredictionChart />

            {/* Primary score — single prominent display */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                <div className="stat-card" style={{ flex: 2, borderLeft: `3px solid ${alignColor}` }}>
                    <span className="stat-label">Alignment Score</span>
                    <span className="stat-value" style={{ color: alignColor, fontSize: '28px' }}>
                        {pct(smoothed)}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text3)' }}>
                        Raw: {pct(strictLine)} · Decayed: {pct(decayed)}
                    </span>
                </div>
                <div className="stat-card" style={{ flex: 1 }}>
                    <span className="stat-label">Liq Bias</span>
                    <span className="stat-value yellow" style={{ fontSize: '18px' }}>
                        {liquidityBias != null ? liquidityBias.toFixed(3) : '—'}
                    </span>
                </div>
            </div>

            {/* Zone range */}
            <div className="metric-row">
                <span className="label">Min / Max Zone</span>
                <span className="value">{pct(min)} – {pct(max)}</span>
            </div>

            {breakoutCycle && (
                <div className="panel breakout-summary-panel" style={{ margin: '12px 0', padding: '12px', border: '1px solid var(--border2)', borderRadius: '12px', background: 'var(--surface2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span className="stat-label">Range Context</span>
                        <span style={{ fontWeight: 700, color: breakoutCycle.invalidated ? 'var(--red)' : '#00c853' }}>
                            {breakoutCycle.invalidated ? 'INVALIDATED' : breakoutCycle.rangeState}
                        </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                        <div><span className="label">Directional bias</span><br /><strong>{breakoutCycle.breakoutDirection === 'LONG' ? 'Up' : breakoutCycle.breakoutDirection === 'SHORT' ? 'Down' : 'Neutral'}</strong></div>
                        <div><span className="label">Entry 1</span><br /><strong>{breakoutCycle.entry1 ?? '—'}</strong></div>
                        <div><span className="label">Entry 2</span><br /><strong>{breakoutCycle.entry2 ?? '—'}</strong></div>
                        <div><span className="label">Stop loss</span><br /><strong>{breakoutCycle.stopLoss ?? '—'}</strong></div>
                        <div><span className="label">TP1</span><br /><strong>{breakoutCycle.tp1 ?? '—'}</strong></div>
                        <div><span className="label">TP2</span><br /><strong>{breakoutCycle.tp2 ?? '—'}</strong></div>
                        <div><span className="label">Range high</span><br /><strong>{breakoutCycle.rh}</strong></div>
                        <div><span className="label">Range low</span><br /><strong>{breakoutCycle.rl}</strong></div>
                    </div>
                </div>
            )}

            {/* Collapsible volatility envelopes */}
            <div>
                <div
                    className="collapsible-header"
                    onClick={() => setShowBands(v => !v)}
                    role="button"
                    aria-expanded={showBands}
                >
                    <span className="collapsible-label">📉 Volatility Envelopes</span>
                    <span className={`collapsible-chevron ${showBands ? 'open' : ''}`}>▼</span>
                </div>
                {showBands && (
                    <div className="collapsible-body">
                        <div className="band-list" style={{ paddingTop: '4px' }}>
                            {[
                                { label: 'Wide (95%)', band: band95, cls: 'band-95-fill' },
                                { label: 'Mid (80%)', band: band80, cls: 'band-80-fill' },
                                { label: 'Narrow (50%)', band: band50, cls: 'band-50-fill' },
                            ].map(({ label, band, cls }) => (
                                <div className="band-item" key={label}>
                                    <span className="band-pct">{label.split(' ')[0]}</span>
                                    <div className="band-bar-track">
                                        <div
                                            className={`band-bar-fill ${cls}`}
                                            style={{
                                                left: `${band[0] * 100}%`,
                                                width: `${Math.max(0, band[1] - band[0]) * 100}%`,
                                            }}
                                        />
                                    </div>
                                    <span className="band-val">{pct(band[0])} – {pct(band[1])}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {liquidity && (
                <div className="metric-row">
                    <span className="label">💧 Active Zones</span>
                    <span className="value">{liquidity.zones.length}</span>
                </div>
            )}
        </div>
    );
}
