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
      update public.prompt_versions
      set system_prompt = v_prompt ->> 'system_prompt',
          user_prompt_template = v_prompt ->> 'user_prompt_template',
          output_schema_json = v_prompt -> 'output_schema_json',
          is_active = coalesce((v_prompt ->> 'is_active')::boolean, false),
          notes = v_prompt ->> 'notes',
          updated_at = now()
      where id = v_prompt_id;
    end if;

    v_prompts_count := v_prompts_count + 1;
  end loop;

  if jsonb_typeof(coalesce(p_package -> 'locales', '{}'::jsonb)) <> 'object' then
    raise exception 'Package locales must be a JSON object.';
  end if;

  perform public.import_assessment_package_localizations(v_test_id, p_package -> 'locales');

  return jsonb_build_object(
    'ok', true,
    'test_id', v_test_id,
    'slug', v_test_slug,
    'dimensions_count', v_dimensions_count,
    'questions_count', v_questions_count,
    'mappings_count', v_mappings_count,
    'options_count', v_options_count,
    'prompts_count', v_prompts_count
  );
end;
$$;

revoke all on function public.import_assessment_package(jsonb) from public;
grant execute on function public.import_assessment_package(jsonb) to service_role;
