-- name: CreateShadowRun :one
INSERT INTO shadow_run (
    workspace_id, task_id, shadow_model, primary_model
) VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateShadowRunResults :one
UPDATE shadow_run SET
    shadow_output = $2,
    primary_output = $3,
    shadow_cost_usd = $4,
    primary_cost_usd = $5,
    shadow_duration_ms = $6,
    primary_duration_ms = $7
WHERE id = $1
RETURNING *;

-- name: RateShadowRun :one
UPDATE shadow_run SET
    quality_score = $2
WHERE id = $1
RETURNING *;

-- name: GetShadowRun :one
SELECT * FROM shadow_run WHERE id = $1;

-- name: ListShadowRunsByWorkspace :many
SELECT * FROM shadow_run
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountShadowRunsByWorkspace :one
SELECT count(*) FROM shadow_run
WHERE workspace_id = $1;

-- name: GetShadowRunStats :one
SELECT
    count(*)::bigint as total_runs,
    COALESCE(avg(quality_score), 0)::float8 as avg_quality,
    COALESCE(avg(shadow_cost_usd), 0)::float8 as avg_shadow_cost,
    COALESCE(avg(primary_cost_usd), 0)::float8 as avg_primary_cost,
    COALESCE(avg(shadow_duration_ms), 0)::float8 as avg_shadow_duration,
    COALESCE(avg(primary_duration_ms), 0)::float8 as avg_primary_duration
FROM shadow_run
WHERE workspace_id = $1;

-- name: CreateShadowConfig :one
INSERT INTO shadow_config (workspace_id, shadow_model, enabled, sample_rate)
VALUES ($1, $2, $3, $4)
ON CONFLICT (workspace_id, shadow_model)
DO UPDATE SET
    enabled = EXCLUDED.enabled,
    sample_rate = EXCLUDED.sample_rate,
    updated_at = now()
RETURNING *;

-- name: ListShadowConfigs :many
SELECT * FROM shadow_config
WHERE workspace_id = $1
ORDER BY shadow_model;

-- name: DeleteShadowConfig :exec
DELETE FROM shadow_config WHERE id = $1 AND workspace_id = $2;

-- name: ListEnabledShadowConfigs :many
SELECT * FROM shadow_config
WHERE workspace_id = $1 AND enabled = TRUE;
