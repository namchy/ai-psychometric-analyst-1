# GDT-01 Team Dynamics — persistence implementation and hosted rollout preflight

Status: `GDT01_CORRECTIVE_MIGRATION_APPLIED_AND_VALIDATED` — 22.07.2026.

`docs/deep-profile-todo.md` remains the canonical source of truth for overall priorities. This document records the confirmed post-migration GDT-01 persistence state and the narrow seed boundary.

## 1. Current evidence and scope

The source-level persistence package is implemented and committed; `881d4f45` is the latest source commit:

- the SQL transaction boundary and server-owned manifest are implemented;
- the application writer/CLI boundary is implemented and hardened against forged inspection/plan input;
- the read-only inspector and DB contract are the existing production components used by the writer;
- dedicated offline contract tests pass.

The migrations `20260721143000_create_gdt01_team_dynamics_seed_rpc.sql` and `20260721150000_fix_gdt01_membership_resolution_update.sql` are applied and validated. The corrective migration removed the hosted `pg_safeupdate` error `UPDATE requires a WHERE clause`, and the membership update is correlated through `participant_id`. The security contract remains `SECURITY DEFINER`, empty `search_path`, execute only for `service_role`.

The foundation is `EXACT_MATCH` with 24 participants, 4 teams and 24 active memberships. GDT-01 is `EMPTY`, `writerEligible: true`; assignment, wrappers, attempts, responses, selections, scores, aggregations and reports remain 0. The corrective migration did not seed data.

Locked facts for this slice:

| Contract | Value |
| --- | --- |
| Team | `GDT-01` |
| Canonical test | `team_dynamics_assessment_v1` |
| Manifest version | `gdt_01_team_dynamics_seed_manifest_v1` |
| Canonical members | `GD-001`, `GD-002`, `GD-003`, `GD-004`, `GD-005`, `GD-019` |
| Runtime-contract checksum | `375a97663ed825ff2f8c09f3716d6a39bbea2722d5b45f4a61d60d2be210f48d` |
| Seed footprint | 1 assignment, 6 wrappers, 6 attempts, 288 responses, 72 physical selections |
| Logical option selections | 324 |

The organization, 24 participants, four teams, 24 active memberships, the six-member roster, fixture content, scoring and aggregation contracts are locked. This preflight does not reopen them.

## 2. Canonical persistence input and checksum semantics

The canonical authored persistence input is:

```text
fixtures/golden-demo/partner-plus/v1/team-dynamics-gdt-01-answers.json
```

It contains six explicit, code-level answer sets. The answer recipe is provenance-only and is not an authored persistence input.

The SQL migration embeds a versioned, server-owned manifest derived from the canonical fixture projection. It is an embedded persistence boundary, not a second manually maintained source of truth: `scripts/test-gdt-01-team-dynamics-seed-rpc-contract.cjs` deep-exact compares it with the production fixture loader/contract projection. Caller payload never determines authored answers inserted by SQL.

### Runtime-contract checksum

`375a97663ed825ff2f8c09f3716d6a39bbea2722d5b45f4a61d60d2be210f48d` proves the locked Team Dynamics runtime snapshot contract only.

- application/SQL payload field: `runtime_contract_checksum`;
- RPC result field: `runtimeContractChecksum`;
- locked fixture schema field: `contract_checksum`.

It is not an authored-answer checksum, answer digest or fixture-content digest. Authored-answer integrity is proved source-level by the explicit fixture, production loader/validator, server-owned manifest and the deep-exact manifest contract test.

