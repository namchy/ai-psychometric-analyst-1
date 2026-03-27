


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."claim_report_job"("p_attempt_id" "uuid", "p_audience" "text") RETURNS TABLE("id" "uuid", "attempt_id" "uuid", "test_slug" "text", "generator_type" "text", "generated_at" timestamp with time zone, "report_status" "text", "report_type" "text", "audience" "text", "source_type" "text", "prompt_version_id" "uuid", "model_name" "text", "generator_version" "text", "input_snapshot" "jsonb", "started_at" timestamp with time zone, "completed_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."claim_report_job"("p_attempt_id" "uuid", "p_audience" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_report_job"("p_report_id" "uuid", "p_report_snapshot" "jsonb", "p_model_name" "text", "p_generator_version" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."complete_report_job"("p_report_id" "uuid", "p_report_snapshot" "jsonb", "p_model_name" "text", "p_generator_version" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_individual_reports"("p_attempt_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."enqueue_individual_reports"("p_attempt_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fail_report_job"("p_report_id" "uuid", "p_failure_code" "text", "p_failure_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."fail_report_job"("p_report_id" "uuid", "p_failure_code" "text", "p_failure_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_report_runtime_config"("p_report_type" "text", "p_audience" "text", "p_source_type" "text", "p_generator_type" "text") RETURNS TABLE("id" "uuid", "report_type" "text", "audience" "text", "source_type" "text", "generator_type" "text", "model_name" "text", "reasoning_effort" "text", "temperature" numeric, "notes" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "updated_by" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_active_report_runtime_config"("p_report_type" "text", "p_audience" "text", "p_source_type" "text", "p_generator_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_assessment_package"("p_package" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_test jsonb;
  v_test_slug text;
  v_test_id uuid;
  v_dimension jsonb;
  v_item jsonb;
  v_mapping jsonb;
  v_option jsonb;
  v_prompt jsonb;
  v_question_locale jsonb;
  v_option_locale jsonb;
  v_prompt_locale jsonb;
  v_dimension_id uuid;
  v_question_id uuid;
  v_prompt_id uuid;
  v_prompt_test_id uuid;
  v_primary_mapping jsonb;
  v_dimensions_count integer := 0;
  v_questions_count integer := 0;
  v_mappings_count integer := 0;
  v_options_count integer := 0;
  v_prompts_count integer := 0;
  v_question_localizations_count integer := 0;
  v_option_localizations_count integer := 0;
  v_prompt_localizations_count integer := 0;
  v_existing_prompt_count integer;
begin
  if jsonb_typeof(p_package) <> 'object' then
    raise exception 'Package payload must be a JSON object.';
  end if;

  v_test := p_package -> 'test';

  if v_test is null or jsonb_typeof(v_test) <> 'object' then
    raise exception 'Package payload is missing test metadata.';
  end if;

  v_test_slug := nullif(trim(v_test ->> 'slug'), '');

  if v_test_slug is null then
    raise exception 'Package test.slug is required.';
  end if;

  if jsonb_typeof(coalesce(p_package -> 'locales', '{}'::jsonb)) <> 'object' then
    raise exception 'Package locales must be a JSON object.';
  end if;

  insert into public.tests (
    slug,
    name,
    category,
    description,
    status,
    scoring_method,
    is_active,
    updated_at
  )
  values (
    v_test_slug,
    v_test ->> 'name',
    v_test ->> 'category',
    v_test ->> 'description',
    v_test ->> 'status',
    v_test ->> 'scoring_method',
    coalesce((v_test ->> 'is_active')::boolean, true),
    now()
  )
  on conflict (slug) do update
  set name = excluded.name,
      category = excluded.category,
      description = excluded.description,
      status = excluded.status,
      scoring_method = excluded.scoring_method,
      is_active = excluded.is_active,
      updated_at = now()
  returning id into v_test_id;

  if v_test_id is null then
    raise exception 'Failed to upsert test for slug %.', v_test_slug;
  end if;

  if jsonb_typeof(coalesce(p_package -> 'dimensions', '[]'::jsonb)) <> 'array' then
    raise exception 'Package dimensions must be a JSON array.';
  end if;

  update public.test_dimensions
  set is_active = false
  where test_id = v_test_id;

  for v_dimension in
    select value
    from jsonb_array_elements(coalesce(p_package -> 'dimensions', '[]'::jsonb))
  loop
    insert into public.test_dimensions (
      test_id,
      code,
      name,
      description,
      display_order,
      is_active
    )
    values (
      v_test_id,
      v_dimension ->> 'code',
      v_dimension ->> 'name',
      v_dimension ->> 'description',
      coalesce((v_dimension ->> 'display_order')::integer, 1),
      coalesce((v_dimension ->> 'is_active')::boolean, true)
    )
    on conflict (test_id, code) do update
    set name = excluded.name,
        description = excluded.description,
        display_order = excluded.display_order,
        is_active = excluded.is_active;

    v_dimensions_count := v_dimensions_count + 1;
  end loop;

  if jsonb_typeof(coalesce(p_package -> 'items', '[]'::jsonb)) <> 'array' then
    raise exception 'Package items must be a JSON array.';
  end if;

  update public.questions
  set question_order = question_order + 1000,
      updated_at = now()
  where test_id = v_test_id;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_package -> 'items', '[]'::jsonb))
  loop
    if jsonb_typeof(coalesce(v_item -> 'mappings', '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(v_item -> 'mappings', '[]'::jsonb)) = 0 then
      raise exception 'Item % must include at least one mapping.', coalesce(v_item ->> 'code', '<unknown>');
    end if;

    v_primary_mapping := (v_item -> 'mappings') -> 0;

    if nullif(trim(v_primary_mapping ->> 'dimension_code'), '') is null then
      raise exception 'Item % primary mapping is missing dimension_code.', coalesce(v_item ->> 'code', '<unknown>');
    end if;

    perform 1
    from public.test_dimensions dimension
    where dimension.test_id = v_test_id
      and dimension.code = v_primary_mapping ->> 'dimension_code';

    if not found then
      raise exception 'Item % references unknown primary dimension_code %.', v_item ->> 'code', v_primary_mapping ->> 'dimension_code';
    end if;

    insert into public.questions (
      test_id,
      code,
      text,
      help_text,
      dimension,
      question_type,
      question_order,
      reverse_scored,
      difficulty,
      weight,
      is_required,
      is_active,
      updated_at
    )
    values (
      v_test_id,
      v_item ->> 'code',
      v_item ->> 'text',
      null,
      v_primary_mapping ->> 'dimension_code',
      v_item ->> 'question_type',
      (v_item ->> 'question_order')::integer,
      coalesce((v_primary_mapping ->> 'reverse_scored')::boolean, false),
      null,
      coalesce((v_primary_mapping ->> 'weight')::numeric(6,2), 1),
      coalesce((v_item ->> 'is_required')::boolean, true),
      coalesce((v_item ->> 'is_active')::boolean, true),
      now()
    )
    on conflict (test_id, code) do update
    set text = excluded.text,
        help_text = excluded.help_text,
        dimension = excluded.dimension,
        question_type = excluded.question_type,
        question_order = excluded.question_order,
        reverse_scored = excluded.reverse_scored,
        difficulty = excluded.difficulty,
        weight = excluded.weight,
        is_required = excluded.is_required,
        is_active = excluded.is_active,
        updated_at = now()
    returning id into v_question_id;

    v_questions_count := v_questions_count + 1;

    for v_mapping in
      select value
      from jsonb_array_elements(v_item -> 'mappings')
    loop
      select dimension.id
      into v_dimension_id
      from public.test_dimensions dimension
      where dimension.test_id = v_test_id
        and dimension.code = v_mapping ->> 'dimension_code';

      if v_dimension_id is null then
        raise exception 'Item % references unknown dimension_code %.', v_item ->> 'code', v_mapping ->> 'dimension_code';
      end if;

      insert into public.question_dimension_mappings (
        question_id,
        dimension_id,
        weight,
        reverse_scored
      )
      values (
        v_question_id,
        v_dimension_id,
        coalesce((v_mapping ->> 'weight')::numeric(8,4), 1),
        coalesce((v_mapping ->> 'reverse_scored')::boolean, false)
      )
      on conflict (question_id, dimension_id) do update
      set weight = excluded.weight,
          reverse_scored = excluded.reverse_scored;

      v_mappings_count := v_mappings_count + 1;
    end loop;

    for v_option in
      select value
      from jsonb_array_elements(coalesce(p_package -> 'options', '[]'::jsonb))
    loop
      insert into public.answer_options (
        question_id,
        code,
        label,
        value,
        option_order,
        is_correct
      )
      values (
        v_question_id,
        v_option ->> 'code',
        v_option ->> 'label',
        (v_option ->> 'value')::integer,
        (v_option ->> 'option_order')::integer,
        null
      )
      on conflict (question_id, option_order) do update
      set code = excluded.code,
          label = excluded.label,
          value = excluded.value,
          is_correct = excluded.is_correct;

      v_options_count := v_options_count + 1;
    end loop;
  end loop;

  for v_question_locale in
    select
      jsonb_build_object(
        'locale', locale.key,
        'entries', locale.value -> 'questions'
      )
    from jsonb_each(coalesce(p_package -> 'locales', '{}'::jsonb)) as locale(key, value)
  loop
    if jsonb_typeof(coalesce(v_question_locale -> 'entries', '[]'::jsonb)) <> 'array' then
      raise exception 'Package locales.%.questions must be a JSON array.', v_question_locale ->> 'locale';
    end if;

    for v_item in
      select value
      from jsonb_array_elements(coalesce(v_question_locale -> 'entries', '[]'::jsonb))
    loop
      select question.id
      into v_question_id
      from public.questions question
      where question.test_id = v_test_id
        and question.code = v_item ->> 'code';

      if v_question_id is null then
        raise exception 'Question localization for locale % references unknown question code %.',
          v_question_locale ->> 'locale',
          v_item ->> 'code';
      end if;

      insert into public.question_localizations (
        question_id,
        locale,
        text
      )
      values (
        v_question_id,
        v_question_locale ->> 'locale',
        v_item ->> 'text'
      )
      on conflict (question_id, locale) do update
      set text = excluded.text,
          updated_at = now();

      v_question_localizations_count := v_question_localizations_count + 1;
    end loop;
  end loop;

  for v_option_locale in
    select
      jsonb_build_object(
        'locale', locale.key,
        'entries', locale.value -> 'options'
      )
    from jsonb_each(coalesce(p_package -> 'locales', '{}'::jsonb)) as locale(key, value)
  loop
    if jsonb_typeof(coalesce(v_option_locale -> 'entries', '[]'::jsonb)) <> 'array' then
      raise exception 'Package locales.%.options must be a JSON array.', v_option_locale ->> 'locale';
    end if;

    for v_option in
      select value
      from jsonb_array_elements(coalesce(v_option_locale -> 'entries', '[]'::jsonb))
    loop
      insert into public.answer_option_localizations (
        answer_option_id,
        locale,
        label
      )
      select
        option.id,
        v_option_locale ->> 'locale',
        v_option ->> 'label'
      from public.questions question
      join public.answer_options option
        on option.question_id = question.id
      where question.test_id = v_test_id
        and option.option_order = (v_option ->> 'option_order')::integer
      on conflict (answer_option_id, locale) do update
      set label = excluded.label,
          updated_at = now();

      if not found then
        raise exception 'Answer option localization for locale % references unknown option_order %.',
          v_option_locale ->> 'locale',
          v_option ->> 'option_order';
      end if;

      get diagnostics v_existing_prompt_count = row_count;
      v_option_localizations_count := v_option_localizations_count + v_existing_prompt_count;
    end loop;
  end loop;

  if jsonb_typeof(coalesce(p_package -> 'prompts', '[]'::jsonb)) <> 'array' then
    raise exception 'Package prompts must be a JSON array.';
  end if;

  for v_prompt in
    select value
    from jsonb_array_elements(coalesce(p_package -> 'prompts', '[]'::jsonb))
  loop
    v_prompt_test_id := case
      when coalesce((v_prompt ->> 'is_global')::boolean, false) then null
      else v_test_id
    end;

    select count(*)
    into v_existing_prompt_count
    from public.prompt_versions prompt
    where prompt.report_type = v_prompt ->> 'report_type'
      and prompt.audience = v_prompt ->> 'audience'
      and prompt.source_type = v_prompt ->> 'source_type'
      and prompt.generator_type = v_prompt ->> 'generator_type'
      and prompt.prompt_key = v_prompt ->> 'prompt_key'
      and prompt.version = v_prompt ->> 'version'
      and (
        (v_prompt_test_id is null and prompt.test_id is null)
        or prompt.test_id = v_prompt_test_id
      );

    if v_existing_prompt_count > 1 then
      raise exception 'Multiple prompt_versions rows found for %/% (%/%/%). Manual cleanup is required.',
        v_prompt ->> 'prompt_key',
        v_prompt ->> 'version',
        v_prompt ->> 'report_type',
        v_prompt ->> 'audience',
        v_prompt ->> 'generator_type';
    end if;

    if coalesce((v_prompt ->> 'is_active')::boolean, false) then
      update public.prompt_versions prompt
      set is_active = false,
          updated_at = now()
      where prompt.report_type = v_prompt ->> 'report_type'
        and prompt.audience = v_prompt ->> 'audience'
        and prompt.source_type = v_prompt ->> 'source_type'
        and prompt.generator_type = v_prompt ->> 'generator_type'
        and prompt.prompt_key = v_prompt ->> 'prompt_key'
        and prompt.is_active = true
        and (
          (v_prompt_test_id is null and prompt.test_id is null)
          or prompt.test_id = v_prompt_test_id
        )
        and not exists (
          select 1
          from public.prompt_versions current_prompt
          where current_prompt.id = prompt.id
            and current_prompt.version = v_prompt ->> 'version'
        );
    end if;

    select prompt.id
    into v_prompt_id
    from public.prompt_versions prompt
    where prompt.report_type = v_prompt ->> 'report_type'
      and prompt.audience = v_prompt ->> 'audience'
      and prompt.source_type = v_prompt ->> 'source_type'
      and prompt.generator_type = v_prompt ->> 'generator_type'
      and prompt.prompt_key = v_prompt ->> 'prompt_key'
      and prompt.version = v_prompt ->> 'version'
      and (
        (v_prompt_test_id is null and prompt.test_id is null)
        or prompt.test_id = v_prompt_test_id
      )
    limit 1;

    if v_prompt_id is null then
      insert into public.prompt_versions (
        test_id,
        report_type,
        audience,
        source_type,
        generator_type,
        prompt_key,
        version,
        system_prompt,
        user_prompt_template,
        output_schema_json,
        is_active,
        notes
      )
      values (
        v_prompt_test_id,
        v_prompt ->> 'report_type',
        v_prompt ->> 'audience',
        v_prompt ->> 'source_type',
        v_prompt ->> 'generator_type',
        v_prompt ->> 'prompt_key',
        v_prompt ->> 'version',
        v_prompt ->> 'system_prompt',
        v_prompt ->> 'user_prompt_template',
        v_prompt -> 'output_schema_json',
        coalesce((v_prompt ->> 'is_active')::boolean, false),
        v_prompt ->> 'notes'
      )
      returning id into v_prompt_id;
    else
      update public.prompt_versions prompt
      set test_id = v_prompt_test_id,
          report_type = v_prompt ->> 'report_type',
          audience = v_prompt ->> 'audience',
          source_type = v_prompt ->> 'source_type',
          generator_type = v_prompt ->> 'generator_type',
          prompt_key = v_prompt ->> 'prompt_key',
          version = v_prompt ->> 'version',
          system_prompt = v_prompt ->> 'system_prompt',
          user_prompt_template = v_prompt ->> 'user_prompt_template',
          output_schema_json = v_prompt -> 'output_schema_json',
          is_active = coalesce((v_prompt ->> 'is_active')::boolean, false),
          notes = v_prompt ->> 'notes',
          updated_at = now()
      where prompt.id = v_prompt_id;
    end if;

    v_prompts_count := v_prompts_count + 1;
  end loop;

  for v_prompt_locale in
    select
      jsonb_build_object(
        'locale', locale.key,
        'entries', locale.value -> 'prompts'
      )
    from jsonb_each(coalesce(p_package -> 'locales', '{}'::jsonb)) as locale(key, value)
  loop
    if jsonb_typeof(coalesce(v_prompt_locale -> 'entries', '[]'::jsonb)) <> 'array' then
      raise exception 'Package locales.%.prompts must be a JSON array.', v_prompt_locale ->> 'locale';
    end if;

    for v_prompt in
      select value
      from jsonb_array_elements(coalesce(v_prompt_locale -> 'entries', '[]'::jsonb))
    loop
      v_prompt_test_id := case
        when coalesce((v_prompt ->> 'is_global')::boolean, false) then null
        else v_test_id
      end;

      select prompt.id
      into v_prompt_id
      from public.prompt_versions prompt
      where prompt.report_type = v_prompt ->> 'report_type'
        and prompt.audience = v_prompt ->> 'audience'
        and prompt.source_type = v_prompt ->> 'source_type'
        and prompt.generator_type = v_prompt ->> 'generator_type'
        and prompt.prompt_key = v_prompt ->> 'prompt_key'
        and prompt.version = v_prompt ->> 'version'
        and (
          (v_prompt_test_id is null and prompt.test_id is null)
          or prompt.test_id = v_prompt_test_id
        )
      limit 1;

      if v_prompt_id is null then
        raise exception 'Prompt localization for locale % references unknown prompt_version %/% (%/%/%).',
          v_prompt_locale ->> 'locale',
          v_prompt ->> 'prompt_key',
          v_prompt ->> 'version',
          v_prompt ->> 'report_type',
          v_prompt ->> 'audience',
          v_prompt ->> 'generator_type';
      end if;

      insert into public.prompt_version_localizations (
        prompt_version_id,
        locale,
        system_prompt,
        user_prompt_template
      )
      values (
        v_prompt_id,
        v_prompt_locale ->> 'locale',
        v_prompt ->> 'system_prompt',
        v_prompt ->> 'user_prompt_template'
      )
      on conflict (prompt_version_id, locale) do update
      set system_prompt = excluded.system_prompt,
          user_prompt_template = excluded.user_prompt_template,
          updated_at = now();

      v_prompt_localizations_count := v_prompt_localizations_count + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'test_slug', v_test_slug,
    'counts', jsonb_build_object(
      'tests', 1,
      'dimensions', v_dimensions_count,
      'questions', v_questions_count,
      'mappings', v_mappings_count,
      'options', v_options_count,
      'prompts', v_prompts_count,
      'question_localizations', v_question_localizations_count,
      'answer_option_localizations', v_option_localizations_count,
      'prompt_version_localizations', v_prompt_localizations_count
    )
  );
end;
$$;


ALTER FUNCTION "public"."import_assessment_package"("p_package" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_answer_option_localizations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_answer_option_localizations_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_prompt_version_localizations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_prompt_version_localizations_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_prompt_versions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_prompt_versions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_question_localizations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_question_localizations_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_report_runtime_configs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_report_runtime_configs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_modified_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_modified_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."answer_option_localizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "answer_option_id" "uuid" NOT NULL,
    "locale" "text" NOT NULL,
    "label" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "answer_option_localizations_locale_check" CHECK (("locale" = ANY (ARRAY['bs'::"text", 'hr'::"text"])))
);


ALTER TABLE "public"."answer_option_localizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."answer_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid" NOT NULL,
    "code" "text",
    "label" "text" NOT NULL,
    "value" integer,
    "option_order" integer NOT NULL,
    "is_correct" boolean,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."answer_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attempt_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attempt_id" "uuid" NOT NULL,
    "test_slug" "text" NOT NULL,
    "generator_type" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "report_snapshot" "jsonb",
    "report_status" "text" DEFAULT 'ready'::"text" NOT NULL,
    "failure_code" "text",
    "failure_reason" "text",
    "completed_at" timestamp with time zone,
    "report_type" "text" NOT NULL,
    "audience" "text" NOT NULL,
    "source_type" "text" NOT NULL,
    "prompt_version_id" "uuid",
    "model_name" "text",
    "generator_version" "text",
    "input_snapshot" "jsonb",
    "started_at" timestamp with time zone,
    CONSTRAINT "attempt_reports_audience_check" CHECK (("audience" = ANY (ARRAY['participant'::"text", 'hr'::"text"]))),
    CONSTRAINT "attempt_reports_generator_type_check" CHECK (("generator_type" = ANY (ARRAY['mock'::"text", 'openai'::"text"]))),
    CONSTRAINT "attempt_reports_report_status_check" CHECK (("report_status" = ANY (ARRAY['queued'::"text", 'processing'::"text", 'ready'::"text", 'failed'::"text", 'unavailable'::"text"]))),
    CONSTRAINT "attempt_reports_snapshot_consistency_check" CHECK (((("report_status" = 'ready'::"text") AND ("report_snapshot" IS NOT NULL) AND ("failure_code" IS NULL) AND ("failure_reason" IS NULL)) OR (("report_status" = ANY (ARRAY['queued'::"text", 'processing'::"text"])) AND ("report_snapshot" IS NULL) AND ("failure_code" IS NULL) AND ("failure_reason" IS NULL)) OR (("report_status" = ANY (ARRAY['failed'::"text", 'unavailable'::"text"])) AND ("report_snapshot" IS NULL))))
);


ALTER TABLE "public"."attempt_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "test_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "total_time_seconds" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "organization_id" "uuid",
    "participant_id" "uuid",
    "locale" "text" DEFAULT 'bs'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "order_id" "uuid",
    "payment_status" "text" DEFAULT 'pending'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "attempts_locale_check" CHECK (("locale" = ANY (ARRAY['bs'::"text", 'hr'::"text"]))),
    CONSTRAINT "attempts_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'waived'::"text"]))),
    CONSTRAINT "attempts_status_check" CHECK (("status" = ANY (ARRAY['pending_payment'::"text", 'in_progress'::"text", 'completed'::"text", 'abandoned'::"text"])))
);


ALTER TABLE "public"."attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dimension_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attempt_id" "uuid" NOT NULL,
    "dimension" "text" NOT NULL,
    "raw_score" numeric(10,2) NOT NULL,
    "normalized_score" numeric(10,2),
    "percentile_score" numeric(10,2),
    "interpretation" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dimension_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "created_by" "uuid",
    "total_amount" numeric(10,2) DEFAULT 0.00,
    "currency" "text" DEFAULT 'KM'::"text",
    "payment_method" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "invoice_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "orders_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['card'::"text", 'bank_transfer'::"text"]))),
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_memberships_role_check" CHECK (("role" = ANY (ARRAY['org_owner'::"text", 'hr_admin'::"text", 'manager'::"text"]))),
    CONSTRAINT "organization_memberships_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'invited'::"text", 'disabled'::"text"])))
);


