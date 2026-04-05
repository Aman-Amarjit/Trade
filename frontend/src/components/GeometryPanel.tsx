// Geometry Panel
// Requirements: 25.1–25.4

import React from 'react';
import { useLiveStore } from '../state/liveStore';

const THRESHOLD = 0.7;

function Gauge({ label, value, highlight }: { label: string; value: number | null; highlight?: boolean }): React.ReactElement {
    if (value === null) return <div className="gauge"><span className="label">{label}</span><span className="value">—</span></div>;
    return (
        <div className={`gauge ${highlight && value > THRESHOLD ? 'highlight' : ''}`}>
            <span className="label">{label}</span>
            <div className="gauge-bar" style={{ width: `${Math.min(100, Math.abs(value) * 100)}%` }} />
            <span className="value">{value.toFixed(4)}</span>
        </div>
    );
}

export function GeometryPanel(): React.ReactElement {
    const geometry = useLiveStore(s => s.geometry);

    if (!geometry) {
        return <div className="panel geometry-panel"><span className="no-data">Awaiting data…</span></div>;
    }

    const hasData = geometry.curvature !== null;

    return (
        <div className="panel geometry-panel" role="region" aria-label="Geometry Panel">
            <h2 className="panel-title">Geometry</h2>

            {!hasData ? (
                <span className="no-data">Insufficient data for geometric computation</span>
            ) : (
                <>
                    <Gauge label="Curvature" value={geometry.curvature} />
                    <Gauge label="Imbalance" value={geometry.imbalance} />
                    <Gauge label="Rotation" value={geometry.rotation} />
                    <Gauge label="Structure Pressure" value={geometry.structurePressure} />
                    <Gauge label="Rotation Pressure" value={geometry.rotationPressure} />
                    <Gauge label="Collapse Probability" value={geometry.collapseProb} highlight />
                    <Gauge label="Breakout Probability" value={geometry.breakoutProb} highlight />

                    <div className="metric-row">
                        <span className="label">Geometry Regime</span>
                        <span className={`value badge regime-${geometry.geometryRegime?.toLowerCase().replace('_', '-') ?? 'unknown'}`}>
                            {geometry.geometryRegime ?? '—'}
                        </span>
                    </div>
                    <div className="metric-row">
                        <span className="label">Micro State</span>
                        <span className="value">{geometry.microState ?? '—'}</span>
                    </div>
                    <div className="metric-row">
                        <span className="label">Stable</span>
                        <span className={`value badge ${geometry.isStable ? 'green' : 'red'}`}>
                            {geometry.isStable ? 'Yes' : 'No'}
                        </span>
                    </div>
                </>
            )}
        </div>
    );
}

