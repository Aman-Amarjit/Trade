// SVG prediction chart — improved readability
// Shows alignment score history with clear HIGH/MED/LOW zones
// Color-coded by geometry regime

import React from 'react';
import { useLiveStore } from '../state/liveStore';

const W = 600;
const H = 220;
const PAD = { top: 20, right: 16, bottom: 32, left: 52 };

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

    const lineColor = (() => {
        if (!geometry) return '#c8a96e';
        const regime = geometry.geometryRegime;
        const micro = geometry.microState ?? '';
        const dir = micro.split('-')[0];
        if (regime === 'COLLAPSING_STRUCTURE') return '#b85050';
        if (regime === 'EXPANDING_STRUCTURE') return dir === 'down' ? '#b85050' : '#4a8e5f';
        if (regime === 'CHAOTIC_STRUCTURE') return '#c8a030';
        return '#c8a96e';
    })();

    const regimeLabel = geometry?.geometryRegime?.replace('_STRUCTURE', '') ?? 'STABLE';

    if (predHistory.length < 2) {
        return (
            <div className="prediction-chart-empty">
                <span>Collecting data… (need 2+ cycles)</span>
            </div>
        );
    }

    const n = predHistory.length;
    const strictValues = predHistory.map(p => p.strictLine);
    const smoothedValues = predHistory.map(p => p.smoothed);

    // Always show full 0–1 range so zones are meaningful
    // But zoom in if data is tightly clustered
    const dataMin = Math.min(...strictValues, ...smoothedValues);
    const dataMax = Math.max(...strictValues, ...smoothedValues);
    const dataRange = dataMax - dataMin;

    // Always show a minimum 30% window so small oscillations don't look huge
    // If data spans less than 30%, center it with padding
    let minY: number, maxY: number;
    if (dataRange < 0.30) {
        const center = (dataMin + dataMax) / 2;
        minY = Math.max(0, center - 0.18);
        maxY = Math.min(1, center + 0.18);
    } else {
        minY = Math.max(0, dataMin - 0.05);
        maxY = Math.min(1, dataMax + 0.05);
    }

    const strictPts: Array<[number, number]> = predHistory.map((p, i) => [
        scaleX(i, n), scaleY(p.strictLine, minY, maxY),
    ]);
    const smoothedPts: Array<[number, number]> = predHistory.map((p, i) => [
        scaleX(i, n), scaleY(p.smoothed, minY, maxY),
    ]);

    // Zone boundaries (0.7 = HIGH, 0.4 = LOW)
    const highZoneY = scaleY(0.7, minY, maxY);
    const lowZoneY = scaleY(0.4, minY, maxY);
    const topY = PAD.top;
    const bottomY = H - PAD.bottom;
    const chartW = W - PAD.left - PAD.right;

    // Y-axis ticks — show meaningful labels
    const yTickValues = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0].filter(v => v >= minY - 0.01 && v <= maxY + 0.01);

    const xLabels = [0, Math.floor(n / 2), n - 1].map(i => ({
        x: scaleX(i, n),
        label: new Date(predHistory[i].timestamp).toLocaleTimeString([], {
            hour: '2-digit', minute: '2-digit',
        }),
    }));

    const lastStrict = strictValues[n - 1];
    const firstStrict = strictValues[0];
    const change = lastStrict - firstStrict;
    const changePct = firstStrict !== 0 ? (change / firstStrict) * 100 : 0;
    const isUp = change >= 0;

    // Alignment label based on current value
    const alignLabel = lastStrict >= 0.7 ? 'HIGH ALIGNMENT'
        : lastStrict >= 0.4 ? 'MID ALIGNMENT'
            : 'LOW ALIGNMENT';
    const alignColor = lastStrict >= 0.7 ? '#4a8e5f'
        : lastStrict >= 0.4 ? '#c8a96e'
            : '#b85050';

    return (
        <div className="prediction-chart">
            <div className="chart-header">
                <span className="chart-current" style={{ color: alignColor, transition: 'color 0.5s ease' }}>
                    {(lastStrict * 100).toFixed(1)}%
                </span>
                <span className={`chart-change ${isUp ? 'up' : 'down'}`}>
                    {isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: alignColor, fontFamily: 'monospace', marginLeft: '8px' }}>
                    {alignLabel}
                </span>
                <span className="chart-regime" style={{ color: lineColor, transition: 'color 0.5s ease' }}>
                    {regimeLabel}
                </span>
            </div>

            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
                style={{ width: '100%', height: '220px', display: 'block' }}>

                {/* Zone backgrounds — only render if zone is in visible range */}
                {/* HIGH zone (0.7–1.0) — green tint */}
                {highZoneY > topY && (
                    <rect x={PAD.left} y={Math.max(topY, highZoneY - (highZoneY - topY))}
                        width={chartW}
                        height={Math.max(0, Math.min(highZoneY, bottomY) - topY)}
                        fill="rgba(74,142,95,0.06)" />
                )}
                {/* LOW zone (0.0–0.4) — red tint */}
                {lowZoneY < bottomY && (
                    <rect x={PAD.left} y={lowZoneY}
                        width={chartW}
                        height={Math.max(0, bottomY - lowZoneY)}
                        fill="rgba(184,80,80,0.06)" />
                )}

                {/* Zone boundary lines */}
                {highZoneY >= topY && highZoneY <= bottomY && (
                    <>
                        <line x1={PAD.left} y1={highZoneY} x2={W - PAD.right} y2={highZoneY}
                            stroke="rgba(74,142,95,0.4)" strokeWidth="1" strokeDasharray="6,3" />
                        <text x={W - PAD.right + 2} y={highZoneY + 4}
                            fontSize="8" fill="rgba(74,142,95,0.7)" textAnchor="start">HIGH</text>
                    </>
                )}
                {lowZoneY >= topY && lowZoneY <= bottomY && (
                    <>
                        <line x1={PAD.left} y1={lowZoneY} x2={W - PAD.right} y2={lowZoneY}
                            stroke="rgba(184,80,80,0.4)" strokeWidth="1" strokeDasharray="6,3" />
                        <text x={W - PAD.right + 2} y={lowZoneY + 4}
                            fontSize="8" fill="rgba(184,80,80,0.7)" textAnchor="start">LOW</text>
                    </>
                )}

                {/* Grid lines */}
                {yTickValues.map((v, i) => {
                    const y = scaleY(v, minY, maxY);
                    return (
                        <g key={i}>
                            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                                stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                            <text x={PAD.left - 6} y={y + 4}
                                textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.4)">
                                {(v * 100).toFixed(0)}%
                            </text>
                        </g>
                    );
                })}

                {/* X-axis labels */}
                {xLabels.map(({ x, label }, i) => (
                    <text key={i} x={x} y={H - 6}
                        textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)">
                        {label}
                    </text>
                ))}

                {/* Volatility envelopes */}
                {prediction && (() => {
                    const b95Hi = scaleY(prediction.band95[1], minY, maxY);
                    const b95Lo = scaleY(prediction.band95[0], minY, maxY);
                    const b80Hi = scaleY(prediction.band80[1], minY, maxY);
                    const b80Lo = scaleY(prediction.band80[0], minY, maxY);
                    const b50Hi = scaleY(prediction.band50[1], minY, maxY);
                    const b50Lo = scaleY(prediction.band50[0], minY, maxY);
                    return (
                        <>
                            <rect x={PAD.left} y={b95Hi} width={chartW} height={Math.abs(b95Lo - b95Hi)} fill={`${lineColor}08`} />
                            <rect x={PAD.left} y={b80Hi} width={chartW} height={Math.abs(b80Lo - b80Hi)} fill={`${lineColor}12`} />
                            <rect x={PAD.left} y={b50Hi} width={chartW} height={Math.abs(b50Lo - b50Hi)} fill={`${lineColor}1e`} />
                        </>
                    );
                })()}

                {/* Area fill under strict line */}
                <path d={areaPath(strictPts, bottomY)} fill={`${lineColor}0c`} />

                {/* Smoothed line — thicker, more transparent */}
                <path d={toPath(smoothedPts)} fill="none"
                    stroke={`${lineColor}60`} strokeWidth="2.5"
                    style={{ transition: 'stroke 0.5s ease' }} />

                {/* Strict line — bright */}
                <path d={toPath(strictPts)} fill="none"
                    stroke={lineColor} strokeWidth="2"
                    style={{ transition: 'stroke 0.5s ease' }} />

                {/* End dot */}
                <circle cx={strictPts[n - 1][0]} cy={strictPts[n - 1][1]}
                    r="4" fill={lineColor} stroke="#000" strokeWidth="1.5"
                    style={{ transition: 'fill 0.5s ease' }} />

                {/* Y-axis label */}
                <text x={12} y={H / 2} textAnchor="middle" fontSize="9"
                    fill="rgba(255,255,255,0.25)"
                    transform={`rotate(-90, 12, ${H / 2})`}>
                    ALIGNMENT SCORE
                </text>
            </svg>

            <div className="chart-legend">
                <span style={{ color: '#4a8e5f', fontSize: '10px', fontFamily: 'monospace' }}>■ HIGH ≥70</span>
                <span style={{ color: '#c8a96e', fontSize: '10px', fontFamily: 'monospace', marginLeft: '10px' }}>■ MID 40–70</span>
                <span style={{ color: '#b85050', fontSize: '10px', fontFamily: 'monospace', marginLeft: '10px' }}>■ LOW &lt;40</span>
                <span style={{ color: 'var(--text3)', fontSize: '10px', fontFamily: 'monospace', marginLeft: '10px' }}>{n} pts</span>
            </div>
        </div>
    );
}
