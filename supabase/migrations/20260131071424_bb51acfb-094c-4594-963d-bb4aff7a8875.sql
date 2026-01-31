-- Create unit_standards table for moderation
CREATE TABLE IF NOT EXISTS public.unit_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  nqf_level INTEGER,
  credits INTEGER,
  course_id UUID REFERENCES public.courses(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, code)
);

-- Enable RLS on unit_standards
ALTER TABLE public.unit_standards ENABLE ROW LEVEL SECURITY;

-- RLS policies for unit_standards
CREATE POLICY "Users can view unit standards in tenant"
ON public.unit_standards FOR SELECT
USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Admins can manage unit standards"
ON public.unit_standards FOR ALL
USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.is_admin(auth.uid()));

-- Create sequence for moderation IDs
CREATE SEQUENCE IF NOT EXISTS public.moderation_number_seq START WITH 1;

-- Create moderation_requests table
CREATE TABLE IF NOT EXISTS public.moderation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  moderation_id TEXT NOT NULL,
  
  -- Submission details
  submitted_by UUID REFERENCES public.profiles(id) NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Learner & Assessment info
  learner_name TEXT NOT NULL,
  learner_id_number TEXT,
  course_id UUID REFERENCES public.courses(id),
  unit_standard_id UUID REFERENCES public.unit_standards(id),
  assessment_date DATE,
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('written', 'practical', 'portfolio', 'oral')),
  assessment_result TEXT NOT NULL CHECK (assessment_result IN ('competent', 'not_yet_competent', 'absent')),
  assessor_comments TEXT,
  
  -- Assignment
  moderator_id UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ,
  due_date DATE,
  
  -- Moderation Outcome
  moderation_decision TEXT CHECK (moderation_decision IN ('approved', 'approved_with_recommendations', 'rejected')),
  moderation_feedback TEXT,
  areas_of_concern TEXT[],
  recommendations TEXT,
  moderated_at TIMESTAMPTZ,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'resubmitted')),
  
  -- Acknowledgment (simple signature alternative)
  moderator_acknowledged BOOLEAN DEFAULT false,
  moderator_acknowledged_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, moderation_id)
);

-- Enable RLS on moderation_requests
ALTER TABLE public.moderation_requests ENABLE ROW LEVEL SECURITY;

-- Trigger for auto-generating moderation_id
CREATE OR REPLACE FUNCTION public.generate_moderation_number()
RETURNS TRIGGER AS $$
DECLARE
  tenant_slug TEXT;
BEGIN
  SELECT slug INTO tenant_slug FROM public.tenants WHERE id = NEW.tenant_id;
  NEW.moderation_id := 'MOD-' || COALESCE(UPPER(tenant_slug), 'DEFAULT') || '-' || TO_CHAR(NOW(), 'YYYY-MM') || '-' || LPAD(nextval('public.moderation_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_moderation_number
  BEFORE INSERT ON public.moderation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_moderation_number();

-- Trigger for updated_at
CREATE TRIGGER update_moderation_requests_updated_at
  BEFORE UPDATE ON public.moderation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies for moderation_requests
CREATE POLICY "Users can view moderation requests in tenant"
ON public.moderation_requests FOR SELECT
USING (
  tenant_id = public.get_user_tenant(auth.uid()) AND (
    submitted_by = auth.uid() OR
    moderator_id = auth.uid() OR
    public.is_admin(auth.uid()) OR
    public.has_role(auth.uid(), 'manager')
  )
);

CREATE POLICY "Users can submit moderation requests"
ON public.moderation_requests FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant(auth.uid()) AND
  submitted_by = auth.uid()
);

CREATE POLICY "Moderators can update assigned requests"
ON public.moderation_requests FOR UPDATE
USING (
  tenant_id = public.get_user_tenant(auth.uid()) AND (
    submitted_by = auth.uid() OR
    moderator_id = auth.uid() OR
    public.is_admin(auth.uid())
  )
);

-- Create moderation_attachments table
CREATE TABLE IF NOT EXISTS public.moderation_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  moderation_id UUID REFERENCES public.moderation_requests(id) ON DELETE CASCADE NOT NULL,
  attachment_type TEXT NOT NULL CHECK (attachment_type IN ('assessment', 'rubric', 'evidence', 'other')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID REFERENCES public.profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on moderation_attachments
ALTER TABLE public.moderation_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for moderation_attachments
CREATE POLICY "Users can view attachments for accessible moderations"
ON public.moderation_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.moderation_requests mr
    WHERE mr.id = moderation_attachments.moderation_id
    AND mr.tenant_id = public.get_user_tenant(auth.uid())
    AND (
      mr.submitted_by = auth.uid() OR
      mr.moderator_id = auth.uid() OR
      public.is_admin(auth.uid())
    )
  )
);

CREATE POLICY "Users can upload attachments to their moderations"
ON public.moderation_attachments FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant(auth.uid()) AND
  uploaded_by = auth.uid()
);

-- Add moderator role to app_role enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'moderator' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'moderator';
  END IF;
END $$;