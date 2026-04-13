-- name: UpsertLoopDetection :one
INSERT INTO loop_detection (workspace_id, issue_id, agent_id, consecutive_failures, failure_history)
VALUES ($1, $2, $3, 1, $4::jsonb)
ON CONFLICT (issue_id, agent_id) DO UPDATE SET
    consecutive_failures = loop_detection.consecutive_failures + 1,
    failure_history = (
        CASE WHEN jsonb_array_length(loop_detection.failure_history) >= 5
        THEN loop_detection.failure_history - 0 || $4::jsonb
        ELSE loop_detection.failure_history || $4::jsonb
        END
    ),
    escalation_status = CASE WHEN loop_detection.consecutive_failures + 1 >= 3 THEN 'escalated' ELSE 'none' END,
    updated_at = now()
RETURNING *;

-- name: GetLoopDetection :one
SELECT * FROM loop_detection WHERE issue_id = $1 AND agent_id = $2;

-- name: ListEscalatedLoopDetections :many
SELECT * FROM loop_detection
WHERE workspace_id = $1 AND escalation_status = 'escalated'
ORDER BY updated_at DESC;

-- name: CountEscalatedLoopDetections :one
SELECT count(*) FROM loop_detection
WHERE workspace_id = $1 AND escalation_status = 'escalated';

-- name: ResolveLoopDetection :one
UPDATE loop_detection SET
    escalation_status = 'resolved',
    escalation_decision = $2,
    decided_by = $3,
    decided_at = now(),
    consecutive_failures = 0,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ResetLoopDetection :exec
UPDATE loop_detection SET consecutive_failures = 0, escalation_status = 'none', updated_at = now()
WHERE issue_id = $1 AND agent_id = $2;
