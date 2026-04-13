export type ScheduledTaskStatus = "success" | "failed" | "running";

export interface ScheduledTask {
  id: string;
  workspace_id: string;
  name: string;
  cron_expression: string;
  timezone: string;
  agent_id: string;
  prompt: string;
  model_override: string | null;
  enabled: boolean;
  last_run_at: string | null;
  last_status: ScheduledTaskStatus | null;
  last_duration_ms: number | null;
  run_count: number;
  created_at: string;
  updated_at: string;
}

export interface ScheduledTaskRun {
  id: string;
  scheduled_task_id: string;
  issue_id: string | null;
  status: ScheduledTaskStatus;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export interface CreateScheduledTaskRequest {
  name: string;
  cron_expression: string;
  timezone?: string;
  agent_id: string;
  prompt: string;
  model_override?: string;
  enabled?: boolean;
}

export interface UpdateScheduledTaskRequest {
  name?: string;
  cron_expression?: string;
  timezone?: string;
  agent_id?: string;
  prompt?: string;
  model_override?: string;
}
