# Analytical HUD — Client Handover Documentation

**Project:** Multi-Layer Analytical Architecture  
**Version:** 1.0.0  
**Date:** April 2026  
**Data Source:** Kraken (live BTC/USDT market data)

---

## What This System Is

This is a real-time market analysis tool. It reads live price data from Kraken, runs it through 15 analytical engines, and displays the results on a web-based dashboard.

It is not a trading bot. It does not place orders, generate buy/sell signals, or connect to any brokerage. The spec was explicit about this, and the system enforces it — the words "Buy", "Sell", "Entry", "Exit", and "PnL" do not appear anywhere in the interface or the codebase. A property-based test runs on every build to verify this.

What it produces is a structured analytical picture of the market: volatility conditions, liquidity zones, geometry state, microstructure events, and a probability-weighted prediction curve.

---

## How to Run It

You need two terminals running at the same time.

**Terminal 1 — Backend API**
```bash
npm run build
node dist/src/index.js
```
Starts the analytical pipeline at `http://localhost:3000`. Begins pulling live data from Kraken immediately and runs a new analysis cycle every 2 seconds.

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```
Starts the HUD at `http://localhost:5173`. Open that URL in your browser.

---

## Environment Variables

**Backend** (set before running `node dist/src/index.js`):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the API server listens on |
| `API_TOKEN` | `dev-token-change-me` | Bearer token for API authentication — change this in production |
| `SYMBOL` | `BTC-USDT` | Trading pair to analyze |
| `TIMEFRAME` | `1m` | Candle timeframe (`1m`, `5m`, `15m`, `1h`, `4h`) |
| `POLL_INTERVAL_MS` | `2000` | How often the pipeline runs (milliseconds) |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed CORS origins |
| `TLS_CERT_PATH` | _(empty)_ | Path to TLS certificate (leave blank for HTTP in dev) |
| `TLS_KEY_PATH` | _(empty)_ | Path to TLS private key |

**Frontend** (in `frontend/.env` for local, `frontend/.env.production` for Netlify):

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend URL, e.g. `https://your-backend.railway.app/api/v1` |
| `VITE_API_TOKEN` | Must match `API_TOKEN` on the backend |
| `VITE_DEFAULT_SYMBOL` | Symbol shown in the HUD header |
| `VITE_DEFAULT_TIMEFRAME` | Timeframe shown in the HUD header |

---

## What You See on the Dashboard

**Prediction Graph** — The main panel. Shows the strict prediction line (raw weighted output), the smoothed line (noise-reduced), min/max prediction zone, and confidence bands at 50%, 80%, and 95%. The prediction is a normalized value between 0 and 1 representing market alignment strength, not a price target.

**Diagnostics Panel** — Probability score (0–100), Expected Drawdown in USD, conceptual stop and target ranges, Expected Value, volatility regime, global stress state, and all rejection reasons when the system rejects current conditions.

**Liquidity Map** — All detected liquidity zones: stop clusters (red), liquidation shelves (orange), Fair Value Gaps (blue), imbalance zones (purple), resistant clusters (dark border). Also shows premium zone, discount zone, and structural boundaries.

**Geometry Panel** — Mathematical geometry of recent price action: curvature, imbalance, rotation, structure pressure, collapse probability, breakout probability, geometry regime, and micro-state.

**Microstructure Panel** — Short-term structural events: sweep, divergence, CVD divergence, Break of Structure (BOS), retest zone, HTF alignment, and alignment score.

**Alerts Panel** — Event-driven notifications: pipeline degradation, stale data, current system state, and transition reasons.

---

## The Analytical Pipeline

15 engines run in a fixed sequence every 2 seconds. Each layer feeds into the next.

### Layer 1 — Context (7 engines)

**GlobalStressEngine**  
Outputs: `SAFE | CAUTION | HALT`  
Logic: Counts active stressors. Returns CAUTION if 1 fires, HALT if 2+ fire.
- Stressor 1: VolatilityRegime = EXTREME
- Stressor 2: VIX > 30 OR DXY > 110
- Stressor 3: No stop clusters detected
- Stressor 4: Session volatilityPattern > 0.8

