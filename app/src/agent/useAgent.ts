import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { FunctionSpaceContext, useMarket } from '@functionspace/react';
import { validateBeliefVector, computeStatistics } from '@functionspace/core';
import type { MarketState } from '@functionspace/core';
import { searchMarketNews } from './exaClient';
import { runInitialForecast, runRevisionForecast } from './claudeClient';
import { estimateToBelief } from './belief';
import { AGENT_DISTRIBUTION_TYPES } from './distributions';
import { loadMarketSession, mergeSources } from './marketSession';
import {
  getOrCreateSession,
  hydrateMarketSession,
  loadRemoteCycleHistory,
  persistMarketSession,
} from './sessionSync';
import { isRemoteSessionEnabled } from './remoteSession';
import type {
  AgentEstimate,
  AgentStatus,
  BeliefBuild,
  CycleRecord,
  ExaResult,
} from './types';

const MAX_HISTORY = 30;
const DEFAULT_POLL_SEC = 20;

export interface UseAgentResult {
  status: AgentStatus;
  market: MarketState | null;
  marketLoading: boolean;
  cycles: CycleRecord[];
  currentCycle: CycleRecord | null;
  beliefBuild: BeliefBuild | null;
  forecast: AgentEstimate | null;
  allSources: ExaResult[];
  error: string | null;
  autoMode: boolean;
  setAutoMode: (on: boolean) => void;
  intervalSec: number;
  setIntervalSec: (s: number) => void;
  secondsUntilNext: number | null;
  runCycleNow: () => void;
  loadedFromDb: boolean;
  busy: boolean;
}

