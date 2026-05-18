import { computeStatistics } from '@functionspace/core';
import type { MarketState } from '@functionspace/core';
import { l1DensityDistance, probAboveThreshold, summarizeBelief } from './chartStats';
import { DISTRIBUTION_LABELS } from './distributions';
import { formatProb } from './format';
import type { AgentEstimate, BeliefBuild } from './types';

export interface CrowdComparison {
  consensusMean: number;
  agentCenter: number;
  delta: number;
  deltaPct: number | null;
  agentShapeLabel: string;
  alignment: 'aligned' | 'above' | 'below';
  divergence: 'low' | 'medium' | 'high';
  l1Distance: number | null;
  pAgentAboveCrowdMean: number | null;
  crowdStdDev: number;
  agentStdDev: number;
  headline: string;
  detail: string;
}

function consensusMeanFor(market: MarketState): number {
  if (typeof market.consensusMean === 'number' && Number.isFinite(market.consensusMean)) {
    return market.consensusMean;
  }
  const { lowerBound, upperBound } = market.config;
  return computeStatistics(market.consensus, lowerBound, upperBound).mean;
}

export function compareAgentToCrowd(
  market: MarketState,
  estimate: AgentEstimate,
  build: BeliefBuild,
): CrowdComparison {
  const consensusMean = consensusMeanFor(market);
  const agentCenter = build.center;
  const delta = agentCenter - consensusMean;
  const deltaPct =
    Math.abs(consensusMean) > 1e-6 ? (delta / consensusMean) * 100 : null;

  const alignment: CrowdComparison['alignment'] =
    Math.abs(delta) < (market.config.upperBound - market.config.lowerBound) * 0.01
      ? 'aligned'
      : delta > 0
        ? 'above'
        : 'below';

  const absPct = deltaPct != null ? Math.abs(deltaPct) : 0;
  const divergence: CrowdComparison['divergence'] =
    absPct < 3 ? 'low' : absPct < 12 ? 'medium' : 'high';

  const agentShapeLabel = DISTRIBUTION_LABELS[estimate.distributionType];
  const dir =
    alignment === 'aligned'
      ? 'in line with'
      : alignment === 'above'
        ? 'above'
        : 'below';

  const headline =
    divergence === 'low'
      ? `Agent ${dir} crowd consensus`
      : `Agent diverges ${dir} crowd`;

  const shapeNote =
    estimate.distributionType === 'gaussian'
      ? 'Both express a single peaked view.'
      : `Agent uses ${agentShapeLabel}; the crowd curve is a blended market view, not one shape label.`;

  const pctStr =
    deltaPct != null
      ? `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}% vs μ_crowd`
      : `${delta >= 0 ? '+' : ''}${Math.round(delta).toLocaleString()} vs μ_crowd`;

  const { lowerBound, upperBound } = market.config;
  const crowd = summarizeBelief(market.consensus, lowerBound, upperBound);
  const agentStats = summarizeBelief(build.belief, lowerBound, upperBound);
  const l1 = l1DensityDistance(
    market.consensus,
    build.belief,
    lowerBound,
    upperBound,
  );
  const pAbove = probAboveThreshold(
    build.belief,
    consensusMean,
    lowerBound,
    upperBound,
  );

  const detail = `${shapeNote} Δμ: ${pctStr}. L₁=${l1.toFixed(4)}, P(x>μ_crowd)=${formatProb(pAbove)}.`;

  return {
    consensusMean,
    agentCenter,
    delta,
    deltaPct,
    agentShapeLabel,
    alignment,
    divergence,
    l1Distance: l1,
    pAgentAboveCrowdMean: pAbove,
    crowdStdDev: crowd.stdDev,
    agentStdDev: agentStats.stdDev,
    headline,
    detail,
  };
}
