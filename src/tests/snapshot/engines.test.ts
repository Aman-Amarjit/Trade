// Snapshot tests for all 15 engines
// Validates: Requirements 29.2

import { describe, it, expect } from 'vitest';
import { GlobalStressEngine } from '../../engines/context/GlobalStressEngine.js';
import { MacroBiasEngine } from '../../engines/context/MacroBiasEngine.js';
import { RegimePersistenceEngine } from '../../engines/context/RegimePersistenceEngine.js';
import { VolatilityRegimeEngine } from '../../engines/context/VolatilityRegimeEngine.js';
import { TimeSessionEngine } from '../../engines/context/TimeSessionEngine.js';
import { SectorRotationEngine } from '../../engines/context/SectorRotationEngine.js';
import { AssetProfileEngine } from '../../engines/context/AssetProfileEngine.js';
import { MarketStructureContextEngine } from '../../engines/structure/MarketStructureContextEngine.js';
import { LiquidityMapEngine } from '../../engines/structure/LiquidityMapEngine.js';
import { GeometryClassifier } from '../../engines/geometry/GeometryClassifier.js';
import { MicroStructureEngine } from '../../engines/geometry/MicroStructureEngine.js';
import { OrderflowEngine } from '../../engines/geometry/OrderflowEngine.js';
import { PredictionEngine } from '../../engines/decision/PredictionEngine.js';
import { ScoringEngine } from '../../engines/decision/ScoringEngine.js';
import { RiskManager } from '../../engines/decision/RiskManager.js';

const CANDLES = [
    { high: 50100, low: 49900, open: 50000, close: 50050, timestamp: '2024-01-01T00:00:00.000Z' },
    { high: 50200, low: 50000, open: 50050, close: 50150, timestamp: '2024-01-01T00:01:00.000Z' },
    { high: 50300, low: 50100, open: 50150, close: 50250, timestamp: '2024-01-01T00:02:00.000Z' },
];

