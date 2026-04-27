create or replace function public.import_assessment_package(p_package jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
      status = case
        when public.tests.status = 'active'
          and public.tests.is_active = true
          and (excluded.status = 'draft' or excluded.is_active = false)
          then public.tests.status
        else excluded.status
      end,
      scoring_method = excluded.scoring_method,
      is_active = case
        when public.tests.status = 'active'
          and public.tests.is_active = true
          and (excluded.status = 'draft' or excluded.is_active = false)
          then public.tests.is_active
        else excluded.is_active
      end,
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

revoke all on function public.import_assessment_package(jsonb) from public;
grant execute on function public.import_assessment_package(jsonb) to service_role;
