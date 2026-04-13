-- name: CreateAuditLog :one
INSERT INTO audit_log (workspace_id, actor_type, actor_id, action, entity_type, entity_id, payload)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListAuditLogs :many
SELECT * FROM audit_log
WHERE workspace_id = $1
  AND ($2::text = '' OR entity_type = $2)
  AND ($3::uuid IS NULL OR entity_id = $3)
ORDER BY created_at DESC
LIMIT $4 OFFSET $5;

-- name: ListAuditLogsByEntity :many
SELECT * FROM audit_log
WHERE workspace_id = $1 AND entity_type = $2 AND entity_id = $3
ORDER BY created_at DESC
LIMIT 100;
