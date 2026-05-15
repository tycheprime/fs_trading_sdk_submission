// Shared types for the BTC market-maker agent.

// A single search result returned by exa.ai.
export interface ExaResult {
  title: string;
  url: string;
  publishedDate: string | null;
  text: string;
}

// The structured forecast Claude produces from the exa.ai results.
export interface AgentEstimate {
  pointEstimate: number; // best estimate of BTC USD price on Dec 31 2026
  low: number; // low end of the 90% confidence interval
  high: number; // high end of the 90% confidence interval
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
  keySources: string[]; // titles of the sources that drove the estimate
}

// How the agent turned an estimate into a belief vector.
export interface BeliefBuild {
  belief: number[]; // normalized belief vector, length numBuckets + 2
  center: number; // gaussian center, in USD
  spread: number; // gaussian spread (sigma), in USD
}

// Lifecycle phase of a single agent cycle.
export type AgentStatus =
  | 'idle'
  | 'searching'
  | 'thinking'
  | 'previewing'
  | 'committing'
  | 'error';

// One full pass of the agent loop, kept for the activity log.
export interface CycleRecord {
  id: number;
  startedAt: number;
  finishedAt: number | null;
  sources: ExaResult[];
  estimate: AgentEstimate | null;
  beliefBuild: BeliefBuild | null;
  committed: boolean; // true if a trade was placed this cycle
  positionId: string | number | null;
  error: string | null;
}
