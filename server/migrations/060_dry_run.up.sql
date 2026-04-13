-- Dry run mode: preview actions before executing
ALTER TABLE approval ADD COLUMN dry_run_result JSONB;
ALTER TABLE approval ADD COLUMN is_dry_run BOOLEAN NOT NULL DEFAULT false;

-- Per-action-type dry run config
ALTER TABLE approval_config ADD COLUMN require_dry_run BOOLEAN NOT NULL DEFAULT false;
