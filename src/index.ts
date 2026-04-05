// Main entry point — wires API server, pipeline loop, and journal
// Multi-symbol support: add symbols to ACTIVE_SYMBOLS to enable more assets
import { createApiServer, registerToken, recordCycleDuration } from './api/index.js';
import { PipelineOrchestrator } from './pipeline/PipelineOrchestrator.js';
import { Journal } from './journal/Journal.js';
import { InMemoryBackend } from './journal/backends/InMemoryBackend.js';
import { FileBackend } from './journal/backends/FileBackend.js';
import { KrakenAdapter } from './data/adapters/KrakenAdapter.js';
import { MockAdapter } from './data/adapters/MockAdapter.js';
import { DataLayer } from './data/DataLayer.js';
import { CsvReplayAdapter } from './data/adapters/CsvReplayAdapter.js';
import { assembleBundle } from './data/bundleAssembler.js';
import { validateOHLCV } from './data/validation.js';
import { getTlsConfigFromEnv, startHttpsServer } from './api/httpsServer.js';
import * as fs from 'fs';
import type { PipelineResult } from '../shared/types/index.js';
import type { RollingStats } from './data/bundleAssembler.js';
import type { VolatilityMetrics } from './data/adapters/DataAdapter.js';

// ── Config ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const API_TOKEN = process.env['API_TOKEN'] ?? 'dev-token-change-me';
const TIMEFRAME = process.env['TIMEFRAME'] ?? '1m';
const REPLAY_CSV_PATH = process.env['REPLAY_CSV_PATH'] ?? '';

// ── To add more symbols, just add them here ───────────────────────────────────
const ACTIVE_SYMBOLS: string[] = (process.env['SYMBOLS'] ?? 'BTC-USDT,ETH-USDT,SOL-USDT')
    .split(',').map(s => s.trim()).filter(Boolean);

// Stagger each symbol by 2s to avoid Kraken rate limits
const SYMBOL_STAGGER_MS = 2000;
// Each symbol polls every N seconds (3 symbols × 2s stagger = 6s minimum)
const POLL_INTERVAL_MS = Math.max(6000, ACTIVE_SYMBOLS.length * SYMBOL_STAGGER_MS);

const CANDLE_WINDOW_SIZE = 20;
const STRUCTURE_WINDOW_SIZE = 50;
const STRUCTURE_FETCH_INTERVAL_MS = 30_000;

// ── Volatility helper ─────────────────────────────────────────────────────────
function computeVolatilityFromBars(bars: Array<{ high: number; low: number; close: number; open: number; volume: number; timestamp: string }>): VolatilityMetrics {
    if (bars.length < 2) {
        return { timestamp: new Date().toISOString(), atr: 100, atrPercentile: 0.5, bandwidth: 0.001, historicalVolatility: 0.5 };
    }
    const trs: number[] = [];
    for (let i = 1; i < bars.length; i++) {
        const tr = Math.max(
            bars[i].high - bars[i].low,
            Math.abs(bars[i].high - bars[i - 1].close),
            Math.abs(bars[i].low - bars[i - 1].close),
        );
        trs.push(tr);
    }
    const period = Math.min(14, trs.length);
    const atr = trs.slice(-period).reduce((a, b) => a + b, 0) / period;
    const sorted = [...trs].sort((a, b) => a - b);
    const atrPercentile = sorted.filter(v => v <= atr).length / sorted.length;
    const last = bars[bars.length - 1];
    const bandwidth = last.close > 0 ? Math.min(1, (last.high - last.low) / last.close) : 0.001;
    const closes = bars.map(b => b.close);
    const logReturns = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
    const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    const variance = logReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / logReturns.length;
    const historicalVolatility = Math.sqrt(variance) * Math.sqrt(365 * 24 * 60);
    return { timestamp: new Date().toISOString(), atr, atrPercentile, bandwidth, historicalVolatility };
}

