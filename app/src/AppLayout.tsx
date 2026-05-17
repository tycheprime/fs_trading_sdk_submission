import { Outlet } from 'react-router-dom';
import { FunctionSpaceProvider } from '@functionspace/react';
import { agentTheme } from './agent/theme';

const config = {
  baseUrl: import.meta.env.VITE_FS_BASE_URL,
  autoAuthenticate: false,
};

export function AppLayout() {
  return (
    <FunctionSpaceProvider config={config} theme={agentTheme}>
      <Outlet />
    </FunctionSpaceProvider>
  );
}
