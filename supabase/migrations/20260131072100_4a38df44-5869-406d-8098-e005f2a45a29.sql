-- Create sequence for course evaluation IDs
CREATE SEQUENCE IF NOT EXISTS public.course_evaluation_number_seq START WITH 1;

-- Create course_facilitator_evaluations table
CREATE TABLE IF NOT EXISTS public.course_facilitator_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  evaluation_id TEXT NOT NULL,
  
  -- Learner (optional for anonymous)
  learner_name TEXT,
  employee_number TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  
  -- Course Details
  course_id UUID REFERENCES public.courses(id) NOT NULL,
  course_start_date DATE,
  course_end_date DATE,
  facilitator_id UUID REFERENCES public.profiles(id) NOT NULL,
  venue TEXT,
  
  -- Course Content Ratings (1-5)
  course_objectives_clear INTEGER CHECK (course_objectives_clear BETWEEN 1 AND 5),
  course_content_relevant INTEGER CHECK (course_content_relevant BETWEEN 1 AND 5),
  course_materials_helpful INTEGER CHECK (course_materials_helpful BETWEEN 1 AND 5),
  course_pace_appropriate INTEGER CHECK (course_pace_appropriate BETWEEN 1 AND 5),
  course_exercises_valuable INTEGER CHECK (course_exercises_valuable BETWEEN 1 AND 5),
  course_assessment_fair INTEGER CHECK (course_assessment_fair BETWEEN 1 AND 5),
  
  -- Facilitator Ratings (1-5)
  facilitator_expertise INTEGER CHECK (facilitator_expertise BETWEEN 1 AND 5),
  facilitator_presentation INTEGER CHECK (facilitator_presentation BETWEEN 1 AND 5),
  facilitator_engagement INTEGER CHECK (facilitator_engagement BETWEEN 1 AND 5),
  facilitator_encouraged_questions INTEGER CHECK (facilitator_encouraged_questions BETWEEN 1 AND 5),
  facilitator_explanations INTEGER CHECK (facilitator_explanations BETWEEN 1 AND 5),
  facilitator_professionalism INTEGER CHECK (facilitator_professionalism BETWEEN 1 AND 5),
  
  -- Overall
  overall_course_rating INTEGER CHECK (overall_course_rating BETWEEN 1 AND 5),
  overall_facilitator_rating INTEGER CHECK (overall_facilitator_rating BETWEEN 1 AND 5),
  would_recommend_course TEXT CHECK (would_recommend_course IN ('yes', 'no', 'maybe')),
  would_recommend_facilitator TEXT CHECK (would_recommend_facilitator IN ('yes', 'no', 'maybe')),
  
  -- Open Feedback
  feedback_valuable TEXT,
  feedback_improvement TEXT,
  feedback_additional TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'web',
  
  UNIQUE(tenant_id, evaluation_id)
);

-- Enable RLS on course_facilitator_evaluations
ALTER TABLE public.course_facilitator_evaluations ENABLE ROW LEVEL SECURITY;

-- Trigger for auto-generating evaluation_id
CREATE OR REPLACE FUNCTION public.generate_course_evaluation_number()
RETURNS TRIGGER AS $$
DECLARE
  tenant_slug TEXT;
BEGIN
  SELECT slug INTO tenant_slug FROM public.tenants WHERE id = NEW.tenant_id;
  NEW.evaluation_id := 'CFE-' || COALESCE(UPPER(tenant_slug), 'DEFAULT') || '-' || TO_CHAR(NOW(), 'YYYY-MM') || '-' || LPAD(nextval('public.course_evaluation_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_course_evaluation_number
  BEFORE INSERT ON public.course_facilitator_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_course_evaluation_number();

-- RLS policies for course_facilitator_evaluations
CREATE POLICY "Users can submit course evaluations"
ON public.course_facilitator_evaluations FOR INSERT
WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Users can view course evaluations in tenant"
ON public.course_facilitator_evaluations FOR SELECT
USING (tenant_id = public.get_user_tenant(auth.uid()));