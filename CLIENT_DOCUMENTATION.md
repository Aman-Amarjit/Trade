# Analytical HUD — Client Documentation
**Version 1.0.0 | April 2026**

---

## What This System Is

A multi-layer analytical architecture for cryptocurrency markets. It is a pure analytical and visualization tool — it does not execute trades, generate buy/sell signals, or provide financial advice.

The system runs 15 analytical engines every cycle, processes real market data from Kraken, and serves results to a React HUD frontend via a REST API.

---

## Architecture Overview

```
Kraken API (live market data — no API key required)
        ↓
   Data Layer  (validation, normalization, fallback to mock on failure)
        ↓
   Pipeline Orchestrator  (15 engines in sequence, every 6s per symbol)
        ↓
   REST API  (Express, port 3000)
        ↓
   React HUD Frontend  (Vite, port 5173)
```

### The 15 Engines

**Context Engines** — run first, define the environment
1. GlobalStressEngine — SAFE / CAUTION / HALT
2. MacroBiasEngine — LONG / SHORT / NEUTRAL (runs every ~5 min)
3. TimeSessionEngine — ASIA / LONDON / NEWYORK / POSTNY / WEEKEND
4. VolatilityRegimeEngine — LOW / NORMAL / HIGH / EXTREME
5. SectorRotationEngine — capital flow between assets (runs every ~5 min)
6. RegimePersistenceEngine — regime stability
7. AssetProfileEngine — per-asset behavioral profile (runs every ~5 min)

**Structure Engines** — define the structural map
8. MarketStructureContextEngine — swings, trend, premium/discount zones
9. LiquidityMapEngine — stop clusters, FVGs, imbalance zones, resistant clusters

**Geometry & Micro Engines** — define local behavior
10. GeometryClassifier — curvature, imbalance, rotation, collapse/breakout probability
11. MicroStructureEngine — sweep, BOS, divergence, retest zone
12. OrderflowEngine — delta, CVD, absorption, bid/ask pressure

**Decision Engines** — synthesize everything
13. PredictionEngine — strict line, confidence bands (50/80/95%), min/max zone
14. ScoringEngine — unified probability score (0–100)
15. RiskManager — EDD, hard reject conditions, safety constraints

Plus: StateMachine — IDLE / WAITING_FOR_RETEST / IN_TRADE / COOLDOWN

---

## External APIs Used

No API keys are required. The system uses only public endpoints.

| Service | What it provides |
|---|---|
| Kraken REST API (`api.kraken.com`) | OHLCV candles, order book depth, recent trades |
| Kraken Futures API (`futures.kraken.com`) | Open interest, funding rate |
| Yahoo Finance (unofficial) | DXY, VIX, SPX, Gold spot prices |

If Kraken is unavailable, the system automatically falls back to deterministic mock data so the pipeline keeps running without crashing.

---

## Environment Variables

### Backend — create a `.env` file in the project root

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Default | Description |
|---|---|---|---|
| `API_TOKEN` | YES | `dev-token-change-me` | Bearer token for all API requests. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PORT` | no | `3000` | Backend server port |
| `SYMBOLS` | no | `BTC-USDT,ETH-USDT,SOL-USDT` | Comma-separated list of symbols to track |
| `TIMEFRAME` | no | `1m` | Candle timeframe: `1m`, `5m`, `15m`, `1h`, `4h`, `1d` |
| `ALLOWED_ORIGINS` | YES (prod) | — | CORS whitelist. Your frontend URL e.g. `https://your-app.netlify.app` |
| `LOG_DIR` | no | `./logs` | Directory for persistent journal log files |
| `REPLAY_CSV_PATH` | no | — | Path to CSV file for replay mode. Format: `timestamp,open,high,low,close,volume` |
| `TLS_CERT_PATH` | no | — | Path to TLS certificate (leave blank if your host handles TLS) |
| `TLS_KEY_PATH` | no | — | Path to TLS private key |

