-- Track per-agent per-action-type approval history for trust scoring.
CREATE TABLE trust_score (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id                UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    agent_id                    UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
    action_type                 TEXT NOT NULL,
    total_approvals             INTEGER NOT NULL DEFAULT 0,
    total_rejections            INTEGER NOT NULL DEFAULT 0,
    total_edits                 INTEGER NOT NULL DEFAULT 0,
    consecutive_clean_approvals INTEGER NOT NULL DEFAULT 0,
    promotion_suggested         BOOLEAN NOT NULL DEFAULT FALSE,
    promotion_dismissed         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, agent_id, action_type)
);

CREATE INDEX idx_trust_score_workspace ON trust_score(workspace_id);
CREATE INDEX idx_trust_score_agent ON trust_score(agent_id);
