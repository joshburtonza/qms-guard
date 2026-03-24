-- Learner Attachment Auditing: file uploads, program enrollments, course doc requirements

-- Storage bucket for learner document uploads
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'learner-documents',
  'learner-documents',
  false,
  20971520, -- 20MB
  array['application/pdf','image/jpeg','image/jpg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

-- Learner enrollments: which courses a learner is enrolled in
create table if not exists learner_enrollments (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  enrolled_at timestamptz default now(),
  status text not null default 'active' check (status in ('active', 'completed', 'withdrawn')),
  completion_date date,
  notes text,
  created_at timestamptz default now(),
  unique(learner_id, course_id)
);

-- Course document requirements: which doc types are required per course
-- (overrides/extends the global required doc types)
create table if not exists course_document_requirements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  document_type_id uuid not null references learner_document_types(id) on delete cascade,
  is_required boolean not null default true,
  created_at timestamptz default now(),
  unique(course_id, document_type_id)
);

-- RLS
alter table learner_enrollments enable row level security;
alter table course_document_requirements enable row level security;

create policy "learner_enrollments_tenant_isolation" on learner_enrollments for all
  using (tenant_id = (select tenant_id from profiles where id = auth.uid()));

create policy "course_doc_reqs_tenant_isolation" on course_document_requirements for all
  using (tenant_id = (select tenant_id from profiles where id = auth.uid()));

-- Storage policies for learner-documents bucket
create policy "learner_docs_upload" on storage.objects for insert
  with check (bucket_id = 'learner-documents' and auth.role() = 'authenticated');

create policy "learner_docs_read" on storage.objects for select
  using (bucket_id = 'learner-documents' and auth.role() = 'authenticated');

create policy "learner_docs_delete" on storage.objects for delete
  using (bucket_id = 'learner-documents' and auth.role() = 'authenticated');
