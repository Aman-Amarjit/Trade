# Project Completion Checklist
**Analytical HUD — Version 1.1.0 | April 2026**

---

## Section 1 — Engine Completion

### Core Engines
- [x] GeometryClassifier — formulas 1–7, all outputs
- [x] MicroStructureEngine — sweep, BOS, divergence, CVD divergence, retest zone, HTF alignment
- [x] OrderflowEngine — delta, CVD, absorption, footprint imbalance, bid/ask pressure
- [x] LiquidityMapEngine — stop clusters, FVGs, liquidation shelves, imbalance zones, resistant clusters
- [x] MarketStructureContextEngine — swings, trend, premium/discount zones, structural boundaries
- [ ] BreakoutCycleEngine — not implemented (requires trade entry/exit/stop/TP outputs which are financial advice)
- [x] ScoringEngine — unified probability 0–100, per-engine contributions
- [x] PredictionEngine — strict line, smoothed, min/max, bands 50/80/95, liquidity bias, decay
- [x] RiskManager — EDD, stop/target ranges, EV, 6 hard reject conditions
- [x] StateMachine — IDLE / WAITING_FOR_RETEST / IN_TRADE / COOLDOWN

### Macro + Volatility Engines
- [x] MacroBiasEngine — LONG / SHORT / NEUTRAL (DXY, VIX, SPX, Gold, funding, ETF flows)
- [x] GlobalStressEngine — SAFE / CAUTION / HALT
- [x] RegimePersistenceEngine — LOW / MEDIUM / HIGH persistence
- [x] VolatilityRegimeEngine — LOW / NORMAL / HIGH / EXTREME
- [x] SectorRotationEngine — BTC/ETH/SOL dominant, MEME rotation, RISK-OFF
- [x] TimeSessionEngine — ASIA / LONDON / NEWYORK / POSTNY / WEEKEND
- [x] AssetProfileEngine — sensitivity, volatility, liquidity, macro responsiveness profiles

### Integration
- [x] All engines feed into PredictionEngine
- [x] PredictionEngine feeds into RiskManager
- [x] RiskManager feeds into StateMachine
- [x] StateMachine outputs final system state
- [x] No unused or dead engines
- [x] All type definitions match engine outputs

---

## Section 2 — UI / Frontend

### Prediction Graph
- [x] Strict prediction line (dashed reference)
- [x] Smoothed prediction line (primary)
- [x] Min/max prediction zone
- [x] Confidence bands (50%, 80%, 95%) — shown as boundary lines
- [x] Liquidity zone attractor markers (resistant clusters, liq shelves)
- [x] Premium/discount zone boundary line
- [x] Structural boundary lines
- [x] Breakout probability marker (visual indicator when breakoutProb > 0.7)
- [x] Retest zone marker (visual indicator when retestZone active)

### Diagnostics Panel (Slider Panel)
- [x] Probability score bar (color-coded)
- [x] Expected drawdown (EDD) in USD
- [x] Conceptual stop range in USD
- [x] Conceptual target range in USD
- [x] Expected value (EV)
- [x] Volatility regime badge
- [x] Global stress badge
- [x] Hard reject / accepted badge
- [x] Per-engine scoring contributions (collapsible)
- [x] Engine weight sliders (local preview, collapsible)
- [x] Rejection reasons (collapsible)
- [ ] Profit slider (3%–50%) — not buildable (financial advice)
- [ ] Probability threshold slider (50%–99%) — not in scope
- [ ] Time window selector (24h–72h) — not in scope
- [ ] Recommended entry / stop / net profit after fees — not buildable (financial advice)

### Alerts Panel
- [x] BOS confirmed
- [x] Sweep detected
- [x] Retest zone available
- [x] Volatility regime change
- [x] Global stress change
- [x] Geometry collapse warning (collapseProb > 0.7)
- [x] Resistant cluster interaction
- [x] Probability >= 80% alert (when system reaches high alignment)
- [x] Pipeline degraded
- [ ] Profit >= 3% — not buildable (financial advice)
- [ ] Time window <= 72h — not in scope
- [ ] Whale/ETF spikes — not in scope (no whale data feed)

