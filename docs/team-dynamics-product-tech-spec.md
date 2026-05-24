# Team Dynamics Product/Tech Spec v0.1

## Status

- Status: Spec spreman (v0.1)
- Namjena: canonical dokument za Team Dynamics product/tech scope prije implementacije
- Scope ovog dokumenta: produktne i tehničke odluke za prvi MVP slice, bez implementacije koda

## Kontekst i cilj

Team Dynamics uvodi timski modul koji mjeri dinamiku tima kroz agregirani pristup. Cilj nije evaluacija pojedinca unutar tima, nego opis tima kao sistema i operativni uvid za HR/lidera.

## Zaključane user-facing odluke

- Naziv modula: `Timovi`
- Naziv assessmenta: `Procjena timske dinamike`
- Naziv reporta: `Timska dinamika`
- Arhitekturni tip reporta: agregirani report
- Predloženi slug: `team_dynamics_v1_strong`

## Zaključani sadržaj baterije

Team Dynamics Battery v1 strong ima 4 skale:

- PCS (Perceived Cohesion Scale)
- Jehn ICS-8 (Intragroup Conflict Scale)
- TPS-7 (Team Psychological Safety)
- Lewis TMS (Transactive Memory System)

Target item count: 36.

## Granice interpretacije i prikaza

- Nema overall team score-a.
- Report ostaje profil po domenima/signals, ne jedinstveni total.
- Individualni rezultati članova tima se ne prikazuju HR-u/lideru.
- AI dobija samo agregirane determinističke podatke.
- AI ne dobija individualne odgovore članova.

## Pragovi za dostupnost reporta

- 0-2 validna odgovora: `blocked` (report nedostupan)
- 3-4 validna odgovora: `indicative` (interni state, nije full user-facing)
- 5+ validnih odgovora: full user-facing report

## v0.1 role model

- Lider se tretira kao team member u v0.1.
- Role se čuva u membership sloju.
- Nema leader-vs-team delta izlaza u v0.1.

## Mock package i scoring odluka

- Prvi mock package koristi unified 1-5 response skalu.
- Scoring engine mora ostati metadata-aware za per-item/per-scale skale.
- DB category note (MVP): package category koristi `behavioral` kao DB-compatible storage fallback jer trenutni `public.tests.category` constraint podržava samo personality/behavioral/cognitive. Ovo ne mijenja canonical semantiku: Team Dynamics ostaje team assessment identifikovan slug-om `team_dynamics_v1_strong`, `intended_use: "team_assessment"` i `report_family: "team_dynamics"`.

## Runtime state machine / execution lifecycle

Ova sekcija zakljucava minimalni runtime state machine spec za buduci Team Dynamics execution UI. Ovo nije implementation task i ne uvodi response persistence, autosave, completion, scoring, aggregation ni report generation.

### Access boundary i execution path

- `team_assessment_participants.id` je public/wrapper access key za team-member execution flow.
- `attempt_id` je interni execution payload i ne smije biti public access key.
- Direct `/app/attempts/[attemptId]/run` ulaz za Team Dynamics mora ostati blokiran.
- `/app/team-assessments/[teamAssessmentParticipantId]/run` je jedini planirani execution wrapper path.
- Read-only handoff smije pripremiti samo execution metadata, `questionOutline` i `blockOutline`.
- Read-only handoff ne smije renderovati executable questions.

### Participant lifecycle i internal attempt lifecycle

- Participant lifecycle za wrapper sloj ostaje odvojen od internog attempt lifecycle-a.
- Wrapper lifecycle predstavlja pravo pristupa i execution kontekst za konkretnog clana tima.
- Internal attempt lifecycle predstavlja tehnicki payload koji ce kasnije nositi response capture, completion i scoring korake.
- Wrapper state ne smije automatski implicirati da su response capture, completion ili scoring omoguceni.
- Buduca implementation faza mora eksplicitno odvojiti:
  - read-only handoff
  - response capture
  - completion
  - scoring

### Allowed state groups

#### 1. Not runnable / blocked

Primjeri:
- missing participant wrapper
- inactive assignment
- expired assignment
- participant not allowed
- missing/internal attempt invalid
- unsupported test/package shape

UI behavior:
- prikazati samo siguran unavailable/readiness-blocked shell
- ne prikazivati executable questions
- ne prikazivati answer options
- ne prikazivati response state

