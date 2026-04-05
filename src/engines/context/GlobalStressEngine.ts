import type { Engine, EngineError, StressState, VolatilityRegime, StopCluster, SwingPoint } from '../../../shared/types/index.js';

export interface GlobalStressInput {
    volatilityRegime: VolatilityRegime;
    macro: { vix: number; dxy: number };
    liquidity: { stopClusters: StopCluster[] };
    session: { volatilityPattern: number };
    structure: { swings: SwingPoint[] };
}

export const GlobalStressEngine: Engine<GlobalStressInput, StressState> = {
    name: 'GlobalStressEngine',
    version: '1.0.0',
    execute(input: GlobalStressInput): StressState | EngineError {
        if (!input || typeof input !== 'object') {
            return { type: 'VALIDATION', message: 'Input must be a non-null object', recoverable: false };
        }
        if (!input.macro || typeof input.macro.vix !== 'number' || typeof input.macro.dxy !== 'number') {
            return { type: 'VALIDATION', message: 'macro.vix and macro.dxy must be numbers', recoverable: false };
        }
        if (!input.liquidity || !Array.isArray(input.liquidity.stopClusters)) {
            return { type: 'VALIDATION', message: 'liquidity.stopClusters must be an array', recoverable: false };
        }
        if (!input.session || typeof input.session.volatilityPattern !== 'number') {
            return { type: 'VALIDATION', message: 'session.volatilityPattern must be a number', recoverable: false };
        }

        let stressorCount = 0;

        // Stressor 1: extreme volatility regime
        if (input.volatilityRegime === 'EXTREME') stressorCount++;

        // Stressor 2: high vix or high dxy
        if (input.macro.vix > 30 || input.macro.dxy > 110) stressorCount++;

        // Stressor 3: thin liquidity (fewer than 2 stop clusters)
        if (input.liquidity.stopClusters.length < 2) stressorCount++;

        // Stressor 4: high session volatility pattern
        if (input.session.volatilityPattern > 0.8) stressorCount++;

        if (stressorCount >= 2) return 'HALT';
        if (stressorCount === 1) return 'CAUTION';
        if (input.volatilityRegime === 'EXTREME') return 'CAUTION';
        return 'SAFE';
    },
};
