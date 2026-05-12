create table if not exists public.assessment_assignment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_assignment_id uuid not null references public.assessment_assignments(id) on delete cascade,
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  test_id uuid not null references public.tests(id) on delete cascade,
  test_slug text not null,
  role_in_assignment text not null default 'standard_component',
  required_for_composite boolean not null default true,
  required_for_team_fit boolean not null default false,
  position integer null,
  linked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint assessment_assignment_attempts_role_in_assignment_check
    check (role_in_assignment in ('standard_component', 'team_fit_component', 'optional_component')),
  constraint assessment_assignment_attempts_assignment_test_unique
    unique (assessment_assignment_id, test_id),
  constraint assessment_assignment_attempts_attempt_unique
    unique (attempt_id)
);

create index if not exists assessment_assignment_attempts_assignment_idx
  on public.assessment_assignment_attempts (assessment_assignment_id);

create index if not exists assessment_assignment_attempts_attempt_idx
  on public.assessment_assignment_attempts (attempt_id);

create index if not exists assessment_assignment_attempts_test_idx
  on public.assessment_assignment_attempts (test_id);

create index if not exists assessment_assignment_attempts_test_slug_idx
  on public.assessment_assignment_attempts (test_slug);

alter table public.assessment_assignment_attempts enable row level security;

drop policy if exists "assessment_assignment_attempts_read_member" on public.assessment_assignment_attempts;

create policy "assessment_assignment_attempts_read_member"
on public.assessment_assignment_attempts
for select
to authenticated
using (
  exists (
    select 1
    from public.assessment_assignments assignment
    join public.organization_memberships membership
      on membership.organization_id = assignment.organization_id
    where assignment.id = assessment_assignment_attempts.assessment_assignment_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);
