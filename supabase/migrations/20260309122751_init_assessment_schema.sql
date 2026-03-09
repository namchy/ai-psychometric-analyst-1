create extension if not exists pgcrypto;

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null check (category in ('personality', 'behavioral', 'cognitive')),
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  scoring_method text not null default 'likert_sum' check (scoring_method in ('likert_sum', 'correct_answers', 'weighted_correct')),
  duration_minutes integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  code text not null,
  text text not null,
  help_text text,
  dimension text not null,
  question_type text not null default 'single_choice' check (question_type in ('single_choice', 'multiple_choice', 'text')),
  question_order integer not null,
  reverse_scored boolean not null default false,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  weight numeric(6,2) not null default 1.00,
  is_required boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (test_id, code),
  unique (test_id, question_order)
);

create table public.answer_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  code text,
  label text not null,
  value integer,
  option_order integer not null,
  is_correct boolean,
  created_at timestamptz not null default now(),
  unique (question_id, option_order)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  test_id uuid not null references public.tests(id) on delete restrict,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_time_seconds integer,
  metadata jsonb not null default '{}'::jsonb
);

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  answer_option_id uuid references public.answer_options(id) on delete restrict,
  raw_value integer,
  scored_value numeric(8,2),
  text_value text,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table public.dimension_scores (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  dimension text not null,
  raw_score numeric(10,2) not null,
  normalized_score numeric(10,2),
  percentile_score numeric(10,2),
  interpretation text,
  created_at timestamptz not null default now(),
  unique (attempt_id, dimension)
);

create index idx_questions_test_id on public.questions(test_id);
create index idx_questions_dimension on public.questions(dimension);
create index idx_answer_options_question_id on public.answer_options(question_id);
create index idx_attempts_test_id on public.attempts(test_id);
create index idx_attempts_user_id on public.attempts(user_id);
create index idx_responses_attempt_id on public.responses(attempt_id);
create index idx_responses_question_id on public.responses(question_id);
create index idx_dimension_scores_attempt_id on public.dimension_scores(attempt_id);
