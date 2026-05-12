create table if not exists public.assessment_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  assignment_type text not null,
  status text not null default 'active',
  locale text not null default 'bs',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  constraint assessment_assignments_assignment_type_check
    check (assignment_type in ('standard_battery')),
  constraint assessment_assignments_status_check
    check (status in ('active', 'completed', 'abandoned', 'cancelled'))
);

create index if not exists assessment_assignments_organization_participant_created_idx
  on public.assessment_assignments (organization_id, participant_id, created_at desc);

create index if not exists assessment_assignments_participant_created_idx
  on public.assessment_assignments (participant_id, created_at desc);

create index if not exists assessment_assignments_status_idx
  on public.assessment_assignments (status);

create unique index if not exists assessment_assignments_one_active_standard_battery_idx
  on public.assessment_assignments (organization_id, participant_id, assignment_type)
  where status = 'active' and assignment_type = 'standard_battery';

create or replace function public.set_assessment_assignments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_assessment_assignments_updated_at on public.assessment_assignments;

create trigger set_assessment_assignments_updated_at
before update on public.assessment_assignments
for each row
execute function public.set_assessment_assignments_updated_at();

alter table public.assessment_assignments enable row level security;

drop policy if exists "assessment_assignments_read_member" on public.assessment_assignments;

create policy "assessment_assignments_read_member"
on public.assessment_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = assessment_assignments.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);
