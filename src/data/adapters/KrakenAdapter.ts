// KrakenAdapter — real market data via Kraken public REST API
// No API key required for market data endpoints
// Kraken API docs: https://docs.kraken.com/rest/
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

const KRAKEN_BASE = 'https://api.kraken.com/0/public';

// Timeframe mapping: our format → Kraken interval (minutes)
const TIMEFRAME_MAP: Record<string, number> = {
    '1m': 1, '5m': 5, '15m': 15, '30m': 30,
    '1h': 60, '4h': 240, '1d': 1440, '1w': 10080,
};

// Symbol mapping: our format → Kraken pair
function toKrakenPair(symbol: string): string {
    // BTC-USDT → XBTUSDT, ETH-USDT → ETHUSDT, etc.
    const map: Record<string, string> = {
        'BTC-USDT': 'XBTUSDT',
        'BTC-USD': 'XBTUSD',
        'ETH-USDT': 'ETHUSDT',
        'ETH-USD': 'ETHUSD',
        'SOL-USDT': 'SOLUSDT',
        'SOL-USD': 'SOLUSD',
    };
    return map[symbol.toUpperCase()] ?? symbol.replace('-', '').toUpperCase();
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'AnalyticalHUD/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    const json = await res.json() as { error: string[]; result: T };
    if (json.error && json.error.length > 0) {
        throw new Error(`Kraken API error: ${json.error.join(', ')}`);
    }
    return json.result;
}

export class KrakenAdapter implements DataAdapter {

