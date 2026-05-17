import type { FSThemeInput } from '@functionspace/react';

// Casual sans for all UI copy (headings, body, controls).
export const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// Monospace for numeric readouts, labels, and chart axes only.
export const MONO =
  "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, Menlo, monospace";

// Custom dark "trading terminal" theme built from the 9 required SDK tokens.
// Bitcoin orange as the primary, a cool blue as the agent/signal accent.
export const agentTheme: FSThemeInput = {
  primary: '#f7931a',
  accent: '#4d9fff',
  positive: '#3fb950',
  negative: '#f85149',
  background: '#080a0e',
  surface: '#11161f',
  text: '#e6edf3',
  textSecondary: '#8b949e',
  border: '#222b38',
  fontFamily: SANS,
};
