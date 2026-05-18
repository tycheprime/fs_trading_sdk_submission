import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// TychePrime x FunctionSPACE calls exa.ai and the Claude API. Both are reached through dev-server
// proxies so the API keys stay server-side and never reach the browser bundle.
// Keys are read from app/.env.local (gitignored). See README_AGENT.md.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const agentCacheUrl = env.VITE_AGENT_CACHE_URL || '/agent-cache';

  return {
    define: {
      'import.meta.env.VITE_AGENT_CACHE_URL': JSON.stringify(agentCacheUrl),
    },
    plugins: [react()],
    server: {
      port: 3000,
      strictPort: true,
      proxy: {
        // exa.ai search: browser hits /exa/search, proxy forwards to api.exa.ai
        '/exa': {
          target: 'https://api.exa.ai',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/exa/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (env.EXA_API_KEY) {
                proxyReq.setHeader('x-api-key', env.EXA_API_KEY);
              }
            });
          },
        },
        // Claude API: the Anthropic SDK is pointed at /claude, proxy forwards
        // to api.anthropic.com and injects the key + version headers.
        '/claude': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/claude/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (env.ANTHROPIC_API_KEY) {
                proxyReq.setHeader('x-api-key', env.ANTHROPIC_API_KEY);
              }
              proxyReq.setHeader('anthropic-version', '2023-06-01');
            });
          },
        },
        '/agent-cache': {
          target: env.VITE_AGENT_CACHE_TARGET || 'http://localhost:8787',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/agent-cache/, ''),
        },
      },
    },
    resolve: {
      alias: {
        '@functionspace/core': path.resolve(__dirname, '../packages/core/src'),
        '@functionspace/react': path.resolve(__dirname, '../packages/react/src'),
        '@functionspace/ui': path.resolve(__dirname, '../packages/ui/src'),
      },
    },
  };
});
