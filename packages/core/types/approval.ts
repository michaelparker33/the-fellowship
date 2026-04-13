export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export type ApprovalRiskLevel = "low" | "medium" | "high" | "critical";
export type AutonomyLevel = "full" | "supervised" | "manual";

export interface DebateVote {
  agent_id: string;
  agent_name: string;
  verdict: "approve" | "reject";
  reasoning: string;
  created_at: string;
}

export interface Approval {
  id: string;
  workspace_id: string;
  issue_id: string | null;
  agent_id: string;
  action_type: string;
  autonomy_level: AutonomyLevel;
  status: ApprovalStatus;
  payload: Record<string, unknown>;
  risk_level: ApprovalRiskLevel;
  risk_score: number;
  contested_by: string | null;
  debate_notes: DebateVote[] | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  dry_run_result: DryRunResult | null;
  is_dry_run: boolean;
  created_at: string;
  updated_at: string;
}

export interface DryRunResult {
  approval_id: string;
  action_type: string;
  valid: boolean;
  preview: string;
  affected_items: string[];
  warnings: string[];
  errors: string[];
}

export interface ApprovalConfig {
  id: string;
  workspace_id: string;
  action_type: string;
  autonomy_level: AutonomyLevel;
  consecutive_approvals: number;
  auto_approve: boolean;
  require_dry_run: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateApprovalRequest {
  agent_id: string;
  action_type: string;
  autonomy_level: AutonomyLevel;
  payload?: Record<string, unknown>;
  risk_level?: ApprovalRiskLevel;
  risk_score?: number;
  issue_id?: string;
}

export interface DecideApprovalRequest {
  note?: string;
}

export interface ListApprovalsParams {
  status?: ApprovalStatus;
  risk_level?: ApprovalRiskLevel;
  action_type?: string;
  limit?: number;
  offset?: number;
}

export interface ListApprovalsResponse {
  items: Approval[];
  total: number;
}

export interface DecideApprovalResponse {
  approval: Approval;
  auto_approve_suggested: boolean;
}

export interface BatchApproveParams {
  approval_ids?: string[];
  max_risk_score?: number;
}

export interface BatchRejectParams {
  approval_ids: string[];
  reason?: string;
}

export interface BatchApproveResponse {
  approved: number;
  failed: number;
  errors: string[];
}

export interface BatchRejectResponse {
  rejected: number;
  failed: number;
  errors: string[];
}
