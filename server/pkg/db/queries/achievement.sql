-- name: UnlockAchievement :one
INSERT INTO achievement (workspace_id, achievement_key, metadata)
VALUES ($1, $2, $3)
ON CONFLICT (workspace_id, achievement_key) DO NOTHING
RETURNING *;

-- name: ListAchievements :many
SELECT * FROM achievement
WHERE workspace_id = $1
ORDER BY unlocked_at DESC;

-- name: GetAchievement :one
SELECT * FROM achievement
WHERE workspace_id = $1 AND achievement_key = $2;
