import Anthropic from '@anthropic-ai/sdk';
import type { ExaResult, AgentEstimate } from './types';

// The Claude API is reached through the Vite /claude dev proxy, which injects
// ANTHROPIC_API_KEY server-side (see vite.config.ts). The SDK runs in the
// browser pointed at that proxy; the real key never enters the bundle.
const claude = new Anthropic({
  apiKey: 'injected-by-vite-proxy', // placeholder; proxy overwrites x-api-key
  baseURL:
    (typeof window !== 'undefined' ? window.location.origin : '') + '/claude',
  dangerouslyAllowBrowser: true,
  maxRetries: 1,
});

const MODEL = 'claude-opus-4-7';

// Stable system prompt -- frozen content first so prompt caching can take hold.
// Volatile context (date, consensus, search results) goes in the user message.
const SYSTEM_PROMPT = `You are a calibrated forecasting agent acting as an informed market maker.

Your market: the FunctionSpace prediction market "Bitcoin Spot Price (USD, December 31 2026)". It settles to the real BTC/USD spot price on 2026-12-31. The market's outcome space runs from 0 to 200000 USD.

Each cycle you are given recent Bitcoin news gathered from the web. Your job:
1. Read the sources and weigh them. Recent, specific, quantitative sources outrank vague or stale ones.
2. Produce a single best point estimate for the BTC/USD spot price on 2026-12-31.
3. Produce a 90% confidence interval (low, high) around that estimate. Be honest: if the sources are thin or conflicting, widen the interval.
4. State a one or two sentence rationale grounded in the sources.

Calibration rules:
- The point estimate and interval must lie within 0 to 200000 USD.
- low < point_estimate < high.
- Do not anchor on round numbers. Let the evidence move you.
- If the sources barely mention a 2026 price, say so in the rationale and use a wide interval.

Conclude every response by calling the submit_btc_estimate tool exactly once with your final numbers. Do not ask questions.`;

// Single tool the model calls to return its structured forecast.
const ESTIMATE_TOOL: Anthropic.Tool = {
  name: 'submit_btc_estimate',
  description:
    "Submit the agent's structured forecast for the BTC/USD spot price on 2026-12-31.",
  input_schema: {
    type: 'object',
    properties: {
      point_estimate: {
        type: 'number',
        description: 'Best estimate of the BTC/USD spot price on 2026-12-31.',
      },
      low: {
        type: 'number',
        description: 'Low end of the 90% confidence interval, in USD.',
      },
      high: {
        type: 'number',
        description: 'High end of the 90% confidence interval, in USD.',
      },
      confidence: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'How much the available sources constrain the estimate.',
      },
      rationale: {
        type: 'string',
        description: 'One or two sentences explaining the estimate.',
      },
      key_sources: {
        type: 'array',
        items: { type: 'string' },
        description: 'Titles of the sources that most informed the estimate.',
      },
    },
    required: ['point_estimate', 'low', 'high', 'confidence', 'rationale'],
  },
};

interface InterpretContext {
  todayISO: string;
  consensusMean: number;
  lowerBound: number;
  upperBound: number;
}

function buildUserMessage(sources: ExaResult[], ctx: InterpretContext): string {
  const lines = sources.map((s, i) => {
    const date = s.publishedDate ? ` (published ${s.publishedDate})` : '';
    const body = s.text ? `\n   ${s.text.replace(/\s+/g, ' ').slice(0, 600)}` : '';
    return `[${i + 1}] ${s.title}${date}${body}`;
  });

  return `Today is ${ctx.todayISO}.

The FunctionSpace market consensus currently estimates the 2026-12-31 BTC price at about $${Math.round(
    ctx.consensusMean,
  ).toLocaleString()}.

Recent Bitcoin news from the web (${sources.length} sources):

${lines.join('\n\n')}

Weigh these sources and submit your forecast for the BTC/USD spot price on 2026-12-31.`;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

// Ask Claude to read the exa.ai results and return a structured BTC estimate.
export async function interpretToEstimate(
  sources: ExaResult[],
  ctx: InterpretContext,
): Promise<AgentEstimate> {
  if (sources.length === 0) {
    throw new Error('No search results to interpret.');
  }

  let response: Anthropic.Message;
  try {
    response = await claude.messages.create({
      model: MODEL,
      max_tokens: 4000,
      // Adaptive thinking: Claude decides how much to reason about the sources.
      thinking: { type: 'adaptive' },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [ESTIMATE_TOOL],
      tool_choice: { type: 'auto', disable_parallel_tool_use: true },
      messages: [{ role: 'user', content: buildUserMessage(sources, ctx) }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new Error(
        'The Claude API rejected the request. Add a valid ANTHROPIC_API_KEY to demo-app/.env.local and restart the dev server.',
      );
    }
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Claude API error ${err.status}: ${err.message}`);
    }
    throw err;
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === 'tool_use' && block.name === 'submit_btc_estimate',
  );
  if (!toolUse) {
    throw new Error('Claude did not return a structured estimate.');
  }

  const raw = toolUse.input as Record<string, unknown>;
  const { lowerBound, upperBound } = ctx;
  const point = num(raw.point_estimate, ctx.consensusMean);
  let low = num(raw.low, point * 0.6);
  let high = num(raw.high, point * 1.4);
  // Keep the interval ordered and inside the market bounds.
  if (low > high) [low, high] = [high, low];
  low = Math.max(lowerBound, low);
  high = Math.min(upperBound, high);

  const confidence =
    raw.confidence === 'low' || raw.confidence === 'high'
      ? raw.confidence
      : 'medium';

  return {
    pointEstimate: Math.min(Math.max(point, lowerBound), upperBound),
    low,
    high,
    confidence,
    rationale:
      typeof raw.rationale === 'string' && raw.rationale
        ? raw.rationale
        : 'No rationale returned.',
    keySources: Array.isArray(raw.key_sources)
      ? raw.key_sources.filter((s): s is string => typeof s === 'string')
      : [],
  };
}
