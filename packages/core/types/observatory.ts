// Memory Monitor
export interface MemoryEntry {
  category: string;
  text: string;
  char_count: number;
}

export interface MemoryProfile {
  name: string;
  entries: MemoryEntry[];
  total_chars: number;
  max_chars: number;
}

export interface MemoryState {
  profiles: MemoryProfile[];
  read_at: string;
}

// Corrections
export interface Correction {
  id: string;
  action_type: string;
  risk_level: string;
  decision_note: string;
  decided_at: string;
  agent_name: string;
  issue_title: string;
  severity: "critical" | "major" | "minor";
}

export interface CorrectionsState {
  corrections: Correction[];
  counts: { critical: number; major: number; minor: number };
  total: number;
}

// Patterns
export interface TaskCluster {
  cluster_label: string;
  issue_count: number;
  task_rate: number;
}

export interface RepeatedPrompt {
  title: string;
  occurrence_count: number;
  last_seen: string | null;
  could_be_skill: boolean;
}

export interface HeatmapCell {
  day_of_week: number;
  hour_of_day: number;
  task_count: number;
}

export interface SkillSuggestion {
  title: string;
  occurrence_count: number;
  last_seen: string;
}

export interface PatternsState {
  task_clusters: TaskCluster[];
  repeated_prompts: RepeatedPrompt[];
  heatmap: HeatmapCell[];
  skill_suggestions: SkillSuggestion[];
}

// Health
export interface APIKeyStatus {
  name: string;
  present: boolean;
  source: string;
}

export interface ServiceStatus {
  name: string;
  running: boolean;
  pid?: number;
  note?: string;
}

export interface DiskInfo {
  total_gb: number;
  used_gb: number;
  free_gb: number;
  used_percent: number;
}

export interface HealthState {
  api_keys: APIKeyStatus[];
  services: ServiceStatus[];
  disk: DiskInfo | null;
  memory_mb: Record<string, number>;
  go_version: string;
  os: string;
  read_at: string;
}

// Agent Profiles
export interface AgentProfile {
  id: string;
  name: string;
  status: string;
  model: string;
  provider: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  total_tokens: number;
  total_cost_usd: number;
  last_active: string;
}

// Sessions
export interface SessionEntry {
  task_id: string;
  issue_id: string;
  issue_title: string;
  agent_name: string;
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  total_tokens: number;
  cost_usd: number;
  model: string;
}

export interface DailySessionStat {
  day: string;
  task_count: number;
  total_tokens: number;
  total_cost_usd: number;
}

// Eisenhower
export type EisenhowerQuadrant = "do" | "schedule" | "delegate" | "eliminate";

export interface EisenhowerItem {
  id: string;
  identifier: string;
  title: string;
  priority: string;
  eisenhower_quadrant: EisenhowerQuadrant;
  assignee_id: string | null;
  assignee_type: string | null;
}

export interface EisenhowerMatrixResponse {
  items: EisenhowerItem[];
  counts: Record<EisenhowerQuadrant, number>;
}

// Goals
export interface Goal {
  id: string;
  workspace_id: string;
  title: string;
  description?: string;
  parent_goal_id?: string;
  created_at: string;
  updated_at: string;
}
