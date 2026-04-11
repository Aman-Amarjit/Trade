// Microstructure Panel
// Requirements: 26.1–26.4

import React from 'react';
import { useLiveStore } from '../state/liveStore';

const BADGE_ICONS: Record<string, string> = {
    Sweep: '🌊',
    Divergence: '↕',
    'CVD Div': '📉',
    BOS: '🔓',
    'Retest': '🎯',
    'HTF Align': '🔗',
};

function Badge({ label, active }: { label: string; active: boolean }): React.ReactElement {
    const icon = BADGE_ICONS[label] ?? '';
    return (
        <span
            className={`badge microstructure-badge ${active ? 'active' : 'inactive'}`}
            aria-label={`${label}: ${active ? 'detected' : 'not detected'}`}
        >
            {icon && <span style={{ marginRight: '3px' }}>{icon}</span>}
            {label}
        </span>
    );
}

export function MicrostructurePanel(): React.ReactElement {
    const microstructure = useLiveStore(s => s.microstructure);

    if (!microstructure) {
        return (
            <div className="panel microstructure-panel">
                <h2 className="panel-title"><span className="panel-title-icon">🔬</span> Microstructure</h2>
                <span className="no-data">No microstructure data</span>
            </div>
        );
    }

    const { sweep, divergence, cvdDivergence, bosDetected, retestZone, htfAlignment, alignmentScore } = microstructure;
    const alignPct = Math.round(alignmentScore * 100);
    const alignColor = alignmentScore >= 0.7 ? 'var(--green)'
        : alignmentScore >= 0.4 ? 'var(--yellow)'
            : 'var(--red)';

    return (
        <div className="panel microstructure-panel" role="region" aria-label="Microstructure Panel">
            <h2 className="panel-title" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                <span className="panel-title-icon">🔬</span> Orderflow Microstructure
            </h2>

            {/* Alignment score — prominent */}
            <div style={{
                padding: '12px 16px',
                background: 'var(--surface2)',
                borderRadius: 'var(--radius)',
                border: `1px solid var(--border)`,
                borderLeft: `4px solid ${alignColor}`,
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                marginTop: '4px',
                boxShadow: 'var(--shadow-premium)',
                transition: 'var(--transition)'
            }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '9px', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>
                        Alignment Confidence
                    </div>
                    <div className="alignment-bar-container" style={{ height: '6px', background: 'var(--surface4)', borderRadius: '3px' }}>
                        <div className="alignment-bar" style={{ 
                            width: `${alignPct}%`, 
                            background: alignColor, 
                            height: '100%', 
                            borderRadius: '3px',
                            boxShadow: `0 0 10px ${alignColor}40`,
                            transition: 'width 1s ease'
                        }} />
                    </div>
                </div>
                <span style={{ fontSize: '22px', fontWeight: 600, color: alignColor, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                    {alignPct}%
                </span>
            </div>

            {/* Signal badges */}
            <div className="badges-row" style={{ marginTop: '8px', gap: '6px' }}>
                <Badge label="Sweep" active={sweep} />
                <Badge label="Divergence" active={divergence} />
                <Badge label="CVD Div" active={cvdDivergence} />
                <Badge label="BOS" active={bosDetected} />
                <Badge label="Retest" active={retestZone} />
                <Badge label="HTF Align" active={htfAlignment} />
            </div>

            {/* Active signal count */}
            {[sweep, divergence, cvdDivergence, bosDetected, retestZone, htfAlignment].filter(Boolean).length > 0 && (
                <div style={{ 
                    fontSize: '10px', 
                    color: 'var(--text3)', 
                    padding: '8px 12px', 
                    background: 'var(--surface4)', 
                    borderRadius: '20px',
                    width: 'fit-content',
                    marginTop: '4px'
                }}>
                    <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>{[sweep, divergence, cvdDivergence, bosDetected, retestZone, htfAlignment].filter(Boolean).length}</span> signals confirmed
                </div>
            )}
        </div>
    );
}
