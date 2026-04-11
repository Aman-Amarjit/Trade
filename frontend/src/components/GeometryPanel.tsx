// Geometry Panel
// Requirements: 25.1–25.4

import React from 'react';
import { useLiveStore } from '../state/liveStore';

function Gauge({ label, value, highlight }: { label: string; value: number | null; highlight?: boolean }): React.ReactElement {
    const pct = value !== null ? Math.min(100, Math.max(0, Math.abs(value) * 100)) : 0;
    const isDanger = highlight && value !== null && value > 0.8;
    const isHighlight = highlight && value !== null && value > 0.5 && !isDanger;
    
    // Smooth transition style
    const barStyle = {
        width: `${pct}%`,
        background: isDanger ? 'var(--error)' : isHighlight ? 'var(--warning)' : 'var(--accent)',
        boxShadow: isDanger ? '0 0 8px var(--error-glow)' : isHighlight ? '0 0 8px var(--warning-glow)' : '0 0 8px var(--accent-glow)',
    };

    return (
        <div className="gauge">
            <div className="gauge-info" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span className="label" style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                <span className="value" style={{ fontSize: '11px', fontWeight: 600, color: isDanger ? 'var(--error)' : isHighlight ? 'var(--warning)' : 'var(--text)' }}>
                    {value !== null ? `${(value * 100).toFixed(1)}%` : '0.0%'}
                </span>
            </div>
            <div className="gauge-track" style={{ height: '4px', background: 'var(--surface4)', borderRadius: '2px', overflow: 'hidden' }}>
                <div className="gauge-bar" style={{ ...barStyle, height: '100%', borderRadius: '2px', transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
            </div>
        </div>
    );
}

export function GeometryPanel(): React.ReactElement {
    const geometry = useLiveStore(s => s.geometry);

    if (!geometry) {
        return (
            <div className="panel geometry-panel">
                <h2 className="panel-title"><span className="panel-title-icon">📐</span> Geometry</h2>
                <span className="no-data">Initializing Engine...</span>
            </div>
        );
    }


    return (
        <div className="panel geometry-panel" role="region" aria-label="Geometry Panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                <h2 className="panel-title" style={{ border: 'none', padding: 0 }}>
                    <span className="panel-title-icon">📐</span> Structural Geometry
                </h2>
                {geometry.geometryRegime && (
                    <span className={`badge regime-${geometry.geometryRegime.toLowerCase().replace(/_/g, '-')}`} style={{ fontSize: '10px' }}>
                        {geometry.geometryRegime.replace(/_/g, ' ')}
                    </span>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                <Gauge label="Curvature" value={geometry.curvature} />
                <Gauge label="Imbalance" value={geometry.imbalance} />
                <Gauge label="rotation" value={geometry.rotation} />
                
                <div className="panel-divider" style={{ margin: '4px 0' }} />
                
                <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="stat-card" style={{ padding: '10px', background: 'var(--surface2)' }}>
                        <span className="stat-label" style={{ fontSize: '9px' }}>Collapse Prob</span>
                        <span className={`stat-value ${geometry.collapseProb && geometry.collapseProb > 0.7 ? 'red' : ''}`} style={{ fontSize: '18px' }}>
                            {geometry.collapseProb ? `${(geometry.collapseProb * 100).toFixed(1)}%` : '0.0%'}
                        </span>
                    </div>
                    <div className="stat-card" style={{ padding: '10px', background: 'var(--surface2)' }}>
                        <span className="stat-label" style={{ fontSize: '9px' }}>Breakout Prob</span>
                        <span className={`stat-value ${geometry.breakoutProb && geometry.breakoutProb > 0.7 ? 'green' : ''}`} style={{ fontSize: '18px' }}>
                            {geometry.breakoutProb ? `${(geometry.breakoutProb * 100).toFixed(1)}%` : '0.0%'}
                        </span>
                    </div>
                </div>

                <div className="metric-row" style={{ padding: '8px 12px' }}>
                    <span className="label" style={{ fontSize: '12px' }}>Micro State</span>
                    <span className="value" style={{ fontSize: '12px', color: 'var(--accent-light)' }}>{geometry.microState ?? 'STABLE'}</span>
                </div>
                
                <div className={`badge ${geometry.isStable ? 'green' : 'red'}`} style={{ textAlign: 'center', justifyContent: 'center', padding: '6px' }}>
                    {geometry.isStable ? 'POLARITY: STABLE' : 'POLARITY: UNSTABLE'}
                </div>
            </div>
        </div>
    );
}
