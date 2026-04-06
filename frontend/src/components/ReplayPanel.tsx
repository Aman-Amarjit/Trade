// ReplayPanel — replay mode controls (step forward/backward, seek)
// Requirements: 12.8, 30.3, 30.6

import React, { useState, useCallback } from 'react';
import { useLiveStore } from '../state/liveStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const TOKEN = import.meta.env.VITE_API_TOKEN ?? '';

export function ReplayPanel(): React.ReactElement {
    const isReplayMode = useLiveStore(s => s.isReplayMode);
    const setReplayMode = useLiveStore(s => s.setReplayMode);
    const setLiveData = useLiveStore(s => s.setLiveData);
    const addAlert = useLiveStore(s => s.addAlert);

    const [candleIndex, setCandleIndex] = useState(0);
    const [seekInput, setSeekInput] = useState('');
    const [loading, setLoading] = useState(false);

    const toggleReplay = useCallback(async () => {
        const newMode = !isReplayMode;
        try {
            await fetch(`${API_BASE}/replay/activate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: newMode }),
            });
        } catch { /* ignore — store still toggles locally */ }
        setReplayMode(newMode);
        if (!newMode) setCandleIndex(0);
    }, [isReplayMode, setReplayMode]);

    const step = useCallback(async () => {
        if (!isReplayMode || loading) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/replay/step`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
            });
            if (res.ok) {
                const data = await res.json() as {
                    candleIndex: number;
                    result: Parameters<typeof setLiveData>[0] | null;
                };
                setCandleIndex(data.candleIndex);
                if (data.result) setLiveData(data.result);
            } else {
                const err = await res.json() as { error: string };
                addAlert({ message: err.error ?? 'Replay step failed', severity: 'warning', timestamp: new Date().toISOString(), expiresAt: Date.now() + 5000 });
            }
        } catch {
            addAlert({ message: 'Replay step failed', severity: 'warning', timestamp: new Date().toISOString(), expiresAt: Date.now() + 5000 });
        } finally {
            setLoading(false);
        }
    }, [isReplayMode, loading, setLiveData, addAlert]);

    const seek = useCallback(async () => {
        const idx = parseInt(seekInput, 10);
        if (isNaN(idx) || !isReplayMode || loading) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/replay/seek`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ candleIndex: idx }),
            });
            if (res.ok) {
                const data = await res.json() as {
                    candleIndex: number;
                    result: Parameters<typeof setLiveData>[0] | null;
                };
                setCandleIndex(data.candleIndex);
                if (data.result) setLiveData(data.result);
            }
        } catch {
            addAlert({ message: 'Replay seek failed', severity: 'warning', timestamp: new Date().toISOString(), expiresAt: Date.now() + 5000 });
        } finally {
            setLoading(false);
        }
    }, [seekInput, isReplayMode, loading, setLiveData, addAlert]);

    return (
        <div className="replay-panel" role="region" aria-label="Replay Controls">
            <div className="replay-header">
                <span className="replay-title">
                    <span>⏮</span> Replay Mode
                </span>
                <button
                    className={`replay-toggle ${isReplayMode ? 'active' : ''}`}
                    onClick={toggleReplay}
                    aria-pressed={isReplayMode}
                >
                    {isReplayMode ? 'Exit Replay' : 'Enter Replay'}
                </button>
            </div>

            {isReplayMode && (
                <div className="replay-controls">
                    <div className="replay-index">
                        Candle: <span>{candleIndex}</span>
                    </div>

                    <button
                        className="replay-btn"
                        onClick={step}
                        disabled={loading}
                        aria-label="Step forward one candle"
                    >
                        {loading ? '…' : '▶ Step'}
                    </button>

                    <div className="replay-seek-row">
                        <input
                            type="number"
                            className="replay-seek-input"
                            value={seekInput}
                            onChange={e => setSeekInput(e.target.value)}
                            placeholder="Candle #"
                            min={0}
                            aria-label="Seek to candle index"
                        />
                        <button
                            className="replay-btn"
                            onClick={seek}
                            disabled={loading || seekInput === ''}
                            aria-label="Seek to candle"
                        >
                            Seek
                        </button>
                    </div>

                    <div className="replay-note">
                        Requires a CSV file set via REPLAY_CSV_PATH on the backend.
                        Format: timestamp,open,high,low,close,volume
                    </div>
                </div>
            )}
        </div>
    );
}
