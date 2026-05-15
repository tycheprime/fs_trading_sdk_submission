import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  FunctionSpaceContext,
  useMarket,
  useBuy,
  useSell,
  usePreviewPayout,
} from '@functionspace/react';
import { validateBeliefVector, computeStatistics } from '@functionspace/core';
import type { MarketState, PayoutCurve } from '@functionspace/core';
import { searchBitcoinNews } from './exaClient';
import { interpretToEstimate } from './claudeClient';
import { estimateToBelief } from './belief';
import type { AgentStatus, CycleRecord } from './types';

const MAX_HISTORY = 30;

export interface UseAgentResult {
  status: AgentStatus;
  market: MarketState | null;
  marketLoading: boolean;
  cycles: CycleRecord[];
  currentCycle: CycleRecord | null;
  payout: PayoutCurve | null;
  error: string | null;
  // controls
  autoMode: boolean;
  setAutoMode: (on: boolean) => void;
  armed: boolean;
  setArmed: (on: boolean) => void;
  intervalSec: number;
  setIntervalSec: (s: number) => void;
  positionSize: number;
  setPositionSize: (n: number) => void;
  secondsUntilNext: number | null;
  runCycleNow: () => void;
  commitNow: () => void;
  isAuthenticated: boolean;
  currentPositionId: number | null;
  busy: boolean;
}

// The agent loop. Each cycle: search exa.ai, ask Claude to interpret the
// results into a BTC estimate, build a belief via the SDK's core generators,
// preview the payout, and (when armed) re-position via useBuy / useSell.
export function useAgent(marketId: string | number): UseAgentResult {
  const ctx = useContext(FunctionSpaceContext);
  if (!ctx) throw new Error('useAgent must be used within a FunctionSpaceProvider');

  // Poll the market so the consensus curve stays fresh as others trade.
  const { market, loading: marketLoading } = useMarket(marketId, {
    pollInterval: 15000,
  });
  const { execute: buyExecute } = useBuy(marketId);
  const { execute: sellExecute } = useSell(marketId);
  const { execute: previewPayout } = usePreviewPayout(marketId);

  const [status, setStatus] = useState<AgentStatus>('idle');
  const [cycles, setCycles] = useState<CycleRecord[]>([]);
  const [payout, setPayout] = useState<PayoutCurve | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoMode, setAutoModeState] = useState(false);
  const [armed, setArmed] = useState(false);
  const [intervalSec, setIntervalSec] = useState(90);
  const [positionSize, setPositionSize] = useState(25);
  const [currentPositionId, setCurrentPositionId] = useState<number | null>(null);
  const [nextRunAt, setNextRunAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // Refs let the cycle read live control values without rebinding the loop.
  const runningRef = useRef(false);
  const cycleCounter = useRef(0);
  const marketRef = useRef<MarketState | null>(null);
  const armedRef = useRef(armed);
  const intervalRef = useRef(intervalSec);
  const sizeRef = useRef(positionSize);
  const positionRef = useRef<number | null>(null);

  marketRef.current = market;
  armedRef.current = armed;
  intervalRef.current = intervalSec;
  sizeRef.current = positionSize;
  positionRef.current = currentPositionId;

  // Re-position: drop the prior cycle's position, open one for the new belief.
  const commitBelief = useCallback(
    async (belief: number[]): Promise<number> => {
      const prior = positionRef.current;
      if (prior != null) {
        try {
          await sellExecute(prior);
        } catch {
          // The prior position may already be closed; proceed to the new buy.
        }
      }
      const result = await buyExecute(belief, sizeRef.current);
      const posId = Number(result.positionId);
      setCurrentPositionId(posId);
      await ctx.refreshUser();
      return posId;
    },
    [buyExecute, sellExecute, ctx],
  );

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
      estimate: null,
      beliefBuild: null,
      committed: false,
      positionId: null,
      error: null,
    };

    try {
      const { numBuckets, lowerBound, upperBound } = mkt.config;

      setStatus('searching');
      const sources = await searchBitcoinNews();
      record = { ...record, sources };

      setStatus('thinking');
      const consensusMean =
        typeof mkt.consensusMean === 'number' && Number.isFinite(mkt.consensusMean)
          ? mkt.consensusMean
          : computeStatistics(mkt.consensus, lowerBound, upperBound).mean;
      const estimate = await interpretToEstimate(sources, {
        todayISO: new Date().toISOString().slice(0, 10),
        consensusMean,
        lowerBound,
        upperBound,
      });
      record = { ...record, estimate };

      setStatus('previewing');
      const beliefBuild = estimateToBelief(estimate, mkt.config);
      // Belt-and-suspenders: confirm the SDK-built vector is valid before use.
      validateBeliefVector(beliefBuild.belief, numBuckets);
      record = { ...record, beliefBuild };

      // Phase 1: show the agent's target belief as a chart overlay.
      ctx.setPreviewBelief(beliefBuild.belief);

      // Phase 2: preview the payout for that belief.
      try {
        const curve = await previewPayout(beliefBuild.belief, sizeRef.current);
        setPayout(curve);
        ctx.setPreviewPayout(curve);
      } catch {
        // A failed preview should not abort the cycle.
      }

      // Phase 3: when armed, re-position automatically.
      if (armedRef.current && ctx.isAuthenticated) {
        setStatus('committing');
        const posId = await commitBelief(beliefBuild.belief);
        record = { ...record, committed: true, positionId: posId };
      }

      record = { ...record, finishedAt: Date.now() };
      setStatus('idle');
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
  }, [ctx, previewPayout, commitBelief]);

  // Manual commit of the most recent belief (used when the agent is not armed).
  const commitNow = useCallback(() => {
    const latest = cycles[0]?.beliefBuild;
    if (!latest) {
      setError('Run a cycle first: there is no belief to commit yet.');
      return;
    }
    if (!ctx.isAuthenticated) {
      setError('Log in before committing a position.');
      return;
    }
    if (runningRef.current) return;
    runningRef.current = true;
    setStatus('committing');
    setError(null);
    commitBelief(latest.belief)
      .then((posId) => {
        setCycles((prev) =>
          prev.map((c, i) =>
            i === 0 ? { ...c, committed: true, positionId: posId } : c,
          ),
        );
        setStatus('idle');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      })
      .finally(() => {
        runningRef.current = false;
      });
  }, [cycles, ctx, commitBelief]);

  const runCycleNow = useCallback(() => {
    void runCycle();
  }, [runCycle]);

  const setAutoMode = useCallback((on: boolean) => {
    setAutoModeState(on);
    // Enabling auto-mode schedules a cycle on the next tick.
    setNextRunAt(on ? Date.now() : null);
  }, []);

  // One-second ticker: drives the countdown and the auto-mode trigger.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!autoMode || nextRunAt == null) return;
    if (now >= nextRunAt && !runningRef.current) {
      void runCycle();
    }
  }, [autoMode, nextRunAt, now, runCycle]);

  // Clear chart overlays when the agent unmounts.
  useEffect(() => {
    return () => {
      ctx.setPreviewBelief(null);
      ctx.setPreviewPayout(null);
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
    payout,
    error,
    autoMode,
    setAutoMode,
    armed,
    setArmed,
    intervalSec,
    setIntervalSec,
    positionSize,
    setPositionSize,
    secondsUntilNext,
    runCycleNow,
    commitNow,
    isAuthenticated: ctx.isAuthenticated,
    currentPositionId,
    busy:
      status === 'searching' ||
      status === 'thinking' ||
      status === 'previewing' ||
      status === 'committing',
  };
}
