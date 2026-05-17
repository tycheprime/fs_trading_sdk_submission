import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { FunctionSpaceContext, useMarket } from '@functionspace/react';
import { validateBeliefVector, computeStatistics } from '@functionspace/core';
import type { MarketState } from '@functionspace/core';
import { searchBitcoinNews } from './exaClient';
import { runInitialForecast, runRevisionForecast } from './claudeClient';
import { estimateToBelief } from './belief';
import {
  createEmptySession,
  loadMarketSession,
  mergeSources,
  saveMarketSession,
} from './marketSession';
import type { AgentStatus, BeliefBuild, CycleRecord, ExaResult } from './types';

const MAX_HISTORY = 30;
const DEFAULT_POLL_SEC = 20;

export interface UseAgentResult {
  status: AgentStatus;
  market: MarketState | null;
  marketLoading: boolean;
  cycles: CycleRecord[];
  currentCycle: CycleRecord | null;
  beliefBuild: BeliefBuild | null;
  allSources: ExaResult[];
  error: string | null;
  autoMode: boolean;
  setAutoMode: (on: boolean) => void;
  intervalSec: number;
  setIntervalSec: (s: number) => void;
  secondsUntilNext: number | null;
  runCycleNow: () => void;
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
      const incoming = await searchBitcoinNews();

      let session = loadMarketSession(marketId) ?? createEmptySession(marketId);
      const { merged, added } = mergeSources(session.sources, incoming);
      session = { ...session, sources: merged };
      setAllSources(merged);

      record = { ...record, sources: merged, newSourceCount: added.length };

      if (added.length === 0 && session.lastEstimate) {
        saveMarketSession(session);
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

        saveMarketSession(session);
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
    const session = loadMarketSession(marketId);
    if (session?.sources.length) {
      setAllSources(session.sources);
    }
    if (session?.lastEstimate && market) {
      const build = estimateToBelief(session.lastEstimate, market.config);
      setBeliefBuild(build);
      ctx.setPreviewBelief(build.belief);
    }
  }, [marketId, market, ctx]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!autoMode || nextRunAt == null || marketLoading || !market) return;
    if (now >= nextRunAt && !runningRef.current) {
      void runCycle();
    }
  }, [autoMode, nextRunAt, now, runCycle, marketLoading, market]);

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

  return {
    status,
    market: market ?? null,
    marketLoading,
    cycles,
    currentCycle: cycles[0] ?? null,
    beliefBuild,
    allSources,
    error,
    autoMode,
    setAutoMode,
    intervalSec,
    setIntervalSec,
    secondsUntilNext,
    runCycleNow,
    busy:
      status === 'searching' ||
      status === 'thinking' ||
      status === 'previewing',
  };
}
