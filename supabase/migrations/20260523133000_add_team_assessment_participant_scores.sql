create table if not exists public.team_assessment_participant_scores (
  id uuid primary key default gen_random_uuid(),
  team_assessment_participant_id uuid not null references public.team_assessment_participants(id) on delete cascade,
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  scoring_version text not null,
  scoring_status text not null,
  raw_total numeric null,
  mean_raw numeric null,
  score_0_100 numeric null,
  supported_question_count integer not null default 0,
  scored_question_count integer not null default 0,
  ignored_invalid_answer_count integer not null default 0,
  scale_min numeric null,
  scale_max numeric null,
  score_value_source text null,
  missing_question_ids uuid[] not null default '{}',
  score_snapshot jsonb not null,
  source_response_count integer not null default 0,
  source_completed_at timestamptz null,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_assessment_participant_scores_scoring_version_check
    check (length(btrim(scoring_version)) > 0),
  constraint team_assessment_participant_scores_status_check
    check (scoring_status in ('scored', 'not_ready', 'not_completed', 'no_supported_items', 'not_scored', 'failed', 'stale')),
  constraint team_assessment_participant_scores_score_range_check
    check (score_0_100 is null or (score_0_100 >= 0 and score_0_100 <= 100)),
  constraint team_assessment_participant_scores_supported_question_count_check
    check (supported_question_count >= 0),
  constraint team_assessment_participant_scores_scored_question_count_check
    check (scored_question_count >= 0),
  constraint team_assessment_participant_scores_ignored_invalid_answer_count_check
    check (ignored_invalid_answer_count >= 0),
  constraint team_assessment_participant_scores_scored_lte_supported_check
    check (scored_question_count <= supported_question_count)
);

create unique index if not exists team_assessment_participant_scores_wrapper_version_idx
  on public.team_assessment_participant_scores (team_assessment_participant_id, scoring_version);

create index if not exists team_assessment_participant_scores_wrapper_idx
  on public.team_assessment_participant_scores (team_assessment_participant_id);

create index if not exists team_assessment_participant_scores_attempt_idx
  on public.team_assessment_participant_scores (attempt_id);

create index if not exists team_assessment_participant_scores_status_idx
  on public.team_assessment_participant_scores (scoring_status);

create index if not exists team_assessment_participant_scores_calculated_at_idx
  on public.team_assessment_participant_scores (calculated_at desc);

create or replace function public.set_team_assessment_participant_scores_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_team_assessment_participant_scores_updated_at on public.team_assessment_participant_scores;
create trigger set_team_assessment_participant_scores_updated_at
before update on public.team_assessment_participant_scores
for each row
execute function public.set_team_assessment_participant_scores_updated_at();

alter table public.team_assessment_participant_scores enable row level security;

drop policy if exists "team_assessment_participant_scores_read_member" on public.team_assessment_participant_scores;
create policy "team_assessment_participant_scores_read_member"
on public.team_assessment_participant_scores
for select
to authenticated
using (
  exists (
    select 1
    from public.team_assessment_participants wrapper
    join public.team_assessment_assignments assignment
      on assignment.id = wrapper.team_assessment_assignment_id
    join public.teams team
      on team.id = assignment.team_id
    join public.organization_memberships membership
      on membership.organization_id = team.organization_id
    where wrapper.id = team_assessment_participant_scores.team_assessment_participant_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);
