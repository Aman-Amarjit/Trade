// Data Layer normalization functions
// Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6

/**
 * Normalize price to [0, 1] using min-max scaling.
 * Formula 39: P_norm = (P - P_min) / (P_max - P_min)
 * Edge case: division by zero (Pmax === Pmin) returns 0.
 * NaN/Infinity inputs return 0.
 * Requirements: 7.1
 */
export function normalizePrice(P: number, Pmin: number, Pmax: number): number {
    if (!Number.isFinite(P) || !Number.isFinite(Pmin) || !Number.isFinite(Pmax)) return 0;
    const range = Pmax - Pmin;
    if (range <= 0) return 0;
    const normalized = (P - Pmin) / range;
    return Math.max(0, Math.min(1, normalized));
}

/**
 * Normalize volume relative to rolling mean.
 * Formula 40: V_norm = V / rollingMeanVolume
 * Edge case: division by zero returns 0.
 * NaN/Infinity inputs return 0.
 * Requirements: 7.2
 */
export function normalizeVolume(V: number, rollingMeanVolume: number): number {
    if (!Number.isFinite(V) || !Number.isFinite(rollingMeanVolume)) return 0;
    if (rollingMeanVolume <= 0) return 0;
    return V / rollingMeanVolume;
}

/**
 * Normalize ATR relative to rolling ATR.
 * Formula 41: ATR_norm = ATR / rollingATR
 * Edge case: division by zero returns 0.
 * NaN/Infinity inputs return 0.
 * Requirements: 7.3
 */
export function normalizeATR(ATR: number, rollingATR: number): number {
    if (!Number.isFinite(ATR) || !Number.isFinite(rollingATR)) return 0;
    if (rollingATR <= 0) return 0;
    return ATR / rollingATR;
}

/**
 * Normalize orderflow delta relative to rolling delta standard deviation.
 * Formula 42: delta_norm = delta / rollingDeltaStd
 * Edge case: division by zero returns 0.
 * NaN/Infinity inputs return 0.
 * Requirements: 7.4
 */
export function normalizeDelta(delta: number, rollingDeltaStd: number): number {
    if (!Number.isFinite(delta) || !Number.isFinite(rollingDeltaStd)) return 0;
    if (rollingDeltaStd <= 0) return 0;
    return delta / rollingDeltaStd;
}

/**
 * Normalize a macro indicator to [0, 1] using min-max scaling.
 * Edge case: division by zero returns 0.
 * NaN/Infinity inputs return 0.
 * Requirements: 7.5
 */
export function normalizeMacroIndicator(value: number, min: number, max: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return 0;
    const range = max - min;
    if (range <= 0) return 0;
    const normalized = (value - min) / range;
    return Math.max(0, Math.min(1, normalized));
}

/**
 * Normalize a PredictionEngine input value, clamping to [0, 1].
 * All six component inputs (G, L, V, M, O, X) must be in [0, 1].
 * NaN/Infinity inputs return 0.
 * Requirements: 7.6
 */
export function normalizePredictionInput(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}
