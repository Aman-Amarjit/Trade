# Analytical HUD — Client Documentation
**Version 1.0.0 | April 2026**

---

## What This System Is

A multi-layer analytical architecture for cryptocurrency markets. It is a pure analytical and visualization tool — it does not execute trades, generate buy/sell signals, or provide financial advice.

The system runs 15 analytical engines every cycle on real Kraken market data, and serves results to a React HUD frontend via a secured REST API.

---

## Architecture

```
Kraken API (live market data — no API key required)
        ↓
   Data Layer  (validation, normalization, fallback to mock on failure)
        ↓
   Pipeline Orchestrator  (15 engines in sequence, every 6s per symbol)
        ↓
   REST API  (Express, port 3000, Bearer auth, rate limiting, HSTS)
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
13. PredictionEngine — alignment score (0–1), volatility envelopes, min/max zone
14. ScoringEngine — unified probability score (0–100) with per-engine contributions
15. RiskManager — EDD, hard reject conditions, safety constraints

Plus: StateMachine — IDLE / WAITING_FOR_RETEST / HIGH_ALIGNMENT / COOLDOWN

---

## What the Alignment Score Means

The primary output `strictLine` (displayed as "Alignment Score") is a **0–1 composite** of six normalized market signals:

- **0.7–1.0** — conditions broadly aligned and favorable
- **0.4–0.7** — mixed conditions, partial alignment
- **0.0–0.4** — conditions misaligned or unfavorable

It is NOT a price prediction, NOT a probability of price direction, and NOT a percent change. It is a weighted composite of geometry, liquidity, volatility, microstructure, orderflow, and macro signals.

The volatility envelopes (Wide/Mid/Narrow) are ATR-based ranges around the current alignment score — they show expected score variability given current volatility, not statistical confidence intervals.

---

## External APIs Used

No API keys required. All public endpoints.

| Service | What it provides |
|---|---|
| Kraken REST API (`api.kraken.com`) | OHLCV candles (closed bars only), order book depth, recent trades |
| Kraken Futures API (`futures.kraken.com`) | Open interest, funding rate |
| Yahoo Finance (unofficial) | DXY, VIX, SPX, Gold spot prices |

**Note on Yahoo Finance:** The unofficial Yahoo Finance endpoint is used for macro data (DXY, VIX, SPX, Gold). This is suitable for development and demo use. For commercial production, replace with a paid feed such as Alpha Vantage, Polygon.io, or Quandl. Hardcoded fallback values are used if Yahoo is unavailable.

If Kraken is unavailable, the system automatically falls back to deterministic mock data so the pipeline keeps running.

---

## Environment Variables

### Backend — root `.env`

Copy `.env.example` to `.env`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `API_TOKEN` | YES | `dev-token-change-me` | Bearer token. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PORT` | no | `3000` | Backend server port |
| `SYMBOLS` | no | `BTC-USDT,ETH-USDT,SOL-USDT` | Comma-separated symbols to track |
| `TIMEFRAME` | no | `1m` | Candle timeframe: `1m`, `5m`, `15m`, `1h`, `4h`, `1d` |
| `ALLOWED_ORIGINS` | YES (prod) | — | CORS whitelist. Your frontend URL e.g. `https://your-app.netlify.app` |
| `LOG_DIR` | no | `./logs` | Directory for persistent journal log files |
| `RATE_LIMIT_RPM` | no | `120` | Requests per minute per IP (120 supports 3-symbol multi-asset polling) |
| `REPLAY_CSV_PATH` | no | — | Path to CSV for replay mode. Format: `timestamp,open,high,low,close,volume` |
| `TLS_CERT_PATH` | no | — | TLS certificate path (leave blank if host handles TLS) |
| `TLS_KEY_PATH` | no | — | TLS private key path |

**Production safety:** The server will refuse to start if `API_TOKEN` is the default value and `NODE_ENV=production`.

### Frontend — `frontend/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | YES | `/api/v1` | Backend URL. In production: `https://your-backend.railway.app/api/v1` |
| `VITE_API_TOKEN` | YES | — | Must match backend `API_TOKEN` exactly |
| `VITE_SYMBOLS` | no | `BTC-USDT,ETH-USDT,SOL-USDT` | Symbols shown in the HUD asset selector |
| `VITE_DEFAULT_SYMBOL` | no | `BTC-USDT` | Symbol selected on first load |
| `VITE_DEFAULT_TIMEFRAME` | no | `1m` | Timeframe label shown in the header |

