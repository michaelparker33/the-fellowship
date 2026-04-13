-- The Council: Approval workflow tables

CREATE TABLE approval (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    issue_id        UUID REFERENCES issue(id) ON DELETE SET NULL,
    agent_id        UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
    action_type     TEXT NOT NULL,
    autonomy_level  TEXT NOT NULL CHECK (autonomy_level IN ('full', 'supervised', 'manual')),
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    payload         JSONB NOT NULL DEFAULT '{}',
    risk_level      TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    decided_by      UUID REFERENCES "user"(id) ON DELETE SET NULL,
    decided_at      TIMESTAMPTZ,
    decision_note   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_workspace_status ON approval(workspace_id, status);
CREATE INDEX idx_approval_workspace_created ON approval(workspace_id, created_at DESC);

CREATE TABLE approval_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    action_type     TEXT NOT NULL,
    autonomy_level  TEXT NOT NULL CHECK (autonomy_level IN ('full', 'supervised', 'manual')),
    consecutive_approvals INTEGER NOT NULL DEFAULT 0,
    auto_approve    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, action_type)
);
