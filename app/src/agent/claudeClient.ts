import Anthropic from '@anthropic-ai/sdk';
import type { ExaResult, AgentEstimate } from './types';

const claude = new Anthropic({
  apiKey: 'injected-by-vite-proxy',
  baseURL:
    (typeof window !== 'undefined' ? window.location.origin : '') + '/claude',
  dangerouslyAllowBrowser: true,
  maxRetries: 1,
});

const MODEL = 'claude-opus-4-7';

const SYSTEM_PROMPT = `You are a calibrated forecasting agent acting as an informed market maker.

Your market: the FunctionSpace prediction market "Bitcoin Spot Price (USD, December 31 2026)". It settles to the real BTC/USD spot price on 2026-12-31. The market's outcome space runs from 0 to 200000 USD.

You keep a running forecast for this market. On the first turn you read an initial batch of web sources. On later turns you receive only NEW sources and decide whether your prior point estimate and confidence interval still hold.

Each response:
1. Weigh all evidence in this conversation.
2. Submit point_estimate with a 90% confidence interval (low, high).
3. Set changed_mind true only if you materially update the forecast versus your prior submission in this conversation.
4. Give a one or two sentence rationale.

Calibration rules:
- point_estimate and interval must lie within 0 to 200000 USD.
- low < point_estimate < high.
- Widen the interval when sources are weak or conflicting.
- Do not anchor on round numbers.

Conclude by calling submit_btc_estimate exactly once. Do not ask questions.`;

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
      changed_mind: {
        type: 'boolean',
        description:
          'True if the forecast changed materially from your prior submission. False on first forecast or if unchanged.',
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
        description: 'Titles of the sources that most informed this update.',
      },
    },
    required: [
      'point_estimate',
      'low',
      'high',
      'changed_mind',
      'confidence',
      'rationale',
    ],
  },
};

export interface InterpretContext {
  todayISO: string;
  consensusMean: number;
  lowerBound: number;
  upperBound: number;
}

export interface ForecastTurnResult {
  estimate: AgentEstimate;
  messages: Anthropic.MessageParam[];
}

function formatSources(sources: ExaResult[]): string {
  return sources
    .map((s, i) => {
      const date = s.publishedDate ? ` (published ${s.publishedDate})` : '';
      const body = s.text
        ? `\n   ${s.text.replace(/\s+/g, ' ').slice(0, 600)}`
        : '';
      return `[${i + 1}] ${s.title}${date}\n   ${s.url}${body}`;
    })
    .join('\n\n');
}

function marketContextBlock(ctx: InterpretContext): string {
  return `Today is ${ctx.todayISO}.

The FunctionSpace market consensus currently estimates the 2026-12-31 BTC price at about $${Math.round(
    ctx.consensusMean,
  ).toLocaleString()}.`;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parseEstimate(
  raw: Record<string, unknown>,
  ctx: InterpretContext,
): AgentEstimate {
  const { lowerBound, upperBound } = ctx;
  const point = num(raw.point_estimate, ctx.consensusMean);
  let low = num(raw.low, point * 0.6);
  let high = num(raw.high, point * 1.4);
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
    changedMind: raw.changed_mind === true,
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

async function runForecastTurn(
  messages: Anthropic.MessageParam[],
  ctx: InterpretContext,
): Promise<{ estimate: AgentEstimate; assistantMessage: Anthropic.Message }> {
  let response: Anthropic.Message;
  try {
    response = await claude.messages.create({
      model: MODEL,
      max_tokens: 4000,
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
      messages,
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new Error(
        'The Claude API rejected the request. Add a valid ANTHROPIC_API_KEY to app/.env.local and restart the dev server.',
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

  return {
    estimate: parseEstimate(toolUse.input as Record<string, unknown>, ctx),
    assistantMessage: response,
  };
}

function appendTurn(
  priorMessages: Anthropic.MessageParam[],
  userText: string,
  assistant: Anthropic.Message,
  toolUseId: string,
): Anthropic.MessageParam[] {
  return [
    ...priorMessages,
    { role: 'user', content: userText },
    { role: 'assistant', content: assistant.content },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: 'Forecast recorded.',
        },
      ],
    },
  ];
}

export async function runInitialForecast(
  sources: ExaResult[],
  ctx: InterpretContext,
  priorMessages: Anthropic.MessageParam[] = [],
): Promise<ForecastTurnResult> {
  if (sources.length === 0) {
    throw new Error('No search results to interpret.');
  }

  const userText = `${marketContextBlock(ctx)}

This is your first forecast for this market. Read these web sources (${sources.length} articles) and submit your forecast.

${formatSources(sources)}`;

  const messages: Anthropic.MessageParam[] = [
    ...priorMessages,
    { role: 'user', content: userText },
  ];

  const { estimate, assistantMessage } = await runForecastTurn(messages, ctx);
  estimate.changedMind = true;

  const toolUse = assistantMessage.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  )!;

  return {
    estimate,
    messages: appendTurn(priorMessages, userText, assistantMessage, toolUse.id),
  };
}

export async function runRevisionForecast(
  priorMessages: Anthropic.MessageParam[],
  newSources: ExaResult[],
  priorEstimate: AgentEstimate,
  ctx: InterpretContext,
): Promise<ForecastTurnResult> {
  if (newSources.length === 0) {
    throw new Error('No new sources to interpret.');
  }

  const userText = `${marketContextBlock(ctx)}

New articles (${newSources.length}). Your prior forecast in this conversation:
- point_estimate: $${Math.round(priorEstimate.pointEstimate).toLocaleString()}
- 90% interval: $${Math.round(priorEstimate.low).toLocaleString()} – $${Math.round(priorEstimate.high).toLocaleString()}
- rationale: ${priorEstimate.rationale}

Read only the NEW sources below. Update the forecast only if they materially change your view; otherwise repeat the same numbers and set changed_mind to false.

${formatSources(newSources)}`;

  const messages: Anthropic.MessageParam[] = [
    ...priorMessages,
    { role: 'user', content: userText },
  ];

  const { estimate, assistantMessage } = await runForecastTurn(messages, ctx);
  const toolUse = assistantMessage.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  )!;

  return {
    estimate,
    messages: appendTurn(priorMessages, userText, assistantMessage, toolUse.id),
  };
}
