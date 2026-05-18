import https from 'node:https';

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

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function filterResponseHeaders(headers) {
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    out[key] = value;
  }
  return out;
}

function forwardHeaders(req, extra = {}) {
  const out = { ...extra };
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) continue;
    if (lower === 'content-length' && req.method === 'GET') continue;
    out[key] = value;
  }
  return out;
}

/**
 * Forward a request to an upstream HTTPS API (Exa, Anthropic).
 */
export async function proxyToUpstream(req, res, corsHeaders, config) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const upstreamPath = config.mapPath(url.pathname, url.search);
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
        res.writeHead(upstreamRes.statusCode || 502, {
          ...corsHeaders,
          ...filterResponseHeaders(upstreamRes.headers),
        });
        upstreamRes.pipe(res);
        upstreamRes.on('end', resolve);
      },
    );

    upstream.on('error', (err) => {
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
    hostname: 'api.anthropic.com',
    mapPath: (pathname, search) => {
      const path = pathname.replace(/^\/claude/, '') || '/';
      return `${path}${search}`;
    },
    extraHeaders: () => {
      const h = { 'anthropic-version': '2023-06-01' };
      if (apiKey) h['x-api-key'] = apiKey;
      return h;
    },
  };
}
