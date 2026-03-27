create or replace function public.get_active_prompt_version(
  p_test_id uuid,
  p_report_type text,
  p_audience text,
  p_source_type text,
  p_generator_type text,
  p_prompt_key text
)
returns table (
  id uuid,
  test_id uuid,
  report_type text,
  audience text,
  source_type text,
  generator_type text,
  prompt_key text,
  version text,
  system_prompt text,
  user_prompt_template text,
  output_schema_json jsonb,
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
    prompt.id,
    prompt.test_id,
    prompt.report_type,
    prompt.audience,
    prompt.source_type,
    prompt.generator_type,
    prompt.prompt_key,
    prompt.version,
    prompt.system_prompt,
    prompt.user_prompt_template,
    prompt.output_schema_json,
    prompt.notes,
    prompt.created_at,
    prompt.updated_at,
    prompt.updated_by
  from public.prompt_versions prompt
  where prompt.report_type = p_report_type
    and prompt.audience = p_audience
    and prompt.source_type = p_source_type
    and prompt.generator_type = p_generator_type
    and prompt.prompt_key = p_prompt_key
    and prompt.is_active = true
    and (prompt.test_id = p_test_id or prompt.test_id is null)
  order by
    case
      when prompt.test_id = p_test_id then 0
      when prompt.test_id is null then 1
      else 2
    end,
    prompt.updated_at desc,
    prompt.created_at desc,
    prompt.id desc
  limit 1;
$$;

revoke all on function public.get_active_prompt_version(uuid, text, text, text, text, text) from public;
grant execute on function public.get_active_prompt_version(uuid, text, text, text, text, text) to service_role;