# Team Fit clean fixture pair plan / runbook

## 1. Current finding summary

Status ovog dokumenta:

- docs-only/read-only planning slice
- bez OpenAI poziva
- bez DB write-a
- bez report generation/regenerationa
- bez report persistence-a
- bez provider runtime-a
- bez renderer/UI promjena
- bez lifecycle/worker/scheduler promjena
- bez DB/migration promjena
- bez Composite HR runtime promjena

Read-only operator audit je utvrdio:

- Postojeca ready Team Fit reporta `54c7ad39-361c-4f17-963c-ea5ed0764aae` i `d115eff6-e350-4ad8-a00d-fa34009e5972` su legacy persisted artefakti sa stale/non-resolvable source pointerima.
- Ta dva reporta se ne smiju koristiti kao current reproducible source-lineage fixture za real Team Fit provider path.
- Validan candidate-source kandidat je pronadjen, ali nije u istoj organizaciji kao validan Team Dynamics aggregation snapshot.
- Najbolji candidate-source kandidat iz discovery-ja:
  - `assessment_assignment_id = edb736b6-8a9d-471c-bce3-a914c4bd5851`
  - `participant_id = 3fe4a3d6-8764-46e5-b38f-04d32495e399`
  - `organization_id = 800ab0a1-0929-4c6d-aa89-ca6d177564f7`
  - completed tests: `ipip-neo-120-v1`, `mwms_v1`, `safran_v1`
  - `assignment_status = completed`
- Jedini validan Team Dynamics aggregation snapshot iz discovery-ja:
  - `team_aggregation_snapshot_id = 01716095-a273-4eb0-a14c-5facd90a7532`
  - `team_assessment_assignment_id = 376f428e-b588-41ff-bda1-e82a24119abd`
  - `team_id = 19d157b1-0bdc-4e20-8aeb-461898a78b9d`
  - team name = `TD Executive Overview Visual Review Team`
  - team `organization_id = d4508f7a-bc88-4870-8e90-d6487aa8ec3a`
  - `package_slug = team_dynamics_assessment_v1`
  - `aggregation_status = ready`
  - `participant_count = 4`
  - `completed_participant_count = 4`
  - `included_score_count = 4`
  - `missing_completed_score_count = 0`
  - `aggregation_snapshot_present = true`
- Compatibility check:
  - `candidate_organization_id = 800ab0a1-0929-4c6d-aa89-ca6d177564f7`
  - `team_organization_id = d4508f7a-bc88-4870-8e90-d6487aa8ec3a`
  - `same_organization = false`
- Read-only participants audit u team organizaciji `d4508f7a-bc88-4870-8e90-d6487aa8ec3a` pokazao je:
  - postoji `Team Fit Browser Candidate 3863ed2c`
  - postoje 4 TD Executive Overview Visual Member ucesnika
  - svi imaju `assessment_assignment_count = 0`
  - svi imaju `completed_attempt_count = 0`
  - nema candidate assessment assignment-a sa zavrsenim IPIP/MWMS/SAFRAN testovima u istoj organizaciji kao tim

Zakljucak:

- Trenutna DB ne sadrzi clean read-only fixture pair za real Team Fit provider path.
- Team source postoji i izgleda validno.
- Candidate source u istoj organizaciji ne postoji.
- Ne smije se koristiti candidate assignment iz druge organizacije.
- Ne smiju se koristiti postojeci ready Team Fit reporti kao source-lineage fixture.
- Real Team Fit provider dry-run ostaje blokiran dok se ne pripremi validan clean fixture pair.

## 2. Clean fixture pair acceptance criteria

Clean Team Fit fixture pair je prihvatljiv samo ako svi kriteriji prodju:

- Candidate `assessment_assignment_id` postoji.
- Candidate assignment je u istoj `organization_id` kao tim.
- Candidate assignment ima zavrsene required individual testove za Team Fit source:
  - `ipip-neo-120-v1`
  - `mwms_v1`
  - `safran_v1`
- Team aggregation snapshot je `ready`.
- Full coverage: `participant_count = completed_participant_count`.
- `missing_completed_score_count = 0`.
- `included_score_count > 0`.
- Aggregation snapshot postoji.
- `scripts/inspect-team-fit-db-sources.cjs` potvrdjuje candidate source available.
- `scripts/inspect-team-fit-db-sources.cjs` potvrdjuje team source available.
- Privacy/source guardrails pass:
  - raw candidate answers nisu ukljuceni
  - raw team member answers nisu ukljuceni
  - individual member scores nisu ukljuceni
  - full upstream snapshots nisu ukljuceni
  - candidate-facing text nije ukljucen kao primary source
  - numeric fit score nije ukljucen
  - hire/no-hire nije ukljucen

## 3. SELECT-only SQL reproduction

Ovi blokovi su dokumentacija operator read-only nalaza i runbook za buduci audit. Ne izvrsavati ih kao dio ovog docs-only taska.

