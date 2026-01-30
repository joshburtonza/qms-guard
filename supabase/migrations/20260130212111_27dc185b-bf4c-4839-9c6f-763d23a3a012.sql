-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'site_admin', 'manager', 'supervisor', 'worker', 'verifier');

-- Create enum for NC severity
CREATE TYPE public.nc_severity AS ENUM ('critical', 'major', 'minor');

-- Create enum for NC status
CREATE TYPE public.nc_status AS ENUM ('open', 'in_progress', 'pending_review', 'pending_verification', 'closed', 'rejected');

-- Create enum for NC category
CREATE TYPE public.nc_category AS ENUM (
  'training_documentation',
  'competency_verification', 
  'safety_compliance',
  'equipment_ppe',
  'process_deviation',
  'record_keeping',
  'other'
);

-- Create departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  site_location TEXT NOT NULL,
  manager_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  employee_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  department_id UUID REFERENCES public.departments,
  site_location TEXT,
  phone_number TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Add foreign key for department manager
ALTER TABLE public.departments 
ADD CONSTRAINT fk_departments_manager 
FOREIGN KEY (manager_id) REFERENCES public.profiles(id);

-- Create non_conformances table
CREATE TABLE public.non_conformances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_number TEXT UNIQUE NOT NULL,
  
  -- Identification
  reported_by UUID REFERENCES public.profiles NOT NULL,
  department_id UUID REFERENCES public.departments,
  site_location TEXT,
  shift TEXT CHECK (shift IN ('day', 'night', 'general')),
  
  -- Details
  category nc_category NOT NULL,
  category_other TEXT,
  severity nc_severity NOT NULL,
  description TEXT NOT NULL CHECK (char_length(description) >= 50),
  immediate_action TEXT,
  
  -- Assignment
  responsible_person UUID REFERENCES public.profiles NOT NULL,
  due_date DATE NOT NULL,
  additional_stakeholders UUID[],
  
  -- Status tracking
  status nc_status NOT NULL DEFAULT 'open',
  current_step INTEGER DEFAULT 1,
  workflow_history JSONB DEFAULT '[]',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Create corrective_actions table
CREATE TABLE public.corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_id UUID REFERENCES public.non_conformances ON DELETE CASCADE NOT NULL,
  root_cause TEXT NOT NULL,
  corrective_action TEXT NOT NULL,
  preventive_action TEXT,
  completion_date DATE,
  submitted_by UUID REFERENCES public.profiles,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create workflow_approvals table
CREATE TABLE public.workflow_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_id UUID REFERENCES public.non_conformances ON DELETE CASCADE NOT NULL,
  step INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'closed', 'returned')),
  comments TEXT,
  approved_by UUID REFERENCES public.profiles NOT NULL,
  approved_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create nc_attachments table
CREATE TABLE public.nc_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_id UUID REFERENCES public.non_conformances ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES public.profiles,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create activity log table
CREATE TABLE public.nc_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_id UUID REFERENCES public.non_conformances ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  performed_by UUID REFERENCES public.profiles,
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create NC number sequence
CREATE SEQUENCE public.nc_number_seq START 1;

