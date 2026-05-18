import { useContext, useMemo } from 'react';
import { FunctionSpaceContext } from '@functionspace/react';
import {
  evaluateDensityCurve,
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
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';
import type { AgentEstimate, BeliefBuild } from '../types';
import {
  l1DensityDistance,
  probAboveThreshold,
  summarizeBelief,
  type DistributionSummary,
} from '../chartStats';
import { MONO } from '../theme';
import { formatDensity, formatOutcome, formatProb, formatUsdShort } from '../format';

const POINTS = 200;

interface MarketChartProps {
  market: MarketState;
  beliefBuild: BeliefBuild | null;
  estimate: AgentEstimate | null;
}

export function MarketChart({ market, beliefBuild, estimate }: MarketChartProps) {
  const ctx = useContext(FunctionSpaceContext);
  const colors = ctx?.chartColors;
  const { lowerBound, upperBound } = market.config;
  const units = market.xAxisUnits || '';

  const consensusCurve = evaluateDensityCurve(
    market.consensus,
    lowerBound,
    upperBound,
    POINTS,
  );
  const agentCurve = beliefBuild
    ? evaluateDensityCurve(beliefBuild.belief, lowerBound, upperBound, POINTS)
    : null;

  const crowd = useMemo(
    () => summarizeBelief(market.consensus, lowerBound, upperBound),
    [market.consensus, lowerBound, upperBound],
  );

  const agentSummary = useMemo(() => {
    if (!beliefBuild) return null;
    return summarizeBelief(beliefBuild.belief, lowerBound, upperBound);
  }, [beliefBuild, lowerBound, upperBound]);

  const divergence = useMemo(() => {
    if (!beliefBuild) return null;
    return {
      l1: l1DensityDistance(
        market.consensus,
        beliefBuild.belief,
        lowerBound,
        upperBound,
        POINTS,
      ),
      pAboveCrowdMean: probAboveThreshold(
        beliefBuild.belief,
        crowd.mean,
        lowerBound,
        upperBound,
      ),
    };
  }, [beliefBuild, market.consensus, crowd.mean, lowerBound, upperBound]);

  const data = useMemo(
    () =>
      consensusCurve.map((p, i) => ({
        x: p.x,
        consensus: p.y,
        agent: agentCurve ? (agentCurve[i]?.y ?? null) : null,
      })),
    [consensusCurve, agentCurve],
  );

  const pct = computePercentiles(market.consensus, lowerBound, upperBound);
  let lo = pct.p2_5;
  let hi = pct.p97_5;
  if (beliefBuild) {
    lo = Math.min(lo, beliefBuild.center - 2 * beliefBuild.spread);
    hi = Math.max(hi, beliefBuild.center + 2 * beliefBuild.spread);
  }
  if (estimate) {
    lo = Math.min(lo, estimate.low);
    hi = Math.max(hi, estimate.high);
  }
  const pad = (hi - lo) * 0.08 || 1000;
  lo = Math.max(lowerBound, lo - pad);
  hi = Math.min(upperBound, hi + pad);

  const consensusColor = colors?.consensus ?? '#4d9fff';
  const agentColor = colors?.previewLine ?? '#f7931a';
  const gridColor = colors?.grid ?? '#222b38';
  const axisColor = colors?.axisText ?? '#8b949e';

  return (
    <div className="fs-density-chart">
      <div
        style={{
          display: 'flex',
          gap: 18,
          flexWrap: 'wrap',
          fontFamily: MONO,
          fontSize: 10,
          color: 'var(--fs-text-secondary)',
          marginBottom: 6,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        <LegendItem color={consensusColor} label="π_crowd(x)" />
        {beliefBuild && (
          <LegendItem color={agentColor} label="π_agent(x)" dashed />
        )}
        <LegendItem color={consensusColor} label="IQR crowd" box />
        {estimate && (
          <LegendItem color={agentColor} label="agent 90% band" box dashed />
        )}
      </div>

      <div style={{ height: 340 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 14, bottom: 20, left: 4 }}
          >
            <defs>
              <linearGradient id="fsConsensusFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={consensusColor} stopOpacity={0.22} />
                <stop offset="100%" stopColor={consensusColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke={gridColor}
              strokeDasharray="2 4"
              vertical
              horizontal
            />
            <XAxis
              dataKey="x"
              type="number"
              domain={[lo, hi]}
              tickFormatter={(v: number) => formatUsdShort(v)}
              tick={{ fill: axisColor, fontSize: 10, fontFamily: MONO }}
              stroke={gridColor}
              label={{
                value: `outcome x (${units || 'units'})`,
                position: 'insideBottom',
                offset: -8,
                fill: axisColor,
                fontSize: 10,
                fontFamily: MONO,
              }}
            />
            <YAxis
              tickFormatter={(v: number) => formatDensity(v)}
              tick={{ fill: axisColor, fontSize: 10, fontFamily: MONO }}
              stroke={gridColor}
              width={56}
              label={{
                value: 'f(x)',
                angle: -90,
                position: 'insideLeft',
                fill: axisColor,
                fontSize: 10,
                fontFamily: MONO,
              }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as {
                  consensus?: number;
                  agent?: number | null;
                };
                return (
                  <div className="fs-chart-tooltip">
                    <div className="fs-chart-tooltip-x">
                      x = {formatOutcome(Number(label), units)}
                    </div>
                    {row?.consensus != null && (
                      <div style={{ color: consensusColor }}>
                        π_crowd = {formatDensity(row.consensus)}
                      </div>
                    )}
                    {row?.agent != null && (
                      <div style={{ color: agentColor }}>
                        π_agent = {formatDensity(row.agent)}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <ReferenceArea
              x1={crowd.p25}
              x2={crowd.p75}
              fill={consensusColor}
              fillOpacity={0.1}
              strokeOpacity={0}
            />
            {estimate && (
              <ReferenceArea
                x1={estimate.low}
                x2={estimate.high}
                fill={agentColor}
                fillOpacity={0.08}
                stroke={agentColor}
                strokeOpacity={0.35}
                strokeDasharray="4 3"
              />
            )}
            <ReferenceLine
              x={crowd.p2_5}
              stroke={consensusColor}
              strokeDasharray="2 3"
              strokeOpacity={0.35}
            />
            <ReferenceLine
              x={crowd.p97_5}
              stroke={consensusColor}
              strokeDasharray="2 3"
              strokeOpacity={0.35}
            />
            <ReferenceLine
              x={crowd.median}
              stroke={consensusColor}
              strokeOpacity={0.5}
            />
            <Area
              type="monotone"
              dataKey="consensus"
              stroke={consensusColor}
              strokeWidth={1.5}
              fill="url(#fsConsensusFill)"
              isAnimationActive={false}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="agent"
              stroke={agentColor}
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            {beliefBuild && (
              <ReferenceLine
                x={beliefBuild.center}
                stroke={agentColor}
                strokeDasharray="4 2"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <StatsTable
        units={units}
        crowd={crowd}
        agent={agentSummary}
        estimate={estimate}
        divergence={divergence}
        consensusColor={consensusColor}
        agentColor={agentColor}
      />
    </div>
  );
}

function StatsTable({
  units,
  crowd,
  agent,
  estimate,
  divergence,
  consensusColor,
  agentColor,
}: {
  units: string;
  crowd: DistributionSummary;
  agent: DistributionSummary | null;
  estimate: AgentEstimate | null;
  divergence: { l1: number; pAboveCrowdMean: number } | null;
  consensusColor: string;
  agentColor: string;
}) {
  return (
    <div className="fs-density-stats">
      <div className="fs-density-stats-head">
        <span style={{ color: consensusColor }}>Crowd π(x)</span>
        {agent && <span style={{ color: agentColor }}>Agent π(x)</span>}
      </div>
      <StatRow
        label="μ (mean)"
        crowd={formatOutcome(crowd.mean, units)}
        agent={agent ? formatOutcome(agent.mean, units) : '—'}
      />
      <StatRow
        label="σ (std dev)"
        crowd={formatOutcome(crowd.stdDev, units)}
        agent={agent ? formatOutcome(agent.stdDev, units) : '—'}
      />
      <StatRow
        label="p50 (median)"
        crowd={formatOutcome(crowd.median, units)}
        agent={agent ? formatOutcome(agent.median, units) : '—'}
      />
      <StatRow
        label="90% HDI"
        crowd={`[${formatOutcome(crowd.p2_5, units)}, ${formatOutcome(crowd.p97_5, units)}]`}
        agent={
          agent
            ? `[${formatOutcome(agent.p2_5, units)}, ${formatOutcome(agent.p97_5, units)}]`
            : '—'
        }
      />
      <StatRow
        label="IQR"
        crowd={`[${formatOutcome(crowd.p25, units)}, ${formatOutcome(crowd.p75, units)}]`}
        agent={
          agent
            ? `[${formatOutcome(agent.p25, units)}, ${formatOutcome(agent.p75, units)}]`
            : '—'
        }
      />
      {estimate && (
        <StatRow
          label="stated 90% CI"
          crowd="—"
          agent={`[${formatOutcome(estimate.low, units)}, ${formatOutcome(estimate.high, units)}]`}
        />
      )}
      {divergence && (
        <div className="fs-density-divergence">
          L₁(π_agent, π_crowd) = {divergence.l1.toFixed(4)} · P_agent(x {'>'} μ_crowd) ={' '}
          {formatProb(divergence.pAboveCrowdMean)}
        </div>
      )}
    </div>
  );
}

function StatRow({
  label,
  crowd,
  agent,
}: {
  label: string;
  crowd: string;
  agent: string;
}) {
  return (
    <div className="fs-density-stat-row">
      <span className="fs-density-stat-label">{label}</span>
      <span className="fs-density-stat-val">{crowd}</span>
      <span className="fs-density-stat-val">{agent}</span>
    </div>
  );
}

function LegendItem({
  color,
  label,
  dashed,
  box,
}: {
  color: string;
  label: string;
  dashed?: boolean;
  box?: boolean;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {box ? (
        <span
          style={{
            width: 12,
            height: 10,
            background: color,
            opacity: 0.25,
            border: `1px ${dashed ? 'dashed' : 'solid'} ${color}`,
          }}
        />
      ) : (
        <span
          style={{
            width: 16,
            height: 0,
            borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
          }}
        />
      )}
      {label}
    </span>
  );
}
