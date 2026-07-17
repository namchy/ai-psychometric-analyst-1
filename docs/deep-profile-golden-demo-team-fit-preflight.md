# Deep Profile Golden Demo — Team Fit preflight

**Scope:** local, read-only code and migration audit. No database, network, provider, scoring, report or fixture command was run. `docs/deep-profile-todo.md` remains the canonical backlog authority.

## Verdict

`TEAM_FIT_GOLDEN_DEMO_NEEDS_FOUNDATION`

### Executive conclusion

The codebase does not contain a canonical **Team Fit test** in `public.tests`. Team Fit is an HR-internal, candidate-versus-team **relational report** (`team_fit_report_v1`), built from two different sources:

1. the candidate's existing three-test standard-battery Composite deterministic input; and
2. a persisted, verified Team Dynamics aggregation snapshot for the target team.

This confirms the proposed optional-module semantics: Team Fit is not a fourth standard-battery test, does not add an attempt, question, response, `dimension_scores` row or standard-battery completion requirement, and must not turn an otherwise complete battery into partial/error. It also means that a meaningful first Golden Demo Team Fit slice is a whole team, not an individual Team Fit questionnaire.

The missing foundation is narrow but material: GDT-01 has no Team Dynamics assessment/aggregation fixture yet, there is no Team Fit-specific Golden Demo manifest/validator/verifier, and the report row permits stale source pointers because the database does not enforce source FKs or invalidation. Do not create Team Fit answers for IPIP/SAFRAN/MWMS or invent a `team_fit` test slug.

## Confirmed contract

| Area | Evidence | Conclusion |
| --- | --- | --- |
| Standard battery identity | `lib/assessment/standard-battery.ts:4-8` | Canonical battery is exactly `ipip-neo-120-v1`, `safran_v1`, `mwms_v1`. |
| Assignment links | `lib/assessment/assignments.ts:57-105` | Standard components are required for composite and explicitly `required_for_team_fit=false`. |
| Optional extension vocabulary | `lib/assessment/assignments.ts:14-18`; `supabase/migrations/20260512111000_add_assessment_assignment_attempts.sql:1-21` | Schema supports `team_fit_component` and `optional_component`, but the production standard-battery builder does not create either. |
| Team Fit identity | `lib/b2b/team-fit-report-lifecycle.ts:5-10`; `supabase/migrations/20260530110000_add_team_fit_reports.sql:1-35` | Canonical identity is report type `team_fit_report_v1`, version `v1`; it is not a `tests.slug`. |
| No Team Fit test seed | all Team-Fit migration references are to `team_fit_reports`/report contract, not `tests`, `questions` or `answer_options` | No canonical Team Fit questions, options, response type, required questions, item version or response-to-score mapping exists locally. |
| Team source | `lib/assessment/team-dynamics.ts:1-6`; `lib/assessment/team-dynamics-final-aggregation.ts:450-460` | Current supported team source is the separate Team Dynamics test `team_dynamics_assessment_v1`, not an individual Team Fit instrument. |

### Test identity and individual scoring

There is therefore no answer to “how many Team Fit questions”, “which dimensions persist”, “score bands” or “individual Team Fit scorer” in the current production contract: those entities do not exist. `persistCompletedAssessmentResults(...)` is not a Team Fit scorer; Team Fit does not create `responses`, `raw_value`, `scored_value`, `dimension_scores`, or a Team Fit attempt.

The individual input is the existing Composite HR deterministic input. `buildTeamFitReportInputSnapshot(...)` calls `buildCompositeHrInputSnapshot(...)` for `candidate_source_id` and marks unavailable source states rather than calculating an individual fit score (`lib/b2b/team-fit-report-input.ts:502-545`, `950-1067`). Candidate source gaps are exposed as interpretation limits, including incomplete links flagged `required_for_team_fit` (`lib/b2b/team-fit-report-input.ts:479-498`). This is a report-input condition, not standard-battery completion logic.

## Team-level aggregation contract

Team membership is modelled independently through `teams` and `team_memberships`; a participant can be actively present in more than one team because uniqueness is only per `(team_id, participant_id)` (`supabase/migrations/20260519120000_add_team_dynamics_scaffold.sql:1-48`, `75-102`). A Team Dynamics assignment snapshots selected active memberships in `team_assessment_participants`, unique per assignment/member and per assignment/participant (`same migration:20-57`, `98-116`). It is therefore the assignment snapshot, not a later current-membership query, that is the historical aggregation boundary.

