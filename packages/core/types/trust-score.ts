export interface TrustScore {
  id: string;
  workspace_id: string;
  agent_id: string;
  agent_name: string;
  action_type: string;
  total_approvals: number;
  total_rejections: number;
  total_edits: number;
  consecutive_clean_approvals: number;
  approval_rate: number;
  promotion_suggested: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrustScoresResponse {
  items: TrustScore[];
}
