-- Learner Tracking Platform
-- Named/numbered document tracking with self-audit for BBB compliance

create table if not exists learners (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  learner_number text not null,
  full_name text not null,
  id_number text,
  email text,
  phone text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, learner_number)
);

create table if not exists learner_document_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  is_required boolean default true,
  display_order int default 0,
  created_at timestamptz default now()
);

create table if not exists learner_documents (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  document_type_id uuid not null references learner_document_types(id) on delete cascade,
  document_name text not null,
  file_url text,
  status text not null default 'present' check (status in ('present', 'unclear', 'missing')),
  notes text,
  uploaded_at timestamptz default now(),
  uploaded_by uuid references profiles(id),
  unique(learner_id, document_type_id)
);

-- RLS
alter table learners enable row level security;
alter table learner_document_types enable row level security;
alter table learner_documents enable row level security;

create policy "learners_tenant_isolation" on learners for all
  using (tenant_id = (select tenant_id from profiles where id = auth.uid()));

create policy "doc_types_tenant_isolation" on learner_document_types for all
  using (tenant_id = (select tenant_id from profiles where id = auth.uid()));

create policy "learner_docs_tenant_isolation" on learner_documents for all
  using (tenant_id = (select tenant_id from profiles where id = auth.uid()));

-- Seed default document types for Ascend LC tenant
-- Run after creating learner_document_types table
-- These are seeded for ALL tenants as defaults; each tenant can add their own
insert into learner_document_types (tenant_id, name, description, is_required, display_order)
select
  t.id,
  doc.name,
  doc.description,
  true,
  doc.ord
from tenants t
cross join (
  values
    ('ID Copy', 'Certified copy of learner identity document', 1),
    ('CV', 'Curriculum vitae / resume', 2),
    ('Qualifications', 'Copies of all relevant qualifications and certificates', 3),
    ('SAQA Verification', 'SAQA qualification verification document', 4),
    ('Proof of Address', 'Recent utility bill or bank statement', 5),
    ('Employment Contract', 'Signed employment or learnership contract', 6)
) as doc(name, description, ord)
on conflict do nothing;
