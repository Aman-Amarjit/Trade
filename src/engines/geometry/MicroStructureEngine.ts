import type {
    Engine,
    EngineError,
    GeometryOutput,
    LiquidityZone,
    MicrostructureOutput,
    TrendClassification,
} from '../../../shared/types/index.js';

export interface MicroStructureInput {
    candles: Array<{ high: number; low: number; open: number; close: number; timestamp: string }>;
    orderflow: { bid: number; ask: number; delta: number; cvd: number };
    geometry: GeometryOutput;
    liquidityZones: LiquidityZone[];
    previousClose?: number;
    htfTrend?: TrendClassification;
}

export const MicroStructureEngine: Engine<MicroStructureInput, MicrostructureOutput> = {
    name: 'MicroStructureEngine',
    version: '1.0.0',

    execute(input: MicroStructureInput): MicrostructureOutput | EngineError {
        // Validation
        if (!input?.candles || input.candles.length === 0) {
            return {
                type: 'MISSING_DATA',
                message: 'candles must be a non-empty array',
                recoverable: false,
            };
        }

        const { candles, orderflow, liquidityZones, previousClose, htfTrend } = input;
        const lastCandle = candles[candles.length - 1];

        // sweep: last candle briefly pierced a STOP_CLUSTER zone and closed back inside
        const stopClusters = liquidityZones.filter(z => z.type === 'STOP_CLUSTER');
        const sweep = stopClusters.some(
            zone =>
                (lastCandle.high > zone.priceMax && lastCandle.close < zone.priceMax) ||
                (lastCandle.low < zone.priceMin && lastCandle.close > zone.priceMin),
        );

        // divergence: price vs orderflow.delta
        let divergence = false;
        if (previousClose !== undefined) {
            const priceUp = lastCandle.close > previousClose;
            const priceDown = lastCandle.close < previousClose;
            divergence =
                (priceUp && orderflow.delta < 0) ||
                (priceDown && orderflow.delta > 0);
        }

        // cvdDivergence: price vs orderflow.cvd
        let cvdDivergence = false;
        if (previousClose !== undefined) {
            const priceUp = lastCandle.close > previousClose;
            const priceDown = lastCandle.close < previousClose;
            cvdDivergence =
                (priceUp && orderflow.cvd < 0) ||
                (priceDown && orderflow.cvd > 0);
        }

        // bosDetected: close beyond highest high or below lowest low (proxy)
        const highestHigh = Math.max(...candles.map(c => c.high));
        const lowestLow = Math.min(...candles.map(c => c.low));
        const bosDetected =
            lastCandle.close > highestHigh * 0.999 ||
            lastCandle.close < lowestLow * 1.001;

        // retestZone: close within any liquidity zone
        const retestZone = liquidityZones.some(
            zone => lastCandle.close >= zone.priceMin && lastCandle.close <= zone.priceMax,
        );

        // htfAlignment
        let htfAlignment = false;
        if (htfTrend !== undefined) {
            htfAlignment =
                (htfTrend === 'UP' && orderflow.delta > 0) ||
                (htfTrend === 'DOWN' && orderflow.delta < 0) ||
                htfTrend === 'RANGE';
        }

        // alignmentScore: sum of booleans / 6, clamped [0, 1]
        const score =
            (Number(sweep) +
                Number(divergence) +
                Number(cvdDivergence) +
                Number(bosDetected) +
                Number(retestZone) +
                Number(htfAlignment)) /
            6;
        const alignmentScore = Math.min(1, Math.max(0, score));

        return {
            sweep,
            divergence,
            cvdDivergence,
            bosDetected,
            retestZone,
            htfAlignment,
            alignmentScore,
        };
    },
};
