import type {
    Engine,
    EngineError,
    BreakoutCycleInput,
    BreakoutCycleOutput,
    RangeState,
    BreakoutDirection,
    LiquidityMapOutput,
    MarketStructureOutput,
    VolatilityRegime,
    MicrostructureOutput,
} from '../../../shared/types/index.js';

const DEFAULT_OUTPUT: BreakoutCycleOutput = {
    rangeState: 'EXPANSION',
    rh: 0,
    rl: 0,
    breakoutDirection: null,
    breakoutLevel: null,
    entry1: null,
    entry2: null,
    retestLevel: null,
    stopLoss: null,
    tp1: null,
    tp2: null,
    invalidated: false,
};

const MIN_RANGE_CANDLES = 10;
const MAX_RANGE_CANDLES = 30;
const BODY_MULTIPLIER = 1.5;
const VOLUME_MULTIPLIER = 1.5;
const RETEST_BUFFER_ATR = 0.1;
const SL_BUFFER_ATR = 0.1;
const TP_MULTIPLIER = 1.75;
const INVALIDATION_CANDLES = 3;
const ATR_SHRINK_THRESHOLD = 0.8;

export const BreakoutCycleEngine: Engine<BreakoutCycleInput, BreakoutCycleOutput> = {
    name: 'BreakoutCycleEngine',
    version: '1.0.0',

    execute(input: BreakoutCycleInput): BreakoutCycleOutput | EngineError {
        if (input == null) {
            return { type: 'VALIDATION', message: 'Input is null/undefined', recoverable: false };
        }
        if (!input.candles || input.candles.length < MIN_RANGE_CANDLES) {
            return { type: 'MISSING_DATA', message: `Need >=${MIN_RANGE_CANDLES} candles`, recoverable: true };
        }
        if (input.atr <= 0) {
            return { type: 'VALIDATION', message: 'ATR must be >0', recoverable: false };
        }
        const { candles, atr, avgRangeBody, avgRangeVolume, liquidityMap, marketStructure, volatilityRegime, microstructure } = input;
        const current = candles[candles.length - 1];

        // Ensure rh and rl are always populated from marketStructure context (Section 9.3)
        const rh = marketStructure.rh;
        const rl = marketStructure.rl;

        if (rh <= rl) return DEFAULT_OUTPUT;
        const rangeSize = rh - rl;

        const insideRange = candles.filter(c => c.low >= rl && c.high <= rh);
        const validRange = insideRange.length >= MIN_RANGE_CANDLES && insideRange.slice(-MAX_RANGE_CANDLES).length / MAX_RANGE_CANDLES > 0.7;

        const rangeAtr = (insideRange.slice(-20).reduce((sum, c, i, arr) => {
            if (i === 0) return 0;
            return sum + (Math.max(c.high, arr[i - 1].high) - Math.min(c.low, arr[i - 1].low));
        }, 0) / Math.max(1, insideRange.length - 1)) || atr;
        const atrShrunk = rangeAtr < atr * ATR_SHRINK_THRESHOLD;

        const recentBodies = insideRange.slice(-10).map(c => Math.abs(c.close - c.open));
        const avgRecentBody = recentBodies.reduce((a, b) => a + b, 0) / Math.max(recentBodies.length, 1);
        const bodiesShrinking = avgRecentBody < avgRangeBody * 0.9;

        const recentVols = insideRange.slice(-10).map(c => c.volume);
        const avgRecentVol = recentVols.reduce((a, b) => a + b, 0) / Math.max(recentVols.length, 1);
        const volStableOrDecline = avgRecentVol <= avgRangeVolume * 1.1;

        if (validRange && atrShrunk && bodiesShrinking && volStableOrDecline) {
            return {
                ...DEFAULT_OUTPUT,
                rangeState: 'CONTRACTION',
                rh,
                rl,
            };
        }

        let rangeState: RangeState = 'EXPANSION';
        let breakoutDirection: BreakoutDirection = null;
        let breakoutLevel: number | null = null;
        let entry1: number | null = null;
        let entry2: number | null = null;
        let retestLevel: number | null = null;
        let stopLoss: number | null = null;
        let tp1: number | null = null;
        let tp2: number | null = null;
        let invalidated = false;

        const body = Math.abs(current.close - current.open);
        const vol = current.volume || 0;
        const htfBullish = marketStructure.trend === 'UP' || microstructure.htfAlignment;
        const htfBearish = marketStructure.trend === 'DOWN' || !microstructure.htfAlignment;

        const breakoutCandidate = candles.slice(-5).find(c => {
            const cBody = Math.abs(c.close - c.open);
            const cVol = c.volume || 0;
            if (c.close > rh && cBody >= avgRangeBody * BODY_MULTIPLIER && cVol >= avgRangeVolume * VOLUME_MULTIPLIER && htfBullish && volatilityRegime !== 'EXTREME') {
                return true;
            }
            if (c.close < rl && cBody >= avgRangeBody * BODY_MULTIPLIER && cVol >= avgRangeVolume * VOLUME_MULTIPLIER && htfBearish && volatilityRegime !== 'EXTREME') {
                return true;
            }
            return false;
        });

        if (breakoutCandidate) {
            rangeState = 'BREAKOUT';
            breakoutDirection = breakoutCandidate.close > rh ? 'LONG' : 'SHORT';
            breakoutLevel = breakoutCandidate.close;
            entry1 = breakoutCandidate.close;
            const breakoutCandleLow = breakoutCandidate.low;
            const buffer = atr * SL_BUFFER_ATR;
            if (breakoutDirection === 'LONG') {
                stopLoss = Math.min(rl, breakoutCandleLow) - buffer;
                tp1 = entry1 + rangeSize;
                tp2 = entry1 + rangeSize * TP_MULTIPLIER;
            } else {
                stopLoss = Math.max(rh, breakoutCandleLow) + buffer;
                tp1 = entry1 - rangeSize;
                tp2 = entry1 - rangeSize * TP_MULTIPLIER;
            }
        }

        const retestCandidate = candles.slice(-5).find((c, idx, arr) => {
            const prev = idx > 0 ? arr[idx - 1] : null;
            if (!breakoutDirection) return false;
            const supports = breakoutDirection === 'LONG' ? c.low <= rh && c.close > rh : c.high >= rl && c.close < rl;
            const wickRejection = breakoutDirection === 'LONG'
                ? (c.high - c.close) / atr > 0.3
                : (c.close - c.low) / atr > 0.3;
            return supports && wickRejection && prev && ((breakoutDirection === 'LONG' && prev.close > rh) || (breakoutDirection === 'SHORT' && prev.close < rl));
        });

        if (retestCandidate && breakoutDirection) {
            rangeState = 'RETEST';
            const buffer = atr * RETEST_BUFFER_ATR;
            entry2 = breakoutDirection === 'LONG' ? rh + buffer : rl - buffer;
            retestLevel = entry2;
        }

        if (rangeState === 'BREAKOUT' || rangeState === 'RETEST') {
            const insideCount = candles.slice(-INVALIDATION_CANDLES).filter(c => c.close >= rl && c.close <= rh).length;
            const microBearish = breakoutDirection === 'LONG' && microstructure.sweep && !microstructure.htfAlignment;
            const microBullishInvalidation = breakoutDirection === 'SHORT' && microstructure.sweep && microstructure.htfAlignment;
            const liqSweep = liquidityMap.zones.some(z => z.type === 'STOP_CLUSTER' &&
                Math.abs(current.close - (z.priceMin + z.priceMax) / 2) < atr * 0.2);

            invalidated = insideCount >= INVALIDATION_CANDLES || microBearish || microBullishInvalidation || liqSweep;
            if (invalidated) {
                rangeState = 'CONTRACTION';
            }
        }

        return {
            rangeState,
            rh,
            rl,
            breakoutDirection,
            breakoutLevel,
            entry1,
            entry2,
            retestLevel,
            stopLoss,
            tp1,
            tp2,
            invalidated,
        };
    },
};

