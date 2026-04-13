export interface BrainDump {
  id: string;
  workspace_id: string;
  content: string;
  processed: boolean;
  converted_issue_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}
