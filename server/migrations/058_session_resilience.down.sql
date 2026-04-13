ALTER TABLE agent_task_queue DROP COLUMN IF EXISTS failure_reason;
ALTER TABLE agent_task_queue DROP COLUMN IF EXISTS progress_notes;
ALTER TABLE agent_task_queue DROP COLUMN IF EXISTS max_continuations;
ALTER TABLE agent_task_queue DROP COLUMN IF EXISTS continuation_index;
ALTER TABLE agent_task_queue DROP COLUMN IF EXISTS continuation_of;
