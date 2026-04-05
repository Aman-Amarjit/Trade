// Microstructure Panel
// Requirements: 26.1–26.4

import React from 'react';
import { useLiveStore } from '../state/liveStore';

function Badge({ label, active }: { label: string; active: boolean }): React.ReactElement {
    return (
        <span className={`badge microstructure-badge ${active ? 'active' : 'inactive'}`} aria-label={`${label}: ${active ? 'detected' : 'not detected'}`}>
            {label}
        </span>
    );
}

export function MicrostructurePanel(): React.ReactElement {
    const microstructure = useLiveStore(s => s.microstructure);

    if (!microstructure) {
        return <div className="panel microstructure-panel"><span className="no-data">No microstructure data</span></div>;
    }

    const { sweep, divergence, cvdDivergence, bosDetected, retestZone, htfAlignment, alignmentScore } = microstructure;

    return (
        <div className="panel microstructure-panel" role="region" aria-label="Microstructure Panel">
            <h2 className="panel-title">Microstructure</h2>

            <div className="badges-row">
                <Badge label="Sweep" active={sweep} />
                <Badge label="Divergence" active={divergence} />
                <Badge label="CVD Divergence" active={cvdDivergence} />
                <Badge label="BOS" active={bosDetected} />
                <Badge label="Retest Zone" active={retestZone} />
                <Badge label="HTF Alignment" active={htfAlignment} />
            </div>

            <div className="metric-row">
                <span className="label">Alignment Score</span>
                <div className="alignment-bar-container">
                    <div className="alignment-bar" style={{ width: `${alignmentScore * 100}%` }} />
                </div>
                <span className="value">{alignmentScore.toFixed(2)}</span>
            </div>
        </div>
    );
}