ALTER TABLE "public"."organization_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_test_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "test_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organization_test_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organizations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "participant_type" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "participants_participant_type_check" CHECK (("participant_type" = ANY (ARRAY['employee'::"text", 'candidate'::"text"]))),
    CONSTRAINT "participants_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prompt_version_localizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prompt_version_id" "uuid" NOT NULL,
    "locale" "text" NOT NULL,
    "system_prompt" "text" NOT NULL,
    "user_prompt_template" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "prompt_version_localizations_locale_check" CHECK (("locale" = ANY (ARRAY['bs'::"text", 'hr'::"text"])))
);


ALTER TABLE "public"."prompt_version_localizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prompt_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "test_id" "uuid",
    "report_type" "text" NOT NULL,
    "audience" "text" NOT NULL,
    "source_type" "text" NOT NULL,
    "generator_type" "text" NOT NULL,
    "prompt_key" "text" NOT NULL,
    "version" "text" NOT NULL,
    "system_prompt" "text" NOT NULL,
    "user_prompt_template" "text" NOT NULL,
    "output_schema_json" "jsonb",
    "is_active" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "prompt_versions_audience_check" CHECK (("audience" = ANY (ARRAY['participant'::"text", 'hr'::"text"]))),
    CONSTRAINT "prompt_versions_generator_type_check" CHECK (("generator_type" = ANY (ARRAY['mock'::"text", 'openai'::"text"])))
);


