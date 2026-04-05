import type {
    Engine,
    EngineError,
    VolatilityRegime,
    LiquidityZone,
    LiquidityZoneType,
    LiquidityMapOutput,
    MarketStructureOutput,
} from '../../../shared/types/index.js';

export interface LiquidityMapInput {
    marketStructure: MarketStructureOutput;
    volumeProfile: Array<{ price: number; volume: number }>;
    orderflow: { bid: number; ask: number; imbalance: number };
    volatilityRegime: VolatilityRegime;
    candles: Array<{ high: number; low: number; open: number; close: number; timestamp: string }>;
    openInterest: number;
    currentPrice: number;
}

let _zoneCounter = 0;

function makeZoneId(type: LiquidityZoneType, price: number): string {
    _zoneCounter++;
    const hash = Math.abs(Math.round(price * 1000)) % 100000;
    return `${type}_${hash}_${_zoneCounter}`;
}

function computeATR(candles: Array<{ high: number; low: number; close: number }>): number {
    if (candles.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < candles.length; i++) {
        const tr = Math.max(
            candles[i].high - candles[i].low,
            Math.abs(candles[i].high - candles[i - 1].close),
            Math.abs(candles[i].low - candles[i - 1].close),
        );
        sum += tr;
    }
    return sum / (candles.length - 1);
}

function normalizeVolume(
    price: number,
    volumeProfile: Array<{ price: number; volume: number }>,
): number {
    if (volumeProfile.length === 0) return 0;
    const maxVol = Math.max(...volumeProfile.map(v => v.volume));
    if (maxVol === 0) return 0;

    // Find nearest level
    let nearest = volumeProfile[0];
    let minDist = Math.abs(price - volumeProfile[0].price);
    for (const vp of volumeProfile) {
        const dist = Math.abs(price - vp.price);
        if (dist < minDist) {
            minDist = dist;
            nearest = vp;
        }
    }
    return nearest.volume / maxVol;
}

