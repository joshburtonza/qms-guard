-- Add AI risk assessment JSONB column to non_conformances
-- Stores the result from Claude Haiku risk classification:
-- { risk_level, category, suggested_owner, rationale, classified_at, model }
ALTER TABLE non_conformances
  ADD COLUMN IF NOT EXISTS ai_risk_assessment jsonb DEFAULT NULL;

COMMENT ON COLUMN non_conformances.ai_risk_assessment IS
  'AI-generated risk classification from Claude Haiku. Fields: risk_level (low/medium/high/critical), category (supplier/process/equipment/personnel), suggested_owner, rationale, classified_at, model.';
