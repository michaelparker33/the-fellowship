-- name: CreateMission :one
INSERT INTO mission (workspace_id, project_id, total_tasks, started_by)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetMission :one
SELECT * FROM mission WHERE id = $1;

-- name: ListMissionsByProject :many
SELECT * FROM mission WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3;

-- name: ListMissionsByWorkspace :many
SELECT * FROM mission WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3;

-- name: GetActiveMissionForProject :one
SELECT * FROM mission WHERE project_id = $1 AND status IN ('pending', 'running') LIMIT 1;

-- name: UpdateMissionStatus :one
UPDATE mission SET status = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateMissionProgress :one
UPDATE mission SET
    completed_tasks = $2,
    failed_tasks = $3,
    skipped_tasks = $4,
    current_task_id = $5,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: CompleteMission :one
UPDATE mission SET status = 'completed', completed_at = now(), updated_at = now()
WHERE id = $1
RETURNING *;

-- name: StopMission :one
UPDATE mission SET status = 'stopped', stopped_at = now(), updated_at = now()
WHERE id = $1
RETURNING *;

-- name: FailMission :one
UPDATE mission SET status = 'failed', completed_at = now(), updated_at = now()
WHERE id = $1
RETURNING *;

-- name: AppendMissionError :exec
UPDATE mission SET error_log = error_log || $2::jsonb, updated_at = now()
WHERE id = $1;
