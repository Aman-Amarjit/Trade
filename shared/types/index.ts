// ============================================================
// Shared TypeScript Types and Data Contracts
// Contract_Version: 1.0.0
// ============================================================

// ------------------------------------------------------------
// Canonical Enum Types (Spec Sections 4.1.1–4.1.6, 4.2.2, 5.1.8, 10.6, 11.2)
// ------------------------------------------------------------

export type VolatilityRegime = 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';
export type StressState = 'SAFE' | 'CAUTION' | 'HALT';
export type SessionType = 'ASIA' | 'LONDON' | 'NEWYORK' | 'POSTNY' | 'WEEKEND';
export type SystemState = 'IDLE' | 'WAITING_FOR_RETEST' | 'IN_TRADE' | 'COOLDOWN';
export type LiquidityZoneType = 'STOP_CLUSTER' | 'LIQ_SHELF' | 'FVG' | 'IMBALANCE' | 'RESISTANT_CLUSTER';
export type MacroBias = 'LONG' | 'SHORT' | 'NEUTRAL';
export type RegimePersistence = 'LOW_PERSISTENCE' | 'MEDIUM_PERSISTENCE' | 'HIGH_PERSISTENCE';
export type GeometryRegime =
    | 'STABLE_STRUCTURE'
    | 'EXPANDING_STRUCTURE'
    | 'COLLAPSING_STRUCTURE'
    | 'CHAOTIC_STRUCTURE';
export type SectorRotation =
    | 'BTC-DOMINANT'
    | 'ETH-DOMINANT'
    | 'SOL-DOMINANT'
    | 'MEME-ROTATION'
    | 'RISK-OFF';
export type TrendClassification = 'UP' | 'DOWN' | 'RANGE';

// ------------------------------------------------------------
// Core Shared Interfaces
// ------------------------------------------------------------

export interface EngineError {
    type: 'VALIDATION' | 'COMPUTATION' | 'MISSING_DATA';
    message: string;
    recoverable: boolean;
}

export interface Engine<I, O> {
    name: string;
    version: string; // semver MAJOR.MINOR.PATCH
    execute(input: I): O | EngineError;
}

export interface SwingPoint {
    price: number;
    timestamp: string;
    type: 'HIGH' | 'LOW';
    isExternal: boolean;
}

export interface FVGZone {
    id: string;
    priceMin: number;
    priceMax: number;
    filled: boolean;
    type: 'BULLISH' | 'BEARISH';
}

export interface StopCluster {
    id: string;
    priceMin: number;
    priceMax: number;
    strength: number;
}

export interface LiqShelf {
    id: string;
    priceMin: number;
    priceMax: number;
    risk: number;
}

// ------------------------------------------------------------
// Unified Data Bundle (Spec Section 10.6)
// ------------------------------------------------------------

export interface UnifiedDataBundle {
    seq: number; // monotonically increasing sequence number
    price: {
        open: number;
        high: number;
        low: number;
        close: number;
        mid: number;
    };
    volume: {
        raw: number;
        relative: number;
        delta: number;
        cvd: number;
    };
    orderflow: {
        bid: number;
        ask: number;
        imbalance: number;
    };
    volatility: {
        atr: number;
        atrNorm: number;
        atrPercentile: number;
        bandwidth: number;
    };
    structure: {
        swings: SwingPoint[];
        trend: TrendClassification;
        internal: SwingPoint[];
        external: SwingPoint[];
    };
    liquidity: {
        fvg: FVGZone[];
        stopClusters: StopCluster[];
        liqShelves: LiqShelf[];
    };
    macro: {
        dxy: number;
        vix: number;
        spx: number;
        gold: number;
        sentiment: number;
        fundingRate: number;
        etfFlows: number;
    };
    session: {
        type: SessionType;
        volatilityPattern: number;
    };
    timestamp: string; // UTC ISO 8601 with millisecond precision
}

// ------------------------------------------------------------
// Output Interfaces (Addendum Section 16.2)
// ------------------------------------------------------------

export interface PredictionOutput {
    strictLine: number;
    min: number;
    max: number;
    band50: [number, number];
    band80: [number, number];
    band95: [number, number];
    liquidityBias: number;
    volatilityAdjustment: number;
    smoothed: number;
    decayed: number;
    timestamp: string;
}

export interface RiskOutput {
    edd: number;
    stopDistance: number;
    targetDistance: number;
    ev: number;
    probability: number;
    volatilityRegime: VolatilityRegime;
    globalStress: StressState;
    geometryStable: boolean;
    microstructureComplete: boolean;
    hardReject: boolean;
    rejectReasons: string[];
}

export interface StateMachineOutput {
    state: SystemState;
    previousState: SystemState | null;
    timestamp: string;
    reason: string;
    cooldownRemaining: number;
    alignmentScore: number;
}

export interface LiquidityZone {
    id: string;
    type: LiquidityZoneType;
    priceMin: number;
    priceMax: number;
    strength: number;
    filled?: boolean;
}

