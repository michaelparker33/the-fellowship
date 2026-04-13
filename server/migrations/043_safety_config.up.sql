-- Safety controls: spend limits and emergency stop
CREATE TABLE safety_config (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id                UUID NOT NULL UNIQUE REFERENCES workspace(id) ON DELETE CASCADE,
    daily_spend_limit_cents     INTEGER NOT NULL DEFAULT 5000,
    monthly_spend_limit_cents   INTEGER NOT NULL DEFAULT 50000,
    max_concurrent_tasks        INTEGER NOT NULL DEFAULT 5,
    emergency_stop              BOOLEAN NOT NULL DEFAULT FALSE,
    emergency_stop_at           TIMESTAMPTZ,
    emergency_stop_by           UUID REFERENCES "user"(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