ALTER TABLE "public"."prompt_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."question_dimension_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid" NOT NULL,
    "dimension_id" "uuid" NOT NULL,
    "weight" numeric(8,4) DEFAULT 1 NOT NULL,
    "reverse_scored" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."question_dimension_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."question_localizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid" NOT NULL,
    "locale" "text" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "question_localizations_locale_check" CHECK (("locale" = ANY (ARRAY['bs'::"text", 'hr'::"text"])))
);


ALTER TABLE "public"."question_localizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "test_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "text" "text" NOT NULL,
    "help_text" "text",
    "dimension" "text" NOT NULL,
    "question_type" "text" DEFAULT 'single_choice'::"text" NOT NULL,
    "question_order" integer NOT NULL,
    "reverse_scored" boolean DEFAULT false NOT NULL,
    "difficulty" "text",
    "weight" numeric(6,2) DEFAULT 1.00 NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "questions_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['easy'::"text", 'medium'::"text", 'hard'::"text"]))),
    CONSTRAINT "questions_question_type_check" CHECK (("question_type" = ANY (ARRAY['single_choice'::"text", 'multiple_choice'::"text", 'text'::"text"])))
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_runtime_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_type" "text" NOT NULL,
    "audience" "text" NOT NULL,
    "source_type" "text" NOT NULL,
    "generator_type" "text" NOT NULL,
    "model_name" "text",
    "reasoning_effort" "text",
    "temperature" numeric(3,2),
    "is_active" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "report_runtime_configs_audience_check" CHECK (("audience" = ANY (ARRAY['participant'::"text", 'hr'::"text"]))),
    CONSTRAINT "report_runtime_configs_generator_type_check" CHECK (("generator_type" = ANY (ARRAY['mock'::"text", 'openai'::"text"]))),
    CONSTRAINT "report_runtime_configs_temperature_check" CHECK ((("temperature" IS NULL) OR (("temperature" >= (0)::numeric) AND ("temperature" <= (2)::numeric))))
);