---

## Running Locally

```bash
# Backend
npm install
cp .env.example .env   # edit .env — set API_TOKEN
npm run dev            # http://localhost:3000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev            # http://localhost:5173
```

---

## Running Tests

```bash
# Backend (21 tests)
npm test

# Frontend (14 tests)
cd frontend
npm test
```

---

## Production Deployment

### Backend on Railway

1. Connect your GitHub repository to Railway
2. Railway auto-detects Node.js and uses `railway.toml` for build/start commands
3. Set environment variables in Railway dashboard:
   - `API_TOKEN` — strong random secret
   - `ALLOWED_ORIGINS` — your Netlify frontend URL
   - `SYMBOLS` — e.g. `BTC-USDT,ETH-USDT,SOL-USDT`
   - `NODE_ENV` — `production`
   - `LOG_DIR` — `/app/logs` (add a Persistent Volume in Railway for logs to survive redeploys)
4. Note your Railway URL for the frontend

**Important:** Railway uses ephemeral storage by default. Add a Persistent Volume mounted at `/app/logs` to retain journal logs across redeploys.

### Frontend on Netlify

1. Connect your GitHub repository to Netlify
2. Build settings:
   - Build command: `cd frontend && npm run build`
   - Publish directory: `frontend/dist`
3. Set environment variables in Netlify dashboard:
   - `VITE_API_BASE_URL` — your Railway URL + `/api/v1`
   - `VITE_API_TOKEN` — same as backend `API_TOKEN`
   - `VITE_SYMBOLS` — `BTC-USDT,ETH-USDT,SOL-USDT`
4. The `netlify.toml` handles SPA routing automatically

### Docker (alternative)

```bash
docker build -t analytical-hud .
docker run -p 3000:3000 \
  -e API_TOKEN=your-secret \
  -e ALLOWED_ORIGINS=https://your-frontend.com \
  -e NODE_ENV=production \
  analytical-hud
```

---

## CI/CD

GitHub Actions workflows are in `.github/workflows/`:

- `ci.yml` — runs on every push and pull request: TypeScript check, tests, build, `npm audit` security scan for both backend and frontend
- `deploy.yml` — runs on push to `main` only: deploys backend to Railway, then frontend to Netlify

Required GitHub Secrets for deployment:
- `RAILWAY_TOKEN` — Railway API token
- `NETLIFY_AUTH_TOKEN` — Netlify personal access token
- `NETLIFY_SITE_ID` — Netlify site ID
- `VITE_API_BASE_URL` — production backend URL
- `VITE_API_TOKEN` — production API token
- `VITE_SYMBOLS` — production symbol list

---

## Adding More Symbols

No code changes needed — only two env var edits.

### Step 1 — Backend

Open the root `.env` file and add the new symbol to `SYMBOLS`:
```
SYMBOLS=BTC-USDT,ETH-USDT,SOL-USDT,XRP-USDT
```

### Step 2 — Frontend

Open `frontend/.env` (or your Netlify/Railway env vars) and add the same symbol to `VITE_SYMBOLS`:
```
VITE_SYMBOLS=BTC-USDT,ETH-USDT,SOL-USDT,XRP-USDT
```

### Step 3 — Restart

Restart both the backend and frontend. The new symbol tab appears automatically in the HUD header. Clicking it switches all 8 panels to that asset with a clean graph.

### To remove a symbol

Remove it from both `SYMBOLS` and `VITE_SYMBOLS`, then restart.

### Rules

- Both lists must contain the same symbols
- Use Kraken pair format: `BTC-USDT`, `ETH-USDT`, `SOL-USDT`, `XRP-USDT`, `ADA-USDT`, `DOGE-USDT`, `AVAX-USDT`, `DOT-USDT`, `LINK-USDT`, `LTC-USDT`, `BCH-USDT`
- Each symbol runs its own independent pipeline with a 2-second stagger to avoid Kraken rate limits
- No hard limit on number of symbols — each one adds ~2 API calls per poll cycle

---

## API Reference

All endpoints except `/health` and `/api/v1/system/versions` require:
```
Authorization: Bearer <API_TOKEN>
```

