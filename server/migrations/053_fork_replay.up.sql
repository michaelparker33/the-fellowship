-- Fork-and-Replay Debugger: fork agent task executions at any step
CREATE TABLE task_fork (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    source_task_id UUID NOT NULL REFERENCES agent_task_queue(id) ON DELETE CASCADE,
    forked_task_id UUID REFERENCES agent_task_queue(id) ON DELETE SET NULL,
    fork_at_step INTEGER NOT NULL,
    modified_output TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
    created_by UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_fork_workspace ON task_fork(workspace_id);
CREATE INDEX idx_task_fork_source ON task_fork(source_task_id);
