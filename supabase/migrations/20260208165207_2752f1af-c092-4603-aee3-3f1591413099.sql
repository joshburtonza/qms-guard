-- ============================================================
-- OPTIONAL: Promote JSONB-buried fields to real columns
-- Enables direct column queries for dashboard charts and exports
-- ============================================================

-- Add columns (safe to run multiple times with IF NOT EXISTS)
ALTER TABLE public.non_conformances 
  ADD COLUMN IF NOT EXISTS risk_classification TEXT,
  ADD COLUMN IF NOT EXISTS qa_classification_comments TEXT,
  ADD COLUMN IF NOT EXISTS date_occurred DATE;

-- Add a check constraint for valid risk_classification values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'non_conformances_risk_classification_check'
  ) THEN
    ALTER TABLE public.non_conformances
      ADD CONSTRAINT non_conformances_risk_classification_check
      CHECK (risk_classification IS NULL OR risk_classification IN ('observation', 'ofi', 'minor', 'major'));
  END IF;
END $$;

-- Backfill from existing workflow_history data
-- This extracts from the QA classification step entry in the JSONB array
UPDATE public.non_conformances
SET 
  risk_classification = (
    SELECT elem->>'risk_classification'
    FROM jsonb_array_elements(workflow_history) AS elem
    WHERE elem->>'action' = 'qa_classified'
    ORDER BY (elem->>'performed_at')::timestamptz DESC
    LIMIT 1
  ),
  qa_classification_comments = (
    SELECT elem->>'qa_comments'
    FROM jsonb_array_elements(workflow_history) AS elem
    WHERE elem->>'action' = 'qa_classified'
    ORDER BY (elem->>'performed_at')::timestamptz DESC
    LIMIT 1
  )
WHERE workflow_history IS NOT NULL 
  AND jsonb_array_length(workflow_history) > 0
  AND risk_classification IS NULL;

-- Add index for dashboard filtering
CREATE INDEX IF NOT EXISTS idx_nc_risk_classification 
  ON public.non_conformances(risk_classification);

CREATE INDEX IF NOT EXISTS idx_nc_date_occurred 
  ON public.non_conformances(date_occurred);