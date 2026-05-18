import { timingSafeEqual } from 'node:crypto';
import { agentLog } from './log.mjs';

export const AGENT_SECRET_HEADER = 'x-agent-secret';

export function getAgentApiSecret() {
  return (process.env.AGENT_API_SECRET || '').trim();
}

/** When a secret is configured, every route except GET /health requires it. */
export function isAgentAuthEnforced() {
  return getAgentApiSecret().length > 0;
}

export function verifyAgentAuth(req) {
  if (!isAgentAuthEnforced()) {
    return { ok: true };
  }
  const expected = getAgentApiSecret();
  const provided = req.headers[AGENT_SECRET_HEADER];
  const given =
    typeof provided === 'string'
      ? provided.trim()
      : Array.isArray(provided)
        ? (provided[0] || '').trim()
        : '';
  if (!given) {
    return { ok: false, status: 401, error: 'missing_agent_secret' };
  }
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 403, error: 'invalid_agent_secret' };
  }
  return { ok: true };
}

export function assertProductionAuthConfig() {
  const isProd =
    process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  if (!isProd) return;

  const hasUpstreamKeys = Boolean(
    process.env.EXA_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim(),
  );
  if (hasUpstreamKeys && !isAgentAuthEnforced()) {
    agentLog('error', 'startup_missing_agent_secret', {
      hint: 'Set AGENT_API_SECRET on the agent API when EXA_API_KEY or ANTHROPIC_API_KEY is set in production.',
    });
    process.exit(1);
  }
}
