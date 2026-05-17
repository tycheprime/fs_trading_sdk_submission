# BTC Oracle Agent

An autonomous forecaster built on the FunctionSpace Trading SDK for market **#242 — "Bitcoin Spot Price (USD, December 31 2026)"**.

## The agent cycle

1. **Search** — exa.ai every 20 seconds (configurable) while auto-cycle is on.
2. **Dedupe** — new article URLs are merged into a per-market source list. If every URL was already seen, the cycle **skips Claude** and the chart forecast stays unchanged.
3. **Interpret** — on the first batch, Claude opens a new conversation. On later batches with new URLs only, Claude continues that conversation and may hold or revise its point estimate and 90% interval (`changed_mind`).
4. **Build belief** — `generateGaussian` from `@functionspace/core` turns the interval into a belief overlay on the chart.

Conversation state lives in `localStorage` (`fs-agent-session-{marketId}`).

## Setup

1. Engine URL in `app/.env` (see repo `app/.env.example`).
2. Keys in `app/.env.local`:

   ```
   EXA_API_KEY=your_exa_key
   ANTHROPIC_API_KEY=your_anthropic_key
   ```

3. `npm run dev` from `app/` → <http://localhost:3000>

Auto-cycle defaults to **on** at **20 seconds**. Toggle it or change the interval in Agent Control.

## SDK boundaries

- Belief math via `@functionspace/core`.
- Market data and preview via `@functionspace/react`.
- The agent owns exa polling, conversation memory, and when to call Claude.
