/**
 * Tycheprime Agent cache API — Postgres (Render) or local JSON files.
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
  proxyToUpstream,
} from './proxy.mjs';
import { agentLog } from './log.mjs';

loadAppEnv();

const PORT = Number(process.env.PORT || 8787);
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  'http://localhost:3000,https://fs-trading-sdk.onrender.com'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(origin) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin);
  const h = {
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access',
  };
  if (allowed) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Vary'] = 'Origin';
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

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  const baseHeaders = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    send(res, 204, '', baseHeaders);
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const reqId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    if (url.pathname === '/debug/status' && req.method === 'GET') {
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
      if (!process.env.EXA_API_KEY?.trim()) {
        send(res, 503, { error: 'EXA_API_KEY not configured on agent server' }, baseHeaders);
        return;
      }
      await proxyToUpstream(req, res, baseHeaders, exaProxyConfig());
      return;
    }

    if (url.pathname.startsWith('/claude/')) {
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
      const stats = await getGlobalStats();
      send(res, 200, { stats }, baseHeaders);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/sessions') {
      const summaries = await listSummaries();
      send(res, 200, { summaries }, baseHeaders);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/sessions/bulk') {
      const body = await readJsonBody(req);
      const sessions = Array.isArray(body.sessions) ? body.sessions : [];
      const result = await bulkWriteSessions(sessions);
      send(res, 200, { ok: true, ...result }, baseHeaders);
      return;
    }

    const historyMatch = url.pathname.match(/^\/sessions\/([^/]+)\/forecasts$/);
    if (historyMatch && req.method === 'GET') {
      const marketId = decodeURIComponent(historyMatch[1]);
      const limit = Number(url.searchParams.get('limit') || 30);
      const forecasts = await listForecastHistory(marketId, limit);
      send(res, 200, { forecasts }, baseHeaders);
      return;
    }

    const sessionMatch = url.pathname.match(/^\/sessions\/([^/]+)$/);
    if (sessionMatch) {
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
  agentLog('info', 'server_start', {
    port: PORT,
    storage: storageMode(),
    exaKeyConfigured: Boolean(process.env.EXA_API_KEY?.trim()),
    anthropicKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    allowedOrigins: ALLOWED_ORIGINS,
  });
});
