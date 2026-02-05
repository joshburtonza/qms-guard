-- ISO 9001:2015 Knowledge Base for Edith
CREATE TABLE edith_iso_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clause_number TEXT NOT NULL,
  clause_title TEXT NOT NULL,
  section_number TEXT, -- Sub-section like 10.2.1
  section_title TEXT,
  requirement_text TEXT NOT NULL,
  interpretation TEXT, -- Plain language explanation
  mining_context TEXT, -- Mining/training industry specific application
  compliance_indicators TEXT[], -- What to look for in audits
  common_nonconformities TEXT[], -- Typical issues found
  audit_questions TEXT[], -- Sample audit questions
  evidence_required TEXT[], -- Documents/records needed
  qms_guard_mapping JSONB, -- Maps to QMS Guard features
  parent_clause TEXT, -- Reference to parent clause number
  is_mandatory BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- South African Mining Regulations Knowledge
CREATE TABLE edith_regulatory_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_name TEXT NOT NULL, -- MHSA, Mining Charter, MQA guidelines
  regulation_code TEXT, -- Act/Section reference
  requirement_text TEXT NOT NULL,
  interpretation TEXT,
  iso_clause_links TEXT[], -- Related ISO 9001 clauses
  qms_impact TEXT, -- How this affects QMS
  compliance_deadline DATE,
  penalty_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance Assessment Records
CREATE TABLE edith_compliance_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('clause', 'full_audit', 'gap_analysis', 'pre_audit')),
  iso_clause TEXT, -- Specific clause being assessed
  compliance_status TEXT CHECK (compliance_status IN ('compliant', 'partial', 'non_compliant', 'not_applicable')),
  findings JSONB NOT NULL, -- Detailed findings
  evidence_reviewed TEXT[],
  recommendations TEXT,
  assessed_by UUID REFERENCES profiles(id),
  assessed_at TIMESTAMPTZ DEFAULT NOW(),
  next_review_date DATE
);

-- Enable RLS
ALTER TABLE edith_iso_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE edith_regulatory_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE edith_compliance_assessments ENABLE ROW LEVEL SECURITY;

-- ISO knowledge is read-only for all authenticated users (global knowledge)
CREATE POLICY "Authenticated users can read ISO knowledge"
ON edith_iso_knowledge FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only super_admins can modify ISO knowledge
CREATE POLICY "Super admins can manage ISO knowledge"
ON edith_iso_knowledge FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = auth.uid() AND role = 'super_admin'
));

-- Regulatory knowledge readable by all authenticated users
CREATE POLICY "Authenticated users can read regulatory knowledge"
ON edith_regulatory_knowledge FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can manage regulatory knowledge"
ON edith_regulatory_knowledge FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = auth.uid() AND role = 'super_admin'
));

-- Compliance assessments scoped to tenant
CREATE POLICY "Users can view tenant compliance assessments"
ON edith_compliance_assessments FOR SELECT
USING (tenant_id = get_user_tenant(auth.uid()));

CREATE POLICY "Admins can manage tenant compliance assessments"
ON edith_compliance_assessments FOR ALL
USING (tenant_id = get_user_tenant(auth.uid()) AND is_admin(auth.uid()));

-- Indexes for performance
CREATE INDEX idx_iso_knowledge_clause ON edith_iso_knowledge(clause_number);
CREATE INDEX idx_iso_knowledge_section ON edith_iso_knowledge(section_number);
CREATE INDEX idx_regulatory_knowledge_name ON edith_regulatory_knowledge(regulation_name);
CREATE INDEX idx_compliance_assessments_tenant ON edith_compliance_assessments(tenant_id);
CREATE INDEX idx_compliance_assessments_clause ON edith_compliance_assessments(iso_clause);

-- Add updated_at trigger
CREATE TRIGGER update_edith_iso_knowledge_updated_at
BEFORE UPDATE ON edith_iso_knowledge
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();