import https from 'node:https';
import { agentLog } from './log.mjs';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
]);

/** Never forward client API keys; the server injects real keys upstream. */
const STRIP_FROM_CLIENT = new Set(['x-api-key', ...HOP_BY_HOP]);

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const STRIP_FROM_UPSTREAM = new Set([
  ...HOP_BY_HOP,
  'access-control-allow-origin',
  'access-control-allow-headers',
  'access-control-allow-methods',
  'access-control-allow-credentials',
  'access-control-expose-headers',
  'access-control-max-age',
]);

function filterResponseHeaders(headers) {
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (STRIP_FROM_UPSTREAM.has(lower)) continue;
    out[key] = value;
  }
  return out;
}

function shouldStripClientHeader(lower) {
  if (STRIP_FROM_CLIENT.has(lower)) return true;
  // Anthropic SDK telemetry; not needed upstream and triggers strict CORS preflights.
  if (lower.startsWith('x-stainless-')) return true;
  return false;
}

function forwardHeaders(req, extra = {}) {
  const out = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (shouldStripClientHeader(lower)) continue;
    if (lower === 'content-length' && req.method === 'GET') continue;
    out[key] = value;
  }
  return { ...out, ...extra };
}

/**
 * Forward a request to an upstream HTTPS API (Exa, Anthropic).
 */
export async function proxyToUpstream(req, res, corsHeaders, config) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const upstreamPath = config.mapPath(url.pathname, url.search);
  const label = config.label || config.hostname;
  const started = Date.now();
  const clientKey = req.headers['x-api-key'];
  const hadClientKey =
    typeof clientKey === 'string' && clientKey.length > 0 && clientKey !== '(none)';

  agentLog('info', 'proxy_start', {
    proxy: label,
    method: req.method,
    path: url.pathname,
    origin: req.headers.origin || null,
    clientKeyStripped: hadClientKey,
  });

  const body =
    req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);

  const headers = forwardHeaders(req, config.extraHeaders(req.headers));

  await new Promise((resolve) => {
    const upstream = https.request(
      {
        hostname: config.hostname,
        port: 443,
        method: req.method,
        path: upstreamPath,
        headers,
      },
      (upstreamRes) => {
        const status = upstreamRes.statusCode || 502;
        agentLog(status >= 400 ? 'warn' : 'info', 'proxy_done', {
          proxy: label,
          method: req.method,
          path: url.pathname,
          upstreamStatus: status,
          ms: Date.now() - started,
        });
        res.writeHead(status, {
          ...filterResponseHeaders(upstreamRes.headers),
          ...corsHeaders,
        });
        upstreamRes.pipe(res);
        upstreamRes.on('end', resolve);
      },
    );

    upstream.on('error', (err) => {
      agentLog('error', 'proxy_upstream_error', {
        proxy: label,
        method: req.method,
        path: url.pathname,
        error: err.message,
        ms: Date.now() - started,
      });
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json', ...corsHeaders });
        res.end(JSON.stringify({ error: err.message }));
      } else {
        res.end();
      }
      resolve();
    });

    if (body?.length) upstream.write(body);
    upstream.end();
  });
}

export function exaProxyConfig() {
  const apiKey = (process.env.EXA_API_KEY || '').trim();
  return {
    label: 'exa',
    hostname: 'api.exa.ai',
    mapPath: (pathname, search) => {
      const path = pathname.replace(/^\/exa/, '') || '/';
      return `${path}${search}`;
    },
    extraHeaders: () => (apiKey ? { 'x-api-key': apiKey } : {}),
  };
}

export function claudeProxyConfig() {
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  return {
    label: 'claude',
    hostname: 'api.anthropic.com',
    mapPath: (pathname, search) => {
      const path = pathname.replace(/^\/claude/, '') || '/';
      return `${path}${search}`;
    },
    extraHeaders: () => {
      const h = {
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      };
      if (apiKey) h['x-api-key'] = apiKey;
      return h;
    },
  };
}

/** functionSPACE engine API — browser calls agent server to avoid CORS on fs-engine-api. */
export function fsEngineProxyConfig() {
  const base = (process.env.FS_ENGINE_API_URL || 'https://fs-engine-api.onrender.com').trim();
  const upstream = new URL(base);
  return {
    label: 'fs-engine',
    hostname: upstream.hostname,
    mapPath: (pathname, search) => {
      const path = pathname.replace(/^\/fs-api/, '') || '/';
      return `${path}${search}`;
    },
    extraHeaders: () => ({}),
  };
}
