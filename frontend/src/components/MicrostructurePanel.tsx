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
            <h2 className="panel-title"><span className="panel-title-icon">🔬</span> Microstructure</h2>

            {/* Alignment score — prominent */}
            <div style={{
                padding: '10px 14px',
                background: 'var(--surface2)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid var(--border)`,
                borderLeft: `3px solid ${alignColor}`,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
            }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '9px', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '5px' }}>
                        Alignment Score
                    </div>
                    <div className="alignment-bar-container">
                        <div className="alignment-bar" style={{ width: `${alignPct}%`, background: alignColor }} />
                    </div>
                </div>
                <span style={{ fontSize: '20px', fontWeight: 300, color: alignColor, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                    {alignPct}%
                </span>
            </div>

            {/* Signal badges */}
            <div className="badges-row">
                <Badge label="Sweep" active={sweep} />
                <Badge label="Divergence" active={divergence} />
                <Badge label="CVD Div" active={cvdDivergence} />
                <Badge label="BOS" active={bosDetected} />
                <Badge label="Retest" active={retestZone} />
                <Badge label="HTF Align" active={htfAlignment} />
            </div>

            {/* Active signal count */}
            {[sweep, divergence, cvdDivergence, bosDetected, retestZone, htfAlignment].filter(Boolean).length > 0 && (
                <div style={{ fontSize: '10px', color: 'var(--text3)', paddingLeft: '2px' }}>
                    {[sweep, divergence, cvdDivergence, bosDetected, retestZone, htfAlignment].filter(Boolean).length} signal{[sweep, divergence, cvdDivergence, bosDetected, retestZone, htfAlignment].filter(Boolean).length !== 1 ? 's' : ''} active
                </div>
            )}
        </div>
    );
}
