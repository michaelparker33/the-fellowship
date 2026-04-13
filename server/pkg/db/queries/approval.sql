-- name: CreateApproval :one
INSERT INTO approval (
    workspace_id, issue_id, agent_id, action_type,
    autonomy_level, payload, risk_level, risk_score
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetApproval :one
SELECT * FROM approval WHERE id = $1;

-- name: GetApprovalInWorkspace :one
SELECT * FROM approval WHERE id = $1 AND workspace_id = $2;

-- name: ListApprovalsByWorkspace :many
SELECT * FROM approval
WHERE workspace_id = $1
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
  AND (sqlc.narg('risk_level')::text IS NULL OR risk_level = sqlc.narg('risk_level'))
  AND (sqlc.narg('action_type')::text IS NULL OR action_type = sqlc.narg('action_type'))
ORDER BY
    CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
    risk_score DESC,
    created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountApprovalsByWorkspace :one
SELECT count(*) FROM approval
WHERE workspace_id = $1
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
  AND (sqlc.narg('risk_level')::text IS NULL OR risk_level = sqlc.narg('risk_level'))
  AND (sqlc.narg('action_type')::text IS NULL OR action_type = sqlc.narg('action_type'));

-- name: CountPendingApprovals :one
SELECT count(*) FROM approval
WHERE workspace_id = $1 AND status = 'pending';

-- name: UpdateApprovalStatus :one
UPDATE approval SET
    status = $2,
    decided_by = $3,
    decided_at = now(),
    decision_note = $4,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: GetApprovalConfig :one
SELECT * FROM approval_config
WHERE workspace_id = $1 AND action_type = $2;

-- name: ListApprovalConfigs :many
SELECT * FROM approval_config
WHERE workspace_id = $1
ORDER BY action_type;

-- name: UpsertApprovalConfig :one
INSERT INTO approval_config (workspace_id, action_type, autonomy_level)
VALUES ($1, $2, $3)
ON CONFLICT (workspace_id, action_type)
DO UPDATE SET autonomy_level = EXCLUDED.autonomy_level, updated_at = now()
RETURNING *;

-- name: IncrementConsecutiveApprovals :one
UPDATE approval_config SET
    consecutive_approvals = consecutive_approvals + 1,
    updated_at = now()
WHERE workspace_id = $1 AND action_type = $2
RETURNING *;

-- name: ResetConsecutiveApprovals :exec
UPDATE approval_config SET
    consecutive_approvals = 0,
    updated_at = now()
WHERE workspace_id = $1 AND action_type = $2;

-- name: SetAutoApprove :exec
UPDATE approval_config SET
    auto_approve = $3,
    updated_at = now()
WHERE workspace_id = $1 AND action_type = $2;

-- name: UpdateApprovalDebate :one
UPDATE approval SET
    debate_notes = $2,
    contested_by = $3,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ListContestedApprovals :many
SELECT * FROM approval
WHERE workspace_id = $1
  AND contested_by IS NOT NULL
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountContestedApprovals :one
SELECT count(*) FROM approval
WHERE workspace_id = $1
  AND contested_by IS NOT NULL;

-- name: CreateDryRunApproval :one
INSERT INTO approval (workspace_id, agent_id, action_type, autonomy_level, payload, risk_score, risk_level, is_dry_run)
VALUES ($1, $2, $3, $4, $5, $6, $7, true)
RETURNING *;

-- name: UpdateDryRunResult :one
UPDATE approval SET dry_run_result = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ListDryRunApprovals :many
SELECT * FROM approval
WHERE workspace_id = $1 AND is_dry_run = true
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountDryRunApprovals :one
SELECT count(*) FROM approval
WHERE workspace_id = $1 AND is_dry_run = true;

-- name: GetApprovalConfigDryRun :one
SELECT require_dry_run FROM approval_config
WHERE workspace_id = $1 AND action_type = $2;

-- name: SetRequireDryRun :exec
UPDATE approval_config SET
    require_dry_run = $3,
    updated_at = now()
WHERE workspace_id = $1 AND action_type = $2;

-- name: BatchApproveApprovals :exec
UPDATE approval SET status = 'approved', decided_by = $2, decided_at = now(), updated_at = now()
WHERE id = ANY($1::uuid[]) AND workspace_id = $3 AND status = 'pending';

-- name: BatchRejectApprovals :exec
UPDATE approval SET status = 'rejected', decided_by = $2, decided_at = now(), updated_at = now()
WHERE id = ANY($1::uuid[]) AND workspace_id = $3 AND status = 'pending';

-- name: ListPendingApprovalsByRiskScore :many
SELECT * FROM approval
WHERE workspace_id = $1 AND status = 'pending' AND risk_score <= $2
ORDER BY created_at ASC;

-- name: SeedApprovalConfigs :exec
INSERT INTO approval_config (workspace_id, action_type, autonomy_level)
VALUES
    (@workspace_id, 'create_task', 'supervised'),
    (@workspace_id, 'update_status', 'supervised'),
    (@workspace_id, 'send_email', 'manual'),
    (@workspace_id, 'post_slack', 'manual'),
    (@workspace_id, 'merge_pr', 'manual'),
    (@workspace_id, 'deploy', 'manual')
ON CONFLICT (workspace_id, action_type) DO NOTHING;
