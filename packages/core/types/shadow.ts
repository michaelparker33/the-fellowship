export interface ShadowRun {
  id: string;
  workspace_id: string;
  task_id: string;
  shadow_model: string;
  primary_model: string;
  shadow_output: string | null;
  primary_output: string | null;
  shadow_cost_usd: string | null;
  primary_cost_usd: string | null;
  shadow_duration_ms: number | null;
  primary_duration_ms: number | null;
  quality_score: number | null;
  created_at: string;
}

export interface ShadowConfig {
  id: string;
  workspace_id: string;
  shadow_model: string;
  enabled: boolean;
  sample_rate: number;
  created_at: string;
  updated_at: string;
}

export interface ShadowStats {
  total_runs: number;
  avg_quality: number;
  avg_shadow_cost: number;
  avg_primary_cost: number;
  avg_shadow_duration: number;
  avg_primary_duration: number;
}

export interface CreateShadowConfigRequest {
  shadow_model: string;
  enabled: boolean;
  sample_rate: number;
}

export interface ListShadowRunsResponse {
  items: ShadowRun[];
  total: number;
}
