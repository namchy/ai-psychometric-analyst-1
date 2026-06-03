create table if not exists public.assessment_reports (
  id uuid primary key default gen_random_uuid(),
  assessment_assignment_id uuid not null references public.assessment_assignments(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  report_type text not null,
  audience text not null,
  source_type text not null,
  report_status text not null default 'queued',
  generator_type text null,
  contract_version text null,
  prompt_version_id uuid null,
  model_name text null,
  generator_version text null,
  input_snapshot jsonb null,
  report_snapshot jsonb null,
  failure_code text null,
  failure_reason text null,
  queued_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  generated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint assessment_reports_report_type_check
    check (report_type in ('composite')),
  constraint assessment_reports_audience_check
    check (audience in ('hr')),
  constraint assessment_reports_source_type_check
    check (source_type in ('assessment')),
  constraint assessment_reports_report_status_check
    check (report_status in ('queued', 'processing', 'ready', 'failed')),
  constraint assessment_reports_artifact_identity_unique
    unique (assessment_assignment_id, report_type, audience, source_type)
);

create index if not exists assessment_reports_assignment_idx
  on public.assessment_reports (assessment_assignment_id);

create index if not exists assessment_reports_organization_participant_created_idx
  on public.assessment_reports (organization_id, participant_id, created_at desc);

create index if not exists assessment_reports_queue_idx
  on public.assessment_reports (report_status, audience, queued_at, id);

create or replace function public.set_assessment_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_assessment_reports_updated_at on public.assessment_reports;

create trigger set_assessment_reports_updated_at
before update on public.assessment_reports
for each row
execute function public.set_assessment_reports_updated_at();

alter table public.assessment_reports enable row level security;

drop policy if exists "assessment_reports_read_member" on public.assessment_reports;

create policy "assessment_reports_read_member"
on public.assessment_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = assessment_reports.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);
