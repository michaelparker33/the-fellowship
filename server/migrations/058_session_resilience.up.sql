-- Track continuation sessions for resilient task execution
ALTER TABLE agent_task_queue ADD COLUMN continuation_of UUID REFERENCES agent_task_queue(id);
ALTER TABLE agent_task_queue ADD COLUMN continuation_index INT NOT NULL DEFAULT 0;
ALTER TABLE agent_task_queue ADD COLUMN max_continuations INT NOT NULL DEFAULT 10;
ALTER TABLE agent_task_queue ADD COLUMN progress_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE agent_task_queue ADD COLUMN failure_reason TEXT;
