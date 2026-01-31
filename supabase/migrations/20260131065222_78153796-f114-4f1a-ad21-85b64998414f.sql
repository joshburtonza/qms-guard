-- =====================================================
-- PHASE 2: MULTI-TENANCY & NEW WORKFLOWS FOUNDATION
-- =====================================================

-- 1. Create tenants table for multi-tenancy
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  
  -- White-label branding
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#1E40AF',
  secondary_color TEXT DEFAULT '#3B82F6',
  accent_color TEXT DEFAULT '#10B981',
  
  -- Custom text
  platform_name TEXT DEFAULT 'QMS Platform',
  support_email TEXT,
  support_phone TEXT,
  
  -- Settings
  timezone TEXT DEFAULT 'Africa/Johannesburg',
  date_format TEXT DEFAULT 'DD/MM/YYYY',
  
  -- Subscription
  plan TEXT DEFAULT 'standard' CHECK (plan IN ('starter', 'standard', 'enterprise')),
  active BOOLEAN DEFAULT true,
  trial_ends_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 2. Add tenant_id to profiles
ALTER TABLE public.profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants;

-- 3. Add tenant_id to departments
ALTER TABLE public.departments ADD COLUMN tenant_id UUID REFERENCES public.tenants;

-- 4. Add tenant_id to non_conformances
ALTER TABLE public.non_conformances ADD COLUMN tenant_id UUID REFERENCES public.tenants;

-- 5. Add tenant_id to corrective_actions
ALTER TABLE public.corrective_actions ADD COLUMN tenant_id UUID REFERENCES public.tenants;

-- 6. Add tenant_id to workflow_approvals
ALTER TABLE public.workflow_approvals ADD COLUMN tenant_id UUID REFERENCES public.tenants;

-- 7. Add tenant_id to nc_attachments
ALTER TABLE public.nc_attachments ADD COLUMN tenant_id UUID REFERENCES public.tenants;

-- 8. Add tenant_id to nc_activity_log
ALTER TABLE public.nc_activity_log ADD COLUMN tenant_id UUID REFERENCES public.tenants;

-- 9. Add tenant_id to user_roles
ALTER TABLE public.user_roles ADD COLUMN tenant_id UUID REFERENCES public.tenants;

-- =====================================================
-- Create helper function to get user's tenant_id
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_tenant(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE id = _user_id
$$;

-- =====================================================
-- RLS POLICIES FOR TENANTS
-- =====================================================

-- Users can view their own tenant
CREATE POLICY "Users can view own tenant"
ON public.tenants FOR SELECT
USING (id = get_user_tenant(auth.uid()));

-- Admins can update their tenant
CREATE POLICY "Admins can update own tenant"
ON public.tenants FOR UPDATE
USING (id = get_user_tenant(auth.uid()) AND is_admin(auth.uid()));

-- =====================================================
-- UPDATE EXISTING RLS POLICIES FOR TENANT ISOLATION
-- =====================================================

-- Drop and recreate profiles policies with tenant isolation
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view profiles in tenant"
ON public.profiles FOR SELECT
USING (
  tenant_id IS NULL  -- Allow null during migration
  OR tenant_id = get_user_tenant(auth.uid())
);

-- Update departments RLS
DROP POLICY IF EXISTS "Anyone can view departments" ON public.departments;
CREATE POLICY "Users can view departments in tenant"
ON public.departments FOR SELECT
USING (
  tenant_id IS NULL 
  OR tenant_id = get_user_tenant(auth.uid())
);

-- =====================================================
-- CREATE COURSES TABLE
-- =====================================================
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration_days INTEGER,
  nqf_level INTEGER,
  credits INTEGER,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, code)
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view courses in tenant"
ON public.courses FOR SELECT
USING (tenant_id = get_user_tenant(auth.uid()));

CREATE POLICY "Admins can manage courses"
ON public.courses FOR ALL
USING (tenant_id = get_user_tenant(auth.uid()) AND is_admin(auth.uid()));