`computeTeamDynamicsFinalAggregation(...)` supports only `team_dynamics_assessment_v1`; it requires every included wrapper participant to be `completed` and to have a valid scored member snapshot. Any incomplete, missing or invalid member returns `not_ready` (`lib/assessment/team-dynamics-final-aggregation.ts:462-605`). It deterministically aggregates each score entry as mean/min/max/population standard deviation, rounded to two decimals (`:235-292`), and persists versioned results in `team_assessment_aggregation_snapshots` through the persistence helper. The aggregate is **Team Dynamics**, not a Team Fit score.

Thus the smallest meaningful Golden Demo Team Fit unit is:

```text
six locked GDT-01 members
→ one Team Dynamics assignment and six completed Team Dynamics member scores
→ one ready aggregation snapshot
→ one optional Team Fit report per selected candidate
```

The first reporting pilot may start with GD-001 after the team snapshot is deterministic, but its upstream fixture must cover all six GDT-01 members. A team report is not itself a required output of the first deterministic slice.

## Lifecycle and optionality

| Lifecycle | Contract | Effect of no Team Fit |
| --- | --- | --- |
| Standard battery creation | Active tests are filtered strictly by the three fixed battery slugs (`lib/assessment/standard-battery.ts:54-67`). | None; Team Fit cannot be selected as a fourth battery test. |
| Standard assignment | Builder inserts only three `standard_component` links with `required_for_team_fit=false` (`lib/assessment/assignments.ts:92-105`). | None; completion/composite remains the three-test contract. |
| Individual reports / composite | Composite reads standard-battery links and `required_for_composite`; Team Fit is not in `STANDARD_ASSESSMENT_BATTERY_SLUGS` (`lib/assessment/composite-input.ts:323-357`). | None; absence does not block individual output. |
| Team Dynamics aggregation | All members selected into that Team Dynamics assignment must complete and score; there is no numeric minimum-member fallback (`lib/assessment/team-dynamics-final-aggregation.ts:483-605`). | Team Fit report input has no ready team source until aggregation is ready. |
| Team Fit report | Explicit shell queue → processing claim → deterministic input build → provider → schema validation → ready/failed (`lib/b2b/team-fit-report-lifecycle.ts:300-391`, `lib/b2b/team-fit-report-processor.ts:288-425`). | No automatic report or error; no row means optional module not enabled. |

The schema has extension roles and `required_for_team_fit`, but there is no production flow that adds an optional fourth assessment to the battery. If a future actual Team Fit instrument is desired, that is a separate product/schema/assessment contract, not an extension of this pilot.

## Report and OpenAI boundary

`team_fit_reports` stores HR-only relational reports with candidate source type `composite_deterministic_input_snapshot` and team source type `team_dynamics_aggregation_input_snapshot` (`supabase/migrations/20260530110000_add_team_fit_reports.sql:1-35`). Queueing verifies the supplied organization owns both team and participant, then inserts a `queued` row (`lib/b2b/team-fit-report-lifecycle.ts:300-391`). It does not verify membership or source readiness at queue time; input build later produces source-status/interpretation-limit evidence.

The processor is explicit/manual, not triggered by standard-battery scoring. It claims a queued row, builds/persists the input, invokes the selected provider, validates the output and marks ready or failed (`lib/b2b/team-fit-report-processor.ts:288-425`). The configured default is mock unless `TEAM_FIT_REPORT_PROVIDER=openai`; the OpenAI adapter is a real provider boundary. The prompt is HR-only and rejects numeric fit scores, hiring decisions, candidate-facing content, raw answers and individual team-member scores (`lib/b2b/team-fit-report-openai-provider.ts:370-455`).

The report is not ready for Golden Demo report generation until deterministic upstream sources have a fixture/verifier and stale-source handling is specified. Existing mock/provider/schema tests prove contract handling, not a live GDT-01 evidence lineage or semantic calibration.

## Database and security findings

| Object | Scope and constraints | Security / lifecycle finding |
| --- | --- | --- |
| `teams`, `team_memberships` | Org-scoped team; active unique membership only per team/participant; no cross-team exclusivity. | RLS grants reads to active organization members, so member-level score/assignment metadata is visible beyond HR-only roles (`20260519120000...:1-116`, `:220-400`). |
| `team_assessment_participants` | Assignment snapshot links membership+participant; one member/participant per assignment and one non-null attempt per wrapper. | Status lifecycle `invited/started/completed/expired`; prevents duplicate wrapper rows but not a participant being in multiple teams. |
| `team_assessment_participant_scores` | Versioned unique `(team_assessment_participant_id, scoring_version)`, score 0–100 checks. | Read is any active organization member, not HR-only (`20260523133000_add_team_assessment_participant_scores.sql:1-96`). |
| `team_assessment_aggregation_snapshots` | Unique `(team_assessment_assignment_id, aggregation_version)`; status `ready/not_ready/stale/failed`; includes source snapshot IDs and coverage counters. | Read is any active organization member (`20260524110000_add_team_assessment_aggregation_snapshots.sql:1-112`). |
| `team_fit_reports` | Org/team/participant IDs, report status, snapshots; indexes but no uniqueness key preventing duplicate reports for same source tuple. | RLS read/insert/update restricted to active `org_owner`/`hr_admin`; updated-at trigger. No source FK to candidate assignment or aggregation snapshot, therefore stale pointers are possible (`20260530110000...:1-132`). |

