# Deep Profile — To-do registar

## Kompaktni prioritetni pregled taskova

| Prioritet | Task                                                 | Status      | Kategorija                   | Sljedeći korak                                                                                 |
| --------- | ---------------------------------------------------- | ----------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| P1        | IPIP prethodno pitanje ne prikazuje odabrani odgovor | Otvoreno    | Assessment UX / State        | Provjeriti persistenciju i rehydration odgovora pri navigaciji nazad u IPIP testu.             |
| P1        | SAFRAN izgleda kao da ima default označen odgovor    | Otvoreno    | Assessment UX / Input state  | Provjeriti da nijedan odgovor nije unaprijed selektovan, posebno vrijednost/option 1.          |
| P1        | IPIP tekst na karticama dimenzija se ponavlja        | Otvoreno    | Report UI / Copy             | Locirati duplirani copy u IPIP report karticama i ukloniti ponavljanje.                        |
| P1        | Kompozitni AI profil IPIP + SAFRAN + MWMS            | Planirano   | Product / AI report          | Definisati input payload, schema, audience, fallback i UI strukturu.                           |
| P1        | Oblik obraćanja: muški/ženski jezički oblik          | Otvoreno    | UX / i18n / AI promptovi     | Definisati modal, DB preferencu i snapshot na attempt/report nivou.                            |
| P1        | MWMS pitanja / item UX                               | Otvoreno    | Assessment UX / Copy         | Redizajnirati MWMS prikaz kao “Mogući razlog” + zajednički uvodni stem.                        |
| P1        | IPIP tekst na karticama dimenzija se ponavlja        | Otvoreno    | Report UI / Copy             | Locirati duplirani copy u IPIP report karticama i ukloniti ponavljanje.                        |
| P1        | IPIP prethodno pitanje ne prikazuje odabrani odgovor | Otvoreno    | Assessment UX / State        | Provjeriti persistenciju i rehydration odgovora pri navigaciji nazad u IPIP testu.             |
| P1        | SAFRAN default označen odgovor                       | Otvoreno    | Assessment UX / Input state  | Provjeriti da nijedan odgovor nije unaprijed selektovan, posebno vrijednost/option 1.          |
| P1        | IPIP radar chart                                     | Otvoreno    | Report UI / Visualization    | Vratiti radar chart kao deterministic visual summary za IPIP report.                           |
| P1        | SAFRAN novi stimulus asseti                          | Otvoreno    | Assessment assets / UX       | Ubaciti nove SAFRAN stimulus slike sa većim, čitljivijim tekstom.                              |
| P1        | Globalni app header i footer                         | Otvoreno    | App shell / UI system        | Definisati i primijeniti jedan konzistentan header i footer na cijeloj aplikaciji.             |
| P1        | Logo u headeru                                       | Otvoreno    | Branding / UI                | Dodati postojeći Deep Profile logo u globalni header.                                          |
| P1        | SAFRAN novi stimulus asseti                          | Otvoreno    | Assessment assets / UX       | Ubaciti nove SAFRAN stimulus slike sa većim, čitljivijim tekstom.                              |
| P1        | Globalni app header i footer                         | Otvoreno    | App shell / UI system        | Definisati i primijeniti jedan konzistentan header i footer na cijeloj aplikaciji.             |
| P1        | Logo u headeru                                       | Otvoreno    | Branding / UI                | Dodati postojeći Deep Profile logo u globalni header.                                          |
| P1        | MWMS licenca                                         | Otvoreno    | Legal / Product risk         | Pravno očistiti komercijalnu upotrebu MWMS-a prije produkcijskog rollouta.                     |
| P2        | Login screen UI polish                               | Otvoreno    | Auth UI / Visual consistency | Uskladiti login ekran sa ostatkom aplikacije i popraviti font promjenu pri fokusu email polja. |
| P2        | IPIP poddimenzije prikaz                             | Otvoreno    | Report UI / Visualization    | Skratiti prikaz poddimenzija i razmotriti bars umjesto predugog tekstualnog prikaza.           |
| P2        | IPIP poddimenzije prikaz                             | Otvoreno    | Report UI / Visualization    | Skratiti prikaz poddimenzija i razmotriti bars umjesto predugog tekstualnog prikaza.           |
| P2        | Login screen UI polish                               | Otvoreno    | Auth UI / Visual consistency | Uskladiti login ekran sa ostatkom aplikacije i popraviti font promjenu pri fokusu email polja. |
| P2        | Candidate dashboard labels                           | Završeno    | UX copy                      | Kartice sada koriste user-facing title kao glavni naziv procjene, a instrument kao subtitle.   |
| P2        | MWMS AI report copy ton                              | Otvoreno    | Report copy / Tone           | Uskladiti “ti” vs. “vi/Vaš” nakon odluke o obliku obraćanja.                                   |
| P2        | Report visual language po testovima                  | Planirano   | Report UI                    | IPIP radar, MWMS bar profile, SAFRAN score cards, composite mapa.                              |
| P2        | Worker/report monitoring                             | Otvoreno    | Tech debt / Ops              | Pratiti queued/processing/ready/failed prelaze za AI report worker.                            |
| P3        | HR-facing MWMS AI report                             | Parking lot | HR report                    | Razmotriti nakon composite arhitekture ili HR dashboard prioriteta.                            |

