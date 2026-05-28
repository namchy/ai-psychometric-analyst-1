create table if not exists public.team_assessment_report_selection_drafts (
  id uuid primary key default gen_random_uuid(),
  team_assessment_assignment_id uuid not null references public.team_assessment_assignments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by_user_id uuid null references auth.users(id) on delete set null,
  updated_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_assessment_report_selection_members (
  id uuid primary key default gen_random_uuid(),
  selection_draft_id uuid not null references public.team_assessment_report_selection_drafts(id) on delete cascade,
  team_assessment_participant_id uuid not null references public.team_assessment_participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists team_assessment_report_selection_drafts_assignment_idx
  on public.team_assessment_report_selection_drafts (team_assessment_assignment_id);

create index if not exists team_assessment_report_selection_drafts_team_idx
  on public.team_assessment_report_selection_drafts (team_id);

create unique index if not exists team_assessment_report_selection_members_draft_wrapper_idx
  on public.team_assessment_report_selection_members (selection_draft_id, team_assessment_participant_id);

create index if not exists team_assessment_report_selection_members_wrapper_idx
  on public.team_assessment_report_selection_members (team_assessment_participant_id);

create or replace function public.set_team_assessment_report_selection_drafts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_team_assessment_report_selection_members_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_team_assessment_report_selection_drafts_updated_at on public.team_assessment_report_selection_drafts;
create trigger set_team_assessment_report_selection_drafts_updated_at
before update on public.team_assessment_report_selection_drafts
for each row
execute function public.set_team_assessment_report_selection_drafts_updated_at();

drop trigger if exists set_team_assessment_report_selection_members_updated_at on public.team_assessment_report_selection_members;
create trigger set_team_assessment_report_selection_members_updated_at
before update on public.team_assessment_report_selection_members
for each row
execute function public.set_team_assessment_report_selection_members_updated_at();

alter table public.team_assessment_report_selection_drafts enable row level security;
alter table public.team_assessment_report_selection_members enable row level security;

drop policy if exists "team_assessment_report_selection_drafts_read_member" on public.team_assessment_report_selection_drafts;
create policy "team_assessment_report_selection_drafts_read_member"
on public.team_assessment_report_selection_drafts
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
    where assignment.id = team_assessment_report_selection_drafts.team_assessment_assignment_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);

drop policy if exists "team_assessment_report_selection_members_read_member" on public.team_assessment_report_selection_members;
create policy "team_assessment_report_selection_members_read_member"
on public.team_assessment_report_selection_members
for select
to authenticated
using (
  exists (
    select 1
    from public.team_assessment_report_selection_drafts draft
    join public.team_assessment_assignments assignment
      on assignment.id = draft.team_assessment_assignment_id
    join public.teams team
      on team.id = assignment.team_id
    join public.organization_memberships membership
      on membership.organization_id = team.organization_id
    where draft.id = team_assessment_report_selection_members.selection_draft_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);
