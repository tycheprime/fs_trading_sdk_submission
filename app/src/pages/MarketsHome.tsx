import { useMarkets } from '@functionspace/react';
import { MarketGrid } from '../agent/components/MarketGrid';
import { MONO } from '../agent/theme'; // meta labels only

export function MarketsHome() {
  const { markets, loading, error, refetch } = useMarkets({
    state: 'open',
    sortBy: 'totalVolume',
    sortOrder: 'desc',
    pollInterval: 60_000,
  });

  return (
    <div className="fs-markets-page">
      <header className="fs-markets-header">
        <div>
          <div className="fs-markets-brand">
            ORACLE <span className="fs-markets-accent">AGENT</span>
          </div>
          <p className="fs-markets-tagline">
            News-driven oracle for any open functionSPACE market: web search,
            structured belief curves (not yes/no), and payout preview without
            placing a trade.
          </p>
          <ul className="fs-markets-bullets">
            <li>Exa search every 20s; Claude runs only when new articles appear</li>
            <li>Gaussian, bimodal, range, and other shapes when the narrative fits</li>
            <li>Agent vs crowd consensus and hypothetical payout on the chart</li>
          </ul>
        </div>
        <div className="fs-markets-meta" style={{ fontFamily: MONO }}>
          {loading ? 'Loading markets…' : `${markets.length} open markets`}
        </div>
      </header>

      {error && (
        <div className="fs-markets-error" style={{ fontFamily: MONO }}>
          {error.message}
          <button type="button" className="fs-markets-retry" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      <MarketGrid markets={markets} loading={loading} />
    </div>
  );
}
