// PipelineOrchestrator — sequences all 15 engines in mandatory order
// Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 15.1, 15.2, 15.3, 15.4

import type {
    UnifiedDataBundle,
    PipelineResult,
    ContextBundle,
    StructureBundle,
    GeometryBundle,
    DecisionBundle,
    StressState,
    MacroBias,
    RegimePersistence,
    VolatilityRegime,
    SessionType,
    SectorRotation,
    AssetProfile,
    MarketStructureOutput,
    LiquidityMapOutput,
    GeometryOutput,
    MicrostructureOutput,
    OrderflowOutput,
    PredictionOutput,
    ScoringOutput,
    RiskOutput,
    StateMachineOutput,
    EngineError,
} from '../../shared/types/index.js';

import { GlobalStressEngine } from '../engines/context/GlobalStressEngine.js';
import { MacroBiasEngine } from '../engines/context/MacroBiasEngine.js';
import { RegimePersistenceEngine } from '../engines/context/RegimePersistenceEngine.js';
import { VolatilityRegimeEngine } from '../engines/context/VolatilityRegimeEngine.js';
import { TimeSessionEngine } from '../engines/context/TimeSessionEngine.js';
import { SectorRotationEngine } from '../engines/context/SectorRotationEngine.js';
import { AssetProfileEngine } from '../engines/context/AssetProfileEngine.js';
import { MarketStructureContextEngine } from '../engines/structure/MarketStructureContextEngine.js';
import { LiquidityMapEngine } from '../engines/structure/LiquidityMapEngine.js';
import { GeometryClassifier } from '../engines/geometry/GeometryClassifier.js';
import { MicroStructureEngine } from '../engines/geometry/MicroStructureEngine.js';
import { OrderflowEngine } from '../engines/geometry/OrderflowEngine.js';
import { PredictionEngine } from '../engines/decision/PredictionEngine.js';
import { ScoringEngine } from '../engines/decision/ScoringEngine.js';
import { RiskManager } from '../engines/decision/RiskManager.js';
import { StateMachine } from '../engines/decision/StateMachine.js';
import { EngineCache } from '../data/cache.js';

// ── Default outputs for failed engines ──────────────────────────────────────

const DEFAULT_STRESS: StressState = 'CAUTION';
const DEFAULT_REGIME_PERSISTENCE: RegimePersistence = 'LOW_PERSISTENCE';
const DEFAULT_VOLATILITY_REGIME: VolatilityRegime = 'NORMAL';
const DEFAULT_SESSION_TYPE: SessionType = 'ASIA';
const DEFAULT_MARKET_STRUCTURE: MarketStructureOutput = {
    internalSwings: [], externalSwings: [], trend: 'RANGE',
    premiumZone: [0, 0], discountZone: [0, 0], structureBounds: [0, 0],
};
const DEFAULT_LIQUIDITY_MAP: LiquidityMapOutput = {
    zones: [], premiumZone: [0, 0], discountZone: [0, 0], structureBounds: [0, 0],
};
const DEFAULT_GEOMETRY: GeometryOutput = {
    curvature: null, imbalance: null, rotation: null, structurePressure: null,
    rotationPressure: null, collapseProb: null, breakoutProb: null,
    geometryRegime: null, microState: null, isStable: false,
};
const DEFAULT_MICROSTRUCTURE: MicrostructureOutput = {
    sweep: false, divergence: false, cvdDivergence: false,
    bosDetected: false, retestZone: false, htfAlignment: false, alignmentScore: 0,
};
const DEFAULT_ORDERFLOW: OrderflowOutput = {
    delta: 0, cvd: 0, absorption: false, footprintImbalance: 0, bidAskPressure: 0,
};
const DEFAULT_PREDICTION = (): PredictionOutput => ({
    strictLine: 0.5, min: 0, max: 1,
    band50: [0.25, 0.75], band80: [0.1, 0.9], band95: [0.05, 0.95],
    liquidityBias: 0, volatilityAdjustment: 0, smoothed: 0.5, decayed: 0.5,
    timestamp: new Date().toISOString(),
});
const DEFAULT_SCORING: ScoringOutput = { probability: 0, contributions: {} };
const DEFAULT_RISK = (): RiskOutput => ({
    edd: 0, stopDistance: 0, targetDistance: 0, ev: 0, probability: 0,
    volatilityRegime: 'NORMAL', globalStress: 'CAUTION',
    geometryStable: false, microstructureComplete: false,
    hardReject: true, rejectReasons: ['Pipeline degraded'],
});
const DEFAULT_STATE = (): StateMachineOutput => ({
    state: 'IDLE', previousState: null, timestamp: new Date().toISOString(),
    reason: 'Pipeline degraded', cooldownRemaining: 0, alignmentScore: 0,
});