-- Create function to generate NC number
CREATE OR REPLACE FUNCTION public.generate_nc_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.nc_number := 'NC-' || TO_CHAR(NOW(), 'YYYY-MM') || '-' || LPAD(nextval('public.nc_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for NC number generation
CREATE TRIGGER tr_generate_nc_number
BEFORE INSERT ON public.non_conformances
FOR EACH ROW
WHEN (NEW.nc_number IS NULL)
EXECUTE FUNCTION public.generate_nc_number();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_non_conformances_updated_at
BEFORE UPDATE ON public.non_conformances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user department
CREATE OR REPLACE FUNCTION public.get_user_department(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id
  FROM public.profiles
  WHERE id = _user_id
$$;

-- Create function to check if user has any admin role
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'site_admin')
  )
$$;

-- Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.non_conformances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrective_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nc_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nc_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for departments (all users can view)
CREATE POLICY "Anyone can view departments"
ON public.departments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage departments"
ON public.departments FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- RLS Policies for user_roles (only admins can manage)
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- RLS Policies for non_conformances
CREATE POLICY "Users can view relevant NCs"
ON public.non_conformances FOR SELECT
TO authenticated
USING (
  -- User is the reporter
  reported_by = auth.uid() OR
  -- User is the responsible person
  responsible_person = auth.uid() OR
  -- User is in same department
  department_id = public.get_user_department(auth.uid()) OR
  -- User is admin
  public.is_admin(auth.uid()) OR
  -- Verifiers can see NCs pending verification
  (public.has_role(auth.uid(), 'verifier') AND status = 'pending_verification')
);

CREATE POLICY "Authenticated users can create NCs"
ON public.non_conformances FOR INSERT
TO authenticated
WITH CHECK (reported_by = auth.uid());

CREATE POLICY "Users can update relevant NCs"
ON public.non_conformances FOR UPDATE
TO authenticated
USING (
  reported_by = auth.uid() OR
  responsible_person = auth.uid() OR
  public.is_admin(auth.uid()) OR
  (public.has_role(auth.uid(), 'manager') AND department_id = public.get_user_department(auth.uid())) OR
  (public.has_role(auth.uid(), 'verifier') AND status = 'pending_verification')
);

CREATE POLICY "Admins can delete NCs"
ON public.non_conformances FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- RLS Policies for corrective_actions
CREATE POLICY "Users can view corrective actions for accessible NCs"
ON public.corrective_actions FOR SELECT
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

CREATE POLICY "Responsible person can create corrective actions"
ON public.corrective_actions FOR INSERT
TO authenticated
WITH CHECK (
  submitted_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.non_conformances nc
    WHERE nc.id = nc_id
    AND nc.responsible_person = auth.uid()
  )
);

-- RLS Policies for workflow_approvals
CREATE POLICY "Users can view approvals for accessible NCs"
ON public.workflow_approvals FOR SELECT
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

CREATE POLICY "Authorized users can create approvals"
ON public.workflow_approvals FOR INSERT
TO authenticated
WITH CHECK (approved_by = auth.uid());

-- RLS Policies for nc_attachments
CREATE POLICY "Users can view attachments for accessible NCs"
ON public.nc_attachments FOR SELECT
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

CREATE POLICY "Users can upload attachments to their NCs"
ON public.nc_attachments FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.non_conformances nc
    WHERE nc.id = nc_id
    AND (nc.reported_by = auth.uid() OR nc.responsible_person = auth.uid())
  )
);

-- RLS Policies for activity log
CREATE POLICY "Users can view activity for accessible NCs"
ON public.nc_activity_log FOR SELECT
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

CREATE POLICY "System can insert activity logs"
ON public.nc_activity_log FOR INSERT
TO authenticated
WITH CHECK (performed_by = auth.uid());

-- Create storage bucket for NC attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('nc-attachments', 'nc-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for nc-attachments bucket
CREATE POLICY "Authenticated users can upload NC attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'nc-attachments');

CREATE POLICY "Authenticated users can view NC attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'nc-attachments');

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  
  -- Assign default worker role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'worker');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for performance
CREATE INDEX idx_non_conformances_status ON public.non_conformances(status);
CREATE INDEX idx_non_conformances_department ON public.non_conformances(department_id);
CREATE INDEX idx_non_conformances_reported_by ON public.non_conformances(reported_by);
CREATE INDEX idx_non_conformances_responsible_person ON public.non_conformances(responsible_person);
CREATE INDEX idx_non_conformances_due_date ON public.non_conformances(due_date);
CREATE INDEX idx_nc_activity_log_nc_id ON public.nc_activity_log(nc_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);