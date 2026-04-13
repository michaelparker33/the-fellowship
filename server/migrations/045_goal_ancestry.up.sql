-- Goal Ancestry (F7): task → project → company mission
CREATE TABLE goal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    parent_goal_id UUID REFERENCES goal(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_goal_workspace ON goal(workspace_id);
CREATE INDEX idx_goal_parent ON goal(parent_goal_id);

ALTER TABLE issue ADD COLUMN goal_id UUID REFERENCES goal(id) ON DELETE SET NULL;
CREATE INDEX idx_issue_goal ON issue(goal_id);
