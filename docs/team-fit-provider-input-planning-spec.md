# Team Fit provider input planning spec v0.1

## 1. Svrha dokumenta

Ovaj dokument je canonical planning spec za budući Team Fit provider prompt/input slice za `team_fit_report_v1`.

Svrha je zaključati:

- šta budući AI/provider prompt smije dobiti kao input;
- kako input treba biti spakovan u evidence model;
- koje zadatke prompt mora dati provideru;
- kako output mora mapirati na `team_fit_report_v1` contract shape;
- kako izbjeći generički, score-like ili presudni HR tekst.

Ovaj dokument ne implementira provider. Ne mijenja OpenAI adapter, runtime, renderer, DB, migracije, worker, scheduler ili postojeće report artefakte.

## 2. Status

Status:

- planning/spec;
- nije implementacija;
- ne uvodi provider prompt u code;
- ne uvodi JSON schema adapter;
- ne mijenja `lib/b2b/team-fit-report-contract.ts`;
- ne mijenja postojeći Team Fit input builder;
- ne pokreće report generation ili regeneration;
- ne zove OpenAI.

## 3. Odnos prema postojećim dokumentima i contractu

### 3.1. `docs/team-fit-report-contract-acceptance-spec.md`

Acceptance spec je product standard za budući `team_fit_report_v1` contract i provider output. Ovaj planning spec prevodi taj standard u provider input i prompt plan.

Ključna pravila koja provider prompt mora poštovati:

- Team Fit je candidate-vs-team report;
- report mora biti konkretan, evidence-linked i HR-operativan;
- nema numeric fit score-a, procentualnog fit-a, hire/no-hire, pass/fail ili rangiranja;
- nema imenovanja pojedinačnih članova tima u glavnom reportu;
- svaka bitna tvrdnja mora imati evidence ili jasan interpretativni razlog.

### 3.2. `lib/b2b/team-fit-report-contract.ts`

`lib/b2b/team-fit-report-contract.ts` sada sadrži acceptance-aligned `team_fit_report_v1` contract snapshot shape i data-only validator `validateTeamFitReportV1ContractSnapshot`.

Ovaj dokument planira budući provider input tako da output može mapirati na taj shape:

- `contractVersion: "team_fit_report_v1"`;
- `reportType: "team_fit"`;
- `audience: "hr"`;
- `sourceType: "candidate_team_relational"`;
- obavezne report sekcije;
- evidence reference model;
- metadata i interpretation limits.

Validator ostaje structural/data validator. Ne treba hard-blockati prose, BHS stil, generičnost, dubinu ili wording quality. Te provjere pripadaju budućem reviewer/golden-example sloju.

### 3.3. `docs/team-dynamics-product-tech-spec.md`

Team Dynamics product/tech spec definiše timsku stranu Team Fit-a.

Provider input smije koristiti samo timski agregirani kontekst:

- verified Team Dynamics aggregation snapshot;
- coverage/variance/interpretation limits na timskom nivou;
- Team Dynamics Executive Overview signal samo ako je eksplicitno dozvoljen.

Provider input ne smije sadržavati raw odgovore članova, individualne score prikaze, privatne narrative reportove članova tima ili imena pojedinačnih članova tima u glavnom reportu.

### 3.4. `docs/team-style-collaboration-product-spec.md`

Team Style & Collaboration je planirani individualni modul `team_style_collaboration_v1`.

Provider input može uključiti Team Style signal samo kao optional/future source kada je modul implementiran, validno dostupan i eksplicitno dozvoljen. Ako Team Style nije dostupan, provider ne smije izmišljati saradnički stil kandidata.

## 4. Product cilj provider prompta

Budući provider prompt mora proizvoditi HR report koji pomaže HR-u i menadžeru da razumiju:

- gdje kandidat može pojačati konkretan tim;
- gdje može nastati trenje;
- koje hipoteze treba provjeriti u razgovoru;
- kakav onboarding i management pristup ima smisla;
- koje su granice interpretacije.

Prompt ne smije tražiti opšti kandidat report. Team Fit mora ostati relacijski report: kandidat u odnosu na konkretan tim.

## 5. Dozvoljeni provider inputi

Provider smije dobiti samo reducirane, HR-safe i relation-ready inpute.

Dozvoljeni input izvori:

- candidate Deep Profile deterministic/signals input;
- verified Team Dynamics aggregation snapshot;
- Team Dynamics Executive Overview signal, samo ako je eksplicitno dozvoljen;
- future Team Style & Collaboration signal, samo ako je implementiran i validno dostupan;
- HR/admin optional context, samo ako je eksplicitno unesen;
- metadata, locale, version i interpretation limits.

