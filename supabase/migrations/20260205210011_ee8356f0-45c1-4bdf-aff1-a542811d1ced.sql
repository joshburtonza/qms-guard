-- =====================================================
-- QR Code Locations table for pre-filling NC forms
-- =====================================================
CREATE TABLE public.qr_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  name VARCHAR(255) NOT NULL,
  site_location VARCHAR(255) NOT NULL,
  department_id UUID REFERENCES public.departments(id),
  qr_code_data TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.qr_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view QR locations in their tenant"
ON public.qr_locations FOR SELECT
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage QR locations"
ON public.qr_locations FOR ALL
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  AND is_admin(auth.uid())
);

-- =====================================================
-- Department Manager Mapping (for auto-assignment)
-- =====================================================
CREATE TABLE public.department_manager_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  department_id UUID REFERENCES public.departments(id) NOT NULL,
  training_manager_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(department_id)
);

ALTER TABLE public.department_manager_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view department mappings in their tenant"
ON public.department_manager_mapping FOR SELECT
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage department mappings"
ON public.department_manager_mapping FOR ALL
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  AND is_admin(auth.uid())
);

-- =====================================================
-- Internal Audit Checklists
-- =====================================================
CREATE TABLE public.audit_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  checklist_number VARCHAR(50) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  iso_clause VARCHAR(50),
  audit_date DATE NOT NULL,
  auditor_id UUID REFERENCES public.profiles(id) NOT NULL,
  department_id UUID REFERENCES public.departments(id),
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'closed')),
  overall_result VARCHAR(50) CHECK (overall_result IN ('conforming', 'minor_nc', 'major_nc', 'opportunity')),
  summary_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.audit_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audits in their tenant"
ON public.audit_checklists FOR SELECT
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Auditors can create audits"
ON public.audit_checklists FOR INSERT
WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Auditors can update their audits"
ON public.audit_checklists FOR UPDATE
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  AND (auditor_id = auth.uid() OR is_admin(auth.uid()))
);

-- Audit checklist items
CREATE TABLE public.audit_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  checklist_id UUID REFERENCES public.audit_checklists(id) ON DELETE CASCADE NOT NULL,
  item_number INTEGER NOT NULL,
  requirement TEXT NOT NULL,
  evidence_required TEXT,
  finding VARCHAR(50) CHECK (finding IN ('conforming', 'minor_nc', 'major_nc', 'opportunity', 'not_applicable')),
  evidence_found TEXT,
  notes TEXT,
  nc_id UUID REFERENCES public.non_conformances(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit items in their tenant"
ON public.audit_checklist_items FOR SELECT
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Auditors can manage audit items"
ON public.audit_checklist_items FOR ALL
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- Annual Facilitator Evaluations
-- =====================================================
CREATE TABLE public.facilitator_annual_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  evaluation_number VARCHAR(50) NOT NULL UNIQUE,
  facilitator_id UUID REFERENCES public.profiles(id) NOT NULL,
  evaluator_id UUID REFERENCES public.profiles(id) NOT NULL,
  evaluation_period_start DATE NOT NULL,
  evaluation_period_end DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed', 'acknowledged')),
  
  -- Scoring categories (1-5 scale)
  score_knowledge_expertise INTEGER CHECK (score_knowledge_expertise BETWEEN 1 AND 5),
  score_presentation_skills INTEGER CHECK (score_presentation_skills BETWEEN 1 AND 5),
  score_learner_engagement INTEGER CHECK (score_learner_engagement BETWEEN 1 AND 5),
  score_time_management INTEGER CHECK (score_time_management BETWEEN 1 AND 5),
  score_material_preparation INTEGER CHECK (score_material_preparation BETWEEN 1 AND 5),
  score_assessment_quality INTEGER CHECK (score_assessment_quality BETWEEN 1 AND 5),
  score_professionalism INTEGER CHECK (score_professionalism BETWEEN 1 AND 5),
  score_continuous_improvement INTEGER CHECK (score_continuous_improvement BETWEEN 1 AND 5),
  
  overall_score DECIMAL(3,2),
  strengths TEXT,
  areas_for_improvement TEXT,
  development_plan TEXT,
  evaluator_comments TEXT,
  facilitator_comments TEXT,
  
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.facilitator_annual_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view evaluations in their tenant"
ON public.facilitator_annual_evaluations FOR SELECT
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Evaluators can create evaluations"
ON public.facilitator_annual_evaluations FOR INSERT
WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Evaluators can update their evaluations"
ON public.facilitator_annual_evaluations FOR UPDATE
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  AND (evaluator_id = auth.uid() OR facilitator_id = auth.uid() OR is_admin(auth.uid()))
);

