// Liquidity Map Panel
// Requirements: 24.1–24.4

import React, { useState } from 'react';
import { useLiveStore } from '../state/liveStore';
import type { LiquidityZone } from '../types/index';

const ZONE_COLORS: Record<string, string> = {
    STOP_CLUSTER: '#d32f2f',
    LIQ_SHELF: '#ffb300',
    FVG: '#29b6f6',
    IMBALANCE: '#9c27b0',
    RESISTANT_CLUSTER: '#00c853',
};

const ZONE_LABELS: Record<string, string> = {
    STOP_CLUSTER: 'Stop Cluster',
    LIQ_SHELF: 'Liq Shelf',
    FVG: 'FVG',
    IMBALANCE: 'Imbalance',
    RESISTANT_CLUSTER: 'Resistant',
};

const ZONE_ICONS: Record<string, string> = {
    STOP_CLUSTER: '🔴',
    LIQ_SHELF: '🟠',
    FVG: '🔵',
    IMBALANCE: '🟣',
    RESISTANT_CLUSTER: '⭐',
};

function ZoneRow({ zone }: { zone: LiquidityZone }): React.ReactElement {
    const color = ZONE_COLORS[zone.type] ?? '#718096';
    const label = ZONE_LABELS[zone.type] ?? zone.type;
    const icon = ZONE_ICONS[zone.type] ?? '●';
    // FVGs always have strength=1.0 by spec — show filled/unfilled status instead
    const isFVG = zone.type === 'FVG';
    const strengthPct = Math.round(zone.strength * 100);
    const strengthDisplay = isFVG
        ? (zone.filled ? 'FILLED' : 'OPEN')
        : `${strengthPct}%`;
    return (
        <div className="zone-row" style={{ borderLeftColor: color }}>
            <span style={{ fontSize: '10px', flexShrink: 0 }}>{icon}</span>
            <span className="zone-type" style={{ color }}>{label}</span>
            <span className="zone-range">{zone.priceMin.toFixed(2)} – {zone.priceMax.toFixed(2)}</span>
            {!isFVG && (
                <div className="zone-strength-bar">
                    <div className="zone-strength-fill" style={{ width: `${strengthPct}%`, background: color, opacity: 0.75 }} />
                </div>
            )}
            <span className="zone-strength" style={{ color: isFVG && !zone.filled ? '#29b6f6' : undefined }}>
                {strengthDisplay}
            </span>
            {zone.filled !== undefined && !isFVG && (
                <span className={`zone-filled ${zone.filled ? 'filled' : 'unfilled'}`}>
                    {zone.filled ? '✓' : '○'}
                </span>
            )}
        </div>
    );
}

export function LiquidityMapPanel(): React.ReactElement {
    const liquidity = useLiveStore(s => s.liquidity);
    const [showZones, setShowZones] = useState(true);

    if (!liquidity) {
        return (
            <div className="panel liquidity-map">
                <h2 className="panel-title"><span className="panel-title-icon">💧</span> Liquidity Map</h2>
                <span className="no-data">Awaiting data…</span>
            </div>
        );
    }

    const stopCount = liquidity.zones.filter(z => z.type === 'STOP_CLUSTER').length;
    const fvgCount = liquidity.zones.filter(z => z.type === 'FVG').length;
    const shelfCount = liquidity.zones.filter(z => z.type === 'LIQ_SHELF').length;
    const resistCount = liquidity.zones.filter(z => z.type === 'RESISTANT_CLUSTER').length;

    return (
        <div className="panel liquidity-map" role="region" aria-label="Liquidity Map Panel">
            <h2 className="panel-title"><span className="panel-title-icon">💧</span> Liquidity Map</h2>

            <div className="metric-row">
                <span className="label">Premium Zone</span>
                <span className="value">{liquidity.premiumZone[0].toFixed(2)} – {liquidity.premiumZone[1].toFixed(2)}</span>
            </div>
            <div className="metric-row">
                <span className="label">Discount Zone</span>
                <span className="value">{liquidity.discountZone[0].toFixed(2)} – {liquidity.discountZone[1].toFixed(2)}</span>
            </div>
            <div className="metric-row">
                <span className="label">Structure Bounds</span>
                <span className="value">{liquidity.structureBounds[0].toFixed(2)} – {liquidity.structureBounds[1].toFixed(2)}</span>
            </div>

            {/* Zone summary badges */}
            {liquidity.zones.length > 0 && (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {stopCount > 0 && <span className="badge red">{stopCount} Stops</span>}
                    {fvgCount > 0 && <span className="badge" style={{ background: 'var(--blue-dim)', color: 'var(--blue)', borderColor: 'rgba(41,182,246,0.35)' }}>{fvgCount} FVG</span>}
                    {shelfCount > 0 && <span className="badge yellow">{shelfCount} Shelves</span>}
                    {resistCount > 0 && <span className="badge green">{resistCount} Resistant</span>}
                </div>
            )}

            {/* Collapsible zone list */}
            <div>
                <div
                    className="collapsible-header"
                    onClick={() => setShowZones(v => !v)}
                    role="button"
                    aria-expanded={showZones}
                >
                    <span className="collapsible-label">Zone Detail ({liquidity.zones.length})</span>
                    <span className={`collapsible-chevron ${showZones ? 'open' : ''}`}>▼</span>
                </div>
                {showZones && (
                    <div className="collapsible-body" style={{ paddingTop: '4px' }}>
                        <div className="zones-list">
                            {liquidity.zones.length === 0
                                ? <span className="no-data">No zones detected</span>
                                : liquidity.zones.map(z => <ZoneRow key={z.id} zone={z} />)
                            }
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