## 3. Implementation inventory

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20260721143000_create_gdt01_team_dynamics_seed_rpc.sql` | Transaction-safe, service-role-only seed RPC with embedded manifest and DB postconditions. |
| `lib/golden-demo/team-dynamics-gdt-01-writer.ts` | Payload construction, runtime inspection/result validation, planning and injected-RPC apply boundary. |
| `scripts/write-gdt-01-team-dynamics-db.cjs` | Guarded server-side operator CLI; default read-only. |
| `lib/golden-demo/team-dynamics-gdt-01-db-contract.ts` | Existing canonical fixture/runtime contract and state classifier. |
| `lib/golden-demo/team-dynamics-gdt-01-db-inspector.ts` | Existing SELECT-only observed-state adapter. |
| `scripts/test-gdt-01-team-dynamics-seed-rpc-contract.cjs` | SQL manifest, security, lock, lineage and result source contract test. |
| `scripts/test-gdt-01-team-dynamics-writer.cjs` | Writer state/result/trust-boundary test. |
| `scripts/test-write-gdt-01-team-dynamics-cli.cjs` | CLI parser, initialization-order and no-RPC blocked-path test. |
| `scripts/test-gdt-01-explicit-answer-contract.cjs` | Production-backed explicit fixture/rehydration mutations; 18 real PASS cases. |

## 4. SQL RPC boundary

The RPC is:

```text
public.create_gdt_01_team_dynamics_seed_v1(jsonb)
```

One function invocation is one PostgreSQL transaction boundary. It resolves exactly one canonical organization and team, then takes `pg_advisory_xact_lock` over a stable key derived from resolved organization UUID, team UUID and `team_dynamics_assessment_v1`. The lock precedes the `EMPTY` guard and all writes.

Before inserting, SQL validates:

1. exact payload identity, including `runtime_contract_checksum`; legacy `fixture_checksum` is explicitly rejected;
2. exact server-owned manifest identity and six candidate/email mappings;
3. exactly one active canonical participant and membership per candidate on GDT-01;
4. exactly one active canonical mixed-format test;
5. 48 active runtime questions, 192 options, question code/order/format and question-scoped option resolution;
6. 42 Likert and 6 SJT units per member, with distinct SJT best/worst options;
7. a target graph that is `EMPTY` under the defined lineage scope.

The function inserts from the manifest, not from authored answers in caller payload. It then reads back wrappers, attempts, responses and selections before returning success.

### Actual insert and FK order

The actual PL/pgSQL order is:

1. insert the assignment (`team_id`, canonical package slug, `active`);
2. for each resolved member, insert the attempt first, then insert the wrapper with that attempt ID and locked membership/participant snapshot;
3. insert all 288 `responses` using resolved question/option UUIDs;
4. insert two `response_selections` (`best`, `worst`) for every SJT parent response.

The wrapper references assignment, membership, participant and attempt; the attempt references canonical test, organization and participant; responses reference attempt/question; selections have composite response/question and option/question lineage. The wrapper/attempt order above is intentional documentation of the actual SQL, not the older proposed wrapper-then-update plan.

Expected physical rows are 1 assignment, 6 wrappers, 6 attempts, 288 responses and 72 `response_selections`. The logical count 324 is `252 Likert + 72 SJT options`; it is not a physical selection-row count.

### EMPTY lineage scope

The SQL guard and TypeScript inspector source-level contracts cover target assignments/wrappers, canonical or legacy Team Dynamics attempts, responses and selections, dimension/member score lineage, aggregation, Team Dynamics reports, report-selection drafts/members, attempt reports and direct Team Fit aggregation lineage.

Unrelated organizations, other teams and standard-battery/non-Team-Dynamics attempts are not automatically conflicts. This scope has been source-reviewed and offline-tested; equality against a live database remains unproven until hosted validation.

### SQL security posture

The accepted security boundary is:

- `SECURITY DEFINER` with `search_path = ''`;
- schema-qualified persistent objects;
- execute revoked from `PUBLIC`, `anon` and `authenticated`;
- execute granted only to `service_role`, in addition to inherent owner privilege;
- no payload secret, `current_user`, `session_user`, JWT or role guard.

The service-role ACL limits API-role execution. It does not protect against a compromised service-role credential. Application/SQL preconditions protect against accidental or incorrect operator flow, not a fully compromised privileged credential.

## 5. Application and CLI trust boundaries

`executeGdt01WriterApply()` no longer accepts a caller-supplied plan. It accepts contract and inspection, runtime-validates the full production-shaped inspection result, internally builds a plan, then decides whether the injected RPC may be called.

The inspection validator requires canonical organization/team/package/checksum identity, exact expected counts, integer/non-negative observed counts, read-only inspector safety flags and coherent blocking findings. State behavior is:

| State | Required behavior |
| --- | --- |
| `EMPTY` | All target counts zero, no blocking finding, writer eligible; read-only plan unless explicit apply. |
| `EXACT_MATCH` | Exact `1/6/6/288/72/324` footprint; successful no-op, never RPC. |
| `PARTIAL` | Blocking evidence required; never RPC. |
| `CONFLICT` | Blocking evidence required; never RPC. |
| Unknown/contradictory | Fail closed before RPC. |

Forged minimal `EMPTY` inspection fails runtime validation. Literal, spread and JSON-round-tripped plans have no supported apply input path. Only validated `EMPTY + explicit apply + rpcAllowed` can make one injected RPC call, and its result must pass the exact top-level result validator.

The CLI defaults to read-only. Apply requires exactly:

```text
--apply --confirm GDT_01_TEAM_DYNAMICS
```

Flags are single-use. Unknown, positional, duplicate and ambiguous arguments fail. Parsing and confirmation validation occur before environment loading or client creation; invalid arguments create no client, call no inspector and call no RPC. `EXACT_MATCH` remains a successful no-op even when apply is requested. The CLI has not been executed against a database.

## 6. Offline evidence

The following source-only checks pass:

```text
node scripts/test-gdt-01-team-dynamics-seed-rpc-contract.cjs
node scripts/test-gdt-01-team-dynamics-writer.cjs
node scripts/test-write-gdt-01-team-dynamics-cli.cjs
node scripts/test-gdt-01-team-dynamics-db-inspector.cjs
node scripts/test-gdt-01-explicit-answer-contract.cjs
npm run typecheck
git diff --check
```

Evidence includes manifest deep equality against the production fixture projection; roster/question/option/SJT mutation cases; SQL security/lock/lineage/result assertions; forged inspection/plan and RPC-result rejection; CLI duplicate/confirmation/initialization guards; inspector state precedence; and 18 production-backed explicit-answer PASS cases without nominal `() => true` callbacks.

## 7. Confirmed runtime result and remaining seed boundary

The migration, source, ACL and security contract audits are already proven for this status sync and are not repeated. The remaining state transition is intentionally narrow: GDT-01 is still `EMPTY` and no seed has run.

## 8. Next step — lean controlled GDT-01 seed

Run the existing apply command once:

```text
node scripts/write-gdt-01-team-dynamics-db.cjs --apply --confirm GDT_01_TEAM_DYNAMICS
```

Then perform only a read-only footprint check for `1 assignment / 6 wrappers / 6 attempts / 288 responses / 72 physical selections / 324 logical selections`. Scoring, aggregation, Team Fit, AI and evaluation remain later separate steps. No cleanup, overwrite or fallback seed is authorized.

## 9. Residual risk

- Offline tests cannot establish PostgreSQL runtime semantics, ACL ownership, transaction rollback or concurrent lock behavior.
- The server-owned manifest deliberately increases migration size to remove caller-controlled authored content.
- A compromised service-role credential is outside this operational guard; credential handling remains an external security responsibility.
- Hosted rollout requires backup, target proof and read-only preflight before the first write.

Current statement: migrations are applied and validated; foundation is `EXACT_MATCH`; GDT-01 is `EMPTY` and `writerEligible: true`; the corrective migration did not execute the seed. The next authorized boundary is the single controlled seed apply followed by the read-only footprint check above.
