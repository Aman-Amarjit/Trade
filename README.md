# 💎 Trade — Multi-Layer Analytical Architecture

[![Build Status](https://img.shields.io/github/actions/workflow/status/Aman-Amarjit/Trade/ci.yml?style=for-the-badge)](https://github.com/Aman-Amarjit/Trade/actions)
[![Security Scan](https://img.shields.io/badge/Security-Hardened-success?style=for-the-badge)](SECURITY.md)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-blue?style=for-the-badge&logo=node.js)](package.json)

**Trade** is a high-performance, real-time analytics platform designed for deep market structure interpretation, breakout cycle detection, and institutional-grade risk management.

![Dashboard Mockup](./assets/dashboard_mockup.png)

---

## 🚀 Key Features

### 🧠 Core Engine Cluster
- **Regime Intelligence**: Volatility regime detection and regime persistence tracking.
- **Liquidity Mapping**: Dynamic tracking of Fair Value Gaps (FVG), stop clusters, and liquidity shelves.
- **Geometry Classifier**: Real-time identification of market geometries and breakout cycles.
- **Risk Sentinel**: Hard rejection logic, daily drawdown caps, and EDD calculation.

### ⚡ Real-Time Pipeline
- **Low-Latency Ingestion**: Multi-symbol support with staggered polling to avoid rate limits.
- **Deterministic Replay**: Full CSV-based replay engine for backtesting and logic verification.
- **Journaling System**: Persistent auditing of state transitions and risk rejections.

---

## 🏗️ Architecture

```mermaid
graph TD
    A[Public APIs / Data Adapters] --> B[Data Layer]
    B --> C[Pipeline Orchestrator]
    
    subgraph "Analytical Engines"
        C --> D[Context Engines]
        C --> E[Structure Engines]
        C --> F[Geometry Engines]
    end
    
    D & E & F --> G[Scoring & Risk Manager]
    G --> H[Final Decision / HUD Result]
    
    H --> I[Journaling / Audit Log]
    H --> J[Express API Server]
    J --> K[React Dashboard]
```

---

## 🛡️ Security Architecture

Built with a "Security First" mindset to protect both data and proprietary logic:

- **Proprietary Core**: 100% of trading logic remains isolated on the backend.
- **Hardened API**: Protected by `helmet`, strict `CORS`, rate limiting, and Bearer authentication.
- **Sanitized Inputs**: Deep validation and sanitization of all incoming requests and market data.
- **Vulnerability Management**: Continuous dependency auditing and path-based security checks.

See [SECURITY.md](SECURITY.md) for full details.

---

## 🛠️ Getting Started

### Prerequisites

- Node.js >= 18.0.0
- NPM or PNPM

### Installation

```bash
# Install root dependencies (Backend)
npm install

# Install Frontend dependencies
cd frontend
npm install
```

### Development

| Side | Command | Description |
| :--- | :--- | :--- |
| **Backend** | `npm run dev` | Starts API with hot-reload |
| **Frontend** | `npm run dev` | Starts Vite dashboard |
| **Tests** | `npm test` | Runs Vitest suite |

---

## ⚙️ Configuration

Copy `.env.example` to `.env` and configure your environment:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `API_TOKEN` | Strong bearer token for API security | `dev-token` |
| `ALLOWED_ORIGINS` | Permitted frontend domains (CORS) | `http://localhost:5173` |
| `SYMBOLS` | Comma-separated assets to track | `BTC-USDT,ETH-USDT` |
| `PORT` | Backend server port | `3000` |

---

## 📄 License

Proprietary Software. All Rights Reserved. See [LICENSE](LICENSE) for details.