**MacroBiasEngine**  
Outputs: `LONG | SHORT | NEUTRAL`  
Logic: Weighted sum of normalized macro indicators → LONG if > 0.6, SHORT if < 0.4, else NEUTRAL.
```
weightedSum = DXY×0.20 + VIX×0.20 + SPX×0.25 + Gold×0.15 + sentiment×0.10 + fundingRate×0.05 + etfFlows×0.05
```
Normalization ranges: DXY [80–120], VIX [10–80], SPX [3000–6000], Gold [1500–3000], sentiment [0–1], fundingRate [−0.001–0.001], etfFlows [−1B–1B].

**VolatilityRegimeEngine**  
Outputs: `LOW | NORMAL | HIGH | EXTREME`  
Logic: Composite score from ATR percentile, bandwidth, and historical volatility percentile.
```
score = atrPercentile×0.4 + bandwidth×0.3 + hvPercentile×0.3
EXTREME if score ≥ 0.85, HIGH if ≥ 0.65, NORMAL if ≥ 0.35, else LOW
```

**TimeSessionEngine**  
Outputs: `ASIA | LONDON | NEWYORK | POSTNY | WEEKEND`  
Logic: UTC hour → ASIA (0–7), LONDON (8–12), NEWYORK (13–20), POSTNY (21–23). Saturday/Sunday → WEEKEND.

**RegimePersistenceEngine**  
Outputs: `LOW_PERSISTENCE | MEDIUM_PERSISTENCE | HIGH_PERSISTENCE`  
Logic: Scores 4 conditions (stable volatility, directional macro, active session, trending market). HIGH if 3+ score, MEDIUM if 2, else LOW.

**SectorRotationEngine**  
Outputs: `BTC-DOMINANT | ETH-DOMINANT | SOL-DOMINANT | MEME-ROTATION | RISK-OFF`  
Logic: Composite score per asset = average of (relativeStrength + volumeDistribution + volatilityDistribution) / 3. Returns RISK-OFF if all scores < 0.3, otherwise returns the highest-scoring asset's label.  
Note: In single-symbol mode (BTC-USDT only), all inputs are set to 0.5, so this engine always returns RISK-OFF. Multi-asset feeds would enable meaningful output.

**AssetProfileEngine**  
Outputs: `{ sensitivityProfile, volatilityProfile, liquidityProfile, macroResponsiveness }` — all in [0, 1].  
Logic:
```
sensitivityProfile  = clamp(historicalVolatility, 0, 1)
volatilityProfile   = clamp(historicalVolatility × 0.8 + riskOffBonus, 0, 1)
liquidityProfile    = clamp(liquidityDepth, 0, 1)
macroResponsiveness = clamp(macroCorrelation, 0, 1)
riskOffBonus = 0.2 if sectorRotation = RISK-OFF, else 0
```

### Layer 2 — Structure (2 engines)

**MarketStructureContextEngine**  
Detects swing highs (`H(t) > H(t-1) AND H(t) > H(t+1)`) and swing lows (`L(t) < L(t-1) AND L(t) < L(t+1)`). Falls back to highest-high / lowest-low anchors when no strict swings are detected (flat market). Classifies swings as internal (bottom 70% of range) or external (top 30%). Computes premium zone (upper 50%), discount zone (lower 50%), and structural bounds.

**LiquidityMapEngine**  
Builds the full liquidity topology from candles and swing points:
- Stop clusters: `strength = swingCount×0.4 + wickTouches×0.4 + volumeAtLevel×0.2`
- Liquidation shelves: `risk = OI / distanceToPrice`, normalized to [0, 1] relative to highest shelf
- FVGs: detected when `candle[i].high < candle[i+2].low` (bullish) or `candle[i].low > candle[i+2].high` (bearish)
- Resistant clusters: form when multiple zone types overlap within 0.5% price range

### Layer 3 — Geometry & Micro (3 engines)

