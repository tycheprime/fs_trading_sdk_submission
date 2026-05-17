import { MONO } from '../theme';
import type { AgentStatus } from '../types';

const META: Record<AgentStatus, { label: string; color: string; pulse: boolean }> = {
  idle: { label: 'IDLE', color: 'var(--fs-text-secondary)', pulse: false },
  searching: { label: 'SEARCHING EXA', color: 'var(--fs-accent)', pulse: true },
  thinking: { label: 'CLAUDE THINKING', color: 'var(--fs-accent)', pulse: true },
  previewing: { label: 'BUILDING BELIEF', color: 'var(--fs-accent)', pulse: true },
  error: { label: 'ERROR', color: 'var(--fs-negative)', pulse: false },
};

// The agent's current lifecycle phase as a colored pill with a live dot.
export function StatusPill({ status }: { status: AgentStatus }) {
  const m = META[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.08em',
        color: m.color,
        border: `1px solid ${m.color}`,
        borderRadius: 999,
        padding: '4px 11px',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        className={m.pulse ? 'fs-agent-pulse' : undefined}
        style={{ width: 7, height: 7, borderRadius: '50%', background: m.color }}
      />
      {m.label}
    </span>
  );
}
