DROP INDEX IF EXISTS idx_approval_workspace_risk_score;
ALTER TABLE approval DROP COLUMN IF EXISTS risk_score;
