import { Panel } from './Panel';
import { MONO } from '../theme';
import { formatUsd, clockTime } from '../format';
import type { CycleRecord } from '../types';

// Chronological log of every agent cycle: forecast, belief, and trade outcome.
export function ActivityLog({ cycles }: { cycles: CycleRecord[] }) {
  return (
    <Panel
      title="Cycle Log"
      right={
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--fs-text-secondary)' }}>
          {cycles.length} cycles
        </span>
      }
      bodyStyle={{ padding: 0, overflowY: 'auto' }}
      style={{ flex: 1, minHeight: 0 }}
    >
      {cycles.length === 0 ? (
        <div style={{ padding: 14, fontSize: 13, color: 'var(--fs-text-secondary)' }}>
          No cycles run yet.
        </div>
      ) : (
        <ul
          className="fs-agent-scroll"
          style={{ listStyle: 'none', margin: 0, padding: 0 }}
        >
          {cycles.map((c) => (
            <li
              key={c.id}
              style={{
                padding: '9px 14px',
                borderBottom: '1px solid var(--fs-border)',
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                fontFamily: MONO,
                fontSize: 12,
              }}
            >
              <span style={{ color: 'var(--fs-text-secondary)', width: 34 }}>
                #{c.id}
              </span>
              <span style={{ color: 'var(--fs-text-secondary)', width: 64 }}>
                {clockTime(c.startedAt)}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                {c.error ? (
                  <span style={{ color: 'var(--fs-negative)' }}>
                    error: {c.error.slice(0, 70)}
                  </span>
                ) : c.estimate ? (
                  <span>
                    forecast{' '}
                    <strong style={{ color: 'var(--fs-primary)' }}>
                      {formatUsd(c.estimate.pointEstimate)}
                    </strong>
                    <span style={{ color: 'var(--fs-text-secondary)' }}>
                      {' '}
                      · {c.sources.length} sources
                    </span>
                  </span>
                ) : (
                  <span style={{ color: 'var(--fs-text-secondary)' }}>running…</span>
                )}
              </span>
              {c.committed && (
                <span
                  style={{
                    color: 'var(--fs-positive)',
                    border: '1px solid var(--fs-positive)',
                    borderRadius: 4,
                    padding: '0 6px',
                    fontSize: 10,
                  }}
                >
                  TRADED #{c.positionId}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
