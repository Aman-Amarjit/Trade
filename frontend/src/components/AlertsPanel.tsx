// Alerts Panel
// Requirements: 27.1–27.4, 30.5, 1.2, 1.4

import React, { useEffect } from 'react';
import { useLiveStore } from '../state/liveStore';

export function AlertsPanel(): React.ReactElement {
    const alerts = useLiveStore(s => s.alerts);
    const isStale = useLiveStore(s => s.isStale);
    const isReplayMode = useLiveStore(s => s.isReplayMode);
    const state = useLiveStore(s => s.state);
    const risk = useLiveStore(s => s.risk);
    const expireAlerts = useLiveStore(s => s.expireAlerts);

    // Expire alerts periodically
    useEffect(() => {
        const timer = setInterval(expireAlerts, 1000);
        return () => clearInterval(timer);
    }, [expireAlerts]);

    return (
        <div className="panel alerts-panel" role="region" aria-label="Alerts Panel">
            <h2 className="panel-title">Alerts</h2>

            {isReplayMode && (
                <div className="replay-indicator" role="status">
                    Replay Mode Active
                </div>
            )}

            {isStale && (
                <div className="alert critical" role="alert">
                    Stale data — connection to API lost (3+ consecutive failures)
                </div>
            )}

            {risk?.hardReject && (
                <div className="alert warning" role="alert">
                    Alignment rejected — {risk.rejectReasons[0]}
                </div>
            )}

            {state && state.state !== 'IDLE' && (
                <div className="alert info" role="status">
                    System state: {state.state} — {state.reason}
                </div>
            )}

            {alerts.length === 0 && !isStale && (
                <span className="no-data">No active alerts</span>
            )}

            <div className="alerts-list">
                {alerts.map(alert => (
                    <div key={alert.id} className={`alert ${alert.severity}`} role="alert">
                        <span className="alert-time">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                        <span className="alert-message">{alert.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

