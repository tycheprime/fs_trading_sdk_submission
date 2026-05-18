import { Outlet } from 'react-router-dom';
import { FunctionSpaceProvider } from '@functionspace/react';
import { agentTheme } from './agent/theme';

/** Resolve functionSPACE API base; `/fs-api` uses same-origin proxy (CORS-safe on Render). */
function resolveFsBaseUrl(): string {
  const raw = (import.meta.env.VITE_FS_BASE_URL ?? '').trim().replace(/\/$/, '');
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
