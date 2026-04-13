-- name: GetSafetyConfig :one
SELECT * FROM safety_config WHERE workspace_id = $1;

-- name: UpsertSafetyConfig :one
INSERT INTO safety_config (workspace_id, daily_spend_limit_cents, monthly_spend_limit_cents, max_concurrent_tasks)
VALUES ($1, $2, $3, $4)
ON CONFLICT (workspace_id)
DO UPDATE SET
    daily_spend_limit_cents = EXCLUDED.daily_spend_limit_cents,
    monthly_spend_limit_cents = EXCLUDED.monthly_spend_limit_cents,
    max_concurrent_tasks = EXCLUDED.max_concurrent_tasks,
    updated_at = now()
RETURNING *;

-- name: SetEmergencyStop :one
UPDATE safety_config SET
    emergency_stop = TRUE,
    emergency_stop_at = now(),
    emergency_stop_by = $2,
    updated_at = now()
WHERE workspace_id = $1
RETURNING *;

-- name: ClearEmergencyStop :one
UPDATE safety_config SET
    emergency_stop = FALSE,
    emergency_stop_at = NULL,
    emergency_stop_by = NULL,
    updated_at = now()
WHERE workspace_id = $1
RETURNING *;

-- name: EnsureSafetyConfig :one
INSERT INTO safety_config (workspace_id)
VALUES ($1)
ON CONFLICT (workspace_id) DO NOTHING
RETURNING *;

-- name: GetOrCreateSafetyConfig :one
INSERT INTO safety_config (workspace_id)
VALUES ($1)
ON CONFLICT (workspace_id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id
RETURNING *;