**GeometryClassifier**  
Implements all 7 geometry formulas from Section 5 of the spec:
```
curvature         = |P(t-1) - 2P(t) + P(t+1)| / ATR
imbalance         = 0.5 × (wickUp - wickDown) / Zwicks + 0.5 × |ask - bid| / totalVolume
rotation          = (P(t) - P(t-1)) / ATR
structurePressure = 1 / (1 + curvature + |imbalance|)
rotationPressure  = |rotation|
collapseProb      = sigmoid(curvature + |imbalance| - structurePressure)
breakoutProb      = sigmoid(rotationPressure + imbalance)
```
Regime: STABLE if curvature < 0.5 and structurePressure > 0.6; EXPANDING if rotationPressure > 0.5 and collapseProb < 0.4; COLLAPSING if collapseProb > 0.6; else CHAOTIC.

**MicroStructureEngine**  
Detects: sweep (wick beyond stop cluster that closes back inside), divergence (price vs orderflow delta), CVD divergence (price vs cumulative delta), BOS (close beyond prior range extremes), retest zone (close inside any liquidity zone), HTF alignment (orderflow direction matches trend).  
Alignment score = count of active signals / 6.

**OrderflowEngine**  
```
delta             = ask - bid
cvd               = previousCvd + delta
absorption        = |delta| < totalVolume × 0.05
footprintImbalance = average (ask - bid) / (ask + bid) per footprint level
bidAskPressure    = (ask - bid) / (ask + bid)
```

### Layer 4 — Decision (4 engines)

**PredictionEngine**  
Core formula (Section 7.3 of spec):
```
StrictLine = w1×G + w2×L + w3×V + w4×M + w5×O + w6×X
```
Default weights: G=0.15, L=0.25, V=0.15, M=0.20, O=0.15, X=0.10. Weights are adjustable via the slider panel and must sum to 1.0.

Session adjustment factors: ASIA×0.8, LONDON×1.1, NEWYORK×1.2, POSTNY×0.9, WEEKEND×0.5.

Temporal smoothing: `smoothed = α × strictLine + (1-α) × previousSmoothed`  
α = 0.4 (HIGH_PERSISTENCE), 0.3 (MEDIUM), 0.2 (LOW).

Signal decay: `decayed = strictLine × e^(-signalAge/T)`, T = 20–40 minutes.

Confidence bands: `Band_k = strictLine ± (atrNorm × k)` where k = 0.5 (50%), 1.0 (80%), 1.5 (95%).

Liquidity bias: `liquidityBias = tanh(attractorStrength) / (distanceInATR + 0.1)` — normalized to prevent overflow from raw open interest values.

**ScoringEngine**  
The spec defined inputs/outputs but not the internal formula. The implementation uses a weighted sum of per-engine contribution scores:

```
geometryScore      = (isStable ? 20 : 0) + structurePressure×30 + (1 - collapseProb)×50
liquidityScore     = min(100, zoneCount × 10)
microstructureScore = alignmentScore × 100
orderflowScore     = ((bidAskPressure + 1) / 2) × 100
volatilityScore    = LOW→90, NORMAL→75, HIGH→40, EXTREME→10
macroScore         = NEUTRAL→50, LONG/SHORT→70
sessionScore       = NEWYORK→80, LONDON→75, ASIA→50, POSTNY→40, WEEKEND→20

probability = geometryScore×0.25 + liquidityScore×0.20 + microstructureScore×0.25
            + orderflowScore×0.15 + volatilityScore×0.05 + macroScore×0.05 + sessionScore×0.05
```

**RiskManager**  
Implements formulas 35–38 from Section 8 of the spec:
```
EDD            = ATR × volatilityFactor       (Vf ∈ [0.8, 1.6])
stopDistance   = ATR × stopMultiplier         (Sm ∈ [0.8, 1.2])
targetDistance = ATR × targetMultiplier       (Tm ∈ [1.0, 2.0])
EV             = P × targetDistance - (1-P) × stopDistance
```
Hard-reject conditions (any one triggers rejection):
1. GlobalStress ≠ SAFE
2. Probability < 80
3. VolatilityRegime = EXTREME
4. Geometry not stable
5. Microstructure incomplete (no BOS, sweep, or retest zone)
6. EDD > threshold (threshold = ATR × 2)

