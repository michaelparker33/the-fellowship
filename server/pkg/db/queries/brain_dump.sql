-- name: CreateBrainDump :one
INSERT INTO brain_dump (workspace_id, content, created_by)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ListBrainDumps :many
SELECT * FROM brain_dump
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListUnprocessedBrainDumps :many
SELECT * FROM brain_dump
WHERE workspace_id = $1 AND processed = false
ORDER BY created_at DESC;

-- name: CountUnprocessedBrainDumps :one
SELECT count(*) FROM brain_dump
WHERE workspace_id = $1 AND processed = false;

-- name: ProcessBrainDump :one
UPDATE brain_dump SET processed = true, converted_issue_id = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteBrainDump :exec
DELETE FROM brain_dump WHERE id = $1;

-- name: SearchBrainDumps :many
SELECT * FROM brain_dump
WHERE workspace_id = $1 AND content ILIKE '%' || $2 || '%'
ORDER BY created_at DESC LIMIT $3;
