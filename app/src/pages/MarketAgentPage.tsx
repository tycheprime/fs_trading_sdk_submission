import { Navigate, useParams } from 'react-router-dom';
import { MarketsLink } from '../agent/components/MarketsLink';
import { useMarket } from '@functionspace/react';
import { AgentDashboard } from '../agent/AgentDashboard';
import { MONO } from '../agent/theme';

export function MarketAgentPage() {
  const { marketId } = useParams<{ marketId: string }>();
  if (!marketId) {
    return <Navigate to="/" replace />;
  }

  const { market, loading, error } = useMarket(marketId);

  if (error && !loading) {
    return (
      <div className="fs-markets-page" style={{ fontFamily: MONO, padding: 24 }}>
        <p style={{ color: 'var(--fs-negative)' }}>{error.message}</p>
        <MarketsLink className="fs-agent-link">← All markets</MarketsLink>
      </div>
    );
  }

  if (loading && !market) {
    return (
      <div
        className="fs-markets-page"
        style={{
          fontFamily: MONO,
          padding: 24,
          color: 'var(--fs-text-secondary)',
        }}
      >
        Loading market #{marketId}…
      </div>
    );
  }

  return <AgentDashboard marketId={marketId} />;
}
