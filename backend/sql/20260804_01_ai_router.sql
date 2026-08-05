-- Persist the provider that produced each durable classification and enforce
-- exactly one successful classification per incident.
ALTER TABLE ai_metrics
    ADD COLUMN IF NOT EXISTS provider VARCHAR(40);

UPDATE ai_metrics
SET provider = 'gemini'
WHERE provider IS NULL OR btrim(provider) = '';

ALTER TABLE ai_metrics
    ALTER COLUMN provider SET DEFAULT 'tokenrouter',
    ALTER COLUMN provider SET NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM ai_metrics
        GROUP BY incident_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Cannot enforce one AI metric per incident: duplicate ai_metrics rows exist. Resolve duplicates before retrying migration.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_ai_metrics_incident_id'
          AND conrelid = 'ai_metrics'::regclass
    ) THEN
        ALTER TABLE ai_metrics
            ADD CONSTRAINT uq_ai_metrics_incident_id UNIQUE (incident_id);
    END IF;
END $$;
