-- name: CreateEventTrigger :one
INSERT INTO event_trigger (
    workspace_id, name, trigger_type, trigger_config,
    agent_id, prompt_template, enabled
) VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetEventTrigger :one
SELECT * FROM event_trigger WHERE id = $1;

-- name: GetEventTriggerInWorkspace :one
SELECT * FROM event_trigger WHERE id = $1 AND workspace_id = $2;

-- name: ListEventTriggersByWorkspace :many
SELECT * FROM event_trigger
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountEventTriggersByWorkspace :one
SELECT count(*) FROM event_trigger
WHERE workspace_id = $1;

-- name: ListEnabledEventTriggers :many
SELECT * FROM event_trigger
WHERE workspace_id = $1 AND enabled = TRUE
ORDER BY name;

-- name: UpdateEventTrigger :one
UPDATE event_trigger SET
    name = COALESCE(sqlc.narg('name'), name),
    trigger_type = COALESCE(sqlc.narg('trigger_type'), trigger_type),
    trigger_config = COALESCE(sqlc.narg('trigger_config'), trigger_config),
    agent_id = COALESCE(sqlc.narg('agent_id'), agent_id),
    prompt_template = COALESCE(sqlc.narg('prompt_template'), prompt_template),
    enabled = COALESCE(sqlc.narg('enabled'), enabled),
    updated_at = now()
WHERE id = $1 AND workspace_id = $2
RETURNING *;

-- name: DeleteEventTrigger :exec
DELETE FROM event_trigger WHERE id = $1 AND workspace_id = $2;

-- name: UpdateEventTriggerLastFired :exec
UPDATE event_trigger SET
    last_fired_at = now(),
    fire_count = fire_count + 1,
    updated_at = now()
WHERE id = $1;

-- name: ToggleEventTrigger :one
UPDATE event_trigger SET
    enabled = NOT enabled,
    updated_at = now()
WHERE id = $1 AND workspace_id = $2
RETURNING *;
