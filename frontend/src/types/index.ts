// Shared analytical types — inlined for frontend (no runtime dependency on backend)

export type VolatilityRegime = 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';
export type StressState = 'SAFE' | 'CAUTION' | 'HALT';
export type SessionType = 'ASIA' | 'LONDON' | 'NEWYORK' | 'POSTNY' | 'WEEKEND';
export type SystemState = 'IDLE' | 'WAITING_FOR_RETEST' | 'IN_TRADE' | 'COOLDOWN';
export type LiquidityZoneType = 'STOP_CLUSTER' | 'LIQ_SHELF' | 'FVG' | 'IMBALANCE' | 'RESISTANT_CLUSTER';
export type MacroBias = 'LONG' | 'SHORT' | 'NEUTRAL';
export type RegimePersistence = 'LOW_PERSISTENCE' | 'MEDIUM_PERSISTENCE' | 'HIGH_PERSISTENCE';
export type GeometryRegime = 'STABLE_STRUCTURE' | 'EXPANDING_STRUCTURE' | 'COLLAPSING_STRUCTURE' | 'CHAOTIC_STRUCTURE';
export type SectorRotation = 'BTC-DOMINANT' | 'ETH-DOMINANT' | 'SOL-DOMINANT' | 'MEME-ROTATION' | 'RISK-OFF';
export type TrendClassification = 'UP' | 'DOWN' | 'RANGE';
export type RangeState = 'EXPANSION' | 'CONTRACTION' | 'BREAKOUT' | 'RETEST';
export type BreakoutDirection = 'LONG' | 'SHORT' | null;

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
    feeAwareNetProfit?: number;
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
    isStable: boolean; // derived from geometryRegime
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

export interface BreakoutCycleOutput {
    rangeState: RangeState;
    rh: number;
    rl: number;
    breakoutDirection: BreakoutDirection;
    breakoutLevel: number | null;
    entry1: number | null;
    entry2: number | null;
    retestLevel: number | null;
    stopLoss: number | null;
    tp1: number | null;
    tp2: number | null;
    invalidated: boolean;
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
    breakoutCycle?: BreakoutCycleOutput;
    currentPrice: number;
    scoring: { probability: number; contributions: Record<string, number> };
    timestamp: string;
    degraded?: boolean;
    failedEngines?: string[];
    engineRate?: number;    // Hz
    rejectionRatio?: number; // %
    dailyDrawdown: number;
    dailyDrawdownCap: number;
}
