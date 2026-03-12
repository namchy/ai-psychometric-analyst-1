create table public.attempt_reports (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.attempts(id) on delete cascade,
  test_slug text not null,
  generator_type text not null check (generator_type in ('mock')),
  generated_at timestamptz not null default now(),
  report_snapshot jsonb not null
);

create index idx_attempt_reports_attempt_id on public.attempt_reports(attempt_id);

alter table public.attempt_reports enable row level security;

drop policy if exists "attempt_reports_read_own" on public.attempt_reports;

create policy "attempt_reports_read_own"
on public.attempt_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.attempts a
    where a.id = attempt_reports.attempt_id
      and a.user_id = auth.uid()
  )
);
