-- name: CreateScheduledTask :one
INSERT INTO scheduled_task (
    workspace_id, name, cron_expression, timezone,
    agent_id, prompt, model_override, enabled
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetScheduledTask :one
SELECT * FROM scheduled_task WHERE id = $1;

-- name: GetScheduledTaskInWorkspace :one
SELECT * FROM scheduled_task WHERE id = $1 AND workspace_id = $2;

-- name: ListScheduledTasksByWorkspace :many
SELECT * FROM scheduled_task
WHERE workspace_id = $1
ORDER BY created_at DESC;

-- name: ListEnabledScheduledTasks :many
SELECT * FROM scheduled_task
WHERE enabled = TRUE;

-- name: UpdateScheduledTask :one
UPDATE scheduled_task SET
    name = COALESCE(sqlc.narg('name'), name),
    cron_expression = COALESCE(sqlc.narg('cron_expression'), cron_expression),
    timezone = COALESCE(sqlc.narg('timezone'), timezone),
    agent_id = COALESCE(sqlc.narg('agent_id'), agent_id),
    prompt = COALESCE(sqlc.narg('prompt'), prompt),
    model_override = sqlc.narg('model_override'),
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteScheduledTask :exec
DELETE FROM scheduled_task WHERE id = $1;

-- name: SetScheduledTaskEnabled :one
UPDATE scheduled_task SET
    enabled = $2,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateScheduledTaskLastRun :exec
UPDATE scheduled_task SET
    last_run_at = now(),
    last_status = $2,
    last_duration_ms = $3,
    run_count = run_count + 1,
    updated_at = now()
WHERE id = $1;

-- name: CreateScheduledTaskRun :one
INSERT INTO scheduled_task_run (
    scheduled_task_id, issue_id, status
) VALUES ($1, $2, $3)
RETURNING *;

-- name: UpdateScheduledTaskRun :exec
UPDATE scheduled_task_run SET
    status = $2,
    duration_ms = $3,
    error_message = $4
WHERE id = $1;

-- name: ListScheduledTaskRuns :many
SELECT * FROM scheduled_task_run
WHERE scheduled_task_id = $1
ORDER BY created_at DESC
LIMIT $2;

-- name: CountEnabledScheduledTasks :one
SELECT count(*) FROM scheduled_task
WHERE workspace_id = $1 AND enabled = TRUE;
