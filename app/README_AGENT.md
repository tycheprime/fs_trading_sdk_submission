# Tycheprime Agent

A multi-market forecaster on the [functionSPACE](https://ecosystem.functionspace.dev/learn/) protocol: beliefs are **probability curves** over a numeric range, not yes/no contracts.

## Routes

| Path | Purpose |
|------|---------|
| `/` | All **open** markets (terminal grid) |
| `/market/:marketId` | Agent for one market (chart, exa poll, Claude, cycle log) |

## Per-market agent

1. **exa search** every 20s (configurable) while auto-cycle is on.
2. **Dedupe** by URL — if nothing new, skip Claude and keep the current curve.
3. **Claude** maintains a **conversation per market** in `localStorage`, optionally synced to a shared cache.
4. **Structured belief** — Claude picks a `distribution_type` and parameters; the SDK builds the curve via `generateGaussian`, `generateRange`, `generateBelief`, etc.

Supported shapes: `gaussian`, `spike`, `range`, `bimodal`, `leftskew`, `rightskew`, `dip`, `uniform`.

## Shared cache (Postgres)

A small Node API (`app/server/index.mjs`) stores each market's session in **Render Postgres** (`agent_sessions`) and an append-only **forecast history** (`agent_forecasts`).

- **Local:** add `DB_URL` (or `DB_*` fields) to `app/.env`, then `npm run server -w app` on port 8787
- **Frontend:** `VITE_AGENT_CACHE_URL=/agent-cache` (Vite proxies to `VITE_AGENT_CACHE_TARGET=http://localhost:8787`)
- **On first home visit:** any forecasts in `localStorage` are bulk-uploaded to Postgres once per browser
- **On market open:** latest session + revision history load from DB before the first Exa poll (skips cold Claude when cache is fresh)

### API

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Postgres vs file storage |
| `GET /sessions` | Summaries for the markets grid |
| `GET /sessions/:id` | Latest session (sources, messages, forecast) |
| `PUT /sessions/:id` | Save session; records forecast revisions |
| `POST /sessions/bulk` | Import many sessions (localStorage backfill) |
| `GET /sessions/:id/forecasts` | Revision history for the cycle log |
| `GET /stats` | Global counts (markets cached, total revisions) |

## Setup

```bash
# app/.env.local — API keys
EXA_API_KEY=...
ANTHROPIC_API_KEY=...
VITE_FS_BASE_URL=...

# app/.env — Postgres (from Render dashboard)
DB_URL=postgresql://...
VITE_AGENT_CACHE_URL=/agent-cache
VITE_AGENT_CACHE_TARGET=http://localhost:8787
```

```bash
# Terminal 1 — cache API (needs DB_URL)
npm run server -w app

# Terminal 2 — UI
cd app && npm run dev
```

Open http://localhost:3000

## Deploy notes (Render)

1. Apply the blueprint or create **Web Service** `tycheprime-agent-cache` with `node server/index.mjs` from `app/`, plus free Postgres and `DATABASE_URL`.
2. On the static site `tycheprime-agent`, set `VITE_AGENT_CACHE_URL` to the cache service URL (e.g. `https://tycheprime-agent-cache.onrender.com`) and redeploy so the bundle includes it.
3. Set `ALLOWED_ORIGINS` on the cache service to include your static site URL.

Exa and Claude are proxied by the **cache web service** (`/exa/*`, `/claude/*`) with keys in `EXA_API_KEY` and `ANTHROPIC_API_KEY` (never in the static bundle). Local dev uses Vite proxies in `vite.config.ts`.

On Render:

1. Deploy **tycheprime-agent-cache** (Node) and set `EXA_API_KEY`, `ANTHROPIC_API_KEY`, and Postgres `DATABASE_URL`.
2. On the static site, set `VITE_AGENT_CACHE_URL` to the cache service URL and redeploy (baked into the JS bundle).
3. Optional: add static **rewrite** rules so `/exa/*` and `/claude/*` hit the cache service when `VITE_AGENT_CACHE_URL` is unset (see `render.yaml`).
