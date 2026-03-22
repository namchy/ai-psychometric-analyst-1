alter table public.attempt_reports
  add column if not exists completed_at timestamptz,
  add column if not exists report_type text,
  add column if not exists audience text,
  add column if not exists source_type text,
  add column if not exists prompt_version_id uuid,
  add column if not exists model_name text,
  add column if not exists generator_version text,
  add column if not exists input_snapshot jsonb,
  add column if not exists started_at timestamptz;

update public.attempt_reports
set
  report_type = coalesce(report_type, 'individual'),
  audience = coalesce(audience, 'participant'),
  source_type = coalesce(source_type, 'single_test')
where report_type is null
   or audience is null
   or source_type is null;

alter table public.attempt_reports
  alter column report_type set not null,
  alter column audience set not null,
  alter column source_type set not null;

alter table public.attempt_reports
  drop constraint if exists attempt_reports_attempt_id_key;

drop index if exists public.idx_attempt_reports_attempt_id;

create index if not exists idx_attempt_reports_attempt_id
  on public.attempt_reports (attempt_id);

create unique index if not exists attempt_reports_artifact_identity_idx
  on public.attempt_reports (attempt_id, report_type, audience, source_type);

create index if not exists idx_attempt_reports_queue_lookup
  on public.attempt_reports (report_status, audience, generated_at, id);

alter table public.attempt_reports
  drop constraint if exists attempt_reports_report_status_check;

alter table public.attempt_reports
  add constraint attempt_reports_report_status_check
  check (report_status in ('queued', 'processing', 'ready', 'failed', 'unavailable'));

alter table public.attempt_reports
  drop constraint if exists attempt_reports_snapshot_consistency_check;

alter table public.attempt_reports
  add constraint attempt_reports_snapshot_consistency_check
  check (
    (report_status = 'ready' and report_snapshot is not null and failure_code is null and failure_reason is null)
    or (report_status in ('queued', 'processing') and report_snapshot is null and failure_code is null and failure_reason is null)
    or (report_status in ('failed', 'unavailable') and report_snapshot is null)
  );

alter table public.attempt_reports
  drop constraint if exists attempt_reports_audience_check;

alter table public.attempt_reports
  add constraint attempt_reports_audience_check
  check (audience in ('participant', 'hr'));

create or replace function public.enqueue_individual_reports(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test_slug text;
begin
  select t.slug
  into v_test_slug
  from public.attempts a
  join public.tests t
    on t.id = a.test_id
  where a.id = p_attempt_id;

  if v_test_slug is null then
    raise exception 'Attempt % was not found or is missing a linked test.', p_attempt_id;
  end if;

  insert into public.attempt_reports (
    attempt_id,
    test_slug,
    generator_type,
    generated_at,
    report_status,
    failure_code,
    failure_reason,
    report_snapshot,
    completed_at,
    report_type,
    audience,
    source_type,
    prompt_version_id,
    model_name,
    generator_version,
    input_snapshot,
    started_at
  )
  select
    p_attempt_id,
    v_test_slug,
    coalesce(config.generator_type, 'mock'),
    now(),
    'queued',
    null,
    null,
    null,
    null,
    'individual',
    audience_list.audience,
    'single_test',
    null,
    config.model_name,
    null,
    null,
    null
  from (values ('participant'::text), ('hr'::text)) as audience_list(audience)
  left join lateral (
    select runtime.generator_type, runtime.model_name
    from public.report_runtime_configs runtime
    where runtime.report_type = 'individual'
      and runtime.audience = audience_list.audience
      and runtime.source_type = 'single_test'
      and runtime.is_active = true
    order by runtime.updated_at desc, runtime.created_at desc, runtime.id desc
    limit 1
  ) config on true
  on conflict (attempt_id, report_type, audience, source_type) do nothing;
end;
$$;

create or replace function public.claim_report_job(p_attempt_id uuid, p_audience text)
returns table (
  id uuid,
  attempt_id uuid,
  test_slug text,
  generator_type text,
  generated_at timestamptz,
  report_status text,
  report_type text,
  audience text,
  source_type text,
  prompt_version_id uuid,
  model_name text,
  generator_version text,
  input_snapshot jsonb,
  started_at timestamptz,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select report.id
    from public.attempt_reports report
    where report.report_status = 'queued'
      and (p_attempt_id is null or report.attempt_id = p_attempt_id)
      and (p_audience is null or report.audience = p_audience)
    order by report.generated_at asc, report.id asc
    limit 1
    for update skip locked
  )
  update public.attempt_reports report
  set
    report_status = 'processing',
    started_at = coalesce(report.started_at, now()),
    completed_at = null,
    failure_code = null,
    failure_reason = null
  from candidate
  where report.id = candidate.id
  returning
    report.id,
    report.attempt_id,
    report.test_slug,
    report.generator_type,
    report.generated_at,
    report.report_status,
    report.report_type,
    report.audience,
    report.source_type,
    report.prompt_version_id,
    report.model_name,
    report.generator_version,
    report.input_snapshot,
    report.started_at,
    report.completed_at;
end;
$$;

create or replace function public.complete_report_job(
  p_report_id uuid,
  p_report_snapshot jsonb,
  p_model_name text,
  p_generator_version text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.attempt_reports
  set
    report_status = 'ready',
    report_snapshot = p_report_snapshot,
    generated_at = coalesce((p_report_snapshot ->> 'generated_at')::timestamptz, generated_at),
    completed_at = now(),
    failure_code = null,
    failure_reason = null,
    model_name = coalesce(p_model_name, model_name),
    generator_version = coalesce(p_generator_version, generator_version)
  where id = p_report_id;

  if not found then
    raise exception 'Attempt report % was not found.', p_report_id;
  end if;
end;
$$;

create or replace function public.fail_report_job(
  p_report_id uuid,
  p_failure_code text,
  p_failure_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.attempt_reports
  set
    report_status = 'failed',
    report_snapshot = null,
    completed_at = now(),
    failure_code = p_failure_code,
    failure_reason = p_failure_reason
  where id = p_report_id;

  if not found then
    raise exception 'Attempt report % was not found.', p_report_id;
  end if;
end;
$$;

revoke all on function public.enqueue_individual_reports(uuid) from public;
grant execute on function public.enqueue_individual_reports(uuid) to service_role;

revoke all on function public.claim_report_job(uuid, text) from public;
grant execute on function public.claim_report_job(uuid, text) to service_role;

revoke all on function public.complete_report_job(uuid, jsonb, text, text) from public;
grant execute on function public.complete_report_job(uuid, jsonb, text, text) to service_role;

revoke all on function public.fail_report_job(uuid, text, text) from public;
grant execute on function public.fail_report_job(uuid, text, text) to service_role;
