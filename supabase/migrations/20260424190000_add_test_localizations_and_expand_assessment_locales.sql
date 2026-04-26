alter table public.attempts
  alter column locale set default 'bs-Latn-BA';

alter table public.attempts
  drop constraint if exists attempts_locale_check,
  add constraint attempts_locale_check
    check (locale in ('bs', 'hr', 'en', 'sr', 'bs-Latn-BA', 'hr-Latn-HR'));

alter table public.question_localizations
  drop constraint if exists question_localizations_locale_check,
  add constraint question_localizations_locale_check
    check (locale in ('bs', 'hr', 'en', 'sr', 'bs-Latn-BA', 'hr-Latn-HR'));

alter table public.answer_option_localizations
  drop constraint if exists answer_option_localizations_locale_check,
  add constraint answer_option_localizations_locale_check
    check (locale in ('bs', 'hr', 'en', 'sr', 'bs-Latn-BA', 'hr-Latn-HR'));

alter table public.prompt_version_localizations
  drop constraint if exists prompt_version_localizations_locale_check,
  add constraint prompt_version_localizations_locale_check
    check (locale in ('bs', 'hr', 'en', 'sr', 'bs-Latn-BA', 'hr-Latn-HR'));

create table if not exists public.test_localizations (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  locale text not null
    check (locale in ('bs', 'hr', 'en', 'sr', 'bs-Latn-BA', 'hr-Latn-HR')),
  name text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (test_id, locale)
);

create index if not exists idx_test_localizations_test_id
  on public.test_localizations (test_id);

create index if not exists idx_test_localizations_locale
  on public.test_localizations (locale);

create or replace function public.set_test_localizations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_test_localizations_updated_at on public.test_localizations;

create trigger set_test_localizations_updated_at
before update on public.test_localizations
for each row
execute function public.set_test_localizations_updated_at();

alter table public.test_localizations enable row level security;

grant select, insert, update, delete on table public.test_localizations to service_role;
