create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null
);

create table if not exists public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  role text not null default 'member',
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_memberships_role_check
    check (role in ('member', 'lead', 'observer')),
  constraint team_memberships_active_state_check
    check (
      (is_active = true and left_at is null)
      or (is_active = false)
    )
);

alter table public.team_memberships
  add constraint team_memberships_id_participant_unique unique (id, participant_id);

create table if not exists public.team_assessment_assignments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  package_slug text not null,
  status text not null default 'draft',
  created_by_user_id uuid references auth.users(id) on delete set null,
  opened_at timestamptz null,
  closed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_assessment_assignments_status_check
    check (status in ('draft', 'active', 'closed', 'ready_for_report', 'reported', 'cancelled'))
);

create table if not exists public.team_assessment_participants (
  id uuid primary key default gen_random_uuid(),
  team_assessment_assignment_id uuid not null references public.team_assessment_assignments(id) on delete cascade,
  team_membership_id uuid not null,
  participant_id uuid not null,
  attempt_id uuid null references public.attempts(id) on delete set null,
  status text not null default 'invited',
  invited_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_assessment_participants_status_check
    check (status in ('invited', 'started', 'completed', 'expired')),
  constraint team_assessment_participants_team_membership_participant_fkey
    foreign key (team_membership_id, participant_id)
    references public.team_memberships(id, participant_id)
    on delete cascade,
  constraint team_assessment_participants_attempt_status_check
    check (
      (status = 'invited' and started_at is null and completed_at is null)
      or (status = 'started' and started_at is not null and completed_at is null)
      or (status = 'completed' and started_at is not null and completed_at is not null)
      or (status = 'expired' and completed_at is null)
    )
);

create index if not exists teams_organization_created_idx
  on public.teams (organization_id, created_at desc);

create index if not exists teams_archived_idx
  on public.teams (archived_at);

create unique index if not exists teams_organization_name_active_idx
  on public.teams (organization_id, lower(name))
  where archived_at is null;

create index if not exists team_memberships_team_idx
  on public.team_memberships (team_id);

create index if not exists team_memberships_participant_idx
  on public.team_memberships (participant_id);

create unique index if not exists team_memberships_one_active_participant_per_team_idx
  on public.team_memberships (team_id, participant_id)
  where is_active = true and left_at is null;

create index if not exists team_assessment_assignments_team_created_idx
  on public.team_assessment_assignments (team_id, created_at desc);

create index if not exists team_assessment_assignments_status_idx
  on public.team_assessment_assignments (status);

create index if not exists team_assessment_participants_assignment_idx
  on public.team_assessment_participants (team_assessment_assignment_id);

create index if not exists team_assessment_participants_membership_idx
  on public.team_assessment_participants (team_membership_id);

create index if not exists team_assessment_participants_participant_idx
  on public.team_assessment_participants (participant_id);

create unique index if not exists team_assessment_participants_assignment_membership_idx
  on public.team_assessment_participants (team_assessment_assignment_id, team_membership_id);

create unique index if not exists team_assessment_participants_assignment_participant_idx
  on public.team_assessment_participants (team_assessment_assignment_id, participant_id);

create unique index if not exists team_assessment_participants_attempt_unique_idx
  on public.team_assessment_participants (attempt_id)
  where attempt_id is not null;

create or replace function public.set_teams_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_team_memberships_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_team_assessment_assignments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_team_assessment_participants_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_teams_updated_at on public.teams;
create trigger set_teams_updated_at
before update on public.teams
for each row
execute function public.set_teams_updated_at();

drop trigger if exists set_team_memberships_updated_at on public.team_memberships;
create trigger set_team_memberships_updated_at
before update on public.team_memberships
for each row
execute function public.set_team_memberships_updated_at();

drop trigger if exists set_team_assessment_assignments_updated_at on public.team_assessment_assignments;
create trigger set_team_assessment_assignments_updated_at
before update on public.team_assessment_assignments
for each row
execute function public.set_team_assessment_assignments_updated_at();

drop trigger if exists set_team_assessment_participants_updated_at on public.team_assessment_participants;
create trigger set_team_assessment_participants_updated_at
before update on public.team_assessment_participants
for each row
execute function public.set_team_assessment_participants_updated_at();

alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.team_assessment_assignments enable row level security;
alter table public.team_assessment_participants enable row level security;

drop policy if exists "teams_read_member" on public.teams;
create policy "teams_read_member"
on public.teams
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = teams.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);

drop policy if exists "team_memberships_read_member" on public.team_memberships;
create policy "team_memberships_read_member"
on public.team_memberships
for select
to authenticated
using (
  exists (
    select 1
    from public.teams team
    join public.organization_memberships membership
      on membership.organization_id = team.organization_id
    where team.id = team_memberships.team_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);

drop policy if exists "team_assessment_assignments_read_member" on public.team_assessment_assignments;
create policy "team_assessment_assignments_read_member"
on public.team_assessment_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.teams team
    join public.organization_memberships membership
      on membership.organization_id = team.organization_id
    where team.id = team_assessment_assignments.team_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);

drop policy if exists "team_assessment_participants_read_member" on public.team_assessment_participants;
create policy "team_assessment_participants_read_member"
on public.team_assessment_participants
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
    where assignment.id = team_assessment_participants.team_assessment_assignment_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);
