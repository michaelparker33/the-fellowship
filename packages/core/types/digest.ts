export interface DigestContent {
  tasks_completed: number;
  tasks_failed: number;
  approvals_processed: number;
  issues_created: number;
  issues_completed: number;
}

export interface WeeklyDigest {
  id: string;
  workspace_id: string;
  period_start: string;
  period_end: string;
  content: DigestContent;
  issue_id: string | null;
  emailed_to: string[];
  created_at: string;
}
