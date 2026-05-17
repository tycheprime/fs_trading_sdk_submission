import { useAgent } from './useAgent';
import { BTC_MARKET_ID, MONO } from './theme';
import { Header } from './components/Header';
import { Panel } from './components/Panel';
import { MarketChart } from './components/MarketChart';
import { AgentPanel } from './components/AgentPanel';
import { ActivityLog } from './components/ActivityLog';
import { SourcesPanel } from './components/SourcesPanel';

// The full agent terminal: header, distribution chart + cycle log on the
// left, agent controls + signal on the right.
export function AgentDashboard() {
  const agent = useAgent(BTC_MARKET_ID);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        minWidth: 1000,
      }}
    >
      <Header status={agent.status} market={agent.market} />

      <main
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 396px',
          gap: 14,
          padding: 16,
        }}
      >
        {/* Left column: distribution chart and cycle log. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            minHeight: 0,
          }}
        >
          <Panel title="Probability Distribution — BTC/USD on 2026-12-31">
            {agent.market ? (
              <MarketChart
                market={agent.market}
                beliefBuild={agent.beliefBuild}
              />
            ) : (
              <div
                style={{
                  height: 320,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--fs-text-secondary)',
                  fontFamily: MONO,
                  fontSize: 13,
                }}
              >
                Loading market #{BTC_MARKET_ID} …
              </div>
            )}
          </Panel>
          <ActivityLog cycles={agent.cycles} />
        </div>

        {/* Right column: agent controls and exa signal. */}
        <div
          className="fs-agent-scroll fs-agent-rail"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          <AgentPanel agent={agent} />
          <SourcesPanel sources={agent.allSources} />
        </div>
      </main>
    </div>
  );
}
