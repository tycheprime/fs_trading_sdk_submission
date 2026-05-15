import { generateGaussian } from '@functionspace/core';
import type { MarketConfig } from '@functionspace/core';
import type { AgentEstimate, BeliefBuild } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Turn the agent's estimate into a belief vector.
//
// The agent decides WHERE the distribution sits (center) and HOW WIDE it is
// (spread); the SDK owns the actual vector construction. We never hand-build
// or normalize the vector ourselves -- generateGaussian from @functionspace/core
// does that, sourcing numBuckets and the bounds from the live market config.
export function estimateToBelief(
  estimate: AgentEstimate,
  config: MarketConfig,
): BeliefBuild {
  const { numBuckets, lowerBound, upperBound } = config;
  const span = upperBound - lowerBound;
  const bucketWidth = span / numBuckets;

  // Keep the gaussian center strictly inside the market bounds.
  const center = clamp(
    estimate.pointEstimate,
    lowerBound + bucketWidth,
    upperBound - bucketWidth,
  );

  // The estimate's low/high are a 90% confidence interval. A normal
  // distribution's 5th-to-95th-percentile span is about 3.29 standard
  // deviations, so dividing the interval width by 3.29 recovers sigma.
  const rawSpread = Math.abs(estimate.high - estimate.low) / 3.29;
  // Floor at one bucket so a hyper-confident estimate still spans a bucket;
  // cap at half the range so a vague estimate stays a valid distribution.
  const spread = clamp(rawSpread, bucketWidth, span / 2);

  const belief = generateGaussian(
    center,
    spread,
    numBuckets,
    lowerBound,
    upperBound,
  );

  return { belief, center, spread };
}