// ── Journal ───────────────────────────────────────────────────────────────────
const LOG_DIR = process.env['LOG_DIR'] ?? './logs';
const journalBackends = [new InMemoryBackend(10_000), new FileBackend(LOG_DIR, 7)];
const journal = new Journal(journalBackends);

// ── Per-symbol state ──────────────────────────────────────────────────────────
interface SymbolState {
    orchestrator: PipelineOrchestrator;
    rollingStats: RollingStats;
    candleWindow1m: Array<{ high: number; low: number; open: number; close: number; timestamp: string }>;
    candleWindow15m: Array<{ high: number; low: number; open: number; close: number; timestamp: string }>;
    lastStructureFetch: number;
}

const adapter = new DataLayer(new KrakenAdapter(), new MockAdapter(), { timeoutMs: 5000 });
const latestResults = new Map<string, PipelineResult>();
const symbolStates = new Map<string, SymbolState>();

for (const sym of ACTIVE_SYMBOLS) {
    symbolStates.set(sym, {
        orchestrator: new PipelineOrchestrator(),
        rollingStats: { rollingMeanVolume: 500, rollingATR: 200, rollingDeltaStd: 10, atrPercentile: 0.5, bandwidth: 0.04, previousCvd: 0 },
        candleWindow1m: [],
        candleWindow15m: [],
        lastStructureFetch: 0,
    });
}

let pipelineReady = false;
let globalSeq = 0;

