// Formatting helpers for the agent UI.

export function formatUsd(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function formatOutcome(n: number, units: string): string {
  const u = units.trim();
  if (u === 'USD' || u === '$') return formatUsd(n);
  return (
    Math.round(n).toLocaleString('en-US') + (u ? ` ${u}` : '')
  );
}

// Compact USD: $1.2k, $145k, $1.4M
export function formatUsdShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000) return '$' + Math.round(n / 1000) + 'k';
  return '$' + Math.round(n);
}

// "12s ago", "4m ago", "2h ago"
export function timeAgo(ts: number): string {
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 60) return sec + 's ago';
  if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
  return Math.floor(sec / 3600) + 'h ago';
}

export function formatDensity(y: number): string {
  if (!Number.isFinite(y) || y === 0) return '0';
  if (y < 1e-4) return y.toExponential(2);
  if (y < 1) return y.toFixed(5);
  return y.toFixed(3);
}

export function formatProb(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
