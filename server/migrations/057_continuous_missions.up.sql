CREATE TABLE mission (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','stopped')),
    total_tasks INT NOT NULL DEFAULT 0,
    completed_tasks INT NOT NULL DEFAULT 0,
    failed_tasks INT NOT NULL DEFAULT 0,
    skipped_tasks INT NOT NULL DEFAULT 0,
    current_task_id UUID REFERENCES issue(id) ON DELETE SET NULL,
    started_by UUID NOT NULL REFERENCES "user"(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    stopped_at TIMESTAMPTZ,
    error_log JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mission_workspace ON mission(workspace_id, created_at DESC);
CREATE INDEX idx_mission_project ON mission(project_id);
CREATE INDEX idx_mission_active ON mission(workspace_id) WHERE status IN ('pending','running');
