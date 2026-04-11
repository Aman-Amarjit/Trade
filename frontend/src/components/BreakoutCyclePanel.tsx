// BreakoutCyclePanel — displays range state, RH/RL levels, breakout/retest context
// Engine #15 — BreakoutCycleEngine analytical outputs

import React from 'react';
import { useLiveStore } from '../state/liveStore';

const STATE_COLORS: Record<string, string> = {
    EXPANSION: 'var(--text3)',
    CONTRACTION: 'var(--yellow)',
    BREAKOUT: 'var(--green)',
    RETEST: 'var(--blue)',
};

const STATE_ICONS: Record<string, string> = {
    EXPANSION: '↔',
    CONTRACTION: '⟨⟩',
    BREAKOUT: '⚡',
    RETEST: '🎯',
};

const DIR_COLORS: Record<string, string> = {
    LONG: 'var(--green)',
    SHORT: 'var(--red)',
};

export function BreakoutCyclePanel(): React.ReactElement {
    const breakout = useLiveStore(s => s.breakoutCycle);

    if (!breakout) {
        return (
            <div className="panel breakout-cycle-panel">
                <h2 className="panel-title"><span className="panel-title-icon">⚡</span> Breakout Cycle</h2>
                <span className="no-data">Awaiting data…</span>
            </div>
        );
    }

    const stateColor = STATE_COLORS[breakout.rangeState] ?? 'var(--text3)';
    const stateIcon = STATE_ICONS[breakout.rangeState] ?? '—';
    const rangeSize = breakout.rh > 0 && breakout.rl > 0 ? breakout.rh - breakout.rl : null;

    return (
        <div className="panel breakout-cycle-panel" role="region" aria-label="Breakout Cycle Panel">
            {/* Header with range state badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border2)' }}>
                <h2 className="panel-title" style={{ border: 'none', padding: 0 }}>
                    <span className="panel-title-icon">⚡</span> Breakout Cycle
                </h2>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {breakout.invalidated && (
                        <span className="badge red">✕ INVALIDATED</span>
                    )}
                    <span className="badge" style={{
                        background: stateColor + '18',
                        color: stateColor,
                        borderColor: stateColor + '50',
                    }}>
                        {stateIcon} {breakout.rangeState}
                    </span>
                </div>
            </div>

            {/* Range High / Low */}
            <div style={{ display: 'flex', gap: '6px' }}>
                <div className="stat-card" style={{ flex: 1, borderLeft: '3px solid var(--green)' }}>
                    <span className="stat-label">Range High (RH)</span>
                    <span className="stat-value" style={{ color: 'var(--green)', fontSize: '16px' }}>
                        {breakout.rh > 0 ? breakout.rh.toFixed(2) : '—'}
                    </span>
                </div>
                <div className="stat-card" style={{ flex: 1, borderLeft: '3px solid var(--red)' }}>
                    <span className="stat-label">Range Low (RL)</span>
                    <span className="stat-value" style={{ color: 'var(--red)', fontSize: '16px' }}>
                        {breakout.rl > 0 ? breakout.rl.toFixed(2) : '—'}
                    </span>
                </div>
            </div>

            {/* Range size */}
            {rangeSize !== null && rangeSize > 0 && (
                <div className="metric-row">
                    <span className="label">Range Size</span>
                    <span className="value">{rangeSize.toFixed(2)}</span>
                </div>
            )}

            {/* Breakout direction */}
            {breakout.breakoutDirection && (
                <div className="metric-row">
                    <span className="label">Breakout Direction</span>
                    <span className="badge" style={{
                        background: DIR_COLORS[breakout.breakoutDirection] + '18',
                        color: DIR_COLORS[breakout.breakoutDirection],
                        borderColor: DIR_COLORS[breakout.breakoutDirection] + '50',
                    }}>
                        {breakout.breakoutDirection === 'LONG' ? '▲ LONG' : '▼ SHORT'}
                    </span>
                </div>
            )}

            {/* Breakout level */}
            {breakout.breakoutLevel !== null && (
                <div className="metric-row">
                    <span className="label">Breakout Level</span>
                    <span className="value">{breakout.breakoutLevel.toFixed(2)}</span>
                </div>
            )}

            {/* Retest level */}
            {breakout.retestLevel !== null && (
                <div className="metric-row">
                    <span className="label">Retest Level</span>
                    <span className="value" style={{ color: 'var(--blue)' }}>{breakout.retestLevel.toFixed(2)}</span>
                </div>
            )}

            {/* Conceptual levels — analytical only, not trade signals */}
            {(breakout.entry1 !== null || breakout.entry2 !== null) && (
                <>
                    <div className="section-label" style={{ marginTop: '4px' }}>Conceptual Levels</div>
                    {breakout.entry1 !== null && (
                        <div className="metric-row">
                            <span className="label">Level 1 (Breakout)</span>
                            <span className="value">{breakout.entry1.toFixed(2)}</span>
                        </div>
                    )}
                    {breakout.entry2 !== null && (
                        <div className="metric-row">
                            <span className="label">Level 2 (Retest)</span>
                            <span className="value">{breakout.entry2.toFixed(2)}</span>
                        </div>
                    )}
                    {breakout.stopLoss !== null && (
                        <div className="metric-row">
                            <span className="label">Structural Stop</span>
                            <span className="value" style={{ color: 'var(--red)' }}>{breakout.stopLoss.toFixed(2)}</span>
                        </div>
                    )}
                    {breakout.tp1 !== null && (
                        <div className="metric-row">
                            <span className="label">Target 1 (Range)</span>
                            <span className="value" style={{ color: 'var(--green)' }}>{breakout.tp1.toFixed(2)}</span>
                        </div>
                    )}
                    {breakout.tp2 !== null && (
                        <div className="metric-row">
                            <span className="label">Target 2 (Expansion)</span>
                            <span className="value" style={{ color: 'var(--green)' }}>{breakout.tp2.toFixed(2)}</span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
