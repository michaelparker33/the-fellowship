-- name: CreateGoal :one
INSERT INTO goal (workspace_id, title, description, parent_goal_id)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetGoal :one
SELECT * FROM goal WHERE id = $1 AND workspace_id = $2;

-- name: ListGoals :many
SELECT * FROM goal
WHERE workspace_id = $1
ORDER BY created_at DESC;

-- name: UpdateGoal :one
UPDATE goal
SET title = COALESCE($3, title),
    description = COALESCE($4, description),
    parent_goal_id = $5,
    updated_at = now()
WHERE id = $1 AND workspace_id = $2
RETURNING *;

-- name: DeleteGoal :exec
DELETE FROM goal WHERE id = $1 AND workspace_id = $2;

-- name: GetGoalChain :many
-- Recursively walk up the goal ancestor chain
WITH RECURSIVE chain AS (
    SELECT g.id, g.workspace_id, g.title, g.description, g.parent_goal_id, g.created_at, g.updated_at, 0 AS depth
    FROM goal g WHERE g.id = $1
    UNION ALL
    SELECT g.id, g.workspace_id, g.title, g.description, g.parent_goal_id, g.created_at, g.updated_at, c.depth + 1
    FROM goal g
    JOIN chain c ON g.id = c.parent_goal_id
)
SELECT id, workspace_id, title, description, parent_goal_id, created_at, updated_at FROM chain ORDER BY depth DESC;

-- name: SearchGoals :many
SELECT * FROM goal
WHERE workspace_id = $1 AND (title ILIKE '%' || $2 || '%' OR description::text ILIKE '%' || $2 || '%')
ORDER BY created_at DESC LIMIT $3;