### 5.1. Candidate Deep Profile input

Candidate-side input treba biti reduciran signalni paket, ne raw assessment dump.

Primjeri dozvoljenih signala:

- radni stil relevantan za koordinaciju;
- motivacioni obrasci relevantni za timski kontekst;
- problem-solving signal kao oprezna radna implikacija, ne capability presuda;
- saradnja, struktura, tempo, komunikacija i tolerancija na nejasnoću gdje postoje dozvoljeni HR-safe signali;
- interpretation limits kada je signal tanak, djelimičan ili izveden iz fallbacka.

### 5.2. Team Dynamics aggregation input

Team-side input mora biti agregiran i verified.

Primjeri dozvoljenih signala:

- timski obrasci koordinacije;
- komunikacijske napetosti ili snage na agregiranom nivou;
- psihološka sigurnost kao timski signal ako je dostupna;
- SJT/team judgment signal ako je dostupan;
- outcome pulse signal ako je dostupan;
- coverage, variance i confidence metadata na timskom nivou.

### 5.3. Team Dynamics Executive Overview input

Executive Overview je optional interpreted context.

Pravila:

- smije se uključiti samo ako je eksplicitno dozvoljen u input bundle-u;
- ne smije biti jedini team-side source;
- provider mora znati da je to interpreted context, ne canonical deterministic source;
- tvrdnje iz Executive Overview-a moraju ostati povezane sa evidence id-em.

### 5.4. Future Team Style & Collaboration input

Team Style je optional/future candidate-side source.

Pravila:

- uključiti samo ako `team_style_collaboration_v1` postoji, validiran je za upotrebu u tom flow-u i source je dostupan;
- ako nije dostupan, output mora ostati zasnovan na drugim dozvoljenim candidate-side signalima;
- ne smije se koristiti kao samostalni hire/no-hire ili fit score signal.

### 5.5. HR/admin optional context

HR/admin context je dozvoljen samo ako je eksplicitno unesen.

Primjeri dozvoljenog contexta:

- uloga ili timski izazov ako je standardizovan i autorizovan;
- onboarding prioritet koji HR želi provjeriti;
- specifičan timski kontekst koji ne otkriva nepotrebne lične podatke.

Provider mora tretirati optional context kao kontekst za tumačenje, ne kao dokaz sam po sebi ako nije povezan sa candidate/team signalom.

## 6. Zabranjeni provider inputi

Provider ne smije dobiti:

- individualna imena članova tima za glavni report;
- raw participant answers;
- raw item text;
- individualne score vrijednosti članova tima;
- privatne narrative reportove članova tima;
- osjetljive ili nepotrebne lične podatke;
- candidate-facing report kao jedini source of truth;
- score dumping bez interpretacije;
- inpute koji nisu dozvoljeni contractom;
- implicitne hire/no-hire instrukcije;
- numeric fit score ili procentualni fit;
- rangiranje kandidata;
- kliničke ili dijagnostičke signale i zaključke;
- licencirane ili zaštićene iteme/scenarije izvan dozvoljenog sistema.

Ako source nije dozvoljen ili nije dovoljno jasan, provider input builder treba ga izostaviti i dodati interpretation limit, a ne slati provideru neprovjeren sadržaj.

## 7. Minimalni input bundle na product nivou

Budući provider input bundle treba imati sljedeće logičke dijelove:

- `requestContext`: report id, locale, audience, generated timestamp, organization/team/candidate minimalni identifikatori;
- `candidateSignals`: dozvoljeni candidate-side signalni paket;
- `teamSignals`: verified aggregated team-side signalni paket;
- `optionalSignals`: Executive Overview, Team Style i HR/admin context samo kada su dozvoljeni;
- `evidencePack`: stabilni evidence itemi koje provider smije referencirati;
- `promptGuardrails`: no-score, no-decision, no-ranking, no-member-naming i privacy pravila;
- `outputContractTarget`: obavezne sekcije i field expectations za `team_fit_report_v1`;
- `interpretationLimits`: poznate granice inputa, coverage-a i validacije.

Input bundle treba biti mali, čitljiv i purpose-built za provider reasoning. Ne treba slati cijele upstream snapshotove ako su dovoljni reducirani signali i evidence reference.

## 8. Evidence packing standard

Svaki evidence item u inputu mora imati:

- stabilan `id`;
- source type;
- kratki HR-readable label;
- sažet signal;
- stranu signala: `candidate_side`, `team_side`, `context_side` ili `interpretive_link`;
- relation note: zašto je signal relevantan za Team Fit tvrdnju;
- snapshot/version reference kada postoji;
- interpretation limit ili confidence note kada je signal tanak.

