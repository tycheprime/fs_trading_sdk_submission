import type { ExaResult } from './types';

// exa.ai is reached through the Vite /exa dev proxy, which injects EXA_API_KEY
// server-side (see vite.config.ts). The browser never sees the key.

const SEARCH_QUERY =
  'Bitcoin BTC price forecast outlook and analyst predictions for end of 2026';

// Search exa.ai for recent Bitcoin price news that informs the agent's estimate.
export async function searchBitcoinNews(
  signal?: AbortSignal,
): Promise<ExaResult[]> {
  // Bias toward fresh coverage: only results published in the last 120 days.
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 120)
    .toISOString()
    .slice(0, 10);

  const res = await fetch('/exa/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal,
    body: JSON.stringify({
      query: SEARCH_QUERY,
      type: 'auto',
      numResults: 8,
      startPublishedDate: since,
      contents: { text: { maxCharacters: 800 } },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        'exa.ai rejected the request. Add a valid EXA_API_KEY to demo-app/.env.local and restart the dev server.',
      );
    }
    throw new Error(`exa.ai search failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const results: unknown[] = Array.isArray(data?.results) ? data.results : [];

  return results.map((raw): ExaResult => {
    const r = raw as Record<string, unknown>;
    return {
      title: typeof r.title === 'string' && r.title ? r.title : '(untitled)',
      url: typeof r.url === 'string' ? r.url : '',
      publishedDate:
        typeof r.publishedDate === 'string' ? r.publishedDate : null,
      text: typeof r.text === 'string' ? r.text.trim() : '',
    };
  });
}
