import type { MarketAgentSession } from './marketSession';
import type { AgentEstimate } from './types';
import { agentAuthHeaders } from './agentAuth';

function cacheBase(): string {
  const raw = import.meta.env.VITE_AGENT_CACHE_URL?.replace(/\/$/, '') ?? '';
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;
  if (!/^https?:\/\//i.test(raw)) return `https://${raw}`;
  return raw;
}

export function isRemoteSessionEnabled(): boolean {
  return cacheBase().length > 0;
}

function cacheUrl(path: string): string {
  const base = cacheBase();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function fetchRemoteSession(
  marketId: string | number,
): Promise<{ session: MarketAgentSession | null; updatedAt: number | null }> {
  if (!isRemoteSessionEnabled()) return { session: null, updatedAt: null };
  try {
    const res = await fetch(cacheUrl(`/sessions/${encodeURIComponent(String(marketId))}`), {
      headers: agentAuthHeaders(),
    });
    if (res.status === 404) return { session: null, updatedAt: null };
    if (!res.ok) return { session: null, updatedAt: null };
    const data = (await res.json()) as {
      session?: MarketAgentSession;
      updatedAt?: number;
    };
    return {
      session: data.session ?? null,
      updatedAt: data.updatedAt ?? null,
    };
  } catch {
    return { session: null, updatedAt: null };
  }
}

export async function pushRemoteSession(
  session: MarketAgentSession,
  meta?: { newSourceCount?: number; skipped?: boolean; recordForecast?: boolean },
): Promise<void> {
  if (!isRemoteSessionEnabled()) return;
  try {
    await fetch(cacheUrl(`/sessions/${encodeURIComponent(session.marketId)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...agentAuthHeaders() },
      body: JSON.stringify({
        session,
        newSourceCount: meta?.newSourceCount ?? 0,
        skipped: meta?.skipped ?? false,
        recordForecast: meta?.recordForecast !== false,
      }),
    });
  } catch {
    // Best-effort sync; localStorage remains source of truth offline.
  }
}

export async function bulkPushLocalSessions(
  sessions: MarketAgentSession[],
): Promise<number> {
  if (!isRemoteSessionEnabled() || sessions.length === 0) return 0;
  try {
    const res = await fetch(cacheUrl('/sessions/bulk'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...agentAuthHeaders() },
      body: JSON.stringify({ sessions }),
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as { written?: number };
    return data.written ?? 0;
  } catch {
    return 0;
  }
}

export interface StoredForecast {
  id: number;
  estimate: AgentEstimate;
  newSourceCount: number;
  skipped: boolean;
  sourceCount: number;
  createdAt: number;
}

export async function fetchForecastHistory(
  marketId: string | number,
  limit = 30,
): Promise<StoredForecast[]> {
  if (!isRemoteSessionEnabled()) return [];
  try {
    const res = await fetch(
      cacheUrl(
        `/sessions/${encodeURIComponent(String(marketId))}/forecasts?limit=${limit}`,
      ),
      { headers: agentAuthHeaders() },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { forecasts?: StoredForecast[] };
    return data.forecasts ?? [];
  } catch {
    return [];
  }
}

export interface SessionSummary {
  marketId: string;
  changedMind: boolean;
  updatedAt: number;
  pointEstimate: number | null;
  distributionType: string | null;
  confidence?: string | null;
}

export async function fetchSessionSummaries(): Promise<SessionSummary[]> {
  if (!isRemoteSessionEnabled()) return [];
  try {
    const res = await fetch(cacheUrl('/sessions'), { headers: agentAuthHeaders() });
    if (!res.ok) return [];
    const data = (await res.json()) as { summaries?: SessionSummary[] };
    return data.summaries ?? [];
  } catch {
    return [];
  }
}

export interface CacheStats {
  marketsWithForecasts: number;
  totalForecasts: number;
  revisedMarkets: number;
}

export async function fetchCacheStats(): Promise<CacheStats | null> {
  if (!isRemoteSessionEnabled()) return null;
  try {
    const res = await fetch(cacheUrl('/stats'), { headers: agentAuthHeaders() });
    if (!res.ok) return null;
    const data = (await res.json()) as { stats?: CacheStats };
    return data.stats ?? null;
  } catch {
    return null;
  }
}

const BULK_SYNC_KEY = 'fs-agent-bulk-synced-v1';

/** Upload every localStorage session to Postgres once per browser. */
export async function syncAllLocalSessionsOnce(): Promise<number> {
  if (!isRemoteSessionEnabled()) return 0;
  try {
    if (sessionStorage.getItem(BULK_SYNC_KEY) === '1') return 0;
  } catch {
    return 0;
  }
  const { listAllLocalSessions } = await import('./marketSession');
  const sessions = listAllLocalSessions().filter((s) => s.lastEstimate);
  if (sessions.length === 0) return 0;
  const written = await bulkPushLocalSessions(sessions);
  if (written > 0) {
    try {
      sessionStorage.setItem(BULK_SYNC_KEY, '1');
    } catch {
      // ignore
    }
  }
  return written;
}