### Frontend — create a `.env` file inside the `frontend/` folder

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | YES | `/api/v1` | Backend API base URL. In production: `https://your-backend.railway.app/api/v1` |
| `VITE_API_TOKEN` | YES | — | Must match `API_TOKEN` on the backend exactly |
| `VITE_SYMBOLS` | no | `BTC-USDT,ETH-USDT,SOL-USDT` | Comma-separated symbols shown in the HUD asset selector |
| `VITE_DEFAULT_SYMBOL` | no | `BTC-USDT` | Symbol selected on first load |
| `VITE_DEFAULT_TIMEFRAME` | no | `1m` | Timeframe label shown in the header |

---

## Running Locally

```bash
# 1. Install backend dependencies
npm install

# 2. Create backend .env
cp .env.example .env
# Edit .env — set API_TOKEN at minimum

# 3. Start backend (port 3000)
npm run dev

# 4. In a separate terminal — install frontend dependencies
cd frontend
npm install

# 5. Start frontend (port 5173)
npm run dev
```

Open `http://localhost:5173` — the HUD connects to the backend at `http://localhost:3000`.

---

## Running Tests

```bash
# Backend tests (21 tests)
npm test

# Frontend tests (14 tests)
cd frontend
npm test
```

---

## Production Deployment

### Recommended Stack

| Layer | Service |
|---|---|
| Backend | Railway, Render, or Fly.io |
| Frontend | Netlify or Vercel |

### Backend on Railway

1. Connect your GitHub repository to Railway
2. Set environment variables in the Railway dashboard:
   - `API_TOKEN` — your secret token
   - `ALLOWED_ORIGINS` — your Netlify frontend URL
   - `SYMBOLS` — e.g. `BTC-USDT,ETH-USDT,SOL-USDT`
   - `LOG_DIR` — `/app/logs`
3. Railway auto-detects Node.js and runs `npm start`
4. Note your Railway URL — you will need it for the frontend

### Frontend on Netlify

1. Connect your GitHub repository to Netlify
2. Build settings:
   - Build command: `cd frontend && npm run build`
   - Publish directory: `frontend/dist`
3. Set environment variables in Netlify dashboard:
   - `VITE_API_BASE_URL` — your Railway URL + `/api/v1`
   - `VITE_API_TOKEN` — same token as the backend `API_TOKEN`
   - `VITE_SYMBOLS` — `BTC-USDT,ETH-USDT,SOL-USDT`
4. The `netlify.toml` in the project root handles SPA routing automatically

---

## Adding More Symbols

Adding a new asset is a two-step env var change — no code edits needed.

**Step 1 — Backend** (root `.env`):
```
SYMBOLS=BTC-USDT,ETH-USDT,SOL-USDT,XRP-USDT
```

**Step 2 — Frontend** (`frontend/.env` or Netlify env vars):
```
VITE_SYMBOLS=BTC-USDT,ETH-USDT,SOL-USDT,XRP-USDT
```

**Step 3 — Restart both** backend and frontend.

The HUD header will automatically show a new tab for the added symbol. Clicking the tab or a dashboard card switches all 8 panels to that asset and resets the graph history for a clean chart.

Each symbol runs its own independent pipeline with a 2-second stagger to avoid Kraken rate limits.

---

## API Reference

All endpoints (except `/health` and `/api/v1/system/versions`) require:

```
Authorization: Bearer <API_TOKEN>
```

All responses include: `X-Contract-Version: 1.0.0`

---

### GET /health

No auth required. Returns `200 OK` when pipeline is ready, `503` while starting.

```json
{ "status": "ok", "symbols": ["BTC-USDT", "ETH-USDT", "SOL-USDT"], "timestamp": "..." }
```

---

### GET /api/v1/system/versions

No auth required. Returns engine versions.

---

### GET /api/v1/analysis/live

Returns the full pipeline result for one symbol.

**Query params:** `symbol`, `timeframe`

