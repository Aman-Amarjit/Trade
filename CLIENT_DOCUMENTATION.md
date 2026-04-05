# Analytical HUD — Client Documentation

**Version:** 1.0.0  
**Data Source:** Kraken Exchange (live)  
**Asset:** BTC-USDT (1-minute timeframe)

---

## What This System Is

The Analytical HUD is a real-time market condition interpretation tool. It ingests live market data from Kraken and runs it through a 15-engine analytical pipeline to produce structured outputs: volatility regime, liquidity zones, geometry classification, microstructure signals, and a probability-weighted prediction score.

**This is a pure analytical tool. It does not execute orders, manage positions, or provide trading advice.**

---

## How to Run It

### Requirements
- Node.js 18 or higher
- Two terminal windows

### Terminal 1 — Backend API
```bash
npm run build
node dist/src/index.js
```
The backend starts at `http://localhost:3000` and begins pulling live data from Kraken immediately.

### Terminal 2 — Frontend HUD
```bash
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Deploying to 