ALTER TABLE "public"."report_runtime_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."response_selections" (
    "response_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "answer_option_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."response_selections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attempt_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "answer_option_id" "uuid",
    "raw_value" integer,
    "scored_value" numeric(8,2),
    "text_value" "text",
    "answered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "response_kind" "text" DEFAULT 'single_choice'::"text" NOT NULL,
    CONSTRAINT "responses_response_kind_check" CHECK (("response_kind" = ANY (ARRAY['single_choice'::"text", 'multiple_choice'::"text", 'text'::"text"]))),
    CONSTRAINT "responses_value_shape_check" CHECK (((("response_kind" = 'single_choice'::"text") AND ("answer_option_id" IS NOT NULL) AND ("text_value" IS NULL)) OR (("response_kind" = 'multiple_choice'::"text") AND ("answer_option_id" IS NULL) AND ("text_value" IS NULL)) OR (("response_kind" = 'text'::"text") AND ("answer_option_id" IS NULL) AND ("text_value" IS NOT NULL))))
);


ALTER TABLE "public"."responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_dimensions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "test_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 1 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."test_dimensions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "scoring_method" "text" DEFAULT 'likert_sum'::"text" NOT NULL,
    "duration_minutes" integer,
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tests_category_check" CHECK (("category" = ANY (ARRAY['personality'::"text", 'behavioral'::"text", 'cognitive'::"text"]))),
    CONSTRAINT "tests_scoring_method_check" CHECK (("scoring_method" = ANY (ARRAY['likert_sum'::"text", 'correct_answers'::"text", 'weighted_correct'::"text"]))),
    CONSTRAINT "tests_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'archived'::"text"]))),
    CONSTRAINT "tests_status_is_active_check" CHECK (((("is_active" = true) AND ("status" = 'active'::"text")) OR (("is_active" = false) AND ("status" = ANY (ARRAY['draft'::"text", 'archived'::"text"])))))
);


ALTER TABLE "public"."tests" OWNER TO "postgres";


ALTER TABLE ONLY "public"."answer_option_localizations"
    ADD CONSTRAINT "answer_option_localizations_answer_option_id_locale_key" UNIQUE ("answer_option_id", "locale");



ALTER TABLE ONLY "public"."answer_option_localizations"
    ADD CONSTRAINT "answer_option_localizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."answer_options"
    ADD CONSTRAINT "answer_options_id_question_id_unique" UNIQUE ("id", "question_id");



ALTER TABLE ONLY "public"."answer_options"
    ADD CONSTRAINT "answer_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."answer_options"
    ADD CONSTRAINT "answer_options_question_id_option_order_key" UNIQUE ("question_id", "option_order");



ALTER TABLE ONLY "public"."attempt_reports"
    ADD CONSTRAINT "attempt_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attempts"
    ADD CONSTRAINT "attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dimension_scores"
    ADD CONSTRAINT "dimension_scores_attempt_id_dimension_key" UNIQUE ("attempt_id", "dimension");



ALTER TABLE ONLY "public"."dimension_scores"
    ADD CONSTRAINT "dimension_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_organization_id_user_id_key" UNIQUE ("organization_id", "user_id");



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_test_access"
    ADD CONSTRAINT "organization_test_access_organization_id_test_id_key" UNIQUE ("organization_id", "test_id");



ALTER TABLE ONLY "public"."organization_test_access"
    ADD CONSTRAINT "organization_test_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prompt_version_localizations"
    ADD CONSTRAINT "prompt_version_localizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prompt_version_localizations"
    ADD CONSTRAINT "prompt_version_localizations_prompt_version_id_locale_key" UNIQUE ("prompt_version_id", "locale");



ALTER TABLE ONLY "public"."prompt_versions"
    ADD CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."question_dimension_mappings"
    ADD CONSTRAINT "question_dimension_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."question_dimension_mappings"
    ADD CONSTRAINT "question_dimension_mappings_question_id_dimension_id_key" UNIQUE ("question_id", "dimension_id");



ALTER TABLE ONLY "public"."question_localizations"
    ADD CONSTRAINT "question_localizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."question_localizations"
    ADD CONSTRAINT "question_localizations_question_id_locale_key" UNIQUE ("question_id", "locale");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_test_id_code_key" UNIQUE ("test_id", "code");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_test_id_question_order_key" UNIQUE ("test_id", "question_order");



ALTER TABLE ONLY "public"."report_runtime_configs"
    ADD CONSTRAINT "report_runtime_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."response_selections"
    ADD CONSTRAINT "response_selections_pkey" PRIMARY KEY ("response_id", "answer_option_id");



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_attempt_id_question_id_key" UNIQUE ("attempt_id", "question_id");



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_id_question_id_unique" UNIQUE ("id", "question_id");



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_dimensions"
    ADD CONSTRAINT "test_dimensions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_dimensions"
    ADD CONSTRAINT "test_dimensions_test_id_code_key" UNIQUE ("test_id", "code");



