-- name: UpsertTrustScoreApproval :one
INSERT INTO trust_score (workspace_id, agent_id, action_type, total_approvals, consecutive_clean_approvals)
VALUES ($1, $2, $3, 1, 1)
ON CONFLICT (workspace_id, agent_id, action_type)
DO UPDATE SET
    total_approvals = trust_score.total_approvals + 1,
    consecutive_clean_approvals = trust_score.consecutive_clean_approvals + 1,
    promotion_suggested = CASE
        WHEN trust_score.consecutive_clean_approvals + 1 >= 20 AND NOT trust_score.promotion_dismissed
        THEN TRUE ELSE trust_score.promotion_suggested
    END,
    updated_at = now()
RETURNING *;

-- name: ResetTrustScoreConsecutive :exec
UPDATE trust_score SET
    consecutive_clean_approvals = 0,
    updated_at = now()
WHERE workspace_id = $1 AND agent_id = $2 AND action_type = $3;

-- name: IncrementTrustScoreRejection :exec
UPDATE trust_score SET
    total_rejections = total_rejections + 1,
    consecutive_clean_approvals = 0,
    updated_at = now()
WHERE workspace_id = $1 AND agent_id = $2 AND action_type = $3;

-- name: IncrementTrustScoreEdit :exec
UPDATE trust_score SET
    total_edits = total_edits + 1,
    consecutive_clean_approvals = 0,
    updated_at = now()
WHERE workspace_id = $1 AND agent_id = $2 AND action_type = $3;

-- name: ListTrustScoresByWorkspace :many
SELECT ts.*, a.name as agent_name
FROM trust_score ts
JOIN agent a ON a.id = ts.agent_id
WHERE ts.workspace_id = $1
ORDER BY ts.consecutive_clean_approvals DESC;

-- name: ListPromotionSuggestions :many
SELECT ts.*, a.name as agent_name
FROM trust_score ts
JOIN agent a ON a.id = ts.agent_id
WHERE ts.workspace_id = $1
  AND ts.promotion_suggested = TRUE
  AND ts.promotion_dismissed = FALSE;

-- name: GetTrustScore :one
SELECT * FROM trust_score WHERE id = $1;

-- name: DismissPromotion :exec
UPDATE trust_score SET
    promotion_dismissed = TRUE,
    promotion_suggested = FALSE,
    updated_at = now()
WHERE id = $1;

-- name: AcceptPromotion :exec
UPDATE trust_score SET
    promotion_suggested = FALSE,
    consecutive_clean_approvals = 0,
    updated_at = now()
WHERE id = $1;
