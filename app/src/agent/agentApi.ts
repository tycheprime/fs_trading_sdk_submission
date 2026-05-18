/** Base URL for the agent backend (session cache + Exa + Claude proxies). */
export function agentApiBase(): string {
  const raw = import.meta.env.VITE_AGENT_CACHE_URL?.replace(/\/$/, '') ?? '';
  if (!raw || raw.startsWith('/')) return '';
  if (!/^https?:\/\//i.test(raw)) return `https://${raw}`;
  return raw;
}

export function agentApiUrl(path: string): string {
  const base = agentApiBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  if (base) return `${base}${p}`;
  if (typeof window !== 'undefined') return `${window.location.origin}${p}`;
  return p;
}