// ── Per-symbol pipeline cycle ─────────────────────────────────────────────────
async function runSymbolCycle(symbol: string): Promise<void> {
    const state = symbolStates.get(symbol);
    if (!state) return;
    try {
        const bars = await adapter.fetchOHLCV(symbol, TIMEFRAME, 20);
        if (bars.length === 0) return;
        const bar = bars[bars.length - 1];

        // Validate OHLCV integrity before processing
        const barValidation = validateOHLCV(bar);
        if (!barValidation.valid) {
            console.warn(`[Pipeline] ${symbol} invalid bar, skipping: ${barValidation.errors.join(', ')}`);
            return;
        }
        const orderflow = await adapter.fetchOrderflow(symbol);
        const macro = await adapter.fetchMacroIndicators();
        const volatility = computeVolatilityFromBars(bars);

        // Seed 1-min window on first cycle
        if (state.candleWindow1m.length === 0 && bars.length > 1) {
            for (const b of bars.slice(-CANDLE_WINDOW_SIZE)) {
                state.candleWindow1m.push({ high: b.high, low: b.low, open: b.open, close: b.close, timestamp: b.timestamp });
            }
        } else {
            state.candleWindow1m.push({ high: bar.high, low: bar.low, open: bar.open, close: bar.close, timestamp: bar.timestamp });
            if (state.candleWindow1m.length > CANDLE_WINDOW_SIZE) state.candleWindow1m.shift();
        }

        // Refresh 15-min structure window periodically
        const now = Date.now();
        if (now - state.lastStructureFetch > STRUCTURE_FETCH_INTERVAL_MS || state.candleWindow15m.length === 0) {
            state.lastStructureFetch = now;
            try {
                const bars15m = await adapter.fetchOHLCV(symbol, '15m', STRUCTURE_WINDOW_SIZE);
                state.candleWindow15m.length = 0;
                for (const b of bars15m) {
                    state.candleWindow15m.push({ high: b.high, low: b.low, open: b.open, close: b.close, timestamp: b.timestamp });
                }
            } catch { /* keep existing window */ }
        }

        const structureWindow = state.candleWindow15m.length >= 3 ? state.candleWindow15m : state.candleWindow1m;

        // Update rolling stats
        if (volatility.atr > 0) {
            state.rollingStats.rollingATR = state.rollingStats.rollingATR === 200
                ? volatility.atr
                : state.rollingStats.rollingATR * 0.9 + volatility.atr * 0.1;
        }
        if (bar.volume > 0) state.rollingStats.rollingMeanVolume = state.rollingStats.rollingMeanVolume * 0.9 + bar.volume * 0.1;
        if (bar.close > 0) state.rollingStats.bandwidth = Math.min(1, (bar.high - bar.low) / bar.close);
        state.rollingStats.atrPercentile = volatility.atrPercentile;

        // Derive session type from actual bar timestamp
        const barHour = new Date(bar.timestamp).getUTCHours();
        const barDay = new Date(bar.timestamp).getUTCDay();
        const sessionType = (barDay === 0 || barDay === 6) ? 'WEEKEND'
            : barHour < 8 ? 'ASIA'
                : barHour < 13 ? 'LONDON'
                    : barHour < 21 ? 'NEWYORK'
                        : 'POSTNY';
        const sessionVolatilityPattern = sessionType === 'NEWYORK' ? 0.80
            : sessionType === 'LONDON' ? 0.65
                : sessionType === 'ASIA' ? 0.35
                    : sessionType === 'WEEKEND' ? 0.20
                        : 0.30;

        const bundle = assembleBundle({
            bar, orderflow, volatility, macro,
            swings: [], trend: 'RANGE',
            internalSwings: [], externalSwings: [],
            fvg: [], stopClusters: [], liqShelves: [],
            sessionType, sessionVolatilityPattern,
        }, ++globalSeq, state.rollingStats);

        const result = await state.orchestrator.run(bundle, structureWindow);
        latestResults.set(symbol, result);

        // Mark ready when primary symbol has its first result
        if (symbol === ACTIVE_SYMBOLS[0]) {
            recordCycleDuration(result.durationMs);
            pipelineReady = true;
        }

        if (result.decision.risk.hardReject) {
            journal.writeRiskRejection({
                timestamp: result.timestamp,
                rejectReasons: result.decision.risk.rejectReasons,
                probability: result.decision.risk.probability,
                volatilityRegime: result.decision.risk.volatilityRegime,
                globalStress: result.decision.risk.globalStress,
                bundleSeq: result.bundleSeq,
            });
        }

        const stateOut = result.decision.state;
        if (stateOut.previousState !== null && stateOut.previousState !== stateOut.state) {
            journal.writeStateTransition({
                timestamp: stateOut.timestamp,
                fromState: stateOut.previousState,
                toState: stateOut.state,
                reason: stateOut.reason,
                alignmentScore: stateOut.alignmentScore,
                bundleSeq: result.bundleSeq,
            });
        }
    } catch (err) {
        console.error(`[Pipeline] ${symbol} error:`, err instanceof Error ? err.message : err);
    }
}

// ── Replay setup ──────────────────────────────────────────────────────────────
const replayOrchestrator = new PipelineOrchestrator();
let replayAdapter: CsvReplayAdapter | null = null;
const primarySymbol = ACTIVE_SYMBOLS[0] ?? 'BTC-USDT';

if (REPLAY_CSV_PATH && fs.existsSync(REPLAY_CSV_PATH)) {
    replayAdapter = new CsvReplayAdapter(REPLAY_CSV_PATH, 1.0);
    console.log(`[Replay] CSV loaded: ${REPLAY_CSV_PATH} (${replayAdapter.totalBars} bars)`);
} else if (REPLAY_CSV_PATH) {
    console.warn(`[Replay] CSV not found: ${REPLAY_CSV_PATH}`);
}