No Team Fit-specific SECURITY DEFINER RPC was found. Server-side helpers use the admin client. The report row checks team and participant organization at queue/read boundaries, but the database itself does not enforce that `team_id`, `participant_id`, candidate source and team source share an organization or that the participant belongs to the team; helpers do the former at runtime and the latter is not required by the queue helper.

## UI and dashboard

The UI is HR-facing and optional: the participant report page lists Team Fit entries and presents an empty state when none exist (`components/dashboard/team-fit-report-list.tsx:31-48`). Queued entries expose a manual process action, ready entries an open link, and failed entries a retry action (`:79-106`). The detail route requires an authenticated user and active organization, then loads a scoped report record (`app/(protected)/dashboard/teams/[teamId]/participants/[participantId]/team-fit-reports/[teamFitReportId]/page.tsx:19-52`).

There is no candidate-facing Team Fit UI, no Team Fit question flow, and no dashboard state that treats absent Team Fit as incomplete standard battery. “Not included” currently appears as no Team Fit report entry, whereas “queued/processing/failed” exists only after explicit report creation. This is safe enough for optionality, but a future pilot should make opt-in/source-readiness state explicit for HR.

## Existing evidence

| Test class | Existing offline evidence | What it proves / does not prove |
| --- | --- | --- |
| Standard battery | `scripts/test-standard-assessment-battery.cjs` | Fixed three-slug battery; does not test Team Fit. |
| Team Dynamics scoring/aggregation | `scripts/test-team-dynamics-assessment-v1-scoring.cjs`, `scripts/test-team-dynamics-assessment-v1-final-aggregation.cjs`, persistence/read tests | Deterministic member scoring and aggregation contract; not a Team Fit assessment. |
| Team Fit lifecycle/input | `scripts/test-team-fit-report-lifecycle-shell.cjs`, `scripts/test-team-fit-report-input-builder.cjs`, `scripts/test-team-fit-input-enrichment.cjs` | Mocked queue/input state, source-status and persistence contract; no live source lineage. |
| Team Fit report | contract, provider-schema, mock-generation, provider-seam, display, manual-process/retry tests | Schema/provider boundary and UI lifecycle; no Golden Demo expectation/evaluator contract. |
| DB/OpenAI scripts | `test-team-fit-*-db-smoke.cjs`, `test-team-fit-enriched-openai-output-qa-smoke.cjs` | Explicitly excluded from this audit; they require DB and/or provider execution. |

## Golden Demo gap matrix

