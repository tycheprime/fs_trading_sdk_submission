# BTC Oracle Agent

An autonomous market-maker agent built on the FunctionSpace Trading SDK.

Each cycle the agent searches **exa.ai** for fresh Bitcoin news, has **Claude**
interpret the results into a calibrated price forecast, turns that forecast into
a belief distribution, and re-positions itself on FunctionSpace market **#242 —
"Bitcoin Spot Price (USD, December 31 2026)"**.

## The agent cycle

1. **Search** — pull recent BTC price news from exa.ai.
2. **Interpret** — Claude (`claude-opus-4-7`, adaptive thinking) reads the
   sources and returns a point estimate, a 90% confidence interval, a
   confidence level, and a rationale.
3. **Build belief** — the estimate becomes a Gaussian belief via
   `generateGaussian` from `@functionspace/core`. The agent only chooses the
   center and spread; the SDK builds and normalizes the vector.
4. **Preview** — the target belief is shown on the chart and a payout preview
   is fetched.
5. **Re-position** — when *armed*, the agent sells its prior position and opens
   a new one via the `useBuy` / `useSell` hooks.

It runs on a configurable timer (auto-cycle) and also has a manual "Run cycle"
button.

## Setup

1. The engine endpoint is already set in `demo-app/.env`:

   ```
   VITE_FS_BASE_URL=https://fs-engine-api-dev.onrender.com
   ```

2. Add your API keys to `demo-app/.env.local` (gitignored, never bundled):

   ```
   EXA_API_KEY=your_exa_key
   ANTHROPIC_API_KEY=your_anthropic_key
   ```

   Without them the app still runs; running a cycle shows a clear "add your
   keys" message.

3. Start the dev server (from the repo root or `demo-app/`):

   ```
   npm run dev
   ```

   Open <http://localhost:3000>.

## How the keys stay secret

`exa.ai` and the Claude API are reached through Vite dev-server proxies
(`/exa`, `/claude`) configured in `vite.config.ts`. The proxies inject the API
keys server-side, so the keys never enter the browser bundle.

Because the proxies are part of the Vite dev server, this app runs under
`npm run dev`. A public static deployment would need serverless functions to
replace the two proxies.

## Using it

1. Click **Sign In** in the header and complete the passwordless login.
2. Set a position size and, optionally, a cycle interval.
3. Click **Run cycle now** to run one cycle, or toggle **Auto-cycle**.
4. Toggle **Auto-trade** to let the agent place trades every cycle, or click
   **Commit belief** to place one manually. Trades appear in **Agent Positions**.

## SDK boundaries

- All belief, payout, and statistics math goes through `@functionspace/core`.
- All data, trades, and previews go through `@functionspace/react` hooks.
- Authentication uses `PasswordlessAuthWidget` from `@functionspace/ui`.
- The agent owns only the *decision* (where to center the distribution, how
  wide, when to trade) and the visualization.