**StateMachine**  
Four states: IDLE → WAITING_FOR_RETEST → IN_TRADE → COOLDOWN → IDLE.  
IN_TRADE means all analytical conditions are aligned simultaneously — it is not an actual trade.  
Safety overrides (HALT stress, EXTREME volatility, data integrity failure, hard reject) immediately force state to IDLE regardless of current state.  
Cooldown duration: 10 minutes (configurable).

---

## API Reference

All endpoints under `/api/v1`. Authenticated endpoints require `Authorization: Bearer <token>`.

Every response includes the header `X-Contract-Version: 1.0.0`.

### HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `400` | Bad request — missing or invalid query parameters |
| `401` | Unauthorized — missing or invalid bearer token |
| `429` | Rate limit exceeded — max 60 requests/minute per IP. Response includes `Retry-After: 60` header |
| `500` | Internal server error — journal query failed or unexpected exception |
| `503` | Service unavailable — pipeline has not completed its first cycle yet |

### Endpoints

**GET /health** — No auth required  
Returns `{ "status": "ok", "timestamp": "..." }` when ready, `{ "status": "starting" }` with HTTP 503 while the first pipeline cycle is running.

**GET /api/v1/system/versions** — No auth required  
Returns contract version and all 15 engine versions.

**GET /api/v1/analysis/live?symbol=BTC-USDT&timeframe=1m** — Auth required  
Returns the full analysis bundle. Response shape:
```json
{
  "symbol": "BTC-USDT",
  "timeframe": "1m",
  "prediction": { "strictLine": 0.36, "smoothed": 0.36, "min": 0.47, "max": 0.75, "band50": [...], "band80": [...], "band95": [...], "liquidityBias": 0.003, "volatilityAdjustment": 2.8, "decayed": 0.36, "timestamp": "..." },
  "risk": { "edd": 6.04, "stopDistance": 6.04, "targetDistance": 9.06, "ev": 3.5, "probability": 63.2, "volatilityRegime": "NORMAL", "globalStress": "SAFE", "geometryStable": true, "microstructureComplete": true, "hardReject": true, "rejectReasons": ["Probability 63.29 is below threshold of 80"] },
  "state": { "state": "IDLE", "previousState": null, "reason": "...", "cooldownRemaining": 0, "alignmentScore": 0.5, "timestamp": "..." },
  "liquidity": { "zones": [...], "premiumZone": [...], "discountZone": [...], "structureBounds": [...] },
  "geometry": { "curvature": 0, "imbalance": 0.04, "rotation": 0, "structurePressure": 0.96, "rotationPressure": 0, "collapseProb": 0.28, "breakoutProb": 0.53, "geometryRegime": "STABLE_STRUCTURE", "microState": "neutral-stable", "isStable": true },
  "microstructure": { "sweep": false, "divergence": false, "cvdDivergence": false, "bosDetected": true, "retestZone": true, "htfAlignment": true, "alignmentScore": 0.5 },
  "timestamp": "...",
  "degraded": false,
  "failedEngines": []
}
```

**GET /api/v1/analysis/dashboard?symbols=BTC-USDT,ETH-USDT** — Auth required  
Returns a compact summary array for multiple symbols.

**GET /api/v1/diagnostics/performance** — Auth required  
Returns pipeline cycle latency: `{ "last100": [...], "p50": 45, "p95": 120, "p99": 180 }` (milliseconds).

**GET /api/v1/diagnostics/journal** — Auth required  
Query parameters: `engine`, `from` (ISO8601), `to` (ISO8601), `page`, `pageSize`.  
Returns paginated journal entries: engine logs, state transitions, risk rejections, microstructure events, and system diagnostics.

**POST /api/v1/replay/step** — Auth required  
Steps forward one candle in replay mode. Returns `{ "candleIndex": N, "result": {...} }`.

**POST /api/v1/replay/seek** — Auth required  
Body: `{ "candleIndex": N }`. Seeks to a specific candle in replay mode.

### Update Model

The frontend polls `/api/v1/analysis/live` every 1.5 seconds. The backend pipeline runs every 2 seconds. There is no WebSocket implementation — the spec noted polling as the primary model and WebSocket as optional. Polling at 1.5s provides near-real-time updates with minimal complexity.