-- =====================================================
-- Contractor/Provider Evaluations
-- =====================================================
CREATE TABLE public.contractor_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  evaluation_number VARCHAR(50) NOT NULL UNIQUE,
  contractor_name VARCHAR(255) NOT NULL,
  contractor_type VARCHAR(100) CHECK (contractor_type IN ('training_provider', 'equipment_supplier', 'consultant', 'service_provider', 'other')),
  contractor_type_other VARCHAR(255),
  contract_reference VARCHAR(100),
  evaluation_date DATE NOT NULL,
  evaluator_id UUID REFERENCES public.profiles(id) NOT NULL,
  department_id UUID REFERENCES public.departments(id),
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  
  -- Scoring categories (1-5 scale)
  score_quality_of_work INTEGER CHECK (score_quality_of_work BETWEEN 1 AND 5),
  score_timeliness INTEGER CHECK (score_timeliness BETWEEN 1 AND 5),
  score_communication INTEGER CHECK (score_communication BETWEEN 1 AND 5),
  score_compliance INTEGER CHECK (score_compliance BETWEEN 1 AND 5),
  score_value_for_money INTEGER CHECK (score_value_for_money BETWEEN 1 AND 5),
  score_health_safety INTEGER CHECK (score_health_safety BETWEEN 1 AND 5),
  
  overall_score DECIMAL(3,2),
  recommendation VARCHAR(50) CHECK (recommendation IN ('highly_recommended', 'recommended', 'conditional', 'not_recommended')),
  strengths TEXT,
  weaknesses TEXT,
  evaluator_comments TEXT,
  approval_comments TEXT,
  approved_by UUID REFERENCES public.profiles(id),
  
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contractor_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contractor evaluations in their tenant"
ON public.contractor_evaluations FOR SELECT
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create contractor evaluations"
ON public.contractor_evaluations FOR INSERT
WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update contractor evaluations"
ON public.contractor_evaluations FOR UPDATE
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  AND (evaluator_id = auth.uid() OR is_admin(auth.uid()))
);

-- =====================================================
-- Auto-generate numbers with triggers
-- =====================================================
CREATE OR REPLACE FUNCTION generate_audit_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.checklist_number := 'AUD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
    LPAD((SELECT COUNT(*) + 1 FROM audit_checklists WHERE DATE(created_at) = CURRENT_DATE)::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_audit_number
  BEFORE INSERT ON public.audit_checklists
  FOR EACH ROW
  WHEN (NEW.checklist_number IS NULL OR NEW.checklist_number = '')
  EXECUTE FUNCTION generate_audit_number();

CREATE OR REPLACE FUNCTION generate_facilitator_eval_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.evaluation_number := 'FE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
    LPAD((SELECT COUNT(*) + 1 FROM facilitator_annual_evaluations WHERE DATE(created_at) = CURRENT_DATE)::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_facilitator_eval_number
  BEFORE INSERT ON public.facilitator_annual_evaluations
  FOR EACH ROW
  WHEN (NEW.evaluation_number IS NULL OR NEW.evaluation_number = '')
  EXECUTE FUNCTION generate_facilitator_eval_number();

CREATE OR REPLACE FUNCTION generate_contractor_eval_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.evaluation_number := 'CE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
    LPAD((SELECT COUNT(*) + 1 FROM contractor_evaluations WHERE DATE(created_at) = CURRENT_DATE)::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_contractor_eval_number
  BEFORE INSERT ON public.contractor_evaluations
  FOR EACH ROW
  WHEN (NEW.evaluation_number IS NULL OR NEW.evaluation_number = '')
  EXECUTE FUNCTION generate_contractor_eval_number();

-- Add updated_at triggers
CREATE TRIGGER update_qr_locations_updated_at
  BEFORE UPDATE ON public.qr_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_department_mapping_updated_at
  BEFORE UPDATE ON public.department_manager_mapping
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_audit_checklists_updated_at
  BEFORE UPDATE ON public.audit_checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_audit_items_updated_at
  BEFORE UPDATE ON public.audit_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_facilitator_evals_updated_at
  BEFORE UPDATE ON public.facilitator_annual_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contractor_evals_updated_at
  BEFORE UPDATE ON public.contractor_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();