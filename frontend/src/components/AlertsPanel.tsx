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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                <h2 className="panel-title" style={{ border: 'none', padding: 0 }}>
                    <span className="panel-title-icon">🔔</span> Status Notifications
                </h2>
                {alerts.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <span className="badge red" style={{ borderRadius: '20px', padding: '2px 8px' }}>{alerts.length}</span>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                {isReplayMode && (
                    <div className="replay-indicator" role="status" style={{ alignSelf: 'flex-start', background: 'var(--accent-dim)', color: 'var(--accent-light)', border: '1px solid var(--accent)', padding: '4px 12px' }}>
                        ⏮ REPLAY ACTIVE
                    </div>
                )}

                {isStale && (
                    <div className="alert critical" role="alert" style={{ background: 'var(--error-dim)', border: '1px solid var(--error)', padding: '10px 14px' }}>
                        <span className="alert-time" style={{ color: 'var(--error)', fontWeight: 700 }}>{SEVERITY_ICONS.critical}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text)' }}>API Connection Lost (Retrying...)</span>
                    </div>
                )}

                {risk?.hardReject && (
                    <div className="alert warning" role="alert" style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning)', padding: '10px 14px' }}>
                        <span className="alert-time" style={{ color: 'var(--warning)', fontWeight: 700 }}>{SEVERITY_ICONS.warning}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text)' }}>REJECT: {risk.rejectReasons[0]}</span>
                    </div>
                )}

                {state && state.state !== 'IDLE' && (
                    <div className="alert info" role="status" style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', padding: '10px 14px' }}>
                        <span className="alert-time" style={{ color: 'var(--accent-light)', fontWeight: 700 }}>{SEVERITY_ICONS.info}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text)' }}>
                            {STATE_LABELS[state.state] ?? state.state} — {state.reason}
                        </span>
                    </div>
                )}

                {!hasContent && (
                    <div style={{ textAlign: 'center', padding: '24px', opacity: 0.4 }}>
                        <span className="no-data" style={{ padding: 0 }}>System Monitor Clear</span>
                    </div>
                )}

                <div className="alerts-list" style={{ gap: '6px' }}>
                    {alerts.map(alert => (
                        <div key={alert.id} className={`alert ${alert.severity}`} role="alert" style={{ 
                            padding: '10px 14px',
                            background: alert.severity === 'critical' ? 'var(--error-dim)' : alert.severity === 'warning' ? 'var(--warning-dim)' : 'var(--accent-dim)',
                            border: `1px solid ${alert.severity === 'critical' ? 'var(--error)' : alert.severity === 'warning' ? 'var(--warning)' : 'var(--accent)'}`,
                            boxShadow: 'var(--shadow-premium)'
                        }}>
                            <span className="alert-time" style={{ fontWeight: 700 }}>{SEVERITY_ICONS[alert.severity] ?? 'ℹ'}</span>
                            <span style={{ flex: 1, fontSize: '11px' }}>{alert.message}</span>
                            <span className="alert-time" style={{ fontSize: '9px', opacity: 0.6 }}>{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