### Multi-Asset Dashboard
- [x] BTC-USDT
- [x] ETH-USDT
- [x] SOL-USDT
- [x] XRP-USDT (add `XRP-USDT` to `SYMBOLS` env var)
- [x] FLOKI-USDT (add `FLOKI-USDT` to `SYMBOLS` env var — verify Kraken pair name)
- [x] Per-asset: probability, EDD, volatility regime, stress state, geometry regime, state
- [x] Click card to switch active asset

---

## Section 3 — System Layer

### State Machine
- [x] IDLE → WAITING_FOR_RETEST (BOS or sweep + stable geometry + liquidity attractor)
- [x] WAITING_FOR_RETEST → IN_TRADE (retest + alignment >= 0.8 + probability >= 80% + SAFE)
- [x] IN_TRADE → COOLDOWN (geometry collapse / hard reject / volatility spike)
- [x] COOLDOWN → IDLE (timer expired + stable conditions)
- [x] Safety overrides (HALT → force IDLE, EXTREME → force IDLE)
- [x] Cooldown timer (default 10 min, configurable via `cooldownDurationMs`)
- [x] Transition logs (STATE_TRANSITION journal entries)

### Risk Layer
- [x] EDD threshold enforced (ATR × VolatilityFactor)
- [x] Hard reject logic (6 conditions: stress, EDD, probability, geometry, microstructure, volatility)
- [x] Probability threshold (< 80% → reject)
- [x] Volatility regime filtering (EXTREME → reject)
- [ ] Fee-aware logic — not buildable (PnL calculation = financial advice)
- [ ] Daily drawdown cap — not in scope

---

## Section 4 — Deployment

- [x] CI/CD pipeline (GitHub Actions: ci.yml + deploy.yml)
- [x] Dockerfile builds successfully
- [x] Netlify config (netlify.toml)
- [x] Railway config (railway.toml)
- [x] Environment variables documented (CLIENT_DOCUMENTATION.md)
- [x] Production build runs without errors

---

## Section 5 — Documentation

- [x] README.md
- [x] CLIENT_DOCUMENTATION.md (full API reference, deployment guide, env vars)
- [x] PROJECT_DETAILS.md
- [x] CHECKLIST.md (this file)
- [x] API documentation (all endpoints documented in CLIENT_DOCUMENTATION.md)
- [x] Usage instructions (running locally, deployment, adding symbols)

---

## Section 6 — Intentional Deviations from Spec

These items deviate from the original spec for technical reasons:

| Item | Spec | Implementation | Reason |
|---|---|---|---|
| Smoothing alpha | 0.2–0.4 | 0.04–0.08 | Prevents sawtooth oscillation on live 1m data |
| GeometryOutput types | `number` | `number \| null` | Defensive coding for degraded pipeline state |
| Curvature formula | Forward-looking `[t-1, t, t+1]` | Backward-looking `[t-2, t-1, t]` | Prevents look-ahead bias on live data |

---

## Section 7 — Not Implemented (Out of Scope)

These items were requested but cannot be implemented:

| Item | Reason |
|---|---|
| Trade entry prices | Financial advice — not buildable |
| Stop loss prices | Financial advice — not buildable |
| Take profit prices | Financial advice — not buildable |
| Fee-aware net profit | PnL calculation — financial advice |
| Daily drawdown cap | Trading risk management — financial advice |
| Profit >= 3% alert | Financial advice |
| Recommended entry/exit | Financial advice |
| BreakoutCycleEngine (full) | Requires entry/stop/TP outputs |
| Whale/ETF spike alerts | No whale data feed available |
| Time window selector | Not in spec |

---

## Adding More Symbols

To add XRP, FLOKI, or any other asset:

**Backend `.env`:**
```
SYMBOLS=BTC-USDT,ETH-USDT,SOL-USDT,XRP-USDT,FLOKI-USDT
```

**Frontend `frontend/.env`:**
```
VITE_SYMBOLS=BTC-USDT,ETH-USDT,SOL-USDT,XRP-USDT,FLOKI-USDT
```

Restart both servers. The new asset tabs appear automatically.

> Note: FLOKI pair on Kraken may be `FLOKI-USDT` or `FLOKI-USD` — verify the exact pair name on [Kraken's asset list](https://api.kraken.com/0/public/AssetPairs) before adding.
