import { Panel } from './Panel';
import { MONO } from '../theme';
import type { ExaResult } from '../types';

// The exa.ai search results that fed the agent's most recent forecast.
export function SourcesPanel({ sources }: { sources: ExaResult[] }) {
  return (
    <Panel
      title="exa.ai Signal"
      right={
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--fs-text-secondary)' }}>
          {sources.length} sources
        </span>
      }
      bodyStyle={{ maxHeight: 240, overflowY: 'auto', padding: 0 }}
    >
      {sources.length === 0 ? (
        <div style={{ padding: 14, fontSize: 13, color: 'var(--fs-text-secondary)' }}>
          No search results yet. The agent pulls fresh Bitcoin news from exa.ai
          at the start of each cycle.
        </div>
      ) : (
        <ul
          className="fs-agent-scroll"
          style={{ listStyle: 'none', margin: 0, padding: 0 }}
        >
          {sources.map((s, i) => (
            <li
              key={i}
              style={{
                padding: '10px 14px',
                borderBottom:
                  i < sources.length - 1 ? '1px solid var(--fs-border)' : 'none',
              }}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    color: 'var(--fs-text-secondary)',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div style={{ minWidth: 0 }}>
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="fs-agent-link"
                      style={{ fontSize: 13, fontWeight: 600 }}
                    >
                      {s.title}
                    </a>
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{s.title}</span>
                  )}
                  {s.publishedDate && (
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 10,
                        color: 'var(--fs-text-secondary)',
                        marginLeft: 6,
                      }}
                    >
                      {s.publishedDate.slice(0, 10)}
                    </span>
                  )}
                  {s.text && (
                    <p
                      style={{
                        margin: '3px 0 0',
                        fontSize: 12,
                        lineHeight: 1.45,
                        color: 'var(--fs-text-secondary)',
                      }}
                    >
                      {s.text.slice(0, 160)}
                      {s.text.length > 160 ? '…' : ''}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
