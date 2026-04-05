import type { Engine, EngineError, VolatilityRegime } from '../../../shared/types/index.js';

export interface VolatilityRegimeInput {
    atr: number;
    atrPercentile: number;
    bandwidth: number;
    historicalVolatilityPercentile: number;
}

export const VolatilityRegimeEngine: Engine<VolatilityRegimeInput, VolatilityRegime> = {
    name: 'VolatilityRegimeEngine',
    version: '1.0.0',
    execute(input: VolatilityRegimeInput): VolatilityRegime | EngineError {
        if (!input || typeof input !== 'object') {
            return { type: 'VALIDATION', message: 'Input must be a non-null object', recoverable: false };
        }
        if (typeof input.atr !== 'number' || !isFinite(input.atr) || input.atr <= 0) {
            return { type: 'VALIDATION', message: 'atr must be a positive finite number', recoverable: false };
        }
        if (typeof input.atrPercentile !== 'number' || input.atrPercentile < 0 || input.atrPercentile > 1) {
            return { type: 'VALIDATION', message: 'atrPercentile must be in [0, 1]', recoverable: false };
        }
        if (typeof input.bandwidth !== 'number' || input.bandwidth < 0 || input.bandwidth > 1) {
            return { type: 'VALIDATION', message: 'bandwidth must be in [0, 1]', recoverable: false };
        }
        if (typeof input.historicalVolatilityPercentile !== 'number' || input.historicalVolatilityPercentile < 0 || input.historicalVolatilityPercentile > 1) {
            return { type: 'VALIDATION', message: 'historicalVolatilityPercentile must be in [0, 1]', recoverable: false };
        }

        const score =
            input.atrPercentile * 0.4 +
            input.bandwidth * 0.3 +
            input.historicalVolatilityPercentile * 0.3;

        if (score >= 0.85) return 'EXTREME';
        if (score >= 0.65) return 'HIGH';
        if (score >= 0.35) return 'NORMAL';
        return 'LOW';
    },
};
