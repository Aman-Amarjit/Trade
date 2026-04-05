import type {
    Engine,
    EngineError,
    PredictionOutput,
    RegimePersistence,
    SessionType,
} from '../../../shared/types/index.js';

export interface PredictionInput {
    G: number;
    L: number;
    V: number;
    M: number;
    O: number;
    X: number;
    weights: { w1: number; w2: number; w3: number; w4: number; w5: number; w6: number };
    atr: number;
    volatilityFactor: number;
    attractorStrength: number;
    distanceToPrice: number;
    previousSmoothed?: number;
    regimePersistence: RegimePersistence;
    sessionType: SessionType;
    assetVolatilityProfile: number;
    signalAge: number;
    decayHalfLife: number;
}

const SESSION_FACTORS: Record<SessionType, number> = {
    ASIA: 0.8,
    LONDON: 1.1,
    NEWYORK: 1.2,
    POSTNY: 0.9,
    WEEKEND: 0.5,
};

export const PredictionEngine: Engine<PredictionInput, PredictionOutput> = {
    name: 'PredictionEngine',
    version: '1.0.0',

    execute(input: PredictionInput): PredictionOutput | EngineError {
        if (input == null) {
            return { type: 'VALIDATION', message: 'Input is null or undefined', recoverable: false };
        }

        const { G, L, V, M, O, X, weights, atr, volatilityFactor, attractorStrength,
            distanceToPrice, previousSmoothed, regimePersistence, sessionType,
            assetVolatilityProfile, signalAge, decayHalfLife } = input;

        // Validate inputs in [0,1]
        for (const [name, val] of [['G', G], ['L', L], ['V', V], ['M', M], ['O', O], ['X', X]] as [string, number][]) {
            if (typeof val !== 'number' || val < 0 || val > 1) {
                return { type: 'VALIDATION', message: `Input ${name} must be in [0, 1], got ${val}`, recoverable: false };
            }
        }

        // Validate weights sum to 1
        const { w1, w2, w3, w4, w5, w6 } = weights;
        const weightSum = w1 + w2 + w3 + w4 + w5 + w6;
        if (Math.abs(weightSum - 1.0) > 1e-9) {
            return { type: 'VALIDATION', message: `Weights must sum to 1.0, got ${weightSum}`, recoverable: false };
        }

        // Validate atr > 0
        if (atr <= 0) {
            return { type: 'VALIDATION', message: `atr must be > 0, got ${atr}`, recoverable: false };
        }

        // Formula 11/28 — StrictLine
        const rawStrictLine = w1 * G + w2 * L + w3 * V + w4 * M + w5 * O + w6 * X;

        // Formula 12/30 — LiquidityBias
        const liquidityBias = Math.min(1, attractorStrength / (distanceToPrice + 0.1));

        // atrNorm — ATR as fraction of price, scaled to prediction space [0,1]
        // PDF Formula 13: Band_k = StrictLine ± (ATR × k)
        // Since StrictLine is [0,1] and ATR is in USD, we normalize:
        // atrNorm = ATR / (ATR + distanceToPrice × 1000) clamped to [0.02, 0.12]
        // This gives meaningful band width proportional to volatility
        const atrNorm = Math.min(Math.max(atr / (atr + distanceToPrice * 1000), 0.02), 0.12);

        // Session adjustment (Spec 7.10) — applied first so all outputs are consistent
        const sessionFactor = SESSION_FACTORS[sessionType] ?? 1.0;
        const strictLine = rawStrictLine * sessionFactor;

        // Formula 14/32 — MinMax zone — centered on session-adjusted strictLine
        const Vf = Math.max(1.0, Math.min(2.5, volatilityFactor));
        const min = Math.max(0, strictLine - Vf * atrNorm);
        const max = Math.min(1, strictLine + Vf * atrNorm);

        // Confidence bands — centered on session-adjusted strictLine
        const band50: [number, number] = [
            Math.max(0, strictLine - atrNorm * 0.5),
            Math.min(1, strictLine + atrNorm * 0.5),
        ];
        const band80: [number, number] = [
            Math.max(0, strictLine - atrNorm * 1.0),
            Math.min(1, strictLine + atrNorm * 1.0),
        ];
        const band95: [number, number] = [
            Math.max(0, strictLine - atrNorm * 1.5),
            Math.min(1, strictLine + atrNorm * 1.5),
        ];

        // Formula 15/33 — Temporal smoothing (on session-adjusted value)
        const alpha = regimePersistence === 'HIGH_PERSISTENCE' ? 0.4
            : regimePersistence === 'MEDIUM_PERSISTENCE' ? 0.3
                : 0.2;
        const smoothed = alpha * strictLine + (1 - alpha) * (previousSmoothed ?? strictLine);

        // Formula 16/34 — Signal decay (on session-adjusted value)
        const T = Math.max(20, Math.min(40, decayHalfLife));
        const decayed = strictLine * Math.exp(-signalAge / T);

        // Volatility adjustment
        const volatilityAdjustment = atr * assetVolatilityProfile;

        return {
            strictLine,
            min,
            max,
            band50,
            band80,
            band95,
            liquidityBias,
            volatilityAdjustment,
            smoothed,
            decayed,
            timestamp: new Date().toISOString(),
        };
    },
};
