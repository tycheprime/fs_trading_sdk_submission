import type { MarketState } from '@functionspace/core';
import { MarketsLink } from './MarketsLink';
import { StatusPill } from './StatusPill';
import type { AgentStatus } from '../types';
import { BrandMark } from '../brand';

interface HeaderProps {
  status: AgentStatus;
  market: MarketState | null;
}

export function Header({ status, market }: HeaderProps) {
  return (
    <header className="fs-agent-header">
      <div className="fs-agent-header-left">
        <div className="fs-agent-header-titles">
          <MarketsLink className="fs-header-brand">
            <BrandMark />
          </MarketsLink>
          <div className="fs-header-subtitle">
            <MarketsLink className="fs-agent-link fs-header-back">
              ← Markets
            </MarketsLink>
            <span className="fs-header-market-title" title={market?.title}>
              {market?.title ?? 'Loading market…'}
            </span>
          </div>
        </div>
      </div>

      <StatusPill status={status} />
    </header>
  );
}
