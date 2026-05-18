// Shared types for the TychePrime x FunctionSPACE app.

export type AgentDistributionType =
  | 'gaussian'
  | 'spike'
  | 'range'
  | 'bimodal'
  | 'leftskew'
  | 'rightskew'
  | 'dip'
  | 'uniform';

// A single search result returned by exa.ai.
export interface ExaResult {
  title: string;
  url: string;
  publishedDate: string | null;
  text: string;
}

// The structured forecast Claude produces from the exa.ai results.
export interface AgentEstimate {
  distributionType: AgentDistributionType;
  pointEstimate: number; // best estimate / primary peak in outcome units
  low: number; // 90% CI low, or range low, in outcome units
  high: number; // 90% CI high, or range high
  secondaryPeak?: number; // second peak for bimodal
  peakWeight?: number; // 0–1 weight on secondaryPeak for bimodal
  changedMind: boolean;
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
  keySources: string[];
}

// How the agent turned an estimate into a belief vector.
export interface BeliefBuild {
  belief: number[];
  distributionType: AgentDistributionType;
  label: string;
  center: number;
  spread: number;
}

// Lifecycle phase of a single agent cycle.
export type AgentStatus =
  | 'idle'
  | 'searching'
  | 'thinking'
  | 'previewing'
  | 'error';

// One full pass of the agent loop, kept for the activity log.
export interface CycleRecord {
  id: number;
  startedAt: number;
  finishedAt: number | null;
  sources: ExaResult[];
  newSourceCount: number;
  skipped: boolean; // true when exa returned no new URLs — forecast unchanged
  estimate: AgentEstimate | null;
  beliefBuild: BeliefBuild | null;
  error: string | null;
}
