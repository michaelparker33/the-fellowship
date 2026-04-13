-- name: CreateTaskFork :one
INSERT INTO task_fork (
    workspace_id, source_task_id, fork_at_step,
    modified_output, created_by
) VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateTaskForkStatus :one
UPDATE task_fork SET
    status = $2,
    forked_task_id = $3
WHERE id = $1
RETURNING *;

-- name: GetTaskFork :one
SELECT * FROM task_fork WHERE id = $1;

-- name: ListForksBySource :many
SELECT * FROM task_fork
WHERE source_task_id = $1
ORDER BY created_at DESC;

-- name: ListForksByWorkspace :many
SELECT * FROM task_fork
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountForksByWorkspace :one
SELECT count(*) FROM task_fork
WHERE workspace_id = $1;
