
-- Add Edith Number columns to edith_iso_knowledge
ALTER TABLE public.edith_iso_knowledge
  ADD COLUMN IF NOT EXISTS edith_number TEXT,
  ADD COLUMN IF NOT EXISTS iso_standard_version TEXT DEFAULT '2015',
  ADD COLUMN IF NOT EXISTS effective_from DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES public.edith_iso_knowledge(id);

-- Create iso_clause_versions table
CREATE TABLE public.iso_clause_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  edith_number TEXT NOT NULL,
  iso_version TEXT NOT NULL,
  clause_number TEXT NOT NULL,
  clause_title TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.iso_clause_versions ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read, admins can manage
CREATE POLICY "Authenticated users can read clause versions"
  ON public.iso_clause_versions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can manage clause versions"
  ON public.iso_clause_versions
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'site_admin')
  ));

-- Trigger for updated_at
CREATE TRIGGER update_iso_clause_versions_updated_at
  BEFORE UPDATE ON public.iso_clause_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Unique constraint on edith_number + iso_version
ALTER TABLE public.iso_clause_versions
  ADD CONSTRAINT uq_edith_number_iso_version UNIQUE (edith_number, iso_version);
