import type {
    Engine,
    EngineError,
    GeometryOutput,
    MicrostructureOutput,
    RiskOutput,
    ScoringOutput,
    StressState,
    VolatilityRegime,
    BreakoutCycleOutput,
} from '../../../shared/types/index.js';

export interface RiskInput {
    scoring: ScoringOutput;
    geometry: GeometryOutput;
    microstructure: MicrostructureOutput;
    breakoutCycle?: BreakoutCycleOutput;
    volatilityRegime: VolatilityRegime;
    globalStress: StressState;
    atr: number;
    volatilityFactor: number;
    stopMultiplier: number;
    eddThreshold: number;
    targetMultiplier: number;
    currentPrice: number;
    dailyDrawdown: number;
    dailyDrawdownCap: number;
}

export const RiskManager: Engine<RiskInput, RiskOutput> = {
    name: 'RiskManager',
    version: '1.0.0',

    execute(input: RiskInput): RiskOutput | EngineError {
        if (input == null) {
            return { type: 'VALIDATION', message: 'Input is null or undefined', recoverable: false };
        }

        const { scoring, geometry, microstructure, breakoutCycle, volatilityRegime, globalStress,
            atr, volatilityFactor, stopMultiplier, targetMultiplier, eddThreshold, currentPrice,
            dailyDrawdown, dailyDrawdownCap } = input;

        if (atr <= 0) {
            return { type: 'VALIDATION', message: `atr must be > 0, got ${atr}`, recoverable: false };
        }
        if (currentPrice <= 0) {
            return { type: 'VALIDATION', message: `currentPrice must be > 0, got ${currentPrice}`, recoverable: false };
        }

        // Clamp parameters
        const Vf = Math.max(0.8, Math.min(1.6, volatilityFactor));
        const Sm = Math.max(0.8, Math.min(1.2, stopMultiplier));
        const Tm = Math.max(1.0, Math.min(2.0, targetMultiplier));

        // Formula 17/35 — EDD
        const edd = atr * Vf;

        // Formula 18/36 — StopDistance
        const stopDistance = atr * Sm;

        // Formula 19/37 — TargetDistance
        const targetDistance = atr * Tm;

        // Formula 20/38 — EV
        const P = scoring.probability / 100;
        const ev = P * targetDistance - (1 - P) * stopDistance;

        // Hard-reject conditions
        const rejectReasons: string[] = [];

        if (globalStress !== 'SAFE') {
            rejectReasons.push(`Global stress is ${globalStress} (must be SAFE)`);
        }
        if (scoring.probability < 80) {
            rejectReasons.push(`Probability ${scoring.probability.toFixed(2)} is below threshold of 80`);
        }
        if (volatilityRegime === 'EXTREME') {
            rejectReasons.push('Volatility regime is EXTREME');
        }
        if (geometry.isStable === false) {
            rejectReasons.push('Geometry is not stable');
        }
        const microstructureComplete = microstructure.bosDetected || microstructure.sweep || microstructure.retestZone;
        if (!microstructureComplete) {
            rejectReasons.push('Microstructure incomplete: no BOS, sweep, or retest zone detected');
        }
        if (edd > eddThreshold) {
            rejectReasons.push(`EDD ${edd.toFixed(4)} exceeds threshold ${eddThreshold}`);
        }
        if (dailyDrawdown + edd > dailyDrawdownCap) {
            rejectReasons.push(`Daily drawdown cap reached (Current: ${dailyDrawdown.toFixed(2)} + EDD: ${edd.toFixed(2)} > Cap: ${dailyDrawdownCap})`);
        }

        const predictedProfitPercent = targetDistance / currentPrice * 100;
        const estimatedFeesPercent = 0.2;
        const feeAwareNetProfit = predictedProfitPercent - estimatedFeesPercent;

        if (feeAwareNetProfit < 3) {
            rejectReasons.push(`Fee-aware net profit ${feeAwareNetProfit.toFixed(2)}% is below 3% threshold`);
        }

        const hardReject = rejectReasons.length > 0;

        return {
            edd,
            stopDistance,
            targetDistance,
            ev,
            probability: scoring.probability,
            volatilityRegime,
            globalStress,
            geometryStable: geometry.isStable,
            microstructureComplete,
            hardReject,
            rejectReasons,
            feeAwareNetProfit,
            dailyDrawdown,
            dailyDrawdownCap,
        };
    },
};
