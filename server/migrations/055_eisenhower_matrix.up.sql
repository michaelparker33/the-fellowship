-- Eisenhower Matrix: classify issues by urgency + importance
ALTER TABLE issue ADD COLUMN eisenhower_quadrant TEXT CHECK (
    eisenhower_quadrant IS NULL OR eisenhower_quadrant IN ('do','schedule','delegate','eliminate')
);
