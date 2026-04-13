ALTER TABLE issue
    DROP COLUMN IF EXISTS claimed_by,
    DROP COLUMN IF EXISTS claimed_at,
    DROP COLUMN IF EXISTS claim_version;
