-- Add source column to non_conformances
-- Tracks where the NC originated (e.g., Internal Audit, Customer Complaint, etc.)
ALTER TABLE non_conformances
  ADD COLUMN IF NOT EXISTS source text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_other text DEFAULT NULL;

COMMENT ON COLUMN non_conformances.source IS
  'Origin/source of the non-conformance. Values: internal_audit, external_audit, customer_complaint, inspection, investigation, evaluation_feedback, moderation_finding, other.';

COMMENT ON COLUMN non_conformances.source_other IS
  'Free-text description when source is ''other''.';