Dozvoljeni source type-ovi moraju mapirati na contract evidence model:

- `candidate_deep_profile_signal`;
- `team_style_collaboration_signal`;
- `team_dynamics_aggregation_signal`;
- `team_dynamics_executive_overview_signal`;
- `hr_admin_optional_context`;
- `interpretive_link`.

Provider output mora referencirati postojeće evidence id-eve. Ne smije izmišljati nove izvore, nove testove, nepostojeće timske obrasce ili nepostojeće candidate-side signale.

Interpretive link evidence item treba eksplicitno povezati kandidatov signal i timski signal. Primjer: kandidat pokazuje potrebu za strukturiranjem dogovora, a timski aggregation signal ukazuje na trenje oko vlasništva odluka.

## 9. Prompt responsibilities

Budući provider prompt mora tražiti:

- candidate-vs-team interpretaciju, ne opšti kandidat report;
- konkretne candidate-side signale;
- konkretne team-side signale;
- interpretive link između kandidata i tima;
- provjerljive friction hypotheses;
- interview probes;
- onboarding/manager guidance;
- risk and mitigation mapping;
- interpretation limits.

Prompt mora zahtijevati da provider jasno razlikuje:

- signal: šta je došlo iz inputa;
- interpretaciju: šta signal znači u kandidat-vs-team kontekstu;
- hipotezu: šta HR treba provjeriti;
- preporuku: šta HR ili menadžer treba uraditi.

Prompt treba instruisati provider da ne popunjava sekcije opštim HR frazama kada evidence nije dovoljno jak. U tom slučaju treba koristiti `needs_validation` framing i jasno navesti šta nedostaje.

## 10. Output mapping prema `team_fit_report_v1`

Provider output mora mapirati na contract shape iz `lib/b2b/team-fit-report-contract.ts`.

### `summary`

Mora dati kratak executive summary sa glavnim relacijskim signalom, jednom prilikom, jednom tačkom opreza i sljedećim provjerljivim korakom. Mora referencirati candidate-side, team-side i interpretive-link evidence.

### `fitOverview`

Mora objasniti relationship pattern:

- `alignment_signal`;
- `complementarity_signal`;
- `mixed_signal`;
- `needs_validation`.

Pattern nije score, ranking, odluka ili preporuka za zapošljavanje.

### `likelyTeamContribution`

Mora navesti konkretne načine na koje kandidat može pojačati tim i uslove pod kojima je taj doprinos koristan.

### `possibleFrictionPoints`

Mora navesti provjerljive friction hypotheses. Svaka hipoteza treba imati trigger, candidate/team evidence i način provjere kroz intervju, onboarding ili menadžerski plan.

### `teamConditionsThatImproveFit`

Mora opisati uslove u timu koji povećavaju šansu da kandidatov stil bude koristan. Ne smije prebaciti odgovornost samo na kandidata.

### `interviewProbes`

Mora dati konkretna pitanja za intervju, rationale i šta HR treba slušati u odgovoru.

### `onboardingAndManagerGuidance`

Mora dati operativne smjernice za menadžera i onboarding, sa jasnim ownershipom ili narednim korakom.

### `riskAndMitigationMap`

Mora mapirati rizik, okidač, mitigaciju i vlasnika (`hr`, `manager` ili `team_lead`). Rizik mora biti situaciona hipoteza, ne etiketa osobe.

### `evidenceAppendix`

Mora sadržavati evidence reference koje su već bile u input packu. Appendix služi auditabilnosti, ne debug dumpu.

### `interpretationLimits`

Mora navesti granice interpretacije: coverage, nedostupne izvore, validacijski status, optional context ograničenja i činjenicu da report nije odluka.

### `metadata`

Mora sadržavati generated timestamp, schema/provider metadata gdje je potrebno i verziju output contracta. Metadata ne smije postati glavni user-facing report sadržaj.

## 11. No-score/no-decision guardrails

Provider prompt mora eksplicitno zabraniti:

- numeric fit score;
- procentualni fit;
- pass/fail;
- hire/no-hire;
- preporuku za zapošljavanje ili odbijanje;
- rangiranje kandidata;
- score-like etikete kao "visok fit", "nizak fit" ili "umjeren fit";
- tvrdnje da je kandidat idealan za tim;
- tvrdnje da se kandidat dobro ili loše uklapa bez evidence i granica.

Zabranjena su i structural polja koja nose presudu ili score, uključujući:

- `fitScore`;
- `numericScore`;
- `fitPercentage`;
- `decision`;
- `hireDecision`;
- `hireRecommendation`;
- `passFail`;
- `rank`;
- `ranking`.

## 12. Anti-genericity guardrails

Provider prompt mora zabraniti prazne obrasce poput:

