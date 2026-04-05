// LiveExchangeFeedAdapter — real market data via Binance public REST API
// No API key required for market data endpoints
// Requirements: 8.3

import fetch from 'node-fetch';
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

const BINANCE_BASE = 'https://api.binance.com/api/v3';
const BINANCE_FUTURES = 'https://fapi.binance.com/fapi/v1';

// Timeframe mapping: our format → Binance interval
const TIMEFRAME_MAP: Record<string, string> = {
    '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
    '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '8h': '8h', '12h': '12h',
    '1d': '1d', '3d': '3d', '1w': '1w',
};

// Symbol mapping: our format → Binance format
function toBinanceSymbol(symbol: string): string {
    return symbol.replace('-', '').toUpperCase(); // BTC-USDT → BTCUSDT
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'AnalyticalHUD/1.0' },
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${url}`);
    }
    return res.json() as Promise<T>;
}

export class LiveExchangeFeedAdapter implements DataAdapter {

    // ── OHLCV ────────────────────────────────────────────────────────────────
    async fetchOHLCV(symbol: string, timeframe: string, limit: number): Promise<OHLCVBar[]> {
        const binanceSymbol = toBinanceSymbol(symbol);
        const interval = TIMEFRAME_MAP[timeframe] ?? '1m';
        const url = `${BINANCE_BASE}/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;

        // Binance kline format: [openTime, open, high, low, close, volume, closeTime, ...]
        const raw = await fetchJson<Array<[number, string, string, string, string, string, number, ...unknown[]]>>(url);

        return raw.map(k => ({
            timestamp: new Date(k[0]).toISOString(),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
        }));
    }

    // ── Orderflow ────────────────────────────────────────────────────────────
    async fetchOrderflow(symbol: string): Promise<OrderflowSnapshot> {
        const binanceSymbol = toBinanceSymbol(symbol);

        // Use order book depth to approximate bid/ask pressure
        const url = `${BINANCE_BASE}/depth?symbol=${binanceSymbol}&limit=20`;
        const book = await fetchJson<{ bids: [string, string][]; asks: [string, string][] }>(url);

        const bidVolume = book.bids.reduce((sum, [, qty]) => sum + parseFloat(qty), 0);
        const askVolume = book.asks.reduce((sum, [, qty]) => sum + parseFloat(qty), 0);
        const delta = askVolume - bidVolume;

        // Get recent trades for CVD approximation
        const tradesUrl = `${BINANCE_BASE}/trades?symbol=${binanceSymbol}&limit=100`;
        const trades = await fetchJson<Array<{ isBuyerMaker: boolean; qty: string }>>(tradesUrl);

        let cvd = 0;
        for (const trade of trades) {
            const qty = parseFloat(trade.qty);
            cvd += trade.isBuyerMaker ? -qty : qty;
        }

        return {
            timestamp: new Date().toISOString(),
            bid: bidVolume,
            ask: askVolume,
            delta,
            cvd,
        };
    }

    // ── Volume Profile ───────────────────────────────────────────────────────
    async fetchVolumeProfile(symbol: string, timeframe: string): Promise<VolumeProfile> {
        const binanceSymbol = toBinanceSymbol(symbol);
        const interval = TIMEFRAME_MAP[timeframe] ?? '1h';
        const url = `${BINANCE_BASE}/klines?symbol=${binanceSymbol}&interval=${interval}&limit=50`;

        const raw = await fetchJson<Array<[number, string, string, string, string, string, ...unknown[]]>>(url);

        // Build volume profile from OHLCV — approximate price levels
        const levels: Array<{ price: number; volume: number }> = [];
        let maxVol = 0;
        let pocPrice = 0;
        let maxVolSeen = 0;

        for (const k of raw) {
            const mid = (parseFloat(k[2]) + parseFloat(k[3])) / 2; // (high + low) / 2
            const vol = parseFloat(k[5]);
            levels.push({ price: mid, volume: vol });
            if (vol > maxVolSeen) {
                maxVolSeen = vol;
                pocPrice = mid;
            }
            maxVol = Math.max(maxVol, vol);
        }

        const prices = levels.map(l => l.price);
        const vah = Math.max(...prices);
        const val = Math.min(...prices);

        return {
            timestamp: new Date().toISOString(),
            levels,
            poc: pocPrice,
            vah,
            val,
        };
    }

    // ── Volatility Metrics ───────────────────────────────────────────────────
    async fetchVolatilityMetrics(symbol: string): Promise<VolatilityMetrics> {
        const binanceSymbol = toBinanceSymbol(symbol);
        // Fetch last 20 1h candles to compute ATR
        const url = `${BINANCE_BASE}/klines?symbol=${binanceSymbol}&interval=1h&limit=20`;
        const raw = await fetchJson<Array<[number, string, string, string, string, string, number, ...unknown[]]>>(url);

        const candles = raw.map(k => ({
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
        }));

        // Compute ATR (14-period)
        let atrSum = 0;
        const period = Math.min(14, candles.length - 1);
        for (let i = 1; i <= period; i++) {
            const tr = Math.max(
                candles[i].high - candles[i].low,
                Math.abs(candles[i].high - candles[i - 1].close),
                Math.abs(candles[i].low - candles[i - 1].close),
            );
            atrSum += tr;
        }
        const atr = atrSum / period;

        // ATR percentile (rough: compare current ATR to recent range)
        const allTRs: number[] = [];
        for (let i = 1; i < candles.length; i++) {
            allTRs.push(Math.max(
                candles[i].high - candles[i].low,
                Math.abs(candles[i].high - candles[i - 1].close),
                Math.abs(candles[i].low - candles[i - 1].close),
            ));
        }
        allTRs.sort((a, b) => a - b);
        const atrPercentile = allTRs.filter(v => v <= atr).length / allTRs.length;

        // Bandwidth: (high - low) / close of last candle
        const last = candles[candles.length - 1];
        const bandwidth = (last.high - last.low) / last.close;

        // Historical volatility: std dev of log returns
        const closes = raw.map(k => parseFloat(k[4]));
        const logReturns = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
        const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
        const variance = logReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / logReturns.length;
        const historicalVolatility = Math.sqrt(variance) * Math.sqrt(365 * 24); // annualized

        return {
            timestamp: new Date().toISOString(),
            atr,
            atrPercentile,
            bandwidth,
            historicalVolatility,
        };
    }

    // ── Macro Indicators ─────────────────────────────────────────────────────
    // Uses Yahoo Finance unofficial API (no key required) for DXY, VIX, SPX, Gold
    async fetchMacroIndicators(): Promise<MacroIndicators> {
        const symbols = ['DX-Y.NYB', '^VIX', '^GSPC', 'GC=F'];
        const results: Record<string, number> = {};

        await Promise.allSettled(symbols.map(async (sym) => {
            try {
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
                const data = await fetchJson<{
                    chart: { result: Array<{ meta: { regularMarketPrice: number } }> }
                }>(url);
                const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
                if (price != null) results[sym] = price;
            } catch {
                // Fallback to reasonable defaults if Yahoo is unavailable
            }
        }));

        // Binance funding rate for crypto sentiment
        let fundingRate = 0.0001;
        let sentiment = 0.5;
        try {
            const fundingUrl = `${BINANCE_FUTURES}/fundingRate?symbol=BTCUSDT&limit=1`;
            const funding = await fetchJson<Array<{ fundingRate: string }>>(fundingUrl);
            if (funding[0]) {
                fundingRate = parseFloat(funding[0].fundingRate);
                // Positive funding = bullish sentiment, negative = bearish
                sentiment = Math.max(0, Math.min(1, 0.5 + fundingRate * 100));
            }
        } catch {
            // Keep defaults
        }

        return {
            timestamp: new Date().toISOString(),
            dxy: results['DX-Y.NYB'] ?? 104.0,
            vix: results['^VIX'] ?? 18.0,
            spx: results['^GSPC'] ?? 5200.0,
            gold: results['GC=F'] ?? 2350.0,
            sentiment,
            fundingRate,
            etfFlows: 0, // ETF flow data requires paid data provider
        };
    }

    // ── Derivatives Data ─────────────────────────────────────────────────────
    async fetchDerivativesData(symbol: string): Promise<DerivativesData> {
        const binanceSymbol = toBinanceSymbol(symbol);

        let openInterest = 0;
        let fundingRate = 0.0001;
        const liquidationLevels: Array<{ price: number; size: number; side: 'LONG' | 'SHORT' }> = [];

        try {
            // Open interest
            const oiUrl = `${BINANCE_FUTURES}/openInterest?symbol=${binanceSymbol}`;
            const oi = await fetchJson<{ openInterest: string }>(oiUrl);
            openInterest = parseFloat(oi.openInterest);

            // Funding rate
            const frUrl = `${BINANCE_FUTURES}/fundingRate?symbol=${binanceSymbol}&limit=1`;
            const fr = await fetchJson<Array<{ fundingRate: string }>>(frUrl);
            if (fr[0]) fundingRate = parseFloat(fr[0].fundingRate);

            // Liquidation levels from mark price and OI distribution (approximated)
            const markUrl = `${BINANCE_FUTURES}/premiumIndex?symbol=${binanceSymbol}`;
            const mark = await fetchJson<{ markPrice: string }>(markUrl);
            const markPrice = parseFloat(mark.markPrice);

            // Approximate liquidation clusters at ±2%, ±5% from mark price
            liquidationLevels.push(
                { price: markPrice * 0.98, size: openInterest * 0.1, side: 'LONG' },
                { price: markPrice * 0.95, size: openInterest * 0.2, side: 'LONG' },
                { price: markPrice * 1.02, size: openInterest * 0.1, side: 'SHORT' },
                { price: markPrice * 1.05, size: openInterest * 0.2, side: 'SHORT' },
            );
        } catch {
            // Futures data may not be available for all symbols — use defaults
        }

        return {
            timestamp: new Date().toISOString(),
            openInterest,
            fundingRate,
            liquidationLevels,
        };
    }

    // ── Session Data ─────────────────────────────────────────────────────────
    async fetchSessionData(timestamp: string): Promise<SessionData> {
        const date = new Date(timestamp);
        const hour = date.getUTCHours();
        const day = date.getUTCDay();

        let sessionType = 'NEWYORK';
        let volatilityPattern = 0.5;

        if (day === 0 || day === 6) {
            sessionType = 'WEEKEND';
            volatilityPattern = 0.2;
        } else if (hour >= 0 && hour < 8) {
            sessionType = 'ASIA';
            volatilityPattern = 0.35;
        } else if (hour >= 8 && hour < 13) {
            sessionType = 'LONDON';
            volatilityPattern = 0.65;
        } else if (hour >= 13 && hour < 21) {
            sessionType = 'NEWYORK';
            volatilityPattern = 0.80;
        } else {
            sessionType = 'POSTNY';
            volatilityPattern = 0.30;
        }

        return { timestamp, sessionType, volatilityPattern };
    }
}