| Capability | Status | Evidence / risk | Minimum next step |
| --- | --- | --- | --- |
| 1. Canonical Team Fit test identity | MISSING | No Team Fit `tests.slug`; report identity only. | Keep report identity; do not invent a test. |
| 2. Canonical questions | NOT_APPLICABLE | No Team Fit instrument. | None for relational-report pilot. |
| 3. Deterministic answers | NOT_APPLICABLE | Candidate sources are existing battery + Team Dynamics answers. | Define Team Dynamics fixture answers separately. |
| 4. Deterministic scoring | PARTIAL | Team Dynamics scorer is deterministic; no Team Fit scorer. | Verify six member Team Dynamics scores. |
| 5. Expected dimensions/bands | PARTIAL | Team Dynamics entry aggregates have values, no Team Fit score/bands. | Define expected aggregation entries/coverage, not fit bands. |
| 6. Production scoring adapter | READY | Team Dynamics mixed scoring/persistence exists. | Audit/create dedicated offline fixture verifier. |
| 7. Fixture writer | MISSING | No Golden Demo team writer. | Controlled writer after offline team contract. |
| 8. Scoring-state inspector | MISSING | No Golden Demo Team Dynamics state model. | Define unscored/scored/partial/conflict inspector. |
| 9. Post-scoring verifier | PARTIAL | Aggregation verification/read helper exists. | Add Golden expected snapshot verifier. |
| 10. Team membership fixture | MISSING | Locked GDT-01 data is not persisted as Team Dynamics fixture. | Add manifest for six members and immutable membership snapshot. |
| 11. Deterministic team aggregation | READY | Mean/min/max/SD aggregation, readiness guards and persistence exist. | Exercise offline against GDT-01 planned data. |
| 12. Team-level expected findings | MISSING | No Golden expected aggregation/finding data. | Add deterministic expected signals and limits. |
| 13. Report generation | PARTIAL | Queue/processor/mock/OpenAI routes exist; no clean Golden source lineage. | Delay until deterministic sources verify. |
| 14. AI evaluator | MISSING | No Team Fit Golden expected findings/forbidden-claim evaluator. | Add after deterministic pilot passes. |
| 15. Forbidden contradictions | PARTIAL | Prompt guards exist, no Golden semantic fixture. | Define per-report expected/forbidden evidence. |
| 16. Dashboard presentation | PARTIAL | HR list/detail routes exist; opt-in/readiness not explicit. | Verify with report fixture after source maturity. |
| 17. Holdout strategy | MISSING | No team-level Golden split. | Keep GDT-01 development; reserve a whole later team as holdout. |
| 18. Regression tests | PARTIAL | Strong unit/mock tests; no Golden end-to-end offline set. | Add manifest/validator/verifier tests. |
| 19. Cleanup/idempotency safety | PARTIAL | Existing clean-fixture scripts are operator-specific; report duplicates/staleness possible. | Design explicit immutable source/version/idempotency policy. |

## Recommended GDT-01 pilot contract

**Recommendation:** use all six locked GDT-01 members as the first development team. The code provides no technical reason to prefer another locked team, while GDT-01 already contains GD-001's verified standard-battery source. This does not change membership or make Team Fit required.

Proposed future offline assets:

```text
fixtures/golden-demo/partner-plus/v1/team-fit/GDT-01/
  team.json                         # team key, six candidate IDs, module/version/opt-in
  team-dynamics-answers.csv         # separate Team Dynamics question/answer contract
  expected-member-scores.csv        # Team Dynamics member score entries
  expected-aggregation.csv          # entry mean/min/max/SD, counts, readiness
  expected-team-fit-findings.csv    # candidate/team report expectations and forbidden claims
  scenarios.csv                     # complete, member-missing, member-changed, stale-source
```

The manifest must model: (a) **not included** as no `team_fit_reports` row and no error; (b) **incomplete team** as Team Dynamics aggregation `not_ready`, with no Team Fit report processing; (c) **member change** as a new membership/assignment snapshot and invalidated/stale prior aggregate/report lineage, never an overwrite; and (d) report invalidation through explicit source-version comparison because current `team_fit_reports` has no automatic FK-trigger invalidation.

For evidence, keep GDT-01 as development/calibration and reserve an entire untouched team, not individual members, for future holdout. Do not create the report until one complete GDT-01 aggregation is deterministically verified. The first report target may be GD-001, then expand candidate-by-candidate without changing the team source.

## Safe implementation sequence

| Step | Goal, files and acceptance | Failure handling / live boundary |
| --- | --- | --- |
| 1 | Lock optional-report contract in docs and an offline contract test: no Team Fit test/attempt added to standard battery. | Block on any three-slug/completion regression; no DB work. |
| 2 | Audit/freeze `team_dynamics_assessment_v1` question/answer/score contract for six members. | If package identity or scoring source is ambiguous, stop before fixtures. |
| 3 | Add GDT-01 offline Team Dynamics answer recipe and expected member-score verifier. | Offline tests must detect missing/duplicate/invalid answers. |
| 4 | Add expected aggregation CSV/JSON and verifier for readiness, entry mean/min/max/SD and member coverage. | Incomplete/member-change scenarios must remain `not_ready`/stale. |
| 5 | Add Team Fit input manifest and expected/forbidden finding schema; no provider call. | Missing source yields explicit unavailable state, not fabricated output. |
| 6 | Build controlled, idempotent DB writer for team, memberships, Team Dynamics assignment/attempts/responses only after review. | EMPTY/EXACT/PARTIAL/CONFLICT boundary; no cleanup/overwrite. |
| 7 | Add controlled Team Dynamics scoring/aggregation operator and persisted read-only verifier. | Stop on partial; no report queue or OpenAI. |
| 8 | Queue/process one HR-only Team Fit report only after deterministic source verification and explicit provider approval. | Source-version/recheck and no automatic retry; report failure stays isolated. |
| 9 | Add Team Fit evaluator, forbidden contradictions and UI regression fixture. | Expand to another team only after development review and explicit holdout policy. |

