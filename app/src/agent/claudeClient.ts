import Anthropic from '@anthropic-ai/sdk';
import { agentApiUrl } from './agentApi';
import type { AgentDistributionType, AgentEstimate, ExaResult } from './types';
import { AGENT_DISTRIBUTION_TYPES } from './distributions';

const claude = new Anthropic({
  apiKey: 'injected-by-proxy',
  baseURL: agentApiUrl('/claude'),
  dangerouslyAllowBrowser: true,
  maxRetries: 1,
});

const MODEL = 'claude-sonnet-4-6';

function buildSystemPrompt(ctx: InterpretContext): string {
  const distList = ctx.allowedDistributions.join(', ');
  const expiry = ctx.expiresAt
    ? `Expected resolution around ${ctx.expiresAt.slice(0, 10)}.`
    : 'Resolution date is unspecified.';

  return `You are a calibrated forecasting agent for functionSPACE prediction markets.

functionSPACE markets trade beliefs as probability curves over a numerical outcome range — not simple yes/no contracts. Traders express where they think the outcome will land and how confident they are. Your job is to read web sources and submit a belief shape the protocol can turn into a curve.

Market: "${ctx.marketTitle}"
Outcome range: ${ctx.lowerBound} to ${ctx.upperBound} ${ctx.xAxisUnits}
${expiry}

You keep a running forecast in this conversation. On later turns you only see NEW sources and decide whether to revise.

Distribution types (pick the one that best matches your view):
- gaussian: default bell curve around point_estimate (most forecasts)
- spike: extremely tight peak — you are very sure of one level
- range: flat belief between low and high — outcome likely in a band, not a point
- bimodal: two distinct scenarios (set secondary_peak and peak_weight 0–1 on the higher peak)
- leftskew: longer tail below point_estimate (downside risk)
- rightskew: longer tail above point_estimate (upside risk)
- dip: low probability near point_estimate, higher at edges (rare; use only if evidence supports it)
- uniform: no information — spread doubt across the whole range (rare)

Allowed distribution_type values: ${distList}

Each response:
1. Weigh all evidence in this conversation.
2. Call submit_market_forecast with distribution_type, point_estimate, low, high, and optional bimodal fields.
3. Set changed_mind true only if you materially change type or parameters versus your prior submission.
4. One or two sentence rationale.

Rules:
- point_estimate, low, high must lie within [${ctx.lowerBound}, ${ctx.upperBound}].
- low < point_estimate < high (except uniform may use full range for low/high).
- Widen the interval when sources are weak.

Conclude with submit_market_forecast exactly once.`;
}

function buildEstimateTool(allowed: AgentDistributionType[]): Anthropic.Tool {
  return {
    name: 'submit_market_forecast',
    description: 'Submit a belief shape for this functionSPACE market.',
    input_schema: {
      type: 'object',
      properties: {
        distribution_type: {
          type: 'string',
          enum: allowed,
          description: 'Belief shape over the market outcome range.',
        },
        point_estimate: {
          type: 'number',
          description: `Best estimate in ${'outcome units'}.`,
        },
        low: {
          type: 'number',
          description: 'Low end of 90% interval or range low.',
        },
        high: {
          type: 'number',
          description: 'High end of 90% interval or range high.',
        },
        secondary_peak: {
          type: 'number',
          description: 'Second peak location (bimodal only).',
        },
        peak_weight: {
          type: 'number',
          description: 'Weight on secondary_peak, 0 to 1 (bimodal only).',
        },
        changed_mind: {
          type: 'boolean',
          description:
            'True if materially changed from prior forecast in this conversation.',
        },
        confidence: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
        },
        rationale: { type: 'string' },
        key_sources: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: [
        'distribution_type',
        'point_estimate',
        'low',
        'high',
        'changed_mind',
        'confidence',
        'rationale',
      ],
    },
  };
}

