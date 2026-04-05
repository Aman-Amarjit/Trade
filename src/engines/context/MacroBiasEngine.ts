import type { Engine, EngineError, MacroBias } from '../../../shared/types/index.js';

export interface MacroBiasInput {
    macro: { dxy: number; vix: number; spx: number; gold: number; sentiment: number };
    fundingRate: number;
    etfFlows: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function normalize(value: number, min: number, max: number): number {
    if (max === min) return 0.5;
    return clamp((value - min) / (max - min), 0, 1);
}

export const MacroBiasEngine: Engine<MacroBiasInput, MacroBias> = {
    name: 'MacroBiasEngine',
    version: '1.0.0',
    execute(input: MacroBiasInput): MacroBias | EngineError {
        if (!input || typeof input !== 'object') {
            return { type: 'VALIDATION', message: 'Input must be a non-null object', recoverable: false };
        }
        if (!input.macro) {
            return { type: 'VALIDATION', message: 'macro field is required', recoverable: false };
        }
        const { dxy, vix, spx, gold, sentiment } = input.macro;
        for (const [key, val] of Object.entries({ dxy, vix, spx, gold, sentiment })) {
            if (typeof val !== 'number' || !isFinite(val)) {
                return { type: 'VALIDATION', message: `macro.${key} must be a finite number`, recoverable: false };
            }
        }
        if (typeof input.fundingRate !== 'number' || !isFinite(input.fundingRate)) {
            return { type: 'VALIDATION', message: 'fundingRate must be a finite number', recoverable: false };
        }
        if (typeof input.etfFlows !== 'number' || !isFinite(input.etfFlows)) {
            return { type: 'VALIDATION', message: 'etfFlows must be a finite number', recoverable: false };
        }

        // Normalize each indicator to [0,1] using fixed ranges
        const normDxy = normalize(dxy, 80, 120);
        const normVix = normalize(vix, 10, 80);
        const normSpx = normalize(spx, 3000, 6000);
        const normGold = normalize(gold, 1500, 3000);
        const normSentiment = normalize(sentiment, 0, 1);
        const normFundingRate = normalize(input.fundingRate, -0.001, 0.001);
        const normEtfFlows = normalize(input.etfFlows, -1e9, 1e9);

        // Weighted sum
        const weightedSum =
            normDxy * 0.2 +
            normVix * 0.2 +
            normSpx * 0.25 +
            normGold * 0.15 +
            normSentiment * 0.1 +
            normFundingRate * 0.05 +
            normEtfFlows * 0.05;

        if (weightedSum > 0.6) return 'LONG';
        if (weightedSum < 0.4) return 'SHORT';
        return 'NEUTRAL';
    },
};
