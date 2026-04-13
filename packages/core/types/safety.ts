export interface SafetyConfig {
  id: string;
  workspace_id: string;
  daily_spend_limit_cents: number;
  monthly_spend_limit_cents: number;
  max_concurrent_tasks: number;
  emergency_stop: boolean;
  emergency_stop_at: string | null;
  emergency_stop_by: string | null;
  created_at: string;
  updated_at: string;
}
