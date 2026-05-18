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
            Pick any open market. An agent reads the news, sketches a full belief
            curve, and shows where it breaks from the crowd. No wallet required.
          </p>
          <ul className="fs-markets-bullets">
            <li>Exa polls the web every 5 minutes; Claude revises only when headlines change</li>
            <li>Curves, not coin flips: Gaussian, bimodal, range, and more</li>
            <li>Agent vs consensus on one chart</li>
            {/* {isRemoteSessionEnabled() && (
              <li>Shared forecast memory in Postgres—open a market and skip the cold start</li>
            )} */}
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