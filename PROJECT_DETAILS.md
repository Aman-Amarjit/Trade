# Multi-Layer Analytical Architecture for Market Condition Interpretation

## Project Overview

This project, internally referred to as **"Trade"**, is a high-performance, real-time analytical suite designed to interpret complex market conditions through a multi-layered computational pipeline. It transforms raw exchange data (OHLCV, Orderflow, Macro indicators) into actionable insights, including volatility regimes, market structure classification, liquidity maps, and predictive scoring.

The system is architected to provide a "Heads-Up Display" (HUD) for market analysts, offering a synchronized view of deep quantitative metrics across different time-horizons and analytical dimensions.

---

## 🏗 System Architecture

The project follows a decoupled, three-tier architecture ensuring scalability, type safety, and clear separation of concerns:

### 1. Analytical HUD (Frontend)
- **Tech Stack**: React 18, TypeScript, Vite.
- **Purpose**: Real-time visualization of the analytical pipeline results.
- **Key Features**: Dynamic charts, regime indicators, liquidity zone maps, and real-time performance diagnostics.

### 2. Analytical API (Backend)
- **Tech Stack**: Node.js, Express 5, TypeScript.
- **Purpose**: Orchestrates data ingestion, executes the analytical pipeline, and serves results via a secured REST interface.
- **Pipeline Loop**: Runs a deterministic cycle (default 2000ms) to process new market data.

### 3. Shared Library
- **Purpose**: A centralized repository for Type definitions and Contracts.
- **Benefit**: Ensures 100% type-compatibility between the Backend's analytical output and the Frontend's consumption layers.

---

## 🔄 The Analytical Pipeline

The "brain" of the project is the **Pipeline Orchestrator**, which executes 15+ specialized engines in a strictly sequenced order. This ensures that downstream engines (like Decision) have access to the refined outputs of upstream engines (like Context).

### Sequential Execution Steps:

| Step | Layer | Description |
| :--- | :--- | :--- |
| **1** | **Context** | Determines the "Global Environment" (Stress, Macro Bias, Volatility Regime, Session Type). |
| **2** | **Structure** | Identifies the "Battlefield" (Market Structure Swings, Liquidity Zones, Premium/Discount zones). |
| **3** | **Geometry** | Analyzes "Price Action" (Curvature, Imbalance, Micro-structure alignment, Orderflow pressure). |
| **4** | **Decision** | Synthesizes insights into "Actionable Data" (Predictive scoring, Risk management, State machine). |

---

## 🧠 Analytical Engines Catalog

The system leverages a diverse set of engines, each responsible for a specific domain of market analysis:

### Context Layer
- **GlobalStressEngine**: Monitors VIX, DXY, and liquidity clusters to assess systemic risk.
- **MacroBiasEngine**: Evaluates macro-economic indicators to determine long-term directional bias.
- **VolatilityRegimeEngine**: Classifies market volatility into High/Normal/Low/Extreme categories.
- **RegimePersistenceEngine**: Predicts how long the current market state is likely to last.
- **TimeSessionEngine**: Adjusts logic based on active trading sessions (ASIA, LONDON, NEWYORK).

### Structure & Geometry Layer
- **MarketStructureContextEngine**: Detects internal/external swings and trend shifts.
- **LiquidityMapEngine**: Generates a heat map of pending orders and stop clusters.
- **GeometryClassifier**: Uses mathematical curvature and wicks to identify price action patterns.
- **MicroStructureEngine**: Detects HTF (High Time Frame) alignment and Break of Structure (BOS).
- **OrderflowEngine**: Analyzes CVD (Cumulative Volume Delta) and bid/ask absorption.

### Decision & Risk Layer
- **PredictionEngine**: Uses weighted coefficients (G, L, V, M, O, X) to forecast future price movement.
- **ScoringEngine**: Provides a probability-based score for potential trade setups.
- **RiskManager**: Calculates EDD (Expected DrawDown), EV (Expected Value), and optimal stop/target distances.
- **StateMachine**: Manage the lifecycle of an "IDLE" vs "ACTIVE" vs "COOLDOWN" state.

---

## 📡 API Reference

The backend exposes a professional-grade REST API under `/api/v1/`.

### Core Endpoints
- `GET /health`: System health check (public).
- `GET /api/v1/system/versions`: Returns engine versions and contract version (public).
- `GET /api/v1/analysis/live`: Detailed analysis for a specific symbol (requires Auth).
- `GET /api/v1/analysis/dashboard`: High-level summary of multiple symbols (requires Auth).
- `GET /api/v1/diagnostics/performance`: Latency stats (P50, P95, P99) for the pipeline cycles.
- `GET /api/v1/diagnostics/journal`: Queryable logs from the diagnostic journaling system.

### Security & Reliability
- **Authentication**: Bearer Token required for all sensitive endpoints.
- **Rate Limiting**: Implemented via a Token Bucket algorithm (default 60 req/min).
- **Data Integrity**: Uses `fast-check` for property-based testing and `vitest` for unit/integration tests.

---

## 🛠 Developer Guide

### Prerequisites
- Node.js >= 18.0.0
- TypeScript >= 5.0

### Installation
```bash
npm install
cd frontend && npm install
```

### Running the System
```bash
# Start Backend (Watch mode)
npm run dev

# Start Frontend
cd frontend && npm run dev
```

### Testing
```bash
# Run all tests
npm test

# Run type-check
npm run lint
```

---

## 👨‍💻 Developer's Perspective: Design Rationale

As a developer, this project was built with the following core principles in mind:

1.  **Determinism**: The pipeline must produce the same output for a given input bundle, facilitating easier debugging and backtesting.
2.  **Degradation Handling**: If a non-critical engine fails, the pipeline enters a "Degraded" state, providing default values to avoid crashing the entire system.
3.  **Observability**: Real-time performance tracking and a structured journaling system allow for deep "black-box" analysis when anomalies occur.
4.  **Extensibility**: The engine-based architecture allows for adding new analytical dimensions without modifying the core orchestrator logic.

---

> [!NOTE]
> This documentation is auto-generated and reflects the current state of the "Multi-layer analytical architecture" implementation. Do not modify the core logic without updating the corresponding engine version in `src/index.ts`.
