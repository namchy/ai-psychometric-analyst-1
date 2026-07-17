# Deep Profile Golden Demo Cohort — Technical Preflight

**Scope:** read-only statički audit lokalnog repoa, 2026-07-11. Nisu pokrenuti DB-backed smokeovi, OpenAI, worker, seed, cleanup ili report regeneration. Zaključci ispod navode repo dokaz; runtime stanje lokalne baze nije provjeravano.

> **Team Dynamics runtime snapshot gate (2026-07-17):** canonical answer identity mora doći iz aktivnog imported runtimea, ne draft packagea. `scripts/export-team-dynamics-runtime-contract.cjs` resolvea jedan active `team_dynamics_assessment_v1` / `mixed_v1` test i čita samo tests, dimensions, questions i options. `scripts/validate-team-dynamics-runtime-contract.cjs` offline validira generated code/value/order/metadata snapshot. Snapshot još nije kreiran niti potvrđen protiv live DB; nema Team Dynamics fixture answers, scoreova, agregacije, reportova ni OpenAI poziva.

## Post-preflight implementation evidence — transaction-safe GD-001 writer

- RPC: `public.create_golden_demo_gd001_fixture_v1(p_fixture jsonb)`.
- Migration: `supabase/migrations/20260717120000_create_golden_demo_gd001_fixture_rpc.sql`; primijenjena na live bazu prema operator-provided preflight evidenceu.
- Transaction strategy: one PostgreSQL function call, transaction-level advisory lock for `golden-demo:partner-plus:GD-001`, all fixture validation before inserts, and exception rollback for participant, assignment, three attempts, three links and 184 responses.
- Security model: `SECURITY DEFINER` with `search_path = ''`, schema-qualified objects, public/anon/authenticated execute revoked and `service_role` execute granted only.
- Write contract: EMPTY-only; no upsert, repair, cleanup, overwrite, scoring or report generation. Existing state remains a Node-side read-only classification boundary (`EXACT_MATCH`, `PARTIAL`, `CONFLICT`).
- Live evidence: Partner Plus organizacija je active; GD-001 apply je završen atomskim RPC-om, a pre-scoring read-only preflight je bio `EXACT_MATCH` sa tri attempta i 184 odgovora.

## Post-review evidence — multi-active assessment test contract

- Legacy blocker: `20260312133500_harden_active_test_contract.sql` kreirao je globalni partial unique indeks `tests_one_active_test_idx`, iako standard battery zahtijeva istovremeno active IPIP, SAFRAN i MWMS testove.
- Forward migration `supabase/migrations/20260717121000_resolve_multi_active_test_contract.sql` primijenjena je na live bazu; uklanja samo taj globalni indeks i ne mijenja test podatke.
- Uniqueness contract: `tests.slug` ostaje globally unique i predstavlja stabilni, versioned test identitet; schema nema repo-defined test-family ključ, pa replacement active unique indeks nije opravdan.
- Lifecycle contract: postojeći `tests_status_is_active_check` ostaje na snazi — `active` ide sa `is_active=true`, a `draft/archived` sa `is_active=false`.
- Query audit: jedini production global-single helper sužen je obaveznim slug filterom; standard battery koristi slug listu, a pregledani activation/import tokovi već su target-slug scoped i ne deaktiviraju nepovezane testove.
- Live preflight je potvrdio da globalni indeks ne postoji, da su IPIP, SAFRAN i MWMS `active/true`, te da RPC postoji kao `SECURITY DEFINER` sa execute pravom samo za `postgres` i `service_role`.

## Post-fixture evidence — GD-001 production scoring audit