Allowed backend action:
- wrapper/access/context validation
- safe-state resolution
- read-only failure/not-found handling

Forbidden backend action:
- response capture
- autosave
- completion
- scoring
- report orchestration

Next transition:
- ostaje blocked dok se wrapper, assignment, attempt i package shape ne validiraju

Guardrail notes:
- unknown ili unsupported state ne smije postati runnable fallbackom
- invalid attempt payload ne smije postati novi public entry path

#### 2. Readiness / prepared

Primjeri:
- wrapper valid
- attempt valid
- package active
- `questionOutline` loaded
- `blockOutline` loaded
- nema executable UI-ja

UI behavior:
- readiness shell
- neutralni prikaz statusa
- neutralni indikator broja pripremljenih sekcija i pitanja
- bez prikaza pitanja kao rjesivog assessmenta

Allowed backend action:
- read-only handoff build
- question/block outline validation
- wrapper transition u read-only prepared execution context ako je to vec dozvoljeno wrapper pravilima

Forbidden backend action:
- response persistence
- autosave
- completion
- scoring
- report generation

Next transition:
- buduci explicitni `ready_for_response_capture` state kada response capture slice bude implementiran

Guardrail notes:
- read-only prepared ne znaci executable
- prepared state ne smije izlagati raw `attempt_id` u UI

#### 3. Future executable

Minimalni planirani state-ovi:
- `ready_for_response_capture`
- `in_progress`
- `paused/resumable`

UI behavior:
- van scope-a ovog taska
- nijedan od ovih state-ova jos ne smije biti renderovan kao aktivni execution UI u trenutnoj implementaciji

Allowed backend action:
- samo buduci response capture slice smije definisati create/update response operacije
- samo buduci autosave/resume slice smije definisati persistence i resume pravila

Forbidden backend action:
- completion bez definisanih response persistence guardova
- scoring prije completion slice-a
- report orchestration prije zasebnog team-level report taska

Next transition:
- `ready_for_response_capture -> in_progress -> paused/resumable -> submitted/completed`

Guardrail notes:
- `paused/resumable` ne smije postojati prije persistence/resume dizajna
- `in_progress` ne smije biti izveden samo iz posjete readiness shellu

#### 4. Terminal

Minimalni planirani state-ovi:
- `submitted/completed`
- `expired after start`
- `cancelled/invalidated`

UI behavior:
- prikazati safe terminal shell bez executable pitanja
- eventualni buduci post-completion UX ostaje poseban task

Allowed backend action:
- samo buduci completion slice smije definisati submit/finalize semantiku
- samo buduci scoring slice smije definisati scoring nakon validnog completion-a

Forbidden backend action:
- ponovno otvaranje execution UI-ja bez eksplicitnog resume/override pravila
- implicitno pokretanje individualnih report lane-ova

Next transition:
- terminal state nema dalje normalne execution tranzicije

Guardrail notes:
- `expired after start` ne smije tiho postati resumable
- `cancelled/invalidated` mora ostati hard stop dok zaseban admin/runtime override task ne definise drugacije

### Transition guardovi

- Wrapper mora postojati i pripadati autentifikovanom korisniku kroz participant ownership.
- Membership mora biti aktivan.
- Assignment mora biti aktivan i Team Dynamics-compatible.
- Linked attempt mora pripadati istom participantu, organizaciji i Team Dynamics testu.
- Package/test shape mora biti podrzan za sigurni Team Dynamics wrapper flow.
- Read-only handoff moze postojati samo kada su wrapper, attempt i package shape validni.
- Response capture ne smije biti omogucen prije zasebnog persistence/capture slice-a.
- Completion ne smije biti omogucen prije zasebnog completion slice-a.
- Scoring ne smije biti omogucen prije zasebnog scoring slice-a.

### Pre-response-capture guardrails

- Response capture nije dio ovog taska.
- Read-only handoff ne smije upisivati responses.
- Nema autosave-a.
- Nema local persistence contracta.
- Nema resume modela.
- Nema executable question renderer-a.
- Nema answer option renderer-a za aktivno odgovaranje.

### Pre-completion guardrails

- Completion nije dio ovog taska.
- Readiness shell ne smije nuditi submit/completion action.
- Nema completion transition-a iz read-only handoff stanja.
- Nema final validation response payloada jer response capture jos ne postoji.
- Nema side-effectova koji oznacavaju assessment kao zavrsen.

### Pre-scoring guardrails