- "kandidat može doprinijeti timu na različite načine";
- "tim treba obratiti pažnju na komunikaciju";
- "fit je umjeren";
- "kandidat se dobro uklapa";
- "potrebno je dodatno pratiti dinamiku";
- bilo koju tvrdnju koja ne kaže šta, zašto, na osnovu čega i šta HR treba uraditi.

Svaka važna tvrdnja mora odgovoriti na najmanje četiri pitanja:

- šta je konkretan signal;
- zašto je relevantan za ovaj tim;
- na osnovu kojeg evidence itema postoji;
- šta HR ili menadžer treba provjeriti ili uraditi.

Ako tvrdnja ne može biti povezana sa evidence id-em ili interpretive linkom, provider je treba izostaviti ili pretvoriti u interpretation limit.

## 13. BHS/HR jezik

Budući provider prompt treba tražiti output na bosanskom jeziku za HR publiku.

Jezička pravila:

- latinica;
- ijekavica;
- profesionalan HR advisory ton;
- bez candidate-facing `ti/tvoj` obraćanja;
- bez pretjeranog "vjerovatno";
- bez engleskih user-facing termina ako postoji prirodan BHS izraz;
- bez akademskog eseja;
- bez praznih "soft" formulacija.

Preferirati:

- radni stil;
- način funkcionisanja;
- saradnička orijentacija;
- otvoren za saradnju;
- sklon saradnji;
- tačke opreza;
- teme za intervju;
- menadžerske smjernice;
- HR pregled.

Izbjegavati:

- `fit score`;
- `culture fit`;
- `idealni kandidat`;
- `zaposliti / ne zaposliti`;
- `konačna odluka`;
- tehničke provider/model fraze u glavnom report tijelu;
- formulacije koje zvuče kao klinička ili dijagnostička procjena.

## 14. Razgraničenje validacije i kvaliteta

Ovaj planning spec razlikuje četiri sloja.

### 14.1. Structural/data validation

`validateTeamFitReportV1ContractSnapshot` ostaje data-only validator.

Validator treba blokirati:

- pogrešan root shape;
- nedostajuće obavezne sekcije;
- nevalidne string/array/object vrijednosti;
- nevalidan evidence reference shape;
- sekcije bez obaveznog evidence-a;
- zabranjena structural score/decision/ranking polja.

Validator ne treba hard-blockati generičnost, BHS stil, dubinu, actionability ili wording quality.

### 14.2. Provider prompt quality

Prompt quality sloj treba smanjiti rizik lošeg outputa kroz jasne instrukcije, input packing i output mapping.

Prompt treba usmjeriti provider da koristi evidence id-eve, candidate-vs-team framing i operativne preporuke.

### 14.3. Reviewer/golden-example quality

Budući reviewer/golden-example slice može ocjenjivati:

- konkretnost;
- evidence linkage;
- actionability;
- candidate-vs-team specifičnost;
- genericity;
- empty recommendations;
- overclaiming;
- zabranjeni decision language;
- kvalitet BHS jezika.

Ovaj sloj može biti diagnostic ili blocking samo nakon zasebne product/engineering odluke.

### 14.4. Renderer/display mapping

Renderer treba prikazati već strukturiran output. Ne treba biti autor interpretacije i ne treba popravljati loš provider sadržaj kroz prepisivanje.

Display mapping može organizovati sekcije, evidence i metadata, ali ne smije dodavati nove Team Fit tvrdnje.

## 15. Reviewer/golden-example future handoff

Ovaj dokument priprema budući reviewer/golden-example rad.

Reviewer harness treba dobiti:

- provider input bundle;
- provider output snapshot;
- evidence id mapu;
- listu forbidden structural i wording obrazaca;
- golden examples za prihvatljiv i neprihvatljiv Team Fit output.

Reviewer treba moći razlikovati:

- validan structural output koji je ipak generički;
- konkretan output koji nema dovoljno evidence-a;
- evidence-linked output koji je operativan za HR;
- output koji prelazi u presudu, ranking ili kliničko zaključivanje.

## 16. Non-goals

Ovaj task ne uključuje:

- provider implementaciju;
- OpenAI adapter promjene;
- JSON schema adapter implementaciju;
- renderer/UI promjene;
- DB/migration promjene;
- worker/scheduler promjene;
- report generation ili regeneration;
- Supabase repair, `db push`, `db reset`, `migration up` ili `migration down`;
- Composite HR promjene;
- todo sync;
- izmjene u `lib/b2b/team-fit-report-contract.ts`;
- izmjene u `scripts/test-team-fit-report-contract.cjs`;
- promjenu postojećih provider/input/helper fajlova.