### 3.1. Candidate assignment discovery

```sql
with assignment_test_completion as (
  select
    aa.id as assessment_assignment_id,
    aa.organization_id,
    aa.participant_id,
    aa.status as assignment_status,
    t.slug as test_slug,
    count(*) filter (where a.status = 'completed') as completed_attempt_count,
    max(a.completed_at) as latest_completed_at
  from assessment_assignments aa
  join assessment_assignment_attempts aaa
    on aaa.assessment_assignment_id = aa.id
  join attempts a
    on a.id = aaa.attempt_id
  join tests t
    on t.id = a.test_id
  where t.slug in ('ipip-neo-120-v1', 'mwms_v1', 'safran_v1')
  group by
    aa.id,
    aa.organization_id,
    aa.participant_id,
    aa.status,
    t.slug
),
assignment_rollup as (
  select
    assessment_assignment_id,
    organization_id,
    participant_id,
    assignment_status,
    array_agg(test_slug order by test_slug) filter (where completed_attempt_count > 0) as completed_tests,
    count(*) filter (where completed_attempt_count > 0) as completed_required_test_count,
    max(latest_completed_at) as latest_completed_at
  from assignment_test_completion
  group by
    assessment_assignment_id,
    organization_id,
    participant_id,
    assignment_status
)
select
  assessment_assignment_id,
  participant_id,
  organization_id,
  completed_tests,
  assignment_status,
  latest_completed_at
from assignment_rollup
where completed_required_test_count = 3
order by latest_completed_at desc nulls last;
```

Observed best candidate-source row:

```text
assessment_assignment_id = edb736b6-8a9d-471c-bce3-a914c4bd5851
participant_id = 3fe4a3d6-8764-46e5-b38f-04d32495e399
organization_id = 800ab0a1-0929-4c6d-aa89-ca6d177564f7
completed_tests = {ipip-neo-120-v1,mwms_v1,safran_v1}
assignment_status = completed
```

### 3.2. Team aggregation discovery

```sql
select
  tas.id as team_aggregation_snapshot_id,
  tas.team_assessment_assignment_id,
  tas.team_id,
  tm.name as team_name,
  tm.organization_id as team_organization_id,
  taa.package_slug,
  tas.aggregation_status,
  tas.participant_count,
  tas.completed_participant_count,
  tas.included_score_count,
  coalesce(cardinality(tas.missing_completed_score_participant_ids), 0) as missing_completed_score_count,
  (tas.aggregation_snapshot is not null) as aggregation_snapshot_present,
  tas.created_at,
  tas.calculated_at
from team_assessment_aggregation_snapshots tas
join team_assessment_assignments taa
  on taa.id = tas.team_assessment_assignment_id
join teams tm
  on tm.id = tas.team_id
where taa.package_slug = 'team_dynamics_assessment_v1'
order by
  case when tas.aggregation_status = 'ready' then 0 else 1 end,
  tas.calculated_at desc nulls last,
  tas.created_at desc nulls last;
```

Observed valid team source:

```text
team_aggregation_snapshot_id = 01716095-a273-4eb0-a14c-5facd90a7532
team_assessment_assignment_id = 376f428e-b588-41ff-bda1-e82a24119abd
team_id = 19d157b1-0bdc-4e20-8aeb-461898a78b9d
team_name = TD Executive Overview Visual Review Team
team_organization_id = d4508f7a-bc88-4870-8e90-d6487aa8ec3a
package_slug = team_dynamics_assessment_v1
aggregation_status = ready
participant_count = 4
completed_participant_count = 4
included_score_count = 4
missing_completed_score_count = 0
aggregation_snapshot_present = true
```

### 3.3. `teams` / `team_memberships` schema check

```sql
select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('teams', 'team_memberships')
order by table_name, ordinal_position;
```

Useful follow-up shape check:

```sql
select
  tm.id as team_id,
  tm.organization_id,
  tm.name as team_name,
  count(tms.*) as team_membership_count
from teams tm
left join team_memberships tms
  on tms.team_id = tm.id
where tm.id = '19d157b1-0bdc-4e20-8aeb-461898a78b9d'
group by
  tm.id,
  tm.organization_id,
  tm.name;
```

### 3.4. Organization compatibility check

```sql
with candidate_source as (
  select
    aa.id as assessment_assignment_id,
    aa.organization_id as candidate_organization_id,
    aa.participant_id
  from assessment_assignments aa
  where aa.id = 'edb736b6-8a9d-471c-bce3-a914c4bd5851'
),
team_source as (
  select
    tas.id as team_aggregation_snapshot_id,
    tas.team_id,
    tm.organization_id as team_organization_id
  from team_assessment_aggregation_snapshots tas
  join teams tm
    on tm.id = tas.team_id
  where tas.id = '01716095-a273-4eb0-a14c-5facd90a7532'
)
select
  c.assessment_assignment_id,
  c.participant_id,
  c.candidate_organization_id,
  t.team_aggregation_snapshot_id,
  t.team_id,
  t.team_organization_id,
  (c.candidate_organization_id = t.team_organization_id) as same_organization
from candidate_source c
cross join team_source t;
```

