// SVG prediction chart — Section 9.3 visual spec
// Strict line = thin, bright
// Smoothed line = thicker, softer
// Confidence bands = translucent shading (50%, 80%, 95%)
// Min/max = faint boundary lines

import React from 'react';
import { useLiveStore } from '../state/liveStore';

const W = 600;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 28, left: 48 };

function scaleX(i: number, total: number): number {
    const w = W - PAD.left - PAD.right;
    return PAD.left + (i / Math.max(total - 1, 1)) * w;
}

function scaleY(v: number, minY: number, maxY: number): number {
    const h = H - PAD.top - PAD.bottom;
    const range = maxY - minY || 0.01;
    return PAD.top + h - ((v - minY) / range) * h;
}

function toPath(pts: Array<[number, number]>): string {
    if (pts.length === 0) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

function areaPath(pts: Array<[number, number]>, bottomY: number): string {
    if (pts.length < 2) return '';
    const n = pts.length;
    return toPath(pts) +
        ` L${pts[n - 1][0].toFixed(1)},${bottomY.toFixed(1)}` +
        ` L${pts[0][0].toFixed(1)},${bottomY.toFixed(1)} Z`;
}

export function PredictionChart(): React.ReactElement {
    const predHistory = useLiveStore(s => s.predictionHistory);
    const prediction = useLiveStore(s => s.prediction);
    const geometry = useLiveStore(s => s.geometry);

    // Color changes based on geometry regime and trend
    // STABLE → amber, EXPANDING up → green, EXPANDING down → red, COLLAPSING → red, CHAOTIC → yellow
    const lineColor = (() => {
        if (!geometry) return '#c8a96e';
        const regime = geometry.geometryRegime;
        const micro = geometry.microState ?? '';
        const dir = micro.split('-')[0]; // 'up', 'down', or 'neutral'
        if (regime === 'COLLAPSING_STRUCTURE') return '#b85050';
        if (regime === 'EXPANDING_STRUCTURE') return dir === 'down' ? '#b85050' : '#4a8e5f';
        if (regime === 'CHAOTIC_STRUCTURE') return '#c8a030';
        return '#c8a96e'; // STABLE_STRUCTURE
    })();

    // Color label for display
    const regimeLabel = geometry?.geometryRegime?.replace('_STRUCTURE', '') ?? 'STABLE';
    const regimeLabelColor = lineColor;

    if (predHistory.length < 2) {
        return (
            <div className="prediction-chart-empty">
                <span>Collecting data…</span>
            </div>
        );
    }

    const n = predHistory.length;
    const strictValues = predHistory.map(p => p.strictLine);
    const smoothedValues = predHistory.map(p => p.smoothed);

    // Y range: use all values + current bands if available
    const allVals = [...strictValues, ...smoothedValues];
    if (prediction) {
        allVals.push(prediction.min, prediction.max,
            prediction.band95[0], prediction.band95[1]);
    }
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const pad = (maxV - minV) * 0.12 || 0.02;
    const minY = minV - pad;
    const maxY = maxV + pad;

    const strictPts: Array<[number, number]> = predHistory.map((p, i) => [
        scaleX(i, n), scaleY(p.strictLine, minY, maxY),
    ]);
    const smoothedPts: Array<[number, number]> = predHistory.map((p, i) => [
        scaleX(i, n), scaleY(p.smoothed, minY, maxY),
    ]);

    const ticks = 4;
    const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
        const v = minY + (i / ticks) * (maxY - minY);
        return { v, y: scaleY(v, minY, maxY) };
    });

    const xLabels = [0, Math.floor(n / 2), n - 1].map(i => ({
        x: scaleX(i, n),
        label: new Date(predHistory[i].timestamp).toLocaleTimeString([], {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        }),
    }));

    const lastStrict = strictValues[n - 1];
    const firstStrict = strictValues[0];
    const change = lastStrict - firstStrict;
    const changePct = firstStrict !== 0 ? (change / firstStrict) * 100 : 0;
    const isUp = change >= 0;
    const bottomY = H - PAD.bottom;

    // Current confidence bands (from latest prediction output)
    const band95Lo = prediction ? scaleY(prediction.band95[0], minY, maxY) : null;
    const band95Hi = prediction ? scaleY(prediction.band95[1], minY, maxY) : null;
    const band80Lo = prediction ? scaleY(prediction.band80[0], minY, maxY) : null;
    const band80Hi = prediction ? scaleY(prediction.band80[1], minY, maxY) : null;
    const band50Lo = prediction ? scaleY(prediction.band50[0], minY, maxY) : null;
    const band50Hi = prediction ? scaleY(prediction.band50[1], minY, maxY) : null;
    const minLine = prediction ? scaleY(prediction.min, minY, maxY) : null;
    const maxLine = prediction ? scaleY(prediction.max, minY, maxY) : null;

    const fmt = (v: number) => `${(v * 100).toFixed(1)}%`;

    return (
        <div className="prediction-chart">
            <div className="chart-header">
                <span className="chart-current" style={{ color: lineColor, transition: 'color 0.5s ease' }}>{fmt(lastStrict)}</span>
                <span className={`chart-change ${isUp ? 'up' : 'down'}`}>
                    {isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
                </span>
                <span className="chart-regime" style={{ color: regimeLabelColor, transition: 'color 0.5s ease' }}>
                    {regimeLabel}
                </span>
            </div>

            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
                style={{ width: '100%', height: '200px', display: 'block' }}>

                {/* Grid lines */}
                {yTicks.map(({ y }, i) => (
                    <line key={i} x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                        stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                ))}
                {yTicks.map(({ v, y }, i) => (
                    <text key={i} x={PAD.left - 4} y={y + 4}
                        textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.35)">
                        {fmt(v)}
                    </text>
                ))}
                {xLabels.map(({ x, label }, i) => (
                    <text key={i} x={x} y={H - 4}
                        textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)">
                        {label}
                    </text>
                ))}

                {/* 95% confidence band — most translucent */}
                {band95Lo !== null && band95Hi !== null && (
                    <rect x={PAD.left} y={band95Hi} width={W - PAD.left - PAD.right}
                        height={Math.abs(band95Lo - band95Hi)}
                        fill={`${lineColor}0a`} />
                )}

                {/* 80% confidence band */}
                {band80Lo !== null && band80Hi !== null && (
                    <rect x={PAD.left} y={band80Hi} width={W - PAD.left - PAD.right}
                        height={Math.abs(band80Lo - band80Hi)}
                        fill={`${lineColor}14`} />
                )}

                {/* 50% confidence band — most opaque */}
                {band50Lo !== null && band50Hi !== null && (
                    <rect x={PAD.left} y={band50Hi} width={W - PAD.left - PAD.right}
                        height={Math.abs(band50Lo - band50Hi)}
                        fill={`${lineColor}22`} />
                )}

                {/* Min/max boundary lines — faint */}
                {minLine !== null && (
                    <line x1={PAD.left} y1={minLine} x2={W - PAD.right} y2={minLine}
                        stroke={`${lineColor}33`} strokeWidth="1" strokeDasharray="4,4" />
                )}
                {maxLine !== null && (
                    <line x1={PAD.left} y1={maxLine} x2={W - PAD.right} y2={maxLine}
                        stroke={`${lineColor}33`} strokeWidth="1" strokeDasharray="4,4" />
                )}

                {/* Strict line area fill */}
                <path d={areaPath(strictPts, bottomY)} fill={`${lineColor}10`} />

                {/* Smoothed line — thicker, softer */}
                <path d={toPath(smoothedPts)} fill="none"
                    stroke={`${lineColor}55`} strokeWidth="3"
                    style={{ transition: 'stroke 0.5s ease' }} />

                {/* Strict line — thin, bright, dynamic color */}
                <path d={toPath(strictPts)} fill="none"
                    stroke={lineColor} strokeWidth="1.5"
                    style={{ transition: 'stroke 0.5s ease' }} />

                {/* End dot on strict line */}
                <circle cx={strictPts[n - 1][0]} cy={strictPts[n - 1][1]}
                    r="4" fill={lineColor}
                    style={{ transition: 'fill 0.5s ease' }} />
            </svg>

            <div className="chart-legend">
                <span className="legend-item" style={{ color: lineColor }}>— Strict</span>
                <span className="legend-item" style={{ color: `${lineColor}88` }}>— Smoothed</span>
                <span className="legend-item" style={{ color: `${lineColor}44` }}>▪ Bands</span>
                <span className="legend-item" style={{ color: 'var(--text3)' }}>{n} pts</span>
            </div>
        </div>
    );
}
