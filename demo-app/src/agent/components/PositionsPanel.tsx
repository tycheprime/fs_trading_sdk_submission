import type { CSSProperties } from 'react';
import { useAuth, usePositions } from '@functionspace/react';
import { Panel } from './Panel';
import { MONO } from '../theme';
import { formatUsd } from '../format';

// The agent's live positions on the market, fetched via the SDK and polled.
export function PositionsPanel({
  marketId,
  currentPositionId,
}: {
  marketId: string | number;
  currentPositionId: string | number | null;
}) {
  const { user, isAuthenticated } = useAuth();
  const { positions, loading } = usePositions(marketId, user?.username, {
    pollInterval: 8000,
  });

  const open = (positions ?? []).filter((p) => p.status === 'open');

  return (
    <Panel
      title="Agent Positions"
      right={
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--fs-text-secondary)' }}>
          {isAuthenticated ? `${open.length} open` : 'signed out'}
        </span>
      }
      bodyStyle={{ padding: 0 }}
    >
      {!isAuthenticated ? (
        <div style={{ padding: 14, fontSize: 13, color: 'var(--fs-text-secondary)' }}>
          Log in to see and place positions.
        </div>
      ) : loading && open.length === 0 ? (
        <div style={{ padding: 14, fontSize: 13, color: 'var(--fs-text-secondary)' }}>
          Loading positions…
        </div>
      ) : open.length === 0 ? (
        <div style={{ padding: 14, fontSize: 13, color: 'var(--fs-text-secondary)' }}>
          No open positions. Arm auto-trade or commit a belief to take one.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO }}>
          <thead>
            <tr style={{ fontSize: 10, color: 'var(--fs-text-secondary)', letterSpacing: '0.08em' }}>
              <th style={cell('left')}>POSITION</th>
              <th style={cell('right')}>PREDICTION</th>
              <th style={cell('right')}>COLLATERAL</th>
              <th style={cell('right')}>CLAIMS</th>
            </tr>
          </thead>
          <tbody>
            {open.map((p) => {
              const isCurrent = String(p.positionId) === String(currentPositionId);
              return (
                <tr
                  key={String(p.positionId)}
                  style={{
                    fontSize: 12,
                    borderTop: '1px solid var(--fs-border)',
                    background: isCurrent ? 'var(--fs-surface-hover, #1a212c)' : 'transparent',
                  }}
                >
                  <td style={cell('left')}>
                    #{p.positionId}
                    {isCurrent && (
                      <span style={{ color: 'var(--fs-primary)', marginLeft: 6 }}>
                        ● live
                      </span>
                    )}
                  </td>
                  <td style={cell('right')}>
                    {p.prediction != null ? formatUsd(p.prediction) : '—'}
                  </td>
                  <td style={cell('right')}>{formatUsd(p.collateral)}</td>
                  <td style={cell('right')}>{p.claims.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function cell(align: 'left' | 'right'): CSSProperties {
  return { textAlign: align, padding: '8px 14px' };
}
