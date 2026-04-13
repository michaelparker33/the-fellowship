CREATE TABLE brain_dump (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false,
    converted_issue_id UUID REFERENCES issue(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES "user"(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_brain_dump_workspace ON brain_dump(workspace_id, created_at DESC);
CREATE INDEX idx_brain_dump_unprocessed ON brain_dump(workspace_id) WHERE processed = false;
