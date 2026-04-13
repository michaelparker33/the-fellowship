export interface Achievement {
  id: string;
  workspace_id: string;
  achievement_key: string;
  unlocked_at: string;
  metadata: Record<string, unknown> | null;
}
