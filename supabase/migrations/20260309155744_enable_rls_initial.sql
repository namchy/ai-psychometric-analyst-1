-- Enable RLS on all core tables

alter table public.tests enable row level security;
alter table public.questions enable row level security;
alter table public.answer_options enable row level security;
alter table public.attempts enable row level security;
alter table public.responses enable row level security;
alter table public.dimension_scores enable row level security;

-- Clean re-run safety: drop policies if they already exist

drop policy if exists "tests_read_public" on public.tests;
drop policy if exists "questions_read_public" on public.questions;
drop policy if exists "answer_options_read_public" on public.answer_options;

drop policy if exists "attempts_read_own" on public.attempts;
drop policy if exists "responses_read_own" on public.responses;
drop policy if exists "dimension_scores_read_own" on public.dimension_scores;

-- PUBLIC READ POLICIES
-- For MVP, expose only active records.
-- Important: this assumes your seeded test has is_active = true.

create policy "tests_read_public"
on public.tests
for select
to anon, authenticated
using (
  is_active = true
);

create policy "questions_read_public"
on public.questions
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.tests t
    where t.id = questions.test_id
      and t.is_active = true
  )
);

create policy "answer_options_read_public"
on public.answer_options
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.questions q
    join public.tests t on t.id = q.test_id
    where q.id = answer_options.question_id
      and q.is_active = true
      and t.is_active = true
  )
);

-- PRIVATE USER DATA POLICIES
-- Only authenticated users can read their own attempts and related data.
-- This assumes attempts.user_id will store auth.uid().

create policy "attempts_read_own"
on public.attempts
for select
to authenticated
using (
  user_id = auth.uid()
);

create policy "responses_read_own"
on public.responses
for select
to authenticated
using (
  exists (
    select 1
    from public.attempts a
    where a.id = responses.attempt_id
      and a.user_id = auth.uid()
  )
);

create policy "dimension_scores_read_own"
on public.dimension_scores
for select
to authenticated
using (
  exists (
    select 1
    from public.attempts a
    where a.id = dimension_scores.attempt_id
      and a.user_id = auth.uid()
  )
);