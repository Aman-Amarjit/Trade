import type { Engine, EngineError, VolatilityRegime, MacroBias, SessionType, TrendClassification, RegimePersistence } from '../../../shared/types/index.js';

export interface RegimePersistenceInput {
    volatilityRegime: VolatilityRegime;
    macroBias: MacroBias;
    sessionType: SessionType;
    trend: TrendClassification;
}

export const RegimePersistenceEngine: Engine<RegimePersistenceInput, RegimePersistence> = {
    name: 'RegimePersistenceEngine',
    version: '1.0.0',
    execute(input: RegimePersistenceInput): RegimePersistence | EngineError {
        if (!input || typeof input !== 'object') {
            return { type: 'VALIDATION', message: 'Input must be a non-null object', recoverable: false };
        }

        const validRegimes: VolatilityRegime[] = ['LOW', 'NORMAL', 'HIGH', 'EXTREME'];
        if (!validRegimes.includes(input.volatilityRegime)) {
            return { type: 'VALIDATION', message: `volatilityRegime must be one of ${validRegimes.join(', ')}`, recoverable: false };
        }

        const validBiases: MacroBias[] = ['LONG', 'SHORT', 'NEUTRAL'];
        if (!validBiases.includes(input.macroBias)) {
            return { type: 'VALIDATION', message: `macroBias must be one of ${validBiases.join(', ')}`, recoverable: false };
        }

        const validSessions: SessionType[] = ['ASIA', 'LONDON', 'NEWYORK', 'POSTNY', 'WEEKEND'];
        if (!validSessions.includes(input.sessionType)) {
            return { type: 'VALIDATION', message: `sessionType must be one of ${validSessions.join(', ')}`, recoverable: false };
        }

        const validTrends: TrendClassification[] = ['UP', 'DOWN', 'RANGE'];
        if (!validTrends.includes(input.trend)) {
            return { type: 'VALIDATION', message: `trend must be one of ${validTrends.join(', ')}`, recoverable: false };
        }

        let score = 0;

        if (input.volatilityRegime === 'LOW' || input.volatilityRegime === 'NORMAL') score++;
        if (input.macroBias !== 'NEUTRAL') score++;
        if (input.sessionType === 'LONDON' || input.sessionType === 'NEWYORK') score++;
        if (input.trend !== 'RANGE') score++;

        if (score >= 3) return 'HIGH_PERSISTENCE';
        if (score >= 2) return 'MEDIUM_PERSISTENCE';
        return 'LOW_PERSISTENCE';
    },
};
