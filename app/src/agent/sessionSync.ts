import {
  createEmptySession,
  loadMarketSession,
  saveMarketSession,
  type MarketAgentSession,
} from './marketSession';
import {
  fetchForecastHistory,
  fetchRemoteSession,
  isRemoteSessionEnabled,
  pushRemoteSession,
  type StoredForecast,
} from './remoteSession';
import type { CycleRecord } from './types';

function sessionScore(session: MarketAgentSession | null): number {
  if (!session) return 0;
  return (
    (session.lastEstimate ? 2 : 0) + Math.min(session.sources.length, 10_000)
  );
}

/** Pull shared Postgres cache into localStorage when remote is newer or local is empty. */
export async function hydrateMarketSession(
  marketId: string | number,
): Promise<MarketAgentSession | null> {
  if (!isRemoteSessionEnabled()) {
    return loadMarketSession(marketId);
  }

  const local = loadMarketSession(marketId);
  const { session: remote } = await fetchRemoteSession(marketId);

  if (!remote) {
    return local;
  }

  if (!local || sessionScore(remote) > sessionScore(local)) {
    saveMarketSession(remote);
    return remote;
  }

  return local;
}

/** Save locally and push to shared cache (fire-and-forget). */
export function persistMarketSession(
  session: MarketAgentSession,
  meta?: { newSourceCount?: number; skipped?: boolean },
): void {
  saveMarketSession(session);
  void pushRemoteSession(session, meta);
}

export function getOrCreateSession(marketId: string | number): MarketAgentSession {
  return loadMarketSession(marketId) ?? createEmptySession(marketId);
}

export function storedForecastsToCycles(
  forecasts: StoredForecast[],
  sourceCountFallback = 0,
): CycleRecord[] {
  return forecasts.map((f, idx) => ({
    id: f.id || idx + 1,
    startedAt: f.createdAt,
    finishedAt: f.createdAt,
    sources: [],
    newSourceCount: f.newSourceCount,
    skipped: f.skipped,
    estimate: f.estimate,
    beliefBuild: null,
    error: null,
  }));
}

/** Load prior forecast revisions from Postgres for the cycle log. */
export async function loadRemoteCycleHistory(
  marketId: string | number,
  sourceCount = 0,
): Promise<CycleRecord[]> {
  if (!isRemoteSessionEnabled()) return [];
  const forecasts = await fetchForecastHistory(marketId, 30);
  return storedForecastsToCycles(forecasts, sourceCount);
}
