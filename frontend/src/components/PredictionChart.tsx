// SVG line chart for prediction history
// Plots strictLine (bright) and smoothed (softer) over the last N data points

import React from 'react';
import { useLiveStore } from '../state/liveStore';

interface DataPoint {
    value: number;
    timestamp: string;
}

interface Props {
    history: DataPoint[];
    label: string;
    color: string;
    formatValue?: (v: number) => string;
}

const W = 600;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

function scaleX(i: number, total: number): number {
    const w = W - PAD.left - PAD.right;
    return PAD.left + (i / Math.max(total - 1, 1)) * w;
}

function scaleY(v: number, min: number, max: number): number {
    const h = H - PAD.top - PAD.bottom;
    const range = max - min || 0.01;
    return PAD.top + h - ((v - min) / range) * h;
}

function toPath(points: Array<[number, number]>): string {
    if (points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

function Chart({ history, label, color, formatValue }: Props): React.ReactElement {
    if (history.length < 2) {
        return (
            <div className="prediction-chart-empty">
                <span>Collecting data…</span>
            </div>
        );
    }

    const values = history.map(d => d.value);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const padding = (maxV - minV) * 0.1 || 0.01;
    const minY = minV - padding;
    const maxY = maxV + padding;
    const n = history.length;

    const pts: Array<[number, number]> = history.map((d, i) => [
        scaleX(i, n),
        scaleY(d.value, minY, maxY),
    ]);

    const ticks = 4;
    const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
        const v = minY + (i / ticks) * (maxY - minY);
        return { v, y: scaleY(v, minY, maxY) };
    });

    const fmt = formatValue ?? ((v: number) => v.toFixed(2));
    const last = history[n - 1].value;
    const first = history[0].value;
    const change = last - first;
    const changePct = first !== 0 ? (change / first) * 100 : 0;
    const isUp = change >= 0;

    const xLabels = [0, Math.floor(n / 2), n - 1].map(i => ({
        x: scaleX(i, n),
        label: new Date(history[i].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }));

    return (
        <div className="prediction-chart">
            <div className="chart-header">
                <span className="chart-current" style={{ color }}>{fmt(last)}</span>
                <span className={`chart-change ${isUp ? 'up' : 'down'}`}>
                    {isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
                </span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
                style={{ width: '100%', height: '200px', display: 'block' }}>
                {yTicks.map(({ y }, i) => (
                    <line key={i} x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                        stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                ))}
                {yTicks.map(({ v, y }, i) => (
                    <text key={i} x={PAD.left - 4} y={y + 4}
                        textAnchor="end" fontSize="11" fill="rgba(255,255,255,0.4)">
                        {fmt(v)}
                    </text>
                ))}
                {xLabels.map(({ x, label }, i) => (
                    <text key={i} x={x} y={H - 4}
                        textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.35)">
                        {label}
                    </text>
                ))}
                {/* Area fill */}
                {pts.length >= 2 && (() => {
                    const area = toPath(pts) +
                        ` L${pts[n - 1][0].toFixed(1)},${(H - PAD.bottom).toFixed(1)}` +
                        ` L${pts[0][0].toFixed(1)},${(H - PAD.bottom).toFixed(1)} Z`;
                    return <path d={area} fill={`${color}18`} />;
                })()}
                {/* Line */}
                <path d={toPath(pts)} fill="none" stroke={color} strokeWidth="2" />
                {/* End dot */}
                <circle cx={pts[n - 1][0]} cy={pts[n - 1][1]} r="4" fill={color} />
            </svg>
            <div className="chart-legend">
                <span className="legend-item" style={{ color }}>— {label}</span>
                <span className="legend-item" style={{ color: 'var(--text3)' }}>
                    {n} data points
                </span>
            </div>
        </div>
    );
}

export function PredictionChart(): React.ReactElement {
    const predHistory = useLiveStore(s => s.predictionHistory);

    return (
        <Chart
            history={predHistory.map(p => ({ value: p.strictLine, timestamp: p.timestamp }))}
            label="Strict Line"
            color="#c8a96e"
            formatValue={(v) => `${(v * 100).toFixed(1)}%`}
        />
    );
}
