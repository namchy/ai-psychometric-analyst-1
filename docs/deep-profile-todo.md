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
| P1        | MWMS HR report V1                                   | Planirano   | HR report / MWMS             | Implementirati HR-facing motivacijski report nakon eksplicitnog HR retrievala i locale readiness pravila. |
| P1        | Composite HR report data model decision             | Planirano   | Architecture / HR report storage | Odlučiti da li composite HR report ide kroz privremeni `attempt_reports` bridge ili kroz novi `assessment_reports` / assessment-level model. |
| P1        | Composite HR report V1                              | Planirano   | Product / AI report          | Implementirati composite HR report tek nakon data model odluke i single-test HR report temelja. |
| P1        | Oblik obraćanja: muški/ženski jezički oblik          | Otvoreno    | UX / i18n / AI promptovi     | Prvo uraditi product/technical discovery za addressing_form preferencu: modal, DB polje, participant preference, snapshot na attempt/report nivou i uticaj na AI promptove za participant reporte. |
| P1        | MWMS pitanja / item UX                               | Završeno    | Assessment UX / Copy         | Zatvoreno nakon uvođenja zajedničkog stem prikaza “Zašto ulažeš trud u svoj posao?”, labela “Mogući razlog”, jasnije MWMS skale i testSlug wiring-a u assessment run rutama. |
| P1        | IPIP radar chart                                     | Završeno    | Report UI / Visualization    | Zatvoreno nakon vraćanja deterministic radar chart prikaza u IPIP NEO-120 participant V2 report, koristeći report.domains[].display_score bez promjene scoringa ili AI pipelinea. |
| P1        | SAFRAN novi stimulus asseti                          | Otvoreno    | Assessment assets / UX       | Ubaciti nove SAFRAN stimulus slike sa većim, čitljivijim tekstom.                              |
| P1        | Globalni app header i footer                         | Završeno    | App shell / UI system        | Zatvoreno nakon uvođenja protected app-wide chrome i focus chrome moda za assessment execution rute. |
| P1        | Logo u headeru                                       | Otvoreno    | Branding / UI                | Dodati postojeći Deep Profile logo u globalni header.                                          |
| P1        | MWMS licenca                                         | Otvoreno    | Legal / Product risk         | Pravno očistiti komercijalnu upotrebu MWMS-a prije produkcijskog rollouta.                     |
| P2        | Login screen UI polish                               | Otvoreno    | Auth UI / Visual consistency | Uskladiti login ekran sa ostatkom aplikacije i popraviti font promjenu pri fokusu email polja. |
| P2        | IPIP poddimenzije prikaz                             | Otvoreno    | Report UI / Visualization    | Skratiti prikaz poddimenzija i razmotriti bars umjesto predugog tekstualnog prikaza.           |
| P2        | Candidate dashboard labels                           | Završeno    | UX copy                      | Kartice sada koriste user-facing title kao glavni naziv procjene, a instrument kao subtitle.   |
| P2        | Candidate dashboard CTA hover contrast               | Završeno    | Dashboard UI / Accessibility | Zatvoreno nakon popravke shared CTA hover/focus stilova za Započni procjenu, Nastavi procjenu i Pogledaj rezultate. |
| P2        | MWMS AI report copy ton                              | Završeno    | Report copy / Tone           | Zatvoreno nakon usklađivanja MWMS participant reporta na “ti” formu kroz prompt pravila, renderer safety net, display smoke test i regenerisani testni report. |
| P2        | Report visual language po testovima                  | Planirano   | Report UI                    | IPIP radar, MWMS bar profile, SAFRAN score cards, composite mapa.                              |
| P2        | Worker/report monitoring                             | Otvoreno    | Tech debt / Ops              | Pratiti queued/processing/ready/failed prelaze za AI report worker.                            |
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

**Status:** Planirano  
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

