create table if not exists public.team_assessment_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  team_assessment_assignment_id uuid not null references public.team_assessment_assignments(id) on delete cascade,
  selection_draft_id uuid not null references public.team_assessment_report_selection_drafts(id) on delete restrict,
  aggregation_snapshot_id uuid null references public.team_assessment_aggregation_snapshots(id) on delete set null,
  report_type text not null,
  report_version text not null,
  report_status text not null,
  generator_type text null,
  model_name text null,
  included_member_ids_snapshot jsonb not null default '[]'::jsonb,
  input_snapshot jsonb null,
  report_snapshot jsonb null,
  error_message text null,
  queued_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_assessment_reports_report_type_nonempty
    check (length(trim(report_type)) > 0),
  constraint team_assessment_reports_report_version_nonempty
    check (length(trim(report_version)) > 0),
  constraint team_assessment_reports_status_check
    check (report_status in ('queued', 'processing', 'ready', 'failed')),
  constraint team_assessment_reports_included_member_ids_snapshot_array_check
    check (jsonb_typeof(included_member_ids_snapshot) = 'array'),
  constraint team_assessment_reports_ready_requires_snapshot
    check (report_status <> 'ready' or report_snapshot is not null),
  constraint team_assessment_reports_failed_requires_error_message
    check (report_status <> 'failed' or error_message is not null)
);

create index if not exists team_assessment_reports_organization_idx
  on public.team_assessment_reports (organization_id);

create index if not exists team_assessment_reports_team_idx
  on public.team_assessment_reports (team_id);

create index if not exists team_assessment_reports_assignment_idx
  on public.team_assessment_reports (team_assessment_assignment_id);

create index if not exists team_assessment_reports_selection_draft_idx
  on public.team_assessment_reports (selection_draft_id);

create index if not exists team_assessment_reports_status_idx
  on public.team_assessment_reports (report_status);

create index if not exists team_assessment_reports_created_at_idx
  on public.team_assessment_reports (created_at desc);

create or replace function public.set_team_assessment_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_team_assessment_reports_updated_at on public.team_assessment_reports;
create trigger set_team_assessment_reports_updated_at
before update on public.team_assessment_reports
for each row
execute function public.set_team_assessment_reports_updated_at();

alter table public.team_assessment_reports enable row level security;

drop policy if exists "team_assessment_reports_read_member" on public.team_assessment_reports;
create policy "team_assessment_reports_read_member"
on public.team_assessment_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.team_assessment_assignments assignment
    join public.teams team
      on team.id = assignment.team_id
    join public.organization_memberships membership
      on membership.organization_id = team.organization_id
    where assignment.id = team_assessment_reports.team_assessment_assignment_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);
