# Team Fit V2 Runtime Plan

## Executive decision

Team Fit V2 treba uvesti kao paralelnu, eksplicitno verzioniranu putanju uz nepromijenjeni V1 runtime. Autoritet za izbor putanje je identitet na svakom `team_fit_reports` redu: tačan par `report_type + report_version`. Globalni env switch ne smije odlučivati da li je red V1 ili V2.

Postojeća tabela je dovoljan persistence model: `input_snapshot` i `report_snapshot` su JSONB, lifecycle kolone su verzijski neutralne, a postojeći queue i relational indeksi već uključuju type/version. Nova tabela ni nove snapshot kolone nisu opravdane. Ipak, potrebna je backward-compatible migracija jer aktuelni check constrainti dozvoljavaju samo `team_fit_report_v1` i `v1`. Migracija mora dozvoliti isključivo validne parove V1/V1 i V2/V2, bez izmjene postojećih redova i bez unique constrainta.

Rollout ostaje operator-controlled: offline foundation, mock processor, fixture display, pa tek onda jedan posebno odobren persisted GD-001 × GDT-01 smoke. V1 queue, processor i prikaz ostaju dostupni tokom cijelog rollouta. Rollback znači zaustaviti kreiranje V2 redova i sakriti V2 entrypoint, ne brisati niti pretvarati postojeće reporte.

## Current proven architecture

Canonical todo potvrđuje završene V2 contract/schema, evidence, prompt i provider foundation slojeve te prihvaćen GD-001 × GDT-01 preview. V2 je HR-interni candidate-vs-team report bez numeric fit scorea, rankinga, pass/fail ili hire/no-hire odluke. IDP ostaje vlasnik osnovnog individualnog onboardinga; Team Fit V2 pokriva samo prilagodbu konkretnom timu.

`team-fit-report-v2-openai-provider.ts` već daje strict `team_fit_report_v2` schema request, authoritative envelope, V2 contract i evidence-reference validaciju te strukturirane failure code/stage vrijednosti. Canonical preview je dokazao reuse `buildTeamFitReportInputSnapshotFromSources(...)`, 3/3 candidate i 6/6/6 team lineage, ali nije runtime registracija niti persistence dokaz.

Repo audit nije koristio DB. Stoga su migration fajlovi repo-proven schema intent, a stvarni remote constrainti i migration history ostaju runtime činjenice za kasniji read-only preflight.

## V1 runtime map

- `team-fit-report-lifecycle.ts` definiše V1 type/version konstante. `queueTeamFitReportShell(...)` uvijek upisuje V1 identitet. Claim, fail i reset rade nad statusom i organization-scoped ID-em te su konceptualno verzijski neutralni; ready red se ne može claimovati, failovati niti resetovati.
- `team-fit-report-input.ts` tipizira, gradi i validira `TeamFitReportInputSnapshot.reportType/reportVersion` kao V1. Row-backed builder odbija drugi identitet. Enriched source-direct mapping i coverage logika nisu V1-specifični po sadržaju.
- `team-fit-report-processor.ts` je V1-only: koristi V1 provider seam, V1 validator i `TeamFitReportV1` u ready updateu. `TEAM_FIT_REPORT_PROVIDER` bira mock/OpenAI unutar V1 putanje; to nije report-version router.
- `app/actions/team-assessments.ts` je stvarni manual process/reset entrypoint. Obje akcije eksplicitno odbijaju identitet različit od V1 prije procesiranja ili reseta.
- `team-fit-report-display.ts` u queryju filtrira V1, validira samo V1 snapshot i vraća V1-only record. `team-fit-report-list.ts` isto filtrira V1 i u mapped entry upisuje V1 konstante.
- Postojeći route sadrži row ID i može ostati isti, ali uvijek renderuje `TeamFitReportView`, čiji sadržaj i tipovi pripadaju V1 contractu.
- Repo-wide import mapa pokazuje samo manual action kao production importer processora; nema Team Fit worker/scheduler dispatchera. To treba zadržati u prvom rollout krugu.

## V2 compatibility gaps

Commit-blocking runtime gapovi prije prvog V2 reda su:

1. DB constrainti ne prihvataju V2 identity.
2. Queue nema eksplicitni version argument ili V2 entrypoint.
3. Input snapshot type, validator, builder i row guard hardkodiraju V1.
4. Processor claimuje red prije dokazivanja da pripada V1, a provider/validator/ready write su V1-only.
5. V2 provider failure contract nije mapiran na lifecycle failure marker.
6. Display i list queryji filtriraju V1; loader i view nemaju discriminated union.
7. Manual process/reset actioni su namjerno V1-only i nema odobrenog V2 operator gatea.

Ovi gapovi se rješavaju verzijskim granicama, ne zamjenom postojećih V1 modula preko globalnog feature/env switcha.