Observed result:

```text
candidate_organization_id = 800ab0a1-0929-4c6d-aa89-ca6d177564f7
team_organization_id = d4508f7a-bc88-4870-8e90-d6487aa8ec3a
same_organization = false
```

### 3.5. Participants audit in team organization

```sql
with org_participants as (
  select
    p.id as participant_id,
    p.organization_id,
    p.display_name,
    p.email
  from participants p
  where p.organization_id = 'd4508f7a-bc88-4870-8e90-d6487aa8ec3a'
),
assignment_counts as (
  select
    aa.participant_id,
    count(*) as assessment_assignment_count
  from assessment_assignments aa
  where aa.organization_id = 'd4508f7a-bc88-4870-8e90-d6487aa8ec3a'
  group by aa.participant_id
),
completed_attempt_counts as (
  select
    a.participant_id,
    count(*) filter (where a.status = 'completed') as completed_attempt_count,
    array_agg(distinct t.slug order by t.slug) filter (where a.status = 'completed') as completed_test_slugs
  from attempts a
  join tests t
    on t.id = a.test_id
  where a.organization_id = 'd4508f7a-bc88-4870-8e90-d6487aa8ec3a'
  group by a.participant_id
)
select
  op.participant_id,
  op.display_name,
  coalesce(ac.assessment_assignment_count, 0) as assessment_assignment_count,
  coalesce(cac.completed_attempt_count, 0) as completed_attempt_count,
  coalesce(cac.completed_test_slugs, array[]::text[]) as completed_test_slugs
from org_participants op
left join assignment_counts ac
  on ac.participant_id = op.participant_id
left join completed_attempt_counts cac
  on cac.participant_id = op.participant_id
order by op.display_name nulls last, op.participant_id;
```

Observed summary:

```text
Team Fit Browser Candidate 3863ed2c exists in team organization.
4 TD Executive Overview Visual Member participants exist in team organization.
All observed participants have assessment_assignment_count = 0.
All observed participants have completed_attempt_count = 0.
No candidate assessment assignment with completed IPIP/MWMS/SAFRAN tests exists in the same organization as the team.
```

## 4. Operator runbook for future step

Future work must stay split into explicit steps:

1. Select a valid Team Dynamics aggregation snapshot.
2. Verify it is `ready`, has full coverage, has `included_score_count > 0`, has `missing_completed_score_count = 0`, and has a persisted aggregation snapshot.
3. Find or prepare a candidate assessment assignment in the same `organization_id`.
4. Verify the candidate assignment has completed `ipip-neo-120-v1`, `mwms_v1`, and `safran_v1`.
5. Run the DB source inspector only after the clean pair exists:

```bash
CONFIRM_TEAM_FIT_DB_SOURCE_AUDIT=true \
TEAM_FIT_CANDIDATE_ASSESSMENT_ASSIGNMENT_ID=<candidate-assessment-assignment-id> \
TEAM_FIT_TEAM_AGGREGATION_SNAPSHOT_ID=<team-aggregation-snapshot-id> \
node --env-file=.env.local scripts/inspect-team-fit-db-sources.cjs
```

6. Treat inspector PASS as a prerequisite, not as authorization for provider runtime.
7. Only after inspector PASS, consider a real provider dry-run as a separate task with explicit operator approval.

Required inspector expectations before any future real provider dry-run:

- `metadata.openAiCalled = false` during inspection
- `metadata.databaseWrites = false` during inspection
- `candidateSource.status = available`
- `teamSource.status = ready`
- `teamSource.isReady = true`
- `teamSource.isFullCoverage = true`
- no blocker findings
- privacy/source scan remains clean

## 5. Explicit non-goals

This slice does not:

- create a fixture now
- repair or backfill candidate assignments
- modify participants, teams, assignments, attempts, scores, snapshots, or reports
- fix legacy Team Fit reports
- regenerate existing Team Fit reports
- run OpenAI/provider
- persist a report
- change runtime behavior
- change renderer/UI
- change lifecycle, worker, scheduler, queue, or manual process actions
- change DB schema, migrations, Supabase migration history, or run migration repair
- change Composite HR runtime
- add small-AI reviewer logic
- add app-level prose/genericity/actionability/depth/HR-quality grading

## 6. Final status

`NO CLEAN READ-ONLY FIXTURE PAIR AVAILABLE`

Blocker reason:

- missing candidate assessment assignment in team organization `d4508f7a-bc88-4870-8e90-d6487aa8ec3a`

Next future task:

- requires explicit operator-approved fixture preparation before any real Team Fit provider dry-run can be considered.
