-- Add applicable_clauses column to non_conformances
-- Stores ISO/QMS clause references suggested by EDITH AI or entered manually by the initiator

alter table non_conformances
  add column if not exists applicable_clauses text[] not null default '{}';

comment on column non_conformances.applicable_clauses is 'ISO/QMS clause references applicable to this NC (e.g. "ISO 9001:2015 Clause 8.7 — Control of Nonconforming Outputs"). Auto-suggested by EDITH AI; editable by the initiator.';
