-- Cost tracking: add cost column to task_usage
ALTER TABLE task_usage ADD COLUMN cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0;