- Canonical completion path prvo validira sva required pitanja, zatvara attempt (`completed` + `completed_at`), zatim poziva `persistCompletedAssessmentResults(...)`; report orchestration je zaseban, kasniji eksplicitni poziv u `app/actions/assessment.ts`.
- `persistCompletedAssessmentResults(...)` nema report/OpenAI import ni side effect. IPIP i SAFRAN koriste shared production scorer; MWMS persistence delegira na `writeMwmsAttemptDimensionScores(...)`.
- Score persistence upisuje `responses.raw_value`, `responses.scored_value` i test-level `dimension_scores`. IPIP domaini i MWMS composite vrijednosti nisu posebni DB redovi nego read-only derivacije iz persisted dimensions; standard-battery composite je report input/readiness contract, ne numerički score zapis niti assignment lifecycle tranzicija.
- Kontrolisani operator `scripts/score-gd-001.cjs` koristi production completion validator i production score persister u redoslijedu IPIP → SAFRAN → MWMS, ali ne poziva `orchestrateReportsAfterAttemptCompletion`, report queue/worker ili provider.
- Granica nije atomska kroz sva tri attempta: svaki attempt transition, response update i dimension replacement su odvojeni Supabase writeovi. Failure može ostaviti `PARTIAL`, koji operator namjerno blokira bez force/repair opcije.
- GD-001 production scoring je naknadno izvršen live kroz kontrolisani operator. Završni scoring state je `SCORED_EXACT`: svih 184 odgovora imaju `raw_value` i `scored_value`, postoji 40 persisted dimensions, a expected-score verification je `47/47`. Report generation i OpenAI pozivi ostali su `false`.
- Scoring operator sada iz istog inspectovanog evidence-a prikazuje tri odvojena stanja: `fixtureWriterState` ostaje `CONFLICT` jer writer contract namjerno opisuje nescorovani seed i mora blokirati reseed/overwrite; `fixtureCompatibilityState` je `EXACT_MATCH` samo kada identitet, originalni response payload, dozvoljene scoring lifecycle mutacije, 184 raw/scored vrijednosti, 40 dimensions, 47/47 score verification i odsustvo report artefakata nezavisno prođu; `scoringState` je `SCORED_EXACT`. Za nescorovani fixture sva tri stanja su `EXACT_MATCH`, `EXACT_MATCH`, `UNSCORED_EXACT`; partial ili stvarni conflict ostaje blokiran.
- Scoring operator dry-run je read-only i nakon scoringa planira no-op; scoring se ne ponavlja. Sljedeći ljudski korak je odvojeni review report-generation/AI lanea.

## Team Fit Golden Demo preflight

- Aktuelni evidence-based audit je u `docs/deep-profile-golden-demo-team-fit-preflight.md`.
- Potvrđeno: Team Fit u postojećem repou nije `public.tests` assessment niti četvrti standard-battery attempt. Canonical identitet je HR-interni relacijski report `team_fit_report_v1`, čiji kandidat source je standard-battery Composite deterministic input, a team source verified Team Dynamics aggregation snapshot.
- Posljedica: odsustvo Team Fita ne blokira IPIP/SAFRAN/MWMS completion, individualni report ili GD-001 state. Prvi meaningful Golden Demo slice mora pokriti cijeli zaključani tim (preporuka `GDT-01`) radi Team Dynamics agregata; ne kreirati fixture ili report prije zasebnog implementacijskog taska.
- GDT-01 Team Dynamics fixture implementation je naknadno zaustavljen prije data foundationa: lokalni `team_dynamics_assessment_v1` package navodi `status=draft`, `is_active=false` i `import_readiness.status=content_spec_ready_runtime_pending`; shared `options.json` je prazan, dok production mixed option katalozi nastaju kroz import/runtime transform. Bez DB read-a ili versioned exported imported-runtime contracta nema dovoljno dokaza da offline fixture koristi isti production question/option catalog.


## 0. Post-preflight product decisions

Nakon tehničkog audita zaključane su sljedeće product odluke za V1:

- Demo organizacija je **Partner Plus d.o.o. — Mikrokreditna organizacija**.
- V1 kohorta ima **24 Golden Demo kandidata**, `GD-001`–`GD-024`, bez dummy kandidata.
- Development/calibration skup je `GD-001`–`GD-018`; holdout je `GD-019`–`GD-024`.
- Postoje četiri tima sa po šest članova:
  - `GDT-01` Kreditno poslovanje i rad s klijentima;
  - `GDT-02` Obrada kreditnih zahtjeva i kreditna administracija;
  - `GDT-03` Upravljanje kreditnim rizikom i portfoliom;
  - `GDT-04` Naplata i operativna podrška poslovnicama.
