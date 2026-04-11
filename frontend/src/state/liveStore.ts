// liveStore — Zustand store for live analysis data
// Requirements: 21.1, 21.2

import { create } from 'zustand';
import type {
    PredictionOutput,
    RiskOutput,
    StateMachineOutput,
    LiquidityMapOutput,
    GeometryOutput,
    MicrostructureOutput,
    BreakoutCycleOutput,
} from '../types/index';

export interface ScoringOutput {
    probability: number;
    contributions: Record<string, number>;
}

export interface Alert {
    id: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    timestamp: string;
    expiresAt: number;
}

export interface LiveStore {
    prediction: PredictionOutput | null;
    risk: RiskOutput | null;
    state: StateMachineOutput | null;
    liquidity: LiquidityMapOutput | null;
    geometry: GeometryOutput | null;
    microstructure: MicrostructureOutput | null;
    breakoutCycle: BreakoutCycleOutput | null;
    scoring: ScoringOutput | null;
    alerts: Alert[];
    isStale: boolean;
    consecutiveFailures: number;
    lastUpdated: string | null;
    isReplayMode: boolean;
    activeSymbol: string;
    predictionHistory: Array<{ strictLine: number; smoothed: number; timestamp: string }>;
    priceHistory: Array<{ price: number; timestamp: string }>;
    engineRate: number | null;
    rejectionRatio: number | null;
    dailyDrawdown: number;
    dailyDrawdownCap: number;

    // Actions
    setLiveData: (data: {
        prediction: PredictionOutput;
        risk: RiskOutput;
        state: StateMachineOutput;
        liquidity: LiquidityMapOutput;
        geometry: GeometryOutput;
        microstructure: MicrostructureOutput;
        breakoutCycle: BreakoutCycleOutput | null;
        scoring: ScoringOutput;
        engineRate: number | null;
        rejectionRatio: number | null;
        dailyDrawdown: number;
        dailyDrawdownCap: number;
        timestamp: string;
    }) => void;
    incrementFailures: () => void;
    resetFailures: () => void;
    addAlert: (alert: Omit<Alert, 'id'>) => void;
    expireAlerts: () => void;
    setReplayMode: (active: boolean) => void;
    resetHistory: () => void;
    clearData: () => void;
    setActiveSymbol: (symbol: string) => void;
}

export const useLiveStore = create<LiveStore>((set, get) => ({
    prediction: null,
    risk: null,
    state: null,
    liquidity: null,
    geometry: null,
    microstructure: null,
    breakoutCycle: null,
    scoring: null,
    alerts: [],
    isStale: false,
    consecutiveFailures: 0,
    lastUpdated: null,
    isReplayMode: false,
    activeSymbol: '',
    predictionHistory: [],
    priceHistory: [],
    engineRate: null,
    rejectionRatio: null,
    dailyDrawdown: 0,
    dailyDrawdownCap: 0,

    setLiveData: (data) => set((s) => {
        const newPoint = {
            strictLine: data.prediction.strictLine,
            smoothed: data.prediction.smoothed,
            timestamp: data.timestamp,
        };
        const history = [...(s.predictionHistory ?? []), newPoint].slice(-60);

        // Track price from liquidity structureBounds midpoint
        const bounds = data.liquidity.structureBounds;
        const price = bounds[0] > 0 ? (bounds[0] + bounds[1]) / 2 : 0;
        const pricePoint = { price, timestamp: data.timestamp };
        const priceHistory = [...(s.priceHistory ?? []), pricePoint].filter(p => p.price > 0).slice(-60); // keep last 60 points
        return {
            prediction: data.prediction,
            risk: data.risk,
            state: data.state,
            liquidity: data.liquidity,
            geometry: data.geometry,
            microstructure: data.microstructure,
            breakoutCycle: data.breakoutCycle,
            scoring: data.scoring,
            lastUpdated: data.timestamp,
            isStale: false,
            consecutiveFailures: 0,
            predictionHistory: history,
            priceHistory,
            engineRate: data.engineRate ?? null,
            rejectionRatio: data.rejectionRatio ?? null,
            dailyDrawdown: data.dailyDrawdown,
            dailyDrawdownCap: data.dailyDrawdownCap,
        };
    }),

    incrementFailures: () => {
        const failures = get().consecutiveFailures + 1;
        set({
            consecutiveFailures: failures,
            isStale: failures >= 3,
        });
    },

    resetFailures: () => set({ consecutiveFailures: 0, isStale: false }),

    addAlert: (alert) => set((s) => ({
        alerts: [
            { ...alert, id: `${Date.now()}-${Math.random()}` },
            ...s.alerts,
        ].slice(0, 50), // cap at 50 alerts
    })),

    expireAlerts: () => set((s) => ({
        alerts: s.alerts.filter(a => Date.now() < a.expiresAt),
    })),

    setReplayMode: (active) => set({ isReplayMode: active }),

    resetHistory: () => set({ predictionHistory: [], priceHistory: [] }),

    clearData: () => set({
        prediction: null,
        risk: null,
        state: null,
        liquidity: null,
        geometry: null,
        microstructure: null,
        breakoutCycle: null,
        scoring: null,
        predictionHistory: [],
        priceHistory: [],
        engineRate: null,
        rejectionRatio: null,
        dailyDrawdown: 0,
        dailyDrawdownCap: 0,
        lastUpdated: null,
        isStale: false,
        consecutiveFailures: 0,
    }),

    setActiveSymbol: (symbol) => set({ activeSymbol: symbol }),
}));

