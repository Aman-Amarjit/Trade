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
    const breakoutCycle = useLiveStore(s => s.breakoutCycle);

    const lineColor = (() => {
        if (!geometry) return 'var(--success)';
        const regime = geometry.geometryRegime;
        const micro = geometry.microState ?? '';
        const dir = micro.split('-')[0];
        if (regime === 'COLLAPSING_STRUCTURE') return 'var(--error)';
        if (regime === 'EXPANDING_STRUCTURE') return dir === 'down' ? 'var(--error)' : 'var(--success)';
        if (regime === 'CHAOTIC_STRUCTURE') return 'var(--warning)';
        return 'var(--success)';
    })();


    const regimeLabel = geometry?.geometryRegime?.replace('_STRUCTURE', '') ?? 'STABLE';
    const breakoutLabel = breakoutCycle
        ? breakoutCycle.invalidated ? 'INVALIDATED' : breakoutCycle.rangeState === 'BREAKOUT' ? `${breakoutCycle.breakoutDirection ?? ''} BREAKOUT` : breakoutCycle.rangeState === 'RETEST' ? 'RETEST AVAILABLE' : breakoutCycle.rangeState
        : 'NO BREAKOUT';
    const breakoutColor = breakoutCycle
        ? breakoutCycle.invalidated ? '#d32f2f' : breakoutCycle.rangeState === 'BREAKOUT' ? '#00c853' : '#ffb300'
        : '#999';

    if (predHistory.length < 2) {
        return (
            <div className="prediction-chart-empty">
                <span>Collecting data… (need 2+ cycles)</span>
            </div>
        );
    }

    const n = predHistory.length;
    const smoothedValues = predHistory.map(p => p.smoothed);

    // Always show full 0–1 range so zones are meaningful
    // But zoom in if data is tightly clustered

    // Always show a minimum 30% window so small oscillations don't look huge
    // If data spans less than 30%, center it with padding
    // Force 0-1 range to ensure HIGH/LOW zones are always visible and meaningful
    const minY = 0;
    const maxY = 1;

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
    const alignColor = lastSmoothed >= 0.7 ? 'var(--success)'
        : lastSmoothed >= 0.4 ? 'var(--warning)'
            : 'var(--error)';

    // Price normalization helper (Spec 9.3)
    const normalizePrice = (price: number | null | undefined): number | null => {
        if (!price || !liquidity || !liquidity.structureBounds) return null;
        const [min, max] = liquidity.structureBounds;
        const range = max - min;
        if (range <= 0) return null;
        // Normalize to 0-1 range relative to structure bounds
        return (price - min) / range;
    };


    return (
        <div className="prediction-chart">
            <div className="chart-header">
                <span className="chart-current" style={{ color: alignColor, transition: 'color 0.5s ease' }}>
                    {(lastSmoothed * 100).toFixed(1)}%
                </span>
                <span className={`chart-change ${isUp ? 'up' : 'down'}`}>
                    {isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
                </span>
                <span className="align-indicator-badge" style={{ 
                    fontSize: '11px', fontWeight: 700, color: alignColor, 
                    marginLeft: '8px', padding: '2px 8px', borderRadius: '20px', 
                    background: lastSmoothed >= 0.7 ? 'rgba(0, 200, 83, 0.15)' : lastSmoothed >= 0.4 ? 'rgba(255, 179, 0, 0.15)' : 'rgba(211, 47, 47, 0.15)',
                    border: `1px solid ${alignColor}` 
                }}>
                    {alignLabel}
                </span>
                <span className="chart-regime" style={{ color: lineColor, transition: 'color 0.5s ease' }}>
                    {regimeLabel}
                </span>
            </div>

            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
                style={{ width: '100%', height: '320px', display: 'block' }}>

                {/* Zone background bands — subtle HUD feel */}
                <rect x={PAD.left} y={PAD.top} width={W - PAD.left - PAD.right} height={highZoneY - PAD.top}
                    fill="var(--success)" fillOpacity="0.1" />
                <rect x={PAD.left} y={highZoneY} width={W - PAD.left - PAD.right} height={lowZoneY - highZoneY}
                    fill="var(--surface3)" fillOpacity="0.15" />
                <rect x={PAD.left} y={lowZoneY} width={W - PAD.left - PAD.right} height={H - PAD.bottom - lowZoneY}
                    fill="var(--error)" fillOpacity="0.1" />

                {/* Range Box Overlay (Patch Item #8) */}
                {breakoutCycle && (() => {
                    const yRH = normalizePrice(breakoutCycle.rh);
                    const yRL = normalizePrice(breakoutCycle.rl);
                    if (yRH === null || yRL === null) return null;

                    const top = scaleY(yRH, minY, maxY);
                    const bottom = scaleY(yRL, minY, maxY);
                    const h = Math.abs(bottom - top);

                    return (
                        <rect
                            x={PAD.left}
                            y={Math.min(top, bottom)}
                            width={W - PAD.left - PAD.right}
                            height={h}
                            fill={breakoutColor}
                            fillOpacity={0.15}
                            stroke={breakoutColor}
                            strokeWidth="1.5"
                            strokeDasharray="4,4"
                            strokeOpacity={0.4}
                        />
                    );
                })()}

                {/* Zone boundary lines */}
                {highZoneY >= topY && highZoneY <= bottomY && (
                    <g>
                        <line x1={PAD.left} y1={highZoneY} x2={W - PAD.right} y2={highZoneY}
                            stroke="hsla(150, 100%, 45%, 0.15)" strokeWidth="1" strokeDasharray="6,4" />
                        <text x={W - PAD.right - 8} y={highZoneY - 12}
                            fontSize="10" fill="white" textAnchor="end" fontWeight="800" style={{ letterSpacing: '0.05em', opacity: 0.9 }}>HIGH ZONE (≥70%)</text>
                    </g>
                )}
                {lowZoneY >= topY && lowZoneY <= bottomY && (
                    <g>
                        <line x1={PAD.left} y1={lowZoneY} x2={W - PAD.right} y2={lowZoneY}
                            stroke="hsla(0, 100%, 60%, 0.15)" strokeWidth="1" strokeDasharray="6,4" />
                        <text x={W - PAD.right - 8} y={lowZoneY + 16}
                            fontSize="10" fill="white" textAnchor="end" fontWeight="800" style={{ letterSpacing: '0.05em', opacity: 0.9 }}>LOW ZONE (&lt;40%)</text>
                    </g>
                )}

                {/* MID zone label */}
                {(() => {
                    const midY = (highZoneY + lowZoneY) / 2;
                    if (midY >= topY && midY <= bottomY) {
                        return (
                            <text x={W - PAD.right - 8} y={midY - 4}
                                fontSize="9" fill="white" textAnchor="end" fontWeight="700" style={{ opacity: 0.6 }}>MID RANGE</text>
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
                    const midY = scaleY(0.5, minY, maxY);
                    if (midY < topY || midY > bottomY) return null;
                    return (
                        <g>
                            <line x1={PAD.left} y1={midY} x2={W - PAD.right} y2={midY}
                                stroke="rgba(200,169,110,0.15)" strokeWidth="1" strokeDasharray="2,8" />
                            <text x={PAD.left + 4} y={midY - 4}
                                fontSize="9" fill="rgba(200,169,110,0.5)" textAnchor="start" fontWeight="700">P/D</text>
                        </g>
                    );
                })()}

                {/* Breakout Trade Levels (Patch Item #8) */}
                {breakoutCycle && (breakoutCycle.rangeState === 'BREAKOUT' || breakoutCycle.rangeState === 'RETEST') && (() => {
                    const levels = [
                        { val: breakoutCycle.entry1, label: 'ENTRY 1', color: 'var(--accent)' },
                        { val: breakoutCycle.entry2, label: 'ENTRY 2', color: 'var(--accent)' },
                        { val: breakoutCycle.stopLoss, label: 'STOP', color: 'var(--error)' },
                        { val: breakoutCycle.tp1, label: 'TP 1', color: 'var(--success)' },
                        { val: breakoutCycle.tp2, label: 'TP 2', color: 'var(--success)' },
                    ].filter(l => l.val != null);

                    return levels.map((l, i) => {
                        const yNorm = normalizePrice(l.val);
                        if (yNorm === null) return null;
                        const y = scaleY(yNorm, minY, maxY);
                        if (y < topY || y > bottomY) return null;

                        return (
                            <g key={i}>
                                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                                    stroke={l.color} strokeWidth="1.5" strokeDasharray={l.label === 'STOP' ? '0' : '5,5'} />
                                <rect x={W - PAD.right + 2} y={y - 8} width={42} height={16}
                                    rx={4} ry={4} fill={l.color} />
                                <text x={W - PAD.right + 23} y={y + 4}
                                    textAnchor="middle" fontSize="9" fill="white" fontWeight="900" fontFamily="Inter,sans-serif">
                                    {l.label}
                                </text>
                            </g>
                        );
                    });
                })()}

                {/* Liquidity attractor markers — simplified to margin dots to reduce noise */}
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
                    const color = zone.type === 'RESISTANT_CLUSTER' ? 'var(--green)' : 'var(--yellow)';
                    const opacity = Math.max(0.2, zone.strength * 0.4);
                    return (
                        <g key={zone.id}>
                            <circle cx={PAD.left - 4} cy={zoneY} r="3"
                                fill={color} opacity={opacity} />
                            <line x1={PAD.left} y1={zoneY} x2={PAD.left + 20} y2={zoneY}
                                stroke={color} strokeWidth="1" opacity={opacity * 0.5} />
                        </g>
                    );
                })}

                {/* Volatility envelopes — ultra-thin background reference */}
                {prediction && (() => {
                    const b95Hi = scaleY(prediction.band95[1], minY, maxY);
                    const b95Lo = scaleY(prediction.band95[0], minY, maxY);
                    const b50Hi = scaleY(prediction.band50[1], minY, maxY);
                    const b50Lo = scaleY(prediction.band50[0], minY, maxY);
                    return (
                        <>
                            <line x1={PAD.left} y1={b95Hi} x2={W - PAD.right} y2={b95Hi}
                                stroke={`${lineColor}15`} strokeWidth="0.8" strokeDasharray="2,6" />
                            <line x1={PAD.left} y1={b95Lo} x2={W - PAD.right} y2={b95Lo}
                                stroke={`${lineColor}15`} strokeWidth="0.8" strokeDasharray="2,6" />
                            <line x1={PAD.left} y1={b50Hi} x2={W - PAD.right} y2={b50Hi}
                                stroke={`${lineColor}25`} strokeWidth="0.8" strokeDasharray="1,8" />
                            <line x1={PAD.left} y1={b50Lo} x2={W - PAD.right} y2={b50Lo}
                                stroke={`${lineColor}25`} strokeWidth="0.8" strokeDasharray="1,8" />
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

                {/* Current value label next to end dot — handling boundary cases */}
                <text
                    x={smoothedPts[n - 1][0] - 12}
                    y={Math.max(PAD.top + 10, Math.min(H - PAD.bottom - 10, smoothedPts[n - 1][1] - 10))}
                    textAnchor="end" fontSize="12" fill={lineColor} fontWeight="800" fontFamily="Inter, sans-serif"
                    style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.5))' }}>
                    {(lastSmoothed * 100).toFixed(1)}%
                </text>

                {breakoutCycle && (
                    <g>
                        <rect x={W - PAD.right - 140} y={PAD.top + 6} width={136} height={38}
                            rx={10} ry={10} fill="var(--surface3)" stroke={`${breakoutColor}40`} strokeWidth="1" />
                        <text x={W - PAD.right - 68} y={PAD.top + 22}
                            textAnchor="middle" fontSize="11" fill={breakoutColor} fontWeight="800" fontFamily="Inter,sans-serif"
                            style={{ textShadow: `0 0 8px ${breakoutColor}40` }}>
                            {breakoutLabel}
                        </text>
                        {breakoutCycle.retestLevel != null && (
                            <text x={W - PAD.right - 68} y={PAD.top + 34}
                                textAnchor="middle" fontSize="9" fill={breakoutColor} fontFamily="Inter,sans-serif">
                                Retest threshold: {breakoutCycle.retestLevel.toFixed(2)}
                            </text>
                        )}
                    </g>
                )}

                {/* Y-axis label */}
                <text x={14} y={H / 2} textAnchor="middle" fontSize="10"
                    fill="rgba(224,224,224,0.2)" fontFamily="Inter,sans-serif"
                    transform={`rotate(-90, 14, ${H / 2})`}>
                    ALIGNMENT SCORE
                </text>
            </svg>

            <div className="chart-legend" style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <span style={{ color: 'var(--green)', fontSize: '10px', fontWeight: 700 }}>● HIGH SIGNAL</span>
                <span style={{ color: 'var(--yellow)', fontSize: '10px', fontWeight: 700, marginLeft: '16px' }}>● MID SIGNAL</span>
                <span style={{ color: 'var(--red)', fontSize: '10px', fontWeight: 700, marginLeft: '16px' }}>● LOW SIGNAL</span>
                <span style={{ color: 'var(--text3)', fontSize: '10px', marginLeft: 'auto', display: 'flex', gap: '16px' }}>
                    <span><span style={{ color: lineColor }}>—</span> Smoothed</span>
                    <span><span style={{ color: lineColor, opacity: 0.4 }}>╌╌</span> Raw Signal</span>
                    <span style={{ color: 'var(--amber)', opacity: 0.6 }}>● Liquidity</span>
                </span>
            </div>
        </div>
    );
}

