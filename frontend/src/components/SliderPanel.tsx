// Slider Panel — probability, EDD, ranges, weight sliders
// Requirements: 23.1–23.7, 1.2, 1.4

import React, { useState, useCallback } from 'react';
import { useLiveStore } from '../state/liveStore';

const WEIGHT_MIN = 0.05;
const WEIGHT_MAX = 0.60;
const DEFAULT_WEIGHTS = { w1: 0.15, w2: 0.25, w3: 0.15, w4: 0.20, w5: 0.15, w6: 0.10 };
const LABELS = ['G (Geometry)', 'L (Liquidity)', 'V (Volatility)', 'M (Micro)', 'O (Orderflow)', 'X (Macro)'];

type WeightKey = 'w1' | 'w2' | 'w3' | 'w4' | 'w5' | 'w6';
const KEYS: WeightKey[] = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'];

export function SliderPanel(): React.ReactElement {
    const risk = useLiveStore(s => s.risk);
    const [weights, setWeights] = useState(DEFAULT_WEIGHTS);

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
        <div className="panel slider-panel" role="region" aria-label="Probability and Range Panel">
            <h2 className="panel-title">Diagnostics</h2>

            {risk ? (
                <>
                    <div className="prob-bar-container">
                        <div className="prob-bar-label">
                            <span>Probability</span>
                            <span style={{ fontWeight: 700, color: risk.probability >= 80 ? 'var(--green)' : risk.probability >= 50 ? 'var(--yellow)' : 'var(--red)' }}>
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
                    <div className="metric-row">
                        <span className="label">Expected Drawdown (USD)</span>
                        <span className="value">{risk.edd.toFixed(2)}</span>
                    </div>
                    <div className="metric-row">
                        <span className="label">Conceptual Stop Range (USD)</span>
                        <span className="value">{risk.stopDistance.toFixed(2)}</span>
                    </div>
                    <div className="metric-row">
                        <span className="label">Conceptual Target Range (USD)</span>
                        <span className="value">{risk.targetDistance.toFixed(2)}</span>
                    </div>
                    <div className="metric-row">
                        <span className="label">Expected Value</span>
                        <span className="value">{risk.ev.toFixed(2)}</span>
                    </div>
                    <div className="metric-row">
                        <span className="label">Volatility Regime</span>
                        <span className={`value badge regime-${risk.volatilityRegime.toLowerCase()}`}>{risk.volatilityRegime}</span>
                    </div>
                    <div className="metric-row">
                        <span className="label">Global Stress</span>
                        <span className={`value badge stress-${risk.globalStress.toLowerCase()}`}>{risk.globalStress}</span>
                    </div>
                    {risk.hardReject && (
                        <div className="reject-reasons">
                            <span className="label">Rejection Reasons</span>
                            <ul>{risk.rejectReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                        </div>
                    )}
                </>
            ) : (
                <span className="no-data">Awaiting data…</span>
            )}

            <div className="weight-sliders">
                <h3>Engine Weights</h3>
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
                    <div className="metric-row preview">
                        <span className="label">Local Preview (StrictLine)</span>
                        <span className="value">{localStrictLine.toFixed(4)}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