## Database and migration decision

Potrebna je jedna additive/backward-compatible migracija nad `team_fit_reports`. Ona treba ukloniti postojeće single-value `team_fit_reports_report_type_check` i `team_fit_reports_report_version_check` te ih zamijeniti jednim paired identity checkom koji dozvoljava samo:

- `team_fit_report_v1` + `v1`;
- `team_fit_report_v2` + `v2`.

Time su miješani parovi fail-closed i svi V1 redovi ostaju validni. JSONB kolone fizički primaju oba snapshot contracta. Status constraint, source-type constrainti, trigger i organization-based RLS ne zavise od verzije i ne trebaju izmjenu. Queue indeks `(report_status, report_type, report_version, queued_at)` i relational lookup indeks `(organization_id, team_id, participant_id, report_type, report_version)` već podržavaju paralelne verzije.

Ne dodavati unique constraint: aktuelni workflow ga nema, a paralelan V1 i V2 za isti organization/team/participant je poželjan tokom rollouta. Duplikate iste verzije treba kontrolisati u operator workflowu dok se stvarni podaci ne analiziraju.

Repo sadrži početnu migraciju `20260530110000_add_team_fit_reports.sql` i no-op alias marker `20260530183640_reconcile_duplicate_team_fit_reports.sql`; kasnije GDT-01 migracije samo čitaju tabelu. Poznati remote history alias/drift ne treba repairati ovim sliceom. Prije applyja nove migracije obavezni su zasebno odobreni read-only remote schema/history preflight i potvrda stvarnih constrainta, indeksa i RLS-a.

## Version ownership and routing

Uvesti centralni `TeamFitReportIdentity` discriminated union sa dva legalna para. Red u bazi je authoritative; request, env ili provider ne smiju preglasiti njegov identitet.

Postojeći `queueTeamFitReportShell(...)` ostaje V1 wrapper sa istim ulazom i rezultatom. Novi eksplicitni `queueTeamFitReportV2Shell(...)` poziva zajednički interni insert sa V2 identitetom. Javni generic queue koji prima proizvoljne stringove nije potreban. Claim može ostati zajednički, ali processor mora pročitati i provjeriti row identity prije input builda ili provider poziva. V1 processor mora odbiti V2 red, a V2 processor V1 red.

`TEAM_FIT_REPORT_PROVIDER` ostaje isključivo izbor providera u V1 processoru. Nije V1/V2 gate i ne smije automatski preusmjeriti nove ili postojeće redove.

## Input contract decision

Zadržati isti enriched `TeamFitReportInputSnapshot` payload i source-direct mapping. Candidate/team signali, provenance, coverage i interpretation guardraili već daju potreban V2 input; kopiranje mapping logike bi uvelo drift.

Potrebna je uska generalizacija identity polja: `reportType/reportVersion` postaju `TeamFitReportIdentity`, a builder dobija eksplicitni identity parametar. Postojeći V1 row-backed pozivi zadržavaju V1 default radi kompatibilnosti; V2 row-backed path mora proslijediti V2 identity i potvrditi da odgovara redu. `inputType` i `inputVersion` ostaju zaseban input-contract autoritet i ne treba ih vezati za output V1/V2 naziv. Nije potreban novi V2 input model ni wrapper.

`buildTeamFitReportInputSnapshotFromSources(...)` ostaje jedini source-direct builder. Njegovi postojeći lineage i 3/3 + full-team coverage guardraili koriste se u oba patha. Persisted input snapshot mora imati isti report identity kao row; mismatch pada prije providera.

## Processor and provider integration

Najsigurniji adapter je zaseban `processTeamFitReportV2WithProvider(...)`, uz zadržan V1 processor seam. V2 adapter treba:

1. loadati/claimovati samo eksplicitni V2 red;
2. izgraditi ili persistirati version-matched shared input snapshot;
3. pozvati injected V2 provider u testu ili `generateTeamFitReportV2WithOpenAI(...)` tek u odobrenom live pathu;
4. prihvatiti samo uspješan V2 contract i evidence validation rezultat;
5. atomically označiti isti processing V2 red ready sa V2 snapshotom.

V2 `code + stage` mapirati u stabilan lifecycle error marker/string za postojeći `error_message`; zadržati detalj u server log/typed resultu bez mijenjanja schema u ovom sliceu. Nema retryja, fallback modela ili fallback sadržaja.

Ready persistence helper treba primati discriminated snapshot union ili generic JSON-safe vrijednost uz obavezni identity-specific validator prije updatea. Type safety dolazi iz grane: V1 identity → V1 validator/snapshot; V2 identity → V2 contract i evidence validator/snapshot. Update mora uključiti `report_status = processing` i očekivani type/version filter da pogrešan processor ne može završiti red.

