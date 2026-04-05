// Prediction Graph Panel
// Requirements: 22.1, 22.2, 22.3, 22.4, 1.2, 1.4

import React from 'react';
import { useLiveStore } from '../state/liveStore';
import { PredictionChart } from './PredictionChart';

const pct = (v: number | null | undefined) =>
    v != null ? `${(v * 100).toFixed(1)}%` : '—';

const fmt4 = (v: number | null | undefined) =>
    v != null ? v.toFixed(4) : '—';

export function PredictionGraph(): React.ReactElement {
    const prediction = useLiveStore(s => s.prediction);
    const liquidity = useLiveStore(s => s.liquidity);

    if (!prediction) {
        return (
            <div className="panel prediction-graph">
                <div className="panel-title">Prediction</div>
                <span className="no-data">Awaiting data…</span>
            </div>
        );
    }

    const { strictLine, smoothed, min, max, band50, band80, band95, liquidityBias, decayed } = prediction;

    return (
        <div className="panel prediction-graph" role="region" aria-label="Prediction Graph">
            <div className="panel-title">Prediction</div>

            <PredictionChart />

            <div className="stat-grid">
                <div className="stat-card">
                    <span className="stat-label">Strict Line</span>
                    <span className="stat-value accent">{pct(strictLine)}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Smoothed</span>
                    <span className="stat-value">{pct(smoothed)}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Decayed Value</span>
                    <span className="stat-value muted">{pct(decayed)}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Liquidity Bias</span>
                    <span className="stat-value yellow">{fmt4(liquidityBias)}</span>
                </div>
            </div>

            <div className="section-label">Prediction Zone</div>
            <div className="metric-row">
                <span className="label">Min / Max</span>
                <span className="value">{pct(min)} – {pct(max)}</span>
            </div>

            <div className="section-label">Confidence Bands</div>
            <div className="band-list">
                <div className="band-item">
                    <span className="band-pct">95%</span>
                    <div className="band-bar-track">
                        <div className="band-bar-fill band-95-fill"
                            style={{ marginLeft: `${band95[0] * 100}%`, width: `${Math.max(0, band95[1] - band95[0]) * 100}%` }} />
                    </div>
                    <span className="band-val">{pct(band95[0])} – {pct(band95[1])}</span>
                </div>
                <div className="band-item">
                    <span className="band-pct">80%</span>
                    <div className="band-bar-track">
                        <div className="band-bar-fill band-80-fill"
                            style={{ marginLeft: `${band80[0] * 100}%`, width: `${Math.max(0, band80[1] - band80[0]) * 100}%` }} />
                    </div>
                    <span className="band-val">{pct(band80[0])} – {pct(band80[1])}</span>
                </div>
                <div className="band-item">
                    <span className="band-pct">50%</span>
                    <div className="band-bar-track">
                        <div className="band-bar-fill band-50-fill"
                            style={{ marginLeft: `${band50[0] * 100}%`, width: `${Math.max(0, band50[1] - band50[0]) * 100}%` }} />
                    </div>
                    <span className="band-val">{pct(band50[0])} – {pct(band50[1])}</span>
                </div>
            </div>

            {liquidity && (
                <div className="metric-row">
                    <span className="label">Liquidity Zones</span>
                    <span className="value">{liquidity.zones.length} zones</span>
                </div>
            )}
        </div>
    );
}
