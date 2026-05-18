import { Outlet } from 'react-router-dom';
import { FunctionSpaceProvider } from '@functionspace/react';
import { agentApiBase } from './agent/agentApi';
import { agentTheme } from './agent/theme';

/**
 * functionSPACE API base URL.
 * - Production: prefer agent server `/fs-api` proxy (CORS) when VITE_AGENT_CACHE_URL is set.
 * - Local: `/fs-api` via Vite → agent server, or same-origin if no agent URL.
 * - Same-origin `/fs-api` on static Render only works if you add a `/fs-api/*` rewrite rule;
 *   otherwise the SPA returns index.html and JSON.parse throws on "<!DOCTYPE".
 */
function resolveFsBaseUrl(): string {
  const raw = (import.meta.env.VITE_FS_BASE_URL ?? '').trim().replace(/\/$/, '');
  const agentHost = agentApiBase();

  if ((!raw || raw === '/fs-api') && agentHost) {
    return `${agentHost}/fs-api`;
  }

  if (!raw || raw === '/fs-api') {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/fs-api`;
    }
    return 'http://localhost:8787/fs-api';
  }

  if (raw.startsWith('/')) {
    return `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}${raw}`;
  }

  return raw;
}

const config = {
  baseUrl: resolveFsBaseUrl(),
  autoAuthenticate: false,
};

export function AppLayout() {
  return (
    <FunctionSpaceProvider config={config} theme={agentTheme}>
      <Outlet />
    </FunctionSpaceProvider>
  );
}
