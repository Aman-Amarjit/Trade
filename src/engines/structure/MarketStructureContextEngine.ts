import type {
    Engine,
    EngineError,
    SwingPoint,
    VolatilityRegime,
    MarketStructureOutput,
    TrendClassification,
} from '../../../shared/types/index.js';

export interface MarketStructureInput {
    swings: SwingPoint[];
    candles: Array<{ high: number; low: number; open: number; close: number; timestamp: string }>;
    volatilityRegime: VolatilityRegime;
}

function isValidCandle(c: { high: number; low: number; open: number; close: number }): boolean {
    return (
        typeof c.high === 'number' && isFinite(c.high) &&
        typeof c.low === 'number' && isFinite(c.low) &&
        typeof c.open === 'number' && isFinite(c.open) &&
        typeof c.close === 'number' && isFinite(c.close)
    );
}

export const MarketStructureContextEngine: Engine<MarketStructureInput, MarketStructureOutput> = {
    name: 'MarketStructureContextEngine',
    version: '1.0.0',

    execute(input: MarketStructureInput): MarketStructureOutput | EngineError {
        const { candles, volatilityRegime } = input;

        // NOTE: Swing detection uses H(t) > H(t-1) AND H(t) > H(t+1) per spec Section 6.1.1.
        // This requires the next candle to confirm a swing high/low, introducing a 1-candle lag.
        // This is intentional — unconfirmed swings would produce false structure signals.
        // At 1m timeframe this is a 60-second lag; at 15m it is 15 minutes.

        // Validation: minimum 3 candles required
        if (!candles || candles.length < 3) {
            return {
                type: 'MISSING_DATA',
                message: 'At least 3 candles are required for market structure analysis',
                recoverable: false,
            };
        }

        // Validation: check for NaN/invalid candle values
        for (let i = 0; i < candles.length; i++) {
            if (!isValidCandle(candles[i])) {
                return {
                    type: 'VALIDATION',
                    message: `Candle at index ${i} contains invalid (NaN or non-finite) values`,
                    recoverable: false,
                };
            }
        }

        // Detect swing highs (Formula 21): H(t) > H(t-1) AND H(t) > H(t+1)
        // Detect swing lows (Formula 22): L(t) < L(t-1) AND L(t) < L(t+1)
        const detectedSwings: SwingPoint[] = [];

        for (let i = 1; i < candles.length - 1; i++) {
            const prev = candles[i - 1];
            const curr = candles[i];
            const next = candles[i + 1];

            if (curr.high > prev.high && curr.high > next.high) {
                detectedSwings.push({
                    price: curr.high,
                    timestamp: curr.timestamp,
                    type: 'HIGH',
                    isExternal: false, // will be classified below
                });
            }

            if (curr.low < prev.low && curr.low < next.low) {
                detectedSwings.push({
                    price: curr.low,
                    timestamp: curr.timestamp,
                    type: 'LOW',
                    isExternal: false, // will be classified below
                });
            }
        }

        // Merge with provided swings (use detected swings as primary source)
        const allSwings = detectedSwings.length > 0 ? detectedSwings : (input.swings ?? []);

        // Compute overall price range across all candles
        const allHighs = candles.map(c => c.high);
        const allLows = candles.map(c => c.low);
        const overallHigh = Math.max(...allHighs);
        const overallLow = Math.min(...allLows);
        const overallRange = overallHigh - overallLow;

        // Classify swings: top 30% of range → external, else internal
        const externalThreshold = overallLow + overallRange * 0.7;

        const internalSwings: SwingPoint[] = [];
        const externalSwings: SwingPoint[] = [];

        for (const swing of allSwings) {
            const isExternal = swing.price >= externalThreshold;
            const classified: SwingPoint = { ...swing, isExternal };
            if (isExternal) {
                externalSwings.push(classified);
            } else {
                internalSwings.push(classified);
            }
        }

        // Compute structureBounds: [min of all swing lows, max of all swing highs]
        const swingHighs = allSwings.filter(s => s.type === 'HIGH').map(s => s.price);
        const swingLows = allSwings.filter(s => s.type === 'LOW').map(s => s.price);

        const structureLow = swingLows.length > 0 ? Math.min(...swingLows) : overallLow;
        const structureHigh = swingHighs.length > 0 ? Math.max(...swingHighs) : overallHigh;

        // Guard: if structure collapsed to a single price (flat market), use candle range
        const finalLow = structureLow < structureHigh ? structureLow : overallLow;
        const finalHigh = structureLow < structureHigh ? structureHigh : overallHigh;

        // If still flat (all candles identical), use ATR-based spread around current price
        const spread = finalHigh - finalLow;
        const guardedLow = spread > 0 ? finalLow : finalLow * 0.999;
        const guardedHigh = spread > 0 ? finalHigh : finalHigh * 1.001;

        const structureBounds: [number, number] = [guardedLow, guardedHigh];

        // Compute midpoint for premium/discount zones
        const midpoint = (guardedLow + guardedHigh) / 2;
        const premiumZone: [number, number] = [midpoint, guardedHigh];
        const discountZone: [number, number] = [guardedLow, midpoint];

        // Classify trend using last 2 swing highs and last 2 swing lows
        const sortedHighs = swingHighs.slice(-2);
        const sortedLows = swingLows.slice(-2);

        let trend: TrendClassification = 'RANGE';

        if (sortedHighs.length >= 2 && sortedLows.length >= 2) {
            const highsAscending = sortedHighs[1] > sortedHighs[0];
            const lowsAscending = sortedLows[1] > sortedLows[0];
            const highsDescending = sortedHighs[1] < sortedHighs[0];
            const lowsDescending = sortedLows[1] < sortedLows[0];

            if (highsAscending && lowsAscending) {
                trend = 'UP';
            } else if (highsDescending && lowsDescending) {
                trend = 'DOWN';
            }
        }

        return {
            internalSwings,
            externalSwings,
            trend,
            premiumZone,
            discountZone,
            structureBounds,
        };
    },
};