- `GDT-04` je jedini planirani lifecycle tim sa dva kontrolisana nezavršena slučaja; tačna dva kandidata i round model ostaju otvoreni prije team fixture implementacije.
- Ljudska display imena i funkcije zaključani su u cohort planu. Stabilni fixture ključevi ostaju odvojeni od display identiteta.
- Kohorta je namijenjena report QA/prompt kalibraciji, razvoju novog HR dashboarda i mogućem klijentskom web demou.
- Nacionalna pripadnost nije product podatak i neće se čuvati niti prikazivati. Korisnikove tri liste imena korištene su samo kao offline kontrola ravnoteže sintetičkog dataseta.
- Tehnički nalazi ovog preflighta ostaju nepromijenjeni osim brojčanih implikacija za četiri tima po šest članova.

## 1. Potvrđen data model

| Entitet | Storage, ključevi i lifecycle | Access / fixture rizik | Dokaz |
| --- | --- | --- | --- |
| Organizacija i HR identitet | `organizations.id`; `organization_memberships(organization_id,user_id)` veže `auth.users`, role su `org_owner`, `hr_admin`, `manager`, status `active/invited/disabled`. | RLS read zahtijeva aktivno članstvo. Fixture write mora imati operator-owned HR membership samo ako se testira authenticated UI. | `supabase/migrations/20260313103649_add_b2b_identity_foundation.sql` |
| Participant | `participants.id`, `organization_id`, opcioni `user_id -> auth.users`, unique `(organization_id, lower(email))`; tip je `employee/candidate`. | Auth user nije DB FK zahtjev za participant; bez njega nema candidate login patha. Fixture key ne smije zavisiti samo od emaila. | ista migracija; `lib/assessment/standard-battery.ts` |
| Standard battery i istorija rundi | `assessment_assignments` je ownership sloj (`active/completed/abandoned/cancelled`); partial unique index dopušta samo jedan aktivan `standard_battery` po org/participant. `assessment_assignment_attempts` linka po jedan attempt po testu u assignment. | Ranije završena + nova aktivna runda je tehnički moguća tek nakon zatvaranja prve assignment runde; svi linkovi i reportovi cascade-deleteaju s assignmentom. | `20260512110000_add_assessment_assignments.sql`; `20260512111000_add_assessment_assignment_attempts.sql` |
| Test, items, stimuli i odgovori | `tests`, `questions`, `answer_options`; locale tabele su `question_localizations`, `answer_option_localizations`, `prompt_version_localizations`. `responses` ima `single_choice/multiple_choice/text`; multiple choice selekcije su u `response_selections`. SAFRAN media putanje su dodane u pitanja/opcije. | Ne hardkodirati IDs ili iteme: učitati aktivne testove/pitanja/opcije. Cleanup mora prvo obrisati `response_selections`, zatim responses/scoreove/attemptove. | `20260309122751_init_assessment_schema.sql`; `20260311120000_support_multiple_choice_responses.sql`; `20260321193000_add_locale_layer_for_assessments.sql`; `20260423120000_add_safran_v1_image_paths.sql` |
| Attempt i score | `attempts` nosi `organization_id`, `participant_id`, `user_id`, `locale`, `addressing_form_snapshot`, `status`, `completed_at`, `scored_started_at`; `dimension_scores` je unique po `(attempt_id,dimension)`. | Standard completion očekuje kompletne required odgovore. Ne postavljati samo `completed`: nakon odgovora treba pozvati production scoring. | `20260309122751_init_assessment_schema.sql`; `20260424143000_add_attempt_scored_started_at.sql`; `app/actions/assessment.ts`; `lib/assessment/scoring.ts` |
| Tim i članstvo | `teams` pripada organizaciji; `team_memberships` ima active/history polja. Partial unique index dozvoljava samo jednog aktivnog člana po participant/team, ali nema cross-team unique ograničenja: višestruko članstvo je moguće. | Tim može biti cleanup boundary; ne arhivirati niti dirati postojeći tim. Fixture manifest mora evidentirati `team_membership.id`. | `20260519120000_add_team_dynamics_scaffold.sql` |
| Team Dynamics | `team_assessment_assignments`, `team_assessment_participants`, `team_assessment_participant_scores`, `team_assessment_aggregation_snapshots`, selection draft tabele i `team_assessment_reports`. | Team Dynamics wrapper je zaseban od standard battery attempts. Puna agregacija odbija bilo kojeg incomplete člana ili missing/invalid score snapshot. | `20260519120000_add_team_dynamics_scaffold.sql`; `20260523133000_add_team_assessment_participant_scores.sql`; `lib/assessment/team-dynamics-final-aggregation.ts` |
| Single-test report job | `attempt_reports` je unique po `(attempt_id,report_type,audience,source_type)`, lifecycle `queued/processing/ready/failed/unavailable`, uz `input_snapshot`, `report_snapshot`, prompt/model/generator metadata. | Rerun nije novi artefakt nego lifecycle operacija nad istim identityjem; raw provider odgovor nema zasebnu kolonu. | `20260321130000_upgrade_attempt_reports_for_report_pipeline.sql`; `lib/assessment/report-job-worker.ts` |
| Composite HR i IDP | `assessment_reports` je unique po assignment/report type/audience/source; čuva input/report snapshot i lifecycle metadata. Migracija proširuje type na `individual_development_profile`. | Composite/IDP zavise od assignmenta i linked attempts; njihov cleanup ide prije assignment deletea preko cascadea, ali export treba završiti prije cleanup-a. | `20260512120000_add_assessment_reports.sql`; `20260602143000_expand_assessment_reports_for_individual_development_profile.sql`; `lib/assessment/individual-development-profile-lifecycle.ts` |
| Team Fit | `team_fit_reports` čuva candidate i team source pointere, snapshotove i lifecycle; source typeovi su constrained na Composite deterministic input i Team Dynamics aggregation input. | Kandidat, tim i aggregation moraju biti u istoj organizaciji; stale source pointeri su poznat rizik prema postojećem todo audit zapisu. | `20260530110000_add_team_fit_reports.sql`; `lib/b2b/team-fit-report-input.ts`; `scripts/inspect-team-fit-db-sources.cjs` |

