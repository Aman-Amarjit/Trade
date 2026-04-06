// Geometry Panel
// Requirements: 25.1–25.4

import React from 'react';
import { useLiveStore } from '../state/liveStore';

function Gauge({ label, value, highlight }: { label: string; value: number | null; highlight?: boolean }): React.ReactElement {
    const pct = value !== null ? Math.min(100, Math.abs(value) * 100) : 0;
    const isDanger = highlight && value !== null && value > 0.8;
    const isHighlight = highlight && value !== null && value > 0.5 && !isDanger;
    return (
        <div className={`gauge ${isDanger ? 'danger' : isHighlight ? 'highlight' : ''}`}>
            <span className="label">{label}</span>
            <div className="gauge-track">
                <div className="gauge-bar" style={{ width: `${pct}%` }} />
            </div>
            <span className="value">
                {value !== null ? `${(value * 100).toFixed(1)}%` : '—'}
            </span>
        </div>
    );
}

export function GeometryPanel(): React.ReactElement {
    const geometry = useLiveStore(s => s.geometry);

    if (!geometry) {
        return (
            <div className="panel geometry-panel">
                <h2 className="panel-title"><span className="panel-title-icon">📐</span> Geometry</h2>
                <span className="no-data">Awaiting data…</span>
            </div>
        );
    }

    const hasData = geometry.curvature !== null;

    return (
        <div className="panel geometry-panel" role="region" aria-label="Geometry Panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border2)' }}>
                <h2 className="panel-title" style={{ border: 'none', padding: 0 }}>
                    <span className="panel-title-icon">📐</span> Geometry
                </h2>
                {geometry.geometryRegime && (
                    <span className={`badge regime-${geometry.geometryRegime.toLowerCase().replace(/_/g, '-')}`}>
                        {geometry.geometryRegime.replace(/_/g, ' ')}
                    </span>
                )}
            </div>

            {!hasData ? (
                <span className="no-data">Insufficient data for geometric computation</span>
            ) : (
                <>
                    <Gauge label="Curvature" value={geometry.curvature} />
                    <Gauge label="Imbalance" value={geometry.imbalance} />
                    <Gauge label="Rotation" value={geometry.rotation} />
                    <Gauge label="Structure Pressure" value={geometry.structurePressure} />
                    <Gauge label="Rotation Pressure" value={geometry.rotationPressure} />
                    <Gauge label="Collapse Prob" value={geometry.collapseProb} highlight />
                    <Gauge label="Breakout Prob" value={geometry.breakoutProb} highlight />

                    <div className="metric-row">
                        <span className="label">Micro State</span>
                        <span className="value">{geometry.microState ?? '—'}</span>
                    </div>
                    <div className="metric-row">
                        <span className="label">Stable</span>
                        <span className={`badge ${geometry.isStable ? 'green' : 'red'}`}>
                            {geometry.isStable ? '✓ Stable' : '✕ Unstable'}
                        </span>
                    </div>
                </>
            )}
        </div>
    );
}