export interface InterpretContext {
  todayISO: string;
  consensusMean: number;
  lowerBound: number;
  upperBound: number;
  marketTitle: string;
  xAxisUnits: string;
  expiresAt: string | null;
  allowedDistributions: AgentDistributionType[];
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

Market consensus mean is about ${Math.round(ctx.consensusMean).toLocaleString()} ${ctx.xAxisUnits}.`;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parseDistributionType(
  raw: unknown,
  allowed: AgentDistributionType[],
): AgentDistributionType {
  if (
    typeof raw === 'string' &&
    (allowed as string[]).includes(raw)
  ) {
    return raw as AgentDistributionType;
  }
  return 'gaussian';
}

function parseEstimate(
  raw: Record<string, unknown>,
  ctx: InterpretContext,
): AgentEstimate {
  const { lowerBound, upperBound } = ctx;
  const point = num(raw.point_estimate, ctx.consensusMean);
  let low = num(raw.low, point * 0.85);
  let high = num(raw.high, point * 1.15);
  if (low > high) [low, high] = [high, low];
  low = Math.max(lowerBound, low);
  high = Math.min(upperBound, high);

  const distributionType = parseDistributionType(
    raw.distribution_type,
    ctx.allowedDistributions,
  );

  const estimate: AgentEstimate = {
    distributionType,
    pointEstimate: Math.min(Math.max(point, lowerBound), upperBound),
    low,
    high,
    changedMind: raw.changed_mind === true,
    confidence:
      raw.confidence === 'low' || raw.confidence === 'high'
        ? raw.confidence
        : 'medium',
    rationale:
      typeof raw.rationale === 'string' && raw.rationale
        ? raw.rationale
        : 'No rationale returned.',
    keySources: Array.isArray(raw.key_sources)
      ? raw.key_sources.filter((s): s is string => typeof s === 'string')
      : [],
  };

  if (distributionType === 'bimodal') {
    estimate.secondaryPeak = Math.min(
      Math.max(num(raw.secondary_peak, high), lowerBound),
      upperBound,
    );
    estimate.peakWeight = Math.min(
      Math.max(num(raw.peak_weight, 0.5), 0),
      1,
    );
  }

  return estimate;
}

async function runForecastTurn(
  messages: Anthropic.MessageParam[],
  ctx: InterpretContext,
): Promise<{ estimate: AgentEstimate; assistantMessage: Anthropic.Message }> {
  const tool = buildEstimateTool(ctx.allowedDistributions);
  let response: Anthropic.Message;
  try {
    response = await claude.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: buildSystemPrompt(ctx),
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [tool],
      tool_choice: { type: 'auto', disable_parallel_tool_use: true },
      messages,
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new Error(
        'The Claude API rejected the request. Set ANTHROPIC_API_KEY on the agent server (local: app/.env.local; Render: cache web service env).',
      );
    }
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Claude API error ${err.status}: ${err.message}`);
    }
    const detail = err instanceof Error ? err.message : String(err);
    if (/connection error/i.test(detail)) {
      throw new Error(
        'Claude request blocked (often CORS). Redeploy the agent API after updating ALLOWED_ORIGINS / CORS.',
      );
    }
    throw new Error(`Claude request failed: ${detail}`);
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === 'tool_use' && block.name === 'submit_market_forecast',
  );
  if (!toolUse) {
    throw new Error('Claude did not return a structured forecast.');
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

function priorForecastSummary(prior: AgentEstimate, units: string): string {
  const lines = [
    `- distribution_type: ${prior.distributionType}`,
    `- point_estimate: ${Math.round(prior.pointEstimate).toLocaleString()} ${units}`,
    `- low / high: ${Math.round(prior.low).toLocaleString()} – ${Math.round(prior.high).toLocaleString()} ${units}`,
    `- rationale: ${prior.rationale}`,
  ];
  if (prior.distributionType === 'bimodal' && prior.secondaryPeak != null) {
    lines.push(
      `- secondary_peak: ${Math.round(prior.secondaryPeak).toLocaleString()}, peak_weight: ${prior.peakWeight ?? 0.5}`,
    );
  }
  return lines.join('\n');
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

First forecast for this market. Read these sources (${sources.length}) and submit your belief shape.

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

New articles (${newSources.length}). Prior forecast:
${priorForecastSummary(priorEstimate, ctx.xAxisUnits)}

Read only NEW sources. Update only if they materially change your view; otherwise repeat the same parameters and set changed_mind to false.

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

export { AGENT_DISTRIBUTION_TYPES };