**Response shape:**
```json
{
  "symbol": "BTC-USDT",
  "timeframe": "1m",
  "prediction": {
    "strictLine": 0.62,
    "min": 0.48, "max": 0.76,
    "band50": [0.58, 0.66],
    "band80": [0.54, 0.70],
    "band95": [0.50, 0.74],
    "liquidityBias": 0.31,
    "volatilityAdjustment": 0.0012,
    "smoothed": 0.61,
    "decayed": 0.60,
    "timestamp": "2026-04-05T14:22:00.000Z"
  },
  "risk": {
    "edd": 245.50,
    "stopDistance": 196.40,
    "targetDistance": 368.25,
    "ev": 12.40,
    "probability": 42.3,
    "volatilityRegime": "NORMAL",
    "globalStress": "SAFE",
    "geometryStable": true,
    "microstructureComplete": false,
    "hardReject": true,
    "rejectReasons": ["Probability 42.30 is below threshold of 80"]
  },
  "state": {
    "state": "IDLE",
    "previousState": null,
    "timestamp": "...",
    "reason": "Remaining in IDLE",
    "cooldownRemaining": 0,
    "alignmentScore": 0.28
  },
  "liquidity": {
    "zones": [
      { "id": "STOP_CLUSTER_83421_1", "type": "STOP_CLUSTER",
        "priceMin": 83380.0, "priceMax": 83463.0, "strength": 0.72 }
    ],
    "premiumZone": [83000, 86000],
    "discountZone": [80000, 83000],
    "structureBounds": [80000, 86000]
  },
  "geometry": {
    "curvature": 0.14, "imbalance": 0.08, "rotation": 0.22,
    "structurePressure": 0.83, "rotationPressure": 0.22,
    "collapseProb": 0.31, "breakoutProb": 0.54,
    "geometryRegime": "STABLE_STRUCTURE",
    "microState": "up-stable",
    "isStable": true
  },
  "microstructure": {
    "sweep": false, "divergence": false, "cvdDivergence": false,
    "bosDetected": false, "retestZone": false,
    "htfAlignment": true, "alignmentScore": 0.17
  },
  "timestamp": "2026-04-05T14:22:00.000Z",
  "degraded": false,
  "failedEngines": []
}
```

**Liquidity zone types:** `STOP_CLUSTER`, `LIQ_SHELF`, `FVG`, `IMBALANCE`, `RESISTANT_CLUSTER`

**Geometry regimes:** `STABLE_STRUCTURE`, `EXPANDING_STRUCTURE`, `COLLAPSING_STRUCTURE`, `CHAOTIC_STRUCTURE`

**System states:** `IDLE`, `WAITING_FOR_RETEST`, `IN_TRADE`, `COOLDOWN`

---

### GET /api/v1/analysis/dashboard

Returns a compact summary for multiple symbols simultaneously.

**Query params:** `symbols` (comma-separated)

```json
[
  {
    "symbol": "BTC-USDT", "available": true,
    "probability": 42.3, "volatilityRegime": "NORMAL",
    "globalStress": "SAFE", "state": "IDLE",
    "expectedMove": 245.50, "timeWindow": "13–21h UTC",
    "degraded": false
  }
]
```

---

### GET /api/v1/diagnostics/performance

Returns pipeline cycle timing (last 100 cycles): `p50`, `p95`, `p99` in milliseconds.

---

### GET /api/v1/diagnostics/journal

Returns journal log entries.

**Query params:** `engine`, `from` (ISO 8601), `to` (ISO 8601), `page`, `pageSize`

**Log entry types:** `ENGINE`, `STATE_TRANSITION`, `RISK_REJECTION`, `MICRO_EVENT`, `SYSTEM_DIAGNOSTIC`

---

### POST /api/v1/replay/activate

Activate or deactivate replay mode. Requires `REPLAY_CSV_PATH` set on backend.

**Body:** `{ "active": true }`

---

### POST /api/v1/replay/step

Step forward one candle in replay mode.

---

### POST /api/v1/replay/seek

Jump to a specific candle. **Body:** `{ "candleIndex": 42 }`

