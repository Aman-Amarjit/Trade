// CsvReplayAdapter — processes candles in strict chronological order
// Requirements: 8.3, 8.6

import * as fs from 'fs';
import type {
    DataAdapter,
    OHLCVBar,
    OrderflowSnapshot,
    VolumeProfile,
    VolatilityMetrics,
    MacroIndicators,
    DerivativesData,
    SessionData,
} from './DataAdapter.js';

/**
 * CSV Replay Adapter.
 * Reads OHLCV bars from a CSV file in strict chronological order.
 * Respects the replay speed multiplier (1.0 = real-time, 2.0 = 2x speed).
 *
 * Expected CSV format (header row required):
 *   timestamp,open,high,low,close,volume
 */
export class CsvReplayAdapter implements DataAdapter {
    private readonly csvPath: string;
    private readonly replaySpeed: number;
    private bars: OHLCVBar[] = [];
    private cursor = 0;
    private loaded = false;

    constructor(csvPath: string, replaySpeed = 1.0) {
        this.csvPath = csvPath;
        this.replaySpeed = replaySpeed;
    }

    private loadCsv(): void {
        if (this.loaded) return;
        const content = fs.readFileSync(this.csvPath, 'utf-8');
        const lines = content.split('\n').filter((l) => l.trim().length > 0);
        // Skip header
        const dataLines = lines.slice(1);
        this.bars = dataLines
            .map((line) => {
                const [timestamp, open, high, low, close, volume] = line.split(',');
                return {
                    timestamp: timestamp.trim(),
                    open: parseFloat(open),
                    high: parseFloat(high),
                    low: parseFloat(low),
                    close: parseFloat(close),
                    volume: parseFloat(volume),
                };
            })
            // Strict chronological order
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        this.loaded = true;
    }

    private async replayDelay(intervalMs: number): Promise<void> {
        const delay = intervalMs / this.replaySpeed;
        return new Promise((resolve) => setTimeout(resolve, delay));
    }

    async fetchOHLCV(_symbol: string, _timeframe: string, limit: number): Promise<OHLCVBar[]> {
        this.loadCsv();
        const start = Math.max(0, this.cursor - limit + 1);
        const slice = this.bars.slice(start, this.cursor + 1);
        // Advance cursor and apply replay delay
        if (this.cursor < this.bars.length - 1) {
            await this.replayDelay(60_000); // assume 1-minute candles
            this.cursor++;
        }
        return slice;
    }

    async fetchOrderflow(_symbol: string): Promise<OrderflowSnapshot> {
        this.loadCsv();
        const bar = this.bars[this.cursor] ?? this.bars[this.bars.length - 1];
        const bid = bar ? bar.volume * 0.48 : 0;
        const ask = bar ? bar.volume * 0.52 : 0;
        return {
            timestamp: bar?.timestamp ?? new Date().toISOString(),
            bid,
            ask,
            delta: ask - bid,
            cvd: ask - bid,
        };
    }

    async fetchVolumeProfile(_symbol: string, _timeframe: string): Promise<VolumeProfile> {
        this.loadCsv();
        const bar = this.bars[this.cursor] ?? this.bars[this.bars.length - 1];
        const poc = bar ? (bar.high + bar.low) / 2 : 0;
        return {
            timestamp: bar?.timestamp ?? new Date().toISOString(),
            levels: bar
                ? [
                    { price: bar.low, volume: bar.volume * 0.2 },
                    { price: poc, volume: bar.volume * 0.6 },
                    { price: bar.high, volume: bar.volume * 0.2 },
                ]
                : [],
            poc,
            vah: bar ? bar.high : 0,
            val: bar ? bar.low : 0,
        };
    }

    async fetchVolatilityMetrics(_symbol: string): Promise<VolatilityMetrics> {
        this.loadCsv();
        const bar = this.bars[this.cursor] ?? this.bars[this.bars.length - 1];
        const atr = bar ? bar.high - bar.low : 0;
        return {
            timestamp: bar?.timestamp ?? new Date().toISOString(),
            atr,
            atrPercentile: 0.5,
            bandwidth: atr / (bar ? bar.close : 1),
            historicalVolatility: 0.5,
        };
    }

    async fetchMacroIndicators(): Promise<MacroIndicators> {
        this.loadCsv();
        const bar = this.bars[this.cursor] ?? this.bars[this.bars.length - 1];
        return {
            timestamp: bar?.timestamp ?? new Date().toISOString(),
            dxy: 104.0,
            vix: 18.0,
            spx: 5200,
            gold: 2350,
            sentiment: 0.5,
            fundingRate: 0.0001,
            etfFlows: 0,
        };
    }

    async fetchDerivativesData(_symbol: string): Promise<DerivativesData> {
        this.loadCsv();
        const bar = this.bars[this.cursor] ?? this.bars[this.bars.length - 1];
        return {
            timestamp: bar?.timestamp ?? new Date().toISOString(),
            openInterest: 1_000_000,
            fundingRate: 0.0001,
            liquidationLevels: [],
        };
    }

    async fetchSessionData(timestamp: string): Promise<SessionData> {
        return {
            timestamp,
            sessionType: 'NEWYORK',
            volatilityPattern: 0.5,
        };
    }

    /** Reset replay to the beginning */
    reset(): void {
        this.cursor = 0;
    }

    /** Total number of bars loaded */
    get totalBars(): number {
        this.loadCsv();
        return this.bars.length;
    }
}