- Scoring nije dio ovog taska.
- Nema score calculation-a.
- Nema dimension score persistence-a.
- Nema team aggregation-a.
- Nema report-readiness odluke na osnovu read-only handoffa.

### Privacy / team boundary guardrails

- Individualni odgovori jednog clana tima ne smiju biti vidljivi drugim clanovima tima.
- HR/lider ne dobija individualni execution payload kroz ovaj flow.
- UI ne smije izlagati raw `attempt_id`.
- Wrapper path mora ostati jedina public execution granica.
- Team Dynamics team-member execution ne smije otvoriti kandidatov standardni individual assessment flow.

### Report orchestration guardrails

- Team Dynamics completion ne smije automatski enqueue-ati individual participant report.
- Ne smije enqueue-ati HR single-test report.
- Ne smije enqueue-ati composite HR report.
- Ne smije kreirati `attempt_reports`.
- Ne smije kreirati `assessment_reports single_test`.
- Buduci team-level report layer mora biti poseban task.

### Runtime lifecycle summary

| State group | Example condition | UI behavior | Allowed action | Forbidden action | Next planned slice |
| --- | --- | --- | --- | --- | --- |
| Not runnable / blocked | Missing wrapper ili inactive/expired assignment | Safe unavailable shell bez pitanja | Access/context validation | Response capture, completion, scoring, reports | Wrapper/access hardening ostaje source of truth |
| Readiness / prepared | Wrapper valid, attempt valid, outline ucitan | Readiness shell sa neutralnim indikatorima | Read-only handoff build | Executable questions, persistence, completion, scoring | Response capture spec/implementation |
| Future executable | `ready_for_response_capture`, `in_progress`, `paused/resumable` | Buduci execution UI, van scope-a ovog dokument synca | Buduci response handling flow | Bypass persistence guardova, prerani scoring | Response persistence/capture slice |
| Terminal | `submitted/completed`, `expired after start`, `cancelled/invalidated` | Safe terminal shell | Buduca completion/scoring finalizacija | Re-open bez eksplicitnih pravila, individual report enqueue | Completion slice, zatim scoring slice |

## Minimal answer payload contract / response persistence boundary

Ova sekcija zakljucava minimalni contract za buduci Team Dynamics single-select Likert response write skeleton. Ovo nije implementation task i ne uvodi DB schema, server action, autosave, completion, scoring, aggregation ni report generation.

### Minimalni payload

Buduci V1 persistence skeleton treba polaziti od sljedeceg payload shape-a:

```ts
{
  teamAssessmentParticipantId: string
  attemptId: string
  questionId: string
  optionId: string
  responseFormat: "single_select_likert"
  locale: AssessmentLocale
  clientTimestamp?: string
}
```

Zakljucane semantike polja:

- `teamAssessmentParticipantId`
  - public wrapper access key
  - jedini public execution/persistence boundary za team member response flow
- `attemptId`
  - interni execution payload
  - nije public access key
  - ne smije biti direktni route/write entry point
- `questionId`
  - mora pripadati aktivnom Team Dynamics handoffu za dati wrapper
- `optionId`
  - mora pripadati bas tom `questionId`
- `responseFormat`
  - u ovom V1 contractu mora biti tacno `single_select_likert`
- `locale`
  - metadata za localization/debug/audit kontekst
  - nije dozvola za bypass validation pravila
- `clientTimestamp`
  - optional metadata only
  - nije source of truth za ordering, completion ili overwrite odluke

### Validation boundary

- `teamAssessmentParticipantId` mora postojati i pripadati trenutnom authenticated participant/user contextu.
- `attemptId` mora biti interni attempt povezan sa tim `team_assessment_participants` rowom.
- `questionId` mora pripadati aktivnom Team Dynamics test/package handoffu.
- `optionId` mora pripadati tom `questionId`.
- Pitanje mora biti supported Likert-style single-select item.
- Unsupported/no-options/SJT items nisu validni za ovaj V1 persistence skeleton.
- `completed`, `expired`, `cancelled` i `invalidated` wrapper state ne smiju primati response write.
- Direct `/app/attempts/[attemptId]/run` flow ne smije biti persistence entry point za Team Dynamics.
- Raw `attemptId` se ne smije koristiti kao public access key.

### Overwrite i idempotency rules

- Prije completion-a dozvoljen je overwrite odgovora za isti `teamAssessmentParticipantId + questionId`.
- Zadnji validan izbor zamjenjuje prethodni izbor za isto pitanje.
- Ponovni isti payload treba biti idempotentno siguran.
- Nema append-only multiple responses za isti `questionId` u ovom V1 skeletonu.
- Completion jos nije implementiran, ali contract zakljucava da nakon completion-a response write mora biti blokiran.

### Persistence boundary

- Ovaj contract ne uvodi DB schema.
- Ovaj contract ne uvodi server action.
- Ovaj contract ne uvodi autosave.
- Ovaj contract ne uvodi completion.
- Ovaj contract ne uvodi scoring.
- Ovaj contract ne uvodi aggregation.
- Ovaj contract ne uvodi report generation.
- Buduci DB persistence slice moze koristiti ovaj contract za server-side validation/helper.

### Privacy / team boundary

- Clan tima moze pisati samo svoje odgovore kroz svoj `teamAssessmentParticipantId` wrapper.
- Clan tima ne smije citati ili pisati odgovore drugih clanova tima.
- HR/admin ne koristi ovaj participant response write endpoint.
- Team-level report layer ostaje poseban task.

### Report/scoring guardrails

- Response write ne smije pokrenuti scoring.
- Response write ne smije pokrenuti team aggregation.
- Response write ne smije enqueue-ati `attempt_reports`.
- Response write ne smije enqueue-ati `assessment_reports`.
- Response write ne smije generisati participant report, HR single-test report, composite HR report ili Team Fit output.

### Payload field summary

| Field | Source | Validation | Persistence note |
| --- | --- | --- | --- |
| `teamAssessmentParticipantId` | Wrapper route param / authenticated execution context | Mora postojati, pripadati useru i ostati wrapper access boundary | Public key za wrapper flow, ali ne siri pristup van vlastitog wrappera |
| `attemptId` | Interni handoff payload | Mora biti linked attempt za dati wrapper i isti Team Dynamics context | Interni payload only; nije public access key ni route key |
| `questionId` | Read-only handoff (`questionOutline` / buduci runtime payload) | Mora pripadati aktivnom Team Dynamics handoffu | Kandidat za overwrite key zajedno sa wrapper contextom |
| `optionId` | Read-only option payload za dati item | Mora pripadati bas tom `questionId` | Predstavlja zadnji validni izbor za pitanje |
| `responseFormat` | Runtime payload contract | Mora biti `single_select_likert` | Zakljucava da V1 write skeleton ne prima SJT/mixed-format odgovore |
| `locale` | Attempt/handoff localization context | Normalized `AssessmentLocale`; nije auth signal | Metadata only za localization/debug kontekst |
| `clientTimestamp` | Client metadata | Opcionalno; ne smije nadjacati server truth | Advisory metadata only, ne kontrolise overwrite/completion |

### Scenario summary

| Scenario | Expected behavior | Why |
| --- | --- | --- |
| valid single-select Likert answer | Dozvoljen za buduci write skeleton, uz server-side validation wrappera, attempta, pitanja i opcije | Ovo je jedini podrzani V1 response format |
| same question overwrite before completion | Dozvoljen; zadnji validan izbor zamjenjuje prethodni | V1 skeleton je single-current-answer model, ne append-only history |
| same payload repeated | Idempotentno sigurno; ne smije stvarati duplikate ni nove response row-intent side-effectove | Retry-safe behavior je potreban prije autosave/resume sloja |
| `optionId` does not belong to `questionId` | Odbiti write | Cuva integritet response/question veze |
| unsupported SJT/best-worst item | Odbiti write | Ovaj contract je ogranicen na `single_select_likert` |
| expired wrapper | Odbiti write | Expired state nije runnable niti writable |
| completed wrapper | Odbiti write | Nakon completion-a write mora biti blokiran |
| direct attempt route write attempt | Odbiti write | Team Dynamics ne smije koristiti generic attempt route kao public persistence entry |
| another member's wrapper | Odbiti write | Team boundary i privacy model dozvoljava samo vlastiti wrapper context |

## Licenca i sadržaj itema

- Stvarni licencirani itemi ne ulaze u produkcijski repo dok pravni i jezički tok nisu zaključani.
- U scaffold/mock fazi dozvoljeni su samo placeholder itemi.

## Minimal scoring storage decision / member score persistence boundary

Ova sekcija zakljucava docs/spec odluku za buduce cuvanje member-level Team Dynamics minimal score snapshot-a. Ovo nije implementation task i ne uvodi DB schema, migraciju, runtime write path, team aggregation, report orchestration ni AI/report generation.

### Zakljucana storage odluka

- Buduci member-level Team Dynamics minimal score ne ide u `attempt_reports`.
- Buduci member-level Team Dynamics minimal score ne ide u `assessment_reports`.
- Buduci member-level Team Dynamics minimal score ne ide kao direktna mutacija `responses`.
- Preferirani storage model je zaseban ownership sloj, npr. `team_assessment_participant_scores`.
- Svrha tog sloja je da cuva completed member-level scoring snapshot za jedan `team_assessment_participant`.
- Taj sloj nije report artefakt.
- Taj sloj nije AI artefakt.
- Taj sloj nije team aggregate.

### Zasto dedicated ownership sloj

- `team_assessment_participants` je vec canonical wrapper boundary za Team Dynamics member flow.
- Member-level score snapshot mora ostati vezan za taj wrapper, a ne za generic report lane.
- Buduci aggregation layer treba da cita stabilne completed member snapshotove, a ne da ponovo otvara raw response editing tok.
- Dedicated ownership sloj jasnije odvaja:
  - raw answer evidence
  - derived member scoring snapshot
  - buduci team aggregate
  - buduci report artefakt

### Preporuceni buduci model

Preporuceni buduci table/model shape, bez implementacije u ovom slice-u:

```ts
team_assessment_participant_scores
```

Namjena:

- jedan score snapshot pripada jednom `team_assessment_participant`
- linked je na interni `attempt_id` radi traceability
- pripada istom Team Dynamics assignment/wrapper kontekstu kao i saved responses
- cuva derived member-level scoring output nakon validnog completion-a

### Preporucena ownership i polja

Preporucena polja koja dokument zakljucava, ali ne implementira:

- `id`
- `team_assessment_participant_id`
- `attempt_id`
- `test_slug` ili `package_slug`
- `scoring_version`
- `scoring_status: scored | not_scored | failed | stale`
- `raw_total`
- `mean_raw`
- `score_0_100`
- `supported_question_count`
- `scored_question_count`
- `ignored_invalid_answer_count`
- `scale_min`
- `scale_max`
- `score_value_source`
- `missing_question_ids`
- `score_snapshot jsonb`
- `source_response_count`
- `source_completed_at`
- `calculated_at`
- `created_at`
- `updated_at`

### Semantika i lifecycle granice

- `team_assessment_participant_id`
  - canonical ownership key za member-level Team Dynamics score snapshot
  - score snapshot ne smije postojati bez validnog Team Dynamics wrapper konteksta
- `attempt_id`
  - interni traceability key
  - nije public access key
  - koristi se za dokazivanje izvora score snapshot-a
- `scoring_version`
  - zakljucava scoring contract koji je proizveo snapshot
  - potreban za buduce recalculation i migration-safe interpretacije
- `scoring_status`
  - `scored`: snapshot je uspjesno izracunat iz validnog completed inputa
  - `not_scored`: scoring semantics nisu dostupne ili numeric source nije validan
  - `failed`: scoring run je pokusao, ali nije proizveo validan snapshot
  - `stale`: saved score snapshot vise nije trusted/current za aktivni scoring contract
- `score_snapshot`
  - cuva strukturisani scoring output za audit/debug/buduci aggregation input
  - ne znaci da score treba prikazati participantu ili adminu u ovoj fazi
- `source_response_count` i `source_completed_at`
  - cuvaju minimalni audit trag o response coverage i completion trenutku iz kojeg je score izveden

### Preporucena uniqueness odluka

- Buduci model treba da cuva jedan current score po `team_assessment_participant_id + scoring_version`.
- Historija recalculation-a ostaje otvorena arhitektonska odluka:
  - ili versioned rows u istoj tabeli
  - ili poseban snapshot history model
- Ovaj docs/spec slice ne zakljucava history mehanizam, ali zakljucava da current ownership mora biti jasan na nivou wrappera i scoring versiona.

### Sta ne koristiti i zasto

#### 1. Computed-only scoring helper

- Dobar je za testove, early validation i uski runtime proof.
- Los je za auditability, repeatable aggregation input i performance buduceg team-level citanja.

#### 2. Store on `attempts`

- Djeluje primamljivo zato sto attempt vec postoji.
- Odbacuje se kao primarni smjer jer je previse generic i mjesa standard individual attempt scoring sa team-member scoring ownership modelom.

#### 3. Store in `attempt_reports`

- Odbacuje se jer je to report artefact storage, ne member-level scoring storage.
- Team Dynamics minimal score nije narativni/report output.

#### 4. Store in `assessment_reports`

- Odbacuje se jer je to assessment-level aggregate/report storage, ne member-level derived scoring ownership.
- Team Dynamics member score nije assessment-level artefakt.

#### 5. Dedicated `team_assessment_participant_scores`

- Ovo je preferirani smjer.
- Ownership, privacy granica, scoring versioning i buduca aggregation consumption granica su najcistiji u ovom modelu.

### Guardrails

- Team Dynamics member-level score ne smije ici u `attempt_reports`.
- Team Dynamics member-level score ne smije ici u `assessment_reports`.
- Team Dynamics member-level score ne smije ici kao direktna mutacija `responses`.
- Member-level score se ne prikazuje participantu u trenutnoj fazi.
- Member-level score se ne prikazuje adminu dok aggregation/privacy politika ne bude zakljucana.
- Member-level score se ne smije koristiti kao hire/no-hire ili individual evaluation output.
- Ovaj slice ne smije generisati AI sadrzaj iz score snapshot-a.
- Buduci aggregation layer treba da cita stored member score snapshotove, ne da ponovo otvara aktivni response editing tok.
- Buduca aggregation logika mora respektovati completion coverage, missing/not_scored statuse i privacy boundary prema drugim clanovima tima.
- Ovaj docs/spec slice ne uvodi:
  - DB migraciju
  - runtime persistence
  - team aggregation
  - report orchestration
  - `attempt_reports`
  - `assessment_reports`
  - AI/report generation
  - Team Fit output

## Team-level aggregation storage decision / persistence boundary

Ova sekcija zakljucava docs/spec odluku za buduce cuvanje team-level Team Dynamics aggregation snapshot-a. Ovo nije implementation task i ne uvodi DB schema, migraciju, runtime write path, report orchestration, AI/report generation ni Team Fit output.

### Zakljucana storage odluka

- Buduci Team Dynamics team-level aggregation snapshot ne ide u `attempt_reports`.
- Buduci Team Dynamics team-level aggregation snapshot ne ide u `assessment_reports`.
- Buduci Team Dynamics team-level aggregation snapshot ne ide kao direktna mutacija `team_assessment_participant_scores`.
- Buduci Team Dynamics team-level aggregation snapshot ne ide kao direktna mutacija `responses`.
- Preferirani storage model je zaseban ownership sloj, npr. `team_assessment_aggregation_snapshots`.
- Canonical ownership key treba biti `team_assessment_assignment_id`.
- `team_id` moze biti prisutan kao denormalized traceability field.
- Buduci model treba biti vezan za `aggregation_version`.
- Taj sloj cuva deterministic aggregation snapshot izveden iz completed member-level score snapshotova.
- Taj sloj nije report artefakt.
- Taj sloj nije AI artefakt.
- Taj sloj nije Team Fit output.

### Preporucena V1 polja

- `team_assessment_assignment_id`
- `team_id`
- `aggregation_version`
- `aggregation_status`
- `source_scoring_version`
- `source_score_snapshot_ids`
- `participant_count`
- `completed_participant_count`
- `included_score_count`
- `missing_completed_score_participant_ids`
- `mean_score_0_100`
- `min_score_0_100`
- `max_score_0_100`
- `range_score_0_100`
- `aggregation_snapshot`
- `calculated_at`
- `created_at`
- `updated_at`

### Preporuceni V1 statusi

- `ready`
- `not_ready`
- `stale`
- `failed`

### Uniqueness i stale politika

- Buduci model treba da cuva jedan current row po `team_assessment_assignment_id + aggregation_version`.
- Recalculation za isti `aggregation_version` treba da update-uje isti logical row.
- Buduce verzije smiju koegzistirati kroz novi `aggregation_version`.
- Ako se member score snapshot promijeni nakon team aggregation snapshot-a, aggregation moze postati `stale` ili biti recalculated u buducem persistence slice-u.
- Ovaj docs/spec slice ne implementira stale mark ni recalculation runtime.

### Privacy guardrails

- Individualni member scorevi se ne prikazuju u admin UI-u.
- Individualni odgovori se ne prikazuju kroz aggregation sloj.
- Buduci team-level report smije koristiti samo agregirane vrijednosti i disagreement/coverage signale, ne raw individual answers.

