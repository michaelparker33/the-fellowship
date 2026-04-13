export type TriggerType = "webhook" | "db_change" | "agent_output" | "github_event";

export interface EventTrigger {
  id: string;
  workspace_id: string;
  name: string;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  agent_id: string;
  prompt_template: string;
  enabled: boolean;
  last_fired_at: string | null;
  fire_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateEventTriggerRequest {
  name: string;
  trigger_type: TriggerType;
  trigger_config?: Record<string, unknown>;
  agent_id: string;
  prompt_template: string;
  enabled?: boolean;
}

export interface UpdateEventTriggerRequest {
  name?: string;
  trigger_type?: TriggerType;
  trigger_config?: Record<string, unknown>;
  agent_id?: string;
  prompt_template?: string;
  enabled?: boolean;
}

export interface ListEventTriggersResponse {
  items: EventTrigger[];
  total: number;
}
