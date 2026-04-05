// Liquidity Map Panel
// Requirements: 24.1–24.4, 1.2, 1.4

import React from 'react';
import { useLiveStore } from '../state/liveStore';
import type { LiquidityZone } from '../types/index';

const ZONE_COLORS: Record<string, string> = {
    STOP_CLUSTER: '#e53e3e',
    LIQ_SHELF: '#dd6b20',
    FVG: '#3182ce',
    IMBALANCE: '#805ad5',
    RESISTANT_CLUSTER: '#2d3748',
};

function ZoneRow({ zone }: { zone: LiquidityZone }): React.ReactElement {
    const color = ZONE_COLORS[zone.type] ?? '#718096';
    return (
        <div className="zone-row" style={{ borderLeft: `4px solid ${color}` }}>
            <span className="zone-type">{zone.type}</span>
            <span className="zone-range">{zone.priceMin.toFixed(2)} – {zone.priceMax.toFixed(2)}</span>
            <span className="zone-strength" style={{ opacity: Math.min(1, zone.strength) }}>
                str: {zone.strength.toFixed(2)}
            </span>
            {zone.filled !== undefined && (
                <span className={`zone-filled ${zone.filled ? 'filled' : 'unfilled'}`}>
                    {zone.filled ? 'filled' : 'unfilled'}
                </span>
            )}
        </div>
    );
}

export function LiquidityMapPanel(): React.ReactElement {
    const liquidity = useLiveStore(s => s.liquidity);

    if (!liquidity) {
        return <div className="panel liquidity-map"><span className="no-data">Awaiting data…</span></div>;
    }

    return (
        <div className="panel liquidity-map" role="region" aria-label="Liquidity Map Panel">
            <h2 className="panel-title">Liquidity Map</h2>

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

            <div className="zones-list">
                {liquidity.zones.length === 0
                    ? <span className="no-data">No liquidity zones detected</span>
                    : liquidity.zones.map(z => <ZoneRow key={z.id} zone={z} />)
                }
            </div>
        </div>
    );
}

