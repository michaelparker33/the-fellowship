-- The Watch: Cron scheduling tables

CREATE TABLE scheduled_task (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    cron_expression     TEXT NOT NULL,
    timezone            TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    agent_id            UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
    prompt              TEXT NOT NULL,
    model_override      TEXT,
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    last_run_at         TIMESTAMPTZ,
    last_status         TEXT CHECK (last_status IN ('success', 'failed', 'running')),
    last_duration_ms    INTEGER,
    run_count           INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_task_workspace ON scheduled_task(workspace_id);
CREATE INDEX idx_scheduled_task_enabled ON scheduled_task(enabled) WHERE enabled = TRUE;

CREATE TABLE scheduled_task_run (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheduled_task_id   UUID NOT NULL REFERENCES scheduled_task(id) ON DELETE CASCADE,
    issue_id            UUID REFERENCES issue(id) ON DELETE SET NULL,
    status              TEXT NOT NULL CHECK (status IN ('success', 'failed', 'running')),
    duration_ms         INTEGER,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_task_run_task_id ON scheduled_task_run(scheduled_task_id, created_at DESC);
