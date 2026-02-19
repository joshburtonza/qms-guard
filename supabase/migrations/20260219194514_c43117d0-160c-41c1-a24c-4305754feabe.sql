
-- Enable pg_trgm for fuzzy duplicate NC detection
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add after-hours flag to non_conformances
ALTER TABLE public.non_conformances ADD COLUMN IF NOT EXISTS is_after_hours boolean DEFAULT false;

-- Create index for trigram similarity searches on description
CREATE INDEX IF NOT EXISTS idx_nc_description_trgm ON public.non_conformances USING gin (description gin_trgm_ops);

-- Create function for duplicate NC detection
CREATE OR REPLACE FUNCTION public.find_similar_ncs(
  p_description text,
  p_tenant_id uuid,
  p_threshold float DEFAULT 0.3
)
RETURNS TABLE(
  id uuid,
  nc_number text,
  description text,
  status text,
  similarity_score float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    nc.id,
    nc.nc_number,
    nc.description,
    nc.status::text,
    similarity(nc.description, p_description)::float AS similarity_score
  FROM public.non_conformances nc
  WHERE nc.tenant_id = p_tenant_id
    AND nc.status NOT IN ('closed', 'rejected')
    AND similarity(nc.description, p_description) > p_threshold
  ORDER BY similarity_score DESC
  LIMIT 5;
$$;
