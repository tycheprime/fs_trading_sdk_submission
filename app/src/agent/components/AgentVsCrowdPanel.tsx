import { useMemo } from 'react';
import type { MarketState } from '@functionspace/core';
import { compareAgentToCrowd } from '../compare';
import { Panel } from './Panel';
import { MONO } from '../theme'; // stat rows only
import { formatOutcome, formatProb } from '../format';
import type { AgentEstimate, BeliefBuild } from '../types';

const DIV_COLOR = {
  low: 'var(--fs-positive)',
  medium: 'var(--fs-accent)',
  high: 'var(--fs-negative)',
} as const;

interface AgentVsCrowdPanelProps {
  market: MarketState | null;
  estimate: AgentEstimate | null;
  beliefBuild: BeliefBuild | null;
}

export function AgentVsCrowdPanel({
  market,
  estimate,
  beliefBuild,
}: AgentVsCrowdPanelProps) {
  const cmp = useMemo(() => {
    if (!market || !estimate || !beliefBuild) return null;
    return compareAgentToCrowd(market, estimate, beliefBuild);
  }, [market, estimate, beliefBuild]);

  const units = market?.xAxisUnits ?? '';

  return (
    <Panel title="Agent vs crowd">
      {!cmp ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--fs-text-secondary)' }}>
          Run a forecast to compare the agent&apos;s curve to market consensus.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: DIV_COLOR[cmp.divergence],
              }}
            >
              {cmp.headline}
            </div>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 12,
                lineHeight: 1.45,
                color: 'var(--fs-text-secondary)',
              }}
            >
              {cmp.detail}
            </p>
          </div>

          <div
            className="fs-crowd-compare-grid"
            style={{ fontFamily: MONO, fontSize: 12 }}
          >
            <CompareRow
              label="μ_crowd"
              value={formatOutcome(cmp.consensusMean, units)}
              accent="var(--fs-accent)"
            />
            <CompareRow
              label="μ_agent"
              value={formatOutcome(cmp.agentCenter, units)}
              accent="var(--fs-primary)"
            />
            <CompareRow
              label="σ_crowd / σ_agent"
              value={`${formatOutcome(cmp.crowdStdDev, units)} / ${formatOutcome(cmp.agentStdDev, units)}`}
              accent="var(--fs-text-secondary)"
            />
            <CompareRow
              label="Gap"
              value={
                cmp.deltaPct != null
                  ? `${cmp.delta >= 0 ? '+' : ''}${formatOutcome(cmp.delta, units)} (${cmp.deltaPct >= 0 ? '+' : ''}${cmp.deltaPct.toFixed(1)}%)`
                  : `${cmp.delta >= 0 ? '+' : ''}${formatOutcome(cmp.delta, units)}`
              }
              accent={DIV_COLOR[cmp.divergence]}
            />
            <CompareRow
              label="Agent shape"
              value={cmp.agentShapeLabel}
              accent="var(--fs-text)"
            />
            {cmp.l1Distance != null && cmp.pAgentAboveCrowdMean != null && (
              <CompareRow
                label="L₁ / P(x>μ_c)"
                value={`${cmp.l1Distance.toFixed(4)} / ${formatProb(cmp.pAgentAboveCrowdMean)}`}
                accent={DIV_COLOR[cmp.divergence]}
              />
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function CompareRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="fs-crowd-compare-row">
      <span style={{ color: 'var(--fs-text-secondary)' }}>{label}</span>
      <span style={{ color: accent, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
