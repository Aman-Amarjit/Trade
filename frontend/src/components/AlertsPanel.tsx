// Alerts Panel
// Requirements: 27.1–27.4, 30.5

import React, { useEffect } from 'react';
import { useLiveStore } from '../state/liveStore';

const STATE_LABELS: Record<string, string> = {
    IDLE: 'IDLE',
    WAITING_FOR_RETEST: 'WAITING',
    IN_TRADE: 'HIGH ALIGNMENT',
    COOLDOWN: 'COOLDOWN',
};

const SEVERITY_ICONS: Record<string, string> = {
    info: 'ℹ',
    warning: '⚠',
    critical: '✕',
};

export function AlertsPanel(): React.ReactElement {
    const alerts = useLiveStore(s => s.alerts);
    const isStale = useLiveStore(s => s.isStale);
    const isReplayMode = useLiveStore(s => s.isReplayMode);
    const state = useLiveStore(s => s.state);
    const risk = useLiveStore(s => s.risk);
    const expireAlerts = useLiveStore(s => s.expireAlerts);

    useEffect(() => {
        const timer = setInterval(expireAlerts, 1000);
        return () => clearInterval(timer);
    }, [expireAlerts]);

    const hasContent = isStale || (risk?.hardReject) || (state && state.state !== 'IDLE') || alerts.length > 0;

    return (
        <div className="panel alerts-panel" role="region" aria-label="Alerts Panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border2)' }}>
                <h2 className="panel-title" style={{ border: 'none', padding: 0 }}>
                    <span className="panel-title-icon">🔔</span> Alerts
                </h2>
                {alerts.length > 0 && (
                    <span className="badge red">{alerts.length}</span>
                )}
            </div>

            {isReplayMode && (
                <div className="replay-indicator" role="status" style={{ alignSelf: 'flex-start' }}>
                    ⏮ Replay Mode Active
                </div>
            )}

            {isStale && (
                <div className="alert critical" role="alert">
                    <span className="alert-time">✕</span>
                    <span>Stale data — connection to API lost (3+ consecutive failures)</span>
                </div>
            )}

            {risk?.hardReject && (
                <div className="alert warning" role="alert">
                    <span className="alert-time">⚠</span>
                    <span>Alignment rejected — {risk.rejectReasons[0]}</span>
                </div>
            )}

            {state && state.state !== 'IDLE' && (
                <div className="alert info" role="status">
                    <span className="alert-time">ℹ</span>
                    <span>State: <strong>{STATE_LABELS[state.state] ?? state.state}</strong> — {state.reason}</span>
                </div>
            )}

            {!hasContent && (
                <span className="no-data">No active alerts</span>
            )}

            <div className="alerts-list">
                {alerts.map(alert => (
                    <div key={alert.id} className={`alert ${alert.severity}`} role="alert">
                        <span className="alert-time">{SEVERITY_ICONS[alert.severity] ?? 'ℹ'}</span>
                        <span style={{ flex: 1 }}>{alert.message}</span>
                        <span className="alert-time">{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
