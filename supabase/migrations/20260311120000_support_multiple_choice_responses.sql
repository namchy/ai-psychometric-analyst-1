do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'answer_options_id_question_id_unique'
      and conrelid = 'public.answer_options'::regclass
  ) then
    alter table public.answer_options
      add constraint answer_options_id_question_id_unique unique (id, question_id);
  end if;
end $$;

alter table public.responses
  add column if not exists response_kind text;

update public.responses r
set response_kind = case
  when q.question_type = 'text' then 'text'
  when q.question_type = 'multiple_choice' then 'multiple_choice'
  else 'single_choice'
end
from public.questions q
where q.id = r.question_id
  and r.response_kind is null;

drop index if exists idx_responses_text_once_per_question;
drop index if exists idx_responses_selected_option_once_per_question;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'responses_id_question_id_unique'
      and conrelid = 'public.responses'::regclass
  ) then
    alter table public.responses
      add constraint responses_id_question_id_unique unique (id, question_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'responses_attempt_id_question_id_key'
      and conrelid = 'public.responses'::regclass
  ) then
    alter table public.responses
      add constraint responses_attempt_id_question_id_key unique (attempt_id, question_id);
  end if;
end $$;

alter table public.responses
  drop constraint if exists responses_answer_option_id_fkey;

alter table public.responses
  drop constraint if exists responses_value_shape_check;

alter table public.responses
  drop constraint if exists responses_response_kind_check;

create table if not exists public.response_selections (
  response_id uuid not null,
  question_id uuid not null,
  answer_option_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (response_id, answer_option_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'response_selections_response_fk'
      and conrelid = 'public.response_selections'::regclass
  ) then
    alter table public.response_selections
      add constraint response_selections_response_fk
        foreign key (response_id, question_id)
        references public.responses (id, question_id)
        on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'response_selections_answer_option_fk'
      and conrelid = 'public.response_selections'::regclass
  ) then
    alter table public.response_selections
      add constraint response_selections_answer_option_fk
        foreign key (answer_option_id, question_id)
        references public.answer_options (id, question_id)
        on delete restrict;
  end if;
end $$;

with canonical_multiple_choice_responses as (
  select
    r.attempt_id,
    r.question_id,
    min(r.id::text)::uuid as response_id
  from public.responses r
  join public.questions q
    on q.id = r.question_id
  where q.question_type = 'multiple_choice'
  group by r.attempt_id, r.question_id
)
insert into public.response_selections (response_id, question_id, answer_option_id)
select
  canonical.response_id,
  r.question_id,
  r.answer_option_id
from public.responses r
join public.questions q
  on q.id = r.question_id
join canonical_multiple_choice_responses canonical
  on canonical.attempt_id = r.attempt_id
  and canonical.question_id = r.question_id
where q.question_type = 'multiple_choice'
  and r.answer_option_id is not null
on conflict (response_id, answer_option_id) do nothing;

with canonical_multiple_choice_responses as (
  select
    r.attempt_id,
    r.question_id,
    min(r.id::text)::uuid as response_id
  from public.responses r
  join public.questions q
    on q.id = r.question_id
  where q.question_type = 'multiple_choice'
  group by r.attempt_id, r.question_id
)
update public.responses r
set
  answer_option_id = null,
  text_value = null
from canonical_multiple_choice_responses canonical
where r.id = canonical.response_id;

with canonical_multiple_choice_responses as (
  select
    r.attempt_id,
    r.question_id,
    min(r.id::text)::uuid as response_id
  from public.responses r
  join public.questions q
    on q.id = r.question_id
  where q.question_type = 'multiple_choice'
  group by r.attempt_id, r.question_id
)
delete from public.responses r
using canonical_multiple_choice_responses canonical, public.questions q
where q.id = r.question_id
  and q.question_type = 'multiple_choice'
  and r.attempt_id = canonical.attempt_id
  and r.question_id = canonical.question_id
  and r.id <> canonical.response_id;

alter table public.responses
  add constraint responses_response_kind_check
    check (response_kind in ('single_choice', 'multiple_choice', 'text')),
  add constraint responses_value_shape_check
    check (
      (response_kind = 'single_choice' and answer_option_id is not null and text_value is null)
      or (response_kind = 'multiple_choice' and answer_option_id is null and text_value is null)
      or (response_kind = 'text' and answer_option_id is null and text_value is not null)
    ),
  add constraint responses_answer_option_matches_question_fk
    foreign key (answer_option_id, question_id)
    references public.answer_options (id, question_id)
    on delete restrict;

alter table public.responses
  alter column response_kind set default 'single_choice',
  alter column response_kind set not null;

create index if not exists idx_response_selections_answer_option_id
  on public.response_selections (answer_option_id);

create index if not exists idx_response_selections_question_id
  on public.response_selections (question_id);

alter table public.response_selections enable row level security;

drop policy if exists "response_selections_read_own" on public.response_selections;

create policy "response_selections_read_own"
on public.response_selections
for select
using (
  exists (
    select 1
    from public.responses r
    join public.attempts a
      on a.id = r.attempt_id
    where r.id = response_selections.response_id
      and a.user_id = auth.uid()
  )
);
