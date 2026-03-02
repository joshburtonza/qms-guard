-- Migration: AI draft audit trail for NC corrective actions
-- Tracks when AI-generated text (from EDITH) is used in root cause / corrective action fields,
-- logs original AI text vs final submitted text, and records justification if unchanged.

CREATE TABLE public.nc_ai_draft_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_id UUID NOT NULL REFERENCES public.non_conformances(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL CHECK (field_name IN ('root_cause', 'corrective_action')),
  ai_original_text TEXT NOT NULL,
  final_submitted_text TEXT NOT NULL,
  was_modified BOOLEAN NOT NULL DEFAULT false,
  justification TEXT,
  submitted_by UUID REFERENCES public.profiles(id),
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.nc_ai_draft_log ENABLE ROW LEVEL SECURITY;

-- Select: visible to users who can access the parent NC
CREATE POLICY "Users can view AI draft logs for accessible NCs"
ON public.nc_ai_draft_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.non_conformances nc
    WHERE nc.id = nc_id
    AND (
      nc.reported_by = auth.uid() OR
      nc.responsible_person = auth.uid() OR
      nc.department_id = public.get_user_department(auth.uid()) OR
      public.is_admin(auth.uid())
    )
  )
);

-- Insert: only the person who submitted the corrective action
CREATE POLICY "Users can insert AI draft logs for their NCs"
ON public.nc_ai_draft_log FOR INSERT
TO authenticated
WITH CHECK (
  submitted_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.non_conformances nc
    WHERE nc.id = nc_id
    AND nc.responsible_person = auth.uid()
  )
);

CREATE INDEX idx_nc_ai_draft_log_nc_id ON public.nc_ai_draft_log(nc_id);