describe('Snapshot tests — all 15 engines', () => {
    it('GlobalStressEngine snapshot', () => {
        const result = GlobalStressEngine.execute({
            volatilityRegime: 'NORMAL',
            macro: { vix: 20, dxy: 104 },
            liquidity: { stopClusters: [{ id: '1', priceMin: 49900, priceMax: 50000, strength: 1 }, { id: '2', priceMin: 50100, priceMax: 50200, strength: 1 }] },
            session: { volatilityPattern: 0.5 },
            structure: { swings: [] },
        });
        expect(result).toMatchSnapshot();
    });

    it('MacroBiasEngine snapshot', () => {
        const result = MacroBiasEngine.execute({
            macro: { dxy: 104, vix: 18, spx: 5200, gold: 2350, sentiment: 0.6 },
            fundingRate: 0.0001, etfFlows: 500000,
        });
        expect(result).toMatchSnapshot();
    });

    it('RegimePersistenceEngine snapshot', () => {
        const result = RegimePersistenceEngine.execute({
            volatilityRegime: 'NORMAL', macroBias: 'LONG',
            sessionType: 'NEWYORK', trend: 'UP',
        });
        expect(result).toMatchSnapshot();
    });

    it('VolatilityRegimeEngine snapshot', () => {
        const result = VolatilityRegimeEngine.execute({
            atr: 200, atrPercentile: 0.5, bandwidth: 0.04, historicalVolatilityPercentile: 0.5,
        });
        expect(result).toMatchSnapshot();
    });

    it('TimeSessionEngine snapshot', () => {
        const result = TimeSessionEngine.execute({ timestamp: '2024-01-01T15:00:00.000Z' });
        expect(result).toMatchSnapshot();
    });

    it('SectorRotationEngine snapshot', () => {
        const result = SectorRotationEngine.execute({
            relativeStrength: { btc: 0.8, eth: 0.5, sol: 0.3, meme: 0.2 },
            volumeDistribution: { btc: 0.7, eth: 0.4, sol: 0.3, meme: 0.1 },
            volatilityDistribution: { btc: 0.6, eth: 0.5, sol: 0.4, meme: 0.2 },
        });
        expect(result).toMatchSnapshot();
    });

    it('AssetProfileEngine snapshot', () => {
        const result = AssetProfileEngine.execute({
            historicalVolatility: 0.6, liquidityDepth: 0.7,
            macroCorrelation: 0.5, sectorRotation: 'BTC-DOMINANT',
        });
        expect(result).toMatchSnapshot();
    });

    it('MarketStructureContextEngine snapshot', () => {
        const result = MarketStructureContextEngine.execute({
            swings: [], candles: CANDLES, volatilityRegime: 'NORMAL',
        });
        expect(result).toMatchSnapshot();
    });

    it('LiquidityMapEngine snapshot', () => {
        const msResult = MarketStructureContextEngine.execute({
            swings: [], candles: CANDLES, volatilityRegime: 'NORMAL',
        });
        if ('type' in msResult) throw new Error('MarketStructure failed');
        const result = LiquidityMapEngine.execute({
            marketStructure: msResult, volumeProfile: [],
            orderflow: { bid: 250, ask: 250, imbalance: 0 },
            volatilityRegime: 'NORMAL', candles: CANDLES,
            openInterest: 1000000, currentPrice: 50250,
        });
        expect(result).toMatchSnapshot();
    });

    it('GeometryClassifier snapshot', () => {
        const result = GeometryClassifier.execute({
            priceSeries: [49900, 50000, 50100, 50050],
            atr: 200, wickUp: 50, wickDown: 50, zWicks: 200,
            askVolume: 250, bidVolume: 250,
        });
        expect(result).toMatchSnapshot();
    });

    it('MicroStructureEngine snapshot', () => {
        const result = MicroStructureEngine.execute({
            candles: CANDLES,
            orderflow: { bid: 250, ask: 250, delta: 0, cvd: 0 },
            geometry: { curvature: 0.1, imbalance: 0.05, rotation: 0.02, structurePressure: 0.8, rotationPressure: 0.02, collapseProb: 0.2, breakoutProb: 0.3, geometryRegime: 'STABLE_STRUCTURE', microState: 'neutral-stable', isStable: true },
            liquidityZones: [],
            previousClose: 50000,
        });
        expect(result).toMatchSnapshot();
    });

    it('OrderflowEngine snapshot', () => {
        const result = OrderflowEngine.execute({
            bid: 250, ask: 300, footprintLevels: [],
            microstructure: { sweep: false, divergence: false, cvdDivergence: false, bosDetected: false, retestZone: false, htfAlignment: false, alignmentScore: 0 },
        });
        expect(result).toMatchSnapshot();
    });

    it('PredictionEngine snapshot', () => {
        const result = PredictionEngine.execute({
            G: 0.7, L: 0.6, V: 0.5, M: 0.8, O: 0.6, X: 0.5,
            weights: { w1: 0.15, w2: 0.25, w3: 0.15, w4: 0.20, w5: 0.15, w6: 0.10 },
            atr: 200, volatilityFactor: 1.0, attractorStrength: 0.5, distanceToPrice: 100,
            regimePersistence: 'MEDIUM_PERSISTENCE', sessionType: 'NEWYORK',
            assetVolatilityProfile: 0.6, signalAge: 5,
            volatilityRegime: 'NORMAL',
        });
        // Mask the dynamic timestamp so the snapshot is stable across runs
        const stableResult = 'type' in (result as object) ? result : { ...result as object, timestamp: '<MASKED>' };
        expect(stableResult).toMatchSnapshot();
    });

    it('ScoringEngine snapshot', () => {
        const result = ScoringEngine.execute({
            geometry: { curvature: 0.1, imbalance: 0.05, rotation: 0.02, structurePressure: 0.8, rotationPressure: 0.02, collapseProb: 0.2, breakoutProb: 0.3, geometryRegime: 'STABLE_STRUCTURE', microState: 'neutral-stable', isStable: true },
            liquidityMap: { zones: [], premiumZone: [50100, 50300], discountZone: [49900, 50100], structureBounds: [49900, 50300] },
            microstructure: { sweep: false, divergence: false, cvdDivergence: false, bosDetected: false, retestZone: false, htfAlignment: true, alignmentScore: 0.5 },
            orderflow: { delta: 50, cvd: 100, absorption: false, footprintImbalance: 0.1, bidAskPressure: 0.09 },
            volatilityRegime: 'NORMAL', macroBias: 'LONG', sessionType: 'NEWYORK',
        });
        expect(result).toMatchSnapshot();
    });

    it('RiskManager snapshot', () => {
        const result = RiskManager.execute({
            scoring: { probability: 85, contributions: {} },
            geometry: { curvature: 0.1, imbalance: 0.05, rotation: 0.02, structurePressure: 0.8, rotationPressure: 0.02, collapseProb: 0.2, breakoutProb: 0.3, geometryRegime: 'STABLE_STRUCTURE', microState: 'neutral-stable', isStable: true },
            microstructure: { sweep: true, divergence: false, cvdDivergence: false, bosDetected: true, retestZone: true, htfAlignment: true, alignmentScore: 0.8 },
            volatilityRegime: 'NORMAL', globalStress: 'SAFE',
            atr: 200, volatilityFactor: 1.0, stopMultiplier: 1.0, targetMultiplier: 1.5, eddThreshold: 400,
        });
        expect(result).toMatchSnapshot();
    });
});
