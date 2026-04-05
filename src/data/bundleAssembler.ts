// Bundle assembler — derived metrics computation and UnifiedDataBundle assembly
// Requirements: 6.1, 6.2, 6.3

import type { UnifiedDataBundle, SwingPoint, FVGZone, StopCluster, LiqShelf, SessionType, TrendClassification } from '../../shared/types/index.js';
import type { OHLCVBar, OrderflowSnapshot, VolatilityMetrics, MacroIndicators } from './adapters/DataAdapter.js';
import { normalizeVolume, normalizeATR, normalizeDelta } from './normalization.js';

export interface RollingStats {
    rollingMeanVolume: number;
    rollingATR: number;
    rollingDeltaStd: number;
    atrPercentile: number;
    bandwidth: number;
    previousCvd: number;
}

export interface RawBundleInput {
    bar: OHLCVBar;
    orderflow: OrderflowSnapshot;
    volatility: VolatilityMetrics;
    macro: MacroIndicators;
    swings: SwingPoint[];
    trend: TrendClassification;
    internalSwings: SwingPoint[];
    externalSwings: SwingPoint[];
    fvg: FVGZone[];
    stopClusters: StopCluster[];
    liqShelves: LiqShelf[];
    sessionType: SessionType;
    sessionVolatilityPattern: number;
}

/**
 * Compute derived metrics from raw inputs.
 * Requirements: 6.1, 6.2
 */
export function computeDerivedMetrics(raw: RawBundleInput, rollingStats: RollingStats): {
    priceMid: number;
    volumeRelative: number;
    volumeDelta: number;
    volumeCvd: number;
    orderflowImbalance: number;
    atrNorm: number;
    atrPercentile: number;
    bandwidth: number;
} {
    const { bar, orderflow, volatility } = raw;

    // price.mid = (high + low) / 2
    const priceMid = (bar.high + bar.low) / 2;

    // volume.relative = V / rollingMeanVolume (Formula 40)
    const volumeRelative = normalizeVolume(bar.volume, rollingStats.rollingMeanVolume);

    // volume.delta = ask - bid
    const volumeDelta = orderflow.ask - orderflow.bid;

    // volume.cvd = cumulative volume delta
    const volumeCvd = rollingStats.previousCvd + volumeDelta;

    // orderflow.imbalance = (ask - bid) / (ask + bid), clamped to [-1, 1]
    const totalFlow = orderflow.ask + orderflow.bid;
    const orderflowImbalance = totalFlow === 0 ? 0 : (orderflow.ask - orderflow.bid) / totalFlow;

    // volatility.atrNorm = ATR / rollingATR (Formula 41)
    const atrNorm = normalizeATR(volatility.atr, rollingStats.rollingATR);

    // volatility.atrPercentile from rolling stats or volatility metrics
    const atrPercentile = rollingStats.atrPercentile;

    // volatility.bandwidth from rolling stats or volatility metrics
    const bandwidth = rollingStats.bandwidth;

    return {
        priceMid,
        volumeRelative,
        volumeDelta,
        volumeCvd,
        orderflowImbalance,
        atrNorm,
        atrPercentile,
        bandwidth,
    };
}

/**
 * Assemble an immutable UnifiedDataBundle from validated and normalized inputs.
 * Attaches a monotonically increasing seq number.
 * Requirements: 6.1, 6.2, 6.3
 */
export function assembleBundle(
    raw: RawBundleInput,
    seq: number,
    rollingStats: RollingStats,
): Readonly<UnifiedDataBundle> {
    const derived = computeDerivedMetrics(raw, rollingStats);
    const { bar, orderflow, volatility, macro } = raw;

    const bundle: UnifiedDataBundle = {
        seq,
        price: {
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            mid: derived.priceMid,
        },
        volume: {
            raw: bar.volume,
            relative: derived.volumeRelative,
            delta: derived.volumeDelta,
            cvd: derived.volumeCvd,
        },
        orderflow: {
            bid: orderflow.bid,
            ask: orderflow.ask,
            imbalance: derived.orderflowImbalance,
        },
        volatility: {
            atr: volatility.atr,
            atrNorm: derived.atrNorm,
            atrPercentile: derived.atrPercentile,
            bandwidth: derived.bandwidth,
        },
        structure: {
            swings: raw.swings,
            trend: raw.trend,
            internal: raw.internalSwings,
            external: raw.externalSwings,
        },
        liquidity: {
            fvg: raw.fvg,
            stopClusters: raw.stopClusters,
            liqShelves: raw.liqShelves,
        },
        macro: {
            dxy: macro.dxy,
            vix: macro.vix,
            spx: macro.spx,
            gold: macro.gold,
            sentiment: macro.sentiment,
            fundingRate: macro.fundingRate,
            etfFlows: macro.etfFlows,
        },
        session: {
            type: raw.sessionType,
            volatilityPattern: raw.sessionVolatilityPattern,
        },
        timestamp: bar.timestamp,
    };

    return Object.freeze(bundle);
}