All responses include:
- `X-Contract-Version: 1.0.0`
- `X-Request-Id: <uuid>` (for request tracing)
- `ETag: "<bundleSeq>"` (on `/analysis/live` — supports 304 Not Modified)

---

### GET /health

No auth. Returns `200` when pipeline is ready, `503` while starting.

```json
{ "status": "ok", "symbols": ["BTC-USDT"], "timestamp": "..." }
```

---

### GET /api/v1/system/versions

No auth. Returns engine versions and contract version.

---

### GET /api/v1/analysis/live

Full pipeline result for one symbol.

**Query params:** `symbol`, `timeframe` (must match backend `TIMEFRAME` env var)

**Response:**
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
  "scoring": {
    "probability": 42.3,
    "contributions": {
      "geometry": 35.2,
      "liquidity": 40.0,
      "microstructure": 28.5,
      "orderflow": 55.1,
      "volatility": 75.0,
      "macro": 50.0,
      "session": 80.0
    }
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

**Note:** `timeframe` must match the backend's configured `TIMEFRAME`. Returns HTTP 400 if mismatched.

---

### GET /api/v1/analysis/dashboard

Compact summary for multiple symbols.

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

Pipeline cycle timing (last 100 cycles): `p50`, `p95`, `p99` in milliseconds.

---

### GET /api/v1/diagnostics/journal

Journal log entries with filtering.

**Query params:** `engine`, `from` (ISO 8601), `to` (ISO 8601), `page`, `pageSize`

**Log types:** `ENGINE`, `STATE_TRANSITION`, `RISK_REJECTION`, `MICRO_EVENT`, `SYSTEM_DIAGNOSTIC`

---

### POST /api/v1/replay/activate

**Body:** `{ "active": true }` — requires `REPLAY_CSV_PATH` set on backend.

---

### POST /api/v1/replay/step

Step forward one candle in replay mode.

---

### POST /api/v1/replay/seek

Jump to candle index. **Body:** `{ "candleIndex": 42 }` — resets StateMachine state.

---

## Rate Limiting

Default: 120 requests per minute per IP (configurable via `RATE_LIMIT_RPM`).

Exceeded: `HTTP 429`, `Retry-After: 60`.

---

## HUD Panels

| Panel | What it shows |
|---|---|
| Prediction Graph | Alignment score history, volatility envelopes (Wide/Mid/Narrow), min/max zone. Color changes with geometry regime |
| Diagnostics | Probability score, EDD, stop/target ranges, EV, volatility regime, stress state, reject reasons, weight sliders (local preview) |
| Liquidity Map | Stop clusters, liquidation shelves, FVGs, imbalance zones, resistant clusters with strength |
| Geometry Panel | Curvature, imbalance, rotation, collapse/breakout probability, geometry regime, micro-state |
| Microstructure Panel | Sweep, BOS, divergence, CVD divergence, retest zone, HTF alignment, alignment score |
| Alerts Panel | Sweep detected, BOS confirmed, retest available, regime changes, stress changes, collapse warnings |
| Multi-Asset Dashboard | All tracked symbols — probability, EDD, regime, stress, state. Click any card to switch the HUD |
| Replay Panel | Activate replay mode, step forward, seek to candle index |

---

## Sound Alerts

Sounds activate after the first user interaction with the page (browser requirement).

| Event | Sound |
|---|---|
| BOS Confirmed | Two-note ascending chime (C5 → G5) |
| Sweep Detected | Sharp downward glide (880Hz → 330Hz) |
| Retest Zone | Soft triple ping |
| Volatility → EXTREME | Double descending sawtooth alarm |
| Volatility change (other) | Gentle ascending tones |
| Stress → HALT | Three descending sawtooth pulses |
| Stress change (other) | Soft ascending resolution chord |
| Geometry Collapse | Three fading triangle pulses |

---

## Replay Mode

1. Prepare CSV: `timestamp,open,high,low,close,volume`
2. Set `REPLAY_CSV_PATH=/path/to/file.csv` on backend
3. Click "Enter Replay" in the Replay Panel
4. Use "Step" to advance one candle, or "Seek" to jump to a specific index
5. Seeking backwards resets the StateMachine to prevent future-knowledge contamination

---

## Journal Logs

- **Memory** — last 10,000 entries, queryable via `/api/v1/diagnostics/journal`
- **Disk** — `LOG_DIR`, JSONL format, one file per day, compressed after 1 hour, retained 7 days, max 10GB
- **Note:** Railway requires a Persistent Volume for disk logs to survive redeploys

---

## Security

- Bearer token authentication on all API endpoints
- HSTS with preload, CSP, X-Frame-Options: DENY, X-Content-Type-Options
- CORS origin whitelist via `ALLOWED_ORIGINS`
- Request ID (`X-Request-Id`) on every response for tracing
- Query parameter sanitization (control character stripping, 200-char truncation)
- Request logging (method, path, status, duration — never logs auth tokens)
- Production startup validation — refuses to start with default `API_TOKEN`
- Rate limiting: 120 req/min per IP (configurable)

---

## Safety Constraints

- No buy/sell/long/short/entry/exit/PnL language anywhere in the UI
- RiskManager hard-rejects when: GlobalStress ≠ SAFE, probability < 80%, volatility = EXTREME, geometry unstable, or microstructure incomplete
- No broker connections, no order placement, no financial advice
- System state `IN_TRADE` is displayed as "HIGH ALIGNMENT" in the UI

---

## Supported Symbols

Any Kraken-supported pair:
```
BTC-USDT   ETH-USDT   SOL-USDT   XRP-USDT
ADA-USDT   DOGE-USDT  AVAX-USDT  DOT-USDT
BTC-USD    ETH-USD    SOL-USD
```

---

## Important Notes Before Going Live

### 1. Macro Data Source (Yahoo Finance)

The system uses Yahoo Finance's unofficial endpoint for DXY, VIX, SPX, and Gold prices. This works for development and demo use but **Yahoo Finance's Terms of Service prohibit commercial use** of their unofficial API.

For a commercial production deployment, replace it with a paid macro data feed:
- [Alpha Vantage](https://www.alphavantage.co/) — free tier available, paid for higher frequency
- [Polygon.io](https://polygon.io/) — reliable, well-documented
- [Quandl/Nasdaq Data Link](https://data.nasdaq.com/) — institutional grade

The system falls back to hardcoded defaults (DXY=104, VIX=18, SPX=5200, Gold=2350) if Yahoo is unavailable, so the pipeline never crashes — but macro-dependent engines (MacroBiasEngine, GlobalStressEngine) will use stale values.

### 2. Railway Persistent Volume

Railway uses **ephemeral storage by default** — every redeploy wipes the filesystem. This means journal logs (`LOG_DIR=/app/logs`) are lost on every deployment.

To retain logs across redeploys:
1. Go to your Railway service → Settings → Volumes
2. Add a volume mounted at `/app/logs`
3. This is a paid Railway feature (~$0.25/GB/month)

Without a persistent volume, the in-memory journal (last 10,000 entries) still works and is queryable via the API — only disk logs are affected.

### 3. The Alignment Score Is Not a Price Prediction

The primary output `strictLine` (displayed as "Alignment Score") is a **0–1 composite of market condition signals**. It tells you how aligned current conditions are across geometry, liquidity, volatility, microstructure, orderflow, and macro.

It does **not** predict price direction, price levels, or percentage moves. Users of the HUD should understand:
- Score near 1.0 = conditions broadly favorable/aligned
- Score near 0.0 = conditions unfavorable/misaligned
- The volatility envelopes (Wide/Mid/Narrow) show expected score variability, not statistical confidence intervals
- The probability score (0–100) reflects multi-domain alignment strength, not a calibrated probability of any specific market outcome

---

**HUD shows "Stale Data"** — Backend unreachable. Check `VITE_API_BASE_URL` and that the backend is running.

**503 on first load** — Backend just started. Wait ~20 seconds for the candle window to populate (requires 20 closed candles).

**HTTP 400 on /analysis/live** — Requested `timeframe` doesn't match backend `TIMEFRAME` env var.

**"Replay not configured"** — `REPLAY_CSV_PATH` not set or file doesn't exist.

**All panels show "No data"** — Selected symbol not in backend `SYMBOLS` list.

**Pipeline degraded alert** — One or more engines failed. System continues with fallback values. Check backend logs.

**No sounds** — Browser requires a user interaction before audio can play. Click anywhere on the page first.

**Logs lost on Railway redeploy** — Add a Persistent Volume mounted at `/app/logs` in Railway settings.
