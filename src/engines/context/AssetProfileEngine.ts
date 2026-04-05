import type { Engine, EngineError, SectorRotation, AssetProfile } from '../../../shared/types/index.js';

export interface AssetProfileInput {
    historicalVolatility: number;
    liquidityDepth: number;
    macroCorrelation: number;
    sectorRotation: SectorRotation;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

const VALID_SECTOR_ROTATIONS: SectorRotation[] = [
    'BTC-DOMINANT', 'ETH-DOMINANT', 'SOL-DOMINANT', 'MEME-ROTATION', 'RISK-OFF',
];

export const AssetProfileEngine: Engine<AssetProfileInput, AssetProfile> = {
    name: 'AssetProfileEngine',
    version: '1.0.0',
    execute(input: AssetProfileInput): AssetProfile | EngineError {
        if (!input || typeof input !== 'object') {
            return { type: 'VALIDATION', message: 'Input must be a non-null object', recoverable: false };
        }
        if (typeof input.historicalVolatility !== 'number' || !isFinite(input.historicalVolatility)) {
            return { type: 'VALIDATION', message: 'historicalVolatility must be a finite number', recoverable: false };
        }
        if (typeof input.liquidityDepth !== 'number' || !isFinite(input.liquidityDepth)) {
            return { type: 'VALIDATION', message: 'liquidityDepth must be a finite number', recoverable: false };
        }
        if (typeof input.macroCorrelation !== 'number' || !isFinite(input.macroCorrelation)) {
            return { type: 'VALIDATION', message: 'macroCorrelation must be a finite number', recoverable: false };
        }
        if (!VALID_SECTOR_ROTATIONS.includes(input.sectorRotation)) {
            return { type: 'VALIDATION', message: `sectorRotation must be one of ${VALID_SECTOR_ROTATIONS.join(', ')}`, recoverable: false };
        }

        const riskOffBonus = input.sectorRotation === 'RISK-OFF' ? 0.2 : 0;

        return {
            sensitivityProfile: clamp(input.historicalVolatility, 0, 1),
            volatilityProfile: clamp(input.historicalVolatility * 0.8 + riskOffBonus, 0, 1),
            liquidityProfile: clamp(input.liquidityDepth, 0, 1),
            macroResponsiveness: clamp(input.macroCorrelation, 0, 1),
        };
    },
};