RLS je uključen za navedene tabele. Migracije pretežno daju authenticated **read** policy kroz aktivno organization membership; server/admin helpers (`createSupabaseAdminClient`) su actual write path. Ovo je razlog da fixture operater radi eksplicitnu server-side write komandu, nikad browser insert.

## 2. Tri individualna assessment lanea

| Lane | Potvrđena implementacija |
| --- | --- |
| **IPIP NEO-120** | Standard slug je `ipip-neo-120-v1` (`lib/assessment/standard-battery.ts`). Likert responsei završavaju u `responses`; generic `persistCompletedAssessmentResults(...)` računa reverse scoring preko `questions.reverse_scored` i `computeLikertResults(...)` (`lib/assessment/scoring.ts`). Completion provjerava required odgovore u `loadAssessmentCompletionState(...)`, zatim action zatvara attempt, persistira scoreove i orkestrira reportove (`lib/assessment/completion-server.ts`, `app/actions/assessment.ts`). Participant input V2 je `buildIpipNeo120ParticipantAiInputV2...` u `lib/assessment/ipip-neo-120-participant-ai-input-v2.ts`; HR contract/prompt input u `lib/assessment/ipip-neo-120-report-contract.ts`; provider izbor/worker u `lib/assessment/report-provider-openai.ts` i `lib/assessment/report-job-worker.ts`. Snapshot je `attempt_reports`; validator/canonicalization je `validateIpipNeo120ParticipantReportV1`, `validateIpipNeo120HrReportV1` i normalizeri u `lib/assessment/ipip-neo-120-report-v1.ts`; display je `lib/assessment/ipip-participant-report-display.ts` i HR route/rendereri. Reusable alati: `scripts/prepare-amra-replay-fixture.cjs`, `scripts/generate-amra-replay-single-test-{participant,hr}-reports.cjs`, `scripts/inspect-single-test-hr-ai-input.cjs`, IPIP verifiers. |
| **MWMS** | Slug `mwms_v1`. MWMS ima posebni deterministic scorer `scoreMwmsV1Responses(...)` i DB writer `scoreMwmsAttemptResponsesFromDatabase(...)` / `writeMwmsAttemptDimensionScores(...)` (`lib/assessment/mwms-scoring.ts`, `lib/assessment/mwms-attempt-scoring.ts`); generic persister delegira MWMS-u (`lib/assessment/scoring.ts`). Completion/report lifecycle je isti `attempts` → `attempt_reports` put. Participant input/contract je `lib/assessment/mwms-participant-ai-input-v1.ts` + `mwms-participant-report-v1.ts`; HR input/contract/validator je `lib/assessment/mwms-hr-report-v1.ts`. Provider/worker, persistence i status su shared `report-job-worker.ts`/`reports.ts`; display je `mwms-{participant,hr}-report-display.ts`. Reusable testovi: `test-mwms-scoring.cjs`, `test-mwms-attempt-scoring.cjs`, `test-mwms-hr-report-{input,contract,display,lifecycle}.cjs`, `inspect-mwms-hr-openai-dry-run.cjs`. |
| **SAFRAN** | Slug `safran_v1`, `correct_answers` je eksplicitno podržan izuzetak u generic scoreru. `computeSafranV1Results(...)` koristi pitanja/opcije i `safran_v1_seed.json` za tačne odgovore; numeric i single-choice pravila su u `lib/assessment/scoring.ts`. Response oblik obuhvata `text` numeric odgovore i single-choice; practice nije scored put. Completion/report storage je shared. Participant contract/input/validator je `lib/assessment/safran-participant-ai-report-v1.ts`; HR ekvivalent je `lib/assessment/safran-hr-report-v1.ts`; display je `safran-{participant,hr}-report-display.ts`. Reusable alati: `test-safran-v1-scoring.cjs`, `test-safran-hr-report-{input,contract,pipeline,display}.cjs`, `inspect-safran-hr-openai-dry-run.cjs`, `audit-safran-stimuli.cjs`. |