## Open questions

1. Is a future *actual* Team Fit questionnaire desired? Current code only supports Team Fit as a report; adding an instrument requires a separate product and schema decision.
2. What source-version rule invalidates an existing Team Fit report when a Team Dynamics member, aggregation snapshot or candidate standard battery changes? Current database stores opaque UUID references without automatic invalidation.
3. Is access to team member score snapshots by any active organization member acceptable, or should a future privacy decision restrict it to HR/manager roles?
4. Which report processing mode is approved for the Golden pilot: mock-only first, or a separately approved OpenAI run after deterministic validation?

## GDT-01 Team Dynamics fixture blocker

**Confirmed local evidence:** `assessment-packages/team_dynamics_assessment_v1/test.json` still declares `status: "draft"`, `is_active: false` and `metadata.import_readiness.status: "content_spec_ready_runtime_pending"`. Its shared `options.json` is empty; the mixed per-item option catalog is reconstructed by the custom import/runtime path (`scripts/test-team-dynamics-assessment-v1-package.cjs`, `lib/assessment/team-dynamics-mixed-runtime.ts`).

**Conclusion:** the local package is a strong content specification and the scorer/aggregator are implemented, but it is not sufficient evidence that a new offline GDT-01 fixture matches the currently imported production question/option catalog. Creating answers and expected scores now would risk locking a fixture against a draft/import-transform contract rather than verified production data.

**Smallest safe unblocker:** a separately authorized read-only preflight that resolves the active `team_dynamics_assessment_v1` row and exports a versioned, code-based runtime contract (`tests.slug`, active question codes/order/metadata and option codes/values/metadata). It must not write, score, queue a report or call OpenAI. After that evidence is committed, resume with the offline six-member GDT-01 foundation.

### Runtime exporter prepared; live evidence still pending

`scripts/export-team-dynamics-runtime-contract.cjs` now models the required read-only preflight. Default and `--dry-run --verbose` are database read-only previews; snapshot creation requires separate explicit `--write-snapshot --contract team_dynamics_assessment_v1`. It requires one active imported `tests` row by slug, status, `is_active`, `mixed_v1`, and `metadata.assessment_key`, then reads active dimensions/questions and `answer_options`. The proposed non-candidate snapshot is `fixtures/golden-demo/contracts/team-dynamics-assessment-v1-runtime.json`; `scripts/validate-team-dynamics-runtime-contract.cjs` validates it offline.

No snapshot has been created, no Team Dynamics answers/member scores/team aggregation have been generated, and no Team Fit report/OpenAI call has occurred. GDT-01 retains its locked six members including global holdout `GD-019`. Before fixture generation, decide separately whether GD-019 may participate in deterministic whole-team technical verification, whether any GDT-01 output may inform AI Team Fit calibration, and how candidate-level holdout integrity is preserved.

### GDT-01 offline deterministic foundation

The active runtime snapshot is now VALID/live EXACT_MATCH at checksum `375a97663ed825ff2f8c09f3716d6a39bbea2722d5b45f4a61d60d2be210f48d`. `team-dynamics-gdt-01-*` fixtures cover GD-001, GD-002, GD-003, GD-004, GD-005 and GD-019; every member has 48 assessment units, represented as 42 Likert response objects plus six SJT best/worst objects (54 option selections). Existing production scorer and final aggregation code generate 48 expected member score entries and eight aggregation entries. Commands: `validate-gdt-01-team-dynamics-fixtures.cjs`, `verify-gdt-01-team-dynamics-member-scores.cjs`, `verify-gdt-01-team-dynamics-aggregation.cjs`, and `test-gdt-01-team-dynamics-fixtures.cjs`.

`GD-019` may participate in deterministic answer/scoring/aggregation verification, but not prompt tuning or AI report calibration. The aggregate is marked `deterministic_verification_allowed=true`, `ai_prompt_calibration_allowed=false`, and `holdout_evaluation_only_after_prompt_freeze=true`. No live Team Dynamics attempts/responses, DB writer, Team Fit report or OpenAI call exists; next task is `controlled GDT-01 Team Dynamics DB writer and live-state inspector`.

### DB writer precondition blocker

The current offline answer fixture is deterministic but recipe-shaped: it stores one Likert value per block and SJT option orders, not the canonical 48 per-member question codes and per-scenario best/worst option codes required by production persistence. A DB writer would have to re-infer selections instead of persisting an authored canonical payload. Therefore no writer/RPC is authorized until an offline-only fixture correction freezes explicit code-based response entries and regenerates expected outputs.
