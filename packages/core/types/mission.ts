export type MissionStatus = "pending" | "running" | "completed" | "failed" | "stopped";

export interface Mission {
  id: string;
  workspace_id: string;
  project_id: string;
  status: MissionStatus;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  skipped_tasks: number;
  current_task_id: string | null;
  started_by: string;
  started_at: string;
  completed_at: string | null;
  stopped_at: string | null;
  progress: number;
  created_at: string;
}

export interface ListMissionsResponse {
  missions: Mission[];
  total: number;
}

export interface ListMissionsParams {
  project_id?: string;
  limit?: number;
  offset?: number;
}
