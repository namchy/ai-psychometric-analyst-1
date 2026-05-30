create table if not exists public.team_fit_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  candidate_source_type text not null,
  candidate_source_id uuid null,
  team_source_type text not null,
  team_source_id uuid null,
  optional_context jsonb not null default '{}'::jsonb,
  report_type text not null,
  report_version text not null,
  report_status text not null,
  input_snapshot jsonb null,
  report_snapshot jsonb null,
  error_message text null,
  queued_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  failed_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_fit_reports_report_type_check
    check (report_type = 'team_fit_report_v1'),
  constraint team_fit_reports_report_version_check
    check (report_version = 'v1'),
  constraint team_fit_reports_report_status_check
    check (report_status in ('queued', 'processing', 'ready', 'failed')),
  constraint team_fit_reports_candidate_source_type_check
    check (candidate_source_type in ('composite_deterministic_input_snapshot')),
  constraint team_fit_reports_team_source_type_check
    check (team_source_type in ('team_dynamics_aggregation_input_snapshot')),
  constraint team_fit_reports_optional_context_object_check
    check (jsonb_typeof(optional_context) = 'object')
);

create index if not exists team_fit_reports_organization_idx
  on public.team_fit_reports (organization_id);

create index if not exists team_fit_reports_team_idx
  on public.team_fit_reports (team_id);

create index if not exists team_fit_reports_participant_idx
  on public.team_fit_reports (participant_id);

create index if not exists team_fit_reports_organization_team_idx
  on public.team_fit_reports (organization_id, team_id);

create index if not exists team_fit_reports_organization_participant_idx
  on public.team_fit_reports (organization_id, participant_id);

create index if not exists team_fit_reports_queue_idx
  on public.team_fit_reports (report_status, report_type, report_version, queued_at)
  where report_status = 'queued';

create index if not exists team_fit_reports_relational_lookup_idx
  on public.team_fit_reports (organization_id, team_id, participant_id, report_type, report_version);

create or replace function public.set_team_fit_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_team_fit_reports_updated_at on public.team_fit_reports;
create trigger set_team_fit_reports_updated_at
before update on public.team_fit_reports
for each row
execute function public.set_team_fit_reports_updated_at();

alter table public.team_fit_reports enable row level security;

drop policy if exists "team_fit_reports_read_hr_admin" on public.team_fit_reports;
create policy "team_fit_reports_read_hr_admin"
on public.team_fit_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = team_fit_reports.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('org_owner', 'hr_admin')
  )
);

drop policy if exists "team_fit_reports_insert_hr_admin" on public.team_fit_reports;
create policy "team_fit_reports_insert_hr_admin"
on public.team_fit_reports
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = team_fit_reports.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('org_owner', 'hr_admin')
  )
);

drop policy if exists "team_fit_reports_update_hr_admin" on public.team_fit_reports;
create policy "team_fit_reports_update_hr_admin"
on public.team_fit_reports
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = team_fit_reports.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('org_owner', 'hr_admin')
  )
)
with check (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = team_fit_reports.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('org_owner', 'hr_admin')
  )
);
