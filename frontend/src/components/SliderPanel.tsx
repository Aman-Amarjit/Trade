// Slider Panel — probability, EDD, ranges, weight sliders
// Requirements: 23.1–23.7

import React, { useState, useCallback } from 'react';
import { useLiveStore } from '../state/liveStore';

const WEIGHT_MIN = 0.05;
const WEIGHT_MAX = 0.60;
const DEFAULT_WEIGHTS = { w1: 0.15, w2: 0.25, w3: 0.15, w4: 0.20, w5: 0.15, w6: 0.10 };
const LABELS = ['G — Geometry', 'L — Liquidity', 'V — Volatility', 'M — Micro', 'O — Orderflow', 'X — Macro'];

type WeightKey = 'w1' | 'w2' | 'w3' | 'w4' | 'w5' | 'w6';
const KEYS: WeightKey[] = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'];

const CONTRIBUTION_ICONS: Record<string, string> = {
    geometry: '📐',
    liquidity: '💧',
    microstructure: '🔬',
    orderflow: '📊',
    volatility: '⚡',
    macro: '🌐',
    session: '🕐',
};

export function SliderPanel(): React.ReactElement {
    const risk = useLiveStore(s => s.risk);
    const scoring = useLiveStore(s => s.scoring);
    const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
    const [showReject, setShowReject] = useState(false);
    const [showWeights, setShowWeights] = useState(false);
    const [showContributions, setShowContributions] = useState(false);

    const handleWeightChange = useCallback((key: WeightKey, raw: number) => {
        const clamped = Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, raw));
        const others = KEYS.filter(k => k !== key);
        const remaining = 1 - clamped;
        const currentOtherSum = others.reduce((s, k) => s + weights[k], 0);
        const newWeights = { ...weights, [key]: clamped };
        if (currentOtherSum > 0) {
            for (const k of others) {
                newWeights[k] = (weights[k] / currentOtherSum) * remaining;
                newWeights[k] = Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, newWeights[k]));
            }
        }
        setWeights(newWeights);
    }, [weights]);

    const localStrictLine = risk
        ? KEYS.reduce((sum, k, i) => sum + weights[k] * (risk.probability / 100) * (i + 1) / 6, 0)
        : null;

    return (
        <div className="panel slider-panel" role="region" aria-label="Diagnostics Panel">
            <h2 className="panel-title"><span className="panel-title-icon">⚙️</span> Diagnostics</h2>

            {risk ? (
                <>
                    {/* Probability — single prominent bar */}
                    <div className="prob-bar-container">
                        <div className="prob-bar-label">
                            <span>Probability Score</span>
                            <span style={{
                                fontWeight: 700,
                                color: risk.probability >= 80 ? 'var(--green)'
                                    : risk.probability >= 50 ? 'var(--yellow)' : 'var(--red)',
                            }}>
                                {risk.probability.toFixed(1)}
                            </span>
                        </div>
                        <div className="prob-bar-track">
                            <div
                                className={`prob-bar-fill ${risk.probability >= 80 ? 'high' : risk.probability >= 50 ? 'medium' : 'low'}`}
                                style={{ width: `${risk.probability}%` }}
                            />
                        </div>
                    </div>

                    {/* Status badges */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span className={`badge regime-${risk.volatilityRegime.toLowerCase()}`}>
                            ⚡ {risk.volatilityRegime}
                        </span>
                        <span className={`badge stress-${risk.globalStress.toLowerCase()}`}>
                            {risk.globalStress === 'SAFE' ? '✓' : risk.globalStress === 'HALT' ? '✕' : '⚠'} {risk.globalStress}
                        </span>
                        <span className={`badge ${risk.hardReject ? 'red' : 'green'}`}>
                            {risk.hardReject ? '✕ REJECTED' : '✓ ACCEPTED'}
                        </span>
                    </div>

                    {/* Key metrics */}
                    <div className="metric-row">
                        <span className="label">Expected Drawdown</span>
                        <span className="value">{risk.edd.toFixed(2)} USD</span>
                    </div>
                    <div className="metric-row">
                        <span className="label">Stop Range</span>
                        <span className="value">{risk.stopDistance.toFixed(2)} USD</span>
                    </div>
                    <div className="metric-row">
                        <span className="label">Target Range</span>
                        <span className="value">{risk.targetDistance.toFixed(2)} USD</span>
                    </div>
                    <div className="metric-row">
                        <span className="label">Expected Value</span>
                        <span className="value">{risk.ev.toFixed(2)}</span>
                    </div>

                    {/* Collapsible engine contributions (Section 9.4) */}
                    {scoring && Object.keys(scoring.contributions).length > 0 && (
                        <div>
                            <div
                                className="collapsible-header"
                                onClick={() => setShowContributions(v => !v)}
                                role="button"
                                aria-expanded={showContributions}
                            >
                                <span className="collapsible-label">Engine Contributions</span>
                                <span className={`collapsible-chevron ${showContributions ? 'open' : ''}`}>▼</span>
                            </div>
                            {showContributions && (
                                <div className="collapsible-body" style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    {Object.entries(scoring.contributions).map(([engine, score]) => {
                                        const pct = Math.min(100, Math.max(0, score));
                                        const icon = CONTRIBUTION_ICONS[engine] ?? '●';
                                        const color = pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--yellow)' : 'var(--red)';
                                        return (
                                            <div key={engine} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                                <span style={{ fontSize: '11px', flexShrink: 0 }}>{icon}</span>
                                                <span style={{ fontSize: '10px', color: 'var(--text2)', flex: '0 0 80px', textTransform: 'capitalize' }}>{engine}</span>
                                                <div style={{ flex: 1, height: '3px', background: 'var(--surface4)', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.5s ease' }} />
                                                </div>
                                                <span style={{ fontSize: '10px', color, fontVariantNumeric: 'tabular-nums', flex: '0 0 36px', textAlign: 'right' }}>{pct.toFixed(1)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Collapsible reject reasons */}
                    {risk.hardReject && risk.rejectReasons.length > 0 && (
                        <div>
                            <div
                                className="collapsible-header"
                                onClick={() => setShowReject(v => !v)}
                                role="button"
                                aria-expanded={showReject}
                            >
                                <span className="collapsible-label" style={{ color: 'var(--red)' }}>
                                    ✕ Rejection Reasons ({risk.rejectReasons.length})
                                </span>
                                <span className={`collapsible-chevron ${showReject ? 'open' : ''}`}>▼</span>
                            </div>
                            {showReject && (
                                <div className="reject-reasons" style={{ marginTop: '4px' }}>
                                    <ul>{risk.rejectReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <span className="no-data">Awaiting data…</span>
            )}

            {/* Collapsible weight sliders */}
            <div className="weight-sliders">
                <div
                    className="collapsible-header"
                    onClick={() => setShowWeights(v => !v)}
                    role="button"
                    aria-expanded={showWeights}
                >
                    <span className="collapsible-label">Engine Weights (Local Preview)</span>
                    <span className={`collapsible-chevron ${showWeights ? 'open' : ''}`}>▼</span>
                </div>
                {showWeights && (
                    <div className="collapsible-body" style={{ paddingTop: '8px' }}>
                        <div className="replay-note" style={{ marginBottom: '8px' }}>
                            Sliders adjust a local preview only. Backend weights are fixed at deployment.
                        </div>
                        {KEYS.map((key, i) => (
                            <div key={key} className="weight-row">
                                <label htmlFor={`weight-${key}`}>{LABELS[i]}</label>
                                <input
                                    id={`weight-${key}`}
                                    type="range"
                                    min={WEIGHT_MIN}
                                    max={WEIGHT_MAX}
                                    step={0.01}
                                    value={weights[key]}
                                    onChange={e => handleWeightChange(key, parseFloat(e.target.value))}
                                    aria-label={`Weight for ${LABELS[i]}`}
                                />
                                <span className="weight-value">{weights[key].toFixed(2)}</span>
                            </div>
                        ))}
                        {localStrictLine !== null && (
                            <div className="preview" style={{ marginTop: '8px' }}>
                                <span className="label">Local Preview</span>
                                <span className="value">{(localStrictLine * 100).toFixed(1)}%</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
