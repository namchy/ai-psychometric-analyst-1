-- Golden Demo identity/team foundation writer.
-- This is the only write boundary for the foundation slice. It intentionally
-- does not read or write assessment, attempt, response, score, or report data.
create or replace function public.create_golden_demo_foundation_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_organization_count integer;
  v_organization_status text;
  v_existing_participants integer;
  v_existing_teams integer;
  v_existing_memberships integer;
  v_created_participants integer := 0;
  v_created_teams integer := 0;
  v_created_memberships integer := 0;
  v_final_participants integer;
  v_final_teams integer;
  v_final_memberships integer;
  v_state_before text;
  v_participant record;
  v_team record;
  v_expected_team_name text;
  v_participant_id uuid;
  v_team_id uuid;
  v_membership_count integer;
  v_membership_role text;
  v_membership_is_active boolean;
  v_membership_left_at timestamptz;
  v_participant_status text;
  v_participants jsonb := $participants$
    [
      {"candidate_id":"GD-001","full_name":"Amel Kovačević","email":"amel.kovacevic@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-01"},
      {"candidate_id":"GD-002","full_name":"Nataša Rapaić","email":"natasa.rapaic@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-01"},
      {"candidate_id":"GD-003","full_name":"Vladimir Lučić","email":"vladimir.lucic@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-01"},
      {"candidate_id":"GD-004","full_name":"Natali Delić","email":"natali.delic@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-01"},
      {"candidate_id":"GD-005","full_name":"Anisa Lojo Bajrić","email":"anisa.lojo.bajric@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-01"},
      {"candidate_id":"GD-019","full_name":"Ivan Bartulović","email":"ivan.bartulovic@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-01"},
      {"candidate_id":"GD-006","full_name":"Marijana Bačić","email":"marijana.bacic@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-02"},
      {"candidate_id":"GD-007","full_name":"Siniša Đuranović","email":"sinisa.duranovic@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-02"},
      {"candidate_id":"GD-008","full_name":"Draško Marković","email":"drasko.markovic@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-02"},
      {"candidate_id":"GD-009","full_name":"Haris Lučkin","email":"haris.luckin@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-02"},
      {"candidate_id":"GD-010","full_name":"Ela Halilhodžić","email":"ela.halilhodzic@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-02"},
      {"candidate_id":"GD-020","full_name":"Katarina Subotić","email":"katarina.subotic@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-02"},
      {"candidate_id":"GD-011","full_name":"Ljiljana Ulemek Šapina","email":"ljiljana.umelek.sapina@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-03"},
      {"candidate_id":"GD-012","full_name":"Gordana Trhulj","email":"gordana.trhulj@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-03"},
      {"candidate_id":"GD-013","full_name":"Branislav Bošković","email":"branislav.boskovic@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-03"},
      {"candidate_id":"GD-014","full_name":"Muamer Durić","email":"muamer.duric@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-03"},
      {"candidate_id":"GD-021","full_name":"Davor Doko","email":"davor.doko@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-03"},
      {"candidate_id":"GD-022","full_name":"Alma Čatović Ademović","email":"alma.catovic.ademovic@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-03"},
      {"candidate_id":"GD-015","full_name":"Jelena Kalinić","email":"jelena.kalinic@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-04"},
      {"candidate_id":"GD-016","full_name":"Stefan Ječmenić","email":"stefan.jecmenic@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-04"},
      {"candidate_id":"GD-017","full_name":"Aleksandra Kalman","email":"aleksandra.kalman@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-04"},
      {"candidate_id":"GD-018","full_name":"Safet Burina","email":"safet.burina@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-04"},
      {"candidate_id":"GD-023","full_name":"Goran Tasić","email":"goran.tasic@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-04"},
      {"candidate_id":"GD-024","full_name":"Zenaida Hasić","email":"zenaida.hasic@partnerplus.ba","participant_type":"employee","status":"active","team_code":"GDT-04"}
    ]
  $participants$::jsonb;
  v_teams jsonb := $teams$
    [
      {"team_code":"GDT-01","name":"Kreditno poslovanje i rad s klijentima"},
      {"team_code":"GDT-02","name":"Obrada kreditnih zahtjeva i kreditna administracija"},
      {"team_code":"GDT-03","name":"Upravljanje kreditnim rizikom i portfoliom"},
      {"team_code":"GDT-04","name":"Naplata i operativna podrška poslovnicama"}
    ]
  $teams$::jsonb;
