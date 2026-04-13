-- name: CreateContinuationTask :one
-- Creates a continuation task that inherits context from the original task.
-- The continuation_index is incremented and progress_notes are updated.
INSERT INTO agent_task_queue (
    agent_id, runtime_id, issue_id, status, priority,
    trigger_comment_id, chat_session_id,
    continuation_of, continuation_index, max_continuations, progress_notes
)
SELECT
    agent_id, runtime_id, issue_id, 'queued', priority,
    trigger_comment_id, chat_session_id,
    $1, continuation_index + 1, max_continuations, $2
FROM agent_task_queue WHERE id = $1
RETURNING *;

-- name: GetTaskContinuationChain :many
-- Returns the full chain of continuation tasks starting from a root task.
WITH RECURSIVE chain AS (
    SELECT atq.* FROM agent_task_queue atq WHERE atq.id = $1
    UNION ALL
    SELECT t.* FROM agent_task_queue t
    JOIN chain c ON t.continuation_of = c.id
)
SELECT * FROM chain ORDER BY continuation_index;

-- name: UpdateTaskProgressNotes :exec
UPDATE agent_task_queue SET progress_notes = $2 WHERE id = $1;

-- name: UpdateTaskFailureReason :exec
UPDATE agent_task_queue SET failure_reason = $2 WHERE id = $1;
