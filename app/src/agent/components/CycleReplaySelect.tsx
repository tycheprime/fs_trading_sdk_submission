import { MONO } from '../theme';
import type { AgentEstimate, BeliefBuild, CycleRecord } from '../types';

interface CycleReplaySelectProps {
  cycles: CycleRecord[];
  replayCycleId: number | null;
  onReplayCycleId: (id: number | null) => void;
}

export function CycleReplaySelect({
  cycles,
  replayCycleId,
  onReplayCycleId,
}: CycleReplaySelectProps) {
  const withBelief = cycles.filter((c) => c.beliefBuild != null);

  if (withBelief.length === 0) return null;

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: MONO,
        fontSize: 11,
        color: 'var(--fs-text-secondary)',
      }}
    >
      Chart view
      <select
        value={replayCycleId ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onReplayCycleId(v === '' ? null : Number(v));
        }}
        style={{
          fontFamily: MONO,
          fontSize: 11,
          padding: '4px 6px',
          borderRadius: 4,
          border: '1px solid var(--fs-border)',
          background: 'var(--fs-input-bg, #0b0e13)',
          color: 'var(--fs-text)',
        }}
      >
        <option value="">Live agent curve</option>
        {withBelief.map((c) => (
          <option key={c.id} value={c.id}>
            Cycle #{c.id}
            {c.skipped ? ' (held)' : ''}
            {c.estimate?.changedMind ? ' · changed' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

export function resolveChartBeliefBuild(
  live: BeliefBuild | null,
  cycles: CycleRecord[],
  replayCycleId: number | null,
): BeliefBuild | null {
  if (replayCycleId == null) return live;
  const rec = cycles.find((c) => c.id === replayCycleId);
  return rec?.beliefBuild ?? live;
}

export function resolveChartEstimate(
  live: AgentEstimate | null,
  cycles: CycleRecord[],
  replayCycleId: number | null,
): AgentEstimate | null {
  if (replayCycleId == null) return live;
  const rec = cycles.find((c) => c.id === replayCycleId);
  return rec?.estimate ?? live;
}
