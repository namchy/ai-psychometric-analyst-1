-- Controlled Golden Demo fixture creation. This function is intentionally
-- EMPTY-only: it never repairs, upserts, overwrites, scores, or reports.
create or replace function public.create_golden_demo_gd001_fixture_v1(p_fixture jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_participant_id uuid;
  v_assignment_id uuid;
  v_ipip_attempt_id uuid;
  v_safran_attempt_id uuid;
  v_mwms_attempt_id uuid;
  v_test_id uuid;
  v_question_id uuid;
  v_answer_option_id uuid;
  v_attempt_id uuid;
  v_question_type text;
  v_test_payload jsonb;
  v_response jsonb;
  v_test_slug text;
  v_question_code text;
  v_response_kind text;
  v_answer_option_code text;
  v_answer_value text;
  v_component_order integer;
  v_count integer;
  v_ipip_response_count integer;
  v_safran_response_count integer;
  v_mwms_response_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('golden-demo:partner-plus:GD-001', 0)
  );

  if pg_catalog.jsonb_typeof(p_fixture) is distinct from 'object' then
    raise exception 'GD_FIXTURE_INVALID: payload must be a JSON object.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_object_keys(p_fixture) as payload_key(key)
    where payload_key.key not in (
      'schema_version', 'candidate_id', 'organization_name', 'participant', 'assignment', 'tests', 'responses'
    )
  ) then
    raise exception 'GD_FIXTURE_INVALID: payload contains forbidden top-level fields.';
  end if;

  if p_fixture ->> 'schema_version' is distinct from 'gd_db_fixture_v1'
    or p_fixture ->> 'candidate_id' is distinct from 'GD-001'
    or p_fixture ->> 'organization_name' is distinct from 'Partner Plus d.o.o., Mikrokreditna organizacija'
  then
    raise exception 'GD_FIXTURE_INVALID: fixture identity does not match GD-001.';
  end if;

  if pg_catalog.jsonb_typeof(p_fixture -> 'participant') is distinct from 'object'
    or exists (
      select 1
      from pg_catalog.jsonb_object_keys(p_fixture -> 'participant') as participant_key(key)
      where participant_key.key not in ('display_name', 'email', 'participant_type', 'addressing_form')
    )
    or p_fixture #>> '{participant,display_name}' is distinct from 'Amel Kovačević'
    or p_fixture #>> '{participant,email}' is distinct from 'amel.kovacevic@partnerplus.ba'
    or p_fixture #>> '{participant,participant_type}' is distinct from 'employee'
    or p_fixture #>> '{participant,addressing_form}' is distinct from 'masculine'
  then
    raise exception 'GD_FIXTURE_INVALID: participant contract does not match GD-001.';
  end if;

  if pg_catalog.jsonb_typeof(p_fixture -> 'assignment') is distinct from 'object'
    or exists (
      select 1
      from pg_catalog.jsonb_object_keys(p_fixture -> 'assignment') as assignment_key(key)
      where assignment_key.key not in ('locale')
    )
    or p_fixture #>> '{assignment,locale}' is distinct from 'bs'
  then
    raise exception 'GD_FIXTURE_INVALID: assignment contract must use locale bs.';
  end if;

  if pg_catalog.jsonb_typeof(p_fixture -> 'tests') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_fixture -> 'tests') <> 3
  then
    raise exception 'GD_FIXTURE_INVALID: exactly three standard battery tests are required.';
  end if;

  for v_test_payload in
    select value
    from pg_catalog.jsonb_array_elements(p_fixture -> 'tests')
  loop
    if pg_catalog.jsonb_typeof(v_test_payload) is distinct from 'object'
      or exists (
        select 1
        from pg_catalog.jsonb_object_keys(v_test_payload) as test_key(key)
        where test_key.key not in ('test_slug', 'component_order')
      )
      or not (v_test_payload ?& array['test_slug', 'component_order']::text[])
      or pg_catalog.jsonb_typeof(v_test_payload -> 'test_slug') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_test_payload -> 'component_order') is distinct from 'number'
    then
      raise exception 'GD_FIXTURE_INVALID: test entries contain forbidden fields.';
    end if;
  end loop;

  select pg_catalog.count(*) into v_count
  from pg_catalog.jsonb_array_elements(p_fixture -> 'tests') as test_row(value)
  where test_row.value ->> 'test_slug' in ('ipip-neo-120-v1', 'safran_v1', 'mwms_v1');
  if v_count <> 3 then
    raise exception 'GD_FIXTURE_INVALID: test set must be IPIP, SAFRAN, and MWMS exactly once.';
  end if;
  if not exists (
    select 1 from pg_catalog.jsonb_array_elements(p_fixture -> 'tests') as test_row(value)
    where test_row.value ->> 'test_slug' = 'ipip-neo-120-v1'
  ) or not exists (
    select 1 from pg_catalog.jsonb_array_elements(p_fixture -> 'tests') as test_row(value)
    where test_row.value ->> 'test_slug' = 'safran_v1'
  ) or not exists (
    select 1 from pg_catalog.jsonb_array_elements(p_fixture -> 'tests') as test_row(value)
    where test_row.value ->> 'test_slug' = 'mwms_v1'
  ) then
    raise exception 'GD_FIXTURE_INVALID: test set must contain each standard battery slug exactly once.';
  end if;

  for v_test_payload in
    select value
    from pg_catalog.jsonb_array_elements(p_fixture -> 'tests')
  loop
    v_test_slug := v_test_payload ->> 'test_slug';
    if v_test_slug is null
      or v_test_slug = ''
      or v_test_slug <> pg_catalog.btrim(v_test_slug)
      or (v_test_payload ->> 'component_order') !~ '^[0-9]+$'
    then
      raise exception 'GD_FIXTURE_INVALID: every test requires a slug and non-negative integer component_order.';
    end if;
    v_component_order := (v_test_payload ->> 'component_order')::integer;
    if (v_test_slug = 'ipip-neo-120-v1' and v_component_order <> 0)
      or (v_test_slug = 'safran_v1' and v_component_order <> 1)
      or (v_test_slug = 'mwms_v1' and v_component_order <> 2)
    then
      raise exception 'GD_FIXTURE_INVALID: standard battery component order is IPIP=0, SAFRAN=1, MWMS=2.';
    end if;
    select pg_catalog.count(*) into v_count
    from public.tests test
    where test.slug = v_test_slug
      and test.status = 'active'
      and test.is_active = true;
    if v_count <> 1 then
      raise exception 'GD_FIXTURE_INVALID: active test resolution failed for %.', v_test_slug;
    end if;
  end loop;

  if pg_catalog.jsonb_typeof(p_fixture -> 'responses') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_fixture -> 'responses') <> 184
  then
    raise exception 'GD_FIXTURE_INVALID: exactly 184 responses are required.';
  end if;

  select pg_catalog.count(*) into v_ipip_response_count
  from pg_catalog.jsonb_array_elements(p_fixture -> 'responses') as response_row(value)
  where response_row.value ->> 'test_slug' = 'ipip-neo-120-v1';
  select pg_catalog.count(*) into v_safran_response_count
  from pg_catalog.jsonb_array_elements(p_fixture -> 'responses') as response_row(value)
  where response_row.value ->> 'test_slug' = 'safran_v1';
  select pg_catalog.count(*) into v_mwms_response_count
  from pg_catalog.jsonb_array_elements(p_fixture -> 'responses') as response_row(value)
  where response_row.value ->> 'test_slug' = 'mwms_v1';
  if v_ipip_response_count <> 120 or v_safran_response_count <> 45 or v_mwms_response_count <> 19 then
    raise exception 'GD_FIXTURE_INVALID: response cardinality must be IPIP=120, SAFRAN=45, MWMS=19.';
  end if;

  select pg_catalog.count(*) into v_count
  from (
    select response_row.value ->> 'test_slug' as test_slug,
           response_row.value ->> 'question_code' as question_code
    from pg_catalog.jsonb_array_elements(p_fixture -> 'responses') as response_row(value)
    group by response_row.value ->> 'test_slug', response_row.value ->> 'question_code'
  ) as distinct_response;
  if v_count <> 184 then
    raise exception 'GD_FIXTURE_INVALID: duplicate test_slug/question_code responses are not allowed.';
  end if;

  -- Resolve and validate every response before the first INSERT.
  for v_response in
    select value
    from pg_catalog.jsonb_array_elements(p_fixture -> 'responses')
  loop
    if pg_catalog.jsonb_typeof(v_response) is distinct from 'object'
      or exists (
        select 1
        from pg_catalog.jsonb_object_keys(v_response) as response_key(key)
        where response_key.key not in (
          'test_slug', 'question_code', 'response_kind', 'answer_option_code', 'answer_value'
        )
      )
      or not (
        v_response ?& array[
          'test_slug', 'question_code', 'response_kind', 'answer_option_code', 'answer_value'
        ]::text[]
      )
      or pg_catalog.jsonb_typeof(v_response -> 'test_slug') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_response -> 'question_code') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_response -> 'response_kind') is distinct from 'string'
    then
      raise exception 'GD_FIXTURE_INVALID: response contains forbidden score, report, or identifier fields.';
    end if;

    v_test_slug := v_response ->> 'test_slug';
    v_question_code := v_response ->> 'question_code';
    v_response_kind := v_response ->> 'response_kind';
    v_answer_option_code := v_response ->> 'answer_option_code';
    v_answer_value := v_response ->> 'answer_value';

    if v_test_slug not in ('ipip-neo-120-v1', 'safran_v1', 'mwms_v1')
      or v_question_code is null
      or v_question_code = ''
      or v_question_code <> pg_catalog.btrim(v_question_code)
      or v_response_kind not in ('single_choice', 'text')
    then
      raise exception 'GD_FIXTURE_INVALID: response has an invalid test, question, or response kind.';
    end if;

    select pg_catalog.count(*) into v_count
    from public.questions question
    join public.tests test on test.id = question.test_id
    where test.slug = v_test_slug
      and test.status = 'active'
      and test.is_active = true
      and question.code = v_question_code
      and question.is_active = true
      and question.is_required = true;
    if v_count <> 1 then
      raise exception 'GD_FIXTURE_INVALID: required active question resolution failed for %/%.' , v_test_slug, v_question_code;
    end if;

    select question.id, question.question_type
      into strict v_question_id, v_question_type
    from public.questions question
    join public.tests test on test.id = question.test_id
    where test.slug = v_test_slug
      and test.status = 'active'
      and test.is_active = true
      and question.code = v_question_code
      and question.is_active = true
      and question.is_required = true;

    if v_question_type <> v_response_kind then
      raise exception 'GD_FIXTURE_INVALID: response kind does not match question type for %/%.' , v_test_slug, v_question_code;
    end if;

    if v_response_kind = 'single_choice' then
      if pg_catalog.jsonb_typeof(v_response -> 'answer_option_code') is distinct from 'string'
        or v_answer_option_code = ''
        or v_answer_option_code <> pg_catalog.btrim(v_answer_option_code)
        or pg_catalog.jsonb_typeof(v_response -> 'answer_value') is distinct from 'null'
      then
        raise exception 'GD_FIXTURE_INVALID: single_choice requires answer_option_code and empty answer_value.';
      end if;
      select pg_catalog.count(*) into v_count
      from public.answer_options option
      where option.question_id = v_question_id
        and option.code = v_answer_option_code;
      if v_count <> 1 then
        raise exception 'GD_FIXTURE_INVALID: option resolution failed for %/%/%.' , v_test_slug, v_question_code, v_answer_option_code;
      end if;
    else
      if v_test_slug <> 'safran_v1'
        or v_question_code not in (
          'NZ01_01', 'NZ02_01', 'NZ03_01', 'NZ04_01', 'NZ05_01',
          'NZ06_01', 'NZ07_01', 'NZ08_01', 'NZ09_01'
        )
        or pg_catalog.jsonb_typeof(v_response -> 'answer_value') is distinct from 'string'
        or v_answer_value = ''
        or v_answer_value <> pg_catalog.btrim(v_answer_value)
        or pg_catalog.jsonb_typeof(v_response -> 'answer_option_code') is distinct from 'null'
        or v_answer_value !~ E'^-?[0-9]+(\\.[0-9]+)?$'
      then
        raise exception 'GD_FIXTURE_INVALID: text responses are SAFRAN numeric values using a decimal point.';
      end if;
    end if;
  end loop;

  select pg_catalog.count(*) into v_count
  from public.organizations organization
  where organization.name = 'Partner Plus d.o.o., Mikrokreditna organizacija';
  if v_count <> 1 then
    raise exception 'GD_FIXTURE_INVALID: Partner Plus organization resolution requires exactly one name match.';
  end if;
  select pg_catalog.count(*) into v_count
  from public.organizations organization
  where organization.name = 'Partner Plus d.o.o., Mikrokreditna organizacija'
    and organization.status = 'active';
  if v_count <> 1 then
    raise exception 'GD_FIXTURE_INVALID: Partner Plus organization is not active.';
  end if;
  select organization.id into strict v_organization_id
  from public.organizations organization
  where organization.name = 'Partner Plus d.o.o., Mikrokreditna organizacija'
    and organization.status = 'active';

  select pg_catalog.count(*) into v_count
  from public.participants participant
  where participant.organization_id = v_organization_id
    and pg_catalog.lower(participant.email) = 'amel.kovacevic@partnerplus.ba';
  if v_count <> 0 then
    raise exception 'GD_FIXTURE_NOT_EMPTY: GD-001 participant already exists in Partner Plus.';
  end if;

  insert into public.participants (
    organization_id,
    user_id,
    email,
    full_name,
    participant_type,
    status,
    addressing_form
  ) values (
    v_organization_id,
    null,
    'amel.kovacevic@partnerplus.ba',
    'Amel Kovačević',
    'employee',
    'active',
    'masculine'
  ) returning id into v_participant_id;

  insert into public.assessment_assignments (
    organization_id,
    participant_id,
    assignment_type,
    status,
    locale,
    created_by_user_id
  ) values (
    v_organization_id,
    v_participant_id,
    'standard_battery',
    'active',
    'bs',
    null
  ) returning id into v_assignment_id;

  for v_test_payload in
    select value
    from pg_catalog.jsonb_array_elements(p_fixture -> 'tests')
    order by (value ->> 'component_order')::integer
  loop
    v_test_slug := v_test_payload ->> 'test_slug';
    select test.id into strict v_test_id
    from public.tests test
    where test.slug = v_test_slug
      and test.status = 'active'
      and test.is_active = true;

    insert into public.attempts (
      user_id,
      test_id,
      status,
      organization_id,
      participant_id,
      locale,
      addressing_form_snapshot,
      completed_at,
      scored_started_at
    ) values (
      null,
      v_test_id,
      'in_progress',
      v_organization_id,
      v_participant_id,
      'bs',
      'masculine',
      null,
      null
    ) returning id into v_attempt_id;

    if v_test_slug = 'ipip-neo-120-v1' then
      v_ipip_attempt_id := v_attempt_id;
    elsif v_test_slug = 'safran_v1' then
      v_safran_attempt_id := v_attempt_id;
    else
      v_mwms_attempt_id := v_attempt_id;
    end if;
  end loop;

  if v_ipip_attempt_id is null or v_safran_attempt_id is null or v_mwms_attempt_id is null then
    raise exception 'GD_FIXTURE_INVALID: failed to create all standard battery attempts.';
  end if;

  insert into public.assessment_assignment_attempts (
    assessment_assignment_id,
    attempt_id,
    test_id,
    test_slug,
    role_in_assignment,
    required_for_composite,
    required_for_team_fit,
    position
  )
  select
    v_assignment_id,
    case test.slug
      when 'ipip-neo-120-v1' then v_ipip_attempt_id
      when 'safran_v1' then v_safran_attempt_id
      when 'mwms_v1' then v_mwms_attempt_id
    end,
    test.id,
    test.slug,
    'standard_component',
    true,
    false,
    case test.slug
      when 'ipip-neo-120-v1' then 0
      when 'safran_v1' then 1
      when 'mwms_v1' then 2
    end
  from public.tests test
  where test.slug in ('ipip-neo-120-v1', 'safran_v1', 'mwms_v1')
    and test.status = 'active'
    and test.is_active = true;

  for v_response in
    select value
    from pg_catalog.jsonb_array_elements(p_fixture -> 'responses')
  loop
    v_test_slug := v_response ->> 'test_slug';
    v_question_code := v_response ->> 'question_code';
    v_response_kind := v_response ->> 'response_kind';
    v_answer_option_code := v_response ->> 'answer_option_code';
    v_answer_value := v_response ->> 'answer_value';

    select question.id into strict v_question_id
    from public.questions question
    join public.tests test on test.id = question.test_id
    where test.slug = v_test_slug
      and test.status = 'active'
      and test.is_active = true
      and question.code = v_question_code
      and question.is_active = true
      and question.is_required = true
      and question.question_type = v_response_kind;

    if v_response_kind = 'single_choice' then
      select option.id into strict v_answer_option_id
      from public.answer_options option
      where option.question_id = v_question_id
        and option.code = v_answer_option_code;
      insert into public.responses (
        attempt_id,
        question_id,
        response_kind,
        answer_option_id,
        text_value
      ) values (
        case v_test_slug
          when 'ipip-neo-120-v1' then v_ipip_attempt_id
          when 'safran_v1' then v_safran_attempt_id
          when 'mwms_v1' then v_mwms_attempt_id
        end,
        v_question_id,
        'single_choice',
        v_answer_option_id,
        null
      );
    else
      insert into public.responses (
        attempt_id,
        question_id,
        response_kind,
        answer_option_id,
        text_value
      ) values (
        v_safran_attempt_id,
        v_question_id,
        'text',
        null,
        v_answer_value
      );
    end if;
  end loop;

  select pg_catalog.count(*) into v_count
  from public.participants participant
  where participant.id = v_participant_id;
  if v_count <> 1 then raise exception 'GD_FIXTURE_VERIFY_FAILED: participant count.'; end if;
  select pg_catalog.count(*) into v_count
  from public.assessment_assignments assignment
  where assignment.id = v_assignment_id;
  if v_count <> 1 then raise exception 'GD_FIXTURE_VERIFY_FAILED: assignment count.'; end if;
  select pg_catalog.count(*) into v_count
  from public.attempts attempt
  where attempt.organization_id = v_organization_id
    and attempt.participant_id = v_participant_id;
  if v_count <> 3 then raise exception 'GD_FIXTURE_VERIFY_FAILED: participant attempt count or Team Fit attempt.'; end if;
  select pg_catalog.count(*) into v_count
  from public.attempts attempt
  join public.tests test on test.id = attempt.test_id
  where attempt.id in (v_ipip_attempt_id, v_safran_attempt_id, v_mwms_attempt_id)
    and attempt.status = 'in_progress'
    and attempt.completed_at is null
    and attempt.scored_started_at is null
    and (
      (attempt.id = v_ipip_attempt_id and test.slug = 'ipip-neo-120-v1')
      or (attempt.id = v_safran_attempt_id and test.slug = 'safran_v1')
      or (attempt.id = v_mwms_attempt_id and test.slug = 'mwms_v1')
    );
  if v_count <> 3 then raise exception 'GD_FIXTURE_VERIFY_FAILED: attempt lifecycle state.'; end if;
  select pg_catalog.count(*) into v_count
  from public.assessment_assignment_attempts link
  where link.assessment_assignment_id = v_assignment_id;
  if v_count <> 3 then raise exception 'GD_FIXTURE_VERIFY_FAILED: assignment-attempt total link count.'; end if;
  select pg_catalog.count(*) into v_count
  from public.assessment_assignment_attempts link
  join public.attempts attempt on attempt.id = link.attempt_id
  join public.tests test on test.id = link.test_id
  where link.assessment_assignment_id = v_assignment_id
    and link.attempt_id in (v_ipip_attempt_id, v_safran_attempt_id, v_mwms_attempt_id)
    and link.test_id = attempt.test_id
    and link.test_slug = test.slug
    and link.role_in_assignment = 'standard_component'
    and link.required_for_composite = true
    and link.required_for_team_fit = false
    and (
      (link.attempt_id = v_ipip_attempt_id and link.test_slug = 'ipip-neo-120-v1' and link.position = 0)
      or (link.attempt_id = v_safran_attempt_id and link.test_slug = 'safran_v1' and link.position = 1)
      or (link.attempt_id = v_mwms_attempt_id and link.test_slug = 'mwms_v1' and link.position = 2)
    );
  if v_count <> 3 then raise exception 'GD_FIXTURE_VERIFY_FAILED: assignment-attempt link count.'; end if;
  select pg_catalog.count(*) into v_count
  from public.responses response
  where response.attempt_id in (v_ipip_attempt_id, v_safran_attempt_id, v_mwms_attempt_id);
  if v_count <> 184 then raise exception 'GD_FIXTURE_VERIFY_FAILED: response count.'; end if;
  select pg_catalog.count(*) into v_count
  from public.responses response
  where response.attempt_id in (v_ipip_attempt_id, v_safran_attempt_id, v_mwms_attempt_id)
    and (response.raw_value is not null or response.scored_value is not null);
  if v_count <> 0 then raise exception 'GD_FIXTURE_VERIFY_FAILED: response score fields must remain empty.'; end if;
  select pg_catalog.count(*) into v_count
  from public.responses response
  join public.attempts attempt on attempt.id = response.attempt_id
  join public.questions question on question.id = response.question_id
  where response.attempt_id in (v_ipip_attempt_id, v_safran_attempt_id, v_mwms_attempt_id)
    and question.test_id <> attempt.test_id;
  if v_count <> 0 then raise exception 'GD_FIXTURE_VERIFY_FAILED: response question/test ownership.'; end if;
  select pg_catalog.count(*) into v_count
  from (
    select response.attempt_id, response.question_id
    from public.responses response
    where response.attempt_id in (v_ipip_attempt_id, v_safran_attempt_id, v_mwms_attempt_id)
    group by response.attempt_id, response.question_id
  ) as response_identity;
  if v_count <> 184 then raise exception 'GD_FIXTURE_VERIFY_FAILED: duplicate response identity.'; end if;
  select pg_catalog.count(*) into v_ipip_response_count
  from public.responses response where response.attempt_id = v_ipip_attempt_id;
  select pg_catalog.count(*) into v_safran_response_count
  from public.responses response where response.attempt_id = v_safran_attempt_id;
  select pg_catalog.count(*) into v_mwms_response_count
  from public.responses response where response.attempt_id = v_mwms_attempt_id;
  if v_ipip_response_count <> 120 or v_safran_response_count <> 45 or v_mwms_response_count <> 19 then
    raise exception 'GD_FIXTURE_VERIFY_FAILED: per-test response count.';
  end if;
  select pg_catalog.count(*) into v_count
  from public.dimension_scores score
  where score.attempt_id in (v_ipip_attempt_id, v_safran_attempt_id, v_mwms_attempt_id);
  if v_count <> 0 then raise exception 'GD_FIXTURE_VERIFY_FAILED: dimension scores must remain empty.'; end if;
  select pg_catalog.count(*) into v_count
  from public.attempt_reports report
  where report.attempt_id in (v_ipip_attempt_id, v_safran_attempt_id, v_mwms_attempt_id);
  if v_count <> 0 then raise exception 'GD_FIXTURE_VERIFY_FAILED: attempt reports must remain empty.'; end if;
  select pg_catalog.count(*) into v_count
  from public.assessment_reports report
  where report.assessment_assignment_id = v_assignment_id;
  if v_count <> 0 then raise exception 'GD_FIXTURE_VERIFY_FAILED: assessment reports must remain empty.'; end if;

  return pg_catalog.jsonb_build_object(
    'rpcVersion', 'create_golden_demo_gd001_fixture_v1',
    'stateBefore', 'EMPTY',
    'stateAfter', 'CREATED',
    'candidateId', 'GD-001',
    'organizationId', v_organization_id,
    'participantId', v_participant_id,
    'assignmentId', v_assignment_id,
    'attemptIds', pg_catalog.jsonb_build_object(
      'ipip-neo-120-v1', v_ipip_attempt_id,
      'safran_v1', v_safran_attempt_id,
      'mwms_v1', v_mwms_attempt_id
    ),
    'counts', pg_catalog.jsonb_build_object(
      'participants', 1,
      'assignments', 1,
      'attempts', 3,
      'assignmentAttemptLinks', 3,
      'responses', 184,
      'ipipResponses', 120,
      'safranResponses', 45,
      'mwmsResponses', 19,
      'dimensionScores', 0,
      'attemptReports', 0,
      'assessmentReports', 0
    ),
    'scoringExecution', false,
    'reportGeneration', false
  );
end;
$$;

revoke all on function public.create_golden_demo_gd001_fixture_v1(jsonb) from public;
revoke all on function public.create_golden_demo_gd001_fixture_v1(jsonb) from anon;
revoke all on function public.create_golden_demo_gd001_fixture_v1(jsonb) from authenticated;
grant execute on function public.create_golden_demo_gd001_fixture_v1(jsonb) to service_role;
