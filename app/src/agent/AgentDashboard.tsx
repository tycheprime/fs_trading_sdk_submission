import { useMemo, useState } from 'react';
import { useAgent } from './useAgent';
import { MONO } from './theme';
import { Header } from './components/Header';
import { Panel } from './components/Panel';
import { MarketChart } from './components/MarketChart';
import { AgentPanel } from './components/AgentPanel';
import { ActivityLog } from './components/ActivityLog';
import { SourcesPanel } from './components/SourcesPanel';
import { AgentVsCrowdPanel } from './components/AgentVsCrowdPanel';
import { PayoutPreviewPanel } from './components/PayoutPreviewPanel';
import {
  CycleReplaySelect,
  resolveChartBeliefBuild,
} from './components/CycleReplaySelect';

// The full agent terminal: header, distribution chart + cycle log on the
// left, agent controls + signal on the right.
export function AgentDashboard({ marketId }: { marketId: string | number }) {
  const agent = useAgent(marketId);
  const [replayCycleId, setReplayCycleId] = useState<number | null>(null);

  const chartBeliefBuild = useMemo(
    () => resolveChartBeliefBuild(agent.beliefBuild, agent.cycles, replayCycleId),
    [agent.beliefBuild, agent.cycles, replayCycleId],
  );

  const units = agent.market?.xAxisUnits ?? '';

  return (
    <div
      className="fs-agent-page"
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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            minHeight: 0,
          }}
        >
          <Panel
            title={
              agent.market
                ? `Probability Distribution — ${agent.market.title}`
                : 'Probability Distribution'
            }
            right={
              <CycleReplaySelect
                cycles={agent.cycles}
                replayCycleId={replayCycleId}
                onReplayCycleId={setReplayCycleId}
              />
            }
          >
            {agent.market ? (
              <MarketChart
                market={agent.market}
                beliefBuild={chartBeliefBuild}
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
                Loading market #{marketId} …
              </div>
            )}
          </Panel>
          <ActivityLog
            cycles={agent.cycles}
            units={units}
            fromDatabase={agent.loadedFromDb}
          />
        </div>

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
          <AgentVsCrowdPanel
            market={agent.market}
            estimate={agent.forecast}
            beliefBuild={agent.beliefBuild}
          />
          <AgentPanel agent={agent} />
          <PayoutPreviewPanel
            marketId={marketId}
            beliefBuild={agent.beliefBuild}
            units={units}
          />
          <SourcesPanel sources={agent.allSources} />
        </div>
      </main>
    </div>
  );
}