---

## Rate Limiting

60 requests per minute per IP. Exceeded: `HTTP 429`, `Retry-After: 60`.

---

## HUD Panels

| Panel | What it shows |
|---|---|
| Prediction Graph | Strict line, smoothed line, confidence bands (50/80/95%), min/max zone. Color changes with geometry regime |
| Diagnostics | Probability score, EDD, stop/target ranges, EV, volatility regime, stress state, reject reasons, weight sliders |
| Liquidity Map | Stop clusters, liquidation shelves, FVGs, imbalance zones, resistant clusters with strength |
| Geometry Panel | Curvature, imbalance, rotation, collapse/breakout probability, geometry regime, micro-state |
| Microstructure Panel | Sweep, BOS, divergence, CVD divergence, retest zone, HTF alignment, alignment score |
| Alerts Panel | Sweep detected, BOS confirmed, retest available, regime changes, stress changes, collapse warnings |
| Multi-Asset Dashboard | All tracked symbols — probability, EDD, regime, stress, state. Click any card to switch the HUD |
| Replay Panel | Activate replay mode, step forward, seek to candle index |

---

## Sound Alerts

The HUD plays distinct audio cues for each event type using the Web Audio API (no external files required). Sounds activate automatically after the first user interaction with the page.

| Event | Sound | Description |
|---|---|---|
| BOS Confirmed | Two-note ascending chime (C5 → G5) | Clean, bright — "structure broken" |
| Sweep Detected | Sharp downward glide (880Hz → 330Hz) | Aggressive sweep sound — "liquidity taken" |
| Retest Zone | Soft triple ping (same note × 2, then up) | Gentle — "opportunity forming" |
| Volatility → EXTREME | Double descending sawtooth alarm | Harsh, urgent — "danger" |
| Volatility change (other) | Gentle ascending triangle tones | Soft notification |
| Stress → HALT | Three descending sawtooth pulses | Low, urgent — "stop everything" |
| Stress change (other) | Soft ascending resolution chord | Calm — "all clear" |
| Geometry Collapse | Three descending triangle pulses | Fading — "structure weakening" |

---

## Replay Mode

1. Prepare a CSV file: `timestamp,open,high,low,close,volume`
2. Set `REPLAY_CSV_PATH=/path/to/file.csv` on the backend
3. In the HUD, click "Enter Replay" in the Replay Panel
4. Use "Step" to advance one candle, or "Seek" to jump to a specific index

---

## Journal Logs

All pipeline events logged to two places simultaneously:

- **Memory** — last 10,000 entries, queryable via `/api/v1/diagnostics/journal`
- **Disk** — `LOG_DIR` directory, JSONL format, one file per day, compressed after 1 hour, retained 7 days, max 10GB

---

## Safety Constraints

- No buy/sell/long/short/entry/exit/PnL language anywhere in the UI
- RiskManager hard-rejects when: GlobalStress ≠ SAFE, probability < 80%, volatility = EXTREME, geometry unstable, or microstructure incomplete
- No broker connections, no order placement, no financial advice

---

## Supported Symbols

Any Kraken-supported pair. Examples:

```
BTC-USDT   ETH-USDT   SOL-USDT   XRP-USDT
ADA-USDT   DOGE-USDT  AVAX-USDT  DOT-USDT
BTC-USD    ETH-USD    SOL-USD
```

---

## Troubleshooting

**HUD shows "Stale Data"** — Backend unreachable. Check `VITE_API_BASE_URL` and that the backend is running.

**503 on first load** — Backend just started, pipeline hasn't completed its first cycle. Wait 5–10 seconds.

**"Replay not configured"** — `REPLAY_CSV_PATH` not set or file doesn't exist.

**All panels show "No data"** — Selected symbol not in backend `SYMBOLS` list.

**Pipeline degraded alert** — One or more engines failed. System continues with fallback values. Check backend logs.

**No sounds** — Browser requires a user interaction before audio can play. Click anywhere on the page first.
