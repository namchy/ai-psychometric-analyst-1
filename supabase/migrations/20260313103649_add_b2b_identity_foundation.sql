create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('org_owner', 'hr_admin', 'manager')),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  full_name text not null,
  participant_type text not null check (participant_type in ('employee', 'candidate')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create unique index idx_organizations_slug on public.organizations(slug);
create index idx_organization_memberships_user_id on public.organization_memberships(user_id);
create index idx_organization_memberships_organization_id on public.organization_memberships(organization_id);
create index idx_participants_organization_id on public.participants(organization_id);
create index idx_participants_user_id on public.participants(user_id);
create unique index idx_participants_org_email on public.participants(organization_id, lower(email));

alter table public.attempts
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists participant_id uuid references public.participants(id) on delete set null;

create index if not exists idx_attempts_organization_id on public.attempts(organization_id);
create index if not exists idx_attempts_participant_id on public.attempts(participant_id);

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.participants enable row level security;

drop policy if exists "organizations_read_member" on public.organizations;
drop policy if exists "organization_memberships_read_own" on public.organization_memberships;
drop policy if exists "participants_read_member" on public.participants;

create policy "organization_memberships_read_own"
on public.organization_memberships
for select
to authenticated
using (
  user_id = auth.uid()
);

create policy "organizations_read_member"
on public.organizations
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = organizations.id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);

create policy "participants_read_member"
on public.participants
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = participants.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);

drop policy if exists "attempts_read_own" on public.attempts;
drop policy if exists "responses_read_own" on public.responses;
drop policy if exists "dimension_scores_read_own" on public.dimension_scores;
drop policy if exists "response_selections_read_own" on public.response_selections;
drop policy if exists "attempt_reports_read_own" on public.attempt_reports;

create policy "attempts_read_own"
on public.attempts
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.participants participant
    where participant.id = attempts.participant_id
      and participant.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = attempts.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);

create policy "responses_read_own"
on public.responses
for select
to authenticated
using (
  exists (
    select 1
    from public.attempts attempt
    left join public.participants participant
      on participant.id = attempt.participant_id
    left join public.organization_memberships membership
      on membership.organization_id = attempt.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
    where attempt.id = responses.attempt_id
      and (
        attempt.user_id = auth.uid()
        or participant.user_id = auth.uid()
        or membership.id is not null
      )
  )
);

create policy "dimension_scores_read_own"
on public.dimension_scores
for select
to authenticated
using (
  exists (
    select 1
    from public.attempts attempt
    left join public.participants participant
      on participant.id = attempt.participant_id
    left join public.organization_memberships membership
      on membership.organization_id = attempt.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
    where attempt.id = dimension_scores.attempt_id
      and (
        attempt.user_id = auth.uid()
        or participant.user_id = auth.uid()
        or membership.id is not null
      )
  )
);

create policy "response_selections_read_own"
on public.response_selections
for select
to authenticated
using (
  exists (
    select 1
    from public.responses response
    join public.attempts attempt
      on attempt.id = response.attempt_id
    left join public.participants participant
      on participant.id = attempt.participant_id
    left join public.organization_memberships membership
      on membership.organization_id = attempt.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
    where response.id = response_selections.response_id
      and (
        attempt.user_id = auth.uid()
        or participant.user_id = auth.uid()
        or membership.id is not null
      )
  )
);

create policy "attempt_reports_read_own"
on public.attempt_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.attempts attempt
    left join public.participants participant
      on participant.id = attempt.participant_id
    left join public.organization_memberships membership
      on membership.organization_id = attempt.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
    where attempt.id = attempt_reports.attempt_id
      and (
        attempt.user_id = auth.uid()
        or participant.user_id = auth.uid()
        or membership.id is not null
      )
  )
);