## Persistence and lifecycle

Lifecycle statusi i timestampi ostaju zajednički. Claim/fail/reset mogu dijeliti implementaciju kada vraćaju row identity i zadrže organization/status compare-and-set uslove. Reset je dopušten samo iz failed; ready V1 ili V2 se ne regeneriše niti overwriteuje. Existing reset ne briše snapshot polja, pa V2 retry policy prije rollouta mora eksplicitno odrediti da li failed partial input ostaje reusable; report snapshot se nikad ne zamjenjuje na ready redu.

V1 i V2 redovi smiju postojati paralelno za isti kandidat × tim. Novi V2 red ne mijenja, resetuje niti supersedeuje V1 red. Prvi persisted smoke mora pre/post provjerom dokazati tačno jedan novi V2 red i nepromijenjen postojeći V1 red.

## Display and renderer strategy

URL može ostati `/.../team-fit-reports/[teamFitReportId]` jer row ID određuje zapis. Loader prvo učitava organization/team/participant-scoped red bez V1 filtera, zatim dispatchuje po legalnom identity paru i vraća union:

- ready V1 + validirani `TeamFitReportV1`;
- ready V2 + validirani `TeamFitReportV2`;
- zajednički non-ready record sa identity i statusom.

Nepoznat ili miješan identity i invalidan ready snapshot padaju fail-closed. Route bira postojeći `TeamFitReportView` samo za V1 i novi `TeamFitReportV2View` samo za V2. Stabilni layout/UI primitives mogu se dijeliti; V1 section model se ne koristi za V2. V2 view prikazuje contract sadržaj, ne raw evidence katalog, UUID-jeve ili source slugove u user-facing prozi.

List entry dobija identity union i vidljivu verzijsku oznaku. Tokom rollouta prikazati oba reda umjesto implicitnog latest-wins izbora. Ako kasnije treba jedan preferred link, policy mora biti eksplicitan: V2 tek kada je ready i gate je uključen, inače V1; timestamp sam nije autoritet.

## Actions, worker and rollout control

Postojeće V1 process/reset akcije ostaju nepromijenjene i V1-only. V2 dobija zaseban operator entrypoint tek u rollout fazi, sa server-side gateom ograničenim na canonical GD-001 × GDT-01 lineage i eksplicitnu potvrdu. Gate kontroliše stvaranje/obradu V2 reda, ne mijenja identity postojećih redova.

Ne uvoditi scheduler niti generic worker u prvom rollout krugu. Nema automatskog procesiranja svih queued V2 redova, masovne regeneracije ili UI dostupnosti prije odobrenja. CLI/manual smoke mora koristiti isti V2 processor, ne direktni persistence ili provider bypass.

## Rollout and rollback

- **Faza 0:** offline identity, lifecycle, input, processor i display testovi; bez DB-a/OpenAI-ja.
- **Faza 1:** versioned queue/lifecycle/persistence foundation i migration fajl, ali bez migration applyja i bez production UI entrypointa.
- **Faza 2:** V2 processor sa injected valid/failure providerima; dokaz type/version routing, validation, failure mapping i no-call behavior.
- **Faza 3:** discriminated loader/list i `TeamFitReportV2View` nad fixture snapshotom; bez live report generationa.
- **Faza 4:** zasebno odobren migration apply i operator-approved GD-001 × GDT-01 smoke: jedan novi V2 red, jedan OpenAI poziv, post-write contract/evidence/lineage provjera i browser smoke. Nijedan drugi kandidat ili tim.

Rollback je nedestruktivan: ugasiti V2 creation/processing gate, ostaviti V1 queue/processor netaknut, sakriti V2 UI entrypoint i zadržati persisted V2 red read-only. Ne brisati V2, ne pretvarati ga u V1, ne mijenjati postojeće V1 snapshotove i ne raditi destructive down migration. Widened identity constraint ostaje backward-compatible.

## Vertical implementation slices

### 1. Versioned lifecycle and persistence contract foundation — guarded lane

Cilj: legalni identity union, V1-compatible queue wrapper, eksplicitni V2 queue wrapper i backward-compatible migration fajl. Fajlovi: novi `lib/b2b/team-fit-report-identity.ts`, `lib/b2b/team-fit-report-lifecycle.ts`, nova `supabase/migrations/<timestamp>_allow_team_fit_report_v2.sql`, `scripts/test-team-fit-report-lifecycle-shell.cjs` i novi uski versioning test. DB uticaj: SQL artefakt postoji, ali nema applyja. Acceptance: V1 output ostaje isti; V2 insert nosi tačan par; mixed pair pada; status transitions čuvaju identity; ready overwrite je odbijen. Van scopea: input, provider, UI, live DB/OpenAI.

### 2. Version-aware input and V2 processor adapter — guarded lane

Cilj: reuse enriched inputa i offline V2 processing. Fajlovi: `team-fit-report-input.ts`, novi `team-fit-report-v2-processor.ts`, lifecycle ready helper i relevantni input/processor testovi. DB uticaj: stubovima se dokazuje persistence shape; bez live writea. Acceptance: V1 testovi bit-for-bit prolaze, V2 row/input identity se slaže, injected provider može završiti validan V2 red, svaki failure pada prije ready i bez OpenAI-ja. Van scopea: actions, renderer i rollout.

### 3. Versioned read model and V2 display fixture — fast lane

Cilj: union loader/list i zaseban V2 view. Fajlovi: `team-fit-report-display.ts`, `team-fit-report-list.ts`, route, novi `team-fit-report-v2-view.tsx` i fixture/display tests. DB uticaj: none. Acceptance: isti URL pravilno bira renderer, oba lista reda su vidljiva/versioned, invalid/mixed snapshot pada fail-closed, tehnički identifikatori nisu u prozi. Van scopea: queue/process actions i live generation.

### 4. Canonical persisted rollout — guarded lane

Cilj: operator-only GD-001 × GDT-01 end-to-end smoke. Fajlovi se odobravaju nakon preflighta; vjerovatno explicit V2 action/CLI i gate test. DB uticaj: zasebno odobren migration apply i tačno jedan novi V2 row. Acceptance: jedan OpenAI poziv, ready V2 snapshot prolazi contract/evidence validaciju, V1 row je nepromijenjen, browser smoke prolazi, rollback gate je dokazan. Van scopea: drugi parovi, scheduler, mass regeneration.

## First implementation slice

Prompt-ready scope: **Implementirati Team Fit V2 versioned lifecycle and persistence contract foundation, bez live DB applyja, providera ili UI-ja.**

Tačno:

1. Dodati centralni identity union za `team_fit_report_v1/v1` i `team_fit_report_v2/v2`; odbiti mixed/unknown parove.
2. Ostaviti postojeći `queueTeamFitReportShell(...)` kao V1-compatible javni contract; dodati eksplicitni V2 wrapper nad uskim zajedničkim insertom.
3. Osigurati da row summary i claim/fail/reset čuvaju i vraćaju identity te da status compare-and-set pravila ostanu ista.
4. Dodati novu migraciju koja samo zamjenjuje V1-only checkove paired checkom; ne mijenjati kolone, podatke, indekse, RLS ili unique pravila i ne primijeniti migraciju.
5. Proširiti offline lifecycle testove za oba legalna para, mixed-pair rejection, V1 regression, ready overwrite zaštitu i paralelne V1/V2 fixture redove.

Acceptance: svi postojeći V1 lifecycle testovi prolaze bez caller promjene; V2 queue fixture emituje isključivo V2/V2; nijedan env ne bira verziju; nema input/provider/renderer/action wiringa; nema DB/OpenAI poziva; diff sadrži samo identity/lifecycle/migration/test fajlove odobrene promptom.

## Explicit non-goals

Nema promjene V2 contracta, prompta, evidence kataloga ili report kvaliteta; nema numeric scoringa ili hiring odluke; nema baseline IDP onboardinga; nema nove tabele, unique constrainta, schedulera, masovne regeneracije, V1 zamjene, UI redesigna, DB applyja, live writea ili OpenAI poziva u prva tri slicea.

## Open risks and required approvals

- Remote schema i migration history nisu provjereni u ovom no-DB tasku; read-only preflight je obavezan prije migration applyja.
- Migration apply zahtijeva eksplicitno odobrenje i dokaz da remote alias/drift ne uzrokuje replay/repair problem.
- Svaki live DB write, OpenAI poziv, persisted canonical smoke i rollout širi od GD-001 × GDT-01 zahtijevaju zasebno odobrenje.
- Error persistence trenutno ima samo `error_message`; typed V2 code/stage treba stabilno mapirati bez schema širenja, osim ako implementation audit dokaže potrebu.
- Preferred-report UX kada koegzistiraju verzije zahtijeva product odluku; prvi read model prikazuje obje i ne bira latest automatski.

## Validation evidence

Plan je izveden iz canonical `docs/deep-profile-todo.md`, V2 foundation/preview fajlova, aktivnih lifecycle/input/provider/processor/display/list/action/route/view putanja, oba Team Fit migration fajla i relevantnih offline testova. Repo-wide pretraga je potvrdila V1 hardcoding tačke, jedini production processor importer, odsustvo Team Fit schedulera/workera i odsustvo kasnije constraint migracije. Nije pokrenut DB, Supabase, OpenAI, report generation niti runtime.