### Ovaj slice ne uvodi

- DB migraciju
- novu tabelu sada
- persistence helper
- runtime write
- UI prikaz
- report orchestration
- `attempt_reports`
- `assessment_reports`
- AI/report generation
- Team Fit output
- promjenu scoring helper code-a

### Implementation note (2026-05-24)

- Prvi Team Dynamics aggregation snapshot persistence slice je sada implementiran.
- Uvedena je dedicated tabela `team_assessment_aggregation_snapshots`.
- Uveden je server-only helper `persistTeamAssessmentAggregationSnapshot(...)`.
- Idempotency je vezan za `team_assessment_assignment_id + aggregation_version`:
  - prvi persist insertuje row
  - ponovni persist update-uje isti logical row
- Storage statusi ostaju `ready`, `not_ready`, `stale`, `failed`, dok runtime u ovom uskom slice-u mapira draft na `ready` ili `not_ready`.
- Slice ostaje bez UI prikaza, bez report orchestration-a, bez `attempt_reports`, bez `assessment_reports`, bez AI/report generation-a i bez Team Fit outputa.

### Implementation note (2026-05-24, aggregation read/verification)

- Dodan je server-only read/verification helper `loadTeamAssessmentAggregationVerification(...)`.
- Helper radi persisted snapshot lookup po `teamAssessmentAssignmentId + aggregationVersion`.
- Ako snapshot ne postoji, helper vraća kontrolisan `missing` rezultat (`aggregation_snapshot_not_found`), bez nekontrolisanog errora.
- Kada snapshot postoji, helper radi osnovnu shape/consistency verifikaciju i vraća `verified` ili `invalid` sa `reasons`.
- Slice ostaje bez write-a, bez recalculation-a, bez UI prikaza, bez report orchestration-a, bez AI/report generation-a i bez Team Fit outputa.

### Implementation note (2026-05-24, end-to-end aggregation runtime smoke)

- End-to-end server-side aggregation runtime smoke je potvrđen.
- Potvrđeni chain je: completion -> member score snapshot -> aggregation draft -> aggregation persistence -> aggregation read verification.
- Zatvoren je completion context refresh bug: nakon completion transitiona score persistence koristi completed context.
- Slice ostaje bez UI prikaza, bez report orchestration-a, bez AI/report generation-a i bez Team Fit outputa.

### Implementation note (2026-05-24, aggregation lifecycle hardening)

- Lifecycle ownership je zaključan: persisted Team Dynamics aggregation snapshot smije nastati ili se osvježiti samo kroz server-only helper path.
- Source za snapshot ostaje aggregation draft helper nad persisted member score snapshotovima; ne koriste se UI state, report view ili AI/report orchestration path-evi.
- `stale` je definisan kao potencijalno zastario deterministic snapshot u odnosu na novije source member score snapshotove, ali V1 ne zahtijeva automatski stale write na svaku promjenu.
- Budući recalculation treba ići kroz jedan server-only lifecycle helper koji reuse-a aggregation draft i aggregation persistence helper, bez UI/report/AI/Team Fit slojeva.

### Implementation note (2026-05-24, aggregation lifecycle helper skeleton)

- Dodan je server-only lifecycle helper `refreshTeamAssessmentAggregationSnapshot(...)` u `lib/assessment/team-assessment-aggregation-lifecycle.ts`.
- Helper je vlasnički refresh/recalculation entry point za lanac: aggregation draft -> aggregation persistence -> aggregation read verification.
- Helper vraća kontrolisane lifecycle statuse: `refreshed`, `not_ready`, `verification_failed`, `failed`.
- Completion action, report orchestration i UI slojevi ne pokreću ovaj helper.

## Prvi implementation task (nakon ovog spec sync-a)

Task: `Create Team Dynamics data model scaffold and placeholder package support`

Task mora ostati uzak:

- team-specific data model scaffold
- placeholder package support
- minimalni schema/package testovi

Task eksplicitno ne uključuje:

- stvarne licencirane iteme
- finalni scoring/agregaciju
- AI providera
- renderere
- relacijski kandidat-tim fit report
- DUTCH implementaciju

## Preporučeni redoslijed

1. Završiti dokumentacioni sync ovog speca u repou.
2. Otvoriti i realizovati prvi uski implementation task iznad.
