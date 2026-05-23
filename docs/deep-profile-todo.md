# Deep Profile — To-do registar

## 0. Operating rules

Ovaj dokument je canonical snapshot trenutno važećeg Deep Profile todo/backlog stanja.

Plan nije fiksan. Deep Profile razvoj radi agile: prioriteti se mogu promijeniti čim naučimo nešto novo, donesemo bolju product odluku ili otkrijemo veći rizik.

Pravila:

- `docs/deep-profile-todo.md` je zadnji stabilizovani zapis trenutno važećeg plana, prioriteta i otvorenih taskova.
- Dokument ne zamjenjuje razgovor, product judgement ili novu odluku.
- Ako se u razgovoru donese nova odluka koja mijenja prioritet, redoslijed ili scope, treba je zabilježiti u todo dokument.
- Dok promjena nije zabilježena, tretira se kao radni dogovor, ne kao stabilizovani backlog.
- Canvas je radna memorija ili draft promjene, ne trajni izvor istine.
- EoD handover je dnevni kontekst, ne zamjena za ovaj dokument.
- GitHub issues i GitHub Projects nisu canonical backlog.
- GitHub Issues/Project sync je pauziran kao default workflow. Operativni status i redoslijed taskova se trenutno prate u Google Sheetsu, dok `docs/deep-profile-todo.md` ostaje stabilizovani backlog, kontekst i decision log. GitHub Issues/Projects se koriste samo na eksplicitan zahtjev.
- Ranija memorija ili prethodni chatovi ne smiju nadjačati ovaj dokument bez eksplicitne nove odluke.
- U novom chatu, kada korisnik pita za todo, backlog, sljedeći task, prioritete, nastavak rada, handover, project status ili sync, prvo se koristi ovaj dokument.
- Ako dokument nije direktno dostupan, fallback je aktuelni `repomix-output-ai-daily.xml` ili puni `repomix-output.xml`.
- Ako nije dostupan ni dokument ni repomix, treba tražiti od korisnika da pošalje aktuelni `repomix-output-ai-daily.xml`, `repomix-output.xml` ili sadržaj ovog dokumenta.
- Ne kreirati novi todo canvas osim ako korisnik to eksplicitno zatraži.

Komande:

- “pregledaj todo” = pročitati `docs/deep-profile-todo.md` i sažeti trenutne prioritete.
- “predloži sljedeći task” = prvo pročitati todo, zatim preporučiti sljedeći task.
- “zabilježi u todo” = pripremiti ili ažurirati sadržaj namijenjen za `docs/deep-profile-todo.md`.
- “sync todo” = pripremiti jedan Codex prompt za ažuriranje `docs/deep-profile-todo.md`.
- “sync todo + github” = pripremiti jedan Codex prompt za ažuriranje `docs/deep-profile-todo.md` i zatim sinhronizaciju odgovarajućih GitHub issues / Project items.

## Kompaktni prioritetni pregled taskova

| Prioritet | Task                                                 | Status      | Kategorija                   | Sljedeći korak                                                                                 |
| --------- | ---------------------------------------------------- | ----------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| P0        | SAFRAN practice visual parity sa scored pitanjima    | Završeno    | SAFRAN / Assessment UX       | Zatvoreno nakon usklađivanja practice primjera sa scored SAFRAN visual-question layoutom. |
| P0        | SAFRAN user report content architecture              | Završeno    | SAFRAN / Candidate report    | Zatvoreno nakon stabilizacije sadržaja, AI pipelinea i fallback/display modela participant reporta. |
| P0        | SAFRAN report visual parity sa IPIP reportom         | Završeno    | SAFRAN / Report UI           | Zatvoreno nakon vizuelnog usklađivanja SAFRAN reporta sa Deep Profile/IPIP report porodicom. |
| P1        | IPIP prethodno pitanje ne prikazuje odabrani odgovor | Završeno    | Assessment UX / State        | Zatvoreno nakon popravke selected-state vidljivosti pri povratku na prethodno odgovoreno IPIP pitanje. |
| P1        | SAFRAN izgleda kao da ima default označen odgovor    | Zatvoreno / Nije reproducirano | Assessment UX / Input state  | Ne traži code work nakon ručne provjere; svježe SAFRAN pitanje se učitava bez unaprijed selektovanog odgovora. |
| P1        | IPIP tekst na karticama dimenzija se ponavlja        | Završeno    | Report UI / Copy             | Zatvoreno nakon zamjene ponovljenog domain title body copyja kratkim descriptor tekstom u vidljivom V2 report pathu. |
| P1        | Explicit HR retrieval and route wiring               | Završeno    | HR report / Report pipeline  | Zatvoreno nakon dodavanja eksplicitnog HR retrieval helpera, odvajanja HR/participant route retrievala i neutralnog unavailable stanja bez HR → participant fallbacka. |
| P1        | HR report locale / i18n readiness policy            | Završeno    | i18n / Report architecture   | Zatvoreno nakon upisa locale-aware pravila u HR report spec i backlog: MVP ostaje bs-only, ali HR architecture razlikuje assessment locale, participant report locale, HR report locale i report locale. |
| P1        | HR report locale/i18n audit                         | Završeno    | i18n / Report pipeline audit | Zatvoreno read-only auditom koji je mapirao postojeće locale izvore, prompt-version lokalizacije, snapshot praznine i bosanski hardcoding rizike. |
| P1        | Persisted report locale guardrails for future HR lanes | Završeno | i18n / Report pipeline | Zatvoreno nakon uvođenja centralnog `ReportLocale` / `resolveReportLocale(...)` guardraila i uklanjanja nepotrebnog `"bs"` hardcodinga iz poznatih report generation fallback path-eva. |
| P1        | SAFRAN HR report V1                                 | Završeno    | HR report / SAFRAN           | Zatvoreno nakon contract/input/validator sloja, mock i OpenAI runtime-a, HR renderer-a, lifecycle smoke-a, browser smoke-a i završnog copy polish-a. |
| P1        | HR candidate assessment detail page                 | Završeno    | HR dashboard / Report navigation | Zatvoreno nakon uvođenja participant-level detail stranice sa IPIP/SAFRAN/MWMS report karticama i composite placeholderom. |
| P1        | HR participant reports UI polish (navigation + metadata) | Završeno | HR dashboard / Report UI polish | Zatvoreno nakon Composite i participant navigation cleanupa i HR-facing metadata formatiranja na participant reports karticama. |
| P1        | Team Fit & Dynamics Product Spec v0.1 | Spec spreman / Dokumentovati u repo | Team module / Product architecture | Dokumentacioni sync: kreirati `docs/team-dynamics-product-tech-spec.md` kao canonical spec v0.1 u repou. |
| P1        | Team Style & Collaboration product/spec v0.1 | Planirano | Team module / Product architecture | Definisati konstrukte, format, validacijski status (u validacijskoj fazi), scoring okvir i vezu sa Team Fit reportom prije implementacije; research-informed hibrid bez kopiranja zaštićenih itema/scenarija. |
| P1        | Team Dynamics instrument spec v0.1 — TDM-31 + TPS7-based + SJT + outcome pulse | Planirano | Team module / Instrument model | Definisati finalne skale, item mapping, response format, scoring/agregaciju, consensus/disagreement logiku, report output i validation/licensing notes za `team_dynamics_assessment_v1`, uz `licensed_mode` i `adapted_mode`; SJT ostaje originalni Deep Profile modul u validacijskoj fazi. |
| P1        | Mixed-format Team Dynamics runtime/import support | Djelimično završeno / Read-only execution shell wiring završen | Team module / Runtime + Import | Završena su tri uska sloja: mixed-format read/validation support, execution-ready package shape (`teamDynamicsExecutionSpec`) i read-only execution shell wiring za budući runtime/UI sloj. Pending ostaju DB import support, execution UI, response persistence/capture, scoring runtime, team aggregation i report layer. |
| P1        | Team Dynamics data model scaffold and placeholder package support | Djelimično završeno / Run handoff skeleton uveden | Team module / Data model scaffold | Runtime DB verifikacija je potvrdila da `team_dynamics_v1_strong` već postoji kao aktivan test (`status='active'`, `is_active=true`) sa potvrđenim footprintom (4 dimenzije, 36 pitanja, 180 opcija, 0 promptova; BS lokalizacije 36/180) i bez report footprinta (`attempt_reports=0`, `assessment_reports single_test=0`). Završeno je post-import active DB guardrail hardening, wrapper readiness test slice, SQL-backed wrapper lifecycle smoke (`BEGIN ... ROLLBACK`), execution access helper, wrapper-based intro i `/run` shell, centralni execution safe-state resolver i wrapper-based `/run` handoff skeleton bez `AssessmentForm`-a. Sljedeći uski slice: read-only Team Dynamics question loader za `/run` handoff koji sigurno priprema ordered question IDs i localized titles bez renderovanja pitanja, odgovora, answer options ili `AssessmentForm` executiona. |
| P1        | Individualni razvojni profil product/report contract spec | Planirano | Individualni razvojni profil / Product architecture | Definisati sekcije outputa, deterministic input iz individualne baterije, AI-generated sekcije i guardrails bez implementacije koda, bez promjene postojećeg report pipeline-a i bez spajanja sa Team Dynamics reportom. |
| P1        | Timski fit kandidata product/report contract spec | Planirano / Epic zabilježen | Relacijski report / Candidate-team fit | Definisati inpute, contract, guardrails i output sekcije nakon osnovnog Team Dynamics reporta. |
| P0        | Candidate dashboard attempt lifecycle hardening     | Završeno    | Candidate dashboard / Attempt lifecycle | Zatvoreno nakon popravke primary attempt selection pravila, standard battery guard-a protiv praznih duplikat attemptova i dodavanja povratka na dashboard iz completed report screena. |
| P1        | HR report card status mapping                       | Završeno    | HR dashboard / Report status UX | Zatvoreno nakon jasnog razdvajanja ready/queued/processing/failed/unavailable/missing/incomplete stanja bez participant HR fallbacka. |
| P1        | Queued vs processing HR report status UX            | Završeno    | HR dashboard / Report status UX | Zatvoreno nakon razdvajanja `queued = Čeka generisanje` i `processing = Generiše se` u status labeli, opisu i disabled CTA-u. |
| P1        | Automatic HR report enqueue / capability registry   | Završeno    | Report pipeline / HR report orchestration | Zatvoreno nakon uvođenja capability registry-ja i centralnog post-completion enqueue planiranja za active HR lane-ove. |
| P1        | HR report recovery actions                          | Završeno    | HR dashboard / Report recovery | Zatvoreno nakon dodavanja per-card recovery flow-a za failed i missing single-test HR reportove. |
| P1        | IPIP HR report content contract V2                  | Završeno    | HR report / IPIP / Content contract | Zatvoreno nakon prelaska na `ipip_neo_120_hr_v2`, HR-operativni content shape i display fallback za legacy V1 snapshotove. |
| P1        | MWMS HR report V1                                   | Završeno    | HR report / MWMS             | Zatvoreno nakon contract/input/validator sloja, mock i OpenAI provider routinga, renderer-a, capability aktivacije, worker podrške, status/recovery ponašanja, prompt aktivacije i realnog DB lifecycle/OpenAI smoke-a. |
| P1        | Non-blocking autosave za candidate IPIP/MWMS Likert flow | Završeno | Assessment UX / Persistence  | Zatvoreno nakon candidate-only non-blocking autosave slice-a za IPIP/MWMS Likert auto-advance flow, uz React state, localStorage pending queue, background flush i blocking final submit flush. |
| P1        | Assessment assignment ownership za standard battery | Završeno    | Architecture / Assessment ownership | Zatvoreno kao compatibility slice nakon uvođenja `assessment_assignments` i `assessment_assignment_attempts`, uz linkovanje samo novokreiranih attempts i zadržavanje attempt-based dashboard read patha. |
| P1        | Manual composite generate/retry action za assessment_reports | Završeno | Composite HR report / Queue lifecycle | Zatvoreno nakon dodavanja manual generate/retry akcija koje kreiraju ili resetuju `assessment_reports` row u `queued`, bez AI generation-a, worker-a, input buildera, provider routinga ili renderer-a. |
| P1        | Composite readiness / assessment_reports storage model | Završeno | Architecture / Composite HR report storage | Zatvoreno nakon uvođenja `assessment_reports` storage-a, composite readiness helpera i realnog composite card state-a na HR participant detail stranici, bez AI generation-a, worker-a ili generate/retry akcija. |
| P1        | Composite input builder iz deterministic score rezultata | Završeno | Composite HR report / Input builder | Zatvoreno nakon uvođenja deterministic composite input_snapshot buildera za IPIP/SAFRAN/MWMS linked attempts, bez AI generation-a, worker-a, provider routinga, schema/validatora ili renderer-a. |
| P1        | Composite HR report contract/schema/provider | Završeno | Composite HR report / Contract / Mock provider | Zatvoreno nakon uvođenja Composite HR report V1 contracta, runtime validatora i mock providera; renderer i OpenAI provider su sada uvedeni, a sljedeći korak je V1 polish / QA. |
| P1        | Composite HR report renderer | Završeno | Composite HR report / Renderer / HR dashboard | Zatvoreno nakon uvođenja assessment-level renderer route-a za ready mock-backed Composite HR report snapshot. Sljedeći korak je V1 polish / QA i real OpenAI smoke kada env bude spreman. |
| P1        | OpenAI provider za Composite HR report | Završeno | Composite HR report / OpenAI provider / AI generation | Zatvoreno nakon dodavanja OpenAI providera koji koristi postojeći CompositeHrInputSnapshot, proizvodi postojeći CompositeHrReportSnapshot contract i prolazi runtime validator. Sljedeći korak je Composite HR report V1 polish / QA nad mock i OpenAI outputom. |
| P1        | Composite HR report V1 QA audit / copy polish       | Završeno / Runtime blocker zatvoren | Composite HR report / QA / UX copy | Zatvoreno za code-level QA/copy polish; sljedeći fokus je DB-backed end-to-end smoke sa stvarnim queued reportom. |
| P1        | DB-backed end-to-end smoke za Composite HR report | Završeno / Mock + OpenAI potvrđeni | Composite HR report / Runtime smoke / QA | Zatvoreno nakon realnog OpenAI DB-backed smoke-a kroz existing assessment_reports lifecycle, provider language QA, reviewer pass i HR renderer route. |
| P1        | Composite HR report V1 final copy/UX polish | Završeno / Renderer polish | Composite HR report / UX copy / Renderer polish | Zatvoreno za renderer/display polish (uklj. “Integrisana interpretacija”). Sljedeći korak: production worker/report orchestration i zaseban watchout wording/UI polish. |
| P1        | OpenAI provider language QA guardrails za Composite HR report | Završeno | Composite HR report / OpenAI provider / Language QA | Zatvoreno nakon shared BHS language-quality helpera, Composite HR provider gate-a, reviewer pass-a, terminology stabilization-a i uspješnog OpenAI DB-backed smoke-a. |
| P1        | Production worker/report orchestration / completion-triggered report orchestration | Završeno / runtime smoke ciklus potvrđen | Report pipeline / Completion orchestration | Zatvoreno nakon runtime smoke ciklusa: completion trigger radi za single-test i composite lane bez report-view triggera i bez manual-generate happy path-a; preostali polish je zaseban watchout wording/UI task. |
| P1        | Composite HR integrated signals visual layout polish | Završeno | Composite HR report / Renderer / Visual hierarchy | Zatvoreno nakon redizajna “Integrisani signali” iz dokumentnog toka u analitički 3-modulni layout: Šta znači u radu / Šta HR treba provjeriti / Dokazi iz procjena. |
| P1        | Composite HR integrated signals color semantics polish | Završeno | Composite HR report / Renderer / Color semantics | Zatvoreno nakon semantičkog mapiranja Deep Profile palete po funkciji modula (emerald/golden-pollen/ocean-blue + dark-teal autoritet). |
| P1        | Composite HR summary visual hierarchy polish | Završeno | Composite HR report / Renderer / Summary | Zatvoreno nakon prelaska na 2x2 executive dashboard: Ključne snage, Fokus za provjeru, Glavni signal, Kako koristiti izvještaj. |
| P1        | Composite HR summary executive dashboard refinement / color polish | Završeno | Composite HR report / Renderer / Executive UI | Zatvoreno nakon pojačanja vizuelnog identiteta sekcije “Sažetak” uz čitljiv body i jaču, funkcionalnu upotrebu boje. |
| P1        | Composite HR back link / hero cleanup | Završeno | Composite HR report / Renderer / Hero UX | Zatvoreno nakon uvođenja shared `PageNavigation` obrasca, premještanja back linka iz hero kartice iznad hero sekcije i čišćenja hero navigacijskog šuma. |
| P1        | Composite HR summary headline polish | Završeno | Composite HR report / Renderer / Summary headline | Zatvoreno nakon dodavanja jasnog `Glavni zaključak` executive wrappera iznad 2x2 summary grida, uz zadržavanje report contenta i zamjenu hardcoded labela `Kako koristiti izvještaj`. |
| P1        | Composite HR interview/onboarding visual alignment | Završeno / Lokalni renderer polish | Composite HR report / Renderer / Section alignment | Zatvoreno kao lokalni renderer polish nakon dodavanja strukturisanih Intervju i Onboarding kartica sa purpose stripovima i panelima. Estetski pravac nije finalan; budući veći refactor ide kroz `docs/deep-profile-ui-system.md`. |
| P1        | Deep Profile UI system source of truth | Završeno / UI standard uveden | UI system / Design governance | Zatvoreno nakon kreiranja `docs/deep-profile-ui-system.md` kao implementation-facing source of truth za boje, tipografiju, kartice, sjene, CTA, status pillove, navigaciju, report layout obrasce, BHS copy pravila i Codex implementation rules. Budući UI taskovi moraju prvo pročitati ovaj dokument. |
| P1        | Composite HR report advisory prompt polish | Završeno | Composite HR report / OpenAI provider / HR advisory copy | Zatvoreno nakon pojačanja OpenAI Composite HR prompta prema savjetodavnom HR radnom dokumentu uz jače hipoteze, provjere, interview guidance i onboarding/menadžerske smjernice, bez promjene contract/scoring guardraila. |
| P1        | Composite HR BHS narrative casing guardrail | Završeno | Composite HR report / Language QA / BHS quality | Zatvoreno nakon uvođenja narrative casing guardraila koji dozvoljava display/evidence label “Spremnost na saradnju”, ali u narativu zahtijeva “spremnost na saradnju”; evidence/display labeli su izuzeti iz pravila. |
| P1        | Composite HR concise advisory writing polish | Završeno | Composite HR report / HR advisory copy / Readability | Zatvoreno nakon pojačanja provider prompta i minimalnog summary writing guardraila: kraći headline, jasniji 3-rečenični profileOverview, akcijski fokus za provjeru, konkretniji “Šta HR treba provjeriti” i operativnije onboarding/menadžerske smjernice. |
| P2        | Composite HR interview guidance V2 | Planirano (veći task) | Composite HR report / Interview guidance | Budući veći task: proširiti postojeći contract bez pokretanja sadašnjeg refactora, sa jačim “šta slušati u odgovoru” operativnim okvirom. |
| P2        | Composite HR onboarding 30/60/90 format | Planirano (veći task) | Composite HR report / Onboarding / Manager guidance | Budući veći task: 30/60/90-day struktura onboarding/menadžerskih smjernica kao poseban product slice, bez miješanja u ovaj sync. |
| P2        | Composite HR visual readability polish (sitniji tekst/evidence čipovi) | Planirano | Composite HR report / Renderer / Readability | Sitni vizuelni polish za čitljivost teksta i evidence čipova ostaje budući task; ne otvarati u ovom syncu. |
| P1        | Supabase migration/schema cache verification za composite tabele | Završeno / DB queued smoke još preostaje | Infrastructure / Supabase / Composite runtime | Zatvoreno za schema/table visibility: runtime Supabase sada vidi `assessment_assignments`, `assessment_assignment_attempts` i `assessment_reports`, a worker više ne pada na schema cache grešci. Sljedeći korak je DB-backed composite smoke sa stvarnim queued reportom. |
| P1        | Assessment report worker path za composite          | Završeno    | Composite HR report / Worker lifecycle | Zatvoreno kao lifecycle proof: worker claim-a queued assessment_reports row, gradi input_snapshot kroz composite input builder i kontrolisano završava kao failed sa COMPOSITE_PROVIDER_NOT_IMPLEMENTED dok provider ne postoji. |
| P1        | Composite HR report data model decision             | Završeno / Prvi slice implementiran | Architecture / HR report storage | Odluka donesena: composite ne ide u `attempt_reports`; uveden je prvi assessment-level ownership slice kroz `assessment_assignments` i `assessment_assignment_attempts`. Zatvoreno nakon assessment_reports storage/readiness slice-a. |
| P1        | Composite HR report V1                              | Završeno / completion-triggered runtime potvrđen | Product / AI report | Zatvoreno nakon completion-triggered runtime smoke ciklusa: initial PARTIAL blocker-i na provider/reviewer consistency su zatvoreni (Neuroticism evidence lock + AGREEABLENESS canonicalization), a composite row `fe22ed8b-460c-4273-9dd8-6bee56d8c645` je završio `ready` sa `generator_type=openai` i `model_name=gpt-5.4`. |
| P1        | Oblik obraćanja: muški/ženski jezički oblik          | Discovery / Spec spreman | UX / i18n / AI promptovi     | Discovery je definisao UI naziv preferencije, modal timing, participant-level polje, attempt/report snapshot princip i buduće AI input wiring. Sljedeći korak je uska implementacija kroz migration/constants → modal → snapshot → participant report wiring. |
| P1        | MWMS pitanja / item UX                               | Završeno    | Assessment UX / Copy         | Zatvoreno nakon uvođenja zajedničkog stem prikaza “Zašto ulažeš trud u svoj posao?”, labela “Mogući razlog”, jasnije MWMS skale i testSlug wiring-a u assessment run rutama. |
| P1        | IPIP radar chart                                     | Završeno    | Report UI / Visualization    | Zatvoreno nakon vraćanja deterministic radar chart prikaza u IPIP NEO-120 participant V2 report, koristeći report.domains[].display_score bez promjene scoringa ili AI pipelinea. |
| P1        | SAFRAN novi stimulus asseti                          | Otvoreno    | Assessment assets / UX       | Ubaciti nove SAFRAN stimulus slike sa većim, čitljivijim tekstom.                              |
| P1        | Globalni app header i footer                         | Završeno    | App shell / UI system        | Zatvoreno nakon uvođenja protected app-wide chrome i focus chrome moda za assessment execution rute. |
| P1        | Logo u headeru                                       | Završeno    | Branding / UI                | Zatvoreno nakon zamjene tekstualnog Deep Profile prikaza PNG logoom u protected app headeru.   |
| P1        | MWMS licenca                                         | Otvoreno    | Legal / Product risk         | Pravno očistiti komercijalnu upotrebu MWMS-a prije produkcijskog rollouta.                     |
| P2        | Login screen UI polish                               | Otvoreno    | Auth UI / Visual consistency | Uskladiti login ekran sa ostatkom aplikacije i popraviti font promjenu pri fokusu email polja. |
| P2        | IPIP poddimenzije prikaz                             | Otvoreno    | Report UI / Visualization    | Skratiti prikaz poddimenzija i razmotriti bars umjesto predugog tekstualnog prikaza.           |
| P2        | Candidate dashboard labels                           | Završeno    | UX copy                      | Kartice sada koriste user-facing title kao glavni naziv procjene, a instrument kao subtitle.   |
| P2        | Candidate dashboard CTA hover contrast               | Završeno    | Dashboard UI / Accessibility | Zatvoreno nakon popravke shared CTA hover/focus stilova za Započni procjenu, Nastavi procjenu i Pogledaj rezultate. |
| P2        | MWMS AI report copy ton                              | Završeno    | Report copy / Tone           | Zatvoreno nakon usklađivanja MWMS participant reporta na “ti” formu kroz prompt pravila, renderer safety net, display smoke test i regenerisani testni report. |
| P2        | SAFRAN participant domain copy polish                | Završeno    | SAFRAN / Candidate report / Copy | Zatvoreno nakon uvođenja controlled copy helpera za “Pregled po oblastima”, bez promjene scoringa, layouta ili AI/report pipeline-a. |
| P2        | Report visual language po testovima                  | Planirano   | Report UI                    | IPIP radar, MWMS bar profile, SAFRAN score cards, composite mapa.                              |
| P2        | Worker/report auto-processing orchestration          | Aktivno / Nakon prvog completion slice-a | Tech debt / Ops       | Nakon completion-triggered best-effort slice-a potvrditi runtime smoke i odlučiti da li je potreban dodatni production trigger model izvan postojećeg worker procesa. |
| P3        | HR-facing MWMS AI report                             | Parking lot | HR report                    | Razmotriti nakon composite arhitekture ili HR dashboard prioriteta.                            |

> Ova tabela je operativni pregled. Detalji, kontekst i odluke za svaki task ostaju u tijelu dokumenta ispod.

---

## Outline

0. Operating rules
1. Svrha dokumenta
2. Pravila korištenja
3. Prioriteti
4. Aktivni backlog
5. Product / UX odluke
6. Tehnički dug
7. Kasnije / parking lot
8. Dnevnik završenih odluka

---

## 1. Svrha dokumenta

Ovaj dokument je centralni to-do registar za Deep Profile / AI Psychometric Analyst razvoj.

Koristi se za bilježenje stvari koje primijetimo tokom razgovora, testiranja i razvoja, ali koje nisu nužno trenutni prioritet. Cilj je da ništa pametno ne ispari u magli chata.

---

## 2. Pravila korištenja

* Ako nešto primijetimo, a nije za trenutni task, ide ovdje.
* Ako je važno za proizvod, ali ne smije prekidati trenutni fokus, ide u backlog.
* Ako je tehnički dug, označava se jasno kao tehnički dug.
* Ako je samo ideja, ide u parking lot.
* Kad nešto pređe u aktivni rad, pomjera se u “Aktivni backlog”.
* Kad se završi, ide u “Dnevnik završenih odluka”.

### 2.1 Dogovoreni todo workflow

Koristimo četiri sloja:

1. **Razgovor** — mjesto za razmišljanje, product judgement i promjene prioriteta.
2. **Canvas** — radna memorija ili draft promjene tokom razgovora.
3. **Repo dokument** — trajni canonical snapshot u GitHubu: `docs/deep-profile-todo.md`.
4. **GitHub Projects** — opcioni execution board kada je to eksplicitno traženo.

Dogovorene komande u razgovoru:

* **“zabilježi u todo”** → ažurira se canvas dokument.
* **“sync todo”** → Sanela uzima trenutni canvas to-do sadržaj i priprema Codex prompt koji taj sadržaj sinhronizuje u `docs/deep-profile-todo.md`.

Pravilo za sync:

* Repo dokument je zadnji stabilizovani snapshot plana. Canvas može biti draft promjene, ali ne nadjačava repo dokument dok se promjena ne syncuje u docs/deep-profile-todo.md.
* Codex ne interpretira backlog i ne donosi product odluke.
* Sanela priprema tačan Markdown sadržaj iz canvas dokumenta.
* Codex dobija instrukciju da ažurira `docs/deep-profile-todo.md` tim sadržajem, bez preuređivanja, kreativnog dopunjavanja ili izmjene drugih fajlova.
* Namchy nakon toga radi commit i push. Diff provjera se ne traži kao obavezni korak za to-do sync, osim ako Namchy eksplicitno zatraži provjeru.

Codex workflow za repo sync:

1. Namchy kaže **“sync todo”**.
2. Sanela priprema Codex prompt sa tačnim Markdown sadržajem trenutnog canvas to-do registra.
3. Namchy šalje prompt Codexu.
4. Codex ažurira samo `docs/deep-profile-todo.md` u repou.
5. Namchy radi commit i push, najčešće porukom: `Update Deep Profile todo register`.

Napomena: Za to-do sync ne tražiti obavezni `git diff` prije commita. To je dokumentacioni sync, a Codex dobija tačan Markdown sadržaj iz canvasa. Diff provjera ostaje opcionalna, samo ako Namchy to zatraži.

Pravilo: razgovor i canvas služe za razmišljanje i draft promjene, a docs/deep-profile-todo.md je zadnji stabilizovani snapshot sa historijom promjena. Codex je izvršitelj sync-a, ne dodatni interpretator to-do sadržaja.

---

## 3. Prioriteti

### P0 — Kritično

Blokira osnovni tok, sigurnost, scoring, report generation ili korisnički pristup.

### P1 — Važno

Direktno utiče na kvalitet proizvoda, korisničko razumijevanje ili diferencijator Deep Profile-a.

### P2 — Korisno

Polish, bolja konzistentnost, manji UX ili copy problemi.

### P3 — Kasnije

Dobre ideje koje nisu za sadašnji razvojni sprint.

---

## 4. Aktivni backlog

### P0 — SAFRAN user report content architecture

**Status:** Završeno  
**Kategorija:** SAFRAN / Candidate report / Product content

**Problem / context:**  
SAFRAN trenutno ima deterministic candidate interpretation, ali prije vizuelnog poliranja treba jasno zaključati šta user report prikazuje, kojim redoslijedom i sa kojim značenjem.

UI ne smije sam određivati semantičku strukturu reporta. Prvo treba zaključati sadržaj, tek onda dizajn.

**Scope:**  
Definisati kandidat-facing strukturu SAFRAN reporta:

1. header reporta
2. ukupni rezultat
3. pregled po oblastima
4. profil kognitivnih signala
5. kako čitati rezultate
6. sljedeći korak / CTA

**Predloženi redoslijed reporta:**

1. **Header reporta**
   - naziv testa: SAFRAN
   - kratko objašnjenje: procjena kroz verbalne, figuralne i numeričke zadatke
   - status: završeno

2. **Sažetak rezultata**
   - ukupni rezultat
   - neutralni deskriptivni band
   - kratka rečenica koja objašnjava ukupni rezultat u okviru testa

3. **Pregled po oblastima**
   - verbalni rezultat
   - figuralni rezultat
   - numerički rezultat
   - za svaku oblast: score, band, kratko neutralno tumačenje

4. **Profil kognitivnih signala**
   - najizraženija oblast
   - oblast koja traži najviše opreza u tumačenju
   - kratko poređenje domena bez rangiranja osobe kao bolje/lošije

5. **Kako čitati ove rezultate**
   - nema IQ interpretacije
   - nema percentila
   - nema lokalnih normi
   - rezultat nije samostalna odluka o kandidatu
   - practice pitanja ne ulaze u scoring

6. **Sljedeći korak**
   - povratak na dashboard
   - nastavak drugih testova ako postoje
   - završni CTA ako je baterija kompletirana

**Acceptance criteria:**
- Report ima zaključan redoslijed sekcija.
- Ne prikazuje se `V1`.
- Ne koristi se “Ukupni kognitivni kompozit”.
- Ne koristi se “Rezultat ne znači...” u domain tekstovima.
- Tekst je neutralan, kratak i kandidat-facing.
- Ograničenja su jasna, ali nisu dominantan defanzivni blok.
- Practice pitanja su eksplicitno navedena kao nescored samo u sekciji “Kako čitati ove rezultate”.

**Completion note:**  
Završeno kroz deterministic SAFRAN participant display/fallback, SAFRAN AI participant report pipeline, input builder, output schema / validator, OpenAI + mock provider routing, `attempt_reports` snapshot, renderer integration i AI narrative differentiation. Dodatno je zaključana zabrana kopiranja `deterministicMeaning`, uvedena oprezna interpretacija numeričkog rezultata, a scoring, `responses`, `response_selections` i `dimension_scores` nisu mijenjani.

---

### P0 — SAFRAN report visual parity sa IPIP reportom

**Status:** Završeno  
**Kategorija:** SAFRAN / Candidate report / UI

**Problem / context:**  
SAFRAN report ne smije izgledati kao generički score dump ili kao odvojen proizvod. Kandidat treba osjetiti da su IPIP i SAFRAN dio istog Deep Profile sistema.

Ovaj task se radi nakon što je zaključen sadržaj i redoslijed SAFRAN reporta.

**Scope:**
- uskladiti report layout sa IPIP completed report ritmom
- koristiti isti vizuelni sistem kartica, širina, spacinga i hijerarhije
- ukupni rezultat prikazati jasno, ali ne agresivno
- domain rezultate prikazati pregledno i mirno
- interpretacijsku napomenu učiniti sekundarnom
- ukloniti legacy osjećaj SAFRAN result ekrana

**Acceptance criteria:**
- SAFRAN report vizuelno pripada istoj porodici kao IPIP report.
- Header, score kartice, interpretacijske sekcije i CTA zona imaju usklađen ritam.
- Nema velikih teških blokova teksta.
- Interpretacijska napomena nije najveći ili najdominantniji element.
- Nema user-facing interne terminologije.
- Report izgleda kao candidate-facing proizvod, ne kao debug/score ekran.

**Completion note:**  
SAFRAN report je vizuelno usklađen sa Deep Profile/IPIP report porodicom kroz summary layout sa `Glavni obrazac`, overall score blok, neutralne score trackove po oblastima, humaniju sekciju `Kognitivni signal`, sekundarni reading guide i CTA polish. U kandidat-facing prikazu uklonjeni su interni izrazi poput `Practice` i `scoring`. Scoring, AI prompt, validator i provider pipeline nisu mijenjani u ovom visual tasku.

---

### P0 — SAFRAN practice visual parity sa scored pitanjima

**Status:** Završeno  
**Kategorija:** SAFRAN / Assessment UX / Practice flow

**Problem / context:**  
Probna SAFRAN pitanja su prvi stvarni kontakt kandidata sa zadacima. Ako vizuelno odstupaju od pravih scored pitanja, korisnik osjeti šav između practice i scored dijela.

Practice ne ulazi u scoring, ali mora izgledati kao ista vrsta zadatka i isti proizvodni tok.

**Scope:**
- practice pitanja koriste isti max-width kao scored pitanja
- isti kartični sistem
- isti tretman stimulusa
- isti tretman answer option kartica
- isti footer/action ritam gdje je primjenjivo
- practice-specific copy ostaje samo tamo gdje objašnjava da je riječ o primjerima

**Acceptance criteria:**
- Practice i scored pitanja izgledaju kao isti UI sistem.
- Razlika između practice i scored dijela je semantička, ne vizuelno haotična.
- Nema duplih stimulus slika.
- Nema osjećaja da je practice dio stariji ekran.
- Practice ekran i dalje jasno komunicira da odgovori ne ulaze u rezultat.

**Completion note:**  
Završeno kroz layout parity implementaciju u kojoj SAFRAN practice primjeri sada prate scored visual-question strukturu za stimulus card, image option grid i sticky bottom action footer. Primjeri sa 5/6 image opcija ostaju u jednom desktop redu gdje prostor to dozvoljava, a manji breakpointi se i dalje sigurno lome. Implementacija je bila parity, ne redesign, i scoring, data, report logika i persistence nisu mijenjani.

---

### P1 — Explicit HR retrieval and route wiring

**Status:** Završeno  
**Kategorija:** HR report / Report pipeline

**Problem / context:**  
Audit postojećeg HR report pipelinea pokazao je da IPIP HR report lane već postoji na contract, schema, provider, validation i worker-processing nivou, ali HR retrieval/display lane nije čisto odvojen od participant report retrievala.

Trenutni rizik je da HR route može koristiti participant-biased loader path i tiho prikazati participant artefakt umjesto HR artefakta.

**Scope:**
- dodati eksplicitne HR report retrieval helpere filtrirane po:
  - audience = hr
  - report_type = individual
  - source_type = single_test
- osigurati da participant route čita samo audience = participant
- osigurati da HR route čita samo audience = hr
- ukloniti tihi HR → participant fallback
- za missing HR report prikazati neutralno unavailable stanje
- verifikovati postojeći IPIP HR lane kroz dashboard attempt route

**Out of scope:**
- SAFRAN HR report
- MWMS HR report
- composite HR report
- DB migracija za assessment_reports
- prompt rewrite
- UI redesign
- full i18n implementation

**Acceptance criteria:**
- HR route čita samo HR artefakt.
- Participant route čita samo participant artefakt.
- IPIP HR snapshot se može dohvatiti i prikazati iz dashboard patha.
- Missing HR artifact prikazuje neutralno unavailable stanje, ne participant fallback.
- Nema miješanja audience vrijednosti u route/retrieval sloju.

**Completion note:**  
Završeno kroz dodavanje `loadPersistedHrReportSnapshot(attemptId)` helpera, povezivanje HR dashboard attempt route-a na HR-only retrieval, zadržavanje participant route-a na participant-only retrievalu i uklanjanje tihog HR → participant fallbacka. Kada HR report ne postoji ili nije ready, HR route sada prikazuje neutralno unavailable stanje. Mijenjani su `lib/assessment/reports.ts`, `lib/assessment/protected-attempts.ts` i `app/(protected)/dashboard/attempts/[attemptId]/page.tsx`. `npm run typecheck` je prošao.

---

### P1 — HR report locale / i18n readiness policy

**Status:** Završeno  
**Kategorija:** i18n / Report architecture

**Problem / context:**  
Deep Profile će kasnije biti višejezična aplikacija. Trenutno je app MVP na bosanskom jeziku, ali HR report architecture ne smije zabetonirati pretpostavku da je bosanski jedini mogući jezik.

Višejezičnost se ne implementira u punom obimu sada, ali HR report pipeline mora biti locale-aware od početka.

**Scope:**
- zapisati pravilo da svaki HR report input mora uključiti locale
- zapisati pravilo da svaki report snapshot mora očuvati locale korišten pri generisanju
- schema ključevi moraju ostati jezički neutralni, preferirano engleski
- human-facing content se generiše/renderuje u target locale-u
- prompt/version selection mora biti spreman za buduće locale varijante
- section titles i standard labels trebaju dolaziti iz kontrolisanog lokalizovanog copy sloja, ne iz AI improvizacije
- postojeći report snapshot se ne smije automatski prevoditi kada se promijeni app locale
- MVP podržava bs; budući jezici mogu uključiti hr, sr i en

**Out of scope:**
- prevođenje svih reportova na hr/sr/en
- UI za izbor jezika reporta
- automatska regeneracija reporta na drugom jeziku
- translation management sistem
- full app i18n implementation

**Acceptance criteria:**
- todo dokument bilježi da HR report pipeline mora biti locale-aware
- HR Report Architecture Spec sadrži locale sekciju
- novi HR report taskovi ne smiju hardcodirati bosanski kao jedini mogući jezik u schema/contract dizajnu
- MVP i dalje ostaje bs-only

**Completion note:**  
Završeno dokumentacionom odlukom da HR report architecture mora biti locale-aware od početka iako MVP ostaje bosanski-only. U backlogu i HR spec-u sada je eksplicitno razlikovano `assessmentLocale`, `participantReportLocale`, `hrReportLocale` i `reportLocale`, uz radnu odluku da `attempt.locale` u MVP-u može služiti kao fallback, ali ne i kao dugoročni jedini source of truth za buduće HR reportove.

---

### P1 — HR report locale/i18n audit

**Status:** Završeno  
**Kategorija:** i18n / Report pipeline audit

**Problem / context:**  
Potrebno je provjeriti koliko postojeći report pipeline već nosi locale i gdje postoje hardcodirane pretpostavke o bosanskom jeziku.

**Scope:**
- provjeriti da li postojeći report inputi nose locale
- provjeriti da li attempt_reports čuva locale kroz input_snapshot/report_snapshot
- provjeriti da li IPIP participant i HR report lane razlikuju locale
- provjeriti da li promptovi/report contracti hardcodiraju bosanski
- provjeriti da li schema koristi jezički neutralne ključeve
- provjeriti da li renderer hardcodira section title tekstove
- mapirati dijelove pipelinea koji bi tražili refactor kada uvedemo hr/sr/en
- preporučiti najmanji zdrav način da novi HR report architecture ostane locale-aware

**Out of scope:**
- implementacija višejezičnosti
- prevođenje sadržaja
- promjena report schema
- DB migracije

**Acceptance criteria:**
- postoji audit nalaz u razgovoru ili dokumentu
- nalaz jasno kaže gdje locale postoji, gdje se gubi i gdje je hardcodiran
- nalaz preporučuje najmanji zdrav sljedeći korak
- nema izmjena koda u audit tasku

**Completion note:**  
Završeno read-only auditom. Nalaz je potvrdio da postoje `attempts.locale`, locale normalizacija/fallback, `prompt_version_localizations` i locale-aware prompt selection, te da report input layer za IPIP, SAFRAN i MWMS većinom nosi locale. Audit je takođe potvrdio da snapshot arhitektura još nije dosljedno locale-aware, da `attempt_reports` nema posebno locale polje i da su neki fallback/non-worker path-evi hardcodirali `"bs"`. Audit nije mijenjao fajlove.

---

### P1 — Persisted report locale guardrails for future HR lanes

**Status:** Završeno  
**Kategorija:** i18n / Report pipeline

**Problem / context:**  
Audit je pokazao da MVP može ostati bosanski-only, ali da budući HR report lane-ovi ne smiju ući u pipeline bez eksplicitnog locale guardraila u input/snapshot sloju. Posebno je trebalo ukloniti nepotreban `"bs"` hardcoding iz poznatih fallback/non-worker path-eva kada je locale već dostupan kroz request ili attempt context.

**Scope:**
- dodati centralni locale guardrail/helper za report locale
- ograničiti fallback `"bs"` na slučajeve kada locale stvarno nije poznat
- ukloniti nepotreban `"bs"` hardcoding iz `buildCompletedAssessmentReportRequest(...)`
- ukloniti nepotreban `"bs"` hardcoding iz MWMS input snapshot path-a u `enqueueCompletedAssessmentReports(...)`
- ukloniti nepotreban `"bs"` hardcoding iz participant fallback generation path-a u `persistCompletedAssessmentReport(...)`
- ne uvoditi full i18n
- ne uvoditi DB locale kolonu u `attempt_reports`

**Out of scope:**
- SAFRAN HR report
- MWMS HR report
- composite report
- schema rewrite
- renderer refactor
- prevođenje postojećih reportova

**Acceptance criteria:**
- postoji centralni locale guardrail ili shared helper za report locale
- fallback `"bs"` ostaje samo kada locale nije poznat
- report generation path ne hardcodira `"bs"` kada je locale poznat u request/attempt kontekstu
- worker path ostaje funkcionalan

**Completion note:**  
Završeno kroz uvođenje centralnog `ReportLocale = AssessmentLocale` i `resolveReportLocale(...)` guardraila u `lib/assessment/locale.ts`, te kroz uske izmjene u `lib/assessment/reports.ts`. `buildCompletedAssessmentReportRequest(...)` više ne radi direktni `options?.locale ?? "bs"`, MWMS input snapshot path više ne hardcodira `locale: "bs"` kada `attempt.locale` postoji, a participant fallback generation path više ne hardcodira `"bs"` kada je locale poznat kroz context. `npm run typecheck` je prošao.

---

### P1 — SAFRAN HR report V1

**Status:** Završeno  
**Kategorija:** HR report / SAFRAN

**Problem / context:**  
SAFRAN trenutno ima participant report lane, ali nema HR report lane. HR report mora koristiti opreznu interpretaciju kognitivnih signala bez IQ-a, percentila i normativnog jezika.

**Scope:**
- HR-facing SAFRAN report contract
- schema/validator
- input builder
- provider routing
- mock/OpenAI parity gdje je primjenjivo
- renderer support
- guardrails bez IQ, percentila, normi i hire/no-hire jezika
- HR sekcije: kognitivni signali, tačke opreza, intervju pitanja, onboarding/role implications

**Out of scope:**
- composite HR report
- normativni scoring
- IQ interpretacija
- hiring recommendation score
- full HR dashboard redesign

**Acceptance criteria:**
- SAFRAN HR report generiše se samo za audience = hr
- participant SAFRAN report ostaje odvojen
- report koristi deterministic SAFRAN scores kao input
- AI ne računa niti mijenja score/band
- report nema IQ, percentile, norme ili hire/no-hire odluke

**Completion note:**  
Završeno kroz izolovani SAFRAN HR V1 contract/input/validator sloj, mock runtime lane, OpenAI provider branch, runtime validation, HR-only retrieval, SAFRAN HR renderer i realni lifecycle smoke. Report se generiše kao audience='hr', source_type='single_test', report_type='individual', koristi deterministic SAFRAN score rezultate kao input, a AI ne računa niti mijenja score/band. OpenAI smoke je potvrđen na stvarnom attempt_reports toku sa generator_type='openai', model_name='gpt-5.4', report_status='ready' i report_snapshot.reportType='safran_hr_report_v1'. Browser smoke je potvrdio prikaz na HR route-u. Završni copy polish je uskladio cognitiveSignals, pointsOfCaution, interviewQuestions, onboardingGuidance i interpretationLimits za oprezan, HR-koristan V1 report bez IQ, percentila, normi i hire/no-hire jezika.

---

### P1 — HR candidate assessment detail page

**Status:** Završeno  
**Kategorija:** HR dashboard / Report navigation

**Problem / context:**  
HR dashboard je ranije imao CTA “Pogledaj procjenu” koji je vodio direktno na jedan attempt route. To je postalo pogrešno kada kandidat ima više testova i više HR report artefakata. U stvarnom slučaju dashboard je vodio na IPIP attempt sa queued HR reportom, iako je za istog kandidata postojao ready SAFRAN HR report.

**Scope:**
- dodati participant-level HR assessment detail rutu
- dashboard CTA vodi na /dashboard/participants/[participantId]/reports
- detail page prikazuje IPIP, SAFRAN i MWMS report kartice
- ready HR report kartica vodi na /dashboard/attempts/[attemptId]
- queued/processing/failed/not assigned/in progress stanja prikazati jasno
- composite HR report prikazati samo kao placeholder/status
- ne uvoditi composite generation
- ne uvoditi novu DB tabelu
- ne koristiti participant report kao HR fallback

**Acceptance criteria:**
- dashboard CTA ne vodi direktno na nasumični/primarni attempt
- HR vidi sve relevantne report kartice za kandidata
- ready SAFRAN HR report je dostupan kroz SAFRAN karticu
- IPIP queued HR report ne blokira pristup ready SAFRAN HR reportu
- participant report se ne koristi kao HR fallback
- single report route ostaje /dashboard/attempts/[attemptId]

**Completion note:**  
Završeno uvođenjem /dashboard/participants/[participantId]/reports detail stranice. Dashboard CTA sada vodi na participant-level pregled procjene, gdje HR vidi IPIP, SAFRAN i MWMS kartice, dostupnost HR reportova i composite placeholder. SAFRAN ready kartica vodi na postojeću /dashboard/attempts/[attemptId] rutu. Model/helper logika čita samo HR artefakte filtrirane po audience='hr', report_type='individual' i source_type='single_test', pa participant report ne može postati HR fallback. Browser smoke je potvrdio flow dashboard → candidate assessment detail page → SAFRAN ready card → SAFRAN HR report.

---

### P1 — HR participant reports UI polish (navigation + metadata)

**Status:** Završeno  
**Kategorija:** HR dashboard / Report UI polish

**Completion note:**  
Završeno kroz commit `e851aad` (`Polish HR report navigation and metadata display`). Composite HR report detail je dobio diskretni back link iznad hero sekcije, uz čišći hero fokus. Participant HR reports page je prešao sa višesegmentnog breadcrumb-a na simple ghost/text povratni link `Nazad na HR dashboard`, uklonjen je redundantni gornji meta label i zategnut spacing iznad hero sekcije. Uveden je HR-facing formatter `lib/dashboard/hr-ui-format.ts`; pojedinačne HR report kartice na participant reports page-u više ne prikazuju raw `Attempt`, raw status `completed` i ISO timestamp, nego `ID procjene`, `Status procjene`, `Završeno`, lokalizovane statuse i datum format `dd.MM.yyyy, HH:mm`. Helper je trenutno primijenjen samo na participant HR reports page; širenje na composite HR report view, HR dashboard copy i create assessment modal ostaje budući polish task.

---

### P0 — Candidate dashboard attempt lifecycle hardening

**Status:** Završeno  
**Kategorija:** Candidate dashboard / Attempt lifecycle / SAFRAN

**Problem / context:**  
Tokom ručnog testiranja kandidatkinja je završila SAFRAN i vidjela ispravan results/report ekran, ali se nakon povratka na dashboard prikazalo “Započni procjenu” umjesto “Pogledaj rezultate”. SQL provjera je pokazala da validan completed SAFRAN attempt postoji sa 45 odgovora, ali je nakon njega postojao noviji prazan in_progress SAFRAN attempt sa 0 odgovora i null scored_started_at.

**Root cause:**
- primary attempt selection je ranije davala prioritet in_progress attemptu nad completed attemptom, čak i kada je in_progress bio potpuno prazan
- standard battery planner je mogao kreirati novi in_progress attempt za test koji već ima completed attempt
- browser Back nije kreirao bug; samo je razotkrio lošu selekciju postojećih attemptova

**Scope:**
- popraviti attempt lifecycle priority
- completed attempt mora pobijediti nad praznim in_progress attemptom
- active in_progress attempt smije pobijediti samo ako ima response_count > 0 ili, za SAFRAN, scored_started_at != null
- empty in_progress smije pobijediti samo ako nema completed attempta i nema active progress attempta
- abandoned je najniži prioritet
- standard battery planner ne smije praviti novi in_progress attempt za test koji već ima completed attempt
- dodati “Nazad na dashboard” na completed report/results screen
- ne mijenjati scoring, report generation, provider routing ili report validator

**Acceptance criteria:**
- completed SAFRAN + noviji empty in_progress SAFRAN prikazuje “Pogledaj rezultate”
- samo empty in_progress prikazuje “Započni procjenu”
- in_progress sa response_count > 0 prikazuje “Nastavi procjenu”
- SAFRAN in_progress sa scored_started_at != null prikazuje “Nastavi procjenu”
- abandoned attempt ne pobjeđuje completed ili active in_progress attempt
- standard battery planner ne reinserta test koji već ima completed attempt
- completed report/results ekran ima jasan povratak na dashboard

**Completion note:**  
Završeno kroz izmjene u lib/assessment/attempt-lifecycle.ts, lib/assessment/standard-battery.ts, app/(protected)/app/attempts/[attemptId]/report/page.tsx, scripts/test-attempt-lifecycle.cjs i scripts/test-standard-assessment-battery.cjs. Dodani su testovi za completed + newer empty in_progress scenario, empty-only scenario, SAFRAN scored_started_at resume scenario, response_count resume scenario i abandoned edge case. Standard battery planner sada ne kreira novi in_progress attempt za test koji već ima completed attempt. SAFRAN scoring, report generation, report worker, provider routing i validator nisu mijenjani.

---

### P1 — Team Fit & Dynamics Product Spec v0.1

**Status:** Spec spreman / Dokumentovati u repo  
**Kategorija:** Team module / Product architecture

**Sljedeći korak:**  
Završiti dokumentacioni sync Team Dynamics speca kroz `docs/team-dynamics-product-tech-spec.md` i tretirati ga kao canonical Team Dynamics Product/Tech Spec v0.1.

---

### P1 — Team Style & Collaboration product/spec v0.1

**Status:** Planirano  
**Kategorija:** Team module / Product architecture

**Kratki opis:**  
Definisati `Timski stil saradnje` / `team_style_collaboration_v1` kao zaseban individualni kandidat/član-tima modul koji je research-informed i u validacijskoj fazi. Modul je planiran kao MVP hibrid (bez licenciranog gotovog testa), uz teorijski okvir inspirisan TCS/TREO/SJT literaturom bez kopiranja zaštićenih itema/scenarija.

**Scope (docs/spec):**
- definisati konstrukte i svrhu individualnog timskog potencijala i saradničkog prosuđivanja
- definisati format i scoring okvir na nivou product/spec dokumenta
- eksplicitno odvojiti od `Procjena timske dinamike` / `team_dynamics_assessment_v1`
- definisati vezu sa `Timski fit kandidata` / `team_fit_report_v1` kao relacijskim reportom
- ne uvoditi implementaciju u code-u u ovom tasku

**Napomena o statusu:**  
`Timski stil saradnje` je trenutno product/spec planiran i nije implementiran u code-u.

---

### P1 — Team Dynamics data model scaffold and placeholder package support

**Status:** Djelimično završeno / Run handoff skeleton uveden  
**Kategorija:** Team module / Data model scaffold

**Napomena o sloju arhitekture:**  
Ovaj task se odnosi na timski assessment sloj `Procjena timske dinamike` / `team_dynamics_assessment_v1` (postojeći `team_dynamics_v1_strong` scaffold). Ne odnosi se na kandidatov individualni modul `Timski stil saradnje`.

**Napomena o instrument modelu:**  
Postojeći `team_dynamics_v1_strong` (4 skale / 36 pitanja) ostaje tehnički scaffold i nije finalni instrument. Ciljani model za final-user prezentaciju je premium `team_dynamics_assessment_v1` sa 4 kratka bloka (oko 12–15 minuta): TDM-31 core + TPS7-based Deep Profile psihološka sigurnost + 6 originalnih Deep Profile SJT scenarija + 4 outcome pulse itema (ukupno 48 assessment jedinica).

---

### P1 — Team Dynamics instrument spec v0.1 — TDM-31 + TPS7-based + SJT + outcome pulse

**Status:** Planirano  
**Kategorija:** Team module / Instrument model

**Kratki opis:**  
Zaključati premium/final-user model za `Procjenu timske dinamike` / `team_dynamics_assessment_v1` kao 4 kratka bloka (oko 12–15 minuta), ne kao kratki MVP:
- TDM-31 core
- TPS7-based Deep Profile psihološka sigurnost skala
- Deep Profile originalni situational judgment mini-test sa 6 timskih scenarija
- 4 outcome pulse itema

Ukupna ciljna dužina: 48 assessment jedinica (31 + 7 + 6 + 4).

**Model napomene:**
- TDM-31 je core za razvojnu zrelost tima: kohezija, komunikacija, uloge/ciljevi i timska orijentacija.
- TPS7-based skala je Deep Profile ekstenzija za psihološku sigurnost: otvorenost, greške, traženje pomoći, drugačije mišljenje i interpersonalni rizik.
- SJT dio je originalni Deep Profile sadržaj (bez kopiranja postojećih/licenciranih SJT scenarija) i ostaje u validacijskoj fazi.
- Outcome pulse je odvojen kriterijski signal: percipirana efektivnost, kvalitet, pouzdanost i održivost rada u timu.
- Outcome pulse ne ulazi u isti dijagnostički indeks kao uzročne/dijagnostičke skale.

**Completion/decision note — TDM-31 core mapping lock (`team_dynamics_assessment_v1`):**
- Kanonska oznaka za TDM core je `tdm-31-V1`.
- U nazivu se ne koriste dodaci tipa `working_adaptation`, `pending_verification`, `strong`, `backed`, `inspired` i slično; status/metapodaci mogu postojati u specu, ali ne u nazivu.
- `tdm-31-V1` koristi 31 item i svih 31 ulaze u ukupni TDM core score.
- Domain scoring koristi 24 itema iz originalne TDM faktorske strukture:
  - Communication: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 28, 29, 30 (14)
  - Roles and Goals: 15, 16, 17, 19 (4)
  - Cohesion: 22, 23, 25, 26 (4)
  - Team Primacy: 18, 20 (2)
- Preostalih 7 itema (11, 12, 13, 21, 24, 27, 31) ulaze samo u `overall / Rasch-only` za ukupni/core score i ne ulaze u domenske scoreve.
- Reverse-scored itemi su: 3, 15, 16 i 27.
- Response format za TDM core je 4-stepeni agreement:
  - 1 = Uopće se ne slažem
  - 2 = Uglavnom se ne slažem
  - 3 = Uglavnom se slažem
  - 4 = U potpunosti se slažem
- Phase 1 scoring je simple linear scoring, nakon reverse scoringa:
  - `reverse_score = 5 - raw_score`
  - `score_0_100 = ((mean_1_4 - 1) / 3) * 100`
- Full Rasch scoring ostaje Phase 2 kada bude dostupna Rasch conversion tabela/manual.
- Ova odluka zamjenjuje raniji intuitivni radni mapping koji je sve iteme nasilno rasporedio u domene.
- Budući Team Dynamics instrument/content spec mora koristiti `original_factor_mapping` pristup.
- Postojeći `team_dynamics_v1_strong` ostaje tehnički scaffold i nije finalni instrument.
- Sljedeći instrument/content spec treba dodati:
  - B/H/S item wording za `tdm-31-V1`
  - TPS7-based psihološka sigurnost
  - 6 originalnih Deep Profile SJT scenarija
  - 4 outcome pulse itema
  - scoring, aggregation, consensus/disagreement i report interpretation

**Completion/decision note — TPS7-based psychological safety block lock (`team_dynamics_assessment_v1`):**
- User-facing naziv bloka: `Psihološka sigurnost u timu`.
- Interni block key: `psychological_safety`.
- Model basis: `TPS7-based / Deep Profile original adaptation`.
- Broj itema: 7.
- Response format je isti kao `tdm-31-V1`:
  - 1 = Uopće se ne slažem
  - 2 = Uglavnom se ne slažem
  - 3 = Uglavnom se slažem
  - 4 = U potpunosti se slažem
- Reverse itemi u V1 se ne koriste; svih 7 itema su pozitivno formulisani (čitljivost u B/H/S, manji rizik dvostrukih negacija, manji digital UX error rate).
- Scoring mode: `simple_linear_v1`.
- Formula: `score_0_100 = ((mean_1_4 - 1) / 3) * 100`.
- Team aggregation:
  - `team_score_0_100 = average(member_score_0_100)`
  - `team_sd = standard_deviation(member_score_0_100)`
  - `team_range = max(member_score_0_100) - min(member_score_0_100)`
  - `completion_rate = valid_completed / assigned`
- Consensus/disagreement u V1: `SD`, `range`, `completion_rate`; `AD_M` (Burke-Finkelstein average deviation) ostaje optional Phase 2 advanced metric i nije V1 obaveza.
- Interpretacijski bandovi:
  - `0-39` = nizak signal / razvojni rizik
  - `40-59` = mješovit ili nestabilan signal
  - `60-79` = funkcionalan signal
  - `80-100` = jak signal
- Report role:
  - zaseban sloj u Team Dynamics reportu
  - ne ulazi u TDM core score
  - koristi se za razlikovanje dobre komunikacije od stvarne sigurnosti da se otvore greške, problemi, rizici i drugačije mišljenje
  - prikazivati kao poseban signal uz TDM-31 razvojnu zrelost
- Validation status: `validation_pending`; ne tvrditi da je skala validirana kao originalni TPS7.
- Dopuštene formulacije u zavisnosti od sekcije: `TPS7-based`, `TPS7-inspired`, `psychological safety construct-based`.
- Zaključani radni itemi za sljedeći instrument/content spec:
  - `TPSDP_1` | `Greške` | `Kada se u ovom timu napravi greška, češće razgovaramo o tome šta možemo naučiti nego o tome koga treba okriviti.`
  - `TPSDP_2` | `Problemi i rizici` | `U ovom timu je uobičajeno otvoreno reći kada nešto ne funkcioniše, čak i ako je razgovor neugodan.`
  - `TPSDP_3` | `Drugačije mišljenje` | `Ljudi u ovom timu ozbiljno razmatraju ideje koje se razlikuju od uobičajenog načina razmišljanja.`
  - `TPSDP_4` | `Interpersonalni rizik` | `Mogu predložiti rješenje za koje nisam siguran/na da će uspjeti, bez straha da će to narušiti moj ugled u timu.`
  - `TPSDP_5` | `Traženje pomoći` | `Prirodno mi je zatražiti pomoć od nekoga iz tima kada zapnem.`
  - `TPSDP_6` | `Povjerenje u namjere` | `Imam povjerenje da članovi ovog tima neće namjerno otežati moj rad.`
  - `TPSDP_7` | `Vrednovanje doprinosa` | `Imam osjećaj da ovaj tim prepoznaje i koristi moje najjače vještine.`
- Guardrails:
  - ne prikazivati korisniku `TPS7-based` kao glavni UI naslov; glavni user-facing naslov je `Psihološka sigurnost u timu`
  - ne etiketirati tim kao psihološki nesiguran
  - ne kriviti lidera ili članove
  - ne koristiti rezultat za disciplinske odluke
  - ne koristiti kao hire/no-hire signal
  - ne miješati psihološku sigurnost sa zadovoljstvom poslom, ljubaznošću ili izbjegavanjem konflikta
  - ne tvrditi kauzalnost iz jednog mjerenja
  - nizak rezultat opisivati kao razvojni signal/rizik, ne kao presudu

**Completion/decision note — SJT block decision (`team_dynamics_assessment_v1`):**
- User-facing naziv bloka: `Timsko prosuđivanje u situacijama`.
- Interni block key: `situational_judgment`.
- Model basis: `Deep Profile original SJT`.
- Broj scenarija: 6.
- Broj opcija po scenariju: 4.
- Response format: `best_worst`:
  - korisnik bira jednu najefikasniju reakciju
  - korisnik bira jednu najmanje efikasnu reakciju
  - UI treba spriječiti da ista opcija bude označena i kao najefikasnija i kao najmanje efikasna
- Instruction type: `knowledge_based_should_do`:
  - `Koja reakcija je najefikasnija u ovoj situaciji?`
  - `Koja reakcija je najmanje efikasna u ovoj situaciji?`
  - ne koristiti `šta biste vi najvjerovatnije uradili?` kao V1 instrukciju
- Scoring model: `expert_key_partial_credit_v1`; svaka opcija se interno klasifikuje kao `Best`, `Acceptable`, `Weak`, `Harmful`.
- V1 scoring matrica:
  - izbor najefikasnije reakcije: `Best = +2`, `Acceptable = +1`, `Weak = 0`, `Harmful = -1`
  - izbor najmanje efikasne reakcije: `Harmful = +2`, `Weak = +1`, `Acceptable = 0`, `Best = -1`
- Raspon bodovanja:
  - `per_scenario_range = -2 to +4`
  - `total_raw_range = -12 to +24`
- Score transformacija:
  - `sjt_score_0_100 = ((raw_total + 12) / 36) * 100`
- Missing data:
  - u UI-u scenariji trebaju biti obavezni
  - `< 4/6` scenarija = insufficient data / unavailable
  - `4/6` ili `5/6` = pro-rated score uz napomenu
  - `6/6` = normalan score
- SJT dimenzije:
  - `constructive_conflict` = `Konstruktivno rješavanje konflikta`
  - `ownership` = `Preuzimanje odgovornosti`
  - `risk_transparency` = `Pravovremeno otvaranje rizika`
  - `coordination` = `Koordinacija i razmjena informacija`
  - `adaptability` = `Prilagodba promjeni prioriteta`
- Šest scenarijskih tema:
  - konflikt koji prelazi u personalizaciju
  - kašnjenje ili neizvršenje dogovora
  - nejasno vlasništvo nad zadatkom
  - prešućivanje rizika ili problema
  - promjena prioriteta
  - loša razmjena informacija / koordinacijski propust
- Report role:
  - SJT je zaseban Team Dynamics report sloj
  - ne ulazi u TDM core score
  - ne prikazivati kao `tačno/netačno`
  - ne prikazivati kao `IQ za timski rad`
  - prikazivati kao situacijsko prosuđivanje / prepoznavanje efikasnih i neefikasnih timskih reakcija
  - dimenzijski skorovi su indikativni jer blok ima samo 6 scenarija
- Guardrails:
  - ne koristiti SJT kao hire/no-hire filter
  - ne pisati da osoba `ne zna sarađivati`
  - ne etiketirati članove tima
  - ne otkrivati individualne odgovore u timskom reportu
  - ne donositi zaključak iz jednog scenarija
  - ne prikazivati scenario-level scoring key korisnicima
  - ne tumačiti SJT bez TDM-31 i `psychological_safety` konteksta
  - ne koristiti formulacije `objektivna mjera`, `predviđa timsku efikasnost` ili `stvarno ponašanje` dok nema validacije
  - koristiti formulacije `strukturisani scenarijski signal`, `situacijsko prosuđivanje`, `prepoznavanje efikasnih i neefikasnih timskih reakcija`
- Validation status: `validation_pending`; V1 koristi expert-key, a kasnije je moguć hybrid expert + empirical re-weighting nakon pilot podataka.
- Napomena o sadržaju:
  - SJT content još nije napisan
  - sljedeći task je napisati prvi konkretan SJT scenario radi validacije stila, pa tek nakon toga svih 6 scenarija
  - još nisu finalizovani: 6 scenarija, 24 opcije, scoring key po opciji, B/H/S final wording i SME review

**Completion note — canonical content/spec package (`team_dynamics_assessment_v1`):**
- Kreiran je canonical content/spec paket: `assessment-packages/team_dynamics_assessment_v1/`.
- Paket je repo-level source of truth za sadržaj i scoring konfiguraciju za `team_dynamics_assessment_v1`.
- Zaključano je 48 assessment jedinica:
  - `tdm-31-V1`: 31 item
  - `psychological_safety`: 7 itema
  - `situational_judgment`: 6 SJT scenarija
  - `outcome_pulse`: 4 itema
- Zaključani su blokovi, dimenzije, item/scenario content, response formati, scoring metadata, SJT `expert_key_partial_credit_v1`, outcome pulse `criterion_outcome_signal` i guardrails metadata.
- Važna tehnička napomena: paket je eksplicitno content/spec layer i trenutno nije generic DB import/runtime ready.
  - razlog: postojeći generic importer pretpostavlja jedan shared `options.json`
  - novi Team Dynamics je mixed-format instrument (Likert 1-4 + SJT best/worst sa scenario-level opcijama)
  - root `options.json` katalozi su ostavljeni prazni da se izbjegne lažna kompatibilnost
- Postojeći `team_dynamics_v1_strong` ostaje tehnički scaffold/placeholder i nije finalni instrument.
- Sljedeći P1 bloker: `Mixed-format Team Dynamics runtime/import support`.
- Ostaje pending:
  - SME review
  - pilot validation
  - full Rasch scoring
  - AD_M Phase 2
  - SJT empirical calibration
  - AI report layer

**Completion note — Mixed-format Team Dynamics runtime/import support (prvi tehnički sloj):**
- Status je djelimično završen / in progress.
- Završeno:
  - mixed-format package read model
  - mixed-format validation support
  - normalized `mixedAssessmentSpec`
  - backward compatibility sa legacy/shared-options package formatom
- Još nije završeno:
  - real DB import support
  - execution UI
  - per-block/per-question option catalog runtime shape
  - SJT best/worst response capture
  - scoring runtime
  - team aggregation
  - report layer
- Sljedeći preporučeni task: `Mixed-format option catalog / execution-ready runtime shape` (bez DB pisanja, bez scoring runtime-a i bez UI execution-a u tom tasku).

**Scope (docs/spec):**
- definisati finalne skale i item mapping po bloku za `team_dynamics_assessment_v1`
- definisati response format, scoring i aggregation logiku
- definisati consensus/disagreement logiku, completion rate i report output
- definisati validation/licensing notes i guardrails za komunikaciju prema korisniku
- definisati dvije implementation grane:
  - `licensed_mode`: originalni/odobreni TDM/TPS tekst i scoring kada pravni tim potvrdi dozvolu/licencu
  - `adapted_mode`: Deep Profile adaptirani itemi i jednostavniji scoring ako licenca/scoring kasni ili je ograničen
- SJT dio uvijek ostaje originalni Deep Profile modul

**Terminološki lock (user-facing):**
- User-facing naziv: `Procjena timske dinamike`
- Interni naziv: `team_dynamics_assessment_v1`
- Prezentacijski opis: assessment kombinuje razvojnu zrelost tima, psihološku sigurnost, situacijsko timsko prosuđivanje i percipiranu efektivnost
- Ne prikazivati kao “48 pitanja”; prikazivati kao “4 kratka bloka, oko 12–15 minuta”

**Validacijske/licencne napomene:**
- Ne tvrditi da je Deep Profile assessment već validiran.
- Koristiti formulacije `TDM-backed`, `TPS7-based` ili `TPS-inspired` dok pravni tim ne potvrdi dozvolu za originalne iteme.
- Ne tvrditi da je licenca već riješena.
- Report ne smije davati hire/no-hire, “loš tim”, “disfunkcionalan tim” ni lažno precizan zaključak.
- Report treba prikazivati skale, bandove, consensus/disagreement, completion rate, razvojne rizike i preporuke za lidera.

---

**Scope (prvi implementation slice, uzak):**
- data model scaffold za team-specific tabele
- placeholder package support za Team Dynamics Battery v1 strong
- minimalni schema/package testovi
- bez stvarnih licenciranih itema
- bez finalnog scoring/agregacije
- bez AI providera
- bez renderera
- bez relacijskog candidate-team fit reporta
- bez DUTCH implementacije

**Preporučeni redoslijed:**
1. završiti dokumentacioni sync Team Dynamics speca
2. definisati sljedeći Team Dynamics slice: post-import active DB guardrail hardening i odluku o prvom team-only runtime execution slice-u za `team_dynamics_v1_strong`, uz očuvanje postojećih guardraila koji ga drže van standard battery, candidate dashboarda, individual report capability-ja i individualnog HR/candidate flow-a

**Completion note (djelimično):**
- Remote Supabase migracija `supabase/migrations/20260519120000_add_team_dynamics_scaffold.sql` je primijenjena kroz SQL Editor i verifikovana.
- Potvrđene su Team Dynamics tabele: `teams`, `team_memberships`, `team_assessment_assignments`, `team_assessment_participants`.
- Potvrđeni su triggeri: `set_teams_updated_at`, `set_team_memberships_updated_at`, `set_team_assessment_assignments_updated_at`, `set_team_assessment_participants_updated_at`.
- Potvrđeni su SELECT RLS policy-ji: `teams_read_member`, `team_memberships_read_member`, `team_assessment_assignments_read_member`, `team_assessment_participants_read_member`.
- Nakon migracije `npm run typecheck` i `npm run build` prolaze.
- Placeholder package support kao početni korak je zatvoren: `assessment-packages/team_dynamics_v1_strong` već postoji i validira se kroz generic package validator.

**Completion note (guardrails):**
- Read-only audit je potvrdio da `assessment-packages/team_dynamics_v1_strong` već postoji kao placeholder scaffold package i da prolazi validaciju.
- Ojačan je `scripts/test-team-dynamics-package.cjs` da zaključava scaffold/placeholder metadata, package shape, prazne prompt kataloge, BS localization parity i placeholder-only wording.
- Ojačan je `scripts/test-report-capabilities.cjs` da verifikuje da `team_dynamics_v1_strong` nema aktivan participant ni HR individual single-test report capability i da post-completion report orchestration ne enqueue-a Team Dynamics report jobove.
- Ojačan je `scripts/test-standard-assessment-battery.cjs` da verifikuje da standard individual battery ostaje tačno IPIP/SAFRAN/MWMS i da ignoriše Team Dynamics čak i kada je prisutan među available testovima i active question ID-jevima.
- Postojeći privacy guard test i dalje pokriva blokadu candidate individual attempt creation za Team Dynamics.
- Verifikovane komande:
  - `node scripts/validate-assessment-package.mjs assessment-packages/team_dynamics_v1_strong`
  - `node scripts/test-team-dynamics-package.cjs`
  - `node scripts/test-team-dynamics-privacy-guards.cjs`
  - `node scripts/test-report-capabilities.cjs`
  - `node scripts/test-standard-assessment-battery.cjs`
  - `npm run typecheck`
- Nisu dodani licensed itemi, scoring, agregacija, AI provider, renderer, report capability activation, standard battery inclusion, candidate dashboard inclusion, Team Fit logika, DUTCH implementacija ni DB migracija.

**Completion note (admin detail slice):**
- Dodat je `/dashboard/teams/[teamId]` kao org-scoped Team Dynamics admin detail surface.
- Dodat je `lib/b2b/team-assessment-detail.ts` kao narrow read helper za jedan tim, active memberships, latest Team Dynamics assignment i `team_assessment_participants` wrapper statuse.
- Dodat je `components/dashboard/hr-team-assessment-detail.tsx` za prikaz team name, active member count, assignment status, completed/total progress i wrapper statusa po članu.
- Ažuriran je `components/dashboard/hr-teams-table.tsx` sa sigurnim sekundarnim CTA dugmetom `Otvori admin detalje`, bez promjene postojećeg `Pokreni procjenu timske dinamike` flow-a.
- Dodani/ažurirani testovi:
  - `scripts/test-team-dynamics-team-detail-read.cjs`
  - `scripts/test-team-dynamics-teams-ui.cjs`
- Očuvane su privacy/scope granice: helper ne čita attempts, responses, score/result polja ni report podatke; UI ne prikazuje raw attempt ID-jeve, attempt linkove, report CTA, individualne rezultate, odgovore ni AI sadržaj.
- Verifikovane komande:
  - `node scripts/test-team-dynamics-team-detail-read.cjs`
  - `node scripts/test-team-dynamics-teams-ui.cjs`
  - `node scripts/test-team-dynamics-teams-read.cjs`
  - `node scripts/test-team-dynamics-dashboard-entry.cjs`
  - `node scripts/test-team-dynamics-package.cjs`
  - `node scripts/test-team-dynamics-privacy-guards.cjs`
  - `node scripts/test-report-capabilities.cjs`
  - `node scripts/test-standard-assessment-battery.cjs`
  - `node scripts/test-team-dynamics-team-access.cjs`
  - `node scripts/test-team-dynamics-create-flow.cjs`
  - `node scripts/test-team-dynamics-linkage.cjs`
  - `node scripts/test-team-dynamics-action.cjs`
  - `node scripts/test-team-dynamics-completion-guard.cjs`
  - `npm run typecheck`
- Nisu dodani scoring, agregacija, report generation, AI provider, report renderer, Team Fit logika, DUTCH implementacija, licensed itemi, overall team score, individual member result exposure, standard battery inclusion, candidate dashboard inclusion, individual report capability activation, DB migracija, team CRUD, membership management, invite workflow ni team-member execution route.

**Completion note (DB category compatibility):**
- Category/import audit je potvrdio da postojeći `public.tests.category` constraint dozvoljava samo `personality`, `behavioral` i `cognitive`, pa bi package-level `category: "team_dynamics"` vjerovatno blokirao generic import.
- MVP odluka: koristiti `category: "behavioral"` kao DB-compatible storage fallback za `team_dynamics_v1_strong`.
- Canonical team-only semantika ostaje u `slug`, `intended_use: "team_assessment"`, `report_family: "team_dynamics"`, `metadata.placeholder_content_only`, Team Dynamics spec-u i slug-based runtime guardrailima.
- U implementation patch-u su ažurirani `assessment-packages/team_dynamics_v1_strong/test.json` i `scripts/test-team-dynamics-package.cjs`.
- Verifikovane komande:
  - `node scripts/test-team-dynamics-package.cjs`
  - `node scripts/validate-assessment-package.mjs assessment-packages/team_dynamics_v1_strong`
  - `node scripts/test-candidate-dashboard-team-dynamics-exclusion.cjs`
  - `node scripts/test-team-dynamics-privacy-guards.cjs`
  - `node scripts/test-standard-assessment-battery.cjs`
  - `node scripts/test-report-capabilities.cjs`
  - `npm run typecheck`
- Nisu dodani DB import, DB activation, DB migracija, scoring, agregacija, report generation, AI provider, renderer, Team Fit, DUTCH, licensed itemi, overall team score, individual member result exposure, standard battery inclusion, candidate dashboard inclusion, individual report capability activation, team-member execution route, team CRUD, membership management ni invite workflow.

**Completion note (active DB import verification):**
- Runtime DB read-only provjera je potvrdila da `team_dynamics_v1_strong` već postoji u DB-u i da je aktivan na nivou `public.tests`.
- Potvrđen `public.tests` row:
  - `slug='team_dynamics_v1_strong'`
  - `category='behavioral'`
  - `status='active'`
  - `is_active=true`
  - `updated_at='2026-05-20 09:14:05.939+00'`
- Potvrđen DB content footprint:
  - 4 dimenzije
  - 36 pitanja
  - 180 answer options
  - 0 promptova
- Potvrđene BS lokalizacije:
  - 36 question localizations
  - 180 answer option localizations
- Prompt duplicate check vraća no rows.
- Report footprint check:
  - `attempt_reports` za Team Dynamics: 0
- `assessment_reports` single_test footprint za Team Dynamics: 0
- Code-level guardrail test paket prolazi prema zadnjem Codex audit izvještaju.

**Completion note (post-import active DB guardrail hardening):**
- Pojačani su guardrail testovi, bez runtime code promjena.
- Promijenjeni su samo test fajlovi:
  - `scripts/test-team-dynamics-privacy-guards.cjs`
  - `scripts/test-standard-assessment-battery.cjs`
  - `scripts/test-candidate-dashboard-team-dynamics-exclusion.cjs`
  - `scripts/test-report-capabilities.cjs`
- Standard battery guardrail sada eksplicitno pokriva scenario gdje je `team_dynamics_v1_strong` `active/is_active=true` i jedini aktivni test sa pitanjima, ali rezultat ostaje `battery-no-runnable-tests`.
- Candidate dashboard guardrail potvrđuje da active Team Dynamics test može imati candidate availability `add_on_available`, ali je i dalje skriven sa dashboarda i nema CTA obrasce `Započni procjenu`, `Nastavi procjenu`, `Pogledaj rezultate`.
- Privacy guard potvrđuje da generic candidate attempt creation ostaje blokiran za Team Dynamics, čak i kada availability kaže da bi test mogao biti startable.
- Privacy guard dodatno zaključava da se Team Dynamics guard izvršava prije candidate availability grane.
- Report capability guardrail potvrđuje da Team Dynamics nema participant/HR individual single_test capability i da se ništa ne enqueue-a čak ni ako fixture sadrži postojeće queued/ready artefakte.
- Completion/orchestration guardrail ostaje pokriven kroz postojeće testove i capability plan: Team Dynamics ne proizvodi individualne post-completion report jobove.
- Relevantne verifikovane komande:
  - `node scripts/validate-assessment-package.mjs assessment-packages/team_dynamics_v1_strong`
  - `node scripts/test-team-dynamics-package.cjs`
  - `node scripts/test-team-dynamics-privacy-guards.cjs`
  - `node scripts/test-team-dynamics-completion-guard.cjs`
  - `node scripts/test-standard-assessment-battery.cjs`
  - `node scripts/test-candidate-dashboard-team-dynamics-exclusion.cjs`
  - `node scripts/test-report-capabilities.cjs`
  - `node scripts/test-report-orchestration.cjs`
  - `npm run typecheck`

**Completion note (wrapper readiness test):**
- Dodan je novi script-level test `scripts/test-team-dynamics-wrapper-readiness.cjs`.
- Test eksplicitno tretira `team_dynamics_v1_strong` kao active DB test (`status='active'`, `is_active=true`).
- Test potvrđuje da wrapper flow ide kroz:
  - `team_assessment_assignments`
  - `team_assessment_participants`
- Test potvrđuje da participant wrapper statusi mogu postojati bez individualnog candidate dashboard entry path-a.
- Test potvrđuje da admin/team detail read path prikazuje samo team assignment i wrapper participant statuse.
- Test zaključava da admin/team detail read path ne prikazuje:
  - raw individual attempt IDs
  - individual responses
  - individual score fields
  - report CTA
  - AI report content
  - Team Fit output
- Test dodatno zaključava da helper ne čita:
  - `attempts`
  - `responses`
  - `attempt_reports`
  - `assessment_reports`
- Test potvrđuje da `canUseGenericCandidateAttemptCreation(...)` i dalje blokira individual candidate entry path za Team Dynamics, čak i kada active availability može biti `add_on_available`.
- Test potvrđuje da `planPostCompletionReportJobs(...)` za Team Dynamics ne enqueue-a ništa, čak ni kada fixture sadrži existing individual queued/ready artefakte.
- Nije bilo runtime feature promjena.
- Nije bilo DB write-a.
- Nisu mijenjane migracije.
- Verifikovane komande:
  - `node scripts/validate-assessment-package.mjs assessment-packages/team_dynamics_v1_strong`
  - `node scripts/test-team-dynamics-package.cjs`
  - `node scripts/test-team-dynamics-privacy-guards.cjs`
  - `node scripts/test-team-dynamics-completion-guard.cjs`
  - `node scripts/test-standard-assessment-battery.cjs`
  - `node scripts/test-candidate-dashboard-team-dynamics-exclusion.cjs`
  - `node scripts/test-report-capabilities.cjs`
  - `node scripts/test-report-orchestration.cjs`
  - `node scripts/test-team-dynamics-team-detail-read.cjs`
  - `node scripts/test-team-dynamics-teams-ui.cjs`
  - `node scripts/test-team-dynamics-team-access.cjs`
  - `node scripts/test-team-dynamics-create-flow.cjs`
  - `node scripts/test-team-dynamics-linkage.cjs`
  - `node scripts/test-team-dynamics-action.cjs`
- `node scripts/test-team-dynamics-wrapper-readiness.cjs`
- `npm run typecheck`

**Completion note (SQL-backed wrapper lifecycle smoke):**
- SQL-backed wrapper lifecycle smoke je pokrenut kroz Supabase SQL Editor.
- Smoke je koristio `BEGIN ... ROLLBACK`, tako da nije trajno upisao testne redove.
- Finalni rezultat:
  - `result = SQL_TD_WRAPPER_WITH_ATTEMPTS_SMOKE_OK_ROLLBACK_PENDING`
  - `organization_id = 5d93f3a1-3765-4ec4-b668-c0d1228a8445`
  - `team_id = f2268d59-39e0-42ec-984e-ace91bc00cb7`
  - `assignment_id = 96b5cc0e-20ad-461d-bc19-8f2b783b4ecd`
  - `smoke_attempt_count = 2`
  - `wrapper_count = 2`
  - `linked_attempt_count = 2`
- Smoke je dokazao da DB wrapper lifecycle može kreirati:
  - privremeni team
  - team memberships
  - `team_assessment_assignments`
  - Team Dynamics `attempts`
  - `team_assessment_participants` wrapper redove
  - link wrappera prema attemptima
- Smoke je potvrdio stvarnu šemu:
  - `team_assessment_assignments` nema `organization_id`
  - organization scope ide preko `team_id -> teams.organization_id`
  - `team_assessment_participants.status` koristi `invited`
  - wrapper redovi imaju popunjen `attempt_id`
- Smoke nije pozvao `createTeamDynamicsAssessmentAction`.
- Smoke nije zamjena za app action DB-backed smoke.
- App action DB-backed smoke ostaje otvoren/blokiran dok lokalni Supabase/Docker stack ne bude dostupan.
- Nije bilo runtime feature promjena.
- Nije bilo DB write-a.
- Nisu mijenjane migracije.

**Completion note (team-member execution route readiness/spec):**
- Završen je read-only/spec task za budući Team Dynamics team-member execution route, bez runtime code izmjena.
- Zaključano je da Team Dynamics team-member execution mora ići kroz wrapper route, ne kroz generic `/app/attempts/[attemptId]/run`.
- Predložene rute:
  - `/app/team-assessments/[teamAssessmentParticipantId]`
  - `/app/team-assessments/[teamAssessmentParticipantId]/run`
- `team_assessment_participants.id` je access key / security boundary.
- `attempt_id` je execution payload, ali nije access key.
- Wrapper mora validirati:
  - postojanje `team_assessment_participants.id`
  - da wrapper pripada trenutno prijavljenom korisniku preko linked `participant_id`
  - da wrapper ima `attempt_id`
  - active `team_membership` (`is_active=true`, `left_at is null`)
  - active assignment
  - `package_slug='team_dynamics_v1_strong'`
  - organization scope preko `team_assessment_assignments.team_id -> teams.organization_id`
  - linked attempt pripada istom participantu, organizaciji i Team Dynamics testu
- Direct `/app/attempts/[attemptId]/run` ulaz za Team Dynamics mora biti eksplicitno blokiran ili zaštićen wrapper guard-om.
- Status model koristi postojeću šemu:
  - wrapper statusi: `invited`, `started`, `completed`, `expired`
  - prvi ulaz: `invited -> started`
  - completion: `started -> completed`
  - ne koristiti `in_progress` kao wrapper status
- Team Dynamics completion ne smije enqueue-ati participant individual report, HR individual single-test report, Composite HR report, `attempt_reports` ni `assessment_reports single_test`.
- Budući team aggregation/report lifecycle ostaje poseban kasniji slice.
- Spec nije implementirao route, scoring, agregaciju, AI provider, renderer, Team Fit, DUTCH ni individual report capability.

**Completion note (execution access helper implementation slice):**
- Dodan je novi server-side helper `lib/assessment/team-assessment-execution.ts`.
- Dodan je novi script-level test `scripts/test-team-dynamics-execution-access.cjs`.
- Helper koristi `team_assessment_participants.id` kao access boundary i potvrđuje product/tech odluku da je `attempt_id` execution payload, ali nije access key.
- Helper validira:
  - wrapper postoji
  - wrapper ima `attempt_id`
  - wrapper participant je vezan za dati `userId`
  - team membership je active (`is_active=true`, `left_at is null`)
  - assignment je `active`
  - assignment ima `package_slug='team_dynamics_v1_strong'`
  - organization scope se izvodi preko `assignment.team_id -> teams.organization_id`
  - linked attempt postoji
  - linked attempt pripada istom participantu
  - linked attempt pripada istoj organizaciji
  - linked attempt pripada active/is_active `team_dynamics_v1_strong` testu
- Helper odbija:
  - nepostojeći wrapper
  - tuđi wrapper
  - wrapper bez attempta
  - inactive membership
  - non-active assignment
  - wrong package slug
  - attempt/test mismatch
  - organization mismatch
- Helper output je siguran i ne izlaže:
  - responses
  - score fields
  - `attempt_reports`
  - `assessment_reports`
  - report snapshotove
  - AI sadržaj
  - Team Fit podatke
  - podatke drugih članova tima
- Test pokriva happy path i ključne rejection scenarije.
- Nisu implementirani route, UI, run ekran, scoring, agregacija, AI provider, renderer, Team Fit, DUTCH ili individual report capability.
- Prošle verifikacione komande:
  - `node scripts/test-team-dynamics-execution-access.cjs`
  - `node scripts/test-team-dynamics-wrapper-readiness.cjs`
  - `node scripts/test-team-dynamics-action.cjs`
  - `node scripts/test-team-dynamics-create-flow.cjs`
  - `node scripts/test-team-dynamics-linkage.cjs`
  - `node scripts/test-team-dynamics-team-access.cjs`
  - `node scripts/test-team-dynamics-team-detail-read.cjs`
  - `node scripts/test-team-dynamics-privacy-guards.cjs`
  - `node scripts/test-team-dynamics-completion-guard.cjs`
  - `node scripts/test-standard-assessment-battery.cjs`
  - `node scripts/test-candidate-dashboard-team-dynamics-exclusion.cjs`
  - `node scripts/test-report-capabilities.cjs`
  - `node scripts/test-report-orchestration.cjs`
  - `npm run typecheck`

**Completion note (team-member intro route shell):**
- Dodana je ruta `app/(protected)/app/team-assessments/[teamAssessmentParticipantId]/page.tsx`.
- Dodan je statički test `scripts/test-team-dynamics-intro-route-shell.cjs`.
- Ruta koristi `loadTeamAssessmentExecutionContext(...)`.
- Validan wrapper access prikazuje intro/placeholder shell.
- Nevalidan wrapper/access vraća `notFound()` server-side.
- Ruta potvrđuje wrapper-based access model:
  - `team_assessment_participants.id` je access key / security boundary
  - `attempt_id` nije access key
- Ekran prikazuje samo sigurne informacije:
  - “Procjena timske dinamike”
  - objašnjenje da je procjena dio timske procjene, ne individualni psihološki profil
  - wrapper status
  - package label
  - link nazad na dashboard
- Ekran namjerno ne prikazuje:
  - raw attempt ID
  - druge članove tima
  - individualne odgovore
  - score fields
  - report CTA
  - AI sadržaj
  - Team Fit output
- Ruta ne koristi `AssessmentForm`.
- Ruta ne implementira `/run`.
- Ruta ne mijenja wrapper status.
- Nema `invited -> started` transitiona u ovom slice-u.
- Nema autosave-a, completiona, scoringa, agregacije, AI providera, renderera, Team Fit-a ili individual report capability-ja.
- Prošle verifikacione komande:
  - `node scripts/test-team-dynamics-intro-route-shell.cjs`
  - `node scripts/test-team-dynamics-execution-access.cjs`
  - `node scripts/test-team-dynamics-direct-attempt-route-block.cjs`
  - `node scripts/test-team-dynamics-wrapper-readiness.cjs`
  - `node scripts/test-team-dynamics-privacy-guards.cjs`
  - `node scripts/test-team-dynamics-completion-guard.cjs`
  - `node scripts/test-standard-assessment-battery.cjs`
  - `node scripts/test-candidate-dashboard-team-dynamics-exclusion.cjs`
  - `node scripts/test-report-capabilities.cjs`
  - `node scripts/test-report-orchestration.cjs`
  - `npm run typecheck`

**Completion note (execution safe-state guard za intro i `/run`):**
- Uveden je centralni Team Dynamics safe-state helper/resolver u `lib/assessment/team-assessment-execution.ts`.
- Intro ruta koristi `resolveTeamAssessmentExecutionShellState({ route: "intro", ... })`.
- `/run` ruta koristi isti resolver i transition helper samo kada `shellState.shouldTransitionToStarted === true`.
- Intro ruta nikada ne mijenja status.
- `/run` ruta radi `invited -> started` samo za `invited`, dok `started` ne ponavlja transition.
- `completed` i `expired` ne ulaze u aktivni run mode.
- Unknown/nepodržan status se ne tretira kao runnable i vraća safe unavailable state.
- Safe-state matrix pokriva: `invited`, `started`, `completed`, `expired` i unknown status.
- Nisu uvedeni pravi run ekran, `AssessmentForm`, pitanja, autosave, completion, scoring, agregacija, AI provider, renderer, Team Fit ili individual report capability.
- Promijenjeni implementation fajlovi:
  - `lib/assessment/team-assessment-execution.ts`
  - `app/(protected)/app/team-assessments/[teamAssessmentParticipantId]/page.tsx`
  - `app/(protected)/app/team-assessments/[teamAssessmentParticipantId]/run/page.tsx`
  - `scripts/test-team-dynamics-intro-route-shell.cjs`
  - `scripts/test-team-dynamics-run-route-shell.cjs`
  - `scripts/test-team-dynamics-execution-safe-states.cjs`
- Prošle verifikacione komande:
  - `node scripts/test-team-dynamics-execution-safe-states.cjs`
  - `node scripts/test-team-dynamics-run-route-shell.cjs`
  - `node scripts/test-team-dynamics-intro-route-shell.cjs`
  - `node scripts/test-team-dynamics-execution-access.cjs`
  - `node scripts/test-team-dynamics-direct-attempt-route-block.cjs`
  - `node scripts/test-team-dynamics-wrapper-readiness.cjs`
  - `node scripts/test-team-dynamics-privacy-guards.cjs`
  - `node scripts/test-team-dynamics-completion-guard.cjs`
  - `node scripts/test-standard-assessment-battery.cjs`
  - `node scripts/test-candidate-dashboard-team-dynamics-exclusion.cjs`
  - `node scripts/test-report-capabilities.cjs`
  - `node scripts/test-report-orchestration.cjs`
  - `npm run typecheck`

**Completion note (wrapper-based `/run` handoff skeleton bez `AssessmentForm`-a):**
- `/run` ruta sada, nakon validiranog wrapper contexta i eventualnog `invited -> started` transitiona, poziva `loadTeamAssessmentRunHandoff(...)`.
- Handoff učitava/builda:
  - `teamAssessmentParticipantId`
  - `teamAssessmentAssignmentId`
  - interni `attemptId`
  - `packageSlug`
  - `testSlug`
  - `testName`
  - `wrapperStatus`
  - `attemptStatus`
  - `activeQuestionCount`
- `/run` UI prikazuje:
  - naziv procjene
  - package label
  - wrapper status
  - attempt status
  - broj aktivnih pitanja
  - poruku da su podaci za rješavanje pripremljeni, ali da rješavanje još nije omogućeno
- Raw `attemptId` se ne prikazuje u UI.
- Handoff ne prikazuje:
  - pitanja
  - answer options
  - responses
  - score fields
  - report artefakte
  - AI sadržaj
  - Team Fit output
  - podatke drugih članova tima
- Handoff builder koristi postojeći safe-state resolver.
- `completed`, `expired` i unknown status ne postaju runnable mode.
- Neočekivan question count ulazi u warning handoff state, ne u hard crash.
- Nije uveden pravi run ekran.
- Nije korišten `AssessmentForm`.
- Nema pitanja, answer options, autosave-a, completiona, scoringa, agregacije, AI providera, renderera, Team Fit-a ili individual report capability-ja.
- Promijenjeni implementation fajlovi:
  - `lib/assessment/team-assessment-execution.ts`
  - `app/(protected)/app/team-assessments/[teamAssessmentParticipantId]/run/page.tsx`
  - `scripts/test-team-dynamics-run-route-shell.cjs`
  - `scripts/test-team-dynamics-run-handoff-skeleton.cjs`
- Prošle verifikacione komande:
  - `node scripts/test-team-dynamics-run-handoff-skeleton.cjs`
  - `node scripts/test-team-dynamics-run-route-shell.cjs`
  - `node scripts/test-team-dynamics-execution-safe-states.cjs`
  - `node scripts/test-team-dynamics-intro-route-shell.cjs`
  - `node scripts/test-team-dynamics-execution-access.cjs`
  - `node scripts/test-team-dynamics-direct-attempt-route-block.cjs`
  - `node scripts/test-team-dynamics-wrapper-readiness.cjs`
  - `node scripts/test-team-dynamics-privacy-guards.cjs`
  - `node scripts/test-team-dynamics-completion-guard.cjs`
  - `node scripts/test-standard-assessment-battery.cjs`
  - `node scripts/test-candidate-dashboard-team-dynamics-exclusion.cjs`
  - `node scripts/test-report-capabilities.cjs`
  - `node scripts/test-report-orchestration.cjs`
  - `npm run typecheck`

**Sljedeći korak:**  
Read-only Team Dynamics question loader za `/run` handoff: sigurno pripremiti ordered question IDs i localized titles bez renderovanja pitanja, odgovora, answer options ili `AssessmentForm` executiona.

---

### P1 — Individualni razvojni profil product/report contract spec

**Status:** Planirano  
**Kategorija:** Individualni razvojni profil / Product architecture

**Definicija i granica:**
- Individualni razvojni profil je personalizovani Deep Profile output za lidera/HR: kako s konkretnom osobom komunicirati, motivisati je, dati feedback, uključiti je u tim i gdje obratiti pažnju u razvoju.
- Nije dio agregiranog Team Dynamics reporta.
- Team Dynamics report ostaje agregiran i objašnjava tim kao sistem.
- Individualni razvojni profil objašnjava kako raditi s konkretnom osobom na osnovu njenog individualnog profila.

**Svrha:**
- kvalitetnije vođenje
- bolji onboarding
- pametniji 1:1 razgovori
- konkretnije razvojne intervencije
- bolja komunikacija lidera s osobom
- bolje razumijevanje motivacije, feedback potreba i načina uključivanja osobe u tim

**Šta ne smije biti:**
- ne smije biti optužnica
- ne smije etiketirati osobu
- ne smije tražiti “krivca” za timsku dinamiku
- ne smije koristiti agregirani timski report za individualno targetiranje
- ne smije koristiti jezik presude, dijagnoze ili “problematičnog člana”
- ne smije biti hire/no-hire ili fire/no-fire alat

**Izvori podataka (trenutni plan):**
- individualna baterija osobe: IPIP-NEO-120, SAFRAN, MWMS
- relacijski kontekst kandidat + tim može kasnije biti dodat oprezno, bez individualnog targetiranja iz Team Dynamics reporta

**Predložene sekcije outputa:**
1. Kako komunicirati s osobom
2. Šta osobu motiviše
3. Kako dati feedback
4. Kako osobu uključiti u tim
5. Gdje lider treba obratiti pažnju
6. Šta ne raditi

**Odnos prema postojećim report slojevima:**
- Kompozitni profil: kakva je osoba
- Individualni razvojni profil: kako raditi s tom osobom
- Agregirani profil / Timska dinamika: kakav je tim
- Relacijski profil / Timski fit kandidata: kako se osoba uklapa u konkretan tim

**Prvi preporučeni budući task (bez implementacije):**
- `Individualni razvojni profil product/report contract spec`
- scope: definisati sekcije outputa, deterministic input iz individualne baterije, AI-generated sekcije i guardrails
- granice: ne implementirati kod, ne mijenjati postojeći report pipeline, ne spajati sa Team Dynamics reportom

---

### P1 — Timski fit kandidata

**Status:** Planirano / Epic zabilježen  
**Kategorija:** Relacijski report / Candidate-team fit / Team module

**Kratki opis:**  
Timski fit kandidata je zaseban relacijski report koji kombinuje individualni profil kandidata/osobe i agregirani Team Dynamics profil konkretnog tima. Report odgovara na pitanje kako bi se kandidat mogao uklopiti u konkretan tim, gdje može pojačati tim, gdje mogu nastati frikcije i šta HR/lider treba provjeriti ili podržati tokom onboarding-a.

**Terminološka napomena:**  
`Timski fit kandidata` nije test koji kandidat rješava, nego relacijski report koji koristi više ulaza.

**Product odluke (obavezni guardrails):**
- Ovo nije zamjena za `Timska dinamika` report.
- Ovo nije dio agregiranog Team Dynamics reporta.
- Ovo nije individualni razvojni profil.
- Ovo je relacijski / what-if report: kandidat + konkretan tim.
- Individualne procjene kandidata mogu se reuse-ati kroz timove.
- Team Dynamics odgovori članova tima ostaju vezani za konkretan timski assessment ciklus i ne prenose se automatski iz jednog tima u drugi.
- Report koristi agregirani timski signal, ne individualne odgovore članova tima.
- Ne prikazivati individualne skorove članova tima.
- Nema hire/no-hire odluke.
- Nema fit score-a.
- Nema tvrdnje da report predviđa budući uspjeh.
- Nema identifikovanja “problematičnog člana”.

**Predloženi budući inputi:**
- kandidatov individualni profil: IPIP, SAFRAN, MWMS, kompozitni profil kandidata
- kandidatov `Timski stil saradnje`
- agregirani Team Dynamics report konkretnog tima
- timski rizici iz Team Dynamics reporta
- zahtjevi uloge / role-context signal

**Predložene buduće sekcije:**
1. Sažetak uklapanja
2. Gdje kandidat može pojačati tim
3. Moguće frikcije
4. Šta provjeriti u razgovoru
5. Onboarding preporuke
6. Menadžerske smjernice
7. Ograničenja interpretacije

**Preporučeni redoslijed:**
- Ne implementirati ovaj epic prije osnovnog Team Dynamics flow-a.
- Prvo završiti Team Dynamics execution, scoring/agregaciju i `Timska dinamika` report.
- Nakon toga otvoriti zaseban spec task za `Timski fit kandidata product/report contract spec`.

---

### P1 — HR report card status mapping

**Status:** Završeno  
**Kategorija:** HR dashboard / Report status UX

**Problem / context:**  
HR candidate assessment detail page je ranije miješao različita stanja HR report artefakta, attempt lifecycle-a i nepodržanog capability lane-a. To je pravilo lažne ekvivalencije između completed attempta, queued reporta i stvarno spremnog HR reporta.

**Scope:**
- jasno razlikovati ready, queued, processing, failed i unavailable status kartice
- razlikovati completed attempt bez HR report artefakta od incomplete/not assigned/abandoned stanja
- prikazati planned / unsupported HR lane kao zasebno stanje
- ne koristiti participant report kao HR fallback
- zadržati postojeću strukturu kartica i single-test HR routing

**Acceptance criteria:**
- failed HR report prikazuje `Greška pri generisanju`
- completed attempt bez HR reporta prikazuje `Nije generisano`
- unsupported/planned lane prikazuje `Još nije podržano`
- queued i processing nisu isti status
- participant report se ne koristi kao HR fallback

**Completion note:**  
Završeno kroz stabilizovan status mapping na HR candidate assessment detail page-u. Single-test HR report kartice sada jasno razlikuju `ready`, `queued`, `processing`, `failed`, `unavailable / unsupported_audience`, completed attempt bez HR report artefakta i incomplete / not assigned / abandoned stanje. Potvrđeni realni scenariji uključuju Amrin IPIP failed HR report → `Greška pri generisanju`, SAFRAN completed attempt bez HR reporta → `Nije generisano` i MWMS planned/not implemented HR lane → `Još nije podržano`. Participant report se ne koristi kao HR fallback.

---

### P1 — Queued vs processing HR report status UX

**Status:** Završeno  
**Kategorija:** HR dashboard / Report status UX

**Problem / context:**  
`queued` i `processing` su ranije zvučali kao isto stanje, iako predstavljaju različite faze pipelinea. To je u HR UI-ju stvaralo lažno očekivanje da worker već generiše report čim je job samo enqueue-an.

**Scope:**
- razdvojiti user-facing značenje `queued` i `processing`
- poravnati status label, description i disabled CTA sa stvarnim worker state-om
- ne mijenjati worker implementaciju u ovom UX tasku

**Acceptance criteria:**
- `queued` prikazuje `Čeka generisanje`
- `processing` prikazuje `Generiše se`
- oba stanja imaju različit opis i disabled CTA
- UI ne sugeriše processing dok job još samo čeka worker

**Completion note:**  
Završeno kroz eksplicitno razdvajanje `queued = Čeka generisanje` i `processing = Generiše se`. Mapping je stabilizovan za statusLabel, description i disabled CTA: `queued` opisuje da je HR izvještaj poslan na generisanje i čeka obradu, dok `processing` znači da worker aktivno priprema report. Odluka ostaje da queued ne znači aktivno generisanje, nego samo red za obradu.

---

### P1 — Automatic HR report enqueue / capability registry

**Status:** Završeno  
**Kategorija:** Report pipeline / HR report orchestration

**Problem / context:**  
Nakon završetka participant attempta nije postojao centralni capability-driven mehanizam koji odlučuje da li single-test HR lane treba automatski enqueue-ati. To je rizikovalo hardcodirane izuzetke po testu i nekonzistentan completion flow.

**Scope:**
- uvesti centralni report capability registry
- uvesti post-completion planning helper za automatic enqueue
- podržati automatic HR enqueue samo za active HR lane-ove
- izbjeći duplikate kada `attempt_reports` red već postoji
- ne retry-ati failed HR red automatski u completion flow-u
- ne koristiti participant report kao HR source ili fallback

**Acceptance criteria:**
- capability registry odlučuje koji report lane može biti generisan
- IPIP i SAFRAN HR lane-ovi mogu automatski ući u queued nakon participant completiona
- MWMS HR lane sada je active single-test HR lane, nakon zatvaranja ranijeg planned/not_implemented stanja
- completion flow ne kreira duplikat reda ako report već postoji
- failed red se ne retry-a automatski

**Completion note:**  
Završeno kroz centralni capability registry i post-completion planning helper. Trenutni registry mapira `ipip-neo-120-v1`, `safran_v1` i `mwms_v1` kao `participant individual single_test: active` i `hr individual single_test: active`. Odluka je da svi single-test HR lane-ovi ulaze u isti capability-driven chain kada su aktivni. Completion flow ne pravi duplikate ako report red već postoji i ne retry-a automatski failed redove.

---

### P1 — HR report recovery actions

**Status:** Završeno  
**Kategorija:** HR dashboard / Report recovery

**Problem / context:**  
Historijski failed ili missing single-test HR reportovi nisu imali per-card recovery flow na HR candidate assessment detail page-u. To je HR korisnika ostavljalo bez kontrolisanog načina da ponovo pokrene artefakt ili da ga prvi put generiše kada completed attempt postoji bez HR reda.

**Scope:**
- dodati recovery akciju za failed HR report sa active capability-jem
- dodati recovery akciju za missing HR report kada completed attempt postoji i capability je active
- ne prikazivati recovery akcije za ready / queued / processing
- ne prikazivati recovery akcije za planned/inactive capability lane-ove ni incomplete attemptove
- reset failed reda raditi nad istim postojećim `attempt_reports` redom
- missing report generate raditi eksplicitnim insertom novog queued HR reda

**Acceptance criteria:**
- failed HR report + active capability prikazuje `Ponovo generiši`
- missing HR report + completed attempt + active capability prikazuje `Generiši HR izvještaj`
- ready / queued / processing nemaju recovery akciju
- planned/inactive capability i incomplete attempt nemaju recovery akciju
- duplicate conflict se tretira kao race/no-op i reloaduje postojeći red

**Completion note:**  
Završeno kroz per-card recovery flow za single-test HR reportove. Retry failed reporta resetuje isti postojeći `attempt_reports` red u `queued`, čisti `failure_code`, `failure_reason` i `report_snapshot`, te resetuje `started_at` i `completed_at` bez kreiranja novog reda. Missing report generate kreira novi queued HR red eksplicitnim insertom, a duplicate conflict se tretira kao race/no-op i reloaduje postojeći red. Realno potvrđeni scenariji: Amrin IPIP failed HR report je resetovan u `queued` i nakon ručnog worker procesiranja prešao u `ready`; SAFRAN missing HR report je kreiran kao queued HR red; duplicate provjera za SAFRAN vratila je `report_count = 1`. Participant report se ne koristi kao HR fallback ni kao izvor.

---

### P1 — IPIP HR report content contract V2

**Status:** Završeno  
**Kategorija:** HR report / IPIP / Content contract

**Problem / context:**  
IPIP NEO-120 HR report više nije trebao ostati generički workplace narrative shape. HR lane je trebao preći na eksplicitno HR-operativni contract koristan za intervju, onboarding i timski kontekst.

**Scope:**
- uvesti novi `contract_version = ipip_neo_120_hr_v2`
- zadržati runtime/display normalization fallback za legacy `ipip_neo_120_hr_v1` snapshotove
- novi provider/schema/mock/validator prebaciti na V2 shape
- zaključati HR-operativne sekcije i očekivane cardinality guardraile
- zadržati zabranu AI scoringa, band izmjena, hire/no-hire preporuke, dijagnostičkog jezika i zaštićenih atributa

**Acceptance criteria:**
- novi IPIP HR report koristi `ipip_neo_120_hr_v2`
- legacy `ipip_neo_120_hr_v1` snapshotovi ostaju podržani kroz display fallback
- report sadrži headline, executive_summary, `key_hr_signals = 3`, `verification_focus = 3`, `interview_questions = 5`, `domain_overview = 5` i druge zaključane HR sekcije
- `decision_support_note` jasno kaže da report nije samostalna hiring odluka
- AI ne računa score niti izmišlja domene/facete

**Completion note:**  
Završeno kroz prelazak IPIP HR lane-a na `contract_version = ipip_neo_120_hr_v2`. Novi HR-operativni model uključuje `headline`, `executive_summary`, tačno 3 `key_hr_signals`, tačno 3 `verification_focus`, tačno 5 `interview_questions`, 2 do 3 `strengths_and_overuse_risks`, tačno 5 `domain_overview`, tačno 4 `onboarding_and_management_guidance`, tačno 3 `team_fit_notes`, 2 do 4 `decision_support_note` i `interpretation_note`. Legacy `ipip_neo_120_hr_v1` snapshotovi ostaju podržani kroz runtime/display normalization fallback. Realni smoke je potvrdio Amrin IPIP HR report sa `contract_version = ipip_neo_120_hr_v2`, `interview_questions = 5`, `key_hr_signals = 3`, prisutnim `verification_focus`, `strengths_and_overuse_risks` i `decision_support_note`.

---

### P2 — Candidate dashboard CTA hover contrast

**Status:** Završeno  
**Kategorija:** Dashboard UI / Accessibility / Visual polish

**Problem / context:**  
Na candidate dashboard test karticama, posebno za completed testove, CTA “Pogledaj rezultate” je na hoveru dobijao tamnu pozadinu, dok su tekst i ikona ostajali tamni. To je proizvodilo slab kontrast i dugme je djelovalo skoro disabled.

**Scope:**
- popraviti shared CTA stil na candidate dashboard test karticama
- hover za completed CTA mora imati dovoljan kontrast
- icon color mora pratiti text color preko currentColor
- focus-visible mora imati jasan ring bez pada kontrasta
- provjeriti CTA varijante: Započni procjenu, Nastavi procjenu, Pogledaj rezultate
- ne mijenjati lifecycle, scoring, report generation, route logiku ili copy

**Acceptance criteria:**
- “Pogledaj rezultate” na hoveru ostaje jasno čitljiv
- tekst i ikona su sinhronizovani
- dugme ne izgleda disabled
- focus-visible je vidljiv i pristupačan
- sve tri CTA varijante imaju konzistentan hover/focus kontrast

**Completion note:**  
Završeno u components/dashboard/candidate-dashboard.tsx kroz shared CTA class builder. “Pogledaj rezultate” na hoveru prelazi na tamniju pozadinu uz bijel tekst i ikonu, focus-visible dobija jasan ring, a Započni procjenu i Nastavi procjenu koriste isti konzistentan hover/focus sistem. Lifecycle logika, scoring, report generation i route logika nisu mijenjani.

---

### P1 — MWMS HR report V1

**Status:** Završeno  
**Kategorija:** HR report / MWMS

**Problem / context:**  
MWMS trenutno ima participant report lane, ali nema HR report lane. HR verzija treba prevesti motivacijski profil u HR-relevantne uvide za angažman, intervju, onboarding i menadžersku podršku.

**Scope:**
- HR-facing MWMS report contract
- schema/validator
- input builder
- provider routing
- motivacijski drajveri
- moguće tačke frikcije
- menadžerske smjernice
- intervju pitanja
- onboarding preporuke

**Out of scope:**
- composite HR report
- hiring decision score
- full role/job context model

**Acceptance criteria:**
- MWMS HR report generiše se samo za audience = hr
- participant MWMS report ostaje odvojen
- report koristi deterministic MWMS dimension_scores kao input
- AI ne mijenja score/band
- report daje HR hipoteze i preporuke, ne presude

**Completion note:**  
Završeno kroz šest uskih slice-ova: MWMS HR V1 contract/schema/validator, deterministic HR input builder iz MWMS dimension_scores, score/band/label mutation checks, mock provider generation, runtime union wiring, OpenAI provider routing, prompt package wiring, renderer/display adapter, capability activation, worker processing support i generic dashboard/status/recovery ponašanje. MWMS HR lane sada je active za audience='hr', report_type='individual' i source_type='single_test'. Prompt activation je verifikovan nakon standardnog import:assessment-package za assessment-packages/mwms_v1; DB prompt mwms_hr_report_v1 je aktivan u verziji v1, sa bs i hr lokalizacijama. Real Supabase lifecycle smoke je prošao na completed MWMS attemptu: completed MWMS attempt → queued HR report → worker claim/process → ready snapshot → HR static render. Real OpenAI smoke je prošao sa modelom gpt-5.4, a report_snapshot je validiran kao mwms_hr_report_v1 uz expectedInput score/band/label mutation checks. Scoring, MWMS participant report behavior, DB schema, composite report i assessment-level model nisu mijenjani.

---

### P1 — Non-blocking autosave za candidate IPIP/MWMS Likert flow

**Status:** Završeno  
**Kategorija:** Assessment UX / Persistence / Candidate flow

**Problem / context:**  
Trenutni assessment answer persistence je DB-first i blocking. Nakon klika na odgovor aplikacija čeka persistSelections/saveAction prije prelaska na sljedeće pitanje, što može usporiti korisnika 1–2 sekunde po pitanju. Kod IPIP/MWMS Likert flow-a to značajno narušava osjećaj brzog, fokusiranog rješavanja testa.

**Scope:**
- samo candidate protected run flow `/app/attempts/[attemptId]/run`
- samo single-choice/Likert auto-advance flow
- primarno IPIP i MWMS
- React state kao immediate UI truth
- localStorage pending queue po attemptId, key `assessment-pending:<attemptId>`
- background flush prema postojećem save action payload formatu
- debounce/batch save
- hydration merge: server initialSelections + local pending queue, gdje pending pobjeđuje
- final submit mora obavezno flushati pending queue prije completion/scoringa
- clear local queue nakon uspješnog completiona

**Out of scope:**
- SAFRAN step flow
- numeric/text/multiple_choice non-blocking save
- HR run flow
- scoring
- report generation
- DB schema/migracije
- service worker
- IndexedDB
- dashboard progress refactor
- worker/report pipeline

**Acceptance criteria:**
- IPIP/MWMS single-choice klik odmah prelazi na sljedeće pitanje bez čekanja DB save-a
- odgovor se odmah upisuje u React state i localStorage queue
- background flush uspješno persista pending odgovore
- failed flush ostavlja queue i prikazuje diskretan sync status
- refresh koristi merged server + pending selections state
- final submit blokira completion ako pending queue nije uspješno flushan
- scoring i report generation i dalje rade nad DB truth nakon final flush-a
- SAFRAN i HR run flow ostaju nepromijenjeni u prvom slice-u

**Completion note:**  
Završeno kroz candidate-only non-blocking autosave slice za IPIP/MWMS Likert auto-advance flow u protected candidate run kontekstu. Klik na eligible Likert odgovor sada odmah ažurira React state, upisuje pending odgovor u `localStorage` queue `assessment-pending:<attemptId>` i prelazi na sljedeće pitanje bez čekanja DB save-a. Background flush koristi postojeći protected save action payload format, refresh merge-a server `initialSelections` sa pending lokalnim odgovorima, a pending lokalni odgovor pobjeđuje za isti `questionId`. Final submit radi blocking flush pending queue-a prije completion/scoringa i prekida completion ako flush ne uspije. Nakon uspješnog completiona queue se čisti. SAFRAN, HR flow, scoring, report pipeline i DB schema nisu mijenjani. `npm run typecheck` i `node scripts/test-pending-autosave.cjs` prolaze; ručni browser smoke je potvrdio brži UI i očuvanje odgovora nakon refresha. Playwright protected-resume spec je dodat, ali lokalno je ostao blokiran `config.webServer` problemom prije izvršavanja spec-a.

---

### P2 — SAFRAN participant domain copy polish

**Status:** Završeno  
**Kategorija:** SAFRAN / Candidate report / Copy

**Problem / context:**  
U SAFRAN participant reportu opisi za verbalni, figuralni i numerički rezultat počinjali su previše slično i djelovali šablonski. Trebalo ih je učiniti prirodnijim, malo bogatijim i korisnijim za kandidata.

**Completion note:**  
Završeno kroz controlled copy helper u `lib/assessment/safran-participant-report-display.ts` i test `scripts/test-safran-participant-report-display.cjs`. Verbalni, figuralni i numerički opisi u “Pregled po oblastima” sada ne dolaze direktno iz starog šablonskog/AI domain teksta u prikazu, nego iz kontrolisanog display sloja. Score, band, layout, HR report, provider routing, promptovi, baza i attempt_reports pipeline nisu mijenjani. Postojeći AI snapshot može i dalje sadržavati stari domain tekst, ali UI koristi controlled copy pri renderovanju.

---

### P1 — Composite HR report data model decision

**Status:** Planirano  
**Kategorija:** Architecture / HR report storage

**Problem / context:**  
Audit je pokazao da je attempt_reports upotrebljiv za single-test HR reportove, ali composite HR report nema prirodan jedan attempt_id. Privremeni bridge kroz attempt_reports je moguć, ali semantički slab.

**Scope:**
- procijeniti attempt_reports bridge opciju
- procijeniti novu assessment_reports tabelu
- procijeniti potrebu za assessment_assignment / assessment_assignment_attempts modelom
- definisati storage ownership za composite HR report
- definisati lifecycle za composite report readiness/generation/retry
- definisati minimalni MVP model i dugoročni model

**Out of scope:**
- implementacija composite reporta
- SAFRAN/MWMS HR report implementation
- HR dashboard redesign

**Acceptance criteria:**
- donesena je jasna odluka o storage modelu za composite HR report
- odluka uključuje tradeoffe
- odluka ne veže dugoročno composite report za nasumični attempt bez eksplicitne racionalizacije
- nakon odluke može se pisati implementation prompt za Composite HR report V1

**Completion note:**  
Donesena je odluka da se Composite HR report ne sprema u `attempt_reports`, jer composite ne pripada prirodno jednom `attempt_id`. `attempt_reports` ostaje za single-test participant/HR reportove. Kao prvi assessment-level ownership compatibility slice uvedene su tabele `assessment_assignments` i `assessment_assignment_attempts`. HR standard battery create flow sada kreira assessment assignment ciklus i linkuje samo attempts koji su stvarno novokreirani u tom flow-u. Existing completed attempts i dalje blokiraju kreiranje novog praznog attempta za isti test dok dashboard ostaje attempt-based. Historical completed attempts se ne linkuju u novi assignment. Prethodni active standard_battery assignment se abandonuje, a novi assignment se cleanup-uje u `cancelled` ako flow pukne nakon njegovog kreiranja. `assessment_reports`, Composite HR report generation, scoring, report pipeline, `attempt_reports` i dashboard read path nisu mijenjani. Fresh attempts za već completed testove i puni assignment-first dashboard model ostaju budući task.

---

### P1 — Assessment assignment ownership za standard battery

**Status:** Završeno  
**Kategorija:** Architecture / Assessment ownership / Standard battery

**Problem / context:**  
Standardna procjena kandidata se ranije implicitno modelirala kao skup IPIP/SAFRAN/MWMS attemptova bez parent entiteta. To je bilo dovoljno za single-test reportove, ali nije dobar temelj za Composite HR report jer composite ne pripada jednom attemptu. Trebao je minimalni assessment-level ownership sloj koji uvodi procjenski ciklus bez prebacivanja dashboarda i report pipeline-a na novi model u istom slice-u.

**Scope:**
- dodati `assessment_assignments`
- dodati `assessment_assignment_attempts`
- dodati helper sloj za kreiranje standard battery assignmenta i linkova
- povezati HR standard battery create flow sa assignment ownership modelom
- linkovati samo attempts koji su stvarno novokreirani u tom flow-u
- zadržati existing completed attempt guard dok dashboard ostaje attempt-based
- ne raditi historical backfill
- ne uvoditi `assessment_reports`
- ne implementirati Composite HR report
- ne mijenjati `attempt_reports`, scoring, report pipeline ili dashboard read path

**Acceptance criteria:**
- HR standard battery create flow kreira `assessment_assignments` red za novi standard_battery ciklus
- novokreirani attempts se linkuju u `assessment_assignment_attempts`
- existing completed attempts se ne linkuju u novi assignment
- existing completed attempts i dalje blokiraju kreiranje novog praznog attempta za isti test u ovom compatibility slice-u
- prethodni active standard_battery assignment prelazi u `abandoned`
- ako flow pukne nakon kreiranja assignmenta, novi assignment se označava kao `cancelled`
- dashboard i single-test reportovi nastavljaju raditi attempt-based
- model ne pretpostavlja tačno tri testa i ostavlja prostor za budući team-fit/DATCH test

**Completion note:**  
Završeno kao prvi assessment-level ownership compatibility slice. Dodane su migracije za `assessment_assignments` i `assessment_assignment_attempts`, uveden je `lib/assessment/assignments.ts`, a HR standard battery create flow sada kreira parent assignment i linkuje samo novokreirane attempts. Existing completed attempts se ne reuse-aju kao linkovi u novi assignment i i dalje blokiraju kreiranje novog praznog attempta za isti test dok dashboard ostaje attempt-based. Prethodni active assignment se abandonuje, a novi assignment se cleanup-uje u `cancelled` ako flow pukne nakon njegovog kreiranja. `attempt_reports`, `assessment_reports`, Composite HR report generation, scoring, report pipeline i dashboard read path nisu mijenjani. `npm run typecheck`, `node scripts/test-assessment-assignments.cjs`, `node scripts/test-standard-assessment-battery.cjs` i `node scripts/test-attempt-lifecycle.cjs` prolaze.

### P1 — Manual composite generate/retry action za assessment_reports

**Status:** Završeno  
**Kategorija:** Composite HR report / Queue lifecycle / HR dashboard

**Problem / context:**  
Nakon uvođenja `assessment_reports` storage-a i composite readiness card-a, HR UI je mogao prikazati da je kompozitni izvještaj spreman za generisanje ili da je prethodno generisanje palo, ali nije postojala kontrolisana akcija koja kreira ili resetuje assessment-level report artefakt u `queued` stanje. Trebao je mali queue lifecycle slice prije bilo kakve AI generacije ili worker obrade.

**Scope:**
- dodati manual generate action za `ready_to_generate` composite card state
- dodati retry action za `failed` composite card state
- kreirati `assessment_reports` row u `queued` statusu kada readiness guard prođe
- resetovati postojeći failed `assessment_reports` row nazad u `queued`
- server-side ponovo provjeriti assignment ownership i readiness
- spriječiti duplikate za postojeće queued/processing/ready row-ove
- dodati aktivne CTA akcije samo za dozvoljena stanja
- dodati minimalne success/error poruke na HR participant reports page-u
- ne uvoditi worker
- ne uvoditi AI generation
- ne uvoditi input builder, provider routing, schema/validator ili renderer
- ne mijenjati `attempt_reports`, scoring, report pipeline ili single-test HR reportove

**Acceptance criteria:**
- `ready_to_generate` prikazuje aktivan CTA “Generiši kompozitni HR izvještaj”
- generate action kreira `assessment_reports` row sa `report_status = 'queued'`
- `failed` prikazuje aktivan CTA “Ponovo generiši”
- retry action resetuje postojeći failed row nazad u `queued`
- `queued`, `processing` i `ready` nemaju aktivan generate/retry CTA
- `incomplete` i `no_assignment` nemaju aktivnu akciju
- generate/retry ne rade ako readiness nije ready
- readiness se provjerava server-side, ne vjeruje se samo UI state-u
- historical completed attempts se ne koriste kao fallback
- generate ne kreira duplikat ako composite row već postoji
- retry resetuje samo failed row
- raw `returnPath` iz forme se ne koristi za finalni redirect nakon participant validacije
- queued row se još ne obrađuje jer worker nije u ovom slice-u

**Completion note:**  
Završeno kroz manual queue lifecycle za `assessment_reports`. HR sada iz `ready_to_generate` stanja može kreirati assessment-level composite report artefakt u `queued` statusu, a iz `failed` stanja može resetovati postojeći failed row nazad u `queued`. Akcije ponovo provjeravaju organization/participant ownership, latest active standard_battery assignment i composite readiness server-side. Readiness ostaje strogo vezan za linked attempts iz istog assignment ciklusa; historical completed attempts se ne koriste kao fallback. `queued`, `processing` i `ready` ne dobijaju pogrešnu akciju, a `incomplete` i `no_assignment` ostaju bez aktivnog CTA-a. Redirect handling je zategnut tako da se nakon validacije koristi canonical participant reports path, a ne raw `returnPath` iz forme. AI generation, worker, composite input builder, schema/validator, provider routing, renderer route, `attempt_reports`, scoring i report pipeline nisu mijenjani. `npm run typecheck`, `node scripts/test-assessment-reports.cjs`, `node scripts/test-hr-candidate-assessment-detail-model.cjs`, `node scripts/test-assessment-assignments.cjs`, `node scripts/test-report-capabilities.cjs` i `node scripts/test-hr-report-recovery.cjs` prolaze.

### P1 — Composite HR report contract/schema/provider

**Status:** Završeno  
**Kategorija:** Composite HR report / Contract / Mock provider / Worker integration

**Problem / context:**  
Nakon uvođenja `assessment_reports`, manual queue flow-a, composite input buildera i assessment report worker path-a, worker je mogao izgraditi `input_snapshot`, ali nije postojao stabilan `report_snapshot` contract, runtime validator ni provider koji proizvodi validan Composite HR report snapshot. Prije OpenAI integracije i renderera bilo je potrebno zaključati shape reporta i dokazati da worker može završiti assessment-level composite row kao `ready` kroz kontrolisan mock provider.

**Scope:**
- dodati Composite HR report V1 contract
- dodati runtime validator za `report_snapshot`
- dodati deterministic mock provider
- mock provider koristi `CompositeHrInputSnapshot`
- mock provider proizvodi HR-facing `report_snapshot`
- integrisati mock provider u assessment report worker
- worker validira `report_snapshot` prije ready statusa
- worker upisuje `input_snapshot` i validan `report_snapshot`
- worker postavlja `generated_at` samo kada postoji validan `report_snapshot`
- dodati failure code `COMPOSITE_REPORT_VALIDATION_FAILED`
- zadržati `COMPOSITE_INPUT_NOT_READY`
- ne dodavati OpenAI provider
- ne dodavati renderer
- ne mijenjati `attempt_reports`
- ne mijenjati scoring ili single-test report flow

**Acceptance criteria:**
- postoji `lib/assessment/composite-hr-report-contract.ts`
- postoji Composite HR report V1 TypeScript contract
- postoji runtime validator
- validator odbija pogrešan contractVersion, audience, reportType, sourceType i prazan sourceAttemptIds
- postoji `lib/assessment/composite-hr-report-provider-mock.ts`
- mock provider generiše validan `report_snapshot`
- mock provider koristi inputSnapshot kao source
- sourceAttemptIds dolaze iz inputSnapshot.sourceAttempts
- mock provider ne zove OpenAI
- mock provider ne koristi `attempt_reports`
- mock provider ne mijenja score vrijednosti
- mock provider ne izmišlja source attempts
- mock provider ne koristi hire/no-hire ili fit-score jezik
- worker može queued row prebaciti u `ready`
- worker upisuje `input_snapshot`
- worker upisuje validan `report_snapshot`
- worker postavlja `generated_at` tek nakon validacije
- input-not-ready failure i dalje radi
- invalid provider output završava kao `COMPOSITE_REPORT_VALIDATION_FAILED`
- postojeći attempt report worker nije refaktorisan
- testovi prolaze

**Completion note:**  
Završeno kroz Composite HR report V1 contract, runtime validator i deterministic mock provider. Dodani su `lib/assessment/composite-hr-report-contract.ts`, `lib/assessment/composite-hr-report-provider-mock.ts` i `scripts/test-composite-hr-report-contract.cjs`, a `lib/assessment/assessment-report-worker.ts` je ažuriran tako da queued composite assessment report može proći kroz `processing`, izgraditi `input_snapshot`, dobiti validan mock `report_snapshot`, proći runtime validaciju i završiti kao `ready`. `generated_at` se postavlja tek kada postoji validan `report_snapshot`. Ako input builder nije spreman, worker završava sa `COMPOSITE_INPUT_NOT_READY`; ako provider output ne prođe validaciju, završava sa `COMPOSITE_REPORT_VALIDATION_FAILED`. OpenAI provider nije dodan, renderer nije dodan, `attempt_reports` nije mijenjan, postojeći attempt worker nije refaktorisan i scoring nije mijenjan. Testovi potvrđuju contract shape, mock provider output, forbidden phrasing guardrails i worker ready path.

### P1 — OpenAI provider za Composite HR report

**Status:** Završeno  
**Kategorija:** Composite HR report / OpenAI provider / AI generation

**Problem / context:**  
Nakon uvođenja Composite HR report contracta, runtime validatora, mock providera, assessment report workera i renderer-a, sistem je mogao generisati i prikazati validan mock-backed `report_snapshot`, ali nije imao pravi OpenAI provider. Trebao je provider koji koristi isti deterministic `CompositeHrInputSnapshot`, proizvodi isti runtime-validirani `CompositeHrReportSnapshot` contract i ostaje unutar postojećih source-of-truth guardraila.

**Scope:**
- dodati OpenAI provider za Composite HR report
- koristiti `CompositeHrInputSnapshot` kao jedini source
- proizvoditi `CompositeHrReportSnapshot` po postojećem contractu
- koristiti postojeći runtime validator kao finalnu kapiju
- dodati minimalni provider selector
- zadržati mock provider kao default/dev/test provider
- koristiti postojeći env standard `AI_REPORT_PROVIDER`, `AI_REPORT_MODEL`, `OPENAI_API_KEY`
- integrisati provider selector u assessment report worker
- upisivati generator metadata prema stvarnom provideru
- testirati OpenAI provider path offline kroz fake structured response
- ne mijenjati renderer shape
- ne mijenjati scoring
- ne mijenjati `attempt_reports`
- ne mijenjati single-test report pipeline
- ne uvoditi assignment-first dashboard
- ne dodavati PDF/export

**Acceptance criteria:**
- postoji `lib/assessment/composite-hr-report-provider-openai.ts`
- postoji minimalni provider selector
- default provider je mock
- OpenAI path se koristi samo kada env kaže `AI_REPORT_PROVIDER=openai`
- provider koristi samo `CompositeHrInputSnapshot`
- provider ne čita `attempt_reports`
- provider ne koristi single-test AI report narrative
- provider ne mijenja source attempts
- provider ne mijenja score/band vrijednosti
- provider output prolazi `validateCompositeHrReportSnapshot`
- immutable source polja se provjeravaju
- forbidden phrasing se odbija
- worker koristi provider selector
- worker ready path i dalje zahtijeva validan `report_snapshot`
- invalid provider output završava kao `COMPOSITE_REPORT_VALIDATION_FAILED`
- mock worker path i dalje prolazi
- renderer shape nije mijenjan
- testovi prolaze

**Completion note:**  
Završeno kroz OpenAI provider slice za Composite HR report. Dodani su `lib/assessment/composite-hr-report-provider-openai.ts`, `lib/assessment/composite-hr-report-provider.ts` i `scripts/test-composite-hr-report-provider-openai.cjs`, a assessment report worker je ažuriran da koristi provider selector umjesto direktnog mock provider poziva. Provider selector koristi postojeći env standard `AI_REPORT_PROVIDER=mock|openai`, `AI_REPORT_MODEL` i `OPENAI_API_KEY`, uz `mock` kao default. OpenAI provider prima samo `CompositeHrInputSnapshot`, proizvodi `CompositeHrReportSnapshot` po postojećem contractu, validira output runtime validatorom i dodatno provjerava immutable source polja. Provider ne koristi `attempt_reports`, ne koristi single-test AI report narrative, ne mijenja score/band/source vrijednosti i odbija forbidden phrasing kao što su hire/no-hire, “zaposliti”, “ne zaposliti”, “fit score” i “idealni kandidat”. Worker sada zapisuje generator metadata prema odabranom provideru i ne završava kao ready ako provider output ne prođe validaciju. Renderer shape, scoring, `attempt_reports`, single-test report pipeline i dashboard model nisu mijenjani. Real OpenAI smoke nije pokrenut u ovom tasku; offline provider test pokriva OpenAI path kroz fake structured response.

### P1 — Composite HR report V1

**Status:** Aktivno / Mock + OpenAI runtime potvrđen  
**Kategorija:** Product / AI report

**Problem / context:**  
Composite HR report je glavni B2B artefakt Deep Profile-a. On povezuje IPIP, SAFRAN i MWMS u jedan HR-facing profil za selekciju, intervju, onboarding i menadžersku podršku. Core pipeline sada postoji u kodu, uključujući storage, readiness, queue akcije, input builder, worker, contract, mock provider, renderer i OpenAI provider. Mock-backed i OpenAI DB-backed runtime smoke su potvrđeni, uključujući language QA guardrails, reviewer pass i route/access potvrdu na realnom assessment_reports lifecycle-u.

**Scope:**
- status UX
- provjera validatora i HR copy kvaliteta na stvarnom OpenAI outputu
- production orchestration odluka nakon potvrđenog runtime stanja
- eventualni provider-copy polish ako budući demo/smoke output pokaže generičke ili previše oprezne formulacije
- watchout wording/UI polish kao zaseban renderer UX/copy task
- guardrails bez hire/no-hire odluka
- locale-aware design, MVP bs-only

**Out of scope:**
- team-fit report
- role-specific benchmark
- organization-specific success model
- hiring recommendation score
- PDF/export

**Acceptance criteria:**
- mock output prolazi end-to-end provjeru kroz postojeći contract i validator
- OpenAI output end-to-end je potvrđen nakon language QA guardrails sloja
- report i dalje koristi deterministic rezultate kao source
- status UX ostaje jasan za ready/queued/processing/failed
- HR copy je prošao language QA/reviewer/forbidden phrase scan na realnom OpenAI outputu
- Supabase migracije/schema cache su potvrđeni za composite tabele
- DB-backed smoke prolazi bez schema cache blokera
- report je audience = hr
- report je locale-aware u strukturi, iako MVP content ostaje bs

### P1 — DB-backed end-to-end smoke za Composite HR report

**Status:** Završeno / Mock + OpenAI potvrđeni  
**Kategorija:** Composite HR report / Runtime smoke / QA

**Problem / context:**  
Nakon što su composite tabele postale vidljive runtime Supabase bazi, trebalo je potvrditi da kompletan Composite HR report flow radi na stvarnom DB-u, a ne samo kroz lokalne unit/script testove. Prvi pokušaj smoke-a završio je kao `DATA_NOT_READY` jer nije postojao active `standard_battery` assignment sa tri linked completed required attempts. Zbog toga je urađen kontrolisani backfill nad postojećim completed IPIP/SAFRAN/MWMS attemptima istog kandidata i organizacije.

**Scope:**
- pronaći postojećeg kandidata sa completed IPIP, SAFRAN i MWMS attemptima
- ne koristiti historical fallback u aplikaciji
- napraviti controlled backfill u novi active `standard_battery` assignment
- linkovati sva tri completed attempta kroz `assessment_assignment_attempts`
- označiti ih kao `required_for_composite = true`
- kreirati stvarni `assessment_reports` row u `queued`
- pokrenuti worker sa mock providerom
- potvrditi `queued → processing → ready`
- potvrditi `input_snapshot`, `report_snapshot`, `generated_at` i null failure fields
- otvoriti HR renderer route
- potvrditi organization access guard

**Acceptance criteria:**
- postoji active `standard_battery` assignment sa 3 linked completed required attempts
- postoji queued composite `assessment_reports` row
- worker može claim/process queued row
- finalni `report_status = ready`
- `input_snapshot` postoji
- `report_snapshot` postoji
- `generated_at` postoji
- `failure_code` i `failure_reason` su null
- renderer route se otvara za HR usera koji ima membership u organizaciji
- 404 za pogrešan HR user je potvrđen kao access/org guard, ne route bug
- smoke koristi mock provider
- nema `attempt_reports` fallbacka
- nema historical fallbacka u aplikaciji

**Completion note:**  
Mock-backed DB smoke je ranije potvrđen kroz stvarni `assessment_reports` lifecycle. OpenAI DB-backed smoke je sada dodatno potvrđen na istom realnom `assessment_report` targetu nakon language QA / reviewer stabilization sloja. Postojeći failed row je kontrolisano requeue-an bez kreiranja novog row-a, worker je prošao `queued → processing → ready` sa `AI_REPORT_PROVIDER=openai` i `AI_REPORT_MODEL=gpt-5.4`, te su persisted `input_snapshot`, `report_snapshot`, `generated_at` i `completed_at`. `failure_code` i `failure_reason` su null. Persisted `report_snapshot` prolazi Composite HR contract validator, source attempt IDs odgovaraju expected IPIP/SAFRAN/MWMS attempts, shared language QA prolazi, reviewer pass je prošao po provider execution path-u, forbidden phrase scan je čist, a HR route `/dashboard/assessment-reports/[reportId]` prikazuje ready Composite HR report uz validan organization access guard. Production worker/report orchestration ostaje zaseban otvoreni task.

### P1 — Composite HR report V1 QA audit / copy polish

**Status:** Završeno / Runtime blocker zatvoren  
**Kategorija:** Composite HR report / QA / UX copy

**Problem / context:**  
Nakon uvođenja Composite HR report storage-a, readiness-a, queue akcija, input buildera, workera, contracta, mock providera, renderera i OpenAI providera, bilo je potrebno provjeriti da li je V1 flow funkcionalno stabilan, da li postoje code-level blockeri i da li HR-facing copy ima očigledan tehnički ili stale wording. QA korak je trebao ostati fokusiran: bez nove arhitekture i bez većeg refaktora.

**Scope:**
- provjeriti HR composite card state i CTA pravila
- provjeriti generate/retry guardrails
- provjeriti worker mock path
- provjeriti renderer path i runtime validator
- provjeriti OpenAI provider path kroz fixture smoke ako je moguće
- provjeriti forbidden wording guardrails
- uraditi minimalni HR-facing copy cleanup
- ne mijenjati provider, worker, contract/schema, scoring ili `attempt_reports`
- zabilježiti runtime/DB smoke blocker ako postoji

**Acceptance criteria:**
- HR card state mapping i CTA pravila ostaju ispravni
- `ready_to_generate`, `failed` i `ready` imaju očekivane CTA-e
- `queued`, `processing`, `incomplete` i `no_assignment` nemaju pogrešnu aktivnu akciju
- generate/retry pravila i server-side readiness guardrails ostaju ispravni
- mock worker path lokalno prolazi kroz testove
- OpenAI provider fixture smoke prolazi runtime validator i forbidden wording assertion
- renderer ne prikazuje invalid/non-ready snapshot kao ready
- user-facing copy ne koristi “snapshot”, “renderer”, “generator metadata” ili “assessment-level HR report”
- nema hire/no-hire, fit score ili automatske odluke
- DB-backed smoke blocker je jasno zabilježen ako migracije/schema cache nisu spremni

**Completion note:**  
Završen je Composite HR V1 QA audit/copy polish. Lokalni test set prolazi i nema code-level blockera u contract/provider/renderer sloju. OpenAI provider smoke nad fixture inputom prošao je runtime validator i forbidden-wording assertion. Urađen je minimalni HR-facing copy cleanup u `lib/dashboard/hr-candidate-assessment.ts` i `components/dashboard/composite-hr-report-view.tsx`: uklonjen je stale tekst o generate/retry akcijama koje “dolaze u sljedećem koraku”, a tehnički izrazi poput “snapshot”, “generator metadata”, “linked attemptova” i “ASSESSMENT-LEVEL HR REPORT” zamijenjeni su korisnički razumljivijim formulacijama. Logika, provider, worker, contract/schema, scoring i `attempt_reports` nisu mijenjani. Full DB-backed worker smoke sa stvarnim queued reportom još nije potvrđen u ovom tasku; runtime schema/cache blocker za `public.assessment_reports` je sada zatvoren.

### P1 — Composite HR report V1 final copy/UX polish

**Status:** Završeno / Mock-backed renderer polish  
**Kategorija:** Composite HR report / UX copy / Renderer polish

**Problem / context:**  
Nakon uspješnog DB-backed mock smoke-a, Composite HR report renderer je radio i prikazivao report, ali je u source/traceability dijelu još prikazivao tehničke i debug izraze. HR korisnik je mogao vidjeti raw provider labelu, raw test slugove, “3 povezana pokušaja”, raw assignment ID kao dominantan value i pojmove poput “snapshot” ili “source attempts”. Bilo je potrebno zadržati traceability princip, ali prikaz učiniti HR-facing i manje tehničkim.

**Scope:**
- polirati Composite HR report renderer display layer
- humanizovati source/traceability blok
- zamijeniti raw test slugove HR-facing nazivima
- zamijeniti evidence chip labels HR-facing nazivima
- ukloniti raw “mock / v1” iz glavnog prikaza
- zamijeniti “3 povezana pokušaja” sa “3 završene procjene”
- ublažiti raw assignment UUID kao sekundarni ID
- dodati uski sanitizer za očigledne tehničke izraze
- ne mijenjati provider, worker, contract/schema, scoring, assessment lifecycle, route/access guard ili `attempt_reports`

**Acceptance criteria:**
- source blok više ne izgleda kao debug prikaz
- glavni source blok koristi HR-facing copy
- raw test slugovi se ne prikazuju u glavnim source/test chips
- raw provider “mock / v1” se ne prikazuje kao glavni visible value
- “3 povezana pokušaja” je zamijenjeno HR-facing tekstom
- “snapshot”, “renderer”, “generator metadata”, “linked attemptova” i “source attempts” nisu vidljivi u glavnom HR UI-u
- report i dalje prikazuje sve iste sekcije
- provider nije mijenjan
- worker nije mijenjan
- contract nije mijenjan
- route/access guard nije mijenjan
- testovi prolaze

**Completion note:**  
Završen je Composite HR report V1 final copy/UX polish nad rendererom. Promjene su ograničene na `components/dashboard/composite-hr-report-view.tsx` i `scripts/test-composite-hr-report-renderer.cjs`. U sekciji “Integrisana interpretacija” uklonjen je nepotrebni lijevi marker/border iz insight panela, unutrašnji paneli su vizuelno smireni i bolje balansirani, a “Dokazi iz procjena” su spušteni na sekundarni vizuelni nivo (manji naslov/gapovi, mirniji border/background i diskretniji chipovi). “Ugodnost” / `AGREEABLENESS` je uveden kao display-only mapping na “Spremnost na saradnju” (duži copy) i “Saradljivost” (kraći evidence label). Provider, worker, contract/schema, scoring, assessment lifecycle, route/access guard i `attempt_reports` nisu mijenjani. Testovi prolaze.

### P1 — OpenAI provider language QA guardrails za Composite HR report

**Status:** Planirano  
**Kategorija:** Composite HR report / OpenAI provider / Language QA

**Problem / context:**  
Composite HR report renderer je očišćen od dijela tehničkog jezika, ali provider output je mogao proizvesti neprirodne BHS formulacije poput “rokovi visoki”. Renderer ne treba postati opći lektor jer nije moguće predvidjeti sve moguće jezičke greške AI outputa. Kvalitet jezika je trebalo kontrolisati u provider sloju: prompt, glossary, AI self-review/reviewer pass i provider-level validation gate.

**Scope:**
- dodati BHS HR language quality rules u OpenAI provider prompt
- dodati terminološki glossary za ključne HR/psihometrijske pojmove
- zabraniti neprirodne kalkove i poznate loše fraze
- dodati self-review/reviewer pass prije prihvatanja outputa
- zadržati runtime validator kao finalnu contract kapiju
- ne mijenjati report contract shape
- ne pretvarati renderer u generički lektor
- ne mijenjati scoring, worker, route/access guard ili assessment lifecycle

**Acceptance criteria:**
- OpenAI provider prompt ima jasna BHS HR language rules
- OpenAI provider ima glossary za termine kao AGREEABLENESS, deadline pressure, high standards, performance pressure
- output ne sadrži “rokovi visoki”
- output ne koristi “ugodnost” ili “saradljivost” za AGREEABLENESS
- output ne sadrži hire/no-hire ili fit-score jezik
- provider ima self-review/reviewer pass kao quality gate
- output koji padne language QA/reviewer ne završava kao finalni ready output
- renderer ostaje display layer, ne generički rewrite engine
- testovi pokrivaju poznate loše fraze, glossary mapping i reviewer reject path

**Completion note:**  
Završeno kroz shared BHS report language-quality helper i Composite HR OpenAI provider integraciju. Uveden je centralni validator sa core pravilima, Composite HR profilom, glossary smjernicama, prompt constants, provider-level language QA gate-om i kontrolisanom greškom kada output padne. Dodatno je uveden self-review/reviewer pass kao drugi structured OpenAI call prije finalnog prihvatanja outputa. Terminološki je zaključano da AGREEABLENESS kao label mora biti “Spremnost na saradnju”; “Ugodnost” i “Saradljivost” su zabranjeni, dok je “Saradnja” dozvoljena samo kao obična narativna riječ, ne kao label-like zamjena za AGREEABLENESS. Stabilizovani su feminine agreement guardrail, sourceSnapshot scoping i ASCII/diacritics ponašanje. Završni OpenAI DB-backed smoke potvrdio je da output prolazi contract validator, immutable source checks, shared language QA, reviewer pass i forbidden phrase scan.

### P2 — Composite HR report watchout wording/UI polish

**Status:** Planirano  
**Kategorija:** Composite HR report / UX copy / Renderer polish

**Problem / context:**  
Na Composite HR report ekranu “Tačka opreza” i “Tačke opreza” djeluju rogobatno i teško u BHS HR kontekstu. Vizuelni tretman oprez kartica je dosta dominantan, a wording može zvučati grubo. Potrebno je pronaći prirodniji naziv i smireniji UI tretman.

**Moguće alternative:**
- Na šta obratiti pažnju
- Šta dodatno provjeriti
- Signali za provjeru
- Oprez pri interpretaciji
- Područja za dodatnu provjeru
- Mogući rizici u radu

**Acceptance criteria:**
- izabrati prirodniji wording za singular/plural watchout blokove
- uskladiti summary watchout i list watchout terminologiju
- smanjiti rogobatan dojam žućkastih oprez kartica ako je potrebno
- ne mijenjati provider/contract/scoring
- ne miješati sa OpenAI language QA taskom

---

### P1 — Oblik obraćanja: muški/ženski jezički oblik

**Status:** Discovery / Spec spreman  
**Kategorija:** UX / i18n / AI promptovi / Participant experience

**Problem / context:**  
Deep Profile kandidat-facing iskustvo većinom koristi bosanski jezik i često koristi direktnu “ti” formu. Kako participant reportovi i dio UI copyja postaju prirodniji i bogatiji, raste rizik da rečenice zvuče gramatički neprirodno ako sistem nema kontrolisanu preferencu za jezički oblik obraćanja. Ova preferenca ne smije biti tretirana kao identitetska ili scoring dimenzija; treba služiti samo za prirodniju formulaciju pitanja, pomoćnog teksta i participant report narativa. Postojeći runtime već ima dobar obrazac za `locale`: app-level cookie, `attempts.locale`, locale-aware input builderi, `prompt_version_localizations`, prompt selection i snapshot report outputi. Discovery cilj je da addressing form slijedi isti obrazac: participant-level preference + attempt/report snapshot, bez retroaktivnog mijenjanja starih artefakata.

**Read-only audit nalaz:**
- `app/actions/auth.ts` i [app-locale.ts](/home/naima/code/ai-psychometric-analyst-1/lib/auth/app-locale.ts) trenutno čuvaju samo app locale cookie; ne postoji zasebna user preference za obraćanje.
- Candidate attempt creation i standard battery create flow već imaju obrazac za upis preference u `attempts.locale` kroz [app/(protected)/app/actions.ts](/home/naima/code/ai-psychometric-analyst-1/app/(protected)/app/actions.ts) i [participants.ts](/home/naima/code/ai-psychometric-analyst-1/app/actions/participants.ts).
- [locale.ts](/home/naima/code/ai-psychometric-analyst-1/lib/assessment/locale.ts) i [reports.ts](/home/naima/code/ai-psychometric-analyst-1/lib/assessment/reports.ts) već implementiraju normalize/resolve/fallback obrazac za locale koji je dobar model i za addressing form resolver.
- Participant AI/report inputi već nose `locale`, ali ne nose addressing form:
  - [ipip-neo-120-participant-ai-input-v2.ts](/home/naima/code/ai-psychometric-analyst-1/lib/assessment/ipip-neo-120-participant-ai-input-v2.ts)
  - [mwms-participant-ai-input-v1.ts](/home/naima/code/ai-psychometric-analyst-1/lib/assessment/mwms-participant-ai-input-v1.ts)
  - [safran-participant-ai-report-v1.ts](/home/naima/code/ai-psychometric-analyst-1/lib/assessment/safran-participant-ai-report-v1.ts)
- [report-provider-openai.ts](/home/naima/code/ai-psychometric-analyst-1/lib/assessment/report-provider-openai.ts) već ima locale-aware prompt konstrukciju i participant-direct tone guardrails, ali nema adresni gramatički signal.
- DB schema trenutno nema addressing-form polje ni na `participants`, ni na `attempts`, ni u `attempt_reports` / `assessment_reports` snapshot kolonama; migracije pokazuju da je `locale` evoluirao upravo kroz model koji sada želimo ponoviti za addressing form.
- Candidate UX entry points su mapirani:
  - login: [page.tsx](/home/naima/code/ai-psychometric-analyst-1/app/login/page.tsx), [login-form.tsx](/home/naima/code/ai-psychometric-analyst-1/components/auth/login-form.tsx)
  - dashboard: [app/page.tsx](/home/naima/code/ai-psychometric-analyst-1/app/(protected)/app/page.tsx)
  - attempt intro/run/report: [attempt intro](/home/naima/code/ai-psychometric-analyst-1/app/(protected)/app/attempts/[attemptId]/page.tsx), [run](/home/naima/code/ai-psychometric-analyst-1/app/(protected)/app/attempts/[attemptId]/run/page.tsx), [report](/home/naima/code/ai-psychometric-analyst-1/app/(protected)/app/attempts/[attemptId]/report/page.tsx)
- Participant renderers već imaju mjesta sa direktnim obraćanjem i budućim rizikom gramatičkog neslaganja, posebno u [completed-assessment-summary.tsx](/home/naima/code/ai-psychometric-analyst-1/components/assessment/completed-assessment-summary.tsx), [safran-participant-report-display.ts](/home/naima/code/ai-psychometric-analyst-1/lib/assessment/safran-participant-report-display.ts) i MWMS/IPIP participant copy helperima.

**A) Product decision**

- UI naziv preference:
  - `Oblik obraćanja`
- Opcije u MVP-u:
  - `Muški oblik`
  - `Ženski oblik`
- Preporučena objašnjavajuća rečenica u modalu:
  - `Ovaj izbor koristimo samo da pitanja i izvještaji zvuče prirodnije. Ne utiče na rezultat procjene.`
- Šta eksplicitno ne pitamo:
  - ne pitamo `spol`
  - ne pitamo `rod`
  - ne pitamo `gender`
- Product pravilo:
  - izbor utiče samo na gramatičku formu participant-facing copyja i AI narativa
  - izbor ne utiče na scoring, interpretaciju, band, readiness, queue ili report status

**B) UX flow prijedlog**

- Preporuka za prvi prikaz:
  - mali obavezni modal pri prvom ulasku na candidate dashboard ili neposredno prije prvog testa, prije nego nastane prvi participant attempt
- Ne prikazivati:
  - tokom aktivnog testa
  - tokom report loading flow-a
  - usred resume flow-a
- Buduća promjena:
  - omogućiti kasniju promjenu u profile/settings zoni kada taj surface postoji
- Fallback ako preferenca nije postavljena:
  - prije prvog testa tražiti izbor kroz modal
  - ako historijski attempt/report postoji bez preference, koristiti controlled fallback `masculine` samo kao tehnički fallback u resolveru, ali to ne nuditi kao user-facing “default preporuku”
- Zašto ne tokom testa:
  - trenutni run flow je fokusiran i oslanja se na `attempt.locale`; novi obavezni modal usred rješavanja bi remetio tok i povećao rizik od nedosljednog snapshotovanja

**C) Data model prijedlog**

- Participant/user-level preference:
  - preporučeno ime polja: `addressing_form`
  - alternativno prihvatljivo: `grammatical_addressing_form`
  - preporuka je kraće `addressing_form`, jer je dovoljno jasno i lakše za šire korištenje kroz UI/input/snapshot slojeve
- Vrijednosti:
  - `masculine`
  - `feminine`
- Attempt-level snapshot:
  - preporučeno polje: `addressing_form_snapshot`
  - mjesto: `attempts` kolona ili `attempts.metadata` kao privremeni korak, ali preporuka za zdraviji model je eksplicitna kolona kada implementacija krene
- Report-level snapshot:
  - `input_snapshot.addressingForm`
  - i/ili `report_snapshot.meta.addressing_form_used`
- Zašto snapshot na attempt/report nivou:
  - participant može kasnije promijeniti preferencu
  - stari attempt i report moraju ostati gramatički stabilni i reproducibilni
  - prompt smoke i renderer regresije se lakše testiraju kada je korištena vrijednost upisana u artefakt
  - isti princip već važi za locale-aware report stabilnost

**D) Prompt/input impact**

- IPIP participant AI input V2:
  - dodati `addressing_form`
  - dopuniti `language_rules` ili sličan blok sa jasnim signalom koju gramatičku formu koristiti
- MWMS participant AI input:
  - dodati `addressing_form`
  - koristiti ga samo za formu obraćanja u summary/observations/reflection copyju
- SAFRAN participant AI input/report:
  - dodati `addressing_form`
  - primijeniti ga na participant-facing interpretaciju i next-step copy
- Budući composite participant report, ako ikada postoji:
  - treba naslijediti isti signal od starta
- Tvrdo pravilo za AI:
  - AI ne smije mijenjati score, band, interpretaciju, readiness ili zaključke na osnovu addressing form preference
  - addressing form smije uticati samo na gramatičku formu obraćanja

**E) Renderer/copy impact**

- Površine najvećeg rizika:
  - intro copy sa glagolima u prošlom vremenu i participima
  - SAFRAN participant display copy sa frazama poput `radio ili radila`, `imao ili imala`
  - MWMS participant copy helperi i safety net koji već ručno normalizuju “ti/tvoj” formu
  - IPIP participant AI V2 summary, work-style i reflection copy
  - completed report/loading summary ekrani sa direktnim obraćanjem kandidatu
- Preporuka:
  - ne pokušavati odmah “ispraviti svaku rečenicu”
  - prvo mapirati površine koje koriste eksplicitne glagolske oblike
  - gdje je moguće koristiti neutralniji copy, ali bez pretvaranja cijelog sistema u generički neutralni stil ako je cilj prirodniji jezik

**F) i18n impact**

- `bs`:
  - puni addressing-form signal potreban
- `hr`:
  - isti signal potreban; većina konstrukcija ima isti problem kao u `bs`
- `sr`:
  - isti signal potreban, uz napomenu da kasniji sr rendering može imati dodatne lokalne gramatičke razlike
- `en`:
  - može ignorisati vrijednost ili je tretirati kao neutralan no-op u većini rečenica
- Preporuka:
  - resolver i snapshot model neka budu locale-agnostic
  - copy/prompt sloj neka addressing form primjenjuje samo za `bs` / `hr` / `sr`

**G) Implementation slicing**

1. DB migration + types/constants
2. onboarding/pre-test modal
3. attempt snapshot
4. participant report AI input wiring
5. renderer/copy safety pass
6. tests
7. docs/todo update

**H) Test plan**

- preference resolver tests
  - normalize/validate/fallback za `masculine` / `feminine`
- DB snapshot tests
  - participant preference → attempt snapshot → report input snapshot
- participant report input builder tests
  - IPIP participant input
  - MWMS participant input
  - SAFRAN participant input
- provider prompt smoke
  - provider dobija isti score input uz različit addressing form i mijenja samo gramatičku formu
- renderer smoke
  - masculine path
  - feminine path
- fallback test kada preference nedostaje
  - historijski attempt/report bez addressing form

**I) Risks / anti-patterns**

- ne pitati korisnika za `spol`
- ne koristiti preferencu za scoring
- ne retroaktivno mijenjati stare report snapshotove
- ne uvoditi identitetsku dimenziju proizvoda izvan gramatičkog UI signala
- ne lomiti postojeće reporte dok addressing form nije snapshotovan
- ne širiti scope na puni personalization engine
- ne miješati ovu preferencu sa locale selectorom, iako obje trebaju sličan resolver/snapshot obrazac

**J) Recommended MVP decision**

- Naziv polja:
  - `addressing_form`
- Vrijednosti:
  - `masculine`
  - `feminine`
- Gdje prikazati modal:
  - pri prvom ulasku na candidate dashboard ili neposredno prije prvog testa, prije kreiranja prvog participant attempta
- Gdje snapshotovati:
  - participant-level preference kao source of truth
  - `attempt` snapshot za stabilnost execution konteksta
  - `input_snapshot` / `report_snapshot` za stabilnost report artefakta
- Šta se ne radi u MVP-u:
  - nema novih opcija osim `muški oblik` i `ženski oblik`
  - nema promjene scoringa
  - nema retroaktivnog rewrite-a starih reportova
  - nema širenja na HR reportove u prvom slice-u
  - nema spajanja sa full profile/settings sistemom prije nego settings surface stvarno postoji

### P1 — Supabase migration/schema cache verification za composite tabele

**Status:** Završeno / DB queued smoke još preostaje  
**Kategorija:** Infrastructure / Supabase / Composite runtime

**Problem / context:**  
Composite HR V1 code pipeline je postojao, ali DB-backed worker smoke nije mogao proći jer runtime Supabase/PostgREST nije vidio `public.assessment_reports`. Audit je pokazao da app `.env.local` cilja projekat `njczzzxmjwzjbtzwwsda`, dok je CLI ranije bio linkovan na drugi projekat. Dodatno, remote migration history je imao drift: stare tabele su postojale u bazi, ali migracije nisu bile upisane kao applied, dok composite tabele stvarno nisu postojale u runtime DB-u.

**Scope:**
- potvrditi pravi Supabase runtime project ref
- re-linkovati Supabase CLI na runtime projekat
- auditirati migration history drift
- ne pokretati `supabase db push` naslijepo
- konzervativno repair-ati samo migracije sa jakim DB dokazom
- ručno primijeniti tri composite migracije kroz Supabase SQL Editor
- potvrditi REST visibility za composite tabele
- označiti tri composite migracije kao applied
- pokrenuti worker smoke da potvrdi da schema cache/table visibility blocker više ne postoji

**Acceptance criteria:**
- CLI project ref odgovara `.env.local` runtime projectu
- `assessment_assignments` postoji i REST ga vidi
- `assessment_assignment_attempts` postoji i REST ga vidi
- `assessment_reports` postoji i REST ga vidi
- composite migracije su označene kao applied u remote migration history
- worker više ne pada sa PGRST205 / schema cache greškom
- `npm run process-assessment-report-jobs` uredno završava ako nema queued reporta
- uncertain stare migracije nisu repair-ane bez dodatnog dokaza
- `supabase db push` nije pokrenut naslijepo

**Completion note:**  
Zatvoren je runtime schema/table visibility blocker za composite tabele. Supabase CLI je usklađen sa runtime projektom `njczzzxmjwzjbtzwwsda`, potvrđeno je da composite migracije postoje u repou, a tri composite tabele nisu postojale u runtime DB-u prije intervencije. Zbog postojećeg migration history drifta nije rađen `supabase db push`; umjesto toga, urađen je konzervativni repair samo za migracije sa jakim DB dokazom, a tri composite migracije su ručno primijenjene kroz Supabase SQL Editor. REST provjera preko `.env.local` sada vraća OK za `assessment_assignments`, `assessment_assignment_attempts` i `assessment_reports`. Tri composite migracije su označene kao applied u remote migration history. `npm run process-assessment-report-jobs` više ne puca na schema cache i uredno završava sa “No queued composite assessment report found”. Preostaje DB-backed smoke sa stvarnim queued composite reportom.

### P1 — Composite readiness / assessment_reports storage model

**Status:** Završeno  
**Kategorija:** Architecture / Composite HR report storage / HR dashboard

**Problem / context:**  
Nakon uvođenja `assessment_assignments` i `assessment_assignment_attempts`, Composite HR report je dobio parent ownership model, ali još nije imao assessment-level storage ni realan readiness/status prikaz na HR participant detail stranici. Postojeći `attempt_reports` ostaje attempt-level storage za single-test reportove i nije prikladan za composite artefakt. Trebao je novi assessment-level storage i strogi readiness helper koji ne miješa pokušaje iz različitih procjenskih ciklusa.

**Scope:**
- dodati `assessment_reports` tabelu
- dodati assessment-level report constants/tipove/helper sloj
- dodati helper za latest active standard_battery assignment
- dodati composite readiness helper
- readiness računati samo iz `assessment_assignment_attempts` linked attemptova
- koristiti samo `required_for_composite = true` linked attempts
- dodati helper za latest composite HR assessment report row
- zamijeniti hardcoded composite placeholder realnim derived composite card state-om
- podržati HR card state-ove: `no_assignment`, `incomplete`, `ready_to_generate`, `queued`, `processing`, `ready`, `failed`
- očistiti user-facing copy na “Kompozitni HR izvještaj”
- ne uvoditi AI generation
- ne uvoditi worker
- ne uvoditi generate/retry akcije
- ne mijenjati `attempt_reports`, scoring, report pipeline ili single-test HR reportove

**Acceptance criteria:**
- `assessment_reports` tabela postoji i koristi `assessment_assignment_id` kao owner
- `assessment_reports` ima HR-only read policy za organization members
- participant/candidate read policy ne postoji u V1
- `missing` i `incomplete` nisu DB statusi nego UI-derived statusi
- DB statusi su `queued`, `processing`, `ready`, `failed`
- readiness koristi samo linked attempts iz istog assignment ciklusa
- historical completed attempts se ne koriste kao fallback
- partial assignment ostaje `incomplete`
- HR participant detail page prikazuje realan composite card state
- ready_to_generate ne dodaje aktivnu generate akciju
- ready ne dodaje aktivnu renderer rutu
- failed ne dodaje aktivan retry
- AI generation, worker i provider routing ostaju van scope-a

**Completion note:**  
Završeno kroz assessment-level storage/readiness slice. Dodana je migracija za `assessment_reports`, uveden je `lib/assessment/assessment-reports.ts`, a HR participant detail model sada računa composite readiness isključivo iz `assessment_assignment_attempts` linked attempts u istom assignment ciklusu. Historical completed attempts, “najnoviji completed attempt po testu”, pojedinačni AI reporti i `attempt_reports` se ne koriste za readiness. Composite card na HR participant detail stranici sada prikazuje derived state-ove `no_assignment`, `incomplete`, `ready_to_generate`, `queued`, `processing`, `ready` i `failed`, bez generate/retry akcija i bez renderer route-a. `assessment_reports` ima HR-only organization member read policy i ne daje participant/candidate read access u V1. AI generation, worker, composite input builder, provider routing, scoring, report pipeline i `attempt_reports` nisu mijenjani. `npm run typecheck`, `node scripts/test-assessment-reports.cjs`, `node scripts/test-assessment-assignments.cjs`, `node scripts/test-hr-candidate-assessment-detail-model.cjs`, `node scripts/test-report-capabilities.cjs` i `node scripts/test-hr-report-recovery.cjs` prolaze.

### P1 — Composite input builder iz deterministic score rezultata

**Status:** Završeno  
**Kategorija:** Composite HR report / Input builder / Deterministic source of truth

**Problem / context:**  
Nakon uvođenja `assessment_reports` storage-a i manual generate/retry queue flow-a, sistem je mogao kreirati `queued` composite artefakt, ali još nije postojao kontrolisani input snapshot koji definira šta budući Composite HR report smije koristiti kao izvor. Prije worker-a i AI provider sloja bilo je potrebno zaključati deterministic input builder kako bi composite interpretacija kasnije bila vezana za score rezultate, bandove, labele i traceable linked attempts iz istog assessment ciklusa.

**Scope:**
- dodati server-side composite input builder
- graditi `input_snapshot` za budući Composite HR report
- koristiti samo linked attempts iz `assessment_assignment_attempts`
- koristiti samo `required_for_composite = true` linked attempts
- uključiti assignment metadata
- uključiti source attempt traceability
- uključiti coverage podatke
- uključiti deterministic IPIP score/facet/domain podatke
- uključiti deterministic SAFRAN overall/domain podatke
- uključiti deterministic MWMS dimension podatke
- uključiti neutralne controlled summary signals
- uključiti guardrails koji eksplicitno zabranjuju historical fallback i AI-report-as-source pristup
- ne koristiti `attempt_reports`
- ne koristiti pojedinačne AI report narrative kao primary source
- ne mijenjati scoring
- ne uvoditi worker, AI generation, provider routing, schema/validator ili renderer

**Acceptance criteria:**
- postoji `lib/assessment/composite-input.ts`
- builder vraća stabilan `input_snapshot` shape
- snapshot sadrži `contractVersion`, `targetReportContractVersion`, `sourceType`, `reportType`, `audience`, `locale`, `generatedFor`, `assessmentAssignment`, `sourceAttempts`, `coverage`, `deterministicInputs`, `summarySignals`, `guardrails` i `metadata`
- source attempts imaju `attemptId`, `testId`, `testSlug`, `status`, `completedAt`, `requiredForComposite`, `requiredForTeamFit` i `position`
- IPIP input sadrži deterministic domain/facet score podatke
- SAFRAN input sadrži overall, verbal, figural i numeric deterministic podatke
- MWMS input sadrži svih 6 dimension score vrijednosti i motivation structure signale
- builder koristi samo linked completed attempts iz istog assignment ciklusa
- historical completed attempts nisu fallback
- `attempt_reports` nije source inputa
- single-test AI report tekstovi nisu primary source
- summary signals su neutralni i traceable na score podatke
- snapshot je locale-aware
- builder nije povezan na worker u ovom tasku

**Completion note:**  
Završeno kroz novi server-side composite input builder u `lib/assessment/composite-input.ts`. Builder za spreman `assessment_assignment_id` gradi deterministic `input_snapshot` za budući Composite HR report, koristeći samo linked `required_for_composite` attempts iz istog assignment ciklusa. Snapshot uključuje assignment metadata, source attempt traceability, coverage, deterministic IPIP/SAFRAN/MWMS input, neutralne summary signals i eksplicitne guardrails. Historical completed attempts, “najnoviji completed attempt po testu”, `attempt_reports` i pojedinačni AI report narrative se ne koriste kao source. AI generation, worker, provider routing, schema/validator, renderer, scoring i report pipeline nisu mijenjani. `npm run typecheck`, `node scripts/test-composite-input-builder.cjs`, `node scripts/test-assessment-reports.cjs`, `node scripts/test-assessment-assignments.cjs`, `node scripts/test-hr-candidate-assessment-detail-model.cjs`, `node scripts/test-report-capabilities.cjs` i `node scripts/test-hr-report-recovery.cjs` prolaze.

### P1 — Assessment report worker path za composite

**Status:** Završeno  
**Kategorija:** Composite HR report / Worker lifecycle / Assessment reports

**Problem / context:**  
Nakon uvođenja `assessment_reports`, manual generate/retry queue flow-a i deterministic composite input buildera, `queued` composite assessment report row je mogao nastati, ali se nije mogao obraditi. Trebao je poseban assessment-level worker path koji ne dira postojeći `attempt_reports` pipeline i koji dokazuje lifecycle: claim, processing, input snapshot build i kontrolisani završetak dok pravi provider ne postoji.

**Scope:**
- dodati poseban assessment-level worker path za `assessment_reports`
- claim-ati `queued` composite/hr/assessment row
- prebaciti row u `processing`
- pozvati composite input builder
- upisati deterministic `input_snapshot`
- završiti kontrolisano kao `failed` sa `COMPOSITE_PROVIDER_NOT_IMPLEMENTED`
- završiti kao `failed` sa `COMPOSITE_INPUT_NOT_READY` ako input builder ne može izgraditi snapshot
- dodati one-shot runner `process-assessment-report-jobs`
- dodati worker lifecycle test
- ne dodavati OpenAI/provider
- ne generisati finalni report
- ne postavljati `report_snapshot`
- ne postavljati `generated_at`
- ne mijenjati `attempt_reports`
- ne refaktorisati postojeći attempt report worker
- ne dodavati renderer

**Acceptance criteria:**
- postoji `lib/assessment/assessment-report-worker.ts`
- worker claim-a samo `queued + composite + hr + assessment` rows
- worker ne claim-a `ready`, `failed` ili `processing` rows
- worker prebacuje claimed row u `processing`
- worker poziva `buildCompositeHrInputSnapshot`
- worker upisuje `input_snapshot`
- worker završava row kao `failed` sa `COMPOSITE_PROVIDER_NOT_IMPLEMENTED` dok provider ne postoji
- input-not-ready slučaj završava kao `failed` sa `COMPOSITE_INPUT_NOT_READY`
- `report_snapshot` ostaje null
- `generated_at` ostaje null
- worker ne zove OpenAI/provider
- worker ne čita `attempt_reports`
- postojeći attempt report worker nije refaktorisan
- runner je one-shot i ne uvodi polling/scheduler orchestration
- testovi prolaze osim real-DB runnera koji je blokiran lokalnom Supabase connectivity greškom

**Completion note:**  
Završeno kao assessment-level worker lifecycle proof. Dodan je `lib/assessment/assessment-report-worker.ts`, one-shot runner `scripts/process-assessment-report-jobs.cjs`, npm script `process-assessment-report-jobs` i test `scripts/test-assessment-report-worker.cjs`. Worker claim-a `queued` composite HR `assessment_reports` row, prebacuje ga u `processing`, poziva deterministic composite input builder, upisuje `input_snapshot` i zatim kontrolisano završava row kao `failed` sa `COMPOSITE_PROVIDER_NOT_IMPLEMENTED`, jer provider još ne postoji. Ako input nije spreman, row završava kao `failed` sa `COMPOSITE_INPUT_NOT_READY`. Worker ne generiše finalni report, ne zove OpenAI/provider, ne postavlja `report_snapshot`, ne postavlja `generated_at`, ne čita `attempt_reports` i ne refaktoriše postojeći attempt report worker. `npm run typecheck`, `node scripts/test-assessment-report-worker.cjs`, `node scripts/test-composite-input-builder.cjs`, `node scripts/test-assessment-reports.cjs`, `node scripts/test-assessment-assignments.cjs`, `node scripts/test-hr-candidate-assessment-detail-model.cjs`, `node scripts/test-report-capabilities.cjs` i `node scripts/test-hr-report-recovery.cjs` prolaze. `npm run process-assessment-report-jobs` je u lokalnom okruženju pao sa `TypeError: fetch failed` pri Supabase query-ju, što je zabilježeno kao connectivity/runtime limitation, ne kao code failure.

---

| Prioritet | Tema                       | Status    | Kratak opis                                                                                                                  | Sljedeći korak                                                                                |
| --------- | -------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| P1        | MWMS pitanja / item UX     | Završeno  | MWMS itemi trenutno mogu zvučati čudno jer su zavisni od zajedničkog uvodnog pitanja, a prikazuju se kao samostalna pitanja. | Zatvoreno nakon redizajna MWMS item prikaza kao zajednički stem + “Mogući razlog” + item tvrdnja + jasna 1–7 instrukcija skale. |
| P1        | IPIP radar chart           | Završeno  | Radar chart je postojao u ranijoj IPIP verziji, ali je vjerovatno ispao iz novog AI/V2 render patha.                         | Zatvoreno nakon vraćanja radar chart-a u IPIP V2 participant report kao deterministic visual summary iz display_score vrijednosti. |
| P1        | Oblik obraćanja            | Discovery / Spec spreman  | Korisnik treba odabrati muški ili ženski jezički oblik obraćanja, bez pitanja o spolu.                                       | Implementirati uski MVP slice: `addressing_form` preference, pre-test modal, attempt/report snapshot i participant report input wiring. |
| P1        | Explicit HR retrieval and route wiring | Završeno | IPIP HR lane postoji u contract/provider/worker sloju, ali retrieval/display nije end-to-end odvojen od participant patha. | Zatvoreno nakon HR-only retrieval helpera, route wiring-a i unavailable state-a bez participant fallbacka. |
| P1        | HR report locale / i18n readiness policy | Završeno | HR report architecture mora ostati locale-aware od početka iako MVP ostaje bosanski. | Zatvoreno nakon dokumentovanja locale modela i pravila za assessment/report locale razdvajanje u backlogu i HR spec-u. |
| P1        | HR report locale/i18n audit | Završeno | Treba mapirati gdje report pipeline već nosi locale, a gdje hardcodira bosanski sadržaj. | Zatvoreno read-only auditom koji je mapirao locale izvore, snapshot praznine i bosanski hardcoding rizike. |
| P1        | Persisted report locale guardrails for future HR lanes | Završeno | Budući HR report lane-ovi ne smiju ulaziti u pipeline bez centralnog locale guardraila i bez kontrole fallback `"bs"` ponašanja. | Zatvoreno nakon `ReportLocale` / `resolveReportLocale(...)` guardraila i uklanjanja nepotrebnog `"bs"` hardcodinga iz poznatih fallback path-eva. |
| P1        | SAFRAN HR report V1       | Završeno | SAFRAN HR report lane je zatvoren sa contract/input/validator slojem, mock/OpenAI runtime-om, HR-only retrievalom i browser potvrdom. | Zatvoreno nakon realnog OpenAI smoke-a, HR route prikaza i završnog copy polish-a. |
| P1        | HR candidate assessment detail page | Završeno | Dashboard CTA sada vodi na participant-level pregled procjene umjesto na nasumični ili primarni attempt. | Zatvoreno nakon detail stranice sa IPIP/SAFRAN/MWMS karticama i composite placeholderom. |
| P0        | Candidate dashboard attempt lifecycle hardening | Završeno | Candidate dashboard primary attempt selection i standard battery provisioning sada više ne dozvoljavaju da prazan noviji SAFRAN attempt sakrije completed rezultat. | Zatvoreno nakon lifecycle priority fixa, standard battery guarda i povratka na dashboard sa completed results screena. |
| P1        | HR report card status mapping | Završeno | HR kartice sada razlikuju ready/queued/processing/failed/unavailable/missing/incomplete stanja bez participant fallbacka. | Zatvoreno nakon jasnog status UX mapiranja za IPIP, SAFRAN i MWMS lane-ove. |
| P1        | Queued vs processing HR report status UX | Završeno | `queued` i `processing` više nisu spojeni u isto značenje na HR kartici. | Zatvoreno nakon razdvajanja `Čeka generisanje` i `Generiše se` labela, opisa i disabled CTA-a. |
| P1        | Automatic HR report enqueue / capability registry | Završeno | Post-completion HR enqueue sada je capability-driven umjesto hardcodiran po testu. | Zatvoreno nakon registry-ja za IPIP/SAFRAN/MWMS active HR lane-ove. |
| P1        | HR report recovery actions | Završeno | HR detail page sada ima recovery akcije za failed i missing single-test HR reportove. | Zatvoreno nakon retry/reset istog reda i explicit create path-a za missing HR report. |
| P1        | IPIP HR report content contract V2 | Završeno | IPIP HR report je prešao na HR-operativni `ipip_neo_120_hr_v2` contract uz legacy display fallback. | Zatvoreno nakon schema/provider/mock/validator V2 shape-a i realnog smoke-a. |
| P1        | MWMS HR report V1         | Završeno | MWMS sada ima i active HR single-test lane uz potvrđen realni DB lifecycle i OpenAI smoke. | Zatvoreno nakon realnog DB lifecycle-a i OpenAI smoke-a. |
| P1        | Non-blocking autosave za candidate IPIP/MWMS Likert flow | Završeno | Trenutni DB-first blocking persistence je uklonjen za candidate IPIP/MWMS Likert auto-advance flow kroz uski autosave slice. | Zatvoreno nakon candidate-only IPIP/MWMS Likert autosave slice-a sa immediate React state update-om, localStorage pending queue-om, background flushom i blocking final submit flushom. |
| P1        | Assessment assignment ownership za standard battery | Završeno | Standard battery sada ima prvi assessment-level parent ownership sloj kroz `assessment_assignments` i `assessment_assignment_attempts`. | Nastaviti sa composite readiness / `assessment_reports` storage modelom, bez prebacivanja dashboarda na assignment-first dok ne bude zaseban task. |
| P1        | Manual composite generate/retry action za assessment_reports | Završeno | HR sada može ručno kreirati ili resetovati composite assessment_report u `queued` statusu. | Implementirati composite input builder iz deterministic IPIP/SAFRAN/MWMS score rezultata. |
| P1        | Composite readiness / assessment_reports storage model | Završeno | Uveden je assessment-level storage i derived readiness/card state za budući Composite HR report. | Implementirati manual generate/retry queue flow za `assessment_reports` bez AI generation-a. |
| P1        | Composite HR report data model decision | Završeno / Prvi slice implementiran | Composite HR report nema prirodan jedan attempt_id; donesena je odluka da ne ide u `attempt_reports`, a prvi ownership slice je uveden kroz `assessment_assignments` i `assessment_assignment_attempts`. | Zatvoreno nakon assessment_reports storage/readiness slice-a. |
| P1        | Composite input builder iz deterministic score rezultata | Završeno | Uveden je deterministic input_snapshot builder za budući Composite HR report, zasnovan na linked IPIP/SAFRAN/MWMS attemptovima iz istog assignment ciklusa. | Implementirati assessment report worker path za composite koji će koristiti builder za popunjavanje input_snapshot-a i kasniju obradu queued row-a. |
| P1        | Composite HR report contract/schema/provider | Završeno | Uveden je Composite HR report V1 contract, runtime validator i mock provider; assessment report worker sada može završiti queued composite row kao ready sa validnim report_snapshot-om. | Zatvoreno nakon uvođenja contracta, runtime validatora, mock providera, renderera i OpenAI providera; sljedeći korak je V1 polish / QA. |
| P1        | Composite HR report renderer | Završeno | Ready mock-backed Composite HR report snapshot sada ima assessment-level HR pregled. | Zatvoreno nakon assessment-level renderera; sljedeći korak je V1 polish / QA i real OpenAI smoke kada env bude spreman. |
| P1        | OpenAI provider za Composite HR report | Završeno | OpenAI provider koristi deterministic CompositeHrInputSnapshot i proizvodi runtime-validirani CompositeHrReportSnapshot. | Zatvoreno nakon OpenAI provider slice-a; sljedeći korak je V1 polish / QA. |
| P1        | Composite HR report V1 QA audit / copy polish | Završeno / Runtime blocker zatvoren | Core Composite HR V1 flow je prošao code-level QA i mali HR-facing copy cleanup; runtime schema/cache blocker je zatvoren. | Zatvoreno; naredni fokus je production orchestration i zasebni renderer/provider polish taskovi po potrebi. |
| P1        | DB-backed end-to-end smoke za Composite HR report | Završeno / Mock + OpenAI potvrđeni | Stvarni queued composite report lifecycle potvrđen je kroz mock-backed i OpenAI DB-backed smoke na realnom assessment_reports row-u. | Zatvoreno za runtime potvrdu; production orchestration ostaje zaseban korak. |
| P1        | Composite HR report V1 final copy/UX polish | Završeno / Mock-backed renderer polish | Composite HR report renderer je očišćen od raw debug/provider jezika i source blok je humanizovan za HR prikaz. | Sljedeći korak je production orchestration; watchout wording/UI i provider-copy polish ostaju zasebni taskovi. |
| P1        | OpenAI provider language QA guardrails za Composite HR report | Završeno | Provider sada koristi shared BHS language QA helper, provider-level gate, reviewer pass i terminološku stabilizaciju za Composite HR lane. | Zatvoreno nakon uspješnog OpenAI DB-backed smoke-a koji je prošao language QA i reviewer gate. |
| P2        | Composite HR report watchout wording/UI polish | Planirano | “Tačka opreza” / “Tačke opreza” i vizuelni tretman oprez kartica djeluju rogobatno u HR UI-u. | Revidirati wording i smiriti tretman watchout kartica bez promjene provider/contract/scoring sloja. |
| P1        | Assessment report worker path za composite | Završeno | Queued assessment_reports row sada može biti claim-an, obrađen do `input_snapshot` i kontrolisano završen kao failed dok provider ne postoji. | Zatvoreno kao lifecycle proof; sljedeći sigurni korak je Composite HR report contract/schema/provider sloj. |
| P1        | Composite HR report V1    | Aktivno / Mock + OpenAI runtime potvrđen | Historijski “Kompozitni AI profil” sada se vodi kao jasniji composite HR report task; contract/schema/provider, worker lifecycle, renderer i OpenAI provider su uvedeni. Mock-backed i OpenAI DB smoke su završeni. | Prioritet je production worker/report orchestration, zatim watchout wording/UI polish i eventualni provider-copy polish ako budući output pokaže potrebu. |
| P2        | Candidate dashboard labels | Završeno  | Kartice na candidate dashboardu sada prikazuju šta procjena mjeri kao glavni title, a naziv instrumenta kao subtitle.        | Commit/push nakon lokalne potvrde.                                                            |
| P2        | Candidate dashboard CTA hover contrast | Završeno | Completed CTA više ne gubi kontrast na hoveru, a shared CTA hover/focus sistem je usklađen za sve candidate dashboard kartice. | Zatvoreno nakon shared CTA hover/focus contrast fixa u candidate dashboard karticama. |
| P2        | MWMS AI report copy ton    | Završeno  | MWMS AI report koristi formalno “Vaš/Vam”; treba odlučiti da li candidate app ide na “ti” ili formalniji stil.               | Zatvoreno nakon prompt update-a, normalizeMwmsCopy safety net-a, forbidden-form smoke testa i regeneracije testnog MWMS participant reporta. |
| P2        | SAFRAN participant domain copy polish | Završeno | SAFRAN participant “Pregled po oblastima” sada koristi controlled display copy umjesto starog šablonskog domain teksta. | Zatvoreno nakon controlled copy helpera bez promjene scoringa, layouta ili AI/report pipeline-a. |
| P2        | Worker/report auto-processing orchestration | Otvoreno / Tech debt | Recovery i automatic enqueue ostavljaju report u `queued`, ali dev/local worker ne obrađuje job bez ručnog pokretanja. | Odlučiti background worker trigger, polling/realtime update i produkcijsku orchestration strategiju. |
| P2        | Non-blocking autosave follow-up za SAFRAN step flow | Planirano | Nakon dokazivanja Likert path-a, SAFRAN step flow traži poseban non-blocking autosave slice za visual/verbal single-choice i numeric input. | Proširiti autosave na SAFRAN uz final submit flush guard i refresh/resume sigurnost. |

---

Napomena za zatvorene P1 stavke:

* `IPIP prethodno pitanje ne prikazuje odabrani odgovor` je završeno kroz popravku selected-state vidljivosti i resume/back-navigation feedbacka; IPIP auto-advance ostaje, bez `Nastavi` dugmeta.
* `SAFRAN izgleda kao da ima default označen odgovor` je zatvoren kao nereproduciran nakon ručne provjere; nije bio potreban code change.
* `IPIP tekst na karticama dimenzija se ponavlja` je završen u browser-visible V2 participant report rendereru; scoring, AI promptovi i `attempt_reports` pipeline nisu mijenjani.

## 5. Product / UX odluke

### 5.1 Radar chart politika

* IPIP: radar chart je vraćen u V2 participant report i koristi deterministic `display_score` iz V2 snapshot-a.
* MWMS: ne radar; bolji su motivacijski barovi/grupisani profil.
* SAFRAN: ne radar; bolji su score cards i horizontalni barovi.
* Composite: ne jedan veliki radar; bolja je integrisana mapa profila.

### 5.2 MWMS report status

MWMS V1 sada ima:

* deterministic scoring
* 6 dimension_scores na skali 1–7
* deterministic fallback report
* participant-facing AI report V1 kroz attempt_reports pipeline
* OpenAI structured output schema
* browser-confirmed ready AI report
* polished participant report UI
* “ti” formu u promptu i renderer safety net-u
* forbidden-form smoke test
* regenerisan testni report nakon aktivacije prompta
* motivacijski bar profil sa mikro-objašnjenjima subskala
* HR-facing MWMS report V1
* active HR single-test lane
* MWMS HR contract/schema/validator
* deterministic HR input builder iz dimension_scores
* mock i OpenAI provider support
* HR renderer/display adapter
* capability-driven dashboard/status/recovery support
* real DB lifecycle smoke potvrđen
* real OpenAI smoke potvrđen

MWMS HR report je sada podržan u V1 kao active single-test HR lane. Ranije unsupported/planned stanje je zatvoreno nakon MWMS HR V1 implementacije i realnog lifecycle smoke-a.

### 5.3 Oblik obraćanja

Ne pitati korisnika za “spol”. Pitati:

> Kako želiš da ti se aplikacija obraća?

Opcije:

* Muški oblik
* Ženski oblik

Napomena:

> Ovaj izbor se koristi samo da pitanja i izvještaji zvuče prirodnije. Ne utiče na rezultate procjene.

### 5.4 SAFRAN redoslijed stabilizacije

Dogovoreno je da finalni ručni SAFRAN smoke test ne ide prije zatvaranja report i practice UX sloja.

Revidirani redoslijed:

1. SAFRAN user report content architecture — završeno
2. SAFRAN report visual parity sa IPIP reportom — završeno
3. SAFRAN practice visual parity sa scored pitanjima — završeno
4. finalni ručni SAFRAN smoke test
5. RIASEC implementation doc
6. composite report architecture

Razlog: smoke test treba validirati kandidat-facing iskustvo koje je dovoljno blizu finalnog, a ne poluzavršen report/practice tok.

### 5.5 App chrome politika

* Standard protected chrome koristi se za dashboarde, report stranice, attempt landing stranice i normalnu protected navigaciju.
* Assessment execution rute koriste focus chrome kako bi se smanjio navigacijski šum i sačuvao vertikalni prostor.
* Ovo je route-based odluka i važi za sve procjene, ne samo za SAFRAN.
* Report/results stranice zadržavaju standard chrome jer su review/navigation iskustvo, ne aktivno rješavanje testa.
* Buduće procjene koje koriste isti execution route family treba da naslijede focus chrome po defaultu.

### 5.6 SAFRAN decimalni numerički odgovori

* SAFRAN numeric sequence odgovori moraju podržati decimalne vrijednosti.
* I zarez i tačka prihvataju se kao decimalni separator.
* Normalizacija se radi za validation/scoring, dok se user-entered string format može zadržati za autosave/resume.

### 5.7 Preporučeni sljedeći redoslijed

1. Refactor Composite HR report prema `docs/deep-profile-ui-system.md`
2. Composite HR interview guidance V2 (veći task)
3. Composite HR onboarding 30/60/90 format (veći task)
4. Assignment-aware dashboard model za nove assessment cikluse
5. Oblik obraćanja: muški/ženski jezički oblik
6. Report visual language po testovima
7. SAFRAN novi stimulus asseti
8. Login screen UI polish

Razlog za sljedeći prioritet:

* Današnji lokalni Composite HR renderer polish je zatvorio back navigation, summary headline i interview/onboarding alignment na code-level nivou, ali vizuelni rezultat i dalje pokazuje da nam treba sistemski UI refactor, ne novi lokalni polish.
* Kreiran je `docs/deep-profile-ui-system.md` kao novi source of truth.
* Sljedeći UI rad ne smije nastaviti po principu “popravi jednu sekciju”; treba planski primijeniti UI system na cijeli Composite HR report renderer.
* Posebno treba smanjiti nested card slojeve, ujednačiti surface/shadow/spacing i spriječiti povratak mliječnog/mentol vizuelnog pravca.
* Tek nakon toga ima smisla otvarati veće sadržajne taskove poput Interview guidance V2 i Onboarding 30/60/90.

### 5.14 Assessment autosave UX politika

* Tokom rješavanja testa UI ne treba čekati DB save za svaki Likert/single-choice klik.
* Lokalni React state je immediate UI truth.
* localStorage pending queue služi kao kratkotrajna zaštita od refresha prije DB sync-a.
* Baza ostaje source of truth za completion, scoring, report generation i dashboard progress.
* Final submit mora biti blocking i mora flushati sve pending odgovore prije completion/scoringa.
* Prvi rollout je candidate-only IPIP/MWMS Likert flow.
* Prvi rollout za candidate IPIP/MWMS Likert auto-advance flow je završen; SAFRAN, numeric/text/multiple_choice i HR run flow ostaju van ovog slice-a i čekaju zasebne odluke/implementacije.
* SAFRAN, numeric/text/multiple_choice i HR run flow ostaju blocking dok ne dobiju zasebne slice-ove.
* Ne uvoditi service worker, IndexedDB ili veliki offline-first sistem za prvi MVP slice.

### 5.15 Terminologija za reporte

* U tehničkom razgovoru koristiti `reporti` kao množinu riječi report, ne `reportovi`.
* U korisničkom UI-u preferirati `izvještaji` kada je prirodnije i jasnije.

### 5.16 Assessment assignment ownership politika

* `assessment_assignments` predstavlja jedan procjenski ciklus kandidata.
* `assessment_assignment_attempts` povezuje taj ciklus sa attempts koji su stvarno kreirani u tom flow-u.
* U ovom compatibility slice-u existing completed attempts se ne linkuju u novi assignment.
* Existing completed attempts i dalje blokiraju kreiranje novog praznog attempta za isti test dok dashboard ostaje attempt-based.
* Fresh attempts za već completed testove dolaze tek kada candidate/HR dashboard postane assignment-aware.
* `attempt_reports` ostaje single-test report storage.
* Composite HR report ne ide u `attempt_reports`.
* Budući Composite HR report treba assessment-level storage, vjerovatno `assessment_reports`.
* Model mora podržati budući četvrti/team-fit test bez promjene osnovne strukture.
* Ne raditi agresivan historical backfill bez jasnog deterministic grouping pravila.

### 5.17 Composite readiness i assessment_reports politika

* Composite input builder je deterministic source-of-truth sloj između score rezultata i buduće AI interpretacije.
* Builder koristi samo linked `required_for_composite` attempts iz istog assignment ciklusa.
* Builder ne koristi historical completed attempts kao fallback.
* Builder ne koristi `attempt_reports`.
* Builder ne koristi pojedinačne AI report narrative kao primary source.
* Builder mora sadržati source attempt reference za svaki instrument.
* Builder mora sadržati deterministic score/band/label podatke za IPIP, SAFRAN i MWMS.
* Builderovi summary signals moraju biti neutralni i traceable na score podatke.
* AI kasnije smije interpretirati input, ali ne smije mijenjati score vrijednosti, bandove ili source attempts.
* Composite HR report ne koristi `attempt_reports`.
* Runtime Supabase projekat za composite flow je `njczzzxmjwzjbtzwwsda`.
* Composite runtime zahtijeva da `assessment_assignments`, `assessment_assignment_attempts` i `assessment_reports` postoje u runtime DB-u i budu vidljivi kroz PostgREST.
* Schema cache greška za `assessment_reports` je zatvorena nakon ručne primjene composite migracija i REST visibility provjere.
* `supabase db push` se ne smije pokretati naslijepo dok postoje stare uncertain migracije sa history driftom.
* Composite migracije `20260512110000`, `20260512111000` i `20260512120000` su ručno primijenjene i označene kao applied.
* Stare uncertain migracije ostaju posebna migration-history cleanup tema i nisu blocker za composite smoke dok runtime objekti postoje.
* DB-backed mock smoke je potvrdio `queued → processing → ready` flow za stvarni `assessment_reports` red.
* Controlled backfill može se koristiti samo za smoke/QA kada postoje completed attempts istog kandidata i organizacije, ali nije zamjena za production assignment lifecycle.
* Composite smoke mora koristiti linked attempts iz istog `assessment_assignment_id`; historical fallback ostaje zabranjen.
* 404 na renderer route-u može biti ispravan security/access rezultat ako HR user nije član organizacije kojoj report pripada.
* Renderer route je potvrđen za HR usera sa membershipom u organizaciji reporta.
* Mock provider smoke ne zamjenjuje OpenAI DB-backed smoke.
* Composite HR renderer source/traceability blok sada koristi HR-facing copy i ne prikazuje raw provider/debug vrijednosti kao glavni sadržaj.
* Test slugovi se u rendereru mapiraju na HR-facing nazive.
* Evidence chipovi ne prikazuju raw test slugove.
* Renderer display layer može imati uski sanitizer za očigledne tehničke izraze, ali provider/contract ostaju source of truth.
* Renderer display layer može mapirati poznate tehničke termine, ali ne smije postati generički lektor AI outputa.
* Composite HR OpenAI provider sada koristi shared BHS report language-quality helper.
* Shared helper je početak centralnog report language QA sloja za buduće report lane-ove, ali je trenutno integrisan samo u Composite HR OpenAI provider.
* Composite HR OpenAI provider sada ima reviewer pass kao drugi structured OpenAI call prije finalnog ready outputa.
* Reviewer pass je provider-level gate i ne zamjenjuje contract validator, source checks ili shared language QA.
* Jezički kvalitet OpenAI Composite HR reporta ostaje provider/language QA odgovornost, ne renderer odgovornost.
* AGREEABLENESS label mora ostati “Spremnost na saradnju”.
* “Ugodnost” i “Saradljivost” su zabranjeni.
* “Saradnja” nije globalno zabranjena kao obična riječ, ali ne smije biti label-like zamjena za AGREEABLENESS.
* Reviewer/language QA checks odnose se na finalni user-facing report output, ne na raw sourceSnapshot legacy labels.
* Validan report contract nije dovoljan ako output sadrži neprirodne formulacije kao “rokovi visoki”.
* Provider language QA sprječava poznate loše fraze prije nego report_snapshot dobije ready status.
* “Tačka opreza” / “Tačke opreza” wording treba tretirati kao zaseban renderer UX/copy polish.
* Renderer polish ne smije mijenjati score vrijednosti, source attempts, provider output contract ili access guard.
* OpenAI DB-backed smoke je potvrđen kroz realni assessment_reports row sa `AI_REPORT_PROVIDER=openai`.
* OpenAI smoke je potvrdio `queued → processing → ready` flow, persisted `input_snapshot`/`report_snapshot` i HR renderer route.
* OpenAI DB-backed smoke potvrđuje da stvarni provider output dobro prolazi kroz isti renderer nakon provider language QA sloja.
* Production worker/report orchestration ima završen prvi uski best-effort completion-triggered slice.
* Completion event je trigger za report orchestration; report view nije trigger.
* Composite HR report treba automatski ući u queued/generation flow čim su required linked attempts completed u istom assessment assignmentu.
* Manual generate/retry ostaje recovery alat, ne normalni happy path.
* HR korisnik u normalnom flow-u treba zateći ready report, ne čekati generisanje nakon otvaranja detail stranice.
* Server-side helper `lib/assessment/report-orchestration.ts` je centralni completion-triggered bridge za ovaj prvi slice.
* Completion flow poziva orchestration helper tek nakon uspješnog scoring/results persistence-a.
* Helper je best-effort i ne smije srušiti completion flow ako enqueue/worker dio padne.
* Single-test completion path koristi postojeći `attempt_reports` worker chain za scoped claim/process pokušaj nakon completion eventa.
* Composite enqueue/process pokušava se samo kada assignment postane composite-ready u istom ciklusu.
* Failed reportovi se ne retry-aju automatski.
* Existing `queued`/`processing`/`ready` reportovi se ne dupliciraju.
* Nisu mijenjani DB schema, scoring, provider contracti, renderer ni dashboard UI.
* MWMS completion-triggered runtime smoke je prošao: stvarni protected completion flow je bez report-view triggera završio attempt i proizveo HR `attempt_report` koji je završio `ready`.
* Composite completion-triggered runtime smoke je prvo bio `PARTIAL`: completion trigger, readiness, `assessment_reports` row kreiranje i worker processing su radili, ali provider/reviewer consistency je oborila report.
* Prvi composite blocker bio je `SOURCE_INTEGRITY_MISMATCH_NEUROTICISM_VALUE` (Neuroticizam evidence value mismatch).
* Dodan je provider source/evidence lock: deterministic evidence catalog + locked evidence values prije reviewer faze + regression test za Neuroticism mismatch.
* Drugi composite blocker bio je AGREEABLENESS glossary violation zbog “Ugodnost”.
* Dodan je canonicalization fix: AGREEABLENESS user-facing evidence koristi “Spremnost na saradnju”.
* Composite language QA sada skenira user-facing report polja, ne internal/source helper objekte.
* Ponovljeni composite worker smoke za `assessment_report_id=fe22ed8b-460c-4273-9dd8-6bee56d8c645` završio je `ready` sa:
  * `generator_type=openai`
  * `model_name=gpt-5.4`
  * `failure_code=null`
  * `failure_reason=null`
* Orchestration helper nije mijenjan tokom provider/reviewer fix-eva.
* Composite HR report koristi assessment-level storage kroz `assessment_reports`.
* `assessment_reports` je HR-only artefakt u V1.
* Participant/candidate ne dobija read access na HR composite report u V1.
* Composite HR report V1 contract je uveden kroz runtime-validirani `report_snapshot`.
* Mock provider je prvi provider i služi za provjeru contracta, workera i budućeg renderera.
* Mock provider ostaje default/dev/test provider.
* Mock provider koristi `CompositeHrInputSnapshot` kao source.
* Mock provider ne zove OpenAI.
* Mock provider ne koristi `attempt_reports`.
* Mock provider ne mijenja score vrijednosti, bandove ili source attempts.
* Provider selection koristi postojeći `AI_REPORT_PROVIDER` i `AI_REPORT_MODEL` project standard.
* OpenAI provider za Composite HR report koristi isti `CompositeHrInputSnapshot` kao mock provider.
* OpenAI provider mora proizvoditi isti `CompositeHrReportSnapshot` contract koji renderer već očekuje.
* Runtime validator ostaje finalna kapija prije `ready` statusa.
* OpenAI output ne smije mijenjati source attempt IDs, score vrijednosti, bandove ili `generatedFor` identity.
* OpenAI output ne smije sadržavati hire/no-hire odluku, fit score ili automatsku preporuku za zapošljavanje.
* Real OpenAI smoke treba raditi kao QA/polish korak, ne kao dio samog provider implementation slice-a.
* Composite HR report ne smije sadržavati hire/no-hire odluku, fit score ili automatsku preporuku za zapošljavanje.
* Composite HR report pregled koristi assessment-level route `/dashboard/assessment-reports/[reportId]`.
* Composite report se ne prikazuje kroz `/dashboard/attempts/[attemptId]`.
* Renderer prikazuje samo `ready` `assessment_reports` row.
* Renderer mora runtime validirati `report_snapshot` prije prikaza.
* Invalid ili missing snapshot ne smije biti parcijalno prikazan.
* Composite renderer trenutno prikazuje mock-backed report snapshot.
* OpenAI provider mora kasnije proizvoditi isti contract shape koji renderer već očekuje.
* Assessment report worker path za composite je odvojen od postojećeg `attempt_reports` worker-a.
* Worker claim-a samo `assessment_reports` rows sa `report_type='composite'`, `audience='hr'`, `source_type='assessment'` i `report_status='queued'`.
* Worker koristi composite input builder kao source za `input_snapshot`.
* Worker ne koristi `attempt_reports`.
* Worker ne koristi historical attempts kao fallback.
* Worker smije postaviti `generated_at` tek nakon validnog `report_snapshot`.
* Worker smije završiti `ready` tek nakon runtime validacije report snapshot-a.
* Ako input builder ne može izgraditi snapshot, worker završava kao `failed` sa `COMPOSITE_INPUT_NOT_READY`.
* Ako provider output ne prođe validator, worker završava kao `failed` sa `COMPOSITE_REPORT_VALIDATION_FAILED`.
* `report_snapshot` i `generated_at` se postavljaju tek nakon validnog `report_snapshot`-a.
* One-shot runner postoji, ali nema scheduler/polling orchestration u ovom slice-u.
* Composite readiness se računa samo iz `assessment_assignment_attempts` linked attempts u istom assignment ciklusu.
* Readiness koristi samo linked attempts sa `required_for_composite = true`.
* Historical completed attempts nisu automatski fallback.
* “Najnoviji completed attempt po testu” nije validan composite source.
* Pojedinačni AI reporti nisu primary source za composite readiness ili budući composite input.
* `missing`, `incomplete` i `ready_to_generate` su UI-derived state-ovi.
* DB storage statusi za `assessment_reports` su `queued`, `processing`, `ready`, `failed`.
* `ready_to_generate` znači da su linked required attempts završeni i da report row još ne postoji.
* `incomplete` znači da assignment nema sve required linked completed attempts iz istog ciklusa.
* Compatibility assignment može ostati incomplete ako je existing completed attempt blokirao kreiranje/linkovanje novog attempta.
* Manual generate action smije kreirati `assessment_reports` row u `queued` samo kada je composite readiness `ready`.
* Retry action smije resetovati samo `failed` composite assessment report row nazad u `queued`.
* `queued`, `processing` i `ready` su no-op za generate/retry akcije.
* Generate/retry akcije moraju ponovo provjeriti readiness server-side.
* UI state nije dovoljan dokaz readiness-a.
* Queued composite row se još ne obrađuje dok ne postoji assessment report worker path.
* Manual queue flow nije isto što i Composite HR report generation.
* Generate/retry, worker, AI provider i renderer dolaze kao zasebni slice-ovi.
* Composite HR V1 code-level pipeline sada ima storage, readiness, queue action, input builder, worker, contract, validator, mock provider, renderer i OpenAI provider.
* QA/copy polish je uklonio stale i tehnički user-facing wording iz composite card i renderera.
* DB-backed composite smoke zahtijeva da `assessment_assignments`, `assessment_assignment_attempts` i `assessment_reports` migracije budu primijenjene u runtime Supabase okruženju.
* Ako Supabase schema cache ne vidi `public.assessment_reports`, composite worker smoke ne može potvrditi end-to-end flow.
* Runtime DB smoke failure zbog schema cache/migration stanja nije isto što i code-level provider/validator failure.
* Production readiness zahtijeva DB-backed smoke, ne samo local/unit testove.
* Composite HR report treba biti savjetodavni HR radni dokument: pored metodološke sigurnosti mora jasno voditi HR na glavni signal, prioritetnu provjeru i menadžerske implikacije.
* U user-facing outputu ostaje zabrana hire/no-hire presude, fit score-a i automatske preporuke zapošljavanja.
* Ton treba biti stručan, savjetodavan, konkretan i HR-operativan, bez pretjerano defanzivnog “možda” jezika kao dominantnog stila.

### 5.18 Composite HR report kao savjetodavni HR radni dokument

* Composite HR report nije samo metodološki oprezan sažetak psihometrijskih rezultata.
* Composite HR report treba biti HR radni dokument sa jačom savjetodavnom ulogom.
* Aktuelni advisory prompt polish ciklus je završen:
  * prompt pojačan ka čvršćim HR hipotezama, konkretnijim intervju provjerama i operativnijim onboarding/menadžerskim smjernicama
  * safety/source guardraili zadržani bez promjene (bez hire/no-hire, bez fit score-a, bez automatske preporuke zapošljavanja, bez mijenjanja score/band/evidence source podataka)
  * uveden BHS narrative casing guardrail: label može ostati “Spremnost na saradnju”, ali narativ usred rečenice mora koristiti “spremnost na saradnju”
  * language QA sada hvata neprirodnu BHS kapitalizaciju domena/dimenzija u narativnim user-facing poljima, dok su evidence/display labeli izuzeti iz tog pravila
* Composite HR concise advisory writing polish task je završen:
  * provider prompt dodatno pojačan za kraći, skenabilniji i akcijski HR stil
  * dodana preciznija pravila za kraći summary headline i jasniju 3-rečeničnu logiku u `summary.profileOverview`
  * `summary.watchouts`/“Fokus za provjeru” pojačan na direktne akcijske konstrukcije
  * integrated signals “Šta HR treba provjeriti” skraćeni i više instrukcioni
  * onboarding/menadžerske smjernice usmjerene na konkretnije glagole i operativne korake
  * language QA dobio minimalni summary writing guardrail: predug headline pada; “Područje za dodatnu provjeru je” ne prolazi; summary mora imati barem jednu akcijsku HR konstrukciju
* Amrin report je regenerisan nakon ovih promjena; vizuelna/sadržajna provjera potvrđuje bolju skenabilnost i operativniji ton.
* Nakon čitanja reporta HR korisnik treba jasno znati:
  * šta je najvažniji radni signal kandidata
  * šta prvo treba provjeriti u intervjuu
  * koje ponašajne obrasce treba potvrditi ili opovrgnuti
  * gdje kandidat vjerovatno može dati najbolji učinak
  * gdje mogu nastati rizici ili frikcije
  * kako menadžer treba postaviti prioritete, očekivanja, podršku i onboarding
* Ton reporta treba ostati:
  * stručan
  * savjetodavan
  * konkretan
  * HR-operativan
  * metodološki siguran
* Report ne smije sadržavati:
  * hire/no-hire presudu
  * fit score
  * automatsku preporuku za zapošljavanje
  * pretjerano defanzivan jezik koji stalno zvuči kao “možda”
* Report je sada dovoljno dobar za demo HR pregled.
* Završen je i današnji vizuelni/UI polish ciklus za Composite HR report:
  * “Integrisani signali” imaju 3-modulni analitički layout sa jačim semantic color tretmanom.
  * “Sažetak” je 2x2 executive dashboard sa jačom vizuelnom hijerarhijom.
  * Signal title je glavni vizuelni info, signal badge je sekundaran, a evidence je data/evidence panel.
  * Uklonjen je user-facing “hipoteza” framing iz Integrisanih signala i zamijenjen konkretnijim “radni signali”.
* Ograničenje ovog ciklusa: promjene su samo renderer/display; nije diran provider/prompt/contract/scoring/orchestration/worker/DB/routing sloj.
* Novi preporučeni operativni korak sada ide kroz `docs/deep-profile-ui-system.md`, a ne kroz izolovani lokalni polish po sekcijama.

### 5.19 Deep Profile UI system kao source of truth

* `docs/deep-profile-ui-system.md` je uveden kao implementation-facing UI standard.
* Budući UI Codex taskovi moraju prvo pročitati taj dokument kada diraju:
  * dashboard
  * HR workspace
  * candidate dashboard
  * participant reports
  * HR reports
  * composite reports
  * app navigation
  * CTA/buttons
  * cards/surfaces
  * report renderer layout
* Ako dokument već pokriva element, ne uvoditi novi vizuelni obrazac.
* Ako postojeći sistem ne pokriva potrebu, odstupanje se mora eksplicitno navesti u task summaryju; Codex ne smije improvizovati.
* UI system zaključava:
  * Deep Profile visual direction kao HR people-intelligence / decision-support proizvod, ne računovodstveni dashboard
  * color semantics za bubblegum-pink, golden-pollen, emerald, ocean-blue i dark-teal
  * emerald samo kao success/status boju, ne kao dominantnu hero/section atmosferu
  * typography scale
  * maksimalno 2 nivoa card/surface hijerarhije
  * shadow nivoe
  * CTA/button hover/focus pravila
  * status pill/chip pravila
  * PageNavigation kao standard za page-level navigation
  * report page layout patterns
  * BHS UX copy pravila
  * Codex implementation rules
* Riječ “nalaz” / “nalazi” ne koristiti u HR/psihometrijskom UI copyju; koristiti “izvještaj”, “rezultat”, “pregled”, “procjena” ili “interpretacija”, zavisno od konteksta.
* Codex ne smije donositi dizajn odluku; UI prompt mora specificirati fajlove, copy, klase/tokene, zabrane, acceptance criteria i test komande.

### 5.20 Team Fit & Dynamics terminologija i MVP smjer

* Zaključana su tri odvojena, ali povezana sloja:
  * Individualni modul: `Timski stil saradnje` / `team_style_collaboration_v1` (entitet: kandidat ili postojeći član tima; pitanje: `Kakav je individualni timski potencijal i saradničko prosuđivanje?`)
  * Timski assessment: `Procjena timske dinamike` / `team_dynamics_assessment_v1` (entitet: konkretan tim; pitanje: `Kako tim funkcioniše kao sistem?`)
  * Relacijski report: `Timski fit kandidata` / `team_fit_report_v1` (entitet: kandidat + konkretan tim; pitanje: `Kako će se kandidat uklopiti u tim?`)
* Produktna odluka:
  * Team Fit se ne tretira kao test.
  * Team Dynamics nije jedini test koji daje cijelu sliku tima.
  * `Timski stil saradnje` je research-informed i u validacijskoj fazi; nije još implementiran u code-u.
  * postojeći `team_dynamics_v1_strong` scaffold ostaje validan kao timski assessment scaffold, ali je samo jedan krak šire Team Fit / Team Dynamics arhitekture.
  * `Procjena timske dinamike` ide kao premium/final-user prezentacijski model (prioritet: zrelost, kredibilitet i premium osjećaj proizvoda, ne minimalna dužina).
* Kandidat rješava:
  * IPIP
  * SAFRAN
  * MWMS
  * `Timski stil saradnje`
* Postojeći član tima rješava:
  * IPIP
  * SAFRAN
  * MWMS
  * `Timski stil saradnje`
  * `Procjenu timske dinamike`
* Team Dynamics report koristi:
  * agregirane individualne profile članova
  * rezultate `Timskog stila saradnje` članova
  * rezultate `Procjene timske dinamike`
  * consensus/disagreement analizu
* Team Fit report koristi:
  * kandidatov individualni kompozitni profil
  * kandidatov `Timski stil saradnje`
  * agregirani profil postojećeg tima
  * Team Dynamics report / timske rizike
  * zahtjeve uloge
* Team Dynamics premium model (`team_dynamics_assessment_v1`) cilja 4 kratka bloka / oko 12–15 minuta:
  * TDM-31 core
  * TPS7-based Deep Profile psihološka sigurnost (7 itema)
  * Deep Profile originalni SJT mini-test (6 scenarija)
  * Outcome pulse (4 itema)
  * ukupno: 48 assessment jedinica
* TDM-31 core mapping lock (`tdm-31-V1`):
  * canonical naming: `tdm-31-V1` (bez dodataka u nazivu)
  * svih 31 item ulazi u ukupni/core score
  * domenski scorevi koriste samo original-factor 24 itema (Communication 14, Roles and Goals 4, Cohesion 4, Team Primacy 2)
  * `overall / Rasch-only` (7 itema: 11, 12, 13, 21, 24, 27, 31) ulazi samo u ukupni/core score, ne u domenske scoreve
  * reverse itemi: 3, 15, 16, 27
  * Phase 1: linearni 0-100 score nakon reverse scoringa; full Rasch ostaje Phase 2
* TPS7-based psychological safety block decision:
  * user-facing naziv bloka: `Psihološka sigurnost u timu`
  * interni key: `psychological_safety`, model basis: `TPS7-based / Deep Profile original adaptation`
  * 7 pozitivno formulisanih B/H/S itema, bez reverse itema u V1
  * isti 1-4 agreement format kao `tdm-31-V1`; `simple_linear_v1` scoring (`score_0_100 = ((mean_1_4 - 1) / 3) * 100`)
  * team agregacija u V1: mean, `SD`, `range`, `completion_rate`; `AD_M` ostaje optional Phase 2
  * zaseban report sloj; ne ulazi u TDM core score
  * validation status: `validation_pending`; ne tvrditi validaciju kao originalni TPS7
* SJT block decision:
  * user-facing naziv: `Timsko prosuđivanje u situacijama`
  * interni key: `situational_judgment`; model basis: `Deep Profile original SJT`
  * 6 scenarija, 4 opcije po scenariju; `best_worst` format sa izborom najefikasnije i najmanje efikasne reakcije
  * V1 instrukcija je `knowledge_based_should_do` (ne koristiti `šta biste vi najvjerovatnije uradili?`)
  * scoring model: `expert_key_partial_credit_v1`; `Best/Acceptable/Weak/Harmful`, per-scenario `-2 do +4`, total raw `-12 do +24`, `sjt_score_0_100 = ((raw_total + 12) / 36) * 100`
  * missing data: `<4/6` unavailable, `4/6` ili `5/6` pro-rated, `6/6` normalan score
  * zaseban report sloj; ne ulazi u TDM core score; validation status: `validation_pending`
* Canonical content/spec package status:
  * `assessment-packages/team_dynamics_assessment_v1/` je kreiran kao repo-level source of truth za `team_dynamics_assessment_v1`
  * paket zaključava content/scoring metadata i guardrails za 48 jedinica kroz `tdm-31-V1`, `psychological_safety`, `situational_judgment`, `outcome_pulse`
  * paket je trenutno content/spec layer i nije generic DB import/runtime ready dok importer ne podrži mixed-format option catalogs i SJT best/worst runtime
  * read/validation support sada postoji (`content-spec.json` load + mixed pravila + normalized `mixedAssessmentSpec`), ali runtime/import execution podrška i dalje ostaje otvorena
  * sljedeći P1 bloker je `Mixed-format Team Dynamics runtime/import support`
* `team_dynamics_v1_strong` (4 skale / 36 itema) ostaje tehnički scaffold i historijski implementacijski korak, ne finalni instrument model za prezentaciju.
* Team input i report flow:
  * članovi tima popunjavaju Team Dynamics Battery
  * individualni rezultati članova tima se ne prikazuju
  * sistem agregira rezultate na nivou tima i generiše `Timska dinamika` report
  * isti agregirani report kasnije ulazi kao input u relacijski report `Timski fit kandidata`
* Team-member execution route odluka:
  * Team Dynamics execution mora biti wrapper-based preko `team_assessment_participants.id`
  * `attempt_id` je execution payload, ali nije access key
  * direct generic candidate ulaz `/app/attempts/[attemptId]/run` za Team Dynamics mora biti blokiran ili zaštićen wrapper guard-om
* Granica agregiranog vs personalizovanog izlaza:
  * personalizovane smjernice za komunikaciju, motivaciju, feedback, onboarding i razvoj konkretne osobe ne ulaze u `Timska dinamika` report
  * takve smjernice idu u poseban output `Individualni razvojni profil`
  * agregirani Team Dynamics report se ne koristi za individualno targetiranje članova
* Pragovi reporta:
  * user-facing report je dostupan tek od 5 validnih odgovora
  * `indicative` za 3-4 odgovora postoji samo kao interni state
  * za 0-2 validna odgovora report ostaje blocked/nedostupan
* Lider u v0.1:
  * lider se tretira kao team member
  * role se čuva u membershipu
  * nema leader-vs-team delta reporta u v0.1
* Scoring vs AI granica:
  * scoring engine proizvodi `team_snapshot`, `response_coverage`, `scale_scores`, `subscale_scores`, `dispersion_metrics`, `deterministic_insights`
  * AI provider proizvodi samo `ai_interpretation`
  * AI ne računa skorove, ne izmišlja metrike i ne dobija individualne odgovore
* Report ne koristi jedan overall team score; korisnički izlaz je `Team Dynamics Profile / Profil timske dinamike` sa odvojenim domenima:
  * Kohezija i moral
  * Konfliktni obrazac
  * Psihološka sigurnost
  * Koordinacija znanja
  * Timski radni sistem
  * Razvojni fokus
* Guardrails:
  * nema hire/no-hire
  * nema fire/no-fire
  * nema individualnog targetiranja članova
  * nema prikaza individualnih odgovora
  * nema oznaka “loš tim” ili “disfunkcionalan tim”
  * nema kliničkog jezika
  * nema etiketa tipa `loš tim`
  * nema determinističkih tvrdnji
  * nema tvrdnje da rezultat direktno predviđa performanse
  * task conflict se ne tumači automatski kao negativan
  * visoka kohezija se ne tumači automatski kao idealna
* DUTCH odluka:
  * DUTCH / Dutch Test for Conflict Handling je relevantan za conflict-style sloj
  * DUTCH se ne tretira kao kompletan team-fit test
  * DUTCH je kandidat za individualni conflict-style sloj kandidata, conflict-style sloj članova tima, input za relacijski friction model i interview/onboarding hipoteze
  * prije direktne upotrebe DUTCH itema treba provjeriti licencu i prava
* Placeholder/licenca pravilo:
  * pravna pitanja/licence i finalni BHS prevod itema rješavaju se odvojeno od ovog development toka
  * do razrješenja licence i prevoda ne unositi stvarne licencirane iteme u produkcijski repo
  * tehnički scaffold smije koristiti placeholder iteme
* Mock package v0.1 pravilo:
  * koristiti unified 1-5 response skalu
  * scoring engine ne hardkodira 1-5 kao jedinu mogućnost
  * engine ostaje metadata-aware za per-item/per-scale skale
* Data model/scaffold smjer:
  * prvi scaffold uvodi team-specific tabele
  * report lifecycle ostaje što bliži postojećem `assessment_reports` modelu
  * koristiti postojeći attempt/execution model gdje god je moguće
  * dodati team wrapper koji povezuje attempt sa `team_assessment_assignment`
* Product/tech dokument:
  * planirano je dodati i održavati `docs/team-dynamics-product-tech-spec.md` iz Google Doc specifikacije
* Preporučeni MVP smjer (hibridni Deep Profile model):
  1. kandidat radi postojeću Deep Profile bateriju
  2. članovi tima rade kratki Team Dynamics Survey
  3. sistem generiše agregirani report tima
  4. sistem generiše relacijski report kandidat + tim kada postoje oba ulaza
* Ne prelaziti na tehničku implementaciju prije `Team Fit & Dynamics Product Spec v0.1`.

### 5.8 IPIP Likert selected-state politika

* IPIP zadržava auto-advance nakon klika na Likert odgovor.
* `Nastavi` dugme se ne uvodi za IPIP.
* Default stanje je neutralno dugme.
* Hover stanje je lagani preview state.
* Selected stanje je puni teal/green button sa bijelim bold brojem.
* Selected stanje mora ostati jasno vidljivo nakon back-navigation/resume.
* Hover ne smije overrideovati selected styling.

### 5.9 IPIP domain card copy politika

* `Pregled domena` kartice su navigacijski/scannable sloj, ne dodatni interpretacijski pasus.
* Kartice treba da prikazuju title, band, score, score bar, CTA i kratki domain descriptor.
* Body copy ne treba ponavljati naziv domena.
* Detaljna interpretacija ostaje u report sekcijama i detail panelu.

### 5.10 HR report i višejezičnost

* MVP aplikacija i HR report sadržaj trenutno ostaju na bosanskom jeziku.
* HR report architecture mora biti locale-aware od početka.
* `assessmentLocale` označava jezik na kojem kandidat rješava test.
* `participantReportLocale` označava jezik candidate reporta.
* `hrReportLocale` označava jezik HR reporta i/ili HR interfejsa.
* `reportLocale` označava target jezik konkretnog report artefakta.
* Ovi jezici ne moraju uvijek biti isti.
* U MVP-u `attempt.locale` može služiti kao fallback.
* Future HR report generation ne smije dugoročno zavisiti isključivo od `attempt.locale`.
* Za HR report target locale treba dolaziti iz HR user/workspace/report-request locale-a kada takav izvor postoji.
* `attempt.locale` smije biti fallback, ne jedini source of truth.
* Svaki HR report input mora nositi locale.
* Svaki report snapshot mora očuvati jezik u kojem je generisan.
* JSON/schema ključevi trebaju ostati jezički neutralni, preferirano engleski.
* Human-facing vrijednosti se generišu ili renderuju u target locale-u.
* Prompt/version selection mora podržati buduće locale varijante.
* Section titles i standard labels trebaju dolaziti iz kontrolisanog lokalizovanog copy sloja, ne iz AI improvizacije.
* Postojeći snapshot se ne prevodi automatski kada korisnik promijeni app jezik.
* Regeneracija reporta na drugom jeziku je buduća funkcionalnost.
* Budući jezici mogu uključiti hr, sr i en.
* Future HR/composite report input treba moći nositi i assessment locale i report locale kada se razlikuju.

### 5.11 Candidate dashboard attempt selection policy

* Candidate dashboard ne smije birati primarni attempt samo po najnovijem created_at.
* Active in_progress attempt pobjeđuje ako ima stvarni napredak: response_count > 0 ili, za SAFRAN, scored_started_at != null.
* Completed attempt pobjeđuje nad praznim in_progress attemptom.
* Empty in_progress attempt je validan za “Započni procjenu” samo ako nema completed attempta i nema active progress attempta za isti participant/test.
* Abandoned attempt se ne koristi kao primarni dashboard attempt osim ako nema nijednog relevantnijeg zapisa i treba prikazati historijsko/neutralno stanje.
* Dok ne postoji assessment_assignment model, prazan noviji attempt ne smije automatski značiti novu procjenu/rundu.

### 5.12 HR report status i recovery politika

* `ready` znači da HR report artefakt postoji i može se otvoriti.
* `queued` znači `Čeka generisanje`, ne `Generiše se`.
* `processing` znači da worker aktivno obrađuje report.
* `failed` prikazuje `Greška pri generisanju`.
* Completed attempt bez HR report artefakta prikazuje `Nije generisano`.
* Planned / unsupported HR lane prikazuje `Još nije podržano`.
* Incomplete / not assigned / abandoned attempt stanje ne smije izgledati kao missing gotov report.
* Participant report nije HR fallback i nije HR source.
* Failed HR report sa active capability-jem dobija `Ponovo generiši`.
* Missing HR report sa completed attemptom i active capability-jem dobija `Generiši HR izvještaj`.
* Ready / queued / processing nemaju recovery akciju.
* Planned/inactive capability i incomplete attempt nemaju recovery akciju.

### 5.13 HR capability registry politika

* Capability registry odlučuje koji report lane smije biti generisan.
* `ipip-neo-120-v1` i `safran_v1` trenutno imaju active participant i active HR single-test lane.
* `mwms_v1` sada ima active participant lane i active HR single-test lane.
* Completion flow za MWMS HR sada koristi isti capability-driven chain kao IPIP i SAFRAN.
* Failed MWMS HR report se ne retry-a automatski; recovery ostaje ručna akcija.
* Participant report nije HR fallback i nije HR source.
* Completion flow ne smije kreirati duplikat ako HR report red već postoji.
* Completion flow ne retry-a automatski failed HR report red.

---

## 6. Tehnički dug

| Prioritet | Tema                            | Opis                                                                                         | Napomena                                           |
| --------- | ------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| P1        | Composite HR renderer UI debt nakon lokalnog polish-a | Lokalni renderer polish je zatvorio nekoliko funkcionalnih i strukturnih UI problema, ali composite report i dalje nema potpuno zreo, jedinstven vizuelni sistem. Neki dijelovi još izgledaju kao ad-hoc površine i nested kartice. | Dalji rad na composite report UI-ju treba raditi kroz `docs/deep-profile-ui-system.md`, ne kroz izolovane promptove po jednoj sekciji. Sljedeći korak je planski refactor Composite HR report renderera prema UI system dokumentu. |
| P1        | Build-time Google font fetch dependency | Build-time dependency na eksterni `next/font/google` fetch je zatvoren uklanjanjem Google font fetch-a i prelaskom na lokalni fallback font stack. | Build blocker je uklonjen, ali fallback stack treba ručno vizuelno provjeriti u aplikaciji; ovo više nije build blocker. |
| P2        | `components/assessment/assessment-form.tsx` ESLint warnings | Nakon stabilizacije build/boundary i Team Dynamics remote scaffold migracije ostaju postojeći warnings: 2x `@next/next/no-img-element` i 2x `react-hooks/exhaustive-deps`. | Non-blocking tehnički dug; `npm run build` i `npm run typecheck` prolaze. |
| P1        | Snapshot jezičkog oblika        | Oblik obraćanja treba snapshotovati na attempt/report nivou i koristiti u participant promptovima, umjesto ručnog rješavanja po testu. | Slično locale snapshotu.                           |
| P1        | Composite runtime DB/migration verification | Composite schema/table visibility blocker je riješen, a DB-backed mock smoke sa stvarnim queued reportom je potvrđen. | Runtime Supabase vidi composite tabele; ne koristiti `supabase db push` naslijepo dok stare uncertain migracije imaju drift. |
| P1        | Composite report generation pipeline | Composite HR report pipeline sada ima storage, readiness, queue akcije, input builder, worker, contract, mock provider, renderer i OpenAI provider. Mock-backed i OpenAI DB-backed smoke sada prolaze. | Preostali fokus je production worker/report orchestration i eventualno širenje shared language QA sloja na druge report lane-ove. |
| P1        | Composite OpenAI language QA | Foundation + reviewer pass + terminology stabilization su završeni za Composite HR OpenAI provider i potvrđeni OpenAI DB-backed smoke-om. | Renderer ne širiti u generički lektor; provider/language QA sloj ostaje mjesto za AI output kvalitet. Budući dug je rollout shared QA sloja na druge lane-ove kada dođe red. |
| P1        | Automatic report generation orchestration after assessment completion | Completion-triggered orchestration runtime smoke ciklus je završen za MWMS single-test i Composite HR lane; completion event ostaje trigger, report view nije trigger, manual generate/retry nije happy path. | Zatvoreno za runtime potvrdu trenutnog slice-a; dalje širenje trigger modela je posebna buduća odluka i ne ulazi u ovaj ciklus. |
| P1        | Scripted composite smoke requeue utility | Finalni smoke i dalje koristi kontrolisani requeue postojećeg `assessment_reports` row-a jer insert novog row-a za isti assignment udara na `assessment_reports_artifact_identity_unique`; reusable utility script nije dodat u ovom ciklusu. | Nije bug: unique constraint je očekivan. Cilj ostaje reproducibilan QA smoke workflow bez ručnih inline komandi. |
| P1/P2     | Composite provider-copy polish after OpenAI smoke | Kritični runtime blockeri su zatvoreni kroz provider source/evidence lock i AGREEABLENESS canonicalization; OpenAI completion-triggered composite smoke sada završava `ready`. | Ostaviti kao optional quality pass samo ako budući demo/smoke output pokaže novu potrebu; ne vraćati scope na contract/scoring/orchestration. |
| P1        | Composite HR back link / hero cleanup | Završeno | Composite HR report / Renderer / Hero UX | Zatvoreno nakon uvođenja shared `PageNavigation` obrasca, premještanja back linka iz hero kartice iznad hero sekcije i čišćenja hero navigacijskog šuma. |
| P1        | Composite HR summary headline polish | Završeno | Composite HR report / Renderer / Summary headline | Zatvoreno nakon dodavanja jasnog `Glavni zaključak` executive wrappera iznad 2x2 summary grida, uz zadržavanje report contenta i zamjenu hardcoded labela `Kako koristiti izvještaj`. |
| P1        | Composite HR interview/onboarding visual alignment | Završeno / Lokalni renderer polish | Composite HR report / Renderer / Section alignment | Zatvoreno kao lokalni renderer polish nakon dodavanja strukturisanih Intervju i Onboarding kartica sa purpose stripovima i panelima. Estetski pravac nije finalan; budući veći refactor ide kroz `docs/deep-profile-ui-system.md`. |
| P1        | Composite advisory prompt polish | Advisory prompt ciklus je završen: Composite HR OpenAI provider sada vodi prema savjetodavnijem HR radnom dokumentu sa čvršćim hipotezama, konkretnijim provjerama i operativnijim smjernicama. | Safety/source guardraili su zadržani: bez hire/no-hire, fit score-a, automatske preporuke zapošljavanja i bez promjene score/band/evidence source podataka. |
| P1        | Composite BHS narrative casing guardrail | Narrative casing guardrail je završen: u narativu je obavezan prirodan BHS lower-case za domene/dimenzije usred rečenice, dok su display/evidence labeli izuzeti. | QA sada hvata neprirodnu kapitalizaciju u user-facing narativu bez lomljenja labela/čipova. |
| P1        | Composite concise advisory writing polish | Task je završen: prompt i language QA su podešeni za kraći, skenabilniji i akcijski HR izlaz (kraći headline, jasniji profileOverview ritam, akcijski fokus za provjeru, konkretniji onboarding glagoli). | Bez promjene contract/scoring/orchestration/worker/DB; postojeći source/evidence/casing guardraili ostali aktivni i potvrđeni testovima. |
| P2        | HR metadata formatter rollout scope | `lib/dashboard/hr-ui-format.ts` je uveden i trenutno je namjerno ograničen na participant HR reports page metadata blok. | Budući UI polish može proširiti isti helper na composite HR report view, HR dashboard copy i create assessment modal, ali to nije dio commita `e851aad`. |
| P2        | Composite interview guidance V2 | Veći budući task: postojeći interview guidance proširiti sa jasnijim “šta slušati u odgovoru” slojem bez ad-hoc refactora. | Ne pokretati sada; nakon stabilizacije i odluke o narednom demo fokusu. |
| P2        | Composite onboarding 30/60/90 format | Veći budući task: onboarding guidance strukturirati u 30/60/90 format kada bude otvoren širi product slice. | Ne pokretati sada; ostaje odvojen od trenutnog todo sync-a. |
| P2        | Composite visual readability polish (sitniji tekst/evidence čipovi) | Sitniji UI readability polish za tekst i evidence čipove ostaje otvoren kao zaseban budući task. | Ne miješati sa provider/prompt/contract taskovima u kratkim sync ciklusima. |
| P1        | Worker/report auto-processing orchestration | Prvi completion-triggered best-effort orchestration slice je zatvorio osnovni bridge (`enqueue + scoped process attempt`) za postojeće worker path-eve bez nove infrastrukture. | Preostaje runtime smoke i operativna potvrda production ponašanja; ne širiti scope na scheduler/cron/background infrastrukturu u ovom koraku. |
| P1        | Assessment assignment / assessment rounds | Trenutno se standardna procjena modelira kroz skup attemptova. To otežava razlikovanje legitimne nove runde procjene od praznog duplikat attempta. Dugoročno treba uvesti assessment_assignment / assessment_assignment_attempts ili ekvivalentan assessment-level model. | MVP guard sada sprečava da prazan attempt sakrije completed rezultat, ali pravi model rundi treba riješiti ownership, historiju i composite report storage. |
| P1        | Assignment-aware dashboard model | Candidate i HR dashboard trenutno ostaju attempt-based. Zbog toga existing completed attempts i dalje blokiraju kreiranje novog praznog attempta za isti test u novom assignment slice-u. | Da bi novi assessment ciklus mogao uvijek kreirati svježe attempts za sve testove, dashboardi moraju postati assignment-aware i preferirati linked attempts iz active assignmenta. |
| P2        | Attempt creation audit metadata | Novi attempti trenutno mogu imati metadata = {}, što otežava dijagnostiku izvora kreiranja attempta. | Dodati minimalni audit trag, npr. created_by_flow, source, created_by_user_id i reason, posebno za HR standard battery planner i candidate provisioning tokove. |
| P1        | Team Dynamics response scale metadata-awareness + item activation lock | Team Dynamics scaffold koristi unified 1-5 mock skalu, ali scoring engine mora ostati metadata-aware za per-item/per-scale response skale; finalna aktivacija stvarnih itema čeka licencu i finalni BHS prevod. | Dok traje licencni/prevod lock, u repo ulaze samo placeholder itemi i scaffold logika bez stvarnih licenciranih itema. |
| P1        | Individualni razvojni profil — zaseban report lane contract/pipeline | Novi personalizovani output treba ostati odvojen od `Timska dinamika` reporta i imati svoj report contract, prompt/provider flow, guardrails i renderer. | Ne miješati sa postojećim Team Dynamics agregiranim report lane-om; planirati kao zaseban report artefakt i zasebnu implementacijsku traku. |
| P2        | Composite smoke fixture / controlled backfill | Za prvi DB-backed smoke korišten je controlled backfill nad postojećim completed IPIP/SAFRAN/MWMS attemptima jer runtime DB nije imala active standard_battery assignment sa tri linked completed attempts. Ovaj renderer polish nije mijenjao smoke fixture; to ostaje P2 napomena. Kasnije treba testirati flow kroz prirodno kreiran standard battery assignment bez ručnog backfilla. | Smoke fixture služi QA potvrdi runtime toka; ne tretirati kao zamjenu za prirodni assignment lifecycle. |
| P2        | Branch features                 | Trenutno se radi na branchu `features`; main ostaje stabilan.                                | Ne mergati dok report/copy/pitanja nisu dotjerani. |
| P2        | MWMS licenca                    | MWMS tehnički radi, ali komercijalni rollout zavisi od licencnog/pravno-poslovnog odobrenja. | Nije dev blocker, jeste produkcijski blocker.      |

---

## 6.1 GitHub Projects execution workflow

GitHub Issues/Project sync je trenutno pauziran kao default workflow.

Operativni status i redoslijed taskova trenutno se vode u Google Sheets execution trackeru, dok `docs/deep-profile-todo.md` ostaje stabilizovani backlog, kontekst i decision log. GitHub Issues/Projects koriste se samo na eksplicitan zahtjev.

Historijski setup je bio:

Trenutni setup:

* **GitHub Project:** Deep Profile Delivery
* **Owner:** `namchy`
* **Project number:** `2`
* **Project URL:** `https://github.com/users/namchy/projects/2`
* **Repo:** `namchy/ai-psychometric-analyst-1`
* **Model rada:** GitHub Issues + GitHub Project

Labels kreirani za prioritet:

* `priority:P0`
* `priority:P1`
* `priority:P2`
* `priority:P3`

Labels kreirani za area:

* `area:assessment-ux`
* `area:report-ui`
* `area:app-shell`
* `area:auth-ui`
* `area:tech-debt`
* `area:legal`
* `area:process`
* `area:product`
* `area:ai-report`

Prvi test issue uspješno je kreiran i dodat u Project:

* `[P2] Login screen UI polish` / issue `#8`
* status: `Todo`
* labels: `priority:P2`, `area:auth-ui`

Zaključak:

* GitHub Project setup postoji, ali nije aktivni default execution workflow.
* `sync todo` trenutno znači ažurirati `docs/deep-profile-todo.md`; GitHub sync se radi samo kada je eksplicitno tražen.
* Ako se GitHub sync ponovo aktivira za konkretan task, treba prvo provjeriti postojeće issue-e po title-u ili stabilnom markeru u bodyju, da se ne kreiraju duplikati.
* Codex ne interpretira backlog; izvršava traženi sync iz canvas/repo to-do sadržaja.

---

## 7. Kasnije / parking lot

| Tema                   | Ideja                                                          | Kada razmatrati                                                   |
| ---------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| Composite report UI route | Kada composite report dobije renderer, ne gurati ga u `/dashboard/attempts/[attemptId]`. Composite nema prirodan attempt_id. Razmotriti route po `assessment_report_id` ili `assessment_assignment_id`, npr. `/dashboard/assessment-reports/[reportId]`. | Nakon definisanja composite input/schema i renderer sloja. |
| HR-facing MWMS report  | MWMS HR report — osnovni V1 je završen; parking lot zadržava kasnije napredne varijante kao role-specific MWMS guidance ili dublju organizacijsku interpretaciju. | Nakon osnovnog MWMS HR reporta V1 i active HR lane-a. |
| Report visual language | Svaki test treba imati svoj prikladan vizuelni summary.        | Nakon zatvaranja addressing taska i definisanja narednog participant polish sloja. |
| Team-fit / DATCH readiness | Assessment assignment model je namjerno fleksibilan i ne pretpostavlja tačno tri testa. Budući team-fit/DATCH test može se dodati kao dodatni linked attempt kroz `assessment_assignment_attempts`, uz `role_in_assignment` i `required_for_team_fit` signal. | Kada se bude planirao četvrti test ili team-fit sloj. |

---

## 8. Dnevnik završenih odluka

### 2026-05-23 — Mixed-format Team Dynamics execution-ready package shape

Završeno:

* Za `team_dynamics_assessment_v1` dodat je execution-ready package adapter koji iz canonical mixed-format read modela vraća normalized `teamDynamicsExecutionSpec`.
* Likert blokovi sada iz content speca dobijaju package-level option catalog `likert_1_4_agreement` i execution units sa localized item textom, block metadata i scoring metadata signalima (`reverseScored`, `domainGroup`, `domainScored`, `construct`).
* SJT blok sada dobija scenario-level execution units sa ordered `A/B/C/D` opcijama, `best_worst` response formatom i scoring metadata mapama (`bestChoicePoints`, `worstChoicePoints`) izvedenim iz option levela i canonical scoring modela.
* Ovo je i dalje package/read sloj: nema DB importa, execution UI-ja, response persistence-a, scoring runtime-a ni report layera.

### 2026-05-23 — Mixed-format Team Dynamics read-only execution shell wiring

Završeno:

* Dodat je izolovan read-only runtime helper koji iz canonical `teamDynamicsExecutionSpec` vraća deterministički execution shell payload za budući Team Dynamics execution/UI sloj.
* Payload eksplicitno označava mixed-format podršku, shared Likert opcije, scenario-level SJT opcije i da persistence, scoring i report nisu omogućeni u ovom slice-u.
* Execution UI, best/worst response capture, response persistence, scoring runtime, team aggregation i report layer ostaju pending.

### 2026-05-23 — Mixed-format Team Dynamics read/validation support

Završeno:

* Za `team_dynamics_assessment_v1` završen je prvi tehnički mixed-format sloj: package read model i validation support.
* `loadAssessmentPackage(...)` sada može učitati optional `content-spec.json`, validirati mixed-format pravila i vratiti normalized `mixedAssessmentSpec` koji razlikuje Likert blokove i SJT best/worst blok.
* Očuvana je kompatibilnost sa legacy/shared-options paketima.
* Runtime/import execution, per-block/per-question option catalogs, SJT response capture, scoring runtime, team aggregation i report layer ostaju pending.

### 2026-05-23 — Team Dynamics assessment v1 canonical content/spec package

Završeno:

* Kreiran je canonical content/spec package za `team_dynamics_assessment_v1` sa 48 jedinica kroz blokove `tdm-31-V1`, `psychological_safety`, `situational_judgment` i `outcome_pulse`.
* Paket zaključava content, scoring metadata, response formate i guardrails.
* Paket je eksplicitno označen kao content/spec layer, ne kao generic DB import-ready paket, jer postojeći importer još ne podržava mixed-format option catalogs i SJT best/worst runtime.
* Sljedeći P1 bloker je `Mixed-format Team Dynamics runtime/import support`.

### 2026-05-23 — SJT block decision for Team Dynamics

Završeno:

* Za `team_dynamics_assessment_v1` zaključan je Deep Profile originalni SJT blok pod user-facing nazivom `Timsko prosuđivanje u situacijama` i internim key-em `situational_judgment`.
* Blok koristi 6 scenarija, 4 opcije po scenariju i `best_worst` response format.
* V1 instrukcija je `knowledge_based_should_do`: korisnik bira najefikasniju i najmanje efikasnu reakciju.
* Scoring koristi `expert_key_partial_credit_v1` sa opcijama `Best/Acceptable/Weak/Harmful`, per-scenario rasponom `-2 do +4`, total raw rasponom `-12 do +24` i transformacijom `sjt_score_0_100 = ((raw_total + 12) / 36) * 100`.
* SJT je zaseban Team Dynamics report layer, ne ulazi u TDM core score, i ima `validation_pending` status.

### 2026-05-22 — TDM-31 core mapping decision

Završeno:

* Za `team_dynamics_assessment_v1` zaključana je oznaka `tdm-31-V1` i canonical original-factor-mapping pristup.
* Svih 31 itema ulazi u ukupni TDM core score.
* Domenski scorevi koriste 24 itema:
  * Communication 14
  * Roles and Goals 4
  * Cohesion 4
  * Team Primacy 2
* Preostalih 7 itema ulazi samo u overall/Rasch-only scoring.
* Reverse itemi su 3, 15, 16 i 27.
* Phase 1 scoring koristi linearni 0-100 score nakon reverse scoringa; full Rasch scoring ostaje Phase 2.

### 2026-05-22 — TPS7-based psychological safety block decision

Završeno:

* Za `team_dynamics_assessment_v1` zaključan je blok `Psihološka sigurnost u timu` kao Deep Profile originalna TPS7-based skala od 7 pozitivno formulisanih B/H/S itema.
* Blok koristi isti 1-4 agreement response format kao `tdm-31-V1`.
* U V1 nema reverse itema.
* V1 koristi `simple_linear_v1` scoring formulu: `score_0_100 = ((mean_1_4 - 1) / 3) * 100`.
* Na nivou tima agregacija ide kroz team mean, `SD`, `range` i `completion_rate`.
* `AD_M` ostaje optional Phase 2 consensus metric.
* Blok je zaseban report sloj i ne ulazi u TDM core score.

### 2026-05-22 — Team Dynamics premium assessment model

Završeno:

* `Procjena timske dinamike` v1 je zaključana kao premium, final-user prezentacijski model:
  * TDM-31 core
  * TPS7-based psihološka sigurnost
  * 6 originalnih Deep Profile SJT scenarija
  * 4 outcome pulse itema
* Ukupna ciljna dužina je 48 assessment jedinica.
* Postojeći 4-skale/36-item `team_dynamics_v1_strong` ostaje tehnički scaffold, ne finalni instrument.
* User-facing komunikacija ostaje “4 kratka bloka, oko 12–15 minuta”, ne “48 pitanja”.
* Outcome pulse ostaje odvojen kriterijski signal i ne ulazi u isti dijagnostički indeks sa uzročnim/dijagnostičkim skalama.
* Terminološki/licencni lock ostaje: koristiti `TDM-backed`, `TPS7-based` ili `TPS-inspired` dok pravni tim ne potvrdi originalne iteme; SJT ostaje originalni Deep Profile modul u validacijskoj fazi.

### 2026-05-22 — Team Fit / Team Dynamics architecture split

Završeno:

* Deep Profile sada razlikuje tri odvojena, ali povezana sloja:
  * individualni modul `Timski stil saradnje`
  * timski assessment `Procjena timske dinamike`
  * relacijski izvještaj `Timski fit kandidata`
* Potvrđeno je da postojeći `team_dynamics_v1_strong` scaffold ostaje timski assessment sloj.
* Zaključano je da kandidat-facing `Timski stil saradnje` modul ide kroz zaseban product/spec task prije implementacije.
* Zaključano je da Team Fit nije test, nego relacijski report koji koristi više ulaza.

### 2026-05-22 — Team Dynamics run handoff skeleton

Završeno:

* `/run` ruta sada, nakon validiranog wrapper contexta i eventualnog `invited -> started` transitiona, poziva `loadTeamAssessmentRunHandoff(...)`.
* Handoff učitava/builda:
  * `teamAssessmentParticipantId`
  * `teamAssessmentAssignmentId`
  * interni `attemptId`
  * `packageSlug`
  * `testSlug`
  * `testName`
  * `wrapperStatus`
  * `attemptStatus`
  * `activeQuestionCount`
* `/run` UI prikazuje:
  * naziv procjene
  * package label
  * wrapper status
  * attempt status
  * broj aktivnih pitanja
  * poruku da su podaci za rješavanje pripremljeni, ali da rješavanje još nije omogućeno
* Raw `attemptId` se ne prikazuje u UI.
* Handoff ne prikazuje pitanja, answer options, responses, score fields, report artefakte, AI sadržaj, Team Fit output ni podatke drugih članova tima.
* Handoff builder koristi postojeći safe-state resolver.
* `completed`, `expired` i unknown status ne postaju runnable mode.
* Neočekivan question count ulazi u warning handoff state, ne u hard crash.
* Nije uveden pravi run ekran, nije korišten `AssessmentForm`, i nema pitanja, answer options, autosave-a, completiona, scoringa, agregacije, AI providera, renderera, Team Fit-a ni individual report capability-ja.
* Prošle verifikacione komande:
  * `node scripts/test-team-dynamics-run-handoff-skeleton.cjs`
  * `node scripts/test-team-dynamics-run-route-shell.cjs`
  * `node scripts/test-team-dynamics-execution-safe-states.cjs`
  * `node scripts/test-team-dynamics-intro-route-shell.cjs`
  * `node scripts/test-team-dynamics-execution-access.cjs`
  * `node scripts/test-team-dynamics-direct-attempt-route-block.cjs`
  * `node scripts/test-team-dynamics-wrapper-readiness.cjs`
  * `node scripts/test-team-dynamics-privacy-guards.cjs`
  * `node scripts/test-team-dynamics-completion-guard.cjs`
  * `node scripts/test-standard-assessment-battery.cjs`
  * `node scripts/test-candidate-dashboard-team-dynamics-exclusion.cjs`
  * `node scripts/test-report-capabilities.cjs`
  * `node scripts/test-report-orchestration.cjs`
  * `npm run typecheck`

### 2026-05-22 — Team Dynamics execution safe states

Završeno:

* Uveden je centralni Team Dynamics safe-state resolver u `lib/assessment/team-assessment-execution.ts`.
* Intro ruta koristi `resolveTeamAssessmentExecutionShellState({ route: "intro", ... })`.
* `/run` ruta koristi isti resolver i transition helper samo kada `shellState.shouldTransitionToStarted === true`.
* Intro ruta nikada ne mijenja status.
* `/run` ruta radi `invited -> started` samo za `invited`.
* `started` ne ponavlja transition.
* `completed` ne ulazi u aktivni run mode.
* `expired` ne ulazi u aktivni run mode.
* Unknown/nepodržan status se ne tretira kao runnable i vraća safe unavailable state.
* Safe-state matrix pokriva `invited`, `started`, `completed`, `expired` i unknown status.
* Nisu uvedeni pravi run ekran, `AssessmentForm`, pitanja, autosave, completion, scoring, agregacija, AI provider, renderer, Team Fit ili individual report capability.
* Prošle verifikacione komande:
  * `node scripts/test-team-dynamics-execution-safe-states.cjs`
  * `node scripts/test-team-dynamics-run-route-shell.cjs`
  * `node scripts/test-team-dynamics-intro-route-shell.cjs`
  * `node scripts/test-team-dynamics-execution-access.cjs`
  * `node scripts/test-team-dynamics-direct-attempt-route-block.cjs`
  * `node scripts/test-team-dynamics-wrapper-readiness.cjs`
  * `node scripts/test-team-dynamics-privacy-guards.cjs`
  * `node scripts/test-team-dynamics-completion-guard.cjs`
  * `node scripts/test-standard-assessment-battery.cjs`
  * `node scripts/test-candidate-dashboard-team-dynamics-exclusion.cjs`
  * `node scripts/test-report-capabilities.cjs`
  * `node scripts/test-report-orchestration.cjs`
  * `npm run typecheck`

### 2026-05-22 — Team Dynamics intro route shell

Završeno:

* Dodana je ruta `app/(protected)/app/team-assessments/[teamAssessmentParticipantId]/page.tsx`.
* Dodan je statički test `scripts/test-team-dynamics-intro-route-shell.cjs`.
* Ruta koristi `loadTeamAssessmentExecutionContext(...)`.
* Validan wrapper access prikazuje intro shell.
* Nevalidan wrapper/access vraća `notFound()` server-side.
* Ruta potvrđuje wrapper-based access model:
  * `team_assessment_participants.id` je access key / security boundary
  * `attempt_id` nije access key
* Ekran prikazuje samo sigurne informacije:
  * “Procjena timske dinamike”
  * objašnjenje da je procjena dio timske procjene, ne individualni psihološki profil
  * wrapper status
  * package label
  * link nazad na dashboard
* Ekran namjerno ne prikazuje:
  * raw attempt ID
  * druge članove tima
  * individualne odgovore
  * score fields
  * report CTA
  * AI sadržaj
  * Team Fit output
* Ruta ne koristi `AssessmentForm`.
* Ruta ne implementira `/run`.
* Ruta ne mijenja wrapper status.
* Nema `invited -> started` transitiona u ovom slice-u.
* Nema autosave-a, completiona, scoringa, agregacije, AI providera, renderera, Team Fit-a ili individual report capability-ja.
* Prošle verifikacione komande:
  * `node scripts/test-team-dynamics-intro-route-shell.cjs`
  * `node scripts/test-team-dynamics-execution-access.cjs`
  * `node scripts/test-team-dynamics-direct-attempt-route-block.cjs`
  * `node scripts/test-team-dynamics-wrapper-readiness.cjs`
  * `node scripts/test-team-dynamics-privacy-guards.cjs`
  * `node scripts/test-team-dynamics-completion-guard.cjs`
  * `node scripts/test-standard-assessment-battery.cjs`
  * `node scripts/test-candidate-dashboard-team-dynamics-exclusion.cjs`
  * `node scripts/test-report-capabilities.cjs`
  * `node scripts/test-report-orchestration.cjs`
  * `npm run typecheck`

### 2026-05-22 — Team Dynamics wrapper access helper

Završeno:

* Dodan je `lib/assessment/team-assessment-execution.ts`.
* Dodan je `scripts/test-team-dynamics-execution-access.cjs`.
* Helper koristi `team_assessment_participants.id` kao access boundary i vraća samo siguran Team Dynamics execution context.
* Potvrđeno je da je `attempt_id` execution payload, ali nije access key.
* Helper validira:
  * wrapper postoji
  * wrapper ima `attempt_id`
  * wrapper participant je vezan za dati `userId`
  * team membership je active (`is_active=true`, `left_at is null`)
  * assignment je `active`
  * assignment ima `package_slug='team_dynamics_v1_strong'`
  * organization scope se izvodi preko `assignment.team_id -> teams.organization_id`
  * linked attempt postoji
  * linked attempt pripada istom participantu
  * linked attempt pripada istoj organizaciji
  * linked attempt pripada active/is_active `team_dynamics_v1_strong` testu
* Helper odbija:
  * nepostojeći wrapper
  * tuđi wrapper
  * wrapper bez attempta
  * inactive membership
  * non-active assignment
  * wrong package slug
  * attempt/test mismatch
  * organization mismatch
* Helper output ne izlaže responses, score fields, `attempt_reports`, `assessment_reports`, report snapshotove, AI sadržaj, Team Fit podatke ni podatke drugih članova tima.
* Test pokriva happy path i ključne rejection scenarije.
* Nisu implementirani route, UI, run ekran, scoring, agregacija, AI provider, renderer, Team Fit, DUTCH ni individual report capability.
* Prošle verifikacione komande:
  * `node scripts/test-team-dynamics-execution-access.cjs`
  * `node scripts/test-team-dynamics-wrapper-readiness.cjs`
  * `node scripts/test-team-dynamics-action.cjs`
  * `node scripts/test-team-dynamics-create-flow.cjs`
  * `node scripts/test-team-dynamics-linkage.cjs`
  * `node scripts/test-team-dynamics-team-access.cjs`
  * `node scripts/test-team-dynamics-team-detail-read.cjs`
  * `node scripts/test-team-dynamics-privacy-guards.cjs`
  * `node scripts/test-team-dynamics-completion-guard.cjs`
  * `node scripts/test-standard-assessment-battery.cjs`
  * `node scripts/test-candidate-dashboard-team-dynamics-exclusion.cjs`
  * `node scripts/test-report-capabilities.cjs`
  * `node scripts/test-report-orchestration.cjs`
  * `npm run typecheck`

### 2026-05-22 — Team Dynamics team-member execution route readiness/spec

Završeno:

* Završen je read-only/spec task za budući Team Dynamics team-member execution route, bez runtime code promjena.
* Team Dynamics team-member execution mora ići kroz wrapper route, ne kroz generic `/app/attempts/[attemptId]/run`.
* Predložene rute:
  * `/app/team-assessments/[teamAssessmentParticipantId]`
  * `/app/team-assessments/[teamAssessmentParticipantId]/run`
* `team_assessment_participants.id` je access key / security boundary.
* `attempt_id` je execution payload, ali nije access key.
* Wrapper validacija mora pokriti:
  * postojanje wrapper reda
  * ownership preko linked `participant_id` trenutnog usera
  * prisutan `attempt_id`
  * active membership (`is_active=true`, `left_at is null`)
  * active assignment
  * `package_slug='team_dynamics_v1_strong'`
  * organization scope preko `team_assessment_assignments.team_id -> teams.organization_id`
  * linked attempt pripada istom participantu, organizaciji i Team Dynamics testu
* Direct `/app/attempts/[attemptId]/run` ulaz za Team Dynamics mora biti eksplicitno blokiran ili zaštićen wrapper guard-om.
* Status model koristi postojeću šemu:
  * wrapper statusi: `invited`, `started`, `completed`, `expired`
  * prvi ulaz: `invited -> started`
  * completion: `started -> completed`
  * ne koristiti `in_progress` kao wrapper status
* Team Dynamics completion ne smije enqueue-ati participant individual report, HR individual single-test report, Composite HR report, `attempt_reports` ni `assessment_reports single_test`.
* Budući team aggregation/report lifecycle ostaje poseban kasniji slice.
* Spec nije implementirao route, scoring, agregaciju, AI provider, renderer, Team Fit, DUTCH ni individual report capability.

### 2026-05-22 — Team Dynamics SQL-backed wrapper lifecycle smoke

Završeno:

* SQL-backed wrapper lifecycle smoke je pokrenut kroz Supabase SQL Editor.
* Smoke je izvršen sa `BEGIN ... ROLLBACK`, bez trajnih upisa testnih redova.
* Finalni rezultat smoke-a:
  * `result = SQL_TD_WRAPPER_WITH_ATTEMPTS_SMOKE_OK_ROLLBACK_PENDING`
  * `organization_id = 5d93f3a1-3765-4ec4-b668-c0d1228a8445`
  * `team_id = f2268d59-39e0-42ec-984e-ace91bc00cb7`
  * `assignment_id = 96b5cc0e-20ad-461d-bc19-8f2b783b4ecd`
  * `smoke_attempt_count = 2`
  * `wrapper_count = 2`
  * `linked_attempt_count = 2`
* Smoke je dokazao da DB wrapper lifecycle može kreirati privremeni team, team memberships, `team_assessment_assignments`, Team Dynamics `attempts`, `team_assessment_participants` wrapper redove i link wrappera prema attemptima.
* Potvrđena je stvarna šema:
  * `team_assessment_assignments` nema `organization_id`
  * organization scope ide preko `team_id -> teams.organization_id`
  * `team_assessment_participants.status` koristi `invited`
  * wrapper redovi imaju popunjen `attempt_id`
* Smoke nije pozvao `createTeamDynamicsAssessmentAction` i nije zamjena za app action DB-backed smoke.
* App action DB-backed smoke ostaje otvoren/blokiran dok lokalni Supabase/Docker stack ne bude dostupan.

### 2026-05-22 — Team Dynamics wrapper readiness test

Završeno:

* Dodan je novi script-level test `scripts/test-team-dynamics-wrapper-readiness.cjs`.
* Test eksplicitno tretira `team_dynamics_v1_strong` kao active DB test (`status='active'`, `is_active=true`) i spaja active fixture sa wrapper-only create/read path-om i postojećim individual guardrail pravilima.
* Test potvrđuje wrapper flow kroz `team_assessment_assignments` i `team_assessment_participants`, te potvrđuje da participant wrapper statusi mogu postojati bez individualnog candidate dashboard entry path-a.
* Test potvrđuje da admin/team detail read path prikazuje samo team assignment i wrapper participant statuse, bez raw attempt ID-jeva, individual responses/score polja, report CTA-a, AI report contenta ili Team Fit outputa.
* Test dodatno zaključava da helper ne čita `attempts`, `responses`, `attempt_reports` ni `assessment_reports`.
* Test potvrđuje da `canUseGenericCandidateAttemptCreation(...)` ostaje blokada za individual candidate entry path Team Dynamics-a i kada active availability može biti `add_on_available`.
* Test potvrđuje da `planPostCompletionReportJobs(...)` za Team Dynamics ne enqueue-a ništa ni kada fixture sadrži existing individual queued/ready artefakte.
* Nije bilo runtime feature promjena, DB write-a ni promjena migracija.
* Prošao je relevantan test paket uključujući novi wrapper readiness test i `npm run typecheck`.

### 2026-05-22 — Team Dynamics active DB guardrail hardening

Završeno:

* Nakon potvrde da je `team_dynamics_v1_strong` već importovan i aktivan u runtime DB-u, pojačani su postojeći guardrail testovi da eksplicitno tretiraju Team Dynamics kao active DB test i potvrde da ne ulazi u individualne tokove.
* Pojačanja su urađena bez runtime code promjena.
* Promijenjeni su samo test fajlovi: `scripts/test-team-dynamics-privacy-guards.cjs`, `scripts/test-standard-assessment-battery.cjs`, `scripts/test-candidate-dashboard-team-dynamics-exclusion.cjs`, `scripts/test-report-capabilities.cjs`.
* Standard battery guardrail sada eksplicitno pokriva active/is_active Team Dynamics scenario i potvrđuje da standard individual battery ostaje IPIP/SAFRAN/MWMS.
* Candidate dashboard guardrail potvrđuje da active Team Dynamics može imati `add_on_available`, ali ostaje skriven i bez CTA obrazaca `Započni procjenu`, `Nastavi procjenu`, `Pogledaj rezultate`.
* Privacy guard potvrđuje da generic candidate attempt creation ostaje blokiran za Team Dynamics i da se taj guard izvršava prije candidate availability grane.
* Report capability guardrail potvrđuje da Team Dynamics nema participant/HR individual single_test capability i da se ne enqueue-a ništa ni uz existing queued/ready artefakte u fixture-u.
* Completion/orchestration guardrail ostaje pokriven kroz postojeće testove i capability plan: Team Dynamics ne proizvodi individualne post-completion report jobove.
* Relevantni test paket prolazi, uključujući package validation, Team Dynamics guardrail testove, report orchestration test i `npm run typecheck`.

### 2026-05-22 — Team Dynamics active DB import verification

Završeno:

* Runtime DB read-only provjera je potvrdila da `team_dynamics_v1_strong` već postoji u runtime DB-u i da je aktivan na nivou `public.tests`.
* Potvrđen `public.tests` row: `slug='team_dynamics_v1_strong'`, `category='behavioral'`, `status='active'`, `is_active=true`, `updated_at='2026-05-20 09:14:05.939+00'`.
* Potvrđen DB content footprint: 4 dimenzije, 36 pitanja, 180 answer options, 0 promptova.
* Potvrđene BS lokalizacije: 36 question localizations i 180 answer option localizations.
* Prompt duplicate check vraća no rows.
* Report footprint check potvrđuje `attempt_reports=0` i `assessment_reports` single_test footprint `=0` za Team Dynamics.
* Code-level guardrail test paket prolazi prema zadnjem Codex audit izvještaju.
* Zaključak: kontrolisani import/readiness plan više nije sljedeći Team Dynamics korak; sljedeći korak je post-import active DB guardrail hardening i odluka o prvom team-only runtime execution slice-u.

### 2026-05-19 — Team Dynamics scaffold remote DB migration applied and verified

Završeno:

* Remote Supabase migracija `supabase/migrations/20260519120000_add_team_dynamics_scaffold.sql` je primijenjena i verifikovana.
* Remote schema sada ima Team Dynamics tabele `teams`, `team_memberships`, `team_assessment_assignments` i `team_assessment_participants`.
* Verifikovani su triggeri `set_teams_updated_at`, `set_team_memberships_updated_at`, `set_team_assessment_assignments_updated_at` i `set_team_assessment_participants_updated_at`.
* Verifikovani su SELECT RLS policy-ji `teams_read_member`, `team_memberships_read_member`, `team_assessment_assignments_read_member` i `team_assessment_participants_read_member`.
* Nakon migracije `npm run typecheck` i `npm run build` prolaze.
* Placeholder package support je potvrđen i guardrails su ojačani; sljedeći implementation korak više nije kreiranje placeholder paketa nego zasebno definisan uski Team Dynamics runtime/admin slice, bez širenja scope-a na scoring, Team Fit relacijski report ili AI report.

### 2026-05-20 — Team Dynamics placeholder package guardrails hardened

Završeno:

* Potvrđeno je da Team Dynamics placeholder package već postoji i validira se, zatim su ojačani guardrail testovi tako da `team_dynamics_v1_strong` ostaje team-only scaffold van standard individual battery-ja, individual report capability path-eva i candidate individual attempt/report flow-a.
* Nisu dodani scoring, agregacija, AI provider, renderer, Team Fit logika, DUTCH implementacija, licensed itemi ni DB migracija.

### 2026-05-20 — Team Dynamics admin detail page added

Završeno:

* Dodat je org-scoped Team Dynamics admin detail page na `/dashboard/teams/[teamId]`, uz narrow read helper i wrapper-only status UI za napredak timske procjene.
* Stranica prikazuje samo team, assignment i participant wrapper status podatke, bez izlaganja raw attempts, responses, scoreova, reporta, AI sadržaja ili individualnih rezultata članova.
* Postojeći standard battery, candidate flow, report capability i post-completion guardrails ostaju nepromijenjeni.

### 2026-05-20 — Team Dynamics DB-compatible category fallback selected

Završeno:

* Category/import audit je potvrdio da `public.tests.category` trenutno dozvoljava samo `personality`, `behavioral` i `cognitive`, dok je `team_dynamics_v1_strong` prethodno koristio package category `team_dynamics`.
* Za MVP import kompatibilnost Team Dynamics sada koristi `category: "behavioral"` kao DB storage fallback, dok canonical team-only semantika ostaje u slug-u, `intended_use`, `report_family`, metadata sloju, Team Dynamics spec-u i slug-based runtime guardrailima.
* Nisu dodani DB migracija, import, aktivacija, scoring, agregacija, report, AI, Team Fit ni team-member execution rad.

### 2026-05-19 — Build stabilnost nad eksternim Google font fetch-om

Završeno:

* Odlučeno je da build stabilnost ima prioritet nad build-time Google font fetch dependency-jem.
* Uklonjen je `next/font/google` build-time fetch i prebačeno je na lokalni fallback font stack kroz `lib/fonts.ts` i `app/globals.css`.
* `npm run build` i `npm run typecheck` prolaze nakon izmjene.
* Postojeći ESLint warnings u `components/assessment/assessment-form.tsx` ostaju tehnički dug i nisu build blocker.

### 2026-05-18 — Individualni razvojni profil kao poseban personalizovani output

Završeno:

* Zaključeno je da Team Dynamics report ostaje agregiran na nivou tima, dok personalizovane smjernice za komunikaciju, motivaciju, feedback, onboarding i razvoj konkretne osobe idu u poseban output: Individualni razvojni profil.

### 2026-05-18 — Team Dynamics Product/Tech Spec v0.1 i implementacijski lock

Završeno:

* User-facing nazivi su zaključani:
  * modul: `Timovi`
  * assessment: `Procjena timske dinamike`
  * report: `Timska dinamika`
* Zaključana je terminologija za tri report tipa:
  * `Kompozitni profil kandidata` (kandidat; `Kakav je kandidat?`)
  * `Timska dinamika` (tim; `Kakav nam je tim?`)
  * `Timski fit kandidata` (kandidat + konkretan tim; `Kako će se kandidat uklopiti u tim?`)
* Zaključan je Team Dynamics Battery v1 strong / knowledge-team:
  * PCS (6) + Jehn ICS-8 (8) + TPS-7 (7) + Lewis TMS (15) = 36 itema
  * baterija od četiri skale objedinjena u jedan Deep Profile timski proces i agregirani report
  * predloženi slug: `team_dynamics_v1_strong`
* Potvrđena je produktna granica:
  * team fit nije jedan izolovan test, nego sistemska obrada tima i kandidata
  * kompozitni report ostaje individualni opis kandidata
  * agregirani report opisuje tim kao sistem
  * relacijski report poredi kandidata sa konkretnim timom
* Zaključani su team-report pragovi i granularnost:
  * user-facing report tek od 5 validnih odgovora
  * `indicative` (3-4) je interni state
  * 0-2 odgovora = blocked/nedostupan report
  * nema jednog overall team score-a; report ostaje profil po domenima
* Lider v0.1:
  * lider se tretira kao član tima
  * role ostaje u membership sloju
  * nema leader-vs-team delta reporta u v0.1
* Zaključana scoring/AI granica:
  * scoring daje strukturisane metrike i deterministic insights
  * AI daje samo `ai_interpretation`
  * AI ne dobija individualne odgovore i ne računa skorove
  * AI input ostaje striktno agregiran deterministički sloj, bez individualnih odgovora članova
* DUTCH je pozicioniran kao conflict-style sloj, ne kao kompletan team-fit test:
  * može biti input za kandidata, tim i relacijski friction model
  * može podržati interview/onboarding hipoteze
  * licenca i prava moraju biti provjereni prije direktne upotrebe itema
* Placeholder/licencni lock:
  * dok se ne zatvore licenca i finalni BHS prevod, u repo ne ulaze stvarni licencirani itemi
  * scaffold može koristiti placeholder iteme
  * prvi mock package koristi unified 1-5 skalu, ali scoring engine mora ostati metadata-aware za per-item/per-scale skale
* Zaključan je preporučeni MVP smjer (hibridni model):
  1. kandidat radi postojeću Deep Profile bateriju
  2. članovi tima rade kratki Team Dynamics Survey
  3. sistem generiše agregirani report tima
  4. sistem generiše relacijski report kandidat + tim kada postoje oba ulaza
* Implementacijski lock:
  * ne otvarati tehničku implementaciju prije `Team Fit & Dynamics Product Spec v0.1`
* `Team Dynamics data model scaffold and placeholder package support` je djelimično završen (DB scaffold + placeholder package + guardrails + admin detail slice + candidate dashboard exclusion + DB category compatibility patch), a runtime DB read-only verifikacija je kasnije potvrdila da je `team_dynamics_v1_strong` već importovan i aktivan u `public.tests`; nakon post-import active DB guardrail hardeninga i wrapper readiness testa, SQL-backed wrapper lifecycle smoke je dodatno potvrđen kroz Supabase SQL Editor uz `BEGIN ... ROLLBACK`, dok app action DB-backed smoke za `createTeamDynamicsAssessmentAction` ostaje otvoren/blokiran dok lokalni Docker/Supabase stack ne bude dostupan.

### 2026-05-18 — HR report UI polish sync (`e851aad`)

Završeno:

* Evidentiran commit `e851aad` (`Polish HR report navigation and metadata display`).
* Composite HR report navigation polish je zatvoren:
  * back link je izvađen iz hero kartice
  * prikazan je diskretno iznad hero sekcije
  * hero je ostao čišći i fokusiraniji
* Participant HR reports page navigation polish je zatvoren:
  * uklonjen je višesegmentni breadcrumb
  * uveden simple text/ghost back link `Nazad na HR dashboard`
  * uklonjen je redundantni gornji meta label
  * zategnut je spacing iznad hero sekcije
* Participant HR reports metadata polish je zatvoren:
  * uveden `lib/dashboard/hr-ui-format.ts`
  * uklonjeni su raw `Attempt`, raw status `completed` i ISO timestamp iz pojedinačnih HR report kartica
  * metadata prikaz je sada `ID procjene`, `Status procjene`, `Završeno`
  * datum/vrijeme prikazuje se kao `dd.MM.yyyy, HH:mm`
  * statusi su lokalizovani (npr. `completed` -> `završeno`)
* Važna granica scope-a:
  * helper je trenutno primijenjen samo na participant HR reports page
  * širenje na composite HR report view, HR dashboard copy i create assessment modal ostaje mogući kasniji polish

### 2026-05-15 — Deep Profile UI system i Composite HR renderer polish

Završeno:

* Uveden je `docs/deep-profile-ui-system.md` kao implementation-facing source of truth za Deep Profile UI.
* Dokument formalizuje:
  * product visual direction
  * color semantics
  * typography
  * surface/card sistem
  * shadows
  * CTA/button states
  * status pills/chips
  * PageNavigation
  * report page layout patterns
  * BHS UX copy rules
  * Codex implementation rules
* Zaključeno je da Codex ne smije donositi dizajn odluke; budući UI taskovi moraju biti specificirani kroz UI system.
* Emerald/green je zabranjen kao dominantna hero/section atmosfera; emerald ostaje success/status boja.
* Riječ “nalaz” je zabranjena u HR/psihometrijskom UI copyju, osim ako bi se nekad eksplicitno radilo o medicinskom kontekstu.
* Završeni su lokalni Composite HR renderer polish slice-ovi:
  * PageNavigation/back link cleanup
  * dashboard CTA hover/focus contrast hardening
  * HR participant reports page copy/layout cleanup
  * Composite HR participant identity wiring
  * Composite summary “Glavni zaključak” wrapper
  * “Kako koristiti nalaz” → “Kako koristiti izvještaj”
  * Intervju/Onboarding lokalni visual alignment
* Zabilježen je product zaključak:
  Lokalni polish nije dovoljan za finalni premium report UI. Sljedeći UI rad treba biti sistemski refactor Composite HR report renderera prema `docs/deep-profile-ui-system.md`.

Promijenjeni fajlovi:

* `docs/deep-profile-ui-system.md`

Verifikacija:

* nije pokretan code/test workflow; sync je docs-only

### 2026-05-14 — Composite HR report visual/UI polish ciklus završen (Sažetak + Integrisani signali)

Završeno:

* Composite HR report je nakon AI/content polish-a prebačen u vizuelno zreliji report UI.
* Sekcija “Integrisani signali” je redizajnirana iz dokumentnog toka u analitički 3-modulni layout:
  * Šta znači u radu
  * Šta HR treba provjeriti
  * Dokazi iz procjena
* Uklonjen je user-facing “hipoteza” copy iz sekcije i zamijenjen konkretnijim “radni signali” framingom.
* Signal 1/2/3 badgevi su smireni i sekundarni; naslov signala je glavni vizuelni info.
* Evidence je prebačen u treći modul i prikazuje se kao skenabilan data/evidence panel.
* Uvedena je semantička upotreba Deep Profile palete:
  * emerald za “Šta znači u radu”
  * golden-pollen za “Šta HR treba provjeriti”
  * ocean-blue za “Dokazi iz procjena”
  * dark-teal za autoritet/naslove
* Sekcija “Sažetak” je redizajnirana u 2x2 executive dashboard:
  * Ključne snage
  * Fokus za provjeru
  * Glavni signal
  * Kako koristiti izvještaj
* “Ključne snage” su pomjerene na prvo mjesto i vizuelno pojačane kao glavni pozitivni executive ulaz.
* “Fokus za provjeru” koristi golden-pollen kao interview attention bez warning/alert tona.
* “Glavni signal” koristi ocean-blue kao analitički/interpretativni signal.
* “Kako koristiti izvještaj” koristi dark-teal/blue-teal action/use treatment.
* Sve promjene su ostale u renderer/display sloju.

Promijenjeni fajlovi:

* `components/dashboard/composite-hr-report-view.tsx`
* `scripts/test-composite-hr-report-renderer.cjs`

Verifikacija:

* `npm run typecheck`
* `node scripts/test-composite-hr-report-renderer.cjs`

Trenutna procjena:

* Report sada ima znatno bolji vizuelni identitet i dovoljno je dobar za internu demo prezentaciju.
* Integrisani signali i Sažetak sada više liče na HR intelligence report, a manje na običan dokument.
* Još nije finalni premium UI.
* Preostali vidljivi problemi:
  * hero/header još izgleda generički
  * “Nazad na pregled kandidata” treba biti ghost back link iznad hero sekcije
  * summary headline treba bolju vizuelnu težinu i vezu sa executive gridom
  * Intervju i Onboarding vizuelno zaostaju
  * report i dalje ima dosta mekih/mliječnih površina

Novi preporučeni sljedeći korak:

* Refactor Composite HR report prema `docs/deep-profile-ui-system.md`.

### 2026-05-14 — Composite HR concise advisory writing polish završen

Završeno:

* Composite HR provider prompt je dodatno pojačan za kraći, skenabilniji i akcijski HR stil.
* Dodana su pravila za:
  * kraći summary headline
  * `summary.profileOverview` sa jasnijom 3-rečeničnom logikom
  * akcijski “Fokus za provjeru”
  * kraće i konkretnije “Šta HR treba provjeriti”
  * konkretnije onboarding/menadžerske smjernice
* Language QA sada ima minimalni summary writing guardrail:
  * predug headline pada
  * “Područje za dodatnu provjeru je” ne prolazi kao summary focus stil
  * summary mora imati barem jednu akcijsku HR konstrukciju
* Amrin Composite HR report je regenerisan nakon promjena.
* Vizuelna/sadržajna provjera potvrđuje:
  * kraći i skenabilniji headline
  * akcijski početak “Fokus za provjeru”
  * kratak i jasan “Glavni signal”
  * instrukcioniji ton u “Šta HR treba provjeriti”
  * jasnije menadžerske glagole u onboarding smjernicama
* Report je sada dovoljno dobar za demo HR korisniku.

Promijenjeni fajlovi:

* `lib/assessment/composite-hr-report-provider-openai.ts`
* `lib/assessment/report-language-quality.ts`
* `scripts/test-composite-hr-report-provider-openai.cjs`
* `scripts/test-report-language-quality.cjs`

Verifikacija:

* `npm run typecheck`
* `node scripts/test-composite-hr-report-provider-openai.cjs`
* `node scripts/test-report-language-quality.cjs`
* `node scripts/test-composite-hr-report-contract.cjs`
* `node scripts/test-report-orchestration.cjs`

Naredni korak:

* Ne otvarati odmah novi veliki Composite HR refactor.
* Prvo odraditi kratku stabilizaciju i commit/push ciklus.
* Nakon toga odlučiti da li sljedeći fokus ide na demo readiness ili `Composite HR interview guidance V2`.

### 2026-05-14 — Composite HR AI polish ciklus zatvoren (advisory prompt + BHS narrative casing)

Završeno:

* Composite HR OpenAI provider prompt je pojačan da report bude više savjetodavni HR radni dokument.
* Prompt sada traži čvršće HR hipoteze, konkretnije intervju provjere i operativnije onboarding/menadžerske smjernice.
* Zadržani su safety/source guardraili:
  * bez hire/no-hire presuda
  * bez fit score-a
  * bez automatske preporuke za zapošljavanje
  * bez mijenjanja score vrijednosti, bandova ili evidence source podataka
* Dodan je BHS narrative casing guardrail:
  * display/evidence label može biti “Spremnost na saradnju”
  * narativ usred rečenice mora koristiti “spremnost na saradnju”
  * “Savjesnosti” / “Spremnosti na saradnju” usred rečenice ne prolazi QA
* Language QA sada hvata neprirodnu BHS kapitalizaciju domena/dimenzija u narativnim user-facing poljima.
* Evidence/display labeli su izuzeti iz tog casing pravila kako čipovi i labele ostaju stabilni.
* Amrin Composite HR report je regenerisan preko OpenAI-ja nakon prompt/casing promjena.
* Novi output je vidljivo savjetodavniji (jači executive summary, konkretniji fokus za provjeru, bolji interview guidance, operativnije onboarding/menadžerske smjernice).

Verifikacija:

* `npm run typecheck`
* `node scripts/test-composite-hr-report-provider-openai.cjs`
* `node scripts/test-report-language-quality.cjs`
* `node scripts/test-composite-hr-report-contract.cjs`
* `node scripts/test-report-orchestration.cjs`

Sljedeći fokus:

* `Composite HR concise advisory writing polish` (čitljivost i ritam) bez promjene contract/scoring/orchestration/DB schema/worker/renderer sloja osim ako je neophodno.
* Ne širiti scope na Interview Guidance V2 ili Onboarding 30/60/90 u ovom syncu.

### 2026-05-14 — Product/copy odluka: Composite HR report kao savjetodavni HR radni dokument

Odluka:

* Composite HR report ne treba biti samo metodološki oprezan sažetak psihometrijskih rezultata.
* Composite HR report treba biti HR radni dokument sa jačom savjetodavnom ulogom.
* Cilj je da HR korisnik jasno zna: najvažniji signal, šta prvo provjeriti u intervjuu, koje obrasce potvrditi/opovrgnuti, gdje je vjerovatan učinak i rizik, te kako menadžer postavlja prioritete, očekivanja, podršku i onboarding.
* Ton ostaje stručan, savjetodavan, konkretan, HR-operativan i metodološki siguran.
* I dalje ostaje zabrana hire/no-hire presude, fit score-a i automatske preporuke za zapošljavanje.
* Izbjegavati pretjerano defanzivan jezik koji konstantno zvuči kao “možda”.

Dogovoreni sljedeći koraci:

1. Prvo `Composite HR report summary structure polish` kao mali renderer/display task.
2. Zatim `Composite HR report advisory strength polish` kao širi copy/advisory task.

### 2026-05-14 — Runtime smoke ciklus zatvoren: completion-triggered orchestration + Composite HR provider consistency

Završeno:

* MWMS completion-triggered orchestration runtime smoke je prošao.
* Stvarni protected completion flow završio je MWMS attempt i bez report-view triggera proizveo HR `attempt_report` koji je završio `ready`.
* Composite completion-triggered smoke je prvo bio `PARTIAL`: completion trigger, readiness, `assessment_reports` row kreiranje i worker processing su radili, ali OpenAI composite generation je pala na provider/reviewer consistency.
* Prvi blocker bio je source-integrity mismatch za Neuroticizam evidence value.
* Dodan je provider source/evidence lock:
  * deterministic evidence catalog
  * locked evidence values prije reviewer faze
  * regression test za Neuroticism mismatch
* Drugi blocker bio je AGREEABLENESS glossary violation zbog “Ugodnost”.
* Dodan je canonicalization fix tako da AGREEABLENESS user-facing evidence koristi “Spremnost na saradnju”.
* Composite language QA sada skenira user-facing report polja, ne internal/source helper objekte.
* Ponovljeni composite worker smoke za `assessment_report_id=fe22ed8b-460c-4273-9dd8-6bee56d8c645` završio je `ready` sa:
  * `generator_type=openai`
  * `model_name=gpt-5.4`
  * `failure_code=null`
  * `failure_reason=null`
* Report view nije korišten kao trigger.
* Manual generate/retry nije korišten kao happy path.
* Orchestration helper nije mijenjan tokom provider fix-eva.
* DB schema, scoring, renderer i dashboard UI nisu mijenjani.

Naredni korak:

* Composite HR report watchout wording/UI polish kao mali renderer/copy task bez promjene provider/contract/scoring/orchestration sloja.

### 2026-05-14 — Production worker/report orchestration: prvi best-effort completion slice

Task:

* Production worker/report orchestration / completion-triggered report orchestration

Status:

* Završeno / prvi best-effort completion slice

Završeno:

* dodat je server-side helper `lib/assessment/report-orchestration.ts`
* completion flow sada poziva orchestration helper nakon uspješnog scoring/results persistence-a
* helper je best-effort i ne ruši completion flow ako report orchestration padne
* single-test HR reportovi se nakon completion eventa mogu enqueue/process kroz postojeći `attempt_reports` worker path
* composite HR report enqueue/process pokušava se samo kada assignment postane composite-ready
* composite readiness i dalje koristi samo linked required attempts iz istog `assessment_assignment` ciklusa
* report view nije trigger
* manual generate/retry ostaje recovery alat
* failed reportovi se ne retry-aju automatski
* existing `queued`/`processing`/`ready` reportovi se ne dupliciraju
* nisu mijenjani DB schema, scoring, provider contracti, renderer ili dashboard UI

Promijenjeni fajlovi:

* `app/actions/assessment.ts`
* `lib/assessment/report-orchestration.ts`
* `scripts/test-report-orchestration.cjs`

Testovi:

* `npm run typecheck`
* `node scripts/test-report-capabilities.cjs`
* `node scripts/test-assessment-reports.cjs`
* `node scripts/test-assessment-assignments.cjs`
* `node scripts/test-assessment-report-worker.cjs`
* `node scripts/test-mwms-hr-report-worker.cjs`
* `node scripts/test-report-orchestration.cjs`

Sljedeći korak:

* runtime smoke za completion-triggered orchestration: dokazati da completed attempt pokreće očekivani report enqueue/processing tok bez oslanjanja na report view i bez ručnog manual generate happy patha

### 2026-05-13 — Completion event kao trigger za report orchestration

Odluka:

* Report generation orchestration treba biti pokrenut completion eventom, ne otvaranjem report view-a.
* Nakon completed single-test attempta, sistem treba automatski pripremiti HR single-test report za active HR lane.
* Nakon što su sva required tri testa completed u istom assignmentu, sistem treba automatski pripremiti Composite HR report.
* HR korisnik u normalnom happy pathu treba zateći ready izvještaj.
* Manual generate/retry ostaje recovery alat za missing/failed edge cases.

Racionala:

* Completion je sistemski događaj i pouzdan trigger.
* Report view je samo konzumacija artefakta, ne smije biti uslov za generisanje.
* HR je primarni kupac i ne treba čekati generisanje ako je kandidat već završio procjenu.

### 2026-05-13 — Composite HR OpenAI language QA i DB-backed smoke završeni

Završeno:

* uveden shared BHS report language-quality helper
* helper uključuje core pravila, Composite HR profil, glossary smjernice i structured issues output
* Composite HR OpenAI provider koristi shared language rules u promptu
* provider ima language QA gate prije finalnog outputa
* uveden self-review / reviewer pass kao drugi structured OpenAI call
* reviewer provjerava BHS HR jezik, terminologiju, HR safety, source integrity i user-facing clarity
* AGREEABLENESS label je zaključan kao “Spremnost na saradnju”
* “Ugodnost” i “Saradljivost” su zabranjeni
* “Saradnja” je dozvoljena kao obična narativna riječ, ali ne kao label-like zamjena za AGREEABLENESS
* feminine agreement guardrail je sužen na user-facing narrative polja
* reviewer ne tretira raw sourceSnapshot legacy labels kao user-facing wording
* ASCII-only BHS forme ne padaju samo zbog nedostatka dijakritika ako je wording inače prirodan
* prvi OpenAI smoke je otkrio provider QA blockere i završio failed
* nakon stabilization fixa ponovljeni OpenAI DB-backed smoke je prošao ready
* realni assessment_report `98e89663-5692-45a6-9ca7-1bc60da51a63` prošao je `queued → processing → ready`
* persisted `input_snapshot` i `report_snapshot` postoje
* `generated_at` i `completed_at` su postavljeni
* `failure_code` i `failure_reason` su null
* `generator_type=openai`, `model_name=gpt-5.4`
* persisted `report_snapshot` prolazi contract validator i shared language QA
* forbidden phrase scan je čist
* HR renderer route vraća 200 i prikazuje ready Composite HR report za HR usera sa membershipom

Odluke:

* Jezički kvalitet OpenAI report outputa ostaje provider/language QA odgovornost, ne renderer odgovornost.
* Shared language-quality helper je prvi centralni “lektor” sloj za buduće AI report outpute, ali se ne širi na druge lane-ove bez zasebnog taska.
* Reviewer pass je dodatna provider-level kapija, ne zamjena za contract validator ili source integrity checks.
* “Saradnja” se ne zabranjuje globalno jer je prirodna riječ, ali se ne smije koristiti kao label za AGREEABLENESS.
* OpenAI DB-backed smoke je sada potvrđen; sljedeći runtime fokus prelazi na production worker/report orchestration.
* Watchout wording/UI polish ostaje zaseban UX/copy task.
* Provider-copy polish ostaje opcionalan i evidence-driven ako budući demo/smoke output pokaže potrebu.

Racionala:

* Validan JSON nije dovoljan za HR-facing AI report; jezik mora biti profesionalan, prirodan i terminološki stabilan.
* Preširok blacklist stvara false positives, zato se pravila moraju razlikovati između label-like polja i običnog narativa.
* Smoke treba dokazati stvarni DB-backed tok kroz storage, worker, provider, validator, language QA, reviewer i renderer.
* Nakon ovog ciklusa Composite HR report ima potvrđen mock + OpenAI runtime path, ali još nema produkcijsku background orchestration strategiju.

### 2026-05-13 — Composite renderer polish i OpenAI language QA odluka

Završeno:

* dodatno polirana sekcija “Integrisana interpretacija”
* uklonjen nepotrebni lijevi marker/border iz insight panela
* insight paneli su vizuelno smireniji i bolje balansirani
* evidence/dokazi iz procjena su spušteni na sekundarni vizuelni nivo
* evidence chipovi su manji i manje dominantni
* “Ugodnost” / `AGREEABLENESS` se display-only mapira u “Spremnost na saradnju” ili “Saradljivost”
* provider, worker, contract, scoring i route/access guard nisu mijenjani

Novi nalazi:

* OpenAI/provider output može proizvesti neprirodne BHS formulacije poput “rokovi visoki”
* renderer ne treba postati opći lektor AI outputa
* “Tačka opreza” / “Tačke opreza” wording u UI-u djeluje rogobatno i treba poseban polish

Odluke:

* Jezički kvalitet Composite HR OpenAI outputa treba kontrolisati u provider sloju, ne u rendereru.
* U tom trenutku je bio potreban OpenAI provider language QA guardrail task prije ozbiljnog OpenAI DB-backed smoke-a.
* Provider treba imati BHS HR glossary, language rules, self-review/reviewer pass i retry/fail ponašanje.
* Renderer može imati uske display mappinge za poznate termine, ali ne generički rewrite engine.
* Watchout wording/UI polish ide kao zaseban task.

Racionala:

* Validan JSON i validan report contract nisu dovoljni ako je jezik neprirodan.
* App ne može predvidjeti sve moguće AI jezičke greške, ali provider može imati quality gate prije spremanja finalnog `report_snapshot`.
* Renderer treba prikazivati kvalitetan output, ne popravljati sve jezičke slabosti AI-ja.

### 2026-05-13 — OpenAI DB-backed Composite HR smoke plan i preduvjeti

Završeno:

* mock-backed DB smoke za Composite HR report je ranije potvrđen kroz postojeći `assessment_reports` worker/provider/validator/renderer flow
* renderer polish je podignut na mirniji i HR-prirodniji nivo
* OpenAI provider postoji i koristi postojeći contract/validator shape
* production worker orchestration ostaje otvoren task

Napomena:

* U tom trenutku je OpenAI DB-backed smoke bio planiran kao naredni runtime dokaz nakon provider language QA guardrails sloja
* validan contract nije dovoljan ako provider output ostane jezički neprirodan
* scripted smoke requeue utility ostaje koristan za ponovljive QA smoke iteracije

### 2026-05-12 — Composite HR renderer copy/UX polish završen

Završeno:

* poliran Composite HR report renderer display layer
* source/traceability blok preimenovan u HR-facing “Osnova izvještaja”
* source blok sada koristi naslov “Procjene uključene u izvještaj”
* “3 povezana pokušaja” zamijenjeno sa “3 završene procjene”
* raw provider `mock / v1` uklonjen iz glavnog prikaza
* provider prikaz zamijenjen sa “Način generisanja / Testni prikaz”
* raw test slugovi zamijenjeni HR-facing nazivima
* evidence chipovi više ne prikazuju raw test slugove
* header description više ne koristi tehnički jezik
* dodan ograničen display sanitizer za očigledne tehničke izraze
* provider nije mijenjan
* worker nije mijenjan
* contract/schema nije mijenjan
* scoring nije mijenjan
* route/access guard nije mijenjan

Odluke:

* Traceability ostaje u UI-u, ali se prikazuje HR-facing jezikom.
* Raw debug/provider vrijednosti ne trebaju biti glavni vidljivi sadržaj HR reporta.
* Renderer može mapirati tehničke slugove na display nazive bez mijenjanja report contracta.
* OpenAI DB-backed smoke dolazi nakon renderer polish-a.
* Ako OpenAI output bude loš, raditi provider-copy polish, ne širiti renderer sanitizer u opći rewrite sloj.

Racionala:

* Nakon DB-backed mock smoke-a prvi put je bilo moguće realno ocijeniti report ekran u HR UI-u.
* Ekran je bio funkcionalan, ali je još pokazivao interne tehničke izraze.
* Ovim polish-om report postaje čitljiviji HR korisniku, dok se postojeći provider/worker/contract pipeline ne dira.

### 2026-05-12 — DB-backed Composite HR report smoke prošao sa mock providerom

Završeno:

* pronađen postojeći kandidat sa completed IPIP, SAFRAN i MWMS attemptima u istoj organizaciji
* kreiran controlled active `standard_battery` assignment za smoke
* linked su tri completed attempta kroz `assessment_assignment_attempts`
* sva tri linka su označena kao `required_for_composite=true`
* kreiran je stvarni queued `assessment_reports` red
* worker je pokrenut sa mock providerom
* potvrđen je flow `queued → processing → ready`
* `input_snapshot` je upisan
* `report_snapshot` je upisan
* `generated_at` i `completed_at` su postavljeni
* `failure_code` i `failure_reason` su null
* HR renderer route je otvoren i prikazao report
* 404 iz prvog UI pokušaja potvrđen je kao access/org issue, ne route bug
* organization access guard radi: report se prikazuje HR useru koji pripada organizaciji reporta

Korišteni runtime IDs:

* organization_id: `5d93f3a1-3765-4ec4-b668-c0d1228a8445`
* participant_id: `9b742094-53dc-4de5-87a5-174c5491e4dd`
* assessment_assignment_id: `16943547-ef84-4fc4-a3d2-11801b1f1869`
* assessment_report_id: `98e89663-5692-45a6-9ca7-1bc60da51a63`
* IPIP attempt: `2432eb12-2b54-4881-bef2-2ac687b59e0b`
* SAFRAN attempt: `bad42da0-aa18-4ee0-bc6e-552eee8cd38b`
* MWMS attempt: `a6bad238-0318-4ab8-bc40-ed76656010d0`

Odluke:

* Controlled backfill je prihvatljiv za smoke kada postoje completed attempts istog kandidata i organizacije.
* Controlled backfill nije zamjena za production assignment lifecycle.
* Mock provider smoke potvrđuje runtime pipeline, ali ne zamjenjuje OpenAI DB-backed smoke.
* Renderer 404 treba prvo tumačiti kroz organization access guard ako report postoji i ima `ready` status.
* Sljedeći fokus je finalni copy/UX polish, zatim OpenAI DB-backed smoke.

Racionala:

* Composite HR flow je sada potvrđen kroz stvarnu Supabase bazu i HR renderer, ne samo kroz unit/script testove.
* Prvi DATA_NOT_READY nalaz nije bio kodni bug, nego odsustvo novog assignment lifecycle podatka u runtime bazi.
* Smoke je dokazao da su storage, worker, provider, validator, renderer i access guard povezani u jedan funkcionalan runtime tok.

### 2026-05-12 — Supabase composite schema/table visibility blocker zatvoren

Završeno:

* potvrđeno da `.env.local` i runtime app ciljaju Supabase projekat `njczzzxmjwzjbtzwwsda`
* Supabase CLI je linkovan na isti runtime projekat
* potvrđen migration history drift
* nije rađen `supabase db push` naslijepo
* konzervativno su repair-ane samo migracije sa jakim DB dokazom
* tri composite migracije su ručno primijenjene kroz Supabase SQL Editor
* `assessment_assignments` sada postoji u runtime DB-u i REST ga vidi
* `assessment_assignment_attempts` sada postoji u runtime DB-u i REST ga vidi
* `assessment_reports` sada postoji u runtime DB-u i REST ga vidi
* composite migracije `20260512110000`, `20260512111000` i `20260512120000` označene su kao applied u migration history
* `npm run process-assessment-report-jobs` više ne puca na schema cache grešci
* worker runner uredno završava sa “No queued composite assessment report found” kada nema queued reporta

Odluke:

* Composite schema cache problem bio je posljedica neprimijenjenih composite migracija na runtime DB-u, ne provider/worker bug.
* `NOTIFY pgrst, 'reload schema'` je smislen tek nakon stvarnog kreiranja tabela.
* `supabase db push` ne koristiti naslijepo dok postoje uncertain pending migracije.
* Stare uncertain migracije ostaju zasebna migration-history cleanup tema.
* Sljedeći QA korak je DB-backed composite smoke sa stvarnim queued reportom.

Racionala:

* Unit/local testovi nisu dovoljni ako runtime baza nema potrebne composite tabele.
* Ručna primjena samo tri composite migracije bila je sigurnija od `db push`, jer remote migration history još ima drift za stare uncertain migracije.
* Worker sada može pristupiti `assessment_reports`, pa schema/table blocker više ne blokira DB-backed smoke.

### 2026-05-12 — Composite HR V1 QA audit i copy polish završen

Završeno:

* provjeren Composite HR V1 flow kroz card model, queue/retry helper, worker mock path, renderer contract path, OpenAI provider path i guardrails
* lokalni test set prolazi
* OpenAI provider smoke nad fixture inputom prošao runtime validator i forbidden-wording assertion
* potvrđeno da nema code-level blockera u contract/provider/renderer sloju
* urađen minimalni HR-facing copy cleanup u composite card-u
* urađen minimalni HR-facing copy cleanup u composite rendereru
* uklonjen stale tekst da generate/retry akcije dolaze u sljedećem koraku
* uklonjeni tehnički user-facing izrazi “snapshot”, “generator metadata”, “linked attemptova” i “ASSESSMENT-LEVEL HR REPORT”
* logika, provider, worker, contract/schema, scoring i `attempt_reports` nisu mijenjani

Odluke:

* Composite HR V1 nije više u fazi osnovne arhitekture, nego u runtime/QA stabilizaciji.
* Sljedeći fokus nije nova feature arhitektura, nego Supabase migration/schema cache verification i DB-backed smoke.
* DB-backed smoke je obavezan prije production orchestrationa.
* Supabase schema cache problem tretirati kao runtime/migration blocker, ne kao provider/validator code bug.

Racionala:

* Core Composite HR pipeline sada postoji u kodu, ali produkcijska vrijednost zavisi od toga da runtime baza ima potrebne composite tabele.
* Ako `assessment_reports` nije vidljiv u Supabase schema cache-u, worker i HR flow ne mogu end-to-end raditi bez obzira na to što lokalni testovi prolaze.
* Mali copy cleanup uklanja tehnički jezik i usklađuje UI sa već implementiranim generate/retry akcijama.

### 2026-05-12 — OpenAI provider za Composite HR report uveden

Završeno:

* dodan `lib/assessment/composite-hr-report-provider-openai.ts`
* dodan minimalni provider selector `lib/assessment/composite-hr-report-provider.ts`
* assessment report worker sada koristi provider selector
* mock provider ostaje default/dev/test provider
* OpenAI provider se aktivira kroz `AI_REPORT_PROVIDER=openai`
* provider koristi postojeći `AI_REPORT_MODEL` i `OPENAI_API_KEY` pattern
* OpenAI provider prima samo `CompositeHrInputSnapshot`
* OpenAI provider proizvodi `CompositeHrReportSnapshot`
* output prolazi runtime validator
* immutable source fields se dodatno provjeravaju
* forbidden phrasing se odbija
* worker zapisuje generator metadata prema stvarno odabranom provideru
* invalid provider output završava kao `COMPOSITE_REPORT_VALIDATION_FAILED`
* renderer shape nije mijenjan
* `attempt_reports` nije mijenjan
* scoring i single-test report pipeline nisu mijenjani
* offline OpenAI provider test prolazi kroz fake structured response

Odluke:

* Koristiti postojeći `AI_REPORT_PROVIDER` / `AI_REPORT_MODEL` standard, bez composite-specific env duplikata.
* Mock provider ostaje default kako bi dev/test flow bio stabilan.
* OpenAI provider mora poštovati isti contract i validator kao mock provider.
* Runtime validator je finalna kapija prije `ready` statusa.
* Real OpenAI smoke ide u sljedeći QA/polish slice.
* OpenAI provider ne smije koristiti pojedinačne AI reportove kao source.
* OpenAI provider ne smije mijenjati score vrijednosti, bandove ili source attempts.

Racionala:

* Composite HR report je sada povezan na pravi AI provider, ali pod postojećim contractom, validatorom i rendererom.
* Jedan provider selector smanjuje konfiguracijsku fragmentaciju.
* Mock default omogućava stabilan lokalni/dev workflow.
* Offline test pokriva OpenAI path bez zavisnosti od live API-ja, dok real smoke ostaje kontrolisan QA korak.

### 2026-05-12 — Composite HR report renderer uveden

Završeno:

* dodana assessment-level route `/dashboard/assessment-reports/[reportId]`
* ready composite card sada ima aktivan CTA `Pogledaj kompozitni izvještaj`
* CTA vodi na assessment-level report route, ne na attempt route
* dodan `components/dashboard/composite-hr-report-view.tsx`
* page dohvaća organization-scoped composite/hr/assessment report
* renderer prikazuje samo ready report
* `report_snapshot` se runtime validira prije prikaza
* invalid ili missing snapshot ne renderuje parcijalni report
* non-ready report prikazuje sigurno stanje
* renderer prikazuje summary, integratedSignals, interviewGuidance, onboardingGuidance i limitations
* OpenAI provider nije dodan
* `attempt_reports` nije mijenjan
* existing attempt worker nije refaktorisan
* scoring nije mijenjan

Odluke:

* Composite report pregled koristi assessment-level route.
* Composite report se ne veže na attempt route.
* Renderer dolazi prije OpenAI providera.
* OpenAI provider mora poštovati postojeći contract i validator.
* Invalid snapshot se ne prikazuje parcijalno.
* Renderer trenutno radi nad mock-backed validnim snapshotom.

Racionala:

* Renderer provjerava da Composite HR report contract ima dovoljno dobar UI shape prije uvođenja OpenAI varijabilnosti.
* Assessment-level route čuva arhitekturu: composite report pripada assessment reportu, ne jednom pokušaju.
* Sigurno stanje za invalid/non-ready snapshot sprečava da HR vidi polu-validan report.

### 2026-05-12 — Composite HR report contract i mock provider uvedeni

Završeno:

* dodan `lib/assessment/composite-hr-report-contract.ts`
* dodan `lib/assessment/composite-hr-report-provider-mock.ts`
* dodan `scripts/test-composite-hr-report-contract.cjs`
* worker sada može claim/process queued composite assessment report do `ready` statusa
* worker upisuje `input_snapshot` i validan `report_snapshot`
* worker postavlja `generated_at` tek nakon validacije
* failure code `COMPOSITE_INPUT_NOT_READY` ostaje za input builder/readiness probleme
* failure code `COMPOSITE_REPORT_VALIDATION_FAILED` pokriva invalidan provider output
* mock provider ne zove OpenAI
* mock provider ne koristi `attempt_reports`
* mock provider ne mijenja score vrijednosti, bandove ili source attempts
* testovi potvrđuju contract shape, mock provider output i forbidden phrasing guardrails

Odluke:

* Contract/schema/provider slice je završen prije renderera i OpenAI providera.
* Mock provider je prvi provider dok ne postoji finalni AI lane.
* Ready status znači validan `report_snapshot`, ne samo validan `input_snapshot`.
* Composite report i dalje mora ostati HR-facing i bez hire/no-hire ili fit score jezika.

Racionala:

* Contract i validator zaključavaju shape prije rendering i AI varijabilnosti.
* Mock provider omogućava worker i budući renderer bez OpenAI zavisnosti.
* Composite report sada ima stabilan `report_snapshot` ugovor koji se može dalje prikazivati u UI-u.

### 2026-05-12 — Assessment report worker path za composite uveden

Završeno:

* dodan `lib/assessment/assessment-report-worker.ts`
* dodan one-shot runner `scripts/process-assessment-report-jobs.cjs`
* dodan npm script `process-assessment-report-jobs`
* dodan `scripts/test-assessment-report-worker.cjs`
* worker claim-a queued composite HR assessment report row
* worker prebacuje row u `processing`
* worker poziva composite input builder
* worker upisuje deterministic `input_snapshot`
* worker završava kontrolisano kao `failed` sa `COMPOSITE_PROVIDER_NOT_IMPLEMENTED`
* input-not-ready slučaj završava kao `failed` sa `COMPOSITE_INPUT_NOT_READY`
* worker ne postavlja `report_snapshot`
* worker ne postavlja `generated_at`
* worker ne zove OpenAI/provider
* worker ne čita `attempt_reports`
* postojeći attempt report worker nije refaktorisan
* testovi za worker lifecycle i source guardrails prolaze

Odluke:

* Assessment-level composite worker ostaje odvojen od postojećeg attempt-level report worker-a.
* Worker lifecycle se uvodi prije providera i renderera.
* Dok provider ne postoji, kontrolisani failed status je očekivano privremeno ponašanje.
* `input_snapshot` se gradi prije bilo kakve AI interpretacije.
* Finalni provider, schema/validator i renderer ostaju zasebni slice-ovi.
* Claim je za sada best-effort, ne RPC/DB-atomic.

Racionala:

* Ovaj slice dokazuje da queued `assessment_reports` row više nije mrtav red.
* Worker sada ima put od queue-a do deterministic `input_snapshot`-a bez destabilizacije postojećeg single-test report pipeline-a.
* Kontrolisani failed status sprečava lažni `ready` report prije nego što postoji stvarni provider, schema i renderer.
* Sljedeći korak treba biti Composite HR report contract/schema/provider, idealno prvo mock provider + validator, pa zatim OpenAI.

### 2026-05-12 — Composite input builder iz deterministic score rezultata uveden

Završeno:

* uveden `lib/assessment/composite-input.ts`
* dodan deterministic composite input builder za budući Composite HR report
* dodan `scripts/test-composite-input-builder.cjs`
* builder gradi stable `input_snapshot`
* snapshot uključuje assignment metadata, source attempt references, coverage, deterministicInputs, summarySignals, guardrails i metadata
* IPIP input uključuje domain/facet score podatke
* SAFRAN input uključuje overall/verbal/figural/numeric deterministic score podatke
* MWMS input uključuje svih 6 dimension score vrijednosti i motivation structure signale
* builder koristi samo linked required attempts iz istog assessment assignment ciklusa
* historical completed attempts nisu fallback
* `attempt_reports` se ne čita kao source
* pojedinačni AI report narrative se ne koristi kao primary source
* summary signals su neutralni i deterministic
* typecheck i relevantni script testovi prolaze

Odluke:

* Composite AI input se gradi iz deterministic score rezultata, ne iz pojedinačnih AI reporta.
* `input_snapshot` mora sadržati traceable source attempt IDs.
* AI kasnije ne smije računati ili mijenjati score/band vrijednosti.
* Composite input builder nije worker.
* Queued `assessment_reports` row se još ne obrađuje.
* Worker, provider, contract/schema i renderer ostaju zasebni slice-ovi.

Racionala:

* Prije worker-a i AI generation-a mora biti jasno šta je source of truth za Composite HR report.
* Builder sprečava da budući composite provider improvizuje input ili miješa pokušaje iz različitih ciklusa.
* Deterministic `input_snapshot` postaje ugovor između score rezultata i buduće AI interpretacije.

### 2026-05-12 — Manual composite generate/retry queue flow uveden

Završeno:

* dodan manual generate flow za `ready_to_generate` composite state
* dodan retry flow za `failed` composite state
* generate action kreira `assessment_reports` row u `queued`
* retry action resetuje postojeći failed row nazad u `queued`
* generate/retry akcije ponovo provjeravaju assignment ownership i readiness server-side
* readiness ostaje vezan samo za linked attempts iz istog assessment assignment ciklusa
* historical completed attempts se ne koriste kao fallback
* composite card sada ima aktivan CTA samo za `ready_to_generate` i `failed`
* `queued`, `processing`, `ready`, `incomplete` i `no_assignment` nemaju pogrešnu aktivnu akciju
* raw `returnPath` iz forme se ne koristi za finalni redirect nakon participant validacije
* testovi za assessment report queue odluke i composite CTA state-ove su prošireni

Odluke:

* Manual queue flow nije Composite HR report generation.
* `queued` assessment_reports row se još ne obrađuje.
* Worker, AI provider, input builder, schema/validator i renderer ostaju zasebni slice-ovi.
* Generate/retry ne smiju koristiti historical completed attempts kao fallback.
* Generate ne kreira duplikat ako row već postoji.
* Retry resetuje samo failed row.

Racionala:

* Ovaj slice uvodi kontrolisan HR workflow signal da je composite artefakt stavljen u red, bez destabilizacije single-test report pipeline-a.
* Server-side readiness re-check sprečava da UI state postane izvor istine.
* Prije worker-a i AI generation-a treba zaključati composite input builder i `input_snapshot`, kako bi budući report imao jasan deterministic source of truth.

### 2026-05-12 — Assessment assignment ownership za standard battery uveden

Završeno:

* uveden `assessment_assignments` parent model za standard battery procjenski ciklus
* uveden `assessment_assignment_attempts` link model za povezivanje assignmenta sa novokreiranim attempts
* dodan server-only helper sloj `lib/assessment/assignments.ts`
* HR standard battery create flow sada kreira assessment assignment
* novokreirani IPIP/SAFRAN/MWMS attempts se linkuju u assignment kada su stvarno kreirani
* prethodni active standard_battery assignment se označava kao `abandoned`
* novi assignment se označava kao `cancelled` ako flow pukne nakon njegovog kreiranja
* existing completed attempts se ne linkuju u novi assignment
* existing completed attempts i dalje blokiraju kreiranje novog praznog attempta za isti test dok dashboard ostaje attempt-based
* dodan helper test za assignment insert/link payload i standard battery plan compatibility
* `typecheck`, assignment helper test, standard battery test i attempt lifecycle test prolaze

Odluke:

* Composite HR report ne ide u `attempt_reports`.
* `attempt_reports` ostaje za single-test participant/HR reportove.
* `assessment_assignments` je prvi parent ownership sloj za budući composite model.
* `assessment_reports` se ne uvodi u ovom tasku.
* Dashboard read path ostaje attempt-based u ovom slice-u.
* Fresh attempts za već completed testove se odgađaju dok dashboard ne postane assignment-aware.
* Historical attempts bez assignmenta ostaju podržani.
* Ne radi se agresivan backfill.
* Model ostaje fleksibilan za budući četvrti/team-fit test.

Racionala:

* Composite HR report nema prirodan jedan `attempt_id`, pa ga ne treba vezivati za nasumični IPIP/SAFRAN/MWMS attempt.
* Prvi slice uvodi ownership bez razbijanja postojećeg candidate dashboarda i single-test reportova.
* Compatibility režim sprečava da novi prazan attempt iz novog ciklusa bude sakriven iza starog completed attempta u attempt-based dashboard selection logici.
* Assignment-first dashboard i `assessment_reports` storage su sljedeće zasebne arhitektonske stepenice.

### 2026-05-12 — assessment_reports storage i composite readiness card uvedeni

Završeno:

* dodana tabela `assessment_reports` za buduće assessment-level composite HR report artefakte
* uveden `lib/assessment/assessment-reports.ts`
* dodan helper za latest active standard_battery assignment
* dodan composite readiness helper
* readiness se računa samo iz linked attempts u `assessment_assignment_attempts`
* required set koristi `required_for_composite = true`
* historical completed attempts se ne koriste kao fallback
* pojedinačni AI reporti i `attempt_reports` se ne koriste za composite readiness
* dodan latest composite HR assessment report retrieval
* hardcoded composite placeholder na HR participant detail stranici zamijenjen realnim derived card state-om
* composite card podržava `no_assignment`, `incomplete`, `ready_to_generate`, `queued`, `processing`, `ready` i `failed`
* user-facing copy koristi “Kompozitni HR izvještaj” i ne koristi interni izraz “Renderer”
* `assessment_reports` RLS dozvoljava read samo organization memberima
* participant/candidate read policy nije dodan

Odluke:

* Composite HR report koristi `assessment_reports`, ne `attempt_reports`.
* `missing`, `incomplete` i `ready_to_generate` su UI-derived state-ovi.
* DB statusi za `assessment_reports` su `queued`, `processing`, `ready`, `failed`.
* Readiness mora biti vezan za isti assessment assignment ciklus.
* Nema automatskog fallbacka na historical completed attempts.
* Nema AI generation-a, worker-a, generate/retry akcija ili renderer route-a u ovom slice-u.
* Manual generate/retry queue flow je sljedeći fokusirani task.

Racionala:

* Composite HR report nema prirodan jedan `attempt_id`, pa mora imati assessment-level storage.
* Stroga readiness logika sprečava miješanje pokušaja iz različitih ciklusa.
* HR participant detail page je prvi siguran UI consumer jer već grupiše pojedinačne IPIP/SAFRAN/MWMS HR report kartice.
* Ovaj slice uvodi mjesto gdje composite živi i kada je spreman, bez destabilizacije postojećeg single-test report pipeline-a.

### 2026-05-12 — Non-blocking autosave za IPIP/MWMS Likert flow završen

Završeno:

* candidate-only non-blocking autosave slice za IPIP/MWMS Likert auto-advance flow
* `runContext="candidate"` / `runContext="hr"` razdvajanje da HR run flow ne aktivira candidate autosave ponašanje
* `localStorage` pending queue pod ključem `assessment-pending:<attemptId>`
* immediate React state update prije auto-advance-a
* background flush kroz postojeći protected save action payload format
* refresh merge server `initialSelections` + pending lokalni odgovori
* blocking final submit flush prije completion/scoringa
* queue cleanup nakon uspješnog completiona
* pending autosave helper i helper test
* protected resume smoke spec dodat, uz napomenu da je lokalno blokiran `config.webServer` problemom
* ručni browser smoke potvrdio brži UI i očuvanje odgovora nakon refresha

Odluke:

* UI ne čeka DB save za svaki IPIP/MWMS Likert klik.
* Baza ostaje source of truth za completion, scoring, report generation i dashboard progress.
* Final submit ostaje blocking i mora flushati pending odgovore prije scoringa.
* SAFRAN step flow ne ulazi u ovaj slice i ostaje zaseban follow-up.
* HR run flow ne koristi non-blocking candidate autosave ponašanje.
* Failed background flush ne briše pending queue i ne dozvoljava final completion dok se pending odgovori ne sinhronizuju.

Racionala:

* Ovo uklanja najveće trenutno UX usporenje tokom rješavanja IPIP/MWMS testova bez promjene scoringa, report pipeline-a ili DB schema-e.
* Local pending queue je kratkotrajna zaštita od refresha i mrežnih prekida, ne puni offline-first sistem.
* Ovaj uski slice potvrđuje obrazac koji se kasnije može pažljivo proširiti na SAFRAN step flow, ali tek kroz poseban task.

### 2026-05-11 — MWMS HR V1, OpenAI smoke, header logo i autosave odluka

Završeno:

* MWMS HR report V1 end-to-end
* MWMS HR capability activation
* MWMS HR prompt activation i real DB lifecycle smoke
* real OpenAI smoke za MWMS HR
* SAFRAN HR report za Amru regenerisan preko OpenAI providera
* MWMS HR za Amru potvrđen kao OpenAI ready
* IPIP i MWMS participant reporti za Amru potvrđeni kao OpenAI ready
* SAFRAN participant AI lane potvrđen kao postojeći i funkcionalan; za Amrin historijski attempt ručno je kreiran queued participant report job za backfill
* protected app header logo zamijenjen PNG logoom
* SAFRAN participant “Pregled po oblastima” copy prebačen na controlled display copy

Odluke:

* MWMS HR lane je sada active single-test HR lane.
* `.env.local` kontroliše nove report jobove, ali postojeći `attempt_reports.generator_type` određuje postojeći job/snapshot.
* Ready/mock snapshot se ne mijenja sam od sebe promjenom `.env.local`; za promjenu providera potreban je reset/regenerate flow.
* Za budućnost treba izbjeći ručni SQL backfill i razmotriti kontrolisanu recovery/backfill akciju za missing participant report artefakte.
* Candidate assessment UX treba preći sa blocking DB-first save-a na non-blocking autosave za IPIP/MWMS Likert flow.
* Final submit mora ostati blocking i mora flushati pending odgovore prije scoringa.
* SAFRAN participant domain copy u “Pregled po oblastima” dolazi iz controlled display sloja, ne iz raw AI domain teksta.
* U tehničkoj terminologiji koristiti “reporti”, dok UI preferira “izvještaji”.

Racionala:

* Single-test HR temelji su sada pokriveni kroz IPIP, SAFRAN i MWMS.
* Sljedeći veliki arhitektonski task ostaje composite HR report data model decision, ali UX usporenje tokom testiranja je sada dovoljno važno da non-blocking autosave bude prvi praktični naredni task.
* OpenAI quality review zahtijeva stvarne OpenAI snapshotove, ne mock output.
* Ručni SQL backfill je prihvatljiv za dijagnostiku, ali nije dugoročni product workflow.

### 2026-05-11 — MWMS HR report V1 završen

Završeno:
- MWMS HR V1 contract/schema/validator
- deterministic HR input builder iz MWMS dimension_scores
- score/band/label mutation checks
- mock provider generation
- OpenAI provider routing i prompt package wiring
- MWMS HR display adapter i renderer branch
- MWMS HR capability activation
- worker support za MWMS HR queued job
- generic HR dashboard/status/recovery ponašanje za MWMS HR
- prompt activation verification nakon import:assessment-package
- real Supabase DB lifecycle smoke
- real OpenAI smoke
- HR static render readiness

Odluke:
- MWMS HR lane je sada active za single-test HR reportove.
- MWMS HR koristi deterministic dimension_scores kao izvor istine.
- AI ne računa i ne mijenja score, band ili label.
- MWMS HR report daje HR hipoteze, intervju/onboarding/manager guidance i tačke opreza, ne presude.
- Participant MWMS report ostaje odvojen i nije HR fallback.
- Composite HR report se i dalje ne implementira prije data model odluke.
- Worker orchestration šire od postojećeg worker procesa ostaje zaseban tech debt.

Racionala:
- Nakon IPIP i SAFRAN HR lane-ova, MWMS HR zatvara treći single-test HR temelj.
- Time su osnovni pojedinačni HR reportovi spremni za sljedeću fazu: Composite HR report data model decision.
- Real DB lifecycle i real OpenAI smoke potvrđuju da MWMS HR V1 nije samo offline contract, nego funkcionalan end-to-end single-test HR lane.

### 2026-05-11 — HR report infrastructure, recovery i IPIP HR v2 content contract

Završeno:

* HR report card status mapping za failed/missing/unsupported/ready/queued/processing
* queued vs processing UX razdvajanje
* report capability registry
* automatic HR enqueue after participant completion za active HR lane-ove
* HR report recovery actions za failed i missing single-test HR reportove
* IPIP HR report content contract V2
* legacy IPIP HR v1 display compatibility
* realni smoke za Amrin IPIP HR v2 report
* realni smoke za SAFRAN missing HR report recovery create path

Odluke:

* `queued` znači `Čeka generisanje`, ne `Generiše se`
* `processing` znači da worker aktivno obrađuje report
* MWMS HR lane je planned/not_implemented, ne trajno isključen
* retry failed reporta resetuje isti `attempt_reports` red, ne pravi duplikat
* missing HR report recovery kreira queued HR red eksplicitnim insertom
* novi IPIP HR-operational shape koristi `contract_version = ipip_neo_120_hr_v2`
* stari `ipip_neo_120_hr_v1` snapshotovi ostaju podržani kroz display fallback
* participant report nije HR fallback i nije HR source

Racionala:

* HR korisnik mora vidjeti stvarno stanje report artefakata.
* Completed test nije isto što i ready HR report.
* Report pipeline mora biti capability-driven, ne hardcodiran po testovima.
* Recovery flow je potreban za historijske failed/missing reportove.
* IPIP HR report mora biti HR-operativan, sa intervju pitanjima, verification focusom i decision-support okvirom.
* Worker orchestration ostaje poseban tehnički dug jer queued job ne znači da se job trenutno obrađuje.

### 2026-05-10 — Candidate dashboard lifecycle i CTA contrast fix

Završeno:

* popravljeno primary attempt selection pravilo za candidate dashboard
* completed attempt sada pobjeđuje nad novijim praznim in_progress attemptom
* active in_progress pobjeđuje samo kada ima response_count > 0 ili, za SAFRAN, scored_started_at != null
* standard battery planner više ne kreira novi in_progress attempt za test koji već ima completed attempt
* dodan “Nazad na dashboard” link/dugme na completed report/results screen
* popravljeno hover/focus stanje CTA dugmadi na candidate dashboard test karticama
* “Pogledaj rezultate” više ne prikazuje taman tekst na tamnoj pozadini
* icon/text color sync riješen kroz currentColor
* typecheck prošao
* lint prošao uz postojeće nepovezane warninge za @next/next/no-img-element u components/assessment/assessment-form.tsx

Odluke:

* browser Back nije root cause; samo je razotkrio lošu selection logiku
* prazni in_progress attempt ne smije sakriti validan completed rezultat
* bez assessment_assignment entiteta ne smijemo pretpostaviti da svaki noviji prazan attempt predstavlja novu legitimnu rundu procjene
* standard battery planner mora biti defanzivan i ne reinserta test koji već ima completed attempt
* CTA hover/focus kontrast je accessibility issue, ne samo vizuelni polish

Racionala:

* Kandidat mora vidjeti stabilno i tačno stanje procjene nakon završetka testa.
* Dashboard mora biti izvor povjerenja, ne ekran koji “zaboravi” završen test zbog praznog duplikat attempta.
* Dok ne postoji assessment-level model, attempt lifecycle pravila moraju biti konzervativna i štititi completed rezultate.
* CTA dugmad su primarna navigacija na dashboardu i moraju ostati čitljiva u svim interaktivnim stanjima.

### 2026-05-08 — SAFRAN HR report V1 i HR candidate assessment detail završeni

Završeno:

* SAFRAN HR V1 contract/input/validator sloj
* SAFRAN HR mock runtime lane
* SAFRAN HR OpenAI provider branch
* mandatory HR guardrails u default i DB prompt path-u
* provider enforcement u lifecycle smoke skripti
* SAFRAN HR renderer
* HR-only retrieval bez participant fallbacka
* realni OpenAI lifecycle smoke sa generator_type='openai'
* browser smoke SAFRAN HR reporta
* završni SAFRAN HR copy polish
* HR candidate assessment detail page sa report karticama za IPIP, SAFRAN i MWMS
* composite placeholder bez generation logike

Odluke:

* SAFRAN HR report je single-test HR artefakt, ne composite report.
* AI interpretira deterministic SAFRAN rezultate, ali ne računa i ne mijenja score/band.
* HR report mora ostati decision-support, ne odluka o zapošljavanju.
* Dashboard CTA “Pogledaj procjenu” ne vodi direktno na attempt, nego na participant-level assessment detail page.
* Single report route /dashboard/attempts/[attemptId] ostaje mjesto za prikaz konkretnog HR reporta.
* Points of caution u HR reportu moraju biti stvarne HR hipoteze/tačke opreza, ne pozitivni signali ubačeni u pogrešnu sekciju.

Racionala:

* HR mora moći vidjeti koji su reporti dostupni po kandidatu, umjesto da dashboard slučajno otvori queued ili nepodržani attempt.
* Single-test HR reportovi su temelj za kasniji composite HR report.
* SAFRAN HR report zatvara kognitivni HR signal lane i priprema teren za MWMS HR report i composite HR report.

### 2026-05-07 — HR report taskovi grupisani nakon pipeline audita

Dogovoreno:

* HR report rad se razbija na jasne taskove umjesto jednog preširokog “kompozitnog reporta”.
* Sljedeći implementation task je Explicit HR retrieval and route wiring.
* SAFRAN HR report i MWMS HR report ostaju planirani, ali se ne rade prije sigurnog HR/participant retrieval odvajanja.
* Composite HR report ne ide u implementaciju dok se ne donese data model odluka.
* attempt_reports ostaje prihvatljiv za single-test HR reportove.
* Composite HR report vjerovatno traži assessment-level report model.
* Višejezičnost se uzima u obzir sada arhitektonski, ali MVP ostaje bosanski.
* Locale/i18n readiness dobija zaseban backlog trag da se ne zaboravi.

Racionala:

* Audit je pokazao da IPIP HR report lane postoji, ali HR retrieval/display nije end-to-end sigurno odvojen od participant report patha.

### 2026-05-07 — HR retrieval, locale audit i locale guardrails zatvoreni

Dogovoreno:

* `Explicit HR retrieval and route wiring` je završen.
* HR route sada čita samo `audience='hr'`.
* Participant route ostaje `audience='participant'`.
* Nema HR → participant fallbacka.
* Missing ili non-ready HR report prikazuje neutralni unavailable state.
* `HR report locale/i18n audit` je završen kao read-only audit, bez izmjena fajlova.
* `Persisted report locale guardrails for future HR lanes` je završen kroz centralni `ReportLocale` / `resolveReportLocale(...)` guardrail i uklanjanje nepotrebnog `"bs"` hardcodinga iz poznatih fallback path-eva.
* Radna odluka je da `ReportLocale = AssessmentLocale` trenutno znači samo TypeScript union podržanih locale vrijednosti `bs/hr/sr/en`.
* To ne znači da report locale uvijek mora biti isti kao assessment/test locale.
* Budući HR reportovi moraju razlikovati `assessmentLocale`, `participantReportLocale`, `hrReportLocale` i `reportLocale`.
* U MVP-u `attempt.locale` može služiti kao fallback, ali ne smije ostati dugoročni jedini source of truth za HR report locale.

Racionala:

* Pipeline je sada sigurniji za postojeći single-test HR path jer HR route više ne može tiho prikazati participant artefakt.
* Audit je pokazao da locale infrastruktura već postoji, ali da snapshot i renderer slojevi još nisu dosljedno locale-aware.
* Uvedeni guardrails štite buduće SAFRAN HR i MWMS HR lane-ove od ulaska u pipeline bez eksplicitnog locale pravila, bez uvođenja full i18n sistema sada.
* SAFRAN i MWMS imaju participant report lane, ali ne HR lane.
* Composite report nema prirodan jedan attempt_id i ne treba ga prerano gurati kroz semantički slab storage model.
* Ako HR report pipeline sada hardcodira bosanski kao jedini jezik, kasnija višejezičnost će tražiti skupe refaktore.

### 2026-05-07 — MWMS participant polish, prompt ton i IPIP radar

Završeno:

* MWMS participant report je restrukturiran u jasniji insight flow.
* “Profil motivacije” koristi 2x3 desktop grid, intensity pillove i mikro-objašnjenja subskala.
* MWMS participant copy je usklađen na “ti” formu.
* MWMS promptovi za base, bs i hr lokalizaciju su ažurirani da traže drugo lice jednine.
* Renderer safety net `normalizeMwmsCopy` čisti stare snapshotove od formalnih/pluralnih oblika.
* MWMS display smoke test sada hvata formalne oblike i drugo lice množine.
* Aktiviran je ažurirani MWMS prompt i regenerisan je testni participant report za attempt `762dd4b5-e005-44c3-a418-4e0baefc9d5a`.
* MWMS assessment item UX je poboljšan kroz zajednički stem “Zašto ulažeš trud u svoj posao?”, label “Mogući razlog” i jasnu skalu.
* IPIP NEO-120 participant V2 report ponovo prikazuje radar chart kao deterministic visual summary iz `report.domains[].display_score`.

Napomena:

* Scoring, score vrijednosti, pragovi, AI report pipeline i baza nisu mijenjani u ovim UI/copy taskovima.
* Postojeći MWMS snapshotovi u bazi nisu masovno regenerisani; čiste se pri prikazu kroz renderer safety net.
* Oblik obraćanja ostaje otvoren kao širi product/technical task za sistemsko rješenje muškog/ženskog jezičkog oblika.

### 2026-05-06 — IPIP selected state i domain card copy cleanup

Završeno:

* IPIP selected answer visibility je popravljena za auto-advance i back-navigation/resume scenario.
* UX odluka je da IPIP zadržava auto-advance, bez dodavanja `Nastavi` dugmeta.
* Likert selected state sada prati clean full-button model sa solid teal/green selected stanjem i bijelim bold brojem.
* SAFRAN concern oko default-selected odgovora ručno je provjeren i zatvoren kao nereproduciran / false alarm.
* IPIP `Pregled domena` kartice više ne ponavljaju naziv domena u body liniji.
* Browser-visible path za ponovljeni domain copy bio je V2 participant report renderer.
* Dodani su kratki domain descriptori da zadrže informativnu vrijednost bez dupliranja interpretacije reporta.

Napomena:

* scoring, report generation, AI prompt logika i `attempt_reports` pipeline nisu mijenjani u ovom cleanupu.

### 2026-05-06 — Protected app chrome, SAFRAN practice parity i decimalni numeric input

Završeno:

* protected app-wide chrome prebačen je na layout nivo za protected app stranice
* header/footer više nisu page-level duplikati na `/app` i `/dashboard`
* uveden je focus chrome za assessment execution rute
* focus chrome se aktivira route matching pravilom, ne test slug pravilom, i važi za sve procjene u istom route familyju
* SAFRAN practice visual parity sa scored visual pitanjima je završena
* SAFRAN numeric sequence input sada prihvata decimalne vrijednosti sa `.` i `,` separatorima
* decimalne vrijednosti se normalizuju samo za final validation/scoring
* SAFRAN decimal input task je po potrebi ažurirao scoring validation/tests

Napomena:

* scoring, persistence, reports, promptovi, dashboard logika i question data nisu namjerno mijenjani u chrome/practice parity taskovima
* SAFRAN decimal input fix je zadržao string-based unos za autosave/resume i prošao postojeće SAFRAN scoring testove

### 2026-05-05 — SAFRAN participant report content + visual stabilization

Zabilježeno:

* završen SAFRAN participant report content architecture
* završen deterministic fallback/display model
* završen SAFRAN AI participant report pipeline
* završen SAFRAN AI narrative differentiation
* završen SAFRAN report visual parity sa Deep Profile/IPIP report stilom
* odluka: AI ne računa SAFRAN skorove; aplikacija računa scoring, AI interpretira već izračunate rezultate
* odluka: SAFRAN AI report je single-test report i ne radi composite sintezu sa IPIP/MWMS
* odluka: deterministic SAFRAN display ostaje fallback ako AI report nije spreman ili ne prođe validaciju
* odluka: SAFRAN report treba imati ljudsku interpretacijsku sekciju `Kognitivni signal`, bez IQ, percentila, dijagnoze, hire/no-hire zaključaka ili tvrdnji o sposobnosti osobe u cjelini

### 2026-05-05 — SAFRAN report i practice UX prije finalnog smoke testa

Dogovoreno:

* Finalni ručni SAFRAN smoke test više nije prvi naredni task.
* Prije smoke testa treba zaključati sadržaj i redoslijed SAFRAN user reporta.
* SAFRAN user report treba vizuelno uskladiti sa IPIP completed report stilom.
* Probna SAFRAN pitanja treba vizuelno uskladiti sa pravim scored pitanjima.
* Tek nakon ta tri P0 taska radi se finalni ručni SAFRAN smoke test.

Racionala:

* Smoke test ne treba testirati poluzavršen kandidat-facing UX.
* SAFRAN report prvo treba imati jasan semantički redoslijed, pa tek onda vizuelni polish.
* Practice pitanja su prvi stvarni kontakt kandidata sa SAFRAN zadacima i moraju izgledati kao dio istog sistema kao scored pitanja.

### 2026-05-04 — Candidate dashboard assessment labels

Završeno:

* Candidate dashboard assessment kartice sada koriste jasniju hijerarhiju teksta.
* Glavni title opisuje šta procjena mjeri.
* Subtitle prikazuje naziv instrumenta.
* Mapping je centralizovan u `lib/assessment/display.ts` kroz `getAssessmentDisplayInfo()`.
* Potvrđeni prikazi:

  * `Procjena obrazaca ponašanja` / `IPIP-NEO-120`
  * `Procjena kognitivnog rezonovanja` / `SAFRAN`
  * `Procjena izvora radne motivacije` / `MWMS`
* Progress, status pill, CTA i redoslijed kartica ostali su očuvani.

Napomena:

* Playwright smoke je bio blokiran lokalnim Chromium sandbox okruženjem, ali `typecheck` je prošao i browser provjera je potvrđena screenshotom.

---

### 2026-05-04 — MWMS V1 functional + AI report

Završeno:

* MWMS aktivan DB paket.
* MWMS dio standardne baterije.
* Dashboard start/progress/resume/completion radi.
* `dimension_scores` upisuje 6 MWMS dimenzija kao prosjeke 1–7.
* Deterministic fallback report očišćen od generičkih Big Five/fallback sekcija.
* MWMS participant AI report V1 implementiran kroz postojeći `attempt_reports` pipeline.
* MWMS prompt aktiviran u DB.
* OpenAI schema compatibility bug riješen.
* Realni browser smoke test potvrdio `report_status = ready` i AI report render.

Nezavršeno:

* MWMS HR report nije podržan u V1.
* MWMS licencno pitanje ostaje otvoreno za komercijalni rollout.
* MWMS pitanja treba UX/copy doraditi zbog stem/item strukture.
