-- Weekly Digest: automated weekly summary of workspace activity
CREATE TABLE weekly_digest (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    content JSONB NOT NULL DEFAULT '{}',
    issue_id UUID REFERENCES issue(id) ON DELETE SET NULL,
    emailed_to TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_weekly_digest_workspace ON weekly_digest(workspace_id, period_end DESC);