async function runReplayCycle(): Promise<PipelineResult | undefined> {
    if (!replayAdapter) return undefined;
    try {
        const bars = await replayAdapter.fetchOHLCV(primarySymbol, TIMEFRAME, 20);
        if (bars.length === 0) return undefined;
        const bar = bars[bars.length - 1];
        const orderflow = await replayAdapter.fetchOrderflow(primarySymbol);
        const macro = await replayAdapter.fetchMacroIndicators();
        const volatility = computeVolatilityFromBars(bars);
        const replayStats: RollingStats = {
            rollingMeanVolume: bar.volume || 500,
            rollingATR: volatility.atr || 100,
            rollingDeltaStd: 10,
            atrPercentile: volatility.atrPercentile,
            bandwidth: volatility.bandwidth,
            previousCvd: 0,
        };
        const bundle = assembleBundle({
            bar, orderflow, volatility, macro,
            swings: [], trend: 'RANGE',
            internalSwings: [], externalSwings: [],
            fvg: [], stopClusters: [], liqShelves: [],
            sessionType: 'NEWYORK', sessionVolatilityPattern: 0.5,
        }, ++globalSeq, replayStats);
        return await replayOrchestrator.run(bundle, bars.map(b => ({
            high: b.high, low: b.low, open: b.open, close: b.close, timestamp: b.timestamp,
        })));
    } catch (err) {
        console.error('[Replay] Error:', err instanceof Error ? err.message : err);
        return undefined;
    }
}

// ── API server ────────────────────────────────────────────────────────────────
registerToken(API_TOKEN);

const engineVersions: Record<string, string> = {
    GlobalStressEngine: '1.0.0', MacroBiasEngine: '1.0.0', RegimePersistenceEngine: '1.0.0',
    VolatilityRegimeEngine: '1.0.0', TimeSessionEngine: '1.0.0', SectorRotationEngine: '1.0.0',
    AssetProfileEngine: '1.0.0', MarketStructureContextEngine: '1.0.0', LiquidityMapEngine: '1.0.0',
    GeometryClassifier: '1.0.0', MicroStructureEngine: '1.0.0', OrderflowEngine: '1.0.0',
    PredictionEngine: '1.0.0', ScoringEngine: '1.0.0', RiskManager: '1.0.0',
};

const app = createApiServer({
    journal,
    getLatestResult: (symbol) => latestResults.get(symbol),
    getAllLatestResults: () => latestResults,
    engineVersions,
    stepReplay: replayAdapter ? () => runReplayCycle() : undefined,
    seekReplay: replayAdapter ? async (index: number) => {
        if (replayAdapter) {
            replayAdapter.reset();
            for (let i = 0; i < index; i++) {
                await replayAdapter.fetchOHLCV(primarySymbol, TIMEFRAME, 1);
            }
        }
        return runReplayCycle();
    } : undefined,
});

app.get('/health', (_req, res) => {
    res.status(pipelineReady ? 200 : 503).json({
        status: pipelineReady ? 'ok' : 'starting',
        symbols: ACTIVE_SYMBOLS,
        timestamp: new Date().toISOString(),
    });
});

// ── Server startup ────────────────────────────────────────────────────────────
const tlsConfig = getTlsConfigFromEnv();
if (tlsConfig) {
    startHttpsServer(app, PORT, tlsConfig);
} else {
    app.listen(PORT, () => {
        console.log(`[Server] Analytical HUD API on http://localhost:${PORT}`);
        console.log(`[Server] Active symbols: ${ACTIVE_SYMBOLS.join(', ')}`);
        console.log(`[Server] Bearer token: ${API_TOKEN}`);
        console.log(`[Server] Replay: ${replayAdapter ? REPLAY_CSV_PATH : 'not configured (set REPLAY_CSV_PATH)'}`);
    });
}

// ── Pipeline loops — staggered per symbol ─────────────────────────────────────
console.log(`[Pipeline] Starting ${ACTIVE_SYMBOLS.length} symbol(s), poll every ${POLL_INTERVAL_MS}ms`);
ACTIVE_SYMBOLS.forEach((symbol, i) => {
    setTimeout(() => {
        runSymbolCycle(symbol);
        setInterval(() => runSymbolCycle(symbol), POLL_INTERVAL_MS);
    }, i * SYMBOL_STAGGER_MS);
});