---

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
| P1        | MWMS HR report V1         | Planirano | MWMS ima participant lane, ali nema HR-facing motivacijski report za intervju/onboarding/management uvide. | Raditi nakon eksplicitnog HR retrievala i locale readiness pravila. |
| P1        | Composite HR report data model decision | Planirano | Composite HR report nema prirodan jedan attempt_id i traži storage odluku prije implementacije. | Procijeniti `attempt_reports` bridge naspram `assessment_reports` / assessment-level modela. |
| P1        | Composite HR report V1    | Planirano | Historijski “Kompozitni AI profil” sada se vodi kao jasniji composite HR report task. | Raditi tek nakon data model odluke i single-test HR report temelja. |
| P2        | Candidate dashboard labels | Završeno  | Kartice na candidate dashboardu sada prikazuju šta procjena mjeri kao glavni title, a naziv instrumenta kao subtitle.        | Commit/push nakon lokalne potvrde.                                                            |
| P2        | Candidate dashboard CTA hover contrast | Završeno | Completed CTA više ne gubi kontrast na hoveru, a shared CTA hover/focus sistem je usklađen za sve candidate dashboard kartice. | Zatvoreno nakon shared CTA hover/focus contrast fixa u candidate dashboard karticama. |
| P2        | MWMS AI report copy ton    | Završeno  | MWMS AI report koristi formalno “Vaš/Vam”; treba odlučiti da li candidate app ide na “ti” ili formalniji stil.               | Zatvoreno nakon prompt update-a, normalizeMwmsCopy safety net-a, forbidden-form smoke testa i regeneracije testnog MWMS participant reporta. |

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

MWMS HR report nije podržan u V1 i `unsupported_audience` je očekivano ponašanje.

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

1. MWMS HR report V1
2. Composite HR report data model decision
3. Composite HR report V1
4. Oblik obraćanja: muški/ženski jezički oblik
5. Report visual language po testovima
6. SAFRAN novi stimulus asseti
7. Logo u headeru
8. Login screen UI polish

Razlog za sljedeći prioritet:

* Nakon zatvaranja SAFRAN HR reporta V1 i HR candidate assessment detail flow-a, najlogičniji nastavak HR report lane-a je MWMS HR report V1, kako bi single-test HR temelji bili pokriveni prije composite HR report data model odluke i composite reporta.
* Nakon zatvaranja candidate dashboard lifecycle buga i CTA kontrast polish-a, nema aktivnog blockera na candidate dashboardu koji bi trebao odgoditi MWMS HR report V1.

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

---

## 6. Tehnički dug

| Prioritet | Tema                            | Opis                                                                                         | Napomena                                           |
| --------- | ------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| P1        | Snapshot jezičkog oblika        | Oblik obraćanja treba snapshotovati na attempt/report nivou i koristiti u participant promptovima, umjesto ručnog rješavanja po testu. | Slično locale snapshotu.                           |
| P1        | MWMS prompt/pipeline monitoring | Treba pratiti queued/processing/ready/failed prelaze za report worker.                       | Posebno prije produkcije.                          |
| P1        | Assessment assignment / assessment rounds | Trenutno se standardna procjena modelira kroz skup attemptova. To otežava razlikovanje legitimne nove runde procjene od praznog duplikat attempta. Dugoročno treba uvesti assessment_assignment / assessment_assignment_attempts ili ekvivalentan assessment-level model. | MVP guard sada sprečava da prazan attempt sakrije completed rezultat, ali pravi model rundi treba riješiti ownership, historiju i composite report storage. |
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
| Composite report UI    | Dizajnirati poseban composite ekran, ne samo još jedan report. | Nakon definisanja composite input/schema.                         |
| HR-facing MWMS report  | MWMS HR report V1 je sada P1 aktivni task; parking lot zadržava samo kasnije napredne varijante, npr. role-specific MWMS guidance. | Nakon zatvaranja MWMS HR reporta V1 i osnovnog HR report lane-a. |
| Report visual language | Svaki test treba imati svoj prikladan vizuelni summary.        | Nakon zatvaranja addressing taska i definisanja narednog participant polish sloja. |

---

## 8. Dnevnik završenih odluka

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
