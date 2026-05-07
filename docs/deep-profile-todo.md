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
| P1        | Kompozitni AI profil IPIP + SAFRAN + MWMS            | Planirano   | Product / AI report          | Definisati input payload, schema, audience, fallback i UI strukturu.                           |
| P1        | Oblik obraćanja: muški/ženski jezički oblik          | Otvoreno    | UX / i18n / AI promptovi     | Definisati modal, DB preferencu i snapshot na attempt/report nivou.                            |
| P1        | MWMS pitanja / item UX                               | Otvoreno    | Assessment UX / Copy         | Redizajnirati MWMS prikaz kao “Mogući razlog” + zajednički uvodni stem.                        |
| P1        | IPIP radar chart                                     | Otvoreno    | Report UI / Visualization    | Vratiti radar chart kao deterministic visual summary za IPIP report.                           |
| P1        | SAFRAN novi stimulus asseti                          | Otvoreno    | Assessment assets / UX       | Ubaciti nove SAFRAN stimulus slike sa većim, čitljivijim tekstom.                              |
| P1        | Globalni app header i footer                         | Završeno    | App shell / UI system        | Zatvoreno nakon uvođenja protected app-wide chrome i focus chrome moda za assessment execution rute. |
| P1        | Logo u headeru                                       | Otvoreno    | Branding / UI                | Dodati postojeći Deep Profile logo u globalni header.                                          |
| P1        | MWMS licenca                                         | Otvoreno    | Legal / Product risk         | Pravno očistiti komercijalnu upotrebu MWMS-a prije produkcijskog rollouta.                     |
| P2        | Login screen UI polish                               | Otvoreno    | Auth UI / Visual consistency | Uskladiti login ekran sa ostatkom aplikacije i popraviti font promjenu pri fokusu email polja. |
| P2        | IPIP poddimenzije prikaz                             | Otvoreno    | Report UI / Visualization    | Skratiti prikaz poddimenzija i razmotriti bars umjesto predugog tekstualnog prikaza.           |
| P2        | Candidate dashboard labels                           | Završeno    | UX copy                      | Kartice sada koriste user-facing title kao glavni naziv procjene, a instrument kao subtitle.   |
| P2        | MWMS AI report copy ton                              | Otvoreno    | Report copy / Tone           | Uskladiti “ti” vs. “vi/Vaš” nakon odluke o obliku obraćanja.                                   |
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

| Prioritet | Tema                       | Status    | Kratak opis                                                                                                                  | Sljedeći korak                                                                                |
| --------- | -------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| P1        | MWMS pitanja / item UX     | Otvoreno  | MWMS itemi trenutno mogu zvučati čudno jer su zavisni od zajedničkog uvodnog pitanja, a prikazuju se kao samostalna pitanja. | Redizajnirati prikaz kao zajednički stem + “Mogući razlog” + trenutna item tvrdnja + jasna 1–7 instrukcija skale. |
| P1        | IPIP radar chart           | Otvoreno  | Radar chart je postojao u ranijoj IPIP verziji, ali je vjerovatno ispao iz novog AI/V2 render patha.                         | Vratiti radar kao deterministic visual summary za IPIP, bez obzira na AI report readiness.    |
| P1        | Oblik obraćanja            | Otvoreno  | Korisnik treba odabrati muški ili ženski jezički oblik obraćanja, bez pitanja o spolu.                                       | Definisati modal, DB polje/preferencu i snapshot na attempt/report nivou.                     |
| P1        | Kompozitni AI profil       | Planirano | Glavni diferencijator je AI sinteza IPIP + SAFRAN + MWMS.                                                                    | Prvo definisati input payload, schema, audience, UI strukturu i fallback.                     |
| P2        | Candidate dashboard labels | Završeno  | Kartice na candidate dashboardu sada prikazuju šta procjena mjeri kao glavni title, a naziv instrumenta kao subtitle.        | Commit/push nakon lokalne potvrde.                                                            |
| P2        | MWMS AI report copy ton    | Otvoreno  | MWMS AI report koristi formalno “Vaš/Vam”; treba odlučiti da li candidate app ide na “ti” ili formalniji stil.               | Uskladiti nakon odluke o općem candidate tonu i obliku obraćanja.                             |

---

Napomena za zatvorene P1 stavke:

* `IPIP prethodno pitanje ne prikazuje odabrani odgovor` je završeno kroz popravku selected-state vidljivosti i resume/back-navigation feedbacka; IPIP auto-advance ostaje, bez `Nastavi` dugmeta.
* `SAFRAN izgleda kao da ima default označen odgovor` je zatvoren kao nereproduciran nakon ručne provjere; nije bio potreban code change.
* `IPIP tekst na karticama dimenzija se ponavlja` je završen u browser-visible V2 participant report rendereru; scoring, AI promptovi i `attempt_reports` pipeline nisu mijenjani.

## 5. Product / UX odluke

### 5.1 Radar chart politika

* IPIP: radar chart ima smisla i treba ga vratiti.
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

1. MWMS pitanja / item UX
2. IPIP radar chart
3. Oblik obraćanja
4. Kompozitni AI profil IPIP + SAFRAN + MWMS
5. MWMS AI report copy ton
6. Report visual language po testovima

Razlog za sljedeći prioritet:

* `MWMS pitanja / item UX` je sada preporučeni sljedeći task jer je MWMS već dio standardne baterije, a trenutni item prikaz može zvučati nezgrapno pošto instrument koristi zajednički stem i item tvrdnje.

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

---

## 6. Tehnički dug

| Prioritet | Tema                            | Opis                                                                                         | Napomena                                           |
| --------- | ------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| P1        | Snapshot jezičkog oblika        | Oblik obraćanja treba snapshotovati na attempt/report nivou.                                 | Slično locale snapshotu.                           |
| P1        | MWMS prompt/pipeline monitoring | Treba pratiti queued/processing/ready/failed prelaze za report worker.                       | Posebno prije produkcije.                          |
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
| HR-facing MWMS report  | Poseban HR report za motivacijski profil kandidata.            | Nakon composite arhitekture ili ako HR dashboard to prvo zatraži. |
| Report visual language | Svaki test treba imati svoj prikladan vizuelni summary.        | Nakon vraćanja IPIP radar charta.                                 |

---

## 8. Dnevnik završenih odluka

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
