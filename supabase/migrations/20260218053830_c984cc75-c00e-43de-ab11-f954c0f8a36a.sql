
-- Now make edith_number NOT NULL and UNIQUE after population
ALTER TABLE public.edith_iso_knowledge
  ALTER COLUMN edith_number SET NOT NULL;

ALTER TABLE public.edith_iso_knowledge
  ADD CONSTRAINT uq_edith_iso_knowledge_edith_number UNIQUE (edith_number);
