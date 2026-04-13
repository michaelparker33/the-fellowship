-- Add numeric risk score (1-10) to approvals for granular risk-based routing.
ALTER TABLE approval ADD COLUMN risk_score INTEGER NOT NULL DEFAULT 1
    CHECK (risk_score BETWEEN 1 AND 10);

CREATE INDEX idx_approval_workspace_risk_score
    ON approval(workspace_id, risk_score DESC)
    WHERE status = 'pending';

-- Backfill existing rows from the text risk_level field.
UPDATE approval SET risk_score = CASE
    WHEN risk_level = 'low'      THEN 2
    WHEN risk_level = 'medium'   THEN 5
    WHEN risk_level = 'high'     THEN 7
    WHEN risk_level = 'critical' THEN 9
    ELSE 1
END;
