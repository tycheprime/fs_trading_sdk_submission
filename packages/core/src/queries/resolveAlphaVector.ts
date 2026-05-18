/**
 * Consensus coefficients from the views API.
 * Production uses `alpha_vector`; dev/staging may use `state_vector`.
 */
export function resolveAlphaVector(
  data: { alpha_vector?: number[] | null; state_vector?: number[] | null },
  context: string,
): number[] {
  const raw = data.alpha_vector ?? data.state_vector;
  if (raw == null) {
    throw new Error(
      `Missing alpha_vector in ${context} (API may use state_vector on older endpoints)`,
    );
  }
  if (!Array.isArray(raw)) {
    throw new Error(`Invalid alpha_vector in ${context}`);
  }
  return raw;
}