If WebSocket support is needed in the future, the architecture supports it — the `latestResults` map in `src/index.ts` can be pushed to connected clients on each pipeline cycle.

### Rate Limiting

Token bucket algorithm: 60 requests per minute per IP address. Tokens refill at 1 per second. When exhausted, the server returns HTTP 429 with `Retry-After: 60`.

### Authentication

Bearer token authentication. Set `API_TOKEN` on the backend and `VITE_API_TOKEN` on the frontend to the same value. The token is an opaque string — generate a strong one with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The `/health` and `/api/v1/system/versions` endpoints are public and do not require authentication.

---

## Deploying to Production

The frontend and backend must be hosted separately. Netlify only serves static files — it cannot run Node.js.

### Frontend → Netlify

The `netlify.toml` at the project root is already configured with the correct build settings. Connect your GitHub repo to Netlify and it will detect everything automatically.

Set these environment variables in the Netlify dashboard (Site settings → Environment variables):
```
VITE_API_BASE_URL=https://your-backend.railway.app/api/v1
VITE_API_TOKEN=your-secret-token
VITE_DEFAULT_SYMBOL=BTC-USDT
VITE_DEFAULT_TIMEFRAME=1m
```

### Backend → Railway / Render / Fly.io

All three have free tiers. Railway is the simplest — connect your repo, set environment variables, and deploy.

Set these environment variables on your backend host:
```
API_TOKEN=your-secret-token
ALLOWED_ORIGINS=https://your-app.netlify.app
PORT=3000
NODE_ENV=production
```

Start command: `npm run build && node dist/src/index.js`

The backend needs Node.js 18+. No database is required — the journal uses in-memory storage by default.

### CORS

The `ALLOWED_ORIGINS` variable controls which frontend URLs can call the API. Set it to your Netlify URL. Multiple origins can be comma-separated:
```
ALLOWED_ORIGINS=https://your-app.netlify.app,https://yourdomain.com
```

### HTTPS

If your backend host provides automatic TLS (Railway and Render both do), leave `TLS_CERT_PATH` and `TLS_KEY_PATH` empty. The backend will run on plain HTTP and the host's reverse proxy handles HTTPS termination.

If you're self-hosting and need to provide your own certificate:
```
TLS_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### Persistent Logging

By default, journal logs are stored in memory and lost on restart. To persist them, edit `src/index.ts` and replace `InMemoryBackend` with `FileBackend`:

```typescript
import { FileBackend } from './journal/backends/FileBackend.js';
const journal = new Journal([new FileBackend('./logs/journal.ndjson')]);
```

---

## Testing

```bash
# Run all tests
npx vitest --run

# Update snapshots after engine changes
npx vitest --run -u
```

21 tests across 5 files:
- Snapshot tests for all 15 engines (deterministic output verification)
- Integration tests (full pipeline cycle, degraded mode handling)
- Regression/replay tests (deterministic replay, chronological ordering)
- Property-based test: no forbidden strings (Buy/Sell/Long/Short/Entry/Exit/PnL) in any pipeline output
- Property-based test: all timestamps are UTC ISO 8601 with millisecond precision

---

## Known Limitations

**SectorRotationEngine outputs RISK-OFF in single-symbol mode.** The engine needs relative strength data across BTC, ETH, SOL, and meme coins simultaneously. Running on BTC-USDT only means all inputs are neutral, so it always returns RISK-OFF. This doesn't break anything — it just means the sector rotation signal doesn't contribute meaningfully to the prediction. Adding multi-asset feeds would fix it.

**1-minute ATR produces small EDD values.** On 1-minute BTC candles, ATR is typically $4–$10, so EDD and conceptual ranges are small. This is mathematically correct. For larger, more meaningful ranges, change `TIMEFRAME=1m` to `TIMEFRAME=15m` or `TIMEFRAME=1h` in your backend environment.

**Journal uses in-memory storage.** Logs are lost on restart. See the persistent logging section above to switch to file-based storage.

**No WebSocket.** The frontend polls every 1.5 seconds. This is sufficient for 1-minute candle analysis. If sub-second updates are needed, WebSocket support can be added without changing the engine architecture.
