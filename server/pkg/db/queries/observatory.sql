-- name: GetHourlyTaskActivity :many
-- Hourly activity heatmap over last 7 days
SELECT
    EXTRACT(DOW FROM t.created_at AT TIME ZONE 'UTC')::int AS day_of_week,
    EXTRACT(HOUR FROM t.created_at AT TIME ZONE 'UTC')::int AS hour_of_day,
    COUNT(*)::int AS task_count
FROM agent_task_queue t
JOIN issue i ON i.id = t.issue_id
WHERE i.workspace_id = $1
  AND t.created_at >= NOW() - INTERVAL '7 days'
GROUP BY day_of_week, hour_of_day
ORDER BY day_of_week, hour_of_day;

-- name: GetTaskClusters :many
-- Top repeated issue title words as task clusters (simple version)
SELECT
    LOWER(SPLIT_PART(i.title, ' ', 1)) AS cluster_label,
    COUNT(*)::int AS issue_count,
    AVG(CASE WHEN t.id IS NOT NULL THEN 1 ELSE 0 END)::float AS task_rate
FROM issue i
LEFT JOIN agent_task_queue t ON t.issue_id = i.id
WHERE i.workspace_id = $1
  AND i.created_at >= NOW() - INTERVAL '30 days'
GROUP BY cluster_label
HAVING COUNT(*) >= 2
ORDER BY issue_count DESC
LIMIT 20;

-- name: GetRepeatedIssueTitles :many
-- Issue titles that appear 2+ times — potential skill candidates
SELECT
    title,
    COUNT(*)::int AS occurrence_count,
    MAX(created_at) AS last_seen,
    COUNT(*) >= 5 AS could_be_skill
FROM issue
WHERE workspace_id = $1
  AND created_at >= NOW() - INTERVAL '90 days'
GROUP BY title
HAVING COUNT(*) >= 2
ORDER BY occurrence_count DESC
LIMIT 50;

-- name: GetRejectedApprovals :many
SELECT
    a.id,
    a.action_type,
    a.risk_level,
    a.decision_note,
    a.decided_at,
    a.workspace_id,
    ag.name AS agent_name,
    i.title AS issue_title
FROM approval a
LEFT JOIN agent ag ON ag.id = a.agent_id
LEFT JOIN issue i ON i.id = a.issue_id
WHERE a.workspace_id = $1
  AND a.status = 'rejected'
ORDER BY a.decided_at DESC
LIMIT 200;

-- name: GetAgentStats :many
SELECT
    ag.id,
    ag.name,
    ag.status,
    ag.runtime_config,
    COUNT(DISTINCT t.id)::int AS total_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END)::int AS completed_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'failed' THEN t.id END)::int AS failed_tasks,
    COALESCE(SUM(u.input_tokens + u.output_tokens), 0)::bigint AS total_tokens,
    COALESCE(SUM(u.cost_usd), 0)::numeric AS total_cost_usd,
    MAX(t.completed_at) AS last_active
FROM agent ag
LEFT JOIN agent_task_queue t ON t.agent_id = ag.id
LEFT JOIN task_usage u ON u.task_id = t.id
WHERE ag.workspace_id = $1
GROUP BY ag.id, ag.name, ag.status, ag.runtime_config
ORDER BY total_tasks DESC;

-- name: GetSessionHistory :many
SELECT
    t.id AS task_id,
    t.issue_id,
    t.status,
    t.created_at,
    t.started_at,
    t.completed_at,
    i.title AS issue_title,
    ag.name AS agent_name,
    COALESCE(u.input_tokens, 0)::int AS input_tokens,
    COALESCE(u.output_tokens, 0)::int AS output_tokens,
    COALESCE(u.cache_read_tokens, 0)::int AS cache_read_tokens,
    COALESCE(u.cache_write_tokens, 0)::int AS cache_write_tokens,
    COALESCE(u.cost_usd, 0)::numeric AS cost_usd,
    COALESCE(u.model, '') AS model
FROM agent_task_queue t
JOIN issue i ON i.id = t.issue_id
JOIN agent ag ON ag.id = t.agent_id
LEFT JOIN task_usage u ON u.task_id = t.id
WHERE i.workspace_id = $1
ORDER BY t.created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetDailySessionStats :many
SELECT
    DATE_TRUNC('day', t.created_at AT TIME ZONE 'UTC')::date AS day,
    COUNT(*)::int AS task_count,
    COALESCE(SUM(u.input_tokens + u.output_tokens), 0)::bigint AS total_tokens,
    COALESCE(SUM(u.cost_usd), 0)::numeric AS total_cost_usd
FROM agent_task_queue t
JOIN issue i ON i.id = t.issue_id
LEFT JOIN task_usage u ON u.task_id = t.id
WHERE i.workspace_id = $1
  AND t.created_at >= NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day DESC;