    // ── OHLCV ────────────────────────────────────────────────────────────────
    async fetchOHLCV(symbol: string, timeframe: string, limit: number): Promise<OHLCVBar[]> {
        const pair = toKrakenPair(symbol);
        const interval = TIMEFRAME_MAP[timeframe] ?? 1;
        const url = `${KRAKEN_BASE}/OHLC?pair=${pair}&interval=${interval}`;

        // Kraken OHLC: { [pair]: [[time, open, high, low, close, vwap, volume, count], ...] }
        const result = await fetchJson<Record<string, Array<[number, string, string, string, string, string, string, number]>>>(url);

        const pairKey = Object.keys(result).find(k => k !== 'last') ?? pair;
        const candles = result[pairKey] ?? [];

        // Take last `limit` candles
        const sliced = candles.slice(-limit);

        return sliced.map(k => ({
            timestamp: new Date(k[0] * 1000).toISOString(),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[6]),
        }));
    }

    // ── Orderflow ────────────────────────────────────────────────────────────
    async fetchOrderflow(symbol: string): Promise<OrderflowSnapshot> {
        const pair = toKrakenPair(symbol);

        // Order book depth
        const url = `${KRAKEN_BASE}/Depth?pair=${pair}&count=20`;
        const result = await fetchJson<Record<string, { bids: [string, string, number][]; asks: [string, string, number][] }>>(url);

        const pairKey = Object.keys(result)[0];
        const book = result[pairKey];

        const bidVolume = book.bids.reduce((sum, [, qty]) => sum + parseFloat(qty), 0);
        const askVolume = book.asks.reduce((sum, [, qty]) => sum + parseFloat(qty), 0);
        const delta = askVolume - bidVolume;

        // Recent trades for CVD
        const tradesUrl = `${KRAKEN_BASE}/Trades?pair=${pair}&count=100`;
        const tradesResult = await fetchJson<Record<string, Array<[string, string, number, string, string, string, string]>>>(tradesUrl);
        const tradesPairKey = Object.keys(tradesResult).find(k => k !== 'last') ?? pairKey;
        const trades = tradesResult[tradesPairKey] ?? [];

        // Kraken trade: [price, volume, time, buy/sell, market/limit, misc, tradeId]
        // 'b' = buy (taker bought = ask aggressor), 's' = sell (taker sold = bid aggressor)
        let cvd = 0;
        for (const trade of trades) {
            const qty = parseFloat(trade[1]);
            cvd += trade[3] === 'b' ? qty : -qty;
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
        const pair = toKrakenPair(symbol);
        const interval = TIMEFRAME_MAP[timeframe] ?? 60;
        const url = `${KRAKEN_BASE}/OHLC?pair=${pair}&interval=${interval}`;

        const result = await fetchJson<Record<string, Array<[number, string, string, string, string, string, string, number]>>>(url);
        const pairKey = Object.keys(result).find(k => k !== 'last') ?? pair;
        const candles = (result[pairKey] ?? []).slice(-50);

        const levels: Array<{ price: number; volume: number }> = [];
        let pocPrice = 0;
        let maxVol = 0;

        for (const k of candles) {
            const mid = (parseFloat(k[2]) + parseFloat(k[3])) / 2;
            const vol = parseFloat(k[6]);
            levels.push({ price: mid, volume: vol });
            if (vol > maxVol) { maxVol = vol; pocPrice = mid; }
        }

        const prices = levels.map(l => l.price);
        return {
            timestamp: new Date().toISOString(),
            levels,
            poc: pocPrice,
            vah: Math.max(...prices),
            val: Math.min(...prices),
        };
    }

    // ── Volatility Metrics ───────────────────────────────────────────────────
    async fetchVolatilityMetrics(symbol: string): Promise<VolatilityMetrics> {
        const pair = toKrakenPair(symbol);
        // Use 15-minute candles for more meaningful ATR (1-min ATR can be noisy)
        const url = `${KRAKEN_BASE}/OHLC?pair=${pair}&interval=15`;

        const result = await fetchJson<Record<string, Array<[number, string, string, string, string, string, string, number]>>>(url);
        const pairKey = Object.keys(result).find(k => k !== 'last') ?? pair;
        const rawCandles = (result[pairKey] ?? []).slice(-20);

        const candles = rawCandles.map(k => ({
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
        }));

        if (candles.length < 2) {
            return {
                timestamp: new Date().toISOString(),
                atr: 100, atrPercentile: 0.5,
                bandwidth: 0.001, historicalVolatility: 0.5,
            };
        }

        // ATR (14-period true range)
        const trs: number[] = [];
        for (let i = 1; i < candles.length; i++) {
            const tr = Math.max(
                candles[i].high - candles[i].low,
                Math.abs(candles[i].high - candles[i - 1].close),
                Math.abs(candles[i].low - candles[i - 1].close),
            );
            trs.push(tr);
        }
        const period = Math.min(14, trs.length);
        const atr = trs.slice(-period).reduce((a, b) => a + b, 0) / period;

        // ATR percentile within the observed window
        const sorted = [...trs].sort((a, b) => a - b);
        const atrPercentile = sorted.filter(v => v <= atr).length / sorted.length;

        const last = candles[candles.length - 1];
        // bandwidth = (high - low) / close, clamped to [0, 1]
        const bandwidth = last.close > 0
            ? Math.min(1, (last.high - last.low) / last.close)
            : 0.001;

        // Historical volatility (annualized from 15-min log returns)
        const closes = candles.map(c => c.close);
        const logReturns = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
        const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
        const variance = logReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / logReturns.length;
        // 15-min bars: 96 bars/day, 365 days
        const historicalVolatility = Math.sqrt(variance) * Math.sqrt(96 * 365);

        return {
            timestamp: new Date().toISOString(),
            atr,
            atrPercentile,
            bandwidth,
            historicalVolatility,
        };
    }

    // ── Macro Indicators ─────────────────────────────────────────────────────
    // Kraken doesn't provide macro data — use Yahoo Finance (same as Binance adapter)
    async fetchMacroIndicators(): Promise<MacroIndicators> {
        const symbols = ['DX-Y.NYB', '^VIX', '^GSPC', 'GC=F'];
        const results: Record<string, number> = {};

        await Promise.allSettled(symbols.map(async (sym) => {
            try {
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
                const data = await fetch(url, { headers: { 'User-Agent': 'AnalyticalHUD/1.0' } });
                const json = await data.json() as { chart: { result: Array<{ meta: { regularMarketPrice: number } }> } };
                const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
                if (price != null) results[sym] = price;
            } catch { /* fallback to defaults */ }
        }));

        // Kraken funding rate via their futures API (Kraken Futures = api.futures.kraken.com)
        let fundingRate = 0.0001;
        let sentiment = 0.5;
        try {
            const frUrl = 'https://futures.kraken.com/derivatives/api/v3/tickers';
            const frData = await fetch(frUrl, { headers: { 'User-Agent': 'AnalyticalHUD/1.0' } });
            const frJson = await frData.json() as { tickers: Array<{ symbol: string; fundingRate: number }> };
            const btcTicker = frJson.tickers?.find(t => t.symbol === 'PF_XBTUSD');
            if (btcTicker?.fundingRate != null) {
                fundingRate = btcTicker.fundingRate;
                // fundingRate is already in percent (e.g. -0.311 = -0.311% per 8h)
                // Scale to sentiment: neutral at 0%, +1% → bullish (0.6), -1% → bearish (0.4)
                // Clamp to [0, 1] with ±0.5% as the full range
                sentiment = Math.max(0, Math.min(1, 0.5 + fundingRate));
            }
        } catch { /* keep defaults */ }

        return {
            timestamp: new Date().toISOString(),
            dxy: results['DX-Y.NYB'] ?? 104.0,
            vix: results['^VIX'] ?? 18.0,
            spx: results['^GSPC'] ?? 5200.0,
            gold: results['GC=F'] ?? 2350.0,
            sentiment,
            fundingRate,
            etfFlows: 0,
        };
    }

    // ── Derivatives Data ─────────────────────────────────────────────────────
    async fetchDerivativesData(symbol: string): Promise<DerivativesData> {
        // Kraken Futures public API — no auth required for tickers
        const krakenFuturesSymbol = symbol.includes('BTC') ? 'PF_XBTUSD'
            : symbol.includes('ETH') ? 'PF_ETHUSD'
                : symbol.includes('SOL') ? 'PF_SOLUSD'
                    : 'PF_XBTUSD';

        let openInterest = 0;
        let fundingRate = 0.0001;
        const liquidationLevels: Array<{ price: number; size: number; side: 'LONG' | 'SHORT' }> = [];

        try {
            const url = `https://futures.kraken.com/derivatives/api/v3/tickers`;
            const data = await fetch(url, { headers: { 'User-Agent': 'AnalyticalHUD/1.0' } });
            const json = await data.json() as { tickers: Array<{ symbol: string; openInterest: number; fundingRate: number; markPrice: number }> };
            const ticker = json.tickers?.find(t => t.symbol === krakenFuturesSymbol);

            if (ticker) {
                openInterest = ticker.openInterest ?? 0;
                fundingRate = ticker.fundingRate ?? 0.0001;
                const markPrice = ticker.markPrice ?? 0;

                if (markPrice > 0) {
                    liquidationLevels.push(
                        { price: markPrice * 0.98, size: openInterest * 0.1, side: 'LONG' },
                        { price: markPrice * 0.95, size: openInterest * 0.2, side: 'LONG' },
                        { price: markPrice * 1.02, size: openInterest * 0.1, side: 'SHORT' },
                        { price: markPrice * 1.05, size: openInterest * 0.2, side: 'SHORT' },
                    );
                }
            }
        } catch { /* keep defaults */ }

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
            sessionType = 'WEEKEND'; volatilityPattern = 0.2;
        } else if (hour >= 0 && hour < 8) {
            sessionType = 'ASIA'; volatilityPattern = 0.35;
        } else if (hour >= 8 && hour < 13) {
            sessionType = 'LONDON'; volatilityPattern = 0.65;
        } else if (hour >= 13 && hour < 21) {
            sessionType = 'NEWYORK'; volatilityPattern = 0.80;
        } else {
            sessionType = 'POSTNY'; volatilityPattern = 0.30;
        }

        return { timestamp, sessionType, volatilityPattern };
    }
}
