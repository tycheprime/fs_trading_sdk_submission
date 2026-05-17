import { FunctionSpaceProvider } from '@functionspace/react';
import { AgentDashboard } from './agent/AgentDashboard';
import { agentTheme } from './agent/theme';
import './agent.css';

// Read-only config: the dashboard only reads market data, so it never
// authenticates -- there is no login and no trading.
const config = {
  baseUrl: import.meta.env.VITE_FS_BASE_URL,
  autoAuthenticate: false,
};

// Root of the BTC oracle viewer. One FunctionSpaceProvider wraps the whole
// tree; the custom UI is built entirely on @functionspace/react hooks.
export default function AgentApp() {
  return (
    <FunctionSpaceProvider config={config} theme={agentTheme}>
      <AgentDashboard />
    </FunctionSpaceProvider>
  );
}
