import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { normalizePrice, normalizeVolume, normalizeATR, normalizeDelta } from '../../data/normalization.js';
import { GeometryClassifier } from '../../engines/geometry/GeometryClassifier.js';
import { PredictionEngine } from '../../engines/decision/PredictionEngine.js';

describe('Mathematical Integrity Property Tests', () => {

    it('Normalization: Formula 39 (Price) is strictly bounded in [0, 1]', () => {
        fc.assert(
            fc.property(fc.double(), fc.double(), fc.double(), (p, min, max) => {
                const result = normalizePrice(p, min, max);
                expect(result).toBeGreaterThanOrEqual(0);
                expect(result).toBeLessThanOrEqual(1);
                expect(Number.isFinite(result)).toBe(true);
            })
        );
    });

    it('Normalization: Formula 40 (Volume) is robust to zero mean', () => {
        fc.assert(
            fc.property(fc.double(), fc.constant(0), (v, mean) => {
                const result = normalizeVolume(v, mean);
                expect(result).toBe(0);
            })
        );
    });

    it('Geometry: Curvature (Formula 1) remains finite under extreme price spikes', () => {
        fc.assert(
            fc.property(
                fc.array(fc.double({ min: -1e12, max: 1e12 }), { minLength: 4, maxLength: 4 }),
                fc.double({ min: 1e-6, max: 1e6 }),
                (prices, atr) => {
                    const result = GeometryClassifier.execute({
                        priceSeries: prices,
                        atr,
                        wickUp: 0,
                        wickDown: 0,
                        zWicks: atr,
                        askVolume: 0,
                        bidVolume: 0
                    });
                    if (!('type' in result) && result.curvature !== null) {
                        expect(Number.isFinite(result.curvature)).toBe(true);
                        expect(result.curvature).toBeGreaterThanOrEqual(0);
                    }
                }
            )
        );
    });

    it('Prediction: Alignment Score (Formula 11) is strictly bounded with invalid weights', () => {
        // Even if weights are slightly off due to float precision, we shouldn't crash
        const inputBase = {
            G: 0.5, L: 0.5, V: 0.5, M: 0.5, O: 0.5, X: 0.5,
            atr: 100, volatilityFactor: 1.0, attractorStrength: 0.5,
            distanceToPrice: 1.0, previousSmoothed: 0.5,
            regimePersistence: 'MEDIUM_PERSISTENCE' as any,
            sessionType: 'LONDON' as any,
            assetVolatilityProfile: 1.0, signalAge: 0,
            volatilityRegime: 'NORMAL' as any
        };

        fc.assert(
            fc.property(fc.double(), (w1) => {
                const result = PredictionEngine.execute({
                    ...inputBase,
                    weights: { w1, w2: 0.1, w3: 0.1, w4: 0.1, w5: 0.1, w6: 0.6 - w1 }
                });
                // PredictionEngine has validation for weights summing to 1,
                // but we want to ensure any successful path is bounded.
                if (!('type' in result)) {
                    expect(result.strictLine).toBeGreaterThanOrEqual(0);
                    expect(result.strictLine).toBeLessThanOrEqual(1);
                }
            })
        );
    });

});
