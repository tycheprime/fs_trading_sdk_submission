/**
 * TychePrime x FunctionSPACE API — Postgres (Render) or local JSON files.
 */
import http from 'node:http';
import { loadAppEnv, storageMode } from './db.mjs';
import {
  bulkWriteSessions,
  getGlobalStats,
  listForecastHistory,
  listSummaries,
  readSession,
  writeSession,
} from './store.mjs';
import {
  claudeProxyConfig,
  exaProxyConfig,
  fsEngineProxyConfig,
  proxyToUpstream,
} from './proxy.mjs';
import { agentLog } from './log.mjs';
import {
  AGENT_SECRET_HEADER,
  assertProductionAuthConfig,
  isAgentAuthEnforced,
  verifyAgentAuth,
} from './auth.mjs';

loadAppEnv();
assertProductionAuthConfig();

const PORT = Number(process.env.PORT || 8787);
const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'https://fs-trading-sdk.onrender.com',
  'https://tycheprime-functionspace.onrender.com',
].join(',');

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(origin, req) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin);
  const requested = req?.headers['access-control-request-headers'];
  const h = {
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': requested
      ? requested
      : `Content-Type, ${AGENT_SECRET_HEADER}, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access`,
  };
  if (allowed) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Vary'] = 'Origin, Access-Control-Request-Headers';
  }
  return h;
}

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(data);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function rejectUnlessAuthed(req, res, baseHeaders) {
  const auth = verifyAgentAuth(req);
  if (auth.ok) return true;
  send(res, auth.status, { error: auth.error }, baseHeaders);
  return false;
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  const baseHeaders = corsHeaders(origin, req);

  if (req.method === 'OPTIONS') {
    send(res, 204, '', baseHeaders);
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const reqId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    if (url.pathname === '/debug/status' && req.method === 'GET') {
      if (!rejectUnlessAuthed(req, res, baseHeaders)) return;
      send(
        res,
        200,
        {
          ok: true,
          storage: storageMode(),
          exaKeyConfigured: Boolean(process.env.EXA_API_KEY?.trim()),
          anthropicKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
          allowedOrigins: ALLOWED_ORIGINS,
        },
        baseHeaders,
      );
      return;
    }

    if (url.pathname.startsWith('/exa/')) {
      if (!rejectUnlessAuthed(req, res, baseHeaders)) return;
      if (!process.env.EXA_API_KEY?.trim()) {
        send(res, 503, { error: 'EXA_API_KEY not configured on agent server' }, baseHeaders);
        return;
      }
      await proxyToUpstream(req, res, baseHeaders, exaProxyConfig());
      return;
    }

    if (url.pathname.startsWith('/claude/')) {
      if (!rejectUnlessAuthed(req, res, baseHeaders)) return;
      if (!process.env.ANTHROPIC_API_KEY?.trim()) {
        send(
          res,
          503,
          { error: 'ANTHROPIC_API_KEY not configured on agent server' },
          baseHeaders,
        );
        return;
      }
      await proxyToUpstream(req, res, baseHeaders, claudeProxyConfig());
      return;
    }

    if (url.pathname.startsWith('/fs-api/')) {
      await proxyToUpstream(req, res, baseHeaders, fsEngineProxyConfig());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      send(
        res,
        200,
        {
          ok: true,
          storage: storageMode(),
          exaKeyConfigured: Boolean(process.env.EXA_API_KEY?.trim()),
          anthropicKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
        },
        baseHeaders,
      );
      return;
    }

    if (req.method === 'GET' && url.pathname === '/stats') {
      if (!rejectUnlessAuthed(req, res, baseHeaders)) return;
      const stats = await getGlobalStats();
      send(res, 200, { stats }, baseHeaders);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/sessions') {
      if (!rejectUnlessAuthed(req, res, baseHeaders)) return;
      const summaries = await listSummaries();
      send(res, 200, { summaries }, baseHeaders);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/sessions/bulk') {
      if (!rejectUnlessAuthed(req, res, baseHeaders)) return;
      const body = await readJsonBody(req);
      const sessions = Array.isArray(body.sessions) ? body.sessions : [];
      const result = await bulkWriteSessions(sessions);
      send(res, 200, { ok: true, ...result }, baseHeaders);
      return;
    }

    const historyMatch = url.pathname.match(/^\/sessions\/([^/]+)\/forecasts$/);
    if (historyMatch && req.method === 'GET') {
      if (!rejectUnlessAuthed(req, res, baseHeaders)) return;
      const marketId = decodeURIComponent(historyMatch[1]);
      const limit = Number(url.searchParams.get('limit') || 30);
      const forecasts = await listForecastHistory(marketId, limit);
      send(res, 200, { forecasts }, baseHeaders);
      return;
    }

    const sessionMatch = url.pathname.match(/^\/sessions\/([^/]+)$/);
    if (sessionMatch) {
      if (!rejectUnlessAuthed(req, res, baseHeaders)) return;
      const marketId = decodeURIComponent(sessionMatch[1]);
      if (req.method === 'GET') {
        const row = await readSession(marketId);
        if (!row) {
          send(res, 404, { error: 'not_found' }, baseHeaders);
          return;
        }
        send(res, 200, row, baseHeaders);
        return;
      }
      if (req.method === 'PUT') {
        const body = await readJsonBody(req);
        if (!body.session || String(body.session.marketId) !== String(marketId)) {
          send(res, 400, { error: 'invalid_session' }, baseHeaders);
          return;
        }
        await writeSession(marketId, body.session, {
          newSourceCount: body.newSourceCount ?? 0,
          skipped: body.skipped ?? false,
          recordForecast: body.recordForecast !== false,
        });
        send(res, 200, { ok: true }, baseHeaders);
        return;
      }
    }

    agentLog('info', 'request_404', {
      reqId,
      method: req.method,
      path: url.pathname,
      origin: origin || null,
    });
    send(res, 404, { error: 'not_found' }, baseHeaders);
  } catch (err) {
    agentLog('error', 'request_error', {
      reqId,
      method: req.method,
      path: url.pathname,
      error: err instanceof Error ? err.message : String(err),
    });
    send(
      res,
      500,
      { error: err instanceof Error ? err.message : String(err) },
      baseHeaders,
    );
  }
});

server.listen(PORT, () => {
  if (!isAgentAuthEnforced()) {
    agentLog('warn', 'agent_auth_disabled', {
      hint: 'Set AGENT_API_SECRET on the agent API and VITE_AGENT_API_SECRET on the static site before a public deploy.',
    });
  }
  agentLog('info', 'server_start', {
    port: PORT,
    storage: storageMode(),
    agentAuthEnforced: isAgentAuthEnforced(),
    exaKeyConfigured: Boolean(process.env.EXA_API_KEY?.trim()),
    anthropicKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    allowedOrigins: ALLOWED_ORIGINS,
  });
});
