// Main entry point — wires API server, pipeline loop, and journal
import express from 'express';
import { createApiServer, registerToken, recordCycleDuration } from './api/index.js';
import { PipelineOrchestrator } from './pipeline/PipelineOrchestrator.js';
import { Journal } from './journal/Journal.js';
import { InMemoryBackend } from './journal/backends/InMemoryBackend.js';
import { KrakenAdapter } from './data/adapters/KrakenAdapter.js';
import { assembleBundle } from './data/bundleAssembler.js';
import { getTlsConfigFromEnv, startHttpsServer } from './api/httpsServer.js';
import type { PipelineResult } from '../shared/types/index.js';
import type { RollingStats } from './data/bundleAssembler.js';
import type { VolatilityMetrics } from './data/adapters/DataAdapter.js';

// ── Compute volatility metrics from OHLCV bars (avoids extra API call) ───────
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

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const API_TOKEN = process.env['API_TOKEN'] ?? 'dev-token-change-me';
const SYMBOL = process.env['SYMBOL'] ?? 'BTC-USDT';
const TIMEFRAME = process.env['TIMEFRAME'] ?? '1m';
const POLL_INTERVAL_MS = parseInt(process.env['POLL_INTERVAL_MS'] ?? '2000', 10);

// ── Journal ──────────────────────────────────────────────────────────────────
const journal = new Journal([new InMemoryBackend(10_000)]);

// ── Pipeline ─────────────────────────────────────────────────────────────────
const orchestrator = new PipelineOrchestrator();
const adapter = new KrakenAdapter();

// Cache of latest results per symbol
const latestResults = new Map<string, PipelineResult>();

const rollingStats: RollingStats = {
    rollingMeanVolume: 500,
    rollingATR: 200,
    rollingDeltaStd: 10,
    atrPercentile: 0.5,
    bandwidth: 0.04,
    previousCvd: 0,
};

let seq = 0;
let pipelineReady = false;

// Rolling candle window — keeps last 20 candles for structure engines
const candleWindow: Array<{ high: number; low: number; open: number; close: number; timestamp: string }> = [];
const CANDLE_WINDOW_SIZE = 20;

async function runPipelineCycle(): Promise<void> {
    try {
        const bars = await adapter.fetchOHLCV(SYMBOL, TIMEFRAME, 20);
        const bar = bars[bars.length - 1];
        const orderflow = await adapter.fetchOrderflow(SYMBOL);
        const macro = await adapter.fetchMacroIndicators();

        // Compute volatility metrics from the OHLCV data we already have
        // This avoids a separate API call and prevents rate-limiting
        const volatility = computeVolatilityFromBars(bars);

        // Accumulate candle window — seed with all fetched bars on first cycle
        if (candleWindow.length === 0 && bars.length > 1) {
            // Pre-populate window with historical bars
            for (const b of bars.slice(-CANDLE_WINDOW_SIZE)) {
                candleWindow.push({ high: b.high, low: b.low, open: b.open, close: b.close, timestamp: b.timestamp });
            }
        } else {
            candleWindow.push({ high: bar.high, low: bar.low, open: bar.open, close: bar.close, timestamp: bar.timestamp });
            if (candleWindow.length > CANDLE_WINDOW_SIZE) candleWindow.shift();
        }

        // Update rolling stats from real data
        if (volatility.atr > 0) {
            // Exponential moving average for rolling ATR (alpha = 0.1)
            rollingStats.rollingATR = rollingStats.rollingATR === 200
                ? volatility.atr  // first real value — replace the placeholder
                : rollingStats.rollingATR * 0.9 + volatility.atr * 0.1;
        }
        if (bar.volume > 0) {
            rollingStats.rollingMeanVolume = rollingStats.rollingMeanVolume * 0.9 + bar.volume * 0.1;
        }
        // bandwidth from real candle, clamped to [0, 1]
        if (bar.close > 0) {
            rollingStats.bandwidth = Math.min(1, (bar.high - bar.low) / bar.close);
        }
        rollingStats.atrPercentile = volatility.atrPercentile;

        const bundle = assembleBundle({
            bar, orderflow, volatility, macro,
            swings: [], trend: 'RANGE',
            internalSwings: [], externalSwings: [],
            fvg: [], stopClusters: [], liqShelves: [],
            sessionType: 'NEWYORK', sessionVolatilityPattern: 0.5,
        }, ++seq, rollingStats);

        const result = await orchestrator.run(bundle, candleWindow);
        latestResults.set(SYMBOL, result);
        recordCycleDuration(result.durationMs);
        pipelineReady = true;

        // Journal: write risk rejection if hard-rejected
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

        // Journal: write state transition if state changed
        const state = result.decision.state;
        if (state.previousState !== null && state.previousState !== state.state) {
            journal.writeStateTransition({
                timestamp: state.timestamp,
                fromState: state.previousState,
                toState: state.state,
                reason: state.reason,
                alignmentScore: state.alignmentScore,
                bundleSeq: result.bundleSeq,
            });
        }

        // Only log degraded alert once per unique failure set, not every cycle
        if (result.degraded && seq <= 3) {
            journal.writeDiagnostic({
                timestamp: result.timestamp,
                category: 'OTHER',
                message: `Pipeline cycle ${seq} complete in ${result.durationMs}ms`,
                data: { degraded: result.degraded, failedEngines: result.failedEngines },
            });
        }
    } catch (err) {
        console.error('[Pipeline] Cycle error:', err);
    }
}

// ── API server ────────────────────────────────────────────────────────────────
registerToken(API_TOKEN);

const engineVersions: Record<string, string> = {
    GlobalStressEngine: '1.0.0',
    MacroBiasEngine: '1.0.0',
    RegimePersistenceEngine: '1.0.0',
    VolatilityRegimeEngine: '1.0.0',
    TimeSessionEngine: '1.0.0',
    SectorRotationEngine: '1.0.0',
    AssetProfileEngine: '1.0.0',
    MarketStructureContextEngine: '1.0.0',
    LiquidityMapEngine: '1.0.0',
    GeometryClassifier: '1.0.0',
    MicroStructureEngine: '1.0.0',
    OrderflowEngine: '1.0.0',
    PredictionEngine: '1.0.0',
    ScoringEngine: '1.0.0',
    RiskManager: '1.0.0',
};

const app = createApiServer({
    journal,
    getLatestResult: (symbol) => latestResults.get(symbol),
    getAllLatestResults: () => latestResults,
    engineVersions,
});

// Health endpoint (excluded from auth in server.ts via public route)
app.get('/health', (_req, res) => {
    if (!pipelineReady) {
        res.status(503).json({ status: 'starting', timestamp: new Date().toISOString() });
    } else {
        res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    }
});

// ── Server startup ───────────────────────────────────────────────────
const tlsConfig = getTlsConfigFromEnv();

if (tlsConfig) {
    // Production: start HTTPS server using provided TLS certificate
    startHttpsServer(app, PORT, tlsConfig);
} else {
    // Development: plain HTTP (no cert required)
    app.listen(PORT, () => {
        console.log(`[Server] Analytical HUD API running on http://localhost:${PORT}`);
        console.log(`[Server] Bearer token: ${API_TOKEN}`);
        console.log(`[Server] GET /api/v1/analysis/live?symbol=${SYMBOL}&timeframe=${TIMEFRAME}`);
        console.log(`[Server] GET /api/v1/system/versions (no auth required)`);
        console.log(`[Server] GET /health`);
        console.log(`[Server] CORS allowed origins: ${process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:5173 (default)'}`);
    });
}

// ── Pipeline loop ─────────────────────────────────────────────────────────────
console.log(`[Pipeline] Starting pipeline loop every ${POLL_INTERVAL_MS}ms...`);
runPipelineCycle(); // run immediately on startup

setInterval(runPipelineCycle, POLL_INTERVAL_MS);