Za sva tri lanea `reports.ts` gradi request iz deterministic resultata, enqueua participant/HR rowove, a `report-job-worker.ts` claim-a row, gradi/persistira input snapshot, poziva selected provider, validira i persistira ready snapshot. `attempt_reports` čuva input, finalni structured snapshot, prompt version ID, model i generator version; provider raw structured odgovor se ne čuva odvojeno prije normalizacije/validacije.

## 3. Composite HR i Individual Development Profile

- Standard battery zahtijeva IPIP + SAFRAN + MWMS (`STANDARD_ASSESSMENT_BATTERY_SLUGS` u `lib/assessment/standard-battery.ts`). `buildCompositeHrInputSnapshot(...)` eksplicitno zahtijeva linked completed attempts sva tri testa (`lib/assessment/composite-input.ts`). Composite input se gradi iz deterministic scoreova, ne iz single-test AI narativa.
- Composite queue/persistence koristi `assessment_reports`; `assessment-report-worker.ts` claim-a `composite/hr/assessment`, persistira input snapshot, poziva provider i validira `validateCompositeHrReportSnapshot(...)`. Renderer/contract su `composite-hr-report-contract.ts` i `app/(protected)/dashboard/assessment-reports/[reportId]/page.tsx`.
- IDP koristi isti `assessment_reports` storage sa report typeom `individual_development_profile`; input builder `buildIndividualDevelopmentProfileInputSnapshot(...)` zahtijeva personality, motivation, problem-solving i composite source blokove (`lib/assessment/individual-development-profile-input.ts`). Queue/lifecycle je `individual-development-profile-lifecycle.ts`, processor `individual-development-profile-processor.ts`, provider `individual-development-profile-openai-provider.ts`, display `individual-development-profile-display.ts`, route `app/(protected)/dashboard/individual-development-profile-reports/[assessmentReportId]/page.tsx`.
- `GD-001` prepreka: Composite može čekati dok sva tri linked attempts nisu completed; IDP dalje zavisi od dostupnog Composite sourcea. Postoje reprocess/fixture alati `scripts/reprocess-amra-individual-development-profile.cjs`, `scripts/prepare-individual-development-profile-{manual-process,browser-review}-fixture.cjs` i read-only `scripts/inspect-amra-idp-openai-request-dump.cjs`.

