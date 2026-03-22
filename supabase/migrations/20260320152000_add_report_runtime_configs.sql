create table if not exists public.report_runtime_configs (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  audience text not null,
  source_type text not null,
  generator_type text not null check (generator_type in ('mock', 'openai')),
  model_name text,
  reasoning_effort text,
  temperature numeric(3,2),
  is_active boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint report_runtime_configs_audience_check
    check (audience in ('participant', 'hr')),
  constraint report_runtime_configs_temperature_check
    check (temperature is null or (temperature >= 0 and temperature <= 2))
);

create index if not exists idx_report_runtime_configs_lookup
  on public.report_runtime_configs (report_type, audience, source_type, generator_type, is_active);

create unique index if not exists report_runtime_configs_one_active_idx
  on public.report_runtime_configs (report_type, audience, source_type, generator_type)
  where is_active = true;

create or replace function public.set_report_runtime_configs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_report_runtime_configs_updated_at on public.report_runtime_configs;

create trigger set_report_runtime_configs_updated_at
before update on public.report_runtime_configs
for each row
execute function public.set_report_runtime_configs_updated_at();

alter table public.report_runtime_configs enable row level security;

create or replace function public.get_active_report_runtime_config(
  p_report_type text,
  p_audience text,
  p_source_type text,
  p_generator_type text
)
returns table (
  id uuid,
  report_type text,
  audience text,
  source_type text,
  generator_type text,
  model_name text,
  reasoning_effort text,
  temperature numeric,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  updated_by uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    config.id,
    config.report_type,
    config.audience,
    config.source_type,
    config.generator_type,
    config.model_name,
    config.reasoning_effort,
    config.temperature,
    config.notes,
    config.created_at,
    config.updated_at,
    config.updated_by
  from public.report_runtime_configs config
  where config.report_type = p_report_type
    and config.audience = p_audience
    and config.source_type = p_source_type
    and config.generator_type = p_generator_type
    and config.is_active = true
  order by config.updated_at desc, config.created_at desc, config.id desc
  limit 1;
$$;

revoke all on function public.get_active_report_runtime_config(text, text, text, text) from public;
grant execute on function public.get_active_report_runtime_config(text, text, text, text) to service_role;

insert into public.report_runtime_configs (
  report_type,
  audience,
  source_type,
  generator_type,
  model_name,
  reasoning_effort,
  temperature,
  is_active,
  notes
)
values (
  'individual',
  'participant',
  'single_test',
  'openai',
  'gpt-5.4-mini',
  null,
  null,
  true,
  'Default runtime config for participant single-test individual OpenAI reports.'
)
on conflict do nothing;
