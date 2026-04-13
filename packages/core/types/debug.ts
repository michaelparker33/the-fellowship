export interface TaskFork {
  id: string;
  workspace_id: string;
  source_task_id: string;
  forked_task_id: string | null;
  fork_at_step: number;
  modified_output: string | null;
  status: "pending" | "running" | "completed" | "failed";
  created_by: string;
  created_at: string;
}

export interface TimelineStep {
  step: number;
  role: string;
  content: string;
  time: string;
}

export interface DebugTimelineResponse {
  steps: TimelineStep[];
  forks: TaskFork[];
  task_id: string;
}

export interface CreateForkRequest {
  fork_at_step: number;
  modified_output?: string;
}

export interface ListForksResponse {
  items: TaskFork[];
  total: number;
}
