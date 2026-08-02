-- Forward-only corrective migration for the already-deployed Golden Demo
-- standard-battery fixture RPC. The existing EMPTY-only contract is preserved;
-- this migration only expands the locked candidate identity set.
do $migration$
declare
  v_definition text;
  v_original_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.create_golden_demo_standard_battery_fixture_v2(jsonb)'::pg_catalog.regprocedure
  )
  into v_definition;

  if v_definition is null then
    raise exception 'GD_FIXTURE_MIGRATION_INVALID: deployed standard-battery fixture RPC is missing.';
  end if;

  v_original_definition := v_definition;

  v_definition := pg_catalog.replace(
    v_definition,
    $$v_candidate_id not in ('GD-001', 'GD-002', 'GD-003', 'GD-004', 'GD-005')$$,
    $$v_candidate_id not in ('GD-001', 'GD-002', 'GD-003', 'GD-004', 'GD-005', 'GD-006', 'GD-007', 'GD-008', 'GD-009', 'GD-010', 'GD-011', 'GD-012', 'GD-013', 'GD-014', 'GD-015', 'GD-016', 'GD-017', 'GD-018')$$
  );

  v_definition := pg_catalog.replace(
    v_definition,
    $old_identity$
  elsif v_candidate_id = 'GD-005' then
    v_expected_email := 'anisa.lojo.bajric@partnerplus.ba';
    v_expected_display_name := 'Anisa Lojo Bajrić';
    v_expected_addressing_form := 'feminine';
  else
    raise exception 'GD_FIXTURE_INVALID: candidate identity is not locked.';
  end if;$old_identity$,
    $new_identity$
  elsif v_candidate_id = 'GD-005' then
    v_expected_email := 'anisa.lojo.bajric@partnerplus.ba';
    v_expected_display_name := 'Anisa Lojo Bajrić';
    v_expected_addressing_form := 'feminine';
  elsif v_candidate_id = 'GD-006' then
    v_expected_email := 'marijana.bacic@partnerplus.ba';
    v_expected_display_name := 'Marijana Bačić';
    v_expected_addressing_form := 'feminine';
  elsif v_candidate_id = 'GD-007' then
    v_expected_email := 'sinisa.duranovic@partnerplus.ba';
    v_expected_display_name := 'Siniša Đuranović';
    v_expected_addressing_form := 'masculine';
  elsif v_candidate_id = 'GD-008' then
    v_expected_email := 'drasko.markovic@partnerplus.ba';
    v_expected_display_name := 'Draško Marković';
    v_expected_addressing_form := 'masculine';
  elsif v_candidate_id = 'GD-009' then
    v_expected_email := 'haris.luckin@partnerplus.ba';
    v_expected_display_name := 'Haris Lučkin';
    v_expected_addressing_form := 'masculine';
  elsif v_candidate_id = 'GD-010' then
    v_expected_email := 'ela.halilhodzic@partnerplus.ba';
    v_expected_display_name := 'Ela Halilhodžić';
    v_expected_addressing_form := 'feminine';
  elsif v_candidate_id = 'GD-011' then
    v_expected_email := 'ljiljana.umelek.sapina@partnerplus.ba';
    v_expected_display_name := 'Ljiljana Ulemek Šapina';
    v_expected_addressing_form := 'feminine';
  elsif v_candidate_id = 'GD-012' then
    v_expected_email := 'gordana.trhulj@partnerplus.ba';
    v_expected_display_name := 'Gordana Trhulj';
    v_expected_addressing_form := 'feminine';
  elsif v_candidate_id = 'GD-013' then
    v_expected_email := 'branislav.boskovic@partnerplus.ba';
    v_expected_display_name := 'Branislav Bošković';
    v_expected_addressing_form := 'masculine';
  elsif v_candidate_id = 'GD-014' then
    v_expected_email := 'muamer.duric@partnerplus.ba';
    v_expected_display_name := 'Muamer Durić';
    v_expected_addressing_form := 'masculine';
  elsif v_candidate_id = 'GD-015' then
    v_expected_email := 'jelena.kalinic@partnerplus.ba';
    v_expected_display_name := 'Jelena Kalinić';
    v_expected_addressing_form := 'feminine';
  elsif v_candidate_id = 'GD-016' then
    v_expected_email := 'stefan.jecmenic@partnerplus.ba';
    v_expected_display_name := 'Stefan Ječmenić';
    v_expected_addressing_form := 'masculine';
  elsif v_candidate_id = 'GD-017' then
    v_expected_email := 'aleksandra.kalman@partnerplus.ba';
    v_expected_display_name := 'Aleksandra Kalman';
    v_expected_addressing_form := 'feminine';
  elsif v_candidate_id = 'GD-018' then
    v_expected_email := 'safet.burina@partnerplus.ba';
    v_expected_display_name := 'Safet Burina';
    v_expected_addressing_form := 'masculine';
  else
    raise exception 'GD_FIXTURE_INVALID: candidate identity is not locked.';
  end if;$new_identity$
  );

  v_definition := pg_catalog.replace(
    v_definition,
    $$v_candidate_id in ('GD-002', 'GD-003', 'GD-004', 'GD-005')$$,
    $$v_candidate_id in ('GD-002', 'GD-003', 'GD-004', 'GD-005', 'GD-006', 'GD-007', 'GD-008', 'GD-009', 'GD-010', 'GD-011', 'GD-012', 'GD-013', 'GD-014', 'GD-015', 'GD-016', 'GD-017', 'GD-018')$$
  );

  if v_definition = v_original_definition
    or pg_catalog.strpos(v_definition, 'GD-018') = 0
    or pg_catalog.strpos(v_definition, 'GD-019') > 0
  then
    raise exception 'GD_FIXTURE_MIGRATION_INVALID: expected development-candidate identity expansion was not applied.';
  end if;

  execute v_definition;
end;
$migration$;
