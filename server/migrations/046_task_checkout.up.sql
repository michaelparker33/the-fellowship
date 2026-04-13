-- Atomic Task Checkout (F8): prevent double-work with optimistic locking
ALTER TABLE issue
    ADD COLUMN claimed_by UUID REFERENCES agent(id) ON DELETE SET NULL,
    ADD COLUMN claimed_at TIMESTAMPTZ,
    ADD COLUMN claim_version INT NOT NULL DEFAULT 0;

CREATE INDEX idx_issue_claimed_by ON issue(claimed_by);
