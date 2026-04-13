ALTER TABLE approval_config DROP COLUMN IF EXISTS require_dry_run;
ALTER TABLE approval DROP COLUMN IF EXISTS is_dry_run;
ALTER TABLE approval DROP COLUMN IF EXISTS dry_run_result;
