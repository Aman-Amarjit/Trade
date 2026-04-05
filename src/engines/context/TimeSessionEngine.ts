import type { Engine, EngineError, SessionType } from '../../../shared/types/index.js';

export interface TimeSessionInput {
    timestamp: string; // UTC ISO 8601
}

export const TimeSessionEngine: Engine<TimeSessionInput, SessionType> = {
    name: 'TimeSessionEngine',
    version: '1.0.0',
    execute(input: TimeSessionInput): SessionType | EngineError {
        if (!input || typeof input !== 'object') {
            return { type: 'VALIDATION', message: 'Input must be a non-null object', recoverable: false };
        }
        if (typeof input.timestamp !== 'string' || input.timestamp.trim() === '') {
            return { type: 'VALIDATION', message: 'timestamp must be a non-empty string', recoverable: false };
        }

        const date = new Date(input.timestamp);
        if (isNaN(date.getTime())) {
            return { type: 'VALIDATION', message: `Invalid ISO 8601 timestamp: "${input.timestamp}"`, recoverable: false };
        }

        // Use UTC values — no local timezone conversion
        const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
        if (dayOfWeek === 0 || dayOfWeek === 6) return 'WEEKEND';

        const hour = date.getUTCHours();

        if (hour >= 0 && hour <= 7) return 'ASIA';
        if (hour >= 8 && hour <= 12) return 'LONDON';
        if (hour >= 13 && hour <= 20) return 'NEWYORK';
        return 'POSTNY'; // 21–23
    },
};
