-- Shadow Mode: run tasks against a shadow model for comparison
CREATE TABLE shadow_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES agent_task_queue(id) ON DELETE CASCADE,
    shadow_model TEXT NOT NULL,
    primary_model TEXT NOT NULL,
    shadow_output TEXT,
    primary_output TEXT,
    shadow_cost_usd NUMERIC(10,6),
    primary_cost_usd NUMERIC(10,6),
    shadow_duration_ms INTEGER,
    primary_duration_ms INTEGER,
    quality_score INTEGER CHECK (quality_score IS NULL OR (quality_score BETWEEN 1 AND 5)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shadow_run_workspace ON shadow_run(workspace_id);
CREATE INDEX idx_shadow_run_task ON shadow_run(task_id);

CREATE TABLE shadow_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    shadow_model TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    sample_rate REAL NOT NULL DEFAULT 0.1 CHECK (sample_rate >= 0 AND sample_rate <= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, shadow_model)
);