export const LiquidityMapEngine: Engine<LiquidityMapInput, LiquidityMapOutput> = {
    name: 'LiquidityMapEngine',
    version: '1.0.0',

    execute(input: LiquidityMapInput): LiquidityMapOutput | EngineError {
        const { marketStructure, volumeProfile, candles, openInterest, currentPrice } = input;

        // Validation
        if (!candles || candles.length < 3) {
            return {
                type: 'MISSING_DATA',
                message: 'At least 3 candles are required for liquidity map computation',
                recoverable: false,
            };
        }
        if (currentPrice <= 0) {
            return {
                type: 'VALIDATION',
                message: 'currentPrice must be greater than 0',
                recoverable: false,
            };
        }
        if (openInterest < 0) {
            return {
                type: 'VALIDATION',
                message: 'openInterest must be non-negative',
                recoverable: false,
            };
        }

        const atr = computeATR(candles);
        const allSwings = [
            ...marketStructure.internalSwings,
            ...marketStructure.externalSwings,
        ];

        const zones: LiquidityZone[] = [];

        // ── Stop Clusters (Formula 8) ──────────────────────────────────────────
        for (const swing of allSwings) {
            const swingPrice = swing.price;

            // swingCount: number of swings within ATR distance of this price
            const swingCount = allSwings.filter(
                s => Math.abs(s.price - swingPrice) <= atr,
            ).length;

            // wickTouches: candles whose high or low is within 0.1% of swing price
            const tolerance = swingPrice * 0.001;
            const wickTouches = candles.filter(
                c =>
                    Math.abs(c.high - swingPrice) <= tolerance ||
                    Math.abs(c.low - swingPrice) <= tolerance,
            ).length;

            // volumeAtLevel: normalized volume at nearest profile level
            const volumeAtLevel = normalizeVolume(swingPrice, volumeProfile);

            const stopClusterStrength =
                swingCount * 0.4 + wickTouches * 0.4 + volumeAtLevel * 0.2;

            zones.push({
                id: makeZoneId('STOP_CLUSTER', swingPrice),
                type: 'STOP_CLUSTER',
                priceMin: swingPrice - tolerance,
                priceMax: swingPrice + tolerance,
                strength: stopClusterStrength,
            });
        }

        // ── Liquidation Shelves (Formula 9) ───────────────────────────────────
        const shelfRisks = allSwings.map(swing => ({
            swing,
            risk: openInterest / (Math.abs(currentPrice - swing.price) + 1),
        }));

        shelfRisks.sort((a, b) => b.risk - a.risk);
        const top3Shelves = shelfRisks.slice(0, 3);

        // Normalize shelf strength to [0,1] relative to the highest shelf risk
        const maxShelfRisk = top3Shelves[0]?.risk ?? 1;

        for (const { swing, risk } of top3Shelves) {
            const tolerance = swing.price * 0.001;
            zones.push({
                id: makeZoneId('LIQ_SHELF', swing.price),
                type: 'LIQ_SHELF',
                priceMin: swing.price - tolerance,
                priceMax: swing.price + tolerance,
                strength: Math.min(1, risk / maxShelfRisk), // normalized [0,1]
            });
        }

        // ── Fair Value Gaps (Spec 5.2.3) ──────────────────────────────────────
        for (let i = 0; i < candles.length - 2; i++) {
            const c0 = candles[i];
            const c2 = candles[i + 2];

            // Bullish FVG: gap between c0.high and c2.low (c0.high < c2.low)
            if (c0.high < c2.low) {
                zones.push({
                    id: makeZoneId('FVG', (c0.high + c2.low) / 2),
                    type: 'FVG',
                    priceMin: c0.high,
                    priceMax: c2.low,
                    strength: 1.0,
                    filled: false,
                });
            }

            // Bearish FVG: gap between c2.high and c0.low (c0.low > c2.high)
            if (c0.low > c2.high) {
                zones.push({
                    id: makeZoneId('FVG', (c0.low + c2.high) / 2),
                    type: 'FVG',
                    priceMin: c2.high,
                    priceMax: c0.low,
                    strength: 1.0,
                    filled: false,
                });
            }
        }

        // ── Resistant Clusters (Formula 10) ───────────────────────────────────
        // Find price levels where multiple zone types overlap within 0.5% range
        const nonClusterZones = zones.filter(z => z.type !== 'RESISTANT_CLUSTER');

        for (let i = 0; i < nonClusterZones.length; i++) {
            const anchor = nonClusterZones[i];
            const anchorMid = (anchor.priceMin + anchor.priceMax) / 2;
            const clusterTolerance = anchorMid * 0.005; // 0.5%

            const overlapping = nonClusterZones.filter(z => {
                const zMid = (z.priceMin + z.priceMax) / 2;
                return Math.abs(zMid - anchorMid) <= clusterTolerance;
            });

            // Only create cluster if multiple different zone types overlap
            const types = new Set(overlapping.map(z => z.type));
            if (types.size > 1) {
                const clusterStrength = overlapping.reduce((sum, z) => sum + z.strength, 0);
                if (clusterStrength > 1.0) {
                    const priceMin = Math.min(...overlapping.map(z => z.priceMin));
                    const priceMax = Math.max(...overlapping.map(z => z.priceMax));
                    const midPrice = (priceMin + priceMax) / 2;

                    // Avoid duplicate resistant clusters at the same price
                    const alreadyExists = zones.some(
                        z =>
                            z.type === 'RESISTANT_CLUSTER' &&
                            Math.abs((z.priceMin + z.priceMax) / 2 - midPrice) <= clusterTolerance,
                    );

                    if (!alreadyExists) {
                        zones.push({
                            id: makeZoneId('RESISTANT_CLUSTER', midPrice),
                            type: 'RESISTANT_CLUSTER',
                            priceMin,
                            priceMax,
                            strength: Math.min(1, clusterStrength / overlapping.length), // normalized average
                        });
                    }
                }
            }
        }

        return {
            zones,
            premiumZone: marketStructure.premiumZone,
            discountZone: marketStructure.discountZone,
            structureBounds: marketStructure.structureBounds,
        };
    },
};