export function useAgent(marketId: string | number): UseAgentResult {
  const ctx = useContext(FunctionSpaceContext);
  if (!ctx) throw new Error('useAgent must be used within a FunctionSpaceProvider');

  const { market, loading: marketLoading } = useMarket(marketId, {
    pollInterval: 15000,
  });

  const [status, setStatus] = useState<AgentStatus>('idle');
  const [cycles, setCycles] = useState<CycleRecord[]>([]);
  const [allSources, setAllSources] = useState<ExaResult[]>([]);
  const [beliefBuild, setBeliefBuild] = useState<BeliefBuild | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoMode, setAutoModeState] = useState(true);
  const [intervalSec, setIntervalSec] = useState(DEFAULT_POLL_SEC);
  const [nextRunAt, setNextRunAt] = useState<number | null>(Date.now());
  const [now, setNow] = useState(Date.now());
  const [cacheReady, setCacheReady] = useState(() => !isRemoteSessionEnabled());
  const [loadedFromDb, setLoadedFromDb] = useState(false);

  const runningRef = useRef(false);
  const cycleCounter = useRef(0);
  const marketRef = useRef<MarketState | null>(null);
  const intervalRef = useRef(intervalSec);

  marketRef.current = market;
  intervalRef.current = intervalSec;

  const runCycle = useCallback(async () => {
    if (runningRef.current) return;
    const mkt = marketRef.current;
    if (!mkt) {
      setError('Market data has not loaded yet.');
      return;
    }
    runningRef.current = true;
    setError(null);

    const id = ++cycleCounter.current;
    let record: CycleRecord = {
      id,
      startedAt: Date.now(),
      finishedAt: null,
      sources: [],
      newSourceCount: 0,
      skipped: false,
      estimate: null,
      beliefBuild: null,
      error: null,
    };

    try {
      setStatus('searching');
      const incoming = await searchMarketNews(mkt.title);

      let session = getOrCreateSession(marketId);
      const { merged, added } = mergeSources(session.sources, incoming);
      session = { ...session, sources: merged };
      setAllSources(merged);

      record = { ...record, sources: merged, newSourceCount: added.length };

      if (added.length === 0 && session.lastEstimate) {
        persistMarketSession(session, { newSourceCount: 0, skipped: true });
        record = {
          ...record,
          skipped: true,
          estimate: session.lastEstimate,
          finishedAt: Date.now(),
        };
        setStatus('idle');
      } else {
      const interpretCtx = {
        todayISO: new Date().toISOString().slice(0, 10),
        consensusMean:
          typeof mkt.consensusMean === 'number' && Number.isFinite(mkt.consensusMean)
            ? mkt.consensusMean
            : computeStatistics(
                mkt.consensus,
                mkt.config.lowerBound,
                mkt.config.upperBound,
              ).mean,
        lowerBound: mkt.config.lowerBound,
        upperBound: mkt.config.upperBound,
        marketTitle: mkt.title,
        xAxisUnits: mkt.xAxisUnits || '',
        expiresAt: mkt.expiresAt,
        allowedDistributions: AGENT_DISTRIBUTION_TYPES,
      };

      setStatus('thinking');

      if (!session.lastEstimate) {
        const batch = added.length > 0 ? merged : incoming;
        const { estimate, messages } = await runInitialForecast(
          batch,
          interpretCtx,
          session.messages,
        );
        session = { ...session, messages, lastEstimate: estimate };
        record = { ...record, estimate };
      } else {
        const { estimate, messages } = await runRevisionForecast(
          session.messages,
          added,
          session.lastEstimate,
          interpretCtx,
        );
        session = { ...session, messages, lastEstimate: estimate };
        record = { ...record, estimate };
      }

      setStatus('previewing');
      const beliefBuild = estimateToBelief(session.lastEstimate!, mkt.config);
      validateBeliefVector(beliefBuild.belief, mkt.config.numBuckets);
      ctx.setPreviewBelief(beliefBuild.belief);
      record = { ...record, beliefBuild };
      setBeliefBuild(beliefBuild);

        persistMarketSession(session, {
          newSourceCount: added.length,
          skipped: false,
        });
        record = { ...record, finishedAt: Date.now() };
        setStatus('idle');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      record = { ...record, error: msg, finishedAt: Date.now() };
      setError(msg);
      setStatus('error');
    } finally {
      setCycles((prev) => [record, ...prev].slice(0, MAX_HISTORY));
      runningRef.current = false;
      setNextRunAt(Date.now() + intervalRef.current * 1000);
    }
  }, [ctx, marketId]);

  const runCycleNow = useCallback(() => {
    void runCycle();
  }, [runCycle]);

  const setAutoMode = useCallback((on: boolean) => {
    setAutoModeState(on);
    setNextRunAt(on ? Date.now() : null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const applySession = (session: ReturnType<typeof loadMarketSession>) => {
      if (!session || cancelled) return;
      if (session.sources.length) setAllSources(session.sources);
      if (session.lastEstimate && market) {
        const build = estimateToBelief(session.lastEstimate, market.config);
        setBeliefBuild(build);
        ctx.setPreviewBelief(build.belief);
      }
    };

    if (!isRemoteSessionEnabled()) {
      applySession(loadMarketSession(marketId));
      setCacheReady(true);
      return () => {
        cancelled = true;
      };
    }

    setCacheReady(false);
    void (async () => {
      const session = await hydrateMarketSession(marketId);
      applySession(session);
      const history = await loadRemoteCycleHistory(
        marketId,
        session?.sources.length ?? 0,
      );
      if (!cancelled && history.length > 0) {
        setCycles(history);
        setLoadedFromDb(true);
      }
      if (!cancelled) setCacheReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [marketId, market, ctx]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!autoMode || !cacheReady || nextRunAt == null || marketLoading || !market) return;
    if (now >= nextRunAt && !runningRef.current) {
      void runCycle();
    }
  }, [autoMode, cacheReady, nextRunAt, now, runCycle, marketLoading, market]);

  useEffect(() => {
    return () => {
      ctx.setPreviewBelief(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const secondsUntilNext =
    autoMode && nextRunAt != null
      ? Math.max(0, Math.ceil((nextRunAt - now) / 1000))
      : null;

  const forecast = useMemo(() => {
    const fromCycle = cycles.find((c) => c.estimate)?.estimate;
    if (fromCycle) return fromCycle;
    return loadMarketSession(marketId)?.lastEstimate ?? null;
  }, [cycles, marketId]);

  return {
    status,
    market: market ?? null,
    marketLoading,
    cycles,
    currentCycle: cycles[0] ?? null,
    beliefBuild,
    forecast,
    allSources,
    error,
    autoMode,
    setAutoMode,
    intervalSec,
    setIntervalSec,
    secondsUntilNext,
    runCycleNow,
    loadedFromDb,
    busy:
      status === 'searching' ||
      status === 'thinking' ||
      status === 'previewing',
  };
}
