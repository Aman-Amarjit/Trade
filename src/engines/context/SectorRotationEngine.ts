import type { Engine, EngineError, SectorRotation } from '../../../shared/types/index.js';

export interface AssetDistribution {
    btc: number;
    eth: number;
    sol: number;
    meme: number;
}

export interface SectorRotationInput {
    relativeStrength: AssetDistribution;
    volumeDistribution: AssetDistribution;
    volatilityDistribution: AssetDistribution;
}

type AssetKey = keyof AssetDistribution;

const ASSET_TO_ROTATION: Record<AssetKey, SectorRotation> = {
    btc: 'BTC-DOMINANT',
    eth: 'ETH-DOMINANT',
    sol: 'SOL-DOMINANT',
    meme: 'MEME-ROTATION',
};

export const SectorRotationEngine: Engine<SectorRotationInput, SectorRotation> = {
    name: 'SectorRotationEngine',
    version: '1.0.0',
    execute(input: SectorRotationInput): SectorRotation | EngineError {
        if (!input || typeof input !== 'object') {
            return { type: 'VALIDATION', message: 'Input must be a non-null object', recoverable: false };
        }

        const distributions = ['relativeStrength', 'volumeDistribution', 'volatilityDistribution'] as const;
        for (const dist of distributions) {
            if (!input[dist] || typeof input[dist] !== 'object') {
                return { type: 'VALIDATION', message: `${dist} must be a non-null object`, recoverable: false };
            }
            for (const asset of ['btc', 'eth', 'sol', 'meme'] as AssetKey[]) {
                const val = input[dist][asset];
                if (typeof val !== 'number' || !isFinite(val)) {
                    return { type: 'VALIDATION', message: `${dist}.${asset} must be a finite number`, recoverable: false };
                }
            }
        }

        const assets: AssetKey[] = ['btc', 'eth', 'sol', 'meme'];

        // Compute composite score per asset
        const scores: Record<AssetKey, number> = {
            btc: (input.relativeStrength.btc + input.volumeDistribution.btc + input.volatilityDistribution.btc) / 3,
            eth: (input.relativeStrength.eth + input.volumeDistribution.eth + input.volatilityDistribution.eth) / 3,
            sol: (input.relativeStrength.sol + input.volumeDistribution.sol + input.volatilityDistribution.sol) / 3,
            meme: (input.relativeStrength.meme + input.volumeDistribution.meme + input.volatilityDistribution.meme) / 3,
        };

        // If all scores < 0.3 → RISK-OFF
        if (assets.every(a => scores[a] < 0.3)) return 'RISK-OFF';

        // Return the asset with the highest composite score
        let topAsset: AssetKey = 'btc';
        for (const asset of assets) {
            if (scores[asset] > scores[topAsset]) topAsset = asset;
        }

        return ASSET_TO_ROTATION[topAsset];
    },
};
