// DataAdapter interface and raw data types
// Requirements: 8.1, 8.2

export interface OHLCVBar {
    timestamp: string; // UTC ISO 8601
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface OrderflowSnapshot {
    timestamp: string;
    bid: number;
    ask: number;
    delta: number;
    cvd: number;
}

export interface VolumeProfile {
    timestamp: string;
    levels: Array<{ price: number; volume: number }>;
    poc: number; // Point of Control
    vah: number; // Value Area High
    val: number; // Value Area Low
}

export interface VolatilityMetrics {
    timestamp: string;
    atr: number;
    atrPercentile: number;
    bandwidth: number;
    historicalVolatility: number;
}

export interface MacroIndicators {
    timestamp: string;
    dxy: number;
    vix: number;
    spx: number;
    gold: number;
    sentiment: number;
    fundingRate: number;
    etfFlows: number;
}

export interface DerivativesData {
    timestamp: string;
    openInterest: number;
    fundingRate: number;
    liquidationLevels: Array<{ price: number; size: number; side: 'LONG' | 'SHORT' }>;
}

export interface SessionData {
    timestamp: string;
    sessionType: string;
    volatilityPattern: number;
}

/**
 * DataAdapter interface — all raw data must flow through this abstraction.
 * No engine or pipeline component may import a specific data provider directly.
 * Requirements: 8.1, 8.2
 */
export interface DataAdapter {
    fetchOHLCV(symbol: string, timeframe: string, limit: number): Promise<OHLCVBar[]>;
    fetchOrderflow(symbol: string): Promise<OrderflowSnapshot>;
    fetchVolumeProfile(symbol: string, timeframe: string): Promise<VolumeProfile>;
    fetchVolatilityMetrics(symbol: string): Promise<VolatilityMetrics>;
    fetchMacroIndicators(): Promise<MacroIndicators>;
    fetchDerivativesData(symbol: string): Promise<DerivativesData>;
    fetchSessionData(timestamp: string): Promise<SessionData>;
}
