-- Council Debate: allow agents to contest approvals with opposing verdicts
ALTER TABLE approval ADD COLUMN contested_by UUID REFERENCES agent(id) ON DELETE SET NULL;
ALTER TABLE approval ADD COLUMN debate_notes JSONB;
-- debate_notes schema: [{"agent_id":"uuid", "agent_name":"string", "verdict":"approve"|"reject", "reasoning":"string", "created_at":"timestamp"}]