export interface LiquidityMapOutput {
    zones: LiquidityZone[];
    premiumZone: [number, number];
    discountZone: [number, number];
    structureBounds: [number, number];
}

export interface GeometryOutput {
    curvature: number | null;
    imbalance: number | null;
    rotation: number | null;
    structurePressure: number | null;
    rotationPressure: number | null;
    collapseProb: number | null;
    breakoutProb: number | null;
    geometryRegime: GeometryRegime | null;
    microState: string | null;
    isStable: boolean;
}

export interface MicrostructureOutput {
    sweep: boolean;
    divergence: boolean;
    cvdDivergence: boolean;
    bosDetected: boolean;
    retestZone: boolean;
    htfAlignment: boolean;
    alignmentScore: number; // [0, 1]
}

export interface OrderflowOutput {
    delta: number;
    cvd: number;
    absorption: boolean;
    footprintImbalance: number;
    bidAskPressure: number;
}

export interface ScoringOutput {
    probability: number; // [0, 100]
    contributions: Record<string, number>;
}

export interface AssetProfile {
    sensitivityProfile: number;   // [0, 1]
    volatilityProfile: number;    // [0, 1]
    liquidityProfile: number;     // [0, 1]
    macroResponsiveness: number;  // [0, 1]
}

export interface LiveAnalysisResponse {
    symbol: string;
    timeframe: string;
    prediction: PredictionOutput;
    risk: RiskOutput;
    state: StateMachineOutput;
    liquidity: LiquidityMapOutput;
    geometry: GeometryOutput;
    microstructure: MicrostructureOutput;
    // Scoring output — includes probability (0–100) and per-engine contributions
    scoring: ScoringOutput;
    timestamp: string;
    degraded?: boolean;
    failedEngines?: string[];
}

// ------------------------------------------------------------
// Bundle Interfaces
// ------------------------------------------------------------

export interface ContextBundle {
    globalStress: StressState;
    macroBias: MacroBias;
    regimePersistence: RegimePersistence;
    volatilityRegime: VolatilityRegime;
    sessionType: SessionType;
    sectorRotation: SectorRotation;
    assetProfile: AssetProfile;
}

export interface MarketStructureOutput {
    internalSwings: SwingPoint[];
    externalSwings: SwingPoint[];
    trend: TrendClassification;
    premiumZone: [number, number];
    discountZone: [number, number];
    structureBounds: [number, number];
}

export interface StructureBundle {
    marketStructure: MarketStructureOutput;
    liquidityMap: LiquidityMapOutput;
}

export interface GeometryBundle {
    geometry: GeometryOutput;
    microstructure: MicrostructureOutput;
    orderflow: OrderflowOutput;
}

export interface DecisionBundle {
    prediction: PredictionOutput;
    scoring: ScoringOutput;
    risk: RiskOutput;
    state: StateMachineOutput;
}

export interface PipelineResult {
    bundleSeq: number;
    context: ContextBundle;
    structure: StructureBundle;
    geometry: GeometryBundle;
    decision: DecisionBundle;
    degraded: boolean;
    failedEngines: string[];
    durationMs: number;
    timestamp: string;
}

// ------------------------------------------------------------
// Journal Entry Interfaces (Spec Section 12.3)
// ------------------------------------------------------------

export interface EngineLogEntry {
    type: 'ENGINE';
    timestamp: string;
    engineName: string;
    engineVersion: string;
    bundleSeq: number;
    input: unknown;
    output: unknown;
    intermediateValues: Record<string, unknown>;
    durationMs: number;
    error?: EngineError;
}

export interface StateTransitionLogEntry {
    type: 'STATE_TRANSITION';
    timestamp: string;
    fromState: SystemState | null;
    toState: SystemState;
    reason: string;
    alignmentScore: number;
    bundleSeq: number;
}

export interface RiskRejectionLogEntry {
    type: 'RISK_REJECTION';
    timestamp: string;
    rejectReasons: string[];
    probability: number;
    volatilityRegime: VolatilityRegime;
    globalStress: StressState;
    bundleSeq: number;
}

export interface MicroEventLogEntry {
    type: 'MICRO_EVENT';
    timestamp: string;
    event: 'SWEEP' | 'BOS' | 'RETEST_ZONE' | 'DIVERGENCE' | 'CVD_DIVERGENCE';
    alignmentScore: number;
    bundleSeq: number;
}

export interface SystemDiagnosticLogEntry {
    type: 'SYSTEM_DIAGNOSTIC';
    timestamp: string;
    category: 'WEIGHT_CHANGE' | 'PERFORMANCE_WARNING' | 'CACHE_FAILURE' | 'ADAPTER_SWITCHOVER' | 'VERSION_CHANGE' | 'OTHER';
    message: string;
    data?: Record<string, unknown>;
}

// ------------------------------------------------------------
// Module Constant
// ------------------------------------------------------------

export const Contract_Version = '1.0.0';