> Ova tabela je operativni pregled. Detalji, kontekst i odluke za svaki task ostaju u tijelu dokumenta ispod.

---

## Outline

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

Koristimo tri sloja:

1. **Canvas** — radna memorija tokom razgovora i izvor istine za trenutni to-do sadržaj.
2. **Repo dokument** — trajna verzija u GitHubu: `docs/deep-profile-todo.md`.
3. **GitHub Projects** — execution board za taskove koji ulaze u rad.

Dogovorene komande u razgovoru:

* **“zabilježi u todo”** → ažurira se canvas dokument.
* **“sync todo”** → Sanela uzima trenutni canvas to-do sadržaj i priprema Codex prompt koji taj sadržaj sinhronizuje u `docs/deep-profile-todo.md`.

Pravilo za sync:

* Canvas je izvor istine za sadržaj.
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

Pravilo: Canvas je prostor za razmišljanje i živi backlog, a GitHub dokument je trajna verzija sa historijom promjena. Codex je izvršitelj sync-a, ne dodatni interpretator to-do sadržaja.

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

| Prioritet | Tema                       | Status    | Kratak opis                                                                                                                  | Sljedeći korak                                                                                |
| --------- | -------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| P1        | MWMS pitanja / item UX     | Otvoreno  | MWMS itemi trenutno mogu zvučati čudno jer su zavisni od zajedničkog uvodnog pitanja, a prikazuju se kao samostalna pitanja. | Dizajnirati MWMS-specific question screen: “Mogući razlog” + stalni stem + objašnjenje skale. |
| P1        | IPIP radar chart           | Otvoreno  | Radar chart je postojao u ranijoj IPIP verziji, ali je vjerovatno ispao iz novog AI/V2 render patha.                         | Vratiti radar kao deterministic visual summary za IPIP, bez obzira na AI report readiness.    |
| P1        | Oblik obraćanja            | Otvoreno  | Korisnik treba odabrati muški ili ženski jezički oblik obraćanja, bez pitanja o spolu.                                       | Definisati modal, DB polje/preferencu i snapshot na attempt/report nivou.                     |
| P1        | Kompozitni AI profil       | Planirano | Glavni diferencijator je AI sinteza IPIP + SAFRAN + MWMS.                                                                    | Prvo definisati input payload, schema, audience, UI strukturu i fallback.                     |
| P2        | Candidate dashboard labels | Završeno  | Kartice na candidate dashboardu sada prikazuju šta procjena mjeri kao glavni title, a naziv instrumenta kao subtitle.        | Commit/push nakon lokalne potvrde.                                                            |
| P2        | MWMS AI report copy ton    | Otvoreno  | MWMS AI report koristi formalno “Vaš/Vam”; treba odlučiti da li candidate app ide na “ti” ili formalniji stil.               | Uskladiti nakon odluke o općem candidate tonu i obliku obraćanja.                             |

---

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

GitHub Projects je uveden kao execution board za Deep Profile taskove.

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

* GitHub Projects workflow radi.
* `sync todo` treba ažurirati `docs/deep-profile-todo.md` i usklađivati GitHub issues/Project kartice prema kompaktnoj prioritetnoj tabeli.
* Codex mora prvo provjeriti postojeće issues po title-u ili stabilnom markeru u bodyju, da ne kreira duplikate.
* Codex ne interpretira backlog; izvršava sync iz canvas/repo to-do sadržaja.

---

## 7. Kasnije / parking lot

| Tema                   | Ideja                                                          | Kada razmatrati                                                   |
| ---------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| Composite report UI    | Dizajnirati poseban composite ekran, ne samo još jedan report. | Nakon definisanja composite input/schema.                         |
| HR-facing MWMS report  | Poseban HR report za motivacijski profil kandidata.            | Nakon composite arhitekture ili ako HR dashboard to prvo zatraži. |
| Report visual language | Svaki test treba imati svoj prikladan vizuelni summary.        | Nakon vraćanja IPIP radar charta.                                 |

---

## 8. Dnevnik završenih odluka

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
