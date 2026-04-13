export interface UnifiedSearchResponse {
  issues?: Array<{ id: string; identifier: string; title: string; status: string; priority: string }>;
  projects?: Array<{ id: string; name: string; icon?: string; status: string }>;
  goals?: Array<{ id: string; title: string; description?: string }>;
  brain_dumps?: Array<{ id: string; content: string; processed: boolean; created_at: string }>;
  agents?: Array<{ id: string; name: string; runtime_mode: string }>;
  chats?: Array<{ id: string; title: string; updated_at: string }>;
}
