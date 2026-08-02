-- Forward-only AI transport usage and immutable pricing accounting foundation.
-- No prompt, response, API key or psychometric content is stored here.

create table public.ai_model_pricing_versions (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  service_tier text not null default 'standard',
  pricing_version text not null,
  currency text not null default 'usd',
  effective_from timestamptz not null,
  effective_to timestamptz,
  input_usd_per_million numeric(18,8) not null check (input_usd_per_million >= 0),
  cached_input_usd_per_million numeric(18,8) not null check (cached_input_usd_per_million >= 0),
  cache_write_usd_per_million numeric(18,8) not null check (cache_write_usd_per_million >= 0),
  output_usd_per_million numeric(18,8) not null check (output_usd_per_million >= 0),
  long_context_threshold_tokens bigint not null check (long_context_threshold_tokens > 0),
  long_context_input_multiplier numeric(12,6) not null check (long_context_input_multiplier >= 1),
  long_context_output_multiplier numeric(12,6) not null check (long_context_output_multiplier >= 1),
  source_name text not null,
  source_checked_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (provider, model, service_tier, pricing_version)
);

insert into public.ai_model_pricing_versions (
  id,
  provider,
  model,
  service_tier,
  pricing_version,
  currency,
  effective_from,
  input_usd_per_million,
  cached_input_usd_per_million,
  cache_write_usd_per_million,
  output_usd_per_million,
  long_context_threshold_tokens,
  long_context_input_multiplier,
  long_context_output_multiplier,
  source_name,
  source_checked_at
)
values (
  '6f60f8f9-64f6-4bc3-a2d7-5d8b1f93b78f',
  'openai',
  'gpt-5.6-sol',
  'standard',
  'openai_gpt_5_6_sol_standard_20260802',
  'usd',
  '2026-08-02T00:00:00Z',
  5.00,
  0.50,
  6.25,
  30.00,
  272000,
  2.0,
  1.5,
  'OpenAI published pricing snapshot',
  '2026-08-02T00:00:00Z'
)
on conflict (provider, model, service_tier, pricing_version) do nothing;

create table public.ai_generation_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  participant_id uuid,
  assessment_assignment_id uuid,
  attempt_id uuid,
  attempt_report_id uuid,
  assessment_report_id uuid,
  report_type text not null,
  call_purpose text not null check (call_purpose in (
    'single_test_hr_generation',
    'single_test_participant_generation',
    'composite_hr_generation',
    'composite_hr_diagnostic_review',
    'individual_development_profile_generation'
  )),
  provider text not null,
  endpoint text not null,
  service_tier text not null,
  requested_model text not null,
  response_model text,
  reasoning_effort text,
  provider_request_id text,
  request_status text not null check (request_status in ('started', 'succeeded', 'failed')),
  http_status integer,
  attempt_number integer not null default 1 check (attempt_number > 0),
  input_tokens bigint check (input_tokens >= 0),
  cached_input_tokens bigint check (cached_input_tokens >= 0),
  cache_write_tokens bigint check (cache_write_tokens >= 0),
  output_tokens bigint check (output_tokens >= 0),
  reasoning_tokens bigint check (reasoning_tokens >= 0),
  total_tokens bigint check (total_tokens >= 0),
  usage_details_complete boolean not null default false,
  provider_processing_ms bigint check (provider_processing_ms >= 0),
  duration_ms bigint check (duration_ms >= 0),
  pricing_version_id uuid not null references public.ai_model_pricing_versions(id),
  pricing_version text not null,
  currency text not null,
  input_rate_snapshot numeric(18,8) not null,
  cached_input_rate_snapshot numeric(18,8) not null,
  cache_write_rate_snapshot numeric(18,8) not null,
  output_rate_snapshot numeric(18,8) not null,
  long_context_threshold_tokens_snapshot bigint not null,
  long_context_input_multiplier_snapshot numeric(12,6) not null,
  long_context_output_multiplier_snapshot numeric(12,6) not null,
  uncached_input_cost_usd numeric(18,8),
  cached_input_cost_usd numeric(18,8),
  cache_write_cost_usd numeric(18,8),
  output_cost_usd numeric(18,8),
  historical_estimated_cost_usd numeric(18,8),
  cost_estimate_status text not null check (cost_estimate_status in ('complete', 'partial', 'unavailable')),
  started_at timestamptz not null,
  completed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.ai_model_pricing_versions enable row level security;
alter table public.ai_generation_usage_events enable row level security;

grant select, insert on table public.ai_model_pricing_versions to service_role;
grant select, insert, update on table public.ai_generation_usage_events to service_role;

create index ai_generation_usage_events_completed_at_idx
  on public.ai_generation_usage_events (completed_at desc);
create index ai_generation_usage_events_organization_completed_at_idx
  on public.ai_generation_usage_events (organization_id, completed_at desc);
create index ai_generation_usage_events_participant_completed_at_idx
  on public.ai_generation_usage_events (participant_id, completed_at desc);
create index ai_generation_usage_events_report_type_completed_at_idx
  on public.ai_generation_usage_events (report_type, completed_at desc);
create index ai_generation_usage_events_model_completed_at_idx
  on public.ai_generation_usage_events (requested_model, completed_at desc);
create index ai_generation_usage_events_status_completed_at_idx
  on public.ai_generation_usage_events (request_status, completed_at desc);
