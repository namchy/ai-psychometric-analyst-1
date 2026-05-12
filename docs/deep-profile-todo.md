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
| P1        | Assessment report worker path za composite          | Završeno    | Composite HR report / Worker lifecycle | Zatvoreno kao lifecycle proof: worker claim-a queued assessment_reports row, gradi input_snapshot kroz composite input builder i kontrolisano završava kao failed sa COMPOSITE_PROVIDER_NOT_IMPLEMENTED dok provider ne postoji. |
| P1        | Composite HR report data model decision             | Završeno / Prvi slice implementiran | Architecture / HR report storage | Odluka donesena: composite ne ide u `attempt_reports`; uveden je prvi assessment-level ownership slice kroz `assessment_assignments` i `assessment_assignment_attempts`. Zatvoreno nakon assessment_reports storage/readiness slice-a. |
| P1        | Composite HR report V1                              | Planirano   | Product / AI report          | Raditi kroz sljedeće odvojene slice-ove: Composite HR report contract/schema/provider sloj, zatim renderer/pregled reporta. Worker lifecycle i deterministic input_snapshot path su već uvedeni, ali finalna generacija nije implementirana. |
| P1        | Oblik obraćanja: muški/ženski jezički oblik          | Otvoreno    | UX / i18n / AI promptovi     | Prvo uraditi product/technical discovery za addressing_form preferencu: modal, DB polje, participant preference, snapshot na attempt/report nivou i uticaj na AI promptove za participant reporte. |
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
| P2        | Worker/report auto-processing orchestration          | Otvoreno / Tech debt | Tech debt / Ops       | Definisati kako queued report prelazi u processing/ready/failed bez ručnog `npm run process-report-jobs` dev koraka. |
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

### P1 — Composite HR report V1

**Status:** Planirano  
**Kategorija:** Product / AI report

**Problem / context:**  
Composite HR report je glavni B2B artefakt Deep Profile-a. On povezuje IPIP, SAFRAN i MWMS u jedan HR-facing profil za selekciju, intervju, onboarding i menadžersku podršku.

**Scope:**
- composite input builder za IPIP + SAFRAN + MWMS
- composite schema
- provider routing
- validation
- renderer
- HR dashboard access
- fallback states
- guardrails bez hire/no-hire odluka
- locale-aware design, MVP bs-only

**Out of scope:**
- team-fit report
- role-specific benchmark
- organization-specific success model
- hiring recommendation score
- PDF/export

**Acceptance criteria:**
- composite HR report koristi deterministic rezultate kao input
- AI ne računa score i ne izmišlja podatke
- report jasno odvaja radne obrasce, motivaciju, kognitivne signale, tačke opreza, intervju pitanja i onboarding/manager guidance
- report je audience = hr
- report je locale-aware u strukturi, iako MVP content ostaje bs

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
| P1        | Oblik obraćanja            | Otvoreno  | Korisnik treba odabrati muški ili ženski jezički oblik obraćanja, bez pitanja o spolu.                                       | Definisati arhitekturu preference za muški/ženski jezički oblik, uključujući modal, DB/snapshot model i pravila za participant AI promptove. |
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
| P1        | Assessment report worker path za composite | Završeno | Queued assessment_reports row sada može biti claim-an, obrađen do `input_snapshot` i kontrolisano završen kao failed dok provider ne postoji. | Zatvoreno kao lifecycle proof; sljedeći sigurni korak je Composite HR report contract/schema/provider sloj. |
| P1        | Composite HR report V1    | Planirano | Historijski “Kompozitni AI profil” sada se vodi kao jasniji composite HR report task; worker lifecycle i deterministic input_snapshot path su već uvedeni, ali finalna generacija nije implementirana. | Raditi kroz sljedeće odvojene slice-ove: Composite HR report contract/schema/provider sloj, zatim renderer/pregled reporta. |
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

1. Composite HR report contract/schema/provider
2. Composite HR report renderer
3. Assignment-aware dashboard model za nove assessment cikluse
4. Worker/report auto-processing orchestration
5. Oblik obraćanja: muški/ženski jezički oblik
6. Report visual language po testovima
7. SAFRAN novi stimulus asseti
8. Login screen UI polish

Razlog za sljedeći prioritet:

