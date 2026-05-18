import { Panel } from './Panel';
import { MONO } from '../theme';
import { DISTRIBUTION_LABELS } from '../belief';
import { formatOutcome, clockTime } from '../format';
import type { CycleRecord } from '../types';

// Chronological log of every agent cycle: forecast and belief.
export function ActivityLog({
  cycles,
  units = '',
  fromDatabase = false,
}: {
  cycles: CycleRecord[];
  units?: string;
  fromDatabase?: boolean;
}) {
  return (
    <Panel
      title="Cycle Log"
      right={
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--fs-text-secondary)' }}>
          {cycles.length} cycles
          {fromDatabase ? ' · from DB' : ''}
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
                ) : c.skipped ? (
                  <span style={{ color: 'var(--fs-text-secondary)' }}>
                    no new sources · forecast held at{' '}
                    <strong style={{ color: 'var(--fs-primary)' }}>
                      {formatOutcome(c.estimate!.pointEstimate, units)}
                    </strong>
                  </span>
                ) : c.estimate ? (
                  <span>
                    <strong style={{ color: 'var(--fs-primary)' }}>
                      {DISTRIBUTION_LABELS[c.estimate.distributionType]}{' '}
                      {formatOutcome(c.estimate.pointEstimate, units)}
                    </strong>
                    <span style={{ color: 'var(--fs-text-secondary)' }}>
                      {' '}
                      · +{c.newSourceCount} new · {c.sources.length} total
                      {c.estimate.changedMind ? ' · changed' : ' · held'}
                    </span>
                  </span>
                ) : (
                  <span style={{ color: 'var(--fs-text-secondary)' }}>running…</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
