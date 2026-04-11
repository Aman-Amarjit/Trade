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

        // Edge case: invalid or insufficient data
        // Curvature requires 4 points (backward-looking second difference); rotation requires 3.
        const allPricesFinite = priceSeries.every(p => Number.isFinite(p));
        if (priceSeries.length < 4 || !Number.isFinite(atr) || atr <= 0 || !allPricesFinite) {
            console.warn(
                `[GeometryClassifier] Invalid or insufficient data (len: ${priceSeries.length}, atr: ${atr}). Returning null output.`,
            );
            return { ...NULL_OUTPUT };
        }

        const n = priceSeries.length;
        // Rotation indices (backward-looking, already causal): t = n-2, tPrev = n-3
        const tPrev = n - 3; // t-1
        const t = n - 2;     // t

        // Formula 1 — curvature (backward-looking one-sided second difference — causal, no future data)
        // Uses [n-4, n-3, n-2] = [t-2, t-1, t] so no future candle is needed.
        const tPrev2 = n - 4; // t-2
        const denominator = Math.max(atr, 1e-6);
        const curvature = Math.abs(priceSeries[tPrev2] - 2 * priceSeries[tPrev] + priceSeries[t]) / denominator;

        // Formula 2 — imbalance
        // Ensure zWicks is not zero or extremely small
        const safeZWicks = Math.max(zWicks, 1e-6);
        const wickTerm = zWicks === 0 ? 0 : 0.5 * (wickUp - wickDown) / safeZWicks;
        const totalVolume = askVolume + bidVolume;
        const volumeTerm = totalVolume === 0 ? 0 : 0.5 * Math.abs(askVolume - bidVolume) / totalVolume;
        const imbalance = wickTerm + volumeTerm;

        // Formula 3 — rotation: (P(t) - P(t-1)) / ATR  [PDF Section 5.1.3]
        // Uses current minus previous (backward-looking), not forward-looking
        const rotation = (priceSeries[t] - priceSeries[tPrev]) / denominator;

        // Formula 4 — structurePressure
        const structurePressure = 1 / (1 + curvature + Math.abs(imbalance));

        // Formula 5 — rotationPressure
        const rotationPressure = Math.abs(rotation);

        // Clamp curvature and |imbalance| before sigmoid inputs to prevent saturation.
        // During flash crashes curvature can exceed 50, making σ(50) ≈ 1.0 always.
        // Clamping to [0, 3] keeps the sigmoid in its informative range.
        const clampedCurvature = Math.min(curvature, 3.0);
        const clampedAbsImbalance = Math.min(Math.abs(imbalance), 1.0);

        // Formula 6 — collapseProb
        const collapseProb = sigmoid(clampedCurvature + clampedAbsImbalance - structurePressure);

        // Formula 7 — breakoutProb
        // Use |imbalance| for symmetric breakout probability (both up and down breaks)
        // Directional bias is captured separately via rotation sign
        const breakoutProb = sigmoid(rotationPressure + clampedAbsImbalance);

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