ALTER TABLE ONLY "public"."tests"
    ADD CONSTRAINT "tests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tests"
    ADD CONSTRAINT "tests_slug_key" UNIQUE ("slug");



CREATE UNIQUE INDEX "attempt_reports_artifact_identity_idx" ON "public"."attempt_reports" USING "btree" ("attempt_id", "report_type", "audience", "source_type");



CREATE INDEX "idx_answer_option_localizations_answer_option_id" ON "public"."answer_option_localizations" USING "btree" ("answer_option_id");



CREATE INDEX "idx_answer_option_localizations_locale" ON "public"."answer_option_localizations" USING "btree" ("locale");



CREATE INDEX "idx_answer_options_question_id" ON "public"."answer_options" USING "btree" ("question_id");



CREATE INDEX "idx_attempt_reports_attempt_id" ON "public"."attempt_reports" USING "btree" ("attempt_id");



CREATE INDEX "idx_attempt_reports_queue_lookup" ON "public"."attempt_reports" USING "btree" ("report_status", "audience", "generated_at", "id");



CREATE INDEX "idx_attempts_locale" ON "public"."attempts" USING "btree" ("locale");



CREATE INDEX "idx_attempts_organization_id" ON "public"."attempts" USING "btree" ("organization_id");



CREATE INDEX "idx_attempts_participant_id" ON "public"."attempts" USING "btree" ("participant_id");



CREATE INDEX "idx_attempts_test_id" ON "public"."attempts" USING "btree" ("test_id");



CREATE INDEX "idx_attempts_user_id" ON "public"."attempts" USING "btree" ("user_id");



CREATE INDEX "idx_dimension_scores_attempt_id" ON "public"."dimension_scores" USING "btree" ("attempt_id");



CREATE INDEX "idx_organization_memberships_organization_id" ON "public"."organization_memberships" USING "btree" ("organization_id");



CREATE INDEX "idx_organization_memberships_user_id" ON "public"."organization_memberships" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_organizations_slug" ON "public"."organizations" USING "btree" ("slug");



CREATE UNIQUE INDEX "idx_participants_org_email" ON "public"."participants" USING "btree" ("organization_id", "lower"("email"));



CREATE INDEX "idx_participants_organization_id" ON "public"."participants" USING "btree" ("organization_id");



CREATE INDEX "idx_participants_user_id" ON "public"."participants" USING "btree" ("user_id");



CREATE INDEX "idx_prompt_version_localizations_locale" ON "public"."prompt_version_localizations" USING "btree" ("locale");



CREATE INDEX "idx_prompt_version_localizations_prompt_version_id" ON "public"."prompt_version_localizations" USING "btree" ("prompt_version_id");



CREATE INDEX "idx_prompt_versions_test_id" ON "public"."prompt_versions" USING "btree" ("test_id");



CREATE INDEX "idx_question_localizations_locale" ON "public"."question_localizations" USING "btree" ("locale");



CREATE INDEX "idx_question_localizations_question_id" ON "public"."question_localizations" USING "btree" ("question_id");



CREATE INDEX "idx_questions_dimension" ON "public"."questions" USING "btree" ("dimension");



CREATE INDEX "idx_questions_test_id" ON "public"."questions" USING "btree" ("test_id");



CREATE INDEX "idx_report_runtime_configs_lookup" ON "public"."report_runtime_configs" USING "btree" ("report_type", "audience", "source_type", "generator_type", "is_active");



CREATE INDEX "idx_response_selections_answer_option_id" ON "public"."response_selections" USING "btree" ("answer_option_id");



CREATE INDEX "idx_response_selections_question_id" ON "public"."response_selections" USING "btree" ("question_id");



CREATE INDEX "idx_responses_attempt_id" ON "public"."responses" USING "btree" ("attempt_id");



CREATE INDEX "idx_responses_question_id" ON "public"."responses" USING "btree" ("question_id");



CREATE INDEX "idx_test_dimensions_test_id" ON "public"."test_dimensions" USING "btree" ("test_id");



CREATE UNIQUE INDEX "prompt_versions_one_active_global_idx" ON "public"."prompt_versions" USING "btree" ("report_type", "audience", "source_type", "generator_type", "prompt_key") WHERE (("is_active" = true) AND ("test_id" IS NULL));



CREATE UNIQUE INDEX "prompt_versions_one_active_test_specific_idx" ON "public"."prompt_versions" USING "btree" ("test_id", "report_type", "audience", "source_type", "generator_type", "prompt_key") WHERE (("is_active" = true) AND ("test_id" IS NOT NULL));



CREATE UNIQUE INDEX "report_runtime_configs_one_active_idx" ON "public"."report_runtime_configs" USING "btree" ("report_type", "audience", "source_type", "generator_type") WHERE ("is_active" = true);



CREATE UNIQUE INDEX "tests_one_active_test_idx" ON "public"."tests" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE OR REPLACE TRIGGER "set_answer_option_localizations_updated_at" BEFORE UPDATE ON "public"."answer_option_localizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_answer_option_localizations_updated_at"();



CREATE OR REPLACE TRIGGER "set_prompt_version_localizations_updated_at" BEFORE UPDATE ON "public"."prompt_version_localizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_prompt_version_localizations_updated_at"();



CREATE OR REPLACE TRIGGER "set_prompt_versions_updated_at" BEFORE UPDATE ON "public"."prompt_versions" FOR EACH ROW EXECUTE FUNCTION "public"."set_prompt_versions_updated_at"();



CREATE OR REPLACE TRIGGER "set_question_localizations_updated_at" BEFORE UPDATE ON "public"."question_localizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_question_localizations_updated_at"();



CREATE OR REPLACE TRIGGER "set_report_runtime_configs_updated_at" BEFORE UPDATE ON "public"."report_runtime_configs" FOR EACH ROW EXECUTE FUNCTION "public"."set_report_runtime_configs_updated_at"();



CREATE OR REPLACE TRIGGER "update_attempts_modtime" BEFORE UPDATE ON "public"."attempts" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



