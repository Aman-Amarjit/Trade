# Trade — Multi-Layer Analytical Architecture

A high-performance, real-time analytics platform for market structure, breakout, and risk analysis.

## Overview

This project includes:
- **Backend**: Node.js + Express + TypeScript API serving market analytics.
- **Frontend**: React + Vite dashboard with live analytics, breakout signals, and alerts.
- **Shared types**: Common TypeScript contracts between backend and frontend.

## Getting Started

### Install dependencies

```bash
npm install
cd frontend
npm install
```

### Run locally

Backend:
```bash
npm run build
npm start
```

Frontend:
```bash
cd frontend
npm run dev
```

### Build for production

Backend:
```bash
npm run build
```

Frontend:
```bash
cd frontend
npm run build
```

## Environment

Copy `.env.example` to `.env` and configure:
- `API_TOKEN` — strong bearer token for API security
- `ALLOWED_ORIGINS` — allowed frontend domains for CORS
- `PORT` — backend server port
- `SYMBOLS` — comma-separated assets

Frontend also supports environment configuration with `frontend/.env`.

## Testing

```bash
npm test
```

## Production Readiness Notes

- UI now includes an `ErrorBoundary` to catch render failures.
- Frontend hooks are updated with proper dependencies.
- The dashboard polling effect avoids synchronous state updates.
- Security headers and CORS are already configured in backend middleware.

## Directory Structure

- `src/` — backend implementation
- `frontend/src/` — React dashboard
- `shared/types/` — shared contracts
- `logs/` — runtime logs

## Deployment

The repository includes a production-ready `Dockerfile`:
- build stage compiles the app
- runtime stage installs production dependencies
- health check included on port `3000`

## Continuous Integration / Deployment

The project includes GitHub Actions workflows:
- `.github/workflows/ci.yml` — backend/frontend build, lint, test, and audit
- `.github/workflows/deploy.yml` — deploy backend to Railway and frontend to Netlify

Secrets required for deployment are:
- `RAILWAY_TOKEN`
- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID`
- `VITE_API_BASE_URL`
- `VITE_API_TOKEN`
- `VITE_SYMBOLS`

## Production Readiness Checklist

See `CHECKLIST.md` for a live status of readiness items, including build/test validation, health endpoint coverage, and operational next steps.
