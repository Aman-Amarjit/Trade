# Analytical HUD — Client Documentation
**Version 1.1.0 | April 2026**

---

## What This System Is

A multi-layer analytical architecture for cryptocurrency markets. It is a pure analytical and visualization tool — it does not execute trades, generate buy/sell signals, or provide financial advice.

The system runs 15+ analytical engines every cycle on real Kraken market data, and serves results to a React HUD frontend via a secured REST API.

---

## How It Works

The "Trade" Analytical HUD operates through a continuous real-time cycle:

1. **Data Ingestion:** Every few seconds, the backend securely fetches raw market data (OHLCV, Orderbook depth) directly from public APIs like Kraken and Yahoo Finance. 
2. **The Pipeline Analysis:** This raw data is fed into a 15+ step "Pipeline Orchestrator". Each engine is responsible for a unique perspective of the market:
   - *Context:* Is the global market safe or stressed? What is the current volatility?
   - *Structure:* Where are the major support/resistance zones and liquidity?
   - *Geometry & Micro:* What is the immediate price action doing? Is order flow showing absorption?
   - *Breakout Logic:* Tracking range contractions and expansion cycles.
3. **Synthesis & Scoring:** The engines feed their outputs into Decision Engines. These finalize the "Alignment Score," representing the multi-layered favorability of current conditions. 
4. **Real-time Display:** The finalized analytical bundle is pushed via the REST API to the Frontend HUD dynamically.

---

## Architecture

```
Kraken API (live market data)
        ↓
   Data Layer  (validation, normalization, fallback)
        ↓
   Pipeline Orchestrator  (16 engines in sequence)
        ↓
   REST API  (Express, Bearer auth, rate limiting)
        ↓
   React HUD Frontend  (Vite, port 5173)
```

### The 16 Engines

**Context Engines**
1. GlobalStressEngine — SAFE / CAUTION / HALT
2. MacroBiasEngine — LONG / SHORT / NEUTRAL
3. TimeSessionEngine — ASIA / LONDON / NEWYORK...
4. VolatilityRegimeEngine — LOW / NORMAL / HIGH / EXTREME
5. SectorRotationEngine — capital flow between assets
6. RegimePersistenceEngine — regime stability
7. AssetProfileEngine — behavioral profiling

**Structure Engines**
8. MarketStructureContextEngine — swings, trend, premium/discount zones
9. LiquidityMapEngine — stop clusters, imbalance zones, shelves

**Geometry & Micro Engines**
10. GeometryClassifier — curvature, collapse/breakout probability
11. MicroStructureEngine — sweep, BOS, divergence, retest zone
12. OrderflowEngine — delta, CVD, absorption, bid/ask pressure

**Decision & Risk Layer**
13. PredictionEngine — alignment score (0–1), volatility envelopes
14. ScoringEngine — unified probability score (0–100)
15. RiskManager — EDD, Daily Drawdown Cap (Section 8.4)
16. BreakoutCycleEngine — range-cycle entries/exits (V4.0 Patch)

---

## How To Use It (User Guide)

### 1. Starting Up
Execute the `start.bat` script in the project root. This starts the backend and frontend. Open `http://localhost:5173`.

### 2. Monitoring the Multi-Asset Dashboard
The Dashboard (Section 9) provides a summary table: `Symbol | Align | Stress | Profit | Action`.
- **Align:** Overall signal strength (0-100%).
- **Stress:** Systemic risk state (SAFE/HALT).
- **Profit (EDD):** Mathematical expectation of the current move.
- **Action:** Current system state (IDLE, WAITING, ALIGNED).

### 3. Asset HUD Drilling
- **Prediction Graph:** Watch the "Alignment Score". Score near 100% means full alignment.
- **Liquidity Map:** Identify price levels where stop losses are clustered.
- **Safety Monitoring:** Check "Risk DD" (Daily Drawdown) for current 24h exposure.

### 4. Audio Alerts
- **Sweep:** Sharp downward glide.
- **BOS:** Ascending chime.
- **Stress/Vol Alarm:** Sawtooth pulses.

---

## Configuration (Environment Variables)

### Backend `.env`
- `API_TOKEN`: Security secret.
- `DAILY_DRAWDOWN_CAP`: Max allowed 24h drawdown (default 1000).
- `SYMBOLS`: Comma-separated list (e.g., `BTC-USDT,ETH-USDT`).

---

## Security & Safety
- **Bearer Auth**: All API requests require a token.
- **Hard Rejects**: RiskManager halts analysis if the Daily Drawdown Cap is exceeded or conditions are STRESSFUL.
- **Purity**: All analytical engines are pure functions.

---

> [!IMPORTANT]
> This system is for analytical interpretation only. It does not connect to brokers or execute trades. The "Alignment Score" is a measure of signal confluence, not a price prediction.
