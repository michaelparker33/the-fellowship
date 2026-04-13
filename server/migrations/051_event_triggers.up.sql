-- Event-Driven Triggers: fire agent tasks from webhooks, db changes, agent output, or GitHub events
CREATE TABLE event_trigger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('webhook','db_change','agent_output','github_event')),
    trigger_config JSONB NOT NULL DEFAULT '{}',
    agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
    prompt_template TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_fired_at TIMESTAMPTZ,
    fire_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_trigger_workspace ON event_trigger(workspace_id);
CREATE INDEX idx_event_trigger_enabled ON event_trigger(workspace_id) WHERE enabled = TRUE;
