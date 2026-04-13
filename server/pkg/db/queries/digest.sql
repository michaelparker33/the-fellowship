-- name: CreateWeeklyDigest :one
INSERT INTO weekly_digest (
    workspace_id, period_start, period_end,
    content, issue_id, emailed_to
) VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListWeeklyDigests :many
SELECT * FROM weekly_digest
WHERE workspace_id = $1
ORDER BY period_end DESC
LIMIT $2 OFFSET $3;

-- name: GetLatestWeeklyDigest :one
SELECT * FROM weekly_digest
WHERE workspace_id = $1
ORDER BY period_end DESC
LIMIT 1;

-- name: CountCompletedTasksInPeriod :one
SELECT count(*) FROM agent_task_queue
WHERE issue_id IN (SELECT id FROM issue WHERE workspace_id = $1)
  AND status = 'completed'
  AND completed_at >= $2
  AND completed_at < $3;

-- name: CountFailedTasksInPeriod :one
SELECT count(*) FROM agent_task_queue
WHERE issue_id IN (SELECT id FROM issue WHERE workspace_id = $1)
  AND status = 'failed'
  AND completed_at >= $2
  AND completed_at < $3;

-- name: CountApprovalsInPeriod :one
SELECT count(*) FROM approval
WHERE workspace_id = $1
  AND status IN ('approved', 'rejected')
  AND decided_at >= $2
  AND decided_at < $3;

-- name: CountIssuesCreatedInPeriod :one
SELECT count(*) FROM issue
WHERE workspace_id = $1
  AND created_at >= $2
  AND created_at < $3;

-- name: CountIssuesCompletedInPeriod :one
SELECT count(*) FROM issue
WHERE workspace_id = $1
  AND status = 'done'
  AND updated_at >= $2
  AND updated_at < $3;
