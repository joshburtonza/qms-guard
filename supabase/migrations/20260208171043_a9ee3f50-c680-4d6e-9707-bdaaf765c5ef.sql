-- Add signature_data column to workflow_approvals for e-signature capture
ALTER TABLE public.workflow_approvals 
ADD COLUMN signature_data TEXT;