create table if not exists public.team_assessment_aggregation_snapshots (
  id uuid primary key default gen_random_uuid(),
  team_assessment_assignment_id uuid not null references public.team_assessment_assignments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  aggregation_version text not null,
  aggregation_status text not null,
  source_scoring_version text not null,
  source_score_snapshot_ids uuid[] not null default '{}',
  participant_count integer not null default 0,
  completed_participant_count integer not null default 0,
  included_score_count integer not null default 0,
  excluded_score_count integer not null default 0,
  missing_completed_score_participant_ids uuid[] not null default '{}',
  mean_score_0_100 numeric null,
  min_score_0_100 numeric null,
  max_score_0_100 numeric null,
  range_score_0_100 numeric null,
  aggregation_snapshot jsonb not null,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_assessment_aggregation_snapshots_version_nonempty
    check (length(trim(aggregation_version)) > 0),
  constraint team_assessment_aggregation_snapshots_source_scoring_version_nonempty
    check (length(trim(source_scoring_version)) > 0),
  constraint team_assessment_aggregation_snapshots_status_check
    check (aggregation_status in ('ready', 'not_ready', 'stale', 'failed')),
  constraint team_assessment_aggregation_snapshots_participant_count_check
    check (participant_count >= 0),
  constraint team_assessment_aggregation_snapshots_completed_participant_count_check
    check (completed_participant_count >= 0),
  constraint team_assessment_aggregation_snapshots_included_score_count_check
    check (included_score_count >= 0),
  constraint team_assessment_aggregation_snapshots_excluded_score_count_check
    check (excluded_score_count >= 0),
  constraint team_assessment_aggregation_snapshots_included_le_completed_check
    check (included_score_count <= completed_participant_count),
  constraint team_assessment_aggregation_snapshots_mean_score_range_check
    check (mean_score_0_100 is null or (mean_score_0_100 >= 0 and mean_score_0_100 <= 100)),
  constraint team_assessment_aggregation_snapshots_min_score_range_check
    check (min_score_0_100 is null or (min_score_0_100 >= 0 and min_score_0_100 <= 100)),
  constraint team_assessment_aggregation_snapshots_max_score_range_check
    check (max_score_0_100 is null or (max_score_0_100 >= 0 and max_score_0_100 <= 100)),
  constraint team_assessment_aggregation_snapshots_range_score_range_check
    check (range_score_0_100 is null or (range_score_0_100 >= 0 and range_score_0_100 <= 100))
);

create unique index if not exists team_assessment_aggregation_snapshots_assignment_version_idx
  on public.team_assessment_aggregation_snapshots (team_assessment_assignment_id, aggregation_version);

create index if not exists team_assessment_aggregation_snapshots_assignment_idx
  on public.team_assessment_aggregation_snapshots (team_assessment_assignment_id);

create index if not exists team_assessment_aggregation_snapshots_team_idx
  on public.team_assessment_aggregation_snapshots (team_id);

create index if not exists team_assessment_aggregation_snapshots_status_idx
  on public.team_assessment_aggregation_snapshots (aggregation_status);

create index if not exists team_assessment_aggregation_snapshots_calculated_at_idx
  on public.team_assessment_aggregation_snapshots (calculated_at desc);

create or replace function public.set_team_assessment_aggregation_snapshots_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_team_assessment_aggregation_snapshots_updated_at on public.team_assessment_aggregation_snapshots;
create trigger set_team_assessment_aggregation_snapshots_updated_at
before update on public.team_assessment_aggregation_snapshots
for each row
execute function public.set_team_assessment_aggregation_snapshots_updated_at();

alter table public.team_assessment_aggregation_snapshots enable row level security;

drop policy if exists "team_assessment_aggregation_snapshots_read_member" on public.team_assessment_aggregation_snapshots;
create policy "team_assessment_aggregation_snapshots_read_member"
on public.team_assessment_aggregation_snapshots
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
    where assignment.id = team_assessment_aggregation_snapshots.team_assessment_assignment_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);
