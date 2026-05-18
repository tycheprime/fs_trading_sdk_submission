import { useEffect, useState } from 'react';
import { useMarkets } from '@functionspace/react';
import { MarketGrid } from '../agent/components/MarketGrid';
import { MONO } from '../agent/theme';
import { BrandMark } from '../agent/brand';
import {
  fetchCacheStats,
  isRemoteSessionEnabled,
  syncAllLocalSessionsOnce,
  type CacheStats,
} from '../agent/remoteSession';

export function MarketsHome() {
  const { markets, loading, error, refetch } = useMarkets({
    state: 'open',
    sortBy: 'totalVolume',
    sortOrder: 'desc',
    pollInterval: 60_000,
  });

  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [syncedCount, setSyncedCount] = useState(0);

  useEffect(() => {
    if (!isRemoteSessionEnabled()) return;
    void (async () => {
      const n = await syncAllLocalSessionsOnce();
      if (n > 0) setSyncedCount(n);
      const stats = await fetchCacheStats();
      if (stats) setCacheStats(stats);
    })();
  }, []);

  const metaLine = loading
    ? 'Loading markets…'
    : `${markets.length} open markets`;

  const cacheLine =
    cacheStats && cacheStats.marketsWithForecasts > 0
      ? `${cacheStats.marketsWithForecasts} cached forecasts · ${cacheStats.totalForecasts} revisions in DB`
      : null;

  return (
    <div className="fs-markets-page">
      <header className="fs-markets-header">
        <div>
          <div className="fs-markets-brand">
            <BrandMark accentClassName="fs-markets-accent" />
          </div>
          <p className="fs-markets-tagline">
            News-driven forecasts for any open functionSPACE market: web search,
            structured belief curves (not yes/no), and payout preview without
            placing a trade.
          </p>
          <ul className="fs-markets-bullets">
            <li>Exa search every 5 minutes; Claude runs only when new articles appear</li>
            <li>Gaussian, bimodal, range, and other shapes when the narrative fits</li>
            <li>Agent vs crowd consensus and hypothetical payout on the chart</li>
            {isRemoteSessionEnabled() && (
              <li>Forecasts sync to Postgres so new visitors skip cold starts</li>
            )}
          </ul>
        </div>
        <div className="fs-markets-meta" style={{ fontFamily: MONO }}>
          <div>{metaLine}</div>
          {cacheLine && <div style={{ marginTop: 6, opacity: 0.85 }}>{cacheLine}</div>}
          {syncedCount > 0 && (
            <div style={{ marginTop: 4, color: 'var(--fs-positive)' }}>
              Uploaded {syncedCount} local session{syncedCount === 1 ? '' : 's'} to database
            </div>
          )}
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