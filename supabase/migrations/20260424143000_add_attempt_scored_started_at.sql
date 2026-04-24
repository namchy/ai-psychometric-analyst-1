alter table public.attempts
  add column if not exists scored_started_at timestamptz null;
