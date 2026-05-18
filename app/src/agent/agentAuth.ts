/** Headers for the TychePrime agent API (shared secret, not functionSPACE login). */
export function agentAuthHeaders(): Record<string, string> {
  const secret = import.meta.env.VITE_AGENT_API_SECRET?.trim();
  if (!secret) return {};
  return { 'X-Agent-Secret': secret };
}