// ── Helper ───────────────────────────────────────────────────────────────────

function isEngineError(v: unknown): v is EngineError {
    return typeof v === 'object' && v !== null && 'type' in v && 'message' in v;
}

// ── PipelineOrchestrator ─────────────────────────────────────────────────────

export class PipelineOrchestrator {
    private readonly stateMachine = new StateMachine();
    private consecutiveSlowCycles = 0;
    private readonly SLOW_CYCLE_THRESHOLD_MS = 300;
    // Section 10.7 — cache per candle, per session, per asset
    private readonly cache = new EngineCache();

    // Store stop clusters from previous cycle for GlobalStressEngine bootstrap
    private prevStopClusters: Array<{ id: string; priceMin: number; priceMax: number; strength: number }> = [];

    // Persist smoothed prediction across cycles for temporal smoothing (Formula 15)
    private prevSmoothed: number = 0.5;
    private signalAge: number = 0;
    // Smooth the microstructure alignment score to prevent M input from spiking
    private smoothedAlignment: number = 0.5;
    // Smooth structurePressure (G) to prevent sawtooth from swing detection changes
    private smoothedStructurePressure: number = 0.5;
    // Smooth bid/ask pressure (O) to prevent orderflow noise from spiking
    private smoothedBidAskPressure: number = 0.5;
    // Smooth atrPercentile (V) to prevent volatility noise from spiking
    private smoothedAtrPercentile: number = 0.5;

    // ── Differential update frequency (Section 3.5) ──────────────────────────
    // Low-frequency engines: MacroBias, GlobalStress, SectorRotation, AssetProfile
    // These run every ~5 minutes (150 cycles at 2s each), not every candle
    private readonly LOW_FREQ_INTERVAL = 150;
    private cycleCount = 0;
    private cachedMacroBias: MacroBias = 'NEUTRAL';
    private cachedSectorRotation: SectorRotation = 'RISK-OFF';
    private cachedAssetProfile: AssetProfile = {
        sensitivityProfile: 0.5, volatilityProfile: 0.5,
        liquidityProfile: 0.5, macroResponsiveness: 0.5,
    };

