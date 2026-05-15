import { FunctionSpaceProvider } from '@functionspace/react';
import { AgentDashboard } from './agent/AgentDashboard';
import { agentTheme } from './agent/theme';
import './agent.css';

// Guest-by-default config: no username/password. The user authenticates
// through the PasswordlessAuthWidget in the header, per the SDK auth rule.
const config = {
  baseUrl: import.meta.env.VITE_FS_BASE_URL,
  autoAuthenticate: false,
};

// Root of the BTC market-maker agent. One FunctionSpaceProvider wraps the
// whole tree; the custom UI is built entirely on @functionspace/react hooks.
export default function AgentApp() {
  return (
    <FunctionSpaceProvider config={config} theme={agentTheme}>
      <AgentDashboard />
    </FunctionSpaceProvider>
  );
}