## 4. Team report stanje

### Team Dynamics Executive Overview

Postoji production lane: `TEAM_DYNAMICS_REPORT_TYPE = team_dynamics_report_v1`, verzija `team_dynamics_executive_overview_v1` (`lib/b2b/team-dynamics-report-lifecycle.ts`), persistence `team_assessment_reports`, input `lib/b2b/team-dynamics-report-input.ts`, worker `lib/b2b/team-dynamics-report-worker.ts`, OpenAI provider `lib/b2b/team-dynamics-executive-overview-openai.ts`, contract/display `lib/b2b/team-dynamics-executive-overview-{contract,display}.ts` i route `app/(protected)/dashboard/teams/[teamId]/reports/[teamAssessmentReportId]/page.tsx`.

Final aggregation nema numerički minimum članova: spremna je samo kada su **svi** `team_assessment_participants` completed i svi imaju validan score snapshot (`lib/assessment/team-dynamics-final-aggregation.ts`). Report selection smoke eksplicitno potvrđuje minimum **4 included score-ready members** za kreiranje Executive Overviewa (`scripts/test-team-dynamics-executive-overview-local-lane-smoke.cjs`). Četiri tima po šest članova podržavaju realan test; tim s dva incomplete slučaja ne podržava full-readiness aggregation ni Executive Overview za tu assignment rundu.

### Team Fit

Postoji `team_fit_report_v1` persistence/lifecycle/input/provider/display path: `lib/b2b/team-fit-report-{lifecycle,input,processor,openai-provider,display}.ts`, tabela `team_fit_reports` i HR route pod `dashboard/teams/.../team-fit-reports/...`. Za realan input traži candidate composite deterministic input i Team Dynamics aggregation input iste organizacije. Nije pronađen drugi implementirani timski report lane izvan Team Dynamics Executive Overview i Team Fit.

## 5. Existing fixture, replay i diagnostic assets

| Asset | Ponovna upotreba / ograničenje |
| --- | --- |
| `scripts/prepare-amra-replay-fixture.cjs` | Najbliži obrazac za standard battery fixture: default no-write, eksplicitni `CONFIRM_AMRA_REPLAY_FIXTURE_WRITE=true`, marker u metadata, provjera konflikata, deterministic re-score i rollback cleanup. Ne kopirati njegova hardkodirana Amra IDs/emails/clone-from-real-data model. |
| `scripts/prepare-individual-development-profile-manual-process-fixture.cjs` | Dokazuje redoslijed participant → completed assignment → tri completed attempta → score → links → IDP input/queue. Koristan obrazac, ali je test fixture i ne Golden manifest. |
| `scripts/prepare-team-fit-clean-candidate-fixture.cjs` | Guardrailed clean candidate/aggregation operator model i naknadni read-only inspector. Reuse confirmation/idempotency discipline, ne hardkodirane targete. |
| `scripts/bootstrap-local-demo.sh` | Lokalni demo bootstrap postoji, ali nije dokaz Golden cohort contracta; pregledan samo kao postojeći demo asset. |
| Request captures | `inspect-single-test-hr-ai-input.cjs`, `inspect-composite-hr-ai-input.cjs`, `inspect-amra-idp-openai-request-dump.cjs`, `inspect-{mwms,safran}-hr-openai-dry-run.cjs` daju no-call/dry-run observability uz env guardove. |
| Report/replay alati | `generate-amra-replay-single-test-{participant,hr}-reports.cjs`, `reprocess-amra-individual-development-profile.cjs`, `regenerate-amra-ipip-hr-report.cjs` su operator/specifični. Budući Golden runner treba shared lane-aware helper, ne Amra kopiju. |
| Testovi/smokeovi | Named `test-*-scoring`, `test-*-report-*`, Team Dynamics/Team Fit testovi su offline contract guardovi; DB smoke skripte se pokreću samo operatorom. |