    async run(bundle: UnifiedDataBundle, candleWindow?: Array<{ high: number; low: number; open: number; close: number; timestamp: string }>): Promise<PipelineResult> {
        const start = Date.now();
        const failedEngines: string[] = [];
        let degraded = false;
        this.cycleCount++;
        const isLowFreqCycle = this.cycleCount % this.LOW_FREQ_INTERVAL === 1;

        // Section 10.7 — invalidate per-candle cache entries on each new cycle
        this.cache.invalidatePerCandleEngines();

        function fail(name: string, err: EngineError): void {
            degraded = true;
            failedEngines.push(name);
            console.error(`[Pipeline] Engine ${name} failed: [${err.type}] ${err.message}`);
        }

        // ── STEP 1: Context Engines ──────────────────────────────────────────

        // Clamp bandwidth to [0, 1] — real exchange data can produce values > 1
        const safeBandwidth = Math.max(0, Math.min(1, bundle.volatility.bandwidth));

        // Derive volatility regime from atrPercentile for GlobalStressEngine input
        const prelimVolRegime: VolatilityRegime = bundle.volatility.atrPercentile >= 0.85 ? 'EXTREME'
            : bundle.volatility.atrPercentile >= 0.65 ? 'HIGH'
                : bundle.volatility.atrPercentile >= 0.35 ? 'NORMAL' : 'LOW';

        // GlobalStressEngine — uses stop clusters from previous cycle (bootstrapped)
        const stressResult = GlobalStressEngine.execute({
            volatilityRegime: prelimVolRegime,
            macro: { vix: bundle.macro.vix, dxy: bundle.macro.dxy },
            liquidity: { stopClusters: this.prevStopClusters },
            session: { volatilityPattern: bundle.session.volatilityPattern },
            structure: { swings: bundle.structure.swings },
        });
        const globalStress: StressState = isEngineError(stressResult)
            ? (fail('GlobalStressEngine', stressResult), DEFAULT_STRESS)
            : stressResult;

        // MacroBiasEngine — low frequency (every ~5 minutes)
        if (isLowFreqCycle) {
            const macroResult = MacroBiasEngine.execute({
                macro: bundle.macro,
                fundingRate: bundle.macro.fundingRate,
                etfFlows: bundle.macro.etfFlows,
            });
            if (!isEngineError(macroResult)) {
                this.cachedMacroBias = macroResult;
            } else {
                fail('MacroBiasEngine', macroResult);
            }
        }
        const macroBias: MacroBias = this.cachedMacroBias;

        // TimeSessionEngine
        const sessionResult = TimeSessionEngine.execute({ timestamp: bundle.timestamp });
        const sessionType: SessionType = isEngineError(sessionResult)
            ? (fail('TimeSessionEngine', sessionResult), DEFAULT_SESSION_TYPE)
            : sessionResult;

        // VolatilityRegimeEngine — clamp bandwidth to [0,1] for real exchange data
        const volResult = VolatilityRegimeEngine.execute({
            atr: bundle.volatility.atr,
            atrPercentile: bundle.volatility.atrPercentile,
            bandwidth: safeBandwidth,
            historicalVolatilityPercentile: bundle.volatility.atrPercentile,
        });
        const volatilityRegime: VolatilityRegime = isEngineError(volResult)
            ? (fail('VolatilityRegimeEngine', volResult), DEFAULT_VOLATILITY_REGIME)
            : volResult;

        // SectorRotationEngine — low frequency (every ~5 minutes)
        if (isLowFreqCycle) {
            const sectorResult = SectorRotationEngine.execute({
                relativeStrength: { btc: 0.5, eth: 0.5, sol: 0.5, meme: 0.5 },
                volumeDistribution: { btc: 0.5, eth: 0.5, sol: 0.5, meme: 0.5 },
                volatilityDistribution: { btc: 0.5, eth: 0.5, sol: 0.5, meme: 0.5 },
            });
            if (!isEngineError(sectorResult)) {
                this.cachedSectorRotation = sectorResult;
            } else {
                fail('SectorRotationEngine', sectorResult);
            }
        }
        const sectorRotation: SectorRotation = this.cachedSectorRotation;

        // RegimePersistenceEngine
        const regimeResult = RegimePersistenceEngine.execute({
            volatilityRegime,
            macroBias,
            sessionType,
            trend: bundle.structure.trend,
        });
        const regimePersistence: RegimePersistence = isEngineError(regimeResult)
            ? (fail('RegimePersistenceEngine', regimeResult), DEFAULT_REGIME_PERSISTENCE)
            : regimeResult;

        // AssetProfileEngine — low frequency (every ~5 minutes)
        if (isLowFreqCycle) {
            const assetResult = AssetProfileEngine.execute({
                historicalVolatility: bundle.volatility.atrPercentile,
                liquidityDepth: 0.5,
                macroCorrelation: 0.5,
                sectorRotation,
            });
            if (!isEngineError(assetResult)) {
                this.cachedAssetProfile = assetResult;
            } else {
                fail('AssetProfileEngine', assetResult);
            }
        }
        const assetProfile: AssetProfile = this.cachedAssetProfile;

        const context: ContextBundle = {
            globalStress, macroBias, regimePersistence,
            volatilityRegime, sessionType, sectorRotation, assetProfile,
        };

        // ── STEP 2: Structure Engines ────────────────────────────────────────

        const candle = {
            high: bundle.price.high, low: bundle.price.low,
            open: bundle.price.open, close: bundle.price.close,
            timestamp: bundle.timestamp,
        };

        // Use provided candle window or fall back to single candle
        const candles = (candleWindow && candleWindow.length >= 3) ? candleWindow : [candle];

        const msResult = MarketStructureContextEngine.execute({
            swings: bundle.structure.swings,
            candles,
            volatilityRegime,
        });
        const marketStructure: MarketStructureOutput = isEngineError(msResult)
            ? (fail('MarketStructureContextEngine', msResult), DEFAULT_MARKET_STRUCTURE)
            : msResult;

        const lmResult = LiquidityMapEngine.execute({
            marketStructure,
            volumeProfile: [],
            orderflow: bundle.orderflow,
            volatilityRegime,
            candles,
            openInterest: bundle.liquidity.liqShelves.reduce((sum, s) => sum + s.risk, 0) || 1_000_000,
            currentPrice: bundle.price.close,
        });
        const liquidityMap: LiquidityMapOutput = isEngineError(lmResult)
            ? (fail('LiquidityMapEngine', lmResult), DEFAULT_LIQUIDITY_MAP)
            : lmResult;

        // Save stop clusters for next cycle's GlobalStressEngine
        this.prevStopClusters = liquidityMap.zones
            .filter(z => z.type === 'STOP_CLUSTER')
            .map(z => ({ id: z.id, priceMin: z.priceMin, priceMax: z.priceMax, strength: z.strength }));

        const structure: StructureBundle = { marketStructure, liquidityMap };

        // ── STEP 3: Geometry & Micro Engines ────────────────────────────────

        const geoResult = GeometryClassifier.execute({
            priceSeries: candles.length >= 3 ? candles.map(c => c.close) : [bundle.price.open, bundle.price.close],
            atr: bundle.volatility.atr,
            wickUp: bundle.price.high - bundle.price.close,
            wickDown: bundle.price.close - bundle.price.low,
            zWicks: bundle.volatility.atr,
            askVolume: bundle.orderflow.ask,
            bidVolume: bundle.orderflow.bid,
        });
        const geometry: GeometryOutput = isEngineError(geoResult)
            ? (fail('GeometryClassifier', geoResult), DEFAULT_GEOMETRY)
            : geoResult;

        const microResult = MicroStructureEngine.execute({
            candles,
            orderflow: {
                bid: bundle.orderflow.bid,
                ask: bundle.orderflow.ask,
                delta: bundle.volume.delta,
                cvd: bundle.volume.cvd,
            },
            geometry,
            liquidityZones: liquidityMap.zones,
            previousClose: bundle.price.open,
            htfTrend: bundle.structure.trend,
        });
        const microstructure: MicrostructureOutput = isEngineError(microResult)
            ? (fail('MicroStructureEngine', microResult), DEFAULT_MICROSTRUCTURE)
            : microResult;

        const ofResult = OrderflowEngine.execute({
            bid: bundle.orderflow.bid,
            ask: bundle.orderflow.ask,
            footprintLevels: [],
            microstructure,
            previousCvd: bundle.volume.cvd - bundle.volume.delta,
        });
        const orderflow: OrderflowOutput = isEngineError(ofResult)
            ? (fail('OrderflowEngine', ofResult), DEFAULT_ORDERFLOW)
            : ofResult;

        const geometryBundle: GeometryBundle = { geometry, microstructure, orderflow };

        // Smooth alignment score to prevent M input from spiking each cycle
        this.smoothedAlignment = 0.1 * microstructure.alignmentScore + 0.9 * this.smoothedAlignment;
        const stableAlignment = this.smoothedAlignment;

        // Smooth structurePressure to prevent G input from spiking each cycle
        const rawStructurePressure = geometry.structurePressure ?? 0.5;
        this.smoothedStructurePressure = 0.15 * rawStructurePressure + 0.85 * this.smoothedStructurePressure;
        const stableG = Math.max(0, Math.min(1, this.smoothedStructurePressure));

        // Smooth bid/ask pressure to prevent O input from spiking each cycle
        const rawBidAsk = (orderflow.bidAskPressure + 1) / 2;
        this.smoothedBidAskPressure = 0.15 * rawBidAsk + 0.85 * this.smoothedBidAskPressure;
        const stableO = Math.max(0, Math.min(1, this.smoothedBidAskPressure));

        // Smooth atrPercentile to prevent V input from spiking each cycle
        this.smoothedAtrPercentile = 0.1 * bundle.volatility.atrPercentile + 0.9 * this.smoothedAtrPercentile;
        const stableV = Math.max(0, Math.min(1, this.smoothedAtrPercentile));

        // ── STEP 4: Decision Engines ─────────────────────────────────────────

        const predResult = PredictionEngine.execute({
            G: stableG,
            // Smooth L over time — raw zone count jumps wildly each cycle
            L: Math.max(0, Math.min(1, Math.min(liquidityMap.zones.length / 20, 1))),
            V: stableV,
            // Section 5.1.9 — microState feeds into Prediction Engine
            // Map microState direction component to M input: up→high, down→low, neutral→alignmentScore
            M: (() => {
                const ms = geometry.microState ?? '';
                const dir = ms.split('-')[0];
                if (dir === 'up') return Math.max(stableAlignment, 0.6);
                if (dir === 'down') return Math.min(stableAlignment, 0.4);
                return Math.max(0, Math.min(1, stableAlignment));
            })(),
            O: stableO,
            // X encodes macro bias + stress state combined.
            // LONG=0.7, NEUTRAL=0.5, SHORT=0.3 — then stress adjusts:
            // HALT reduces X toward 0.1 (extreme caution), CAUTION reduces slightly.
            X: (() => {
                const macroBase = macroBias === 'LONG' ? 0.7 : macroBias === 'SHORT' ? 0.3 : 0.5;
                return globalStress === 'HALT' ? Math.min(macroBase, 0.2)
                    : globalStress === 'CAUTION' ? macroBase * 0.7
                        : macroBase;
            })(),
            weights: { w1: 0.15, w2: 0.25, w3: 0.15, w4: 0.20, w5: 0.15, w6: 0.10 },
            atr: bundle.volatility.atr,
            volatilityFactor: 1.0,
            // Section 6.3 — AttractorStrength = clusterStrength × proximityWeight
            attractorStrength: (() => {
                if (liquidityMap.zones.length === 0) return 0;
                const collapseBoost = 1 + (geometry.collapseProb ?? 0) * 0.5;
                let bestScore = 0;
                for (const z of liquidityMap.zones) {
                    const mid = (z.priceMin + z.priceMax) / 2;
                    const distATR = Math.max(0.1, Math.abs(bundle.price.close - mid) / Math.max(bundle.volatility.atr, 1));
                    // proximityWeight = 1/(1 + distanceInATR) — inverse linear decay
                    // At 0 ATR distance: weight = 1.0 (maximum pull)
                    // At 1 ATR distance: weight = 0.5
                    // At 5 ATR distance: weight = 0.17
                    // This gives strong local pull and diminishing distant pull
                    const proximityWeight = 1 / (1 + distATR);
                    const score = z.strength * proximityWeight * collapseBoost;
                    if (score > bestScore) bestScore = score;
                }
                return Math.min(1, Math.tanh(bestScore));
            })(),
            // distanceToPrice is expressed in ATR units (asset-agnostic normalization).
            // This matches the proximityWeight calculation above and prevents LiquidityBias
            // from being asset-dependent (e.g., BTC at $60k vs SOL at $150).
            distanceToPrice: liquidityMap.zones.length > 0
                ? Math.max(
                    Math.abs(bundle.price.close - (liquidityMap.zones[0].priceMin + liquidityMap.zones[0].priceMax) / 2) / Math.max(bundle.volatility.atr, 1),
                    0.1,
                )
                : 1.0,
            regimePersistence,
            sessionType,
            assetVolatilityProfile: assetProfile.volatilityProfile,
            // Pass persisted smoothed value and incrementing signal age for proper smoothing/decay
            previousSmoothed: this.prevSmoothed,
            signalAge: this.signalAge,
            volatilityRegime,
        });
        const prediction: PredictionOutput = isEngineError(predResult)
            ? (fail('PredictionEngine', predResult), DEFAULT_PREDICTION())
            : predResult;

        // Persist smoothed value and increment signal age for next cycle
        this.prevSmoothed = prediction.smoothed;
        this.signalAge = Math.min(this.signalAge + 1, 60); // cap at 60 cycles

        const scoreResult = ScoringEngine.execute({
            geometry, liquidityMap, microstructure, orderflow,
            volatilityRegime, macroBias, sessionType,
            // Section 5.1.9 — microState feeds into Scoring Engine
            microState: geometry.microState ?? null,
        });
        const scoring: ScoringOutput = isEngineError(scoreResult)
            ? (fail('ScoringEngine', scoreResult), DEFAULT_SCORING)
            : scoreResult;

        const riskResult = RiskManager.execute({
            scoring, geometry, microstructure, volatilityRegime, globalStress,
            atr: bundle.volatility.atr,
            volatilityFactor: 1.0, stopMultiplier: 1.0,
            targetMultiplier: 1.5, eddThreshold: bundle.volatility.atr * 2,
        });
        const risk: RiskOutput = isEngineError(riskResult)
            ? (fail('RiskManager', riskResult), DEFAULT_RISK())
            : riskResult;

        const stateResult = this.stateMachine.execute({
            microstructure, liquidityMap, geometry, prediction, risk,
            globalStress, volatilityRegime, dataIntegrityOk: true,
        });
        const state: StateMachineOutput = isEngineError(stateResult)
            ? (fail('StateMachine', stateResult), DEFAULT_STATE())
            : stateResult;

        const decision: DecisionBundle = { prediction, scoring, risk, state };

        // ── Assemble result ──────────────────────────────────────────────────

        const durationMs = Date.now() - start;

        if (durationMs > this.SLOW_CYCLE_THRESHOLD_MS) {
            this.consecutiveSlowCycles++;
            console.warn(`[Pipeline] Slow cycle: ${durationMs}ms (threshold: ${this.SLOW_CYCLE_THRESHOLD_MS}ms)`);
            if (this.consecutiveSlowCycles >= 3) {
                console.error(`[Pipeline] ALERT: ${this.consecutiveSlowCycles} consecutive slow cycles`);
            }
        } else {
            this.consecutiveSlowCycles = 0;
        }

        const result: PipelineResult = {
            bundleSeq: bundle.seq,
            context,
            structure,
            geometry: geometryBundle,
            decision,
            degraded,
            failedEngines,
            durationMs,
            timestamp: new Date().toISOString(),
        };

        return result;
    }
}
