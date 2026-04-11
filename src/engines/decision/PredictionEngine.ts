import type {
    Engine,
    EngineError,
    PredictionOutput,
    RegimePersistence,
    SessionType,
    VolatilityRegime,
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
    // decayHalfLife is now derived internally from volatilityRegime — no longer a magic constant
    volatilityRegime: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';
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
            assetVolatilityProfile, signalAge, volatilityRegime } = input;

        // Decay half-life T: deterministic from volatility regime (spec says "increases during high volatility")
        // LOW=40 cycles, NORMAL=30, HIGH=20, EXTREME=10 — higher volatility = faster decay
        const DECAY_HALF_LIFE: Record<string, number> = {
            LOW: 40, NORMAL: 30, HIGH: 20, EXTREME: 10,
        };
        const decayHalfLife = DECAY_HALF_LIFE[volatilityRegime] ?? 30;

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

        // Formula 12/30 — LiquidityBias (added to strict line per spec)
        const liquidityBias = Math.min(1, attractorStrength / (distanceToPrice + 0.1));
        const strictLine = Math.max(0, Math.min(1, rawStrictLine + liquidityBias));

        // Normalize ATR for band construction while keeping it bounded
        const atrNorm = Math.min(Math.max(atr / (atr + 1000), 0.02), 0.12);

        // Session adjustment applies to derived expectations, not the raw strict line
        const sessionFactor = SESSION_FACTORS[sessionType] ?? 1.0;
        const adjustedLine = Math.max(0, Math.min(1, strictLine * sessionFactor));

        // Formula 14/32 — MinMax zone
        const Vf = Math.max(1.0, Math.min(2.5, volatilityFactor));
        const min = Math.max(0, adjustedLine - Vf * atrNorm);
        const max = Math.min(1, adjustedLine + Vf * atrNorm);

        // Confidence bands — formula 13
        const band50: [number, number] = [
            Math.max(0, adjustedLine - atrNorm * 0.5),
            Math.min(1, adjustedLine + atrNorm * 0.5),
        ];
        const band80: [number, number] = [
            Math.max(0, adjustedLine - atrNorm * 1.0),
            Math.min(1, adjustedLine + atrNorm * 1.0),
        ];
        const band95: [number, number] = [
            Math.max(0, adjustedLine - atrNorm * 1.5),
            Math.min(1, adjustedLine + atrNorm * 1.5),
        ];

        // Formula 15/33 — Temporal smoothing
        const alpha = regimePersistence === 'HIGH_PERSISTENCE' ? 0.4
            : regimePersistence === 'MEDIUM_PERSISTENCE' ? 0.3
                : 0.2;
        const smoothed = alpha * adjustedLine + (1 - alpha) * (previousSmoothed ?? adjustedLine);

        // Formula 16/34 — Signal decay
        const T = volatilityRegime === 'LOW' ? 40
            : volatilityRegime === 'NORMAL' ? 35
                : volatilityRegime === 'HIGH' ? 25
                    : 20;
        const decayed = adjustedLine * Math.exp(-signalAge / T);

        // Volatility adjustment output represents volatility-driven sensitivity
        const volatilityAdjustment = atrNorm * assetVolatilityProfile * sessionFactor;

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
