import type {
    Engine,
    EngineError,
    GeometryOutput,
    LiquidityMapOutput,
    MacroBias,
    MicrostructureOutput,
    OrderflowOutput,
    ScoringOutput,
    SessionType,
    VolatilityRegime,
    BreakoutCycleOutput,
} from '../../../shared/types/index.js';

export interface ScoringInput {
    geometry: GeometryOutput;
    liquidityMap: LiquidityMapOutput;
    microstructure: MicrostructureOutput;
    orderflow: OrderflowOutput;
    breakoutCycle: BreakoutCycleOutput;
    volatilityRegime: VolatilityRegime;
    macroBias: MacroBias;
    sessionType: SessionType;
    // Section 5.1.9 — microState from GeometryClassifier feeds into scoring
    microState?: string | null;
}

export const ScoringEngine: Engine<ScoringInput, ScoringOutput> = {
    name: 'ScoringEngine',
    version: '1.0.0',


    execute(input: ScoringInput): ScoringOutput | EngineError {
        if (input == null) {
            return { type: 'VALIDATION', message: 'Input is null or undefined', recoverable: false };
        }

        const { geometry, liquidityMap, microstructure, orderflow, breakoutCycle, volatilityRegime, macroBias, sessionType, microState } = input;

        if (geometry == null) {
            return { type: 'VALIDATION', message: 'geometry is required', recoverable: false };
        }
        if (microstructure == null) {
            return { type: 'VALIDATION', message: 'microstructure is required', recoverable: false };
        }

        // Per-engine contribution scores [0, 100]
        const geometryScore =
            (geometry.isStable ? 20 : 0) +
            (geometry.structurePressure ?? 0) * 30 +
            (1 - (geometry.collapseProb ?? 1)) * 50;

        const liquidityScore = Math.min(100, liquidityMap.zones.length * 10);

        // Section 5.1.9 — microState adjusts microstructure score
        // stable micro-states boost score, chaotic ones reduce it
        const microStateBonus = (() => {
            if (!microState) return 0;
            const stability = microState.split('-')[1] ?? '';
            if (stability === 'stable') return 5;
            if (stability === 'chaotic') return -10;
            return 0; // unstable
        })();
        const microstructureScore = Math.max(0, Math.min(100, microstructure.alignmentScore * 100 + microStateBonus));

        const orderflowScore = ((orderflow.bidAskPressure + 1) / 2) * 100;

        const volatilityScore =
            volatilityRegime === 'LOW' ? 90
                : volatilityRegime === 'NORMAL' ? 75
                    : volatilityRegime === 'HIGH' ? 40
                        : 10;

        const macroScore = macroBias === 'NEUTRAL' ? 50 : 70;

        const breakoutStrengthScore = (() => {
            if (!breakoutCycle || breakoutCycle.invalidated) return 0;
            if (breakoutCycle.rangeState === 'BREAKOUT' && breakoutCycle.breakoutLevel) return 90;
            if (breakoutCycle.rangeState === 'RETEST' && breakoutCycle.retestLevel) return 70;
            return 20;
        })();

        const retestQualityScore = (() => {
            if (!breakoutCycle || breakoutCycle.invalidated) return 0;
            if (breakoutCycle.retestLevel) return 85;
            if (breakoutCycle.rangeState === 'BREAKOUT') return 40;
            return 10;
        })();

        const rangeCompressionScore = (() => {
            if (!breakoutCycle) return 20;
            return breakoutCycle.rangeState === 'CONTRACTION' ? 85 : breakoutCycle.rangeState === 'BREAKOUT' ? 60 : 30;
        })();

        const volumeExpansionScore = (() => {
            if (!breakoutCycle) return 20;
            if (breakoutCycle.rangeState === 'BREAKOUT' && !breakoutCycle.invalidated) return 80;
            return 35;
        })();

        const sessionScore =
            sessionType === 'NEWYORK' ? 80
                : sessionType === 'LONDON' ? 75
                    : sessionType === 'ASIA' ? 50
                        : sessionType === 'POSTNY' ? 40
                            : 20;

        // Weights
        const probability = Math.max(0, Math.min(100,
            geometryScore * 0.20 +
            liquidityScore * 0.15 +
            microstructureScore * 0.20 +
            orderflowScore * 0.10 +
            breakoutStrengthScore * 0.12 +
            retestQualityScore * 0.08 +
            rangeCompressionScore * 0.08 +
            volumeExpansionScore * 0.07 +
            volatilityScore * 0.04 +
            macroScore * 0.03 +
            sessionScore * 0.03,
        ));

        const contributions: Record<string, number> = {
            geometry: geometryScore,
            liquidity: liquidityScore,
            microstructure: microstructureScore,
            orderflow: orderflowScore,
            breakoutStrength: breakoutStrengthScore,
            retestQuality: retestQualityScore,
            rangeCompression: rangeCompressionScore,
            volumeExpansion: volumeExpansionScore,
            volatility: volatilityScore,
            macro: macroScore,
            session: sessionScore,
        };

        return { probability, contributions };
    },
};
