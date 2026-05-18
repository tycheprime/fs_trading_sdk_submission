# TychePrime x FunctionSPACE

A multi-market forecasting demo built on the [FunctionSpace Trading SDK](https://github.com/tycheprime/fs_trading_sdk). It browses open [functionSPACE](https://ecosystem.functionspace.dev/learn/) prediction markets, polls the web with [Exa](https://exa.ai), and uses Claude to maintain a **belief curve** (probability distribution over a numeric outcome) for each market.

Beliefs are curves over a range, not yes/no contracts. The agent compares its forecast to live market consensus and can revise when new articles appear.

## Features

- **Markets terminal** — grid of open markets with consensus hints and agent status
- **Per-market dashboard** — consensus chart, agent target curve, Exa sources, cycle log
- **Auto-cycle** — Exa search on an interval; Claude runs only when new URLs appear
- **Structured beliefs** — Claude chooses a distribution type (`gaussian`, `range`, `bimodal`, etc.); the SDK builds the curve
- **Shared sessions** — optional Postgres-backed API so visitors see prior forecasts without re-running Claude
- **Secure proxies** — API keys stay on the Node server, never in the browser bundle

## How it works

Each market runs an independent loop:

```text
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Exa search │ ──► │ Dedupe URLs  │ ──► │ Claude forecast │
│  (interval) │     │ (skip if none)│     │ (tool call)     │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                  │
                     ┌────────────────────────────▼────────────────────────────┐
                     │ SDK: belief vector → preview curve on chart           │
                     │ Persist: localStorage + optional Postgres (agent API) │
                     └───────────────────────────────────────────────────────┘
```

1. **Exa** — search query derived from the market title; results deduped by URL.
2. **Claude** — conversation per market (sources + messages); submits `submit_market_forecast` with distribution parameters.
3. **Belief build** — `estimateToBelief` maps the forecast into a bucket vector using `@functionspace/core`.
4. **Sync** — session written to `localStorage` and, when configured, `PUT /sessions/:marketId` on the agent API.

### Routes

| Path | Page |
|------|------|
| `/` | Open markets grid |
| `/market/:marketId` | Agent dashboard for one market |

### Architecture (local and production)

```text
Browser (Vite / static site)
  │
  ├─► VITE_FS_BASE_URL          functionSPACE API (markets, consensus)
  │
  └─► VITE_AGENT_CACHE_URL      Agent API (Node)
        ├─ /sessions/*          Postgres (or local JSON files)
        ├─ /exa/*               → api.exa.ai
        └─ /claude/*            → api.anthropic.com
```

Locally, Vite proxies `/agent-cache`, `/exa`, and `/claude` to the dev server on port **8787**. In production you run the same Node app as a separate Render web service and point the static site at it with `VITE_AGENT_CACHE_URL`.

## Prerequisites

- **Node.js** 20+ (see `.nvmrc`)
- **npm** (from the monorepo root: `npm install`)
- **Exa** and **Anthropic** API keys
- **functionSPACE** API access (`VITE_FS_BASE_URL` and credentials)
- **Postgres** (optional, for shared sessions)

## Quick start

From the **monorepo root**:

```bash
npm install
```

### 1. Configure environment

Create `app/.env.local` (gitignored) for secrets and client config:

```bash
EXA_API_KEY=your_exa_key
ANTHROPIC_API_KEY=your_anthropic_key
VITE_FS_BASE_URL=https://your-functionspace-api
VITE_FS_USERNAME=your_username
VITE_FS_PASSWORD=your_password
VITE_FS_AUTO_AUTH=true
```

Optional Postgres and agent API (also in `app/.env` or `app/.env.local`):

```bash
DB_URL=postgresql://user:pass@host:5432/dbname
VITE_AGENT_CACHE_URL=/agent-cache
VITE_AGENT_CACHE_TARGET=http://localhost:8787
```

See [`.env.example`](.env.example) for all variables.

### 2. Start the agent API

```bash
npm run server -w app
```

Listens on **http://localhost:8787**. Without `DB_URL`, sessions are stored under `server/.data/`.

### 3. Start the UI

```bash
cd app && npm run dev
```

Open **http://localhost:3000**.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (port 3000) |
| `npm run build` | Typecheck + production build → `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run server` | Agent API (`node server/index.mjs`) |

Run from `app/` or via `npm run <script> -w app` from the repo root.

## Environment variables

### Frontend (baked in at build time)

| Variable | Description |
|----------|-------------|
| `VITE_FS_BASE_URL` | functionSPACE engine API base URL |
| `VITE_FS_USERNAME` / `VITE_FS_PASSWORD` | API auth (when `VITE_FS_AUTO_AUTH=true`) |
| `VITE_AGENT_CACHE_URL` | Agent API URL (`/agent-cache` locally, full `https://...` in production) |
| `VITE_AGENT_CACHE_TARGET` | Dev only: proxy target for `/agent-cache` (default `http://localhost:8787`) |

### Agent API only (never on the static site)

| Variable | Description |
|----------|-------------|
| `EXA_API_KEY` | Exa search |
| `ANTHROPIC_API_KEY` | Claude |
| `DATABASE_URL` or `DB_URL` | Postgres connection string |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (e.g. `https://fs-trading-sdk.onrender.com`) |
| `PORT` | Listen port (Render sets this automatically) |

## Project structure

```text
app/
├── index.html
├── vite.config.ts          # Dev proxies for /exa, /claude, /agent-cache
├── server/
│   ├── index.mjs           # HTTP API + proxy routes
│   ├── proxy.mjs           # Exa / Anthropic forwarding
│   ├── store.mjs           # Postgres + file session storage
│   ├── db.mjs              # Pool + schema migration
│   └── log.mjs             # Structured JSON logs
└── src/
    ├── AgentApp.tsx        # React Router
    ├── pages/              # MarketsHome, MarketAgentPage
    └── agent/
        ├── useAgent.ts     # Cycle loop (Exa → Claude → belief)
        ├── exaClient.ts
        ├── claudeClient.ts
        ├── belief.ts
        ├── marketSession.ts / sessionSync.ts / remoteSession.ts
        └── components/     # Chart, panels, cycle log
```

Legacy demo layouts (`App_BasicTradingLayout.tsx`, etc.) are not used by the agent routes.

## Agent API

When `VITE_AGENT_CACHE_URL` is set, the UI syncs sessions and proxies LLM/search traffic through this service.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Liveness + storage mode |
| `/debug/status` | GET | Key flags configured (no secrets) |
| `/sessions` | GET | Market summaries for the grid |
| `/sessions/:id` | GET | Latest session payload |
| `/sessions/:id` | PUT | Save session; append forecast history |
| `/sessions/bulk` | POST | Import sessions from localStorage |
| `/sessions/:id/forecasts` | GET | Forecast revision history |
| `/stats` | GET | Global counts |
| `/exa/*` | * | Proxy to Exa (server injects API key) |
| `/claude/*` | * | Proxy to Anthropic (server injects API key) |

The proxy **strips** any `x-api-key` from the browser and injects the real key server-side (the Anthropic SDK sends a placeholder key in the client).

### Logs

The server logs one JSON object per line, for example:

```json
{"msg":"proxy_done","proxy":"claude","upstreamStatus":200,"ms":2840}
```

On Render, open the agent API service → **Logs** and filter by `proxy` or `claude`.

## Deployment (Render)

You need **two services** plus optional Postgres:

| Service | Type | Role |
|---------|------|------|
| Static site | e.g. `fs_trading_sdk` | `npm run build -w app` → `app/dist` |
| Agent API | e.g. `fs-trading-agent-api` | `node server/index.mjs`, `rootDir: app` |
| Postgres | Optional | `DATABASE_URL` on the agent API |

### Agent API (web service)

- **Root directory:** `app`
- **Build:** `npm install`
- **Start:** `node server/index.mjs`
- **Environment:** `DATABASE_URL`, `EXA_API_KEY`, `ANTHROPIC_API_KEY`, `ALLOWED_ORIGINS`

Verify:

```bash
curl https://YOUR-AGENT-API.onrender.com/health
curl https://YOUR-AGENT-API.onrender.com/debug/status
```

`/` returns `not_found` — that is normal; use `/health`.

### Static site

- **Build:** `npm install && npm run build -w app`
- **Publish:** `app/dist`
- **Environment:** `VITE_AGENT_CACHE_URL=https://YOUR-AGENT-API.onrender.com` (must redeploy after changing)

### Static site rewrites (required for SPA + optional same-origin proxies)

In **Redirects/Rewrites**, order matters:

1. `/exa/*` → `https://YOUR-AGENT-API.onrender.com/exa/*` (rewrite) — optional if `VITE_AGENT_CACHE_URL` is set
2. `/claude/*` → `https://YOUR-AGENT-API.onrender.com/claude/*` (rewrite) — optional
3. `/*` → `/index.html` (rewrite) — **required** so `/market/48` works on refresh

A blueprint example lives in [`../render.yaml`](../render.yaml).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| `Unexpected end of JSON input` on Exa | UI hitting static host `/exa/search` | Set `VITE_AGENT_CACHE_URL` and redeploy static site |
| `Connection error` on Claude (Exa works) | CORS: blocked SDK headers or duplicate `Access-Control-Allow-Origin` (`*` + your site) | Redeploy agent API (latest `proxy.mjs` strips upstream CORS) |
| `invalid x-api-key` on Claude | Browser placeholder key reached Anthropic | Deploy agent API that strips client `x-api-key` |
| `/market/:id` shows "Not Found" on refresh | Missing SPA rewrite | Add `/*` → `/index.html` on static site |
| Agent API `/` is `not_found` | No root route | Use `/health` instead |
| Shared forecasts missing | No Postgres or wrong `VITE_AGENT_CACHE_URL` | Check `/debug/status`, `DATABASE_URL`, CORS `ALLOWED_ORIGINS` |

## Supported belief shapes

Claude selects one of: `gaussian`, `spike`, `range`, `bimodal`, `leftskew`, `rightskew`, `dip`, `uniform`. Parameters are validated and converted to a belief vector via `@functionspace/core`.

## Related

- Monorepo SDK docs: [`../internal_sdk_docs/`](../internal_sdk_docs/) (package development)
- Integration guide for SDK consumers: [`../llms.txt`](../llms.txt)
- Legacy agent notes: [`README_AGENT.md`](README_AGENT.md)
