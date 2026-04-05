import type {
    Engine,
    EngineError,
    GeometryOutput,
    GeometryRegime,
} from '../../../shared/types/index.js';

export interface GeometryInput {
    priceSeries: number[];   // close prices, minimum 3 required
    atr: number;
    wickUp: number;          // high - close
    wickDown: number;        // close - low
    zWicks: number;          // normalization factor (ATR or candle range)
    askVolume: number;
    bidVolume: number;
}

function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
}

const NULL_OUTPUT: GeometryOutput = {
    curvature: null,
    imbalance: null,
    rotation: null,
    structurePressure: null,
    rotationPressure: null,
    collapseProb: null,
    breakoutProb: null,
    geometryRegime: null,
    microState: null,
    isStable: false,
};

export const GeometryClassifier: Engine<GeometryInput, GeometryOutput> = {
    name: 'GeometryClassifier',
    version: '1.0.0',

    execute(input: GeometryInput): GeometryOutput | EngineError {
        // Validation: null/undefined input
        if (input == null) {
            return {
                type: 'VALIDATION',
                message: 'Input is null or undefined',
                recoverable: false,
            };
        }
        if (!Array.isArray(input.priceSeries)) {
            return {
                type: 'VALIDATION',
                message: 'priceSeries must be an array',
                recoverable: false,
            };
        }

        const { priceSeries, atr, wickUp, wickDown, zWicks, askVolume, bidVolume } = input;

        // Edge case: insufficient data
        if (priceSeries.length < 3 || atr <= 0) {
            console.warn(
                '[GeometryClassifier] Insufficient data: priceSeries.length < 3 or atr <= 0. Returning null output.',
            );
            return { ...NULL_OUTPUT };
        }

        const n = priceSeries.length;
        const tPrev = n - 3; // t-1
        const t = n - 2; // t
        const tNext = n - 1; // t+1

        // Formula 1 — curvature
        const curvature = Math.abs(priceSeries[tPrev] - 2 * priceSeries[t] + priceSeries[tNext]) / atr;

        // Formula 2 — imbalance
        const wickTerm = zWicks === 0 ? 0 : 0.5 * (wickUp - wickDown) / zWicks;
        const totalVolume = askVolume + bidVolume;
        const volumeTerm = totalVolume === 0 ? 0 : 0.5 * Math.abs(askVolume - bidVolume) / totalVolume;
        const imbalance = wickTerm + volumeTerm;

        // Formula 3 — rotation
        const rotation = (priceSeries[tNext] - priceSeries[t]) / atr;

        // Formula 4 — structurePressure
        const structurePressure = 1 / (1 + curvature + Math.abs(imbalance));

        // Formula 5 — rotationPressure
        const rotationPressure = Math.abs(rotation);

        // Formula 6 — collapseProb
        const collapseProb = sigmoid(curvature + Math.abs(imbalance) - structurePressure);

        // Formula 7 — breakoutProb
        const breakoutProb = sigmoid(rotationPressure + imbalance);

        // geometryRegime classification (Spec 5.1.8)
        let geometryRegime: GeometryRegime;
        if (curvature < 0.5 && structurePressure > 0.6) {
            geometryRegime = 'STABLE_STRUCTURE';
        } else if (rotationPressure > 0.5 && collapseProb < 0.4) {
            geometryRegime = 'EXPANDING_STRUCTURE';
        } else if (collapseProb > 0.6) {
            geometryRegime = 'COLLAPSING_STRUCTURE';
        } else {
            geometryRegime = 'CHAOTIC_STRUCTURE';
        }

        // microState (Spec 5.1.9)
        const direction = rotation > 0.1 ? 'up' : rotation < -0.1 ? 'down' : 'neutral';
        const stability =
            geometryRegime === 'STABLE_STRUCTURE'
                ? 'stable'
                : geometryRegime === 'CHAOTIC_STRUCTURE'
                    ? 'chaotic'
                    : 'unstable';
        const microState = `${direction}-${stability}`;

        // isStable
        const isStable =
            geometryRegime === 'STABLE_STRUCTURE' || geometryRegime === 'EXPANDING_STRUCTURE';

        return {
            curvature,
            imbalance,
            rotation,
            structurePressure,
            rotationPressure,
            collapseProb,
            breakoutProb,
            geometryRegime,
            microState,
            isStable,
        };
    },
};