Confirmation guard, fixture marker, default dry-run artifact, explicit cleanup i no-provider/no-email metadata su postojeći dobri obrasci. Budući helper može izvući generic manifest validation, created-ID ledger i ordered cleanup; ne treba duplicirati TS runtime loader ni real-person replay kod.

## 6. Preporučena seed arhitektura

| Opcija | Ocjena |
| --- | --- |
| Veliki ručno pisani SQL | Najslabije: teško čita active test/item IDs, lako zaobiđe production completion/scoring i teško je idempotentno čistiti. |
| Node generator koji proizvodi SQL | Bolja auditabilnost, ali i dalje uvodi ručni SQL handoff i rizik divergence od helpera. |
| Node skripta koja direktno radi kontrolisani DB write | Može ponovo koristiti production scorer i guardraile, ali bez manifesta otežava review i replay. |
| **Hibrid manifest + generator + operator-confirmed direct write** | **Preporučeno.** Versioned JSON/TS manifest je review source, offline generator/validator iz njega računa odgovore i expected scoreove, a posebna direct-write operator skripta radi idempotentni upis tek s explicit confirmation env. |

Preporučeni V1 mora: defaultati na no-write/dry-run, zahtijevati eksplicitnu potvrdu i ciljani lokalni env, evidentirati sve created/reused IDs, koristiti fixture marker i org-scoped key, provjeriti konflikte, biti idempotentan, imati odvojenu confirmed cleanup komandu, nikad slati email, i u seed koraku ne pozivati OpenAI. Korisnik lično pokreće DB-backed write/smoke komande; Codex ih samo priprema kada eksplicitno zatraži.

## 7. Review bundle feasibility

| Polje | Status i izvor |
| --- | --- |
| Expected profil, bandovi, signali, forbidden claims | Budući versioned fixture manifest; trenutno ne postoji Golden manifest. |
| Odgovori | Već se čuvaju u `responses`/`response_selections`; read-only exporter može ih vezati na question/option code, ne treba izvoziti raw user podatke. |
| Production scoreovi i verification | `dimension_scores` i `responses.raw_value/scored_value`; exporter može pozvati read-only calculation ili porediti s manifestom. |
| AI input snapshot | Već persisted kao `attempt_reports.input_snapshot`, `assessment_reports.input_snapshot`, `team_assessment_reports.input_snapshot`, `team_fit_reports.input_snapshot`. |
| Persisted report | Već postoji kao pripadni `report_snapshot`. |
| Prompt/schema/model | Prompt ID/model/generator/contract version su u report rowovima; schema verzija je često contract field u snapshotu/inputu, ali nije univerzalna DB kolona. |
| Validator rezultat | Final validator success je implicitan za ready persistence, ali detaljan validator result se ne persistira univerzalno; exporter ga može ponovo izvršiti nad snapshotom. |
| Provider raw structured output | **Trenutno se gubi** kao odvojeni artefakt: worker čuva validated/persisted snapshot, ne raw pre-validation payload. Buduća mala instrumentacija može sigurno captureati sanitized raw JSON pod opt-in diagnostic flagom; ne uvoditi ga u ovom tasku. |
| Display projekcija | Može se rekonstruisati pozivom postojećih display helpera ili kao tekstualna projection; nije univerzalno persisted. |

Budući read-only CLI contract: ulaz `--fixture-key` ili org-scoped candidate key; izlaz jedan sanitized JSON na stdout/opcioni 0600 `/tmp` dump; read-only queries; lane matrix; expected-vs-actual score verification; re-run validator; display projection; explicit `missing/reconstructed/persisted` provenance za svako polje. Nikad ne izvoziti `.env`, API ključeve, service-role token, password, auth session ili stvaran PII.

## 8. Precizan GD-001 implementation plan

