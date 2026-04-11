import React from 'react';
import { useLiveStore } from '../state/liveStore';

export function EngineMonitor(): React.ReactElement {
    const engineRate = useLiveStore(s => s.engineRate);
    const rejectionRatio = useLiveStore(s => s.rejectionRatio);

    const rateColor = (engineRate ?? 0) >= 5 ? 'var(--green)' : (engineRate ?? 0) >= 1 ? 'var(--yellow)' : 'var(--red)';
    const rejectColor = (rejectionRatio ?? 0) <= 20 ? 'var(--green)' : (rejectionRatio ?? 0) <= 50 ? 'var(--yellow)' : 'var(--red)';

    return (
        <div className="panel engine-monitor" role="region" aria-label="Engine Diagnostics">
            <h2 className="panel-title">
                <span className="panel-title-icon">⚡</span> Engine Pipeline
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
                {/* Engine Rate Card */}
                <div className="stat-card" style={{ borderLeft: `3px solid ${rateColor}` }}>
                    <span className="stat-label">Engine Rate</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span className="stat-value" style={{ color: rateColor, fontSize: '24px' }}>
                            {engineRate?.toFixed(1) ?? '—'}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text3)' }}>Hz</span>
                    </div>
                    <div style={{ height: '3px', background: 'var(--surface4)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                        <div 
                            style={{ 
                                width: `${Math.min(100, (engineRate ?? 0) * 10)}%`, 
                                height: '100%', 
                                background: rateColor,
                                transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                            }} 
                        />
                    </div>
                </div>

                {/* Rejection Ratio Card */}
                <div className="stat-card" style={{ borderLeft: `3px solid ${rejectColor}` }}>
                    <span className="stat-label">Rejection Ratio</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span className="stat-value" style={{ color: rejectColor, fontSize: '24px' }}>
                            {rejectionRatio?.toFixed(1) ?? '—'}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text3)' }}>%</span>
                    </div>
                    <div style={{ height: '3px', background: 'var(--surface4)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                        <div 
                            style={{ 
                                width: `${rejectionRatio ?? 0}%`, 
                                height: '100%', 
                                background: rejectColor,
                                transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                            }} 
                        />
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '12px', fontSize: '10px', color: 'var(--text3)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Pipeline health: { (engineRate ?? 0) > 0 ? 'OPTIMAL' : 'INITIALIZING' }</span>
                <span>Uptime: { engineRate ? 'LIVE' : '—' }</span>
            </div>
        </div>
    );
}
