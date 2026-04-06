// SVG prediction chart — improved readability
// Shows alignment score history with clear HIGH/MED/LOW zones
// Color-coded by geometry regime

import React from 'react';
import { useLiveStore } from '../state/liveStore';

const W = 700;
const H = 320;
const PAD = { top: 24, right: 48, bottom: 36, left: 56 };

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

export function PredictionChart(): React.ReactElement {
    const predHistory = useLiveStore(s => s.predictionHistory);
    const prediction = useLiveStore(s => s.prediction);
    const geometry = useLiveStore(s => s.geometry);
    const liquidity = useLiveStore(s => s.liquidity);

    const lineColor = (() => {
        if (!geometry) return '#00c853';
        const regime = geometry.geometryRegime;
        const micro = geometry.microState ?? '';
        const dir = micro.split('-')[0];
        if (regime === 'COLLAPSING_STRUCTURE') return '#d32f2f';
        if (regime === 'EXPANDING_STRUCTURE') return dir === 'down' ? '#d32f2f' : '#00c853';
        if (regime === 'CHAOTIC_STRUCTURE') return '#ffb300';
        return '#00c853';
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

    // Y-axis ticks — show meaningful labels
    const yTickValues = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0].filter(v => v >= minY - 0.01 && v <= maxY + 0.01);

    const xLabels = [0, Math.floor(n / 2), n - 1].map(i => ({
        x: scaleX(i, n),
        label: new Date(predHistory[i].timestamp).toLocaleTimeString([], {
            hour: '2-digit', minute: '2-digit',
        }),
    }));

    const lastSmoothed = smoothedValues[n - 1];
    const change = lastSmoothed - smoothedValues[0];
    const changePct = smoothedValues[0] !== 0 ? (change / smoothedValues[0]) * 100 : 0;
    const isUp = change >= 0;

    // Alignment label based on smoothed value
    const alignLabel = lastSmoothed >= 0.7 ? 'HIGH ALIGNMENT'
        : lastSmoothed >= 0.4 ? 'MID ALIGNMENT'
            : 'LOW ALIGNMENT';
    const alignColor = lastSmoothed >= 0.7 ? '#00c853'
        : lastSmoothed >= 0.4 ? '#ffb300'
            : '#d32f2f';

    return (
        <div className="prediction-chart">
            <div className="chart-header">
                <span className="chart-current" style={{ color: alignColor, transition: 'color 0.5s ease' }}>
                    {(lastSmoothed * 100).toFixed(1)}%
                </span>
                <span className={`chart-change ${isUp ? 'up' : 'down'}`}>
                    {isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: alignColor, marginLeft: '8px', padding: '2px 8px', borderRadius: '20px', background: alignColor + '18', border: `1px solid ${alignColor}40` }}>
                    {alignLabel}
                </span>
                <span className="chart-regime" style={{ color: lineColor, transition: 'color 0.5s ease' }}>
                    {regimeLabel}
                </span>
            </div>

            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
                style={{ width: '100%', height: '320px', display: 'block' }}>

                {/* Zone backgrounds — removed heavy fills, use lines only for clean look */}

                {/* Zone boundary lines */}
                {highZoneY >= topY && highZoneY <= bottomY && (
                    <>
                        <line x1={PAD.left} y1={highZoneY} x2={W - PAD.right} y2={highZoneY}
                            stroke="rgba(0,200,83,0.5)" strokeWidth="1" strokeDasharray="6,4" />
                        <text x={W - PAD.right + 4} y={highZoneY + 4}
                            fontSize="10" fill="rgba(0,200,83,0.8)" textAnchor="start" fontWeight="700">HIGH</text>
                    </>
                )}
                {lowZoneY >= topY && lowZoneY <= bottomY && (
                    <>
                        <line x1={PAD.left} y1={lowZoneY} x2={W - PAD.right} y2={lowZoneY}
                            stroke="rgba(211,47,47,0.5)" strokeWidth="1" strokeDasharray="6,4" />
                        <text x={W - PAD.right + 4} y={lowZoneY + 4}
                            fontSize="10" fill="rgba(211,47,47,0.8)" textAnchor="start" fontWeight="700">LOW</text>
                    </>
                )}

                {/* MID zone label */}
                {(() => {
                    const midY = (highZoneY + lowZoneY) / 2;
                    if (midY >= topY && midY <= bottomY) {
                        return (
                            <text x={W - PAD.right + 4} y={midY + 4}
                                fontSize="10" fill="rgba(255,179,0,0.6)" textAnchor="start" fontWeight="700">MID</text>
                        );
                    }
                    return null;
                })()}

                {/* Grid lines */}
                {yTickValues.map((v, i) => {
                    const y = scaleY(v, minY, maxY);
                    return (
                        <g key={i}>
                            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                                stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                            <text x={PAD.left - 8} y={y + 4}
                                textAnchor="end" fontSize="11" fill="rgba(224,224,224,0.5)" fontFamily="Inter,sans-serif">
                                {(v * 100).toFixed(0)}%
                            </text>
                        </g>
                    );
                })}

                {/* X-axis labels */}
                {xLabels.map(({ x, label }, i) => (
                    <text key={i} x={x} y={H - 8}
                        textAnchor="middle" fontSize="10" fill="rgba(224,224,224,0.35)" fontFamily="Inter,sans-serif">
                        {label}
                    </text>
                ))}

                {/* Premium / Discount midpoint line — single clean reference line */}
                {liquidity && liquidity.structureBounds[0] > 0 && (() => {
                    const structRange = liquidity.structureBounds[1] - liquidity.structureBounds[0];
                    if (structRange <= 0) return null;
                    const midY = scaleY(0.5, minY, maxY);
                    if (midY < topY || midY > bottomY) return null;
                    return (
                        <g>
                            <line x1={PAD.left} y1={midY} x2={W - PAD.right} y2={midY}
                                stroke="rgba(200,169,110,0.25)" strokeWidth="1" strokeDasharray="3,6" />
                            <text x={PAD.left + 4} y={midY - 3}
                                fontSize="8" fill="rgba(200,169,110,0.45)" textAnchor="start">P/D</text>
                        </g>
                    );
                })()}

                {/* Liquidity attractor markers (Section 9.3 — pulsing markers for resistant clusters) */}
                {liquidity && liquidity.zones.filter(z => z.type === 'RESISTANT_CLUSTER' || z.type === 'LIQ_SHELF').slice(0, 5).map(zone => {
                    const structLow = liquidity.structureBounds[0];
                    const structHigh = liquidity.structureBounds[1];
                    const structRange = structHigh - structLow;
                    if (structRange <= 0) return null;
                    const zoneMid = (zone.priceMin + zone.priceMax) / 2;
                    const zoneNorm = (zoneMid - structLow) / structRange;
                    if (zoneNorm < minY - 0.05 || zoneNorm > maxY + 0.05) return null;
                    const zoneY = scaleY(Math.max(0, Math.min(1, zoneNorm)), minY, maxY);
                    if (zoneY < topY || zoneY > bottomY) return null;
                    const color = zone.type === 'RESISTANT_CLUSTER' ? '#00c853' : '#ffb300';
                    const opacity = Math.max(0.3, zone.strength);
                    return (
                        <g key={zone.id}>
                            <line x1={PAD.left} y1={zoneY} x2={W - PAD.right} y2={zoneY}
                                stroke={color} strokeWidth="1" strokeDasharray="2,6"
                                opacity={opacity * 0.6} />
                            <circle cx={PAD.left - 4} cy={zoneY} r="3"
                                fill={color} opacity={opacity} />
                        </g>
                    );
                })}

                {/* Volatility envelopes — thin border lines only, no filled rects */}
                {prediction && (() => {
                    const b95Hi = scaleY(prediction.band95[1], minY, maxY);
                    const b95Lo = scaleY(prediction.band95[0], minY, maxY);
                    const b50Hi = scaleY(prediction.band50[1], minY, maxY);
                    const b50Lo = scaleY(prediction.band50[0], minY, maxY);
                    return (
                        <>
                            {/* 95% outer boundary — very faint */}
                            <line x1={PAD.left} y1={b95Hi} x2={W - PAD.right} y2={b95Hi}
                                stroke={`${lineColor}20`} strokeWidth="1" strokeDasharray="2,4" />
                            <line x1={PAD.left} y1={b95Lo} x2={W - PAD.right} y2={b95Lo}
                                stroke={`${lineColor}20`} strokeWidth="1" strokeDasharray="2,4" />
                            {/* 50% inner boundary — slightly more visible */}
                            <line x1={PAD.left} y1={b50Hi} x2={W - PAD.right} y2={b50Hi}
                                stroke={`${lineColor}30`} strokeWidth="1" strokeDasharray="1,5" />
                            <line x1={PAD.left} y1={b50Lo} x2={W - PAD.right} y2={b50Lo}
                                stroke={`${lineColor}30`} strokeWidth="1" strokeDasharray="1,5" />
                        </>
                    );
                })()}

                {/* No area fill — clean line chart */}

                {/* Raw strict line — faint dashed reference */}
                <path d={toPath(strictPts)} fill="none"
                    stroke={`${lineColor}30`} strokeWidth="1.5" strokeDasharray="5,4"
                    style={{ transition: 'stroke 0.5s ease' }} />

                {/* Smoothed line — primary */}
                <path d={toPath(smoothedPts)} fill="none"
                    stroke={lineColor} strokeWidth="2.5"
                    style={{ transition: 'stroke 0.5s ease' }} />

                {/* End dot */}
                <circle cx={smoothedPts[n - 1][0]} cy={smoothedPts[n - 1][1]}
                    r="5" fill={lineColor} stroke="#000" strokeWidth="2"
                    style={{ transition: 'fill 0.5s ease' }} />

                {/* Current value label next to end dot */}
                <text
                    x={smoothedPts[n - 1][0] - 8}
                    y={smoothedPts[n - 1][1] - 10}
                    textAnchor="middle" fontSize="11" fill={lineColor} fontWeight="700" fontFamily="Inter,sans-serif">
                    {(lastSmoothed * 100).toFixed(1)}%
                </text>

                {/* Y-axis label */}
                <text x={14} y={H / 2} textAnchor="middle" fontSize="10"
                    fill="rgba(224,224,224,0.2)" fontFamily="Inter,sans-serif"
                    transform={`rotate(-90, 14, ${H / 2})`}>
                    ALIGNMENT SCORE
                </text>
            </svg>

            <div className="chart-legend">
                <span style={{ color: '#00c853', fontSize: '11px' }}>■ HIGH ≥70%</span>
                <span style={{ color: '#ffb300', fontSize: '11px', marginLeft: '12px' }}>■ MID 40–70%</span>
                <span style={{ color: '#d32f2f', fontSize: '11px', marginLeft: '12px' }}>■ LOW &lt;40%</span>
                <span style={{ color: 'rgba(200,169,110,0.6)', fontSize: '10px', marginLeft: '12px' }}>╌ structure</span>
                <span style={{ color: 'var(--text3)', fontSize: '10px', marginLeft: 'auto' }}>— smoothed · ╌ raw · {n} pts</span>
            </div>
        </div>
    );
}