ALTER TABLE ONLY "public"."answer_option_localizations"
    ADD CONSTRAINT "answer_option_localizations_answer_option_id_fkey" FOREIGN KEY ("answer_option_id") REFERENCES "public"."answer_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."answer_options"
    ADD CONSTRAINT "answer_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attempt_reports"
    ADD CONSTRAINT "attempt_reports_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attempts"
    ADD CONSTRAINT "attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attempts"
    ADD CONSTRAINT "attempts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attempts"
    ADD CONSTRAINT "attempts_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attempts"
    ADD CONSTRAINT "attempts_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."dimension_scores"
    ADD CONSTRAINT "dimension_scores_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_test_access"
    ADD CONSTRAINT "organization_test_access_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_test_access"
    ADD CONSTRAINT "organization_test_access_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."prompt_version_localizations"
    ADD CONSTRAINT "prompt_version_localizations_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prompt_versions"
    ADD CONSTRAINT "prompt_versions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prompt_versions"
    ADD CONSTRAINT "prompt_versions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."question_dimension_mappings"
    ADD CONSTRAINT "question_dimension_mappings_dimension_id_fkey" FOREIGN KEY ("dimension_id") REFERENCES "public"."test_dimensions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."question_dimension_mappings"
    ADD CONSTRAINT "question_dimension_mappings_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."question_localizations"
    ADD CONSTRAINT "question_localizations_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_runtime_configs"
    ADD CONSTRAINT "report_runtime_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."response_selections"
    ADD CONSTRAINT "response_selections_answer_option_fk" FOREIGN KEY ("answer_option_id", "question_id") REFERENCES "public"."answer_options"("id", "question_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."response_selections"
    ADD CONSTRAINT "response_selections_response_fk" FOREIGN KEY ("response_id", "question_id") REFERENCES "public"."responses"("id", "question_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_answer_option_matches_question_fk" FOREIGN KEY ("answer_option_id", "question_id") REFERENCES "public"."answer_options"("id", "question_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_dimensions"
    ADD CONSTRAINT "test_dimensions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can view all attempts" ON "public"."attempts" TO "authenticated" USING ((("auth"."jwt"() ->> 'email'::"text") = 'naimafgan@gmail.com'::"text"));



CREATE POLICY "Allow individual read access" ON "public"."organization_test_access" FOR SELECT USING (true);



CREATE POLICY "Users can view their own attempts" ON "public"."attempts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."answer_option_localizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."answer_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "answer_options_read_public" ON "public"."answer_options" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM ("public"."questions" "q"
     JOIN "public"."tests" "t" ON (("t"."id" = "q"."test_id")))
  WHERE (("q"."id" = "answer_options"."question_id") AND ("q"."is_active" = true) AND ("t"."is_active" = true)))));



ALTER TABLE "public"."attempt_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attempt_reports_read_own" ON "public"."attempt_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."attempts" "attempt"
     LEFT JOIN "public"."participants" "participant" ON (("participant"."id" = "attempt"."participant_id")))
     LEFT JOIN "public"."organization_memberships" "membership" ON ((("membership"."organization_id" = "attempt"."organization_id") AND ("membership"."user_id" = "auth"."uid"()) AND ("membership"."status" = 'active'::"text"))))
  WHERE (("attempt"."id" = "attempt_reports"."attempt_id") AND (("attempt"."user_id" = "auth"."uid"()) OR ("participant"."user_id" = "auth"."uid"()) OR ("membership"."id" IS NOT NULL))))));



ALTER TABLE "public"."attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attempts_read_own" ON "public"."attempts" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."participants" "participant"
  WHERE (("participant"."id" = "attempts"."participant_id") AND ("participant"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "membership"
  WHERE (("membership"."organization_id" = "attempts"."organization_id") AND ("membership"."user_id" = "auth"."uid"()) AND ("membership"."status" = 'active'::"text"))))));



ALTER TABLE "public"."dimension_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dimension_scores_read_own" ON "public"."dimension_scores" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."attempts" "attempt"
     LEFT JOIN "public"."participants" "participant" ON (("participant"."id" = "attempt"."participant_id")))
     LEFT JOIN "public"."organization_memberships" "membership" ON ((("membership"."organization_id" = "attempt"."organization_id") AND ("membership"."user_id" = "auth"."uid"()) AND ("membership"."status" = 'active'::"text"))))
  WHERE (("attempt"."id" = "dimension_scores"."attempt_id") AND (("attempt"."user_id" = "auth"."uid"()) OR ("participant"."user_id" = "auth"."uid"()) OR ("membership"."id" IS NOT NULL))))));



ALTER TABLE "public"."organization_memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organization_memberships_read_own" ON "public"."organization_memberships" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."organization_test_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_read_member" ON "public"."organizations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "membership"
  WHERE (("membership"."organization_id" = "organizations"."id") AND ("membership"."user_id" = "auth"."uid"()) AND ("membership"."status" = 'active'::"text")))));



ALTER TABLE "public"."participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "participants_read_member" ON "public"."participants" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_memberships" "membership"
  WHERE (("membership"."organization_id" = "participants"."organization_id") AND ("membership"."user_id" = "auth"."uid"()) AND ("membership"."status" = 'active'::"text")))));



ALTER TABLE "public"."prompt_version_localizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prompt_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."question_dimension_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."question_localizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "questions_read_public" ON "public"."questions" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) AND (EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "questions"."test_id") AND ("t"."is_active" = true))))));



ALTER TABLE "public"."report_runtime_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."response_selections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "response_selections_read_own" ON "public"."response_selections" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ((("public"."responses" "response"
     JOIN "public"."attempts" "attempt" ON (("attempt"."id" = "response"."attempt_id")))
     LEFT JOIN "public"."participants" "participant" ON (("participant"."id" = "attempt"."participant_id")))
     LEFT JOIN "public"."organization_memberships" "membership" ON ((("membership"."organization_id" = "attempt"."organization_id") AND ("membership"."user_id" = "auth"."uid"()) AND ("membership"."status" = 'active'::"text"))))
  WHERE (("response"."id" = "response_selections"."response_id") AND (("attempt"."user_id" = "auth"."uid"()) OR ("participant"."user_id" = "auth"."uid"()) OR ("membership"."id" IS NOT NULL))))));