1. Dodati versioned manifest fajlove za cohort/team/candidate i expected profile/score-band/answer recipe/review contract, plus offline manifest validator; ne koristiti auth ili DB IDs u manifestu.
2. Operator script prvo resolve-a ili kontrolisano kreira marked synthetic organization, participant `GD-001`, team i active membership. Auth user je potreban samo ako treba testirati candidate-auth/UI; nije potreban za server-side assessment data model.
3. Kreirati completed `standard_battery` assignment i tri `attempts` za active slugs iz `STANDARD_ASSESSMENT_BATTERY_SLUGS`; upisati deterministic odgovor validnog response shapea, pa `assessment_assignment_attempts` linkove.
4. Legitimno završiti attemptove kroz production-equivalent completion/scoring sequence: complete required-response validation, `status=completed/completed_at`, `persistCompletedAssessmentResults(...)`; zatim read-back verification `dimension_scores` i expected bands. Budući writer ne treba pozivati browser action zbog auth/cookie side-effecta, ali mora koristiti iste scorer/helper granice.
5. Zatvoriti assignment tek kada su linked attempts complete. Pokrenuti samo odobrene existing single-test queue/worker komande, lane po lane, za participant i HR artefakte; ne pozivati OpenAI bez zasebnog operator odobrenja.
6. Kada tri deterministic sourcea postoje, queue/process Composite HR; kada Composite source postane ready, queue/process IDP. Zatim napraviti read-only review bundle i evaluator verdict.
7. Za Team Dynamics kasnije kreirati zasebnu team assessment assignment/wrappere za svih šest članova; ne miješati tu roundu sa standard battery attempts.
8. Cleanup komanda koristi created-ID ledger i marker: reportovi/selection rows gdje nema cascadea, assignment links, response selections, scoreovi, responses, attempts, assessment assignment, team membership/team i participant samo ako su kreirani ovim fixtureom. Nikad ne brisati unmarked/existing podatke.

Kasnije operator pokreće: manifest dry-run, confirmed seed, read-only score audit, explicit single-test report queue/worker, Composite/IDP queue/processor, read-only bundle export i confirmed cleanup. Sve DB write, OpenAI i smoke komande traže eksplicitni korisnički zahtjev.

## 9. Rizici, blockeri i otvorene odluke

### Potvrđeno iz codebasea

- Standard battery ima tri active lanea i Composite zahtijeva sva tri linked completed attempta.
- Active standard assignment je unique; historical completed assignment je moguć.
- Single-test, Composite/IDP, Team Dynamics i Team Fit imaju različite persistence i lifecycle tabele.
- Team Dynamics final aggregation ne može biti ready s incomplete članovima; Executive Overview selection path potvrđuje minimum četiri score-ready člana.
- Existing replay fixture script već koristi explicit confirmation, marker, idempotency checks i cleanup.

### Tehničke preporuke

- Lifecycle team neka bude jedini team s dva controlled incomplete slučaja; njegov Team Dynamics report testirati kao not-ready scenario ili koristiti odvojenu fully-complete Team Dynamics roundu za report ready scenario.
- Početi samo s `GD-001`, complete standard battery i single-test/Composite/IDP bundleom prije team fixture širenja.
- Fixture key, manifest version, created-ID ledger i cleanup ownership marker su obavezni prije prvog writea.

### Otvorene odluke za korisnika

1. Da li dva lifecycle slučaja predstavljaju dvije nedovršene standard-battery runde, ili jedan kandidat ima historical completed i novu active rundu, uz drugi nezavršeni slučaj? Tehnički model dopušta zatvorenu pa novu aktivnu assignment rundu; product demo prikaz treba odlučiti.
2. Da li prvi Golden release uključuje Team Dynamics assessment za sva četiri tima ili se timski izvještaji uvode tek nakon individualnog `GD-001`/development kruga?
3. Display identitet organizacije je zaključan; preostaje odabrati tehnički synthetic namespace, fixture key i nedostavljivi demo email domain za lokalni manifest.

### Blockeri prije prvog DB writea

- Odobren versioned manifest/fixture key convention i synthetic identity namespace.
- Operator-owned explicit confirmed write/cleanup commands, bez oslanjanja na Amra hardkodirane targete.
- Finalna odluka o lifecycle modelu prije izrade `GDT-04` team assignmenta.
- Read-only provjera da lokalna DB stvarno ima aktivne IPIP, MWMS i SAFRAN pakete i važeći server env; ovaj docs-only audit to nije izvršio.