-- =====================================================
-- CREATE CUSTOMER SATISFACTION SURVEYS TABLE
-- =====================================================
CREATE TABLE public.customer_satisfaction_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants NOT NULL,
  survey_id TEXT NOT NULL,
  
  -- Respondent (optional for anonymous)
  respondent_name TEXT,
  respondent_email TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  department_id UUID REFERENCES public.departments,
  
  -- What's being evaluated
  service_type TEXT NOT NULL CHECK (service_type IN ('training', 'consultation', 'audit', 'other')),
  course_id UUID REFERENCES public.courses,
  facilitator_id UUID REFERENCES public.profiles,
  service_date DATE,
  
  -- Ratings (1-5 scale)
  rating_overall INTEGER CHECK (rating_overall BETWEEN 1 AND 5),
  rating_content INTEGER CHECK (rating_content BETWEEN 1 AND 5),
  rating_facilitator_knowledge INTEGER CHECK (rating_facilitator_knowledge BETWEEN 1 AND 5),
  rating_facilitator_presentation INTEGER CHECK (rating_facilitator_presentation BETWEEN 1 AND 5),
  rating_materials INTEGER CHECK (rating_materials BETWEEN 1 AND 5),
  rating_venue INTEGER CHECK (rating_venue BETWEEN 1 AND 5),
  would_recommend TEXT CHECK (would_recommend IN ('yes', 'no', 'maybe')),
  
  -- Open feedback
  feedback_positive TEXT,
  feedback_improvement TEXT,
  feedback_additional TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'web' CHECK (source IN ('web', 'qr', 'email_link')),
  
  UNIQUE(tenant_id, survey_id)
);

ALTER TABLE public.customer_satisfaction_surveys ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can submit surveys (for their tenant)
CREATE POLICY "Users can submit surveys"
ON public.customer_satisfaction_surveys FOR INSERT
WITH CHECK (tenant_id = get_user_tenant(auth.uid()));

-- Users can view surveys in their tenant
CREATE POLICY "Users can view surveys in tenant"
ON public.customer_satisfaction_surveys FOR SELECT
USING (tenant_id = get_user_tenant(auth.uid()));

-- =====================================================
-- CREATE SEQUENCE FOR SURVEY IDs
-- =====================================================
CREATE SEQUENCE IF NOT EXISTS public.survey_number_seq START 1;

-- Function to generate survey number with tenant slug
CREATE OR REPLACE FUNCTION public.generate_survey_number()
RETURNS TRIGGER AS $$
DECLARE
  tenant_slug TEXT;
BEGIN
  SELECT slug INTO tenant_slug FROM public.tenants WHERE id = NEW.tenant_id;
  NEW.survey_id := 'CSS-' || COALESCE(UPPER(tenant_slug), 'DEFAULT') || '-' || TO_CHAR(NOW(), 'YYYY-MM') || '-' || LPAD(nextval('public.survey_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER generate_survey_number_trigger
BEFORE INSERT ON public.customer_satisfaction_surveys
FOR EACH ROW
EXECUTE FUNCTION public.generate_survey_number();

-- =====================================================
-- CREATE DEFAULT TENANT FOR EXISTING DATA
-- =====================================================
INSERT INTO public.tenants (id, name, slug, platform_name, primary_color)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Ascend LC',
  'ascend',
  'ASCEND QMS',
  '#1e3a5f'
);

-- Update existing data to use default tenant
UPDATE public.profiles SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.departments SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.non_conformances SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.corrective_actions SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.workflow_approvals SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.nc_attachments SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.nc_activity_log SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.user_roles SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- Now make tenant_id NOT NULL on profiles (required for auth)
ALTER TABLE public.profiles ALTER COLUMN tenant_id SET NOT NULL;

-- =====================================================
-- UPDATE handle_new_user TO SET DEFAULT TENANT
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, tenant_id)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'a0000000-0000-0000-0000-000000000001'  -- Default tenant
  );
  
  -- Assign default worker role
  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (NEW.id, 'worker', 'a0000000-0000-0000-0000-000000000001');
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- UPDATE updated_at trigger for new tables
-- =====================================================
CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_courses_updated_at
BEFORE UPDATE ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();