begin
  -- Serialize concurrent foundation operators. Any exception below aborts the
  -- whole function transaction, including rows inserted earlier in this call.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('golden-demo:partner-plus:foundation', 0)
  );

  select count(*) into v_organization_count
  from public.organizations
  where name = 'Partner Plus d.o.o., Mikrokreditna organizacija';

  if v_organization_count <> 1 then
    raise exception 'GD_FOUNDATION_CONFLICT: expected exactly one canonical Partner Plus organization, found %.', v_organization_count;
  end if;

  select id, status into v_organization_id, v_organization_status
  from public.organizations
  where name = 'Partner Plus d.o.o., Mikrokreditna organizacija';

  if v_organization_status <> 'active' then
    raise exception 'GD_FOUNDATION_CONFLICT: canonical Partner Plus organization is not active.';
  end if;

  select count(*) into v_existing_participants
  from public.participants p
  where p.organization_id = v_organization_id
    and exists (
      select 1
      from pg_catalog.jsonb_to_recordset(v_participants)
        as expected(candidate_id text, full_name text, email text, participant_type text, status text, team_code text)
      where pg_catalog.lower(expected.email) = pg_catalog.lower(p.email)
    );

  select count(*) into v_existing_teams
  from public.teams t
  where t.organization_id = v_organization_id
    and exists (
      select 1
      from pg_catalog.jsonb_to_recordset(v_teams)
        as expected(team_code text, name text)
      where pg_catalog.lower(expected.name) = pg_catalog.lower(t.name)
    );

  select count(*) into v_existing_memberships
  from public.team_memberships m
  join public.participants p on p.id = m.participant_id
  join public.teams t on t.id = m.team_id
  where p.organization_id = v_organization_id
    and t.organization_id = v_organization_id
    and exists (
      select 1
      from pg_catalog.jsonb_to_recordset(v_participants)
        as expected_participant(candidate_id text, full_name text, email text, participant_type text, status text, team_code text)
      join pg_catalog.jsonb_to_recordset(v_teams)
        as expected_team(team_code text, name text)
        on expected_team.team_code = expected_participant.team_code
      where pg_catalog.lower(expected_participant.email) = pg_catalog.lower(p.email)
        and pg_catalog.lower(expected_team.name) = pg_catalog.lower(t.name)
    );

  if v_existing_participants = 24
    and v_existing_teams = 4
    and v_existing_memberships = 24 then
    v_state_before := 'EXACT_MATCH';
  elsif v_existing_participants = 0 and v_existing_teams = 0 and v_existing_memberships = 0 then
    v_state_before := 'EMPTY';
  else
    v_state_before := 'PARTIAL';
  end if;

  -- Validate every existing canonical participant before the first insert.
  for v_participant in
    select *
    from pg_catalog.jsonb_to_recordset(v_participants)
      as expected(candidate_id text, full_name text, email text, participant_type text, status text, team_code text)
  loop
    select count(*) into v_membership_count
    from public.participants p
    where p.organization_id = v_organization_id
      and pg_catalog.lower(p.email) = pg_catalog.lower(v_participant.email);

    if v_membership_count > 1 then
      raise exception 'GD_FOUNDATION_CONFLICT: duplicate participant email for %.', v_participant.candidate_id;
    end if;

    if v_membership_count = 1 then
      select p.id, p.full_name, p.participant_type, p.status
        into v_participant_id, v_expected_team_name, v_membership_role, v_participant_status
      from public.participants p
      where p.organization_id = v_organization_id
        and pg_catalog.lower(p.email) = pg_catalog.lower(v_participant.email);

      if pg_catalog.lower(v_expected_team_name) <> pg_catalog.lower(v_participant.full_name)
        or v_membership_role <> v_participant.participant_type
        or v_participant_status <> v_participant.status then
        raise exception 'GD_FOUNDATION_CONFLICT: participant identity or lifecycle mismatch for %.', v_participant.candidate_id;
      end if;
    end if;
  end loop;

  -- Validate every existing canonical team before the first insert.
  for v_team in
    select *
    from pg_catalog.jsonb_to_recordset(v_teams)
      as expected(team_code text, name text)
  loop
    select count(*) into v_membership_count
    from public.teams t
    where t.organization_id = v_organization_id
      and pg_catalog.lower(t.name) = pg_catalog.lower(v_team.name);

    if v_membership_count > 1 then
      raise exception 'GD_FOUNDATION_CONFLICT: duplicate team name for %.', v_team.team_code;
    end if;

    if v_membership_count = 1 then
      select t.id, t.archived_at into v_team_id, v_membership_left_at
      from public.teams t
      where t.organization_id = v_organization_id
        and pg_catalog.lower(t.name) = pg_catalog.lower(v_team.name);
      if v_membership_left_at is not null then
        raise exception 'GD_FOUNDATION_CONFLICT: canonical team % is archived.', v_team.team_code;
      end if;
    end if;
  end loop;

  -- Existing memberships are immutable for this operation: wrong-team,
  -- duplicate, role, and lifecycle differences are all hard conflicts.
  for v_participant in
    select *
    from pg_catalog.jsonb_to_recordset(v_participants)
      as expected(candidate_id text, full_name text, email text, participant_type text, status text, team_code text)
  loop
    select p.id into v_participant_id
    from public.participants p
    where p.organization_id = v_organization_id
      and pg_catalog.lower(p.email) = pg_catalog.lower(v_participant.email);

    if v_participant_id is null then
      continue;
    end if;

    select expected.name into v_expected_team_name
    from pg_catalog.jsonb_to_recordset(v_teams)
      as expected(team_code text, name text)
    where expected.team_code = v_participant.team_code;

    select t.id into v_team_id
    from public.teams t
    where t.organization_id = v_organization_id
      and pg_catalog.lower(t.name) = pg_catalog.lower(v_expected_team_name)
      and t.archived_at is null;

    if v_team_id is not null then
      select count(*) into v_membership_count
      from public.team_memberships m
      where m.team_id = v_team_id
        and m.participant_id = v_participant_id;

      if v_membership_count > 1 then
        raise exception 'GD_FOUNDATION_CONFLICT: duplicate membership for %.', v_participant.candidate_id;
      end if;

      if v_membership_count = 1 then
        select m.role, m.is_active, m.left_at
          into v_membership_role, v_membership_is_active, v_membership_left_at
        from public.team_memberships m
        where m.team_id = v_team_id
          and m.participant_id = v_participant_id;
        if v_membership_role <> 'member'
          or v_membership_is_active is distinct from true
          or v_membership_left_at is not null then
          raise exception 'GD_FOUNDATION_CONFLICT: membership lifecycle or role mismatch for %.', v_participant.candidate_id;
        end if;
      end if;
    end if;

    if exists (
      select 1
      from public.team_memberships m
      join public.teams t on t.id = m.team_id
      where m.participant_id = v_participant_id
        and t.organization_id = v_organization_id
        and exists (
          select 1
          from pg_catalog.jsonb_to_recordset(v_teams)
            as expected(team_code text, name text)
          where pg_catalog.lower(expected.name) = pg_catalog.lower(t.name)
            and expected.team_code <> v_participant.team_code
        )
    ) then
      raise exception 'GD_FOUNDATION_CONFLICT: participant % belongs to a different canonical Golden Demo team.', v_participant.candidate_id;
    end if;
  end loop;

  for v_team in
    select *
    from pg_catalog.jsonb_to_recordset(v_teams)
      as expected(team_code text, name text)
  loop
    select t.id into v_team_id
    from public.teams t
    where t.organization_id = v_organization_id
      and pg_catalog.lower(t.name) = pg_catalog.lower(v_team.name)
      and t.archived_at is null;

    if v_team_id is null then
      continue;
    end if;

    if exists (
      select 1
      from public.team_memberships m
      join public.participants p on p.id = m.participant_id
      where m.team_id = v_team_id
        and not exists (
          select 1
          from pg_catalog.jsonb_to_recordset(v_participants)
            as expected(candidate_id text, full_name text, email text, participant_type text, status text, team_code text)
          where p.organization_id = v_organization_id
            and pg_catalog.lower(expected.email) = pg_catalog.lower(p.email)
            and expected.team_code = v_team.team_code
        )
    ) then
      raise exception 'GD_FOUNDATION_CONFLICT: noncanonical participant occupies team %.', v_team.team_code;
    end if;
  end loop;

  -- No writes occur before all organization, identity, team, and membership
  -- validation above has completed.
  insert into public.participants (organization_id, email, full_name, participant_type, status)
  select
    v_organization_id,
    expected.email,
    expected.full_name,
    expected.participant_type,
    expected.status
  from pg_catalog.jsonb_to_recordset(v_participants)
    as expected(candidate_id text, full_name text, email text, participant_type text, status text, team_code text)
  where not exists (
    select 1
    from public.participants p
    where p.organization_id = v_organization_id
      and pg_catalog.lower(p.email) = pg_catalog.lower(expected.email)
  );
  get diagnostics v_created_participants = row_count;

  insert into public.teams (organization_id, name, archived_at)
  select v_organization_id, expected.name, null
  from pg_catalog.jsonb_to_recordset(v_teams)
    as expected(team_code text, name text)
  where not exists (
    select 1
    from public.teams t
    where t.organization_id = v_organization_id
      and pg_catalog.lower(t.name) = pg_catalog.lower(expected.name)
      and t.archived_at is null
  );
  get diagnostics v_created_teams = row_count;

  insert into public.team_memberships (team_id, participant_id, role, is_active, left_at)
  select t.id, p.id, 'member', true, null
  from pg_catalog.jsonb_to_recordset(v_participants)
    as expected_participant(candidate_id text, full_name text, email text, participant_type text, status text, team_code text)
  join pg_catalog.jsonb_to_recordset(v_teams)
    as expected_team(team_code text, name text)
    on expected_team.team_code = expected_participant.team_code
  join public.participants p
    on p.organization_id = v_organization_id
   and pg_catalog.lower(p.email) = pg_catalog.lower(expected_participant.email)
  join public.teams t
    on t.organization_id = v_organization_id
   and t.archived_at is null
   and pg_catalog.lower(t.name) = pg_catalog.lower(expected_team.name)
  where not exists (
    select 1
    from public.team_memberships m
    where m.team_id = t.id
      and m.participant_id = p.id
  );
  get diagnostics v_created_memberships = row_count;

  select count(*) into v_final_participants
  from public.participants p
  where p.organization_id = v_organization_id
    and exists (
      select 1
      from pg_catalog.jsonb_to_recordset(v_participants)
        as expected(candidate_id text, full_name text, email text, participant_type text, status text, team_code text)
      where pg_catalog.lower(expected.email) = pg_catalog.lower(p.email)
    );

  select count(*) into v_final_teams
  from public.teams t
  where t.organization_id = v_organization_id
    and t.archived_at is null
    and exists (
      select 1
      from pg_catalog.jsonb_to_recordset(v_teams)
        as expected(team_code text, name text)
      where pg_catalog.lower(expected.name) = pg_catalog.lower(t.name)
    );

  select count(*) into v_final_memberships
  from public.team_memberships m
  join public.participants p on p.id = m.participant_id
  join public.teams t on t.id = m.team_id
  where p.organization_id = v_organization_id
    and t.organization_id = v_organization_id
    and m.role = 'member'
    and m.is_active = true
    and m.left_at is null
    and exists (
      select 1
      from pg_catalog.jsonb_to_recordset(v_participants)
        as expected_participant(candidate_id text, full_name text, email text, participant_type text, status text, team_code text)
      join pg_catalog.jsonb_to_recordset(v_teams)
        as expected_team(team_code text, name text)
        on expected_team.team_code = expected_participant.team_code
      where pg_catalog.lower(expected_participant.email) = pg_catalog.lower(p.email)
        and pg_catalog.lower(expected_team.name) = pg_catalog.lower(t.name)
    );

  if v_final_participants <> 24 or v_final_teams <> 4 or v_final_memberships <> 24 then
    raise exception 'GD_FOUNDATION_POSTCONDITION_FAILED: expected 24 participants, 4 teams, and 24 memberships; found %, %, %.', v_final_participants, v_final_teams, v_final_memberships;
  end if;

  return pg_catalog.jsonb_build_object(
    'rpcVersion', 'golden_demo_foundation_v1',
    'stateBefore', v_state_before,
    'stateAfter', 'EXACT_MATCH',
    'created', pg_catalog.jsonb_build_object(
      'participants', v_created_participants,
      'teams', v_created_teams,
      'memberships', v_created_memberships
    ),
    'finalCounts', pg_catalog.jsonb_build_object(
      'participants', v_final_participants,
      'teams', v_final_teams,
      'memberships', v_final_memberships
    ),
    'writeScope', pg_catalog.jsonb_build_array('organizations:resolve-only', 'participants', 'teams', 'team_memberships'),
    'assessmentTablesRead', false,
    'scoringExecuted', false,
    'aggregationExecuted', false,
    'reportsGenerated', false
  );
end;
$$;

revoke all on function public.create_golden_demo_foundation_v1() from public;
revoke all on function public.create_golden_demo_foundation_v1() from anon;
revoke all on function public.create_golden_demo_foundation_v1() from authenticated;
grant execute on function public.create_golden_demo_foundation_v1() to service_role;
