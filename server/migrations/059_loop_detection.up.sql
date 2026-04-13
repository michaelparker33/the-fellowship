-- Loop detection: track consecutive failures per issue for escalation
CREATE TABLE loop_detection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES issue(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
    consecutive_failures INT NOT NULL DEFAULT 0,
    failure_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    escalation_status TEXT NOT NULL DEFAULT 'none' CHECK (escalation_status IN ('none','escalated','resolved')),
    escalation_decision TEXT CHECK (escalation_decision IN ('retry_different','skip','stop')),
    decided_by UUID REFERENCES "user"(id),
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(issue_id, agent_id)
);
CREATE INDEX idx_loop_detection_workspace ON loop_detection(workspace_id);
CREATE INDEX idx_loop_detection_escalated ON loop_detection(workspace_id) WHERE escalation_status = 'escalated';
