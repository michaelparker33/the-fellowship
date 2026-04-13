export interface LoopDetection {
  id: string;
  workspace_id: string;
  issue_id: string;
  agent_id: string;
  consecutive_failures: number;
  failure_history: Array<{ reason: string; timestamp: string; task_id: string }>;
  escalation_status: "none" | "escalated" | "resolved";
  escalation_decision: "retry_different" | "skip" | "stop" | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export type EscalationDecision = "retry_different" | "skip" | "stop";
