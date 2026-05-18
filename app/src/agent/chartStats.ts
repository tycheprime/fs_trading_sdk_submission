import {
  computePercentiles,
  computeStatistics,
  evaluateDensityCurve,
  evaluateDensityPiecewise,
} from '@functionspace/core';

export interface DistributionSummary {
  mean: number;
  median: number;
  mode: number;
  stdDev: number;
  p2_5: number;
  p25: number;
  p75: number;
  p97_5: number;
}

export function summarizeBelief(
  coefficients: number[],
  lowerBound: number,
  upperBound: number,
): DistributionSummary {
  const s = computeStatistics(coefficients, lowerBound, upperBound);
  const p = computePercentiles(coefficients, lowerBound, upperBound);
  return {
    mean: s.mean,
    median: s.median,
    mode: s.mode,
    stdDev: s.stdDev,
    p2_5: p.p2_5,
    p25: p.p25,
    p75: p.p75,
    p97_5: p.p97_5,
  };
}

/** L1 distance ∫|f − g| dx between two belief densities (0–2 scale). */
export function l1DensityDistance(
  coeffsA: number[],
  coeffsB: number[],
  lowerBound: number,
  upperBound: number,
  points = 200,
): number {
  const curveA = evaluateDensityCurve(coeffsA, lowerBound, upperBound, points);
  const curveB = evaluateDensityCurve(coeffsB, lowerBound, upperBound, points);
  const dx = (upperBound - lowerBound) / points;
  let sum = 0;
  for (let i = 0; i < points; i++) {
    sum += Math.abs(curveA[i].y - curveB[i].y) * dx;
  }
  return sum;
}

/** P(X > threshold) under the belief density (numerical). */
export function probAboveThreshold(
  coefficients: number[],
  threshold: number,
  lowerBound: number,
  upperBound: number,
): number {
  const points = 400;
  const dx = (upperBound - lowerBound) / points;
  let tail = 0;
  let total = 0;
  for (let i = 0; i < points; i++) {
    const x = lowerBound + dx * (i + 0.5);
    const d = evaluateDensityPiecewise(coefficients, x, lowerBound, upperBound);
    const mass = d * dx;
    total += mass;
    if (x > threshold) tail += mass;
  }
  return total > 0 ? tail / total : 0;
}
