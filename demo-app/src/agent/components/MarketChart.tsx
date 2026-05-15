import { useContext } from 'react';
import { FunctionSpaceContext } from '@functionspace/react';
import {
  evaluateDensityCurve,
  computeStatistics,
  computePercentiles,
} from '@functionspace/core';
import type { MarketState } from '@functionspace/core';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { BeliefBuild } from '../types';
import { MONO } from '../theme';
import { formatUsd, formatUsdShort } from '../format';

const POINTS = 200;

interface MarketChartProps {
  market: MarketState;
  beliefBuild: BeliefBuild | null;
}

// Custom probability-density chart: the live market consensus, with the
// agent's target belief overlaid. Both curves are evaluated by the SDK's
// core math (evaluateDensityCurve) -- the component only renders.
export function MarketChart({ market, beliefBuild }: MarketChartProps) {
  const ctx = useContext(FunctionSpaceContext);
  const colors = ctx?.chartColors;
  const { lowerBound, upperBound } = market.config;

  const consensusCurve = evaluateDensityCurve(
    market.consensus,
    lowerBound,
    upperBound,
    POINTS,
  );
  const agentCurve = beliefBuild
    ? evaluateDensityCurve(beliefBuild.belief, lowerBound, upperBound, POINTS)
    : null;

  const data = consensusCurve.map((p, i) => ({
    x: p.x,
    consensus: p.y,
    agent: agentCurve ? (agentCurve[i]?.y ?? null) : null,
  }));

  const consensusStats = computeStatistics(
    market.consensus,
    lowerBound,
    upperBound,
  );
  const consensusMean = Number.isFinite(market.consensusMean)
    ? market.consensusMean
    : consensusStats.mean;

  // Crop the x domain to where the probability mass actually sits, so the
  // distribution is readable instead of a thin spike across 0-200k.
  const pct = computePercentiles(market.consensus, lowerBound, upperBound);
  let lo = pct.p2_5;
  let hi = pct.p97_5;
  if (beliefBuild) {
    lo = Math.min(lo, beliefBuild.center - 2 * beliefBuild.spread);
    hi = Math.max(hi, beliefBuild.center + 2 * beliefBuild.spread);
  }
  const pad = (hi - lo) * 0.08 || 1000;
  lo = Math.max(lowerBound, lo - pad);
  hi = Math.min(upperBound, hi + pad);

  const consensusColor = colors?.consensus ?? '#4d9fff';
  const agentColor = colors?.previewLine ?? '#f7931a';
  const gridColor = colors?.grid ?? '#222b38';
  const axisColor = colors?.axisText ?? '#8b949e';

  return (
    <div>
      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 18,
          flexWrap: 'wrap',
          fontFamily: MONO,
          fontSize: 11,
          color: 'var(--fs-text-secondary)',
          marginBottom: 6,
        }}
      >
        <LegendItem color={consensusColor} label="Market consensus" />
        <LegendItem color={agentColor} label="Agent target belief" dashed />
        <span>
          consensus mean{' '}
          <strong style={{ color: 'var(--fs-text)' }}>
            {formatUsd(consensusMean)}
          </strong>
        </span>
        {beliefBuild && (
          <span>
            agent center{' '}
            <strong style={{ color: agentColor }}>
              {formatUsd(beliefBuild.center)}
            </strong>
          </span>
        )}
      </div>

      <div style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id="fsConsensusFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={consensusColor} stopOpacity={0.28} />
                <stop offset="100%" stopColor={consensusColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="x"
              type="number"
              domain={[lo, hi]}
              tickFormatter={(v: number) => formatUsdShort(v)}
              tick={{ fill: axisColor, fontSize: 11, fontFamily: MONO }}
              stroke={gridColor}
            />
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip
              contentStyle={{
                background: 'var(--fs-surface)',
                border: '1px solid var(--fs-border)',
                borderRadius: 6,
                fontFamily: MONO,
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--fs-text)' }}
              labelFormatter={(v) => formatUsd(Number(v))}
              formatter={(value: number, name: string) => [
                value != null ? value.toFixed(5) : '-',
                name === 'consensus' ? 'consensus density' : 'agent density',
              ]}
            />
            <Area
              type="monotone"
              dataKey="consensus"
              stroke={consensusColor}
              strokeWidth={2}
              fill="url(#fsConsensusFill)"
              isAnimationActive={false}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="agent"
              stroke={agentColor}
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <ReferenceLine x={consensusMean} stroke={consensusColor} strokeOpacity={0.55} />
            {beliefBuild && (
              <ReferenceLine
                x={beliefBuild.center}
                stroke={agentColor}
                strokeDasharray="4 3"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 16,
          height: 0,
          borderTop: `3px ${dashed ? 'dashed' : 'solid'} ${color}`,
        }}
      />
      {label}
    </span>
  );
}