ALTER TABLE "public"."responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "responses_read_own" ON "public"."responses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."attempts" "attempt"
     LEFT JOIN "public"."participants" "participant" ON (("participant"."id" = "attempt"."participant_id")))
     LEFT JOIN "public"."organization_memberships" "membership" ON ((("membership"."organization_id" = "attempt"."organization_id") AND ("membership"."user_id" = "auth"."uid"()) AND ("membership"."status" = 'active'::"text"))))
  WHERE (("attempt"."id" = "responses"."attempt_id") AND (("attempt"."user_id" = "auth"."uid"()) OR ("participant"."user_id" = "auth"."uid"()) OR ("membership"."id" IS NOT NULL))))));



ALTER TABLE "public"."test_dimensions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tests_read_public" ON "public"."tests" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































REVOKE ALL ON FUNCTION "public"."claim_report_job"("p_attempt_id" "uuid", "p_audience" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_report_job"("p_attempt_id" "uuid", "p_audience" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_report_job"("p_attempt_id" "uuid", "p_audience" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_report_job"("p_attempt_id" "uuid", "p_audience" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."complete_report_job"("p_report_id" "uuid", "p_report_snapshot" "jsonb", "p_model_name" "text", "p_generator_version" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_report_job"("p_report_id" "uuid", "p_report_snapshot" "jsonb", "p_model_name" "text", "p_generator_version" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_report_job"("p_report_id" "uuid", "p_report_snapshot" "jsonb", "p_model_name" "text", "p_generator_version" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_report_job"("p_report_id" "uuid", "p_report_snapshot" "jsonb", "p_model_name" "text", "p_generator_version" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_individual_reports"("p_attempt_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_individual_reports"("p_attempt_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_individual_reports"("p_attempt_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_individual_reports"("p_attempt_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fail_report_job"("p_report_id" "uuid", "p_failure_code" "text", "p_failure_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fail_report_job"("p_report_id" "uuid", "p_failure_code" "text", "p_failure_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fail_report_job"("p_report_id" "uuid", "p_failure_code" "text", "p_failure_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fail_report_job"("p_report_id" "uuid", "p_failure_code" "text", "p_failure_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_active_report_runtime_config"("p_report_type" "text", "p_audience" "text", "p_source_type" "text", "p_generator_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_active_report_runtime_config"("p_report_type" "text", "p_audience" "text", "p_source_type" "text", "p_generator_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_report_runtime_config"("p_report_type" "text", "p_audience" "text", "p_source_type" "text", "p_generator_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_report_runtime_config"("p_report_type" "text", "p_audience" "text", "p_source_type" "text", "p_generator_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."import_assessment_package"("p_package" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."import_assessment_package"("p_package" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."import_assessment_package"("p_package" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_assessment_package"("p_package" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_answer_option_localizations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_answer_option_localizations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_answer_option_localizations_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_prompt_version_localizations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_prompt_version_localizations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_prompt_version_localizations_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_prompt_versions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_prompt_versions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_prompt_versions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_question_localizations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_question_localizations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_question_localizations_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_report_runtime_configs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_report_runtime_configs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_report_runtime_configs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."answer_option_localizations" TO "anon";
GRANT ALL ON TABLE "public"."answer_option_localizations" TO "authenticated";
GRANT ALL ON TABLE "public"."answer_option_localizations" TO "service_role";



GRANT ALL ON TABLE "public"."answer_options" TO "anon";
GRANT ALL ON TABLE "public"."answer_options" TO "authenticated";
GRANT ALL ON TABLE "public"."answer_options" TO "service_role";



GRANT ALL ON TABLE "public"."attempt_reports" TO "anon";
GRANT ALL ON TABLE "public"."attempt_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."attempt_reports" TO "service_role";



GRANT ALL ON TABLE "public"."attempts" TO "anon";
GRANT ALL ON TABLE "public"."attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."attempts" TO "service_role";



GRANT ALL ON TABLE "public"."dimension_scores" TO "anon";
GRANT ALL ON TABLE "public"."dimension_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."dimension_scores" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."organization_memberships" TO "anon";
GRANT ALL ON TABLE "public"."organization_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."organization_test_access" TO "anon";
GRANT ALL ON TABLE "public"."organization_test_access" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_test_access" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."participants" TO "anon";
GRANT ALL ON TABLE "public"."participants" TO "authenticated";
GRANT ALL ON TABLE "public"."participants" TO "service_role";



GRANT ALL ON TABLE "public"."prompt_version_localizations" TO "anon";
GRANT ALL ON TABLE "public"."prompt_version_localizations" TO "authenticated";
GRANT ALL ON TABLE "public"."prompt_version_localizations" TO "service_role";



GRANT ALL ON TABLE "public"."prompt_versions" TO "anon";
GRANT ALL ON TABLE "public"."prompt_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."prompt_versions" TO "service_role";



GRANT ALL ON TABLE "public"."question_dimension_mappings" TO "anon";
GRANT ALL ON TABLE "public"."question_dimension_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."question_dimension_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."question_localizations" TO "anon";
GRANT ALL ON TABLE "public"."question_localizations" TO "authenticated";
GRANT ALL ON TABLE "public"."question_localizations" TO "service_role";



GRANT ALL ON TABLE "public"."questions" TO "anon";
GRANT ALL ON TABLE "public"."questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questions" TO "service_role";



GRANT ALL ON TABLE "public"."report_runtime_configs" TO "anon";
GRANT ALL ON TABLE "public"."report_runtime_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."report_runtime_configs" TO "service_role";



GRANT ALL ON TABLE "public"."response_selections" TO "anon";
GRANT ALL ON TABLE "public"."response_selections" TO "authenticated";
GRANT ALL ON TABLE "public"."response_selections" TO "service_role";



GRANT ALL ON TABLE "public"."responses" TO "anon";
GRANT ALL ON TABLE "public"."responses" TO "authenticated";
GRANT ALL ON TABLE "public"."responses" TO "service_role";



GRANT ALL ON TABLE "public"."test_dimensions" TO "anon";
GRANT ALL ON TABLE "public"."test_dimensions" TO "authenticated";
GRANT ALL ON TABLE "public"."test_dimensions" TO "service_role";



GRANT ALL ON TABLE "public"."tests" TO "anon";
GRANT ALL ON TABLE "public"."tests" TO "authenticated";
GRANT ALL ON TABLE "public"."tests" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































