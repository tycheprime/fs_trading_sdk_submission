import { agentApiUrl } from './agentApi';
import type { ExaResult } from './types';

export async function searchMarketNews(
  marketTitle: string,
  signal?: AbortSignal,
): Promise<ExaResult[]> {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 120)
    .toISOString()
    .slice(0, 10);

  const query = `Latest news, data, and expert forecasts about: ${marketTitle}. Focus on information relevant to predicting the market outcome.`;

  const res = await fetch(agentApiUrl('/exa/search'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal,
    body: JSON.stringify({
      query,
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
        'exa.ai rejected the request. Set EXA_API_KEY on the agent server (local: app/.env.local; Render: cache web service env).',
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