* Assessment report worker path za composite je završen kao lifecycle proof.
* Worker sada može obraditi queued row do `input_snapshot` i kontrolisanog failed statusa.
* Finalna AI generacija još ne postoji.
* Sljedeći najmanji sigurni korak je Composite HR report contract/schema/provider sloj.
* Preporučeni smjer je prvo schema/validator + mock provider, pa tek onda OpenAI provider.
* Renderer dolazi nakon što postoji stabilan `report_snapshot` contract.
* Composite HR report V1 se i dalje implementira kroz odvojene slice-ove, ne kao jedan veliki task.
* Non-blocking autosave za IPIP/MWMS Likert flow je završen i uklonio je najveće trenutno UX usporenje tokom rješavanja testova.
* Manual composite generate/retry queue flow je završen.
* Composite input builder iz deterministic score rezultata je završen.
* Sistem sada ima definisan `input_snapshot` ugovor za budući Composite HR report.
* Worker path i input snapshot lifecycle su već stabilni; sljedeći korak je contract/schema/provider sloj.
* Assignment-aware dashboard model je poseban budući task jer trenutni dashboard read path i dalje radi attempt-based.
* Worker/report auto-processing orchestration ostaje tech debt, ali nije prvi sljedeći task.

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
* Composite HR report koristi assessment-level storage kroz `assessment_reports`.
* `assessment_reports` je HR-only artefakt u V1.
* Participant/candidate ne dobija read access na HR composite report u V1.
* Assessment report worker path za composite je odvojen od postojećeg `attempt_reports` worker-a.
* Worker claim-a samo `assessment_reports` rows sa `report_type='composite'`, `audience='hr'`, `source_type='assessment'` i `report_status='queued'`.
* Worker koristi composite input builder kao source za `input_snapshot`.
* Worker ne koristi `attempt_reports`.
* Worker ne koristi historical attempts kao fallback.
* Dok provider ne postoji, worker završava kontrolisano kao `failed` sa `COMPOSITE_PROVIDER_NOT_IMPLEMENTED`.
* Ako input builder ne može izgraditi snapshot, worker završava kao `failed` sa `COMPOSITE_INPUT_NOT_READY`.
* `report_snapshot` i `generated_at` se ne postavljaju dok finalni provider ne postoji.
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
| P1        | Snapshot jezičkog oblika        | Oblik obraćanja treba snapshotovati na attempt/report nivou i koristiti u participant promptovima, umjesto ručnog rješavanja po testu. | Slično locale snapshotu.                           |
| P1        | Composite report generation pipeline | Assessment report worker path sada postoji i može claim/process queued `assessment_reports` row do deterministic `input_snapshot` + kontrolisanog failed statusa. I dalje nedostaju Composite HR report contract/schema/provider sloj, stvarna AI generation, validacija report_snapshot-a i renderer. | Sljedeći tehnički korak je Composite HR report contract/schema/provider sloj, idealno prvo mock provider + validator, pa zatim OpenAI provider. |
| P1        | Worker/report auto-processing orchestration | Recovery i automatic enqueue sada korektno stavljaju HR report u `queued`, ali u dev/local toku queued job se ne procesira sam od sebe dok se ne pokrene `npm run process-report-jobs`. MWMS HR sada koristi postojeći worker i capability-driven chain, ali šira orchestration strategija i dalje nije riješena. Dugoročno treba odlučiti kako se worker pokreće u produkciji, da li recovery/generate treba auto-trigger, te da li treba polling/realtime update ili background job infrastruktura. | Ne miješati sa recovery flow-om: recovery samo vraća ili kreira queued job; worker orchestration je zaseban task. |
| P1        | Assessment assignment / assessment rounds | Trenutno se standardna procjena modelira kroz skup attemptova. To otežava razlikovanje legitimne nove runde procjene od praznog duplikat attempta. Dugoročno treba uvesti assessment_assignment / assessment_assignment_attempts ili ekvivalentan assessment-level model. | MVP guard sada sprečava da prazan attempt sakrije completed rezultat, ali pravi model rundi treba riješiti ownership, historiju i composite report storage. |
| P1        | Assignment-aware dashboard model | Candidate i HR dashboard trenutno ostaju attempt-based. Zbog toga existing completed attempts i dalje blokiraju kreiranje novog praznog attempta za isti test u novom assignment slice-u. | Da bi novi assessment ciklus mogao uvijek kreirati svježe attempts za sve testove, dashboardi moraju postati assignment-aware i preferirati linked attempts iz active assignmenta. |
| P2        | Attempt creation audit metadata | Novi attempti trenutno mogu imati metadata = {}, što otežava dijagnostiku izvora kreiranja attempta. | Dodati minimalni audit trag, npr. created_by_flow, source, created_by_user_id i reason, posebno za HR standard battery planner i candidate provisioning tokove. |
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
