# Deep Profile — To-do registar

| Prioritet | Task | Status | Kategorija | Sljedeći korak |
| --- | --- | --- | --- | --- |
| P1 | Kompozitni AI profil IPIP + SAFRAN + MWMS | Planirano | Product / AI report | Definisati input payload, schema, audience, fallback i UI strukturu. |
| P1 | Oblik obraćanja: muški/ženski jezički oblik | Otvoreno | UX / i18n / AI promptovi | Definisati modal, DB preferencu i snapshot na attempt/report nivou. |
| P1 | MWMS pitanja / item UX | Otvoreno | Assessment UX / Copy | Redizajnirati MWMS prikaz kao "Mogući razlog" + zajednički uvodni stem. |
| P1 | IPIP radar chart | Otvoreno | Report UI / Visualization | Vratiti radar chart kao deterministic visual summary za IPIP report. |
| P1 | MWMS licenca | Otvoreno | Legal / Product risk | Pravno očistiti komercijalnu upotrebu MWMS-a prije produkcijskog rollouta. |
| P2 | Candidate dashboard labels | Otvoreno | UX copy | Razmotriti prikaz "Radna motivacija" umjesto "MWMS". |
| P2 | MWMS AI report copy ton | Otvoreno | Report copy / Tone | Uskladiti "ti" vs. "vi/Vaš" nakon odluke o obliku obraćanja. |
| P2 | Report visual language po testovima | Planirano | Report UI | IPIP radar, MWMS bar profile, SAFRAN score cards, composite mapa. |
| P2 | Worker/report monitoring | Otvoreno | Tech debt / Ops | Pratiti queued/processing/ready/failed prelaze za AI report worker. |
| P3 | Trello workflow | Parking lot | Process / Automation | Kreirati Trello execution board tek nakon što zaključamo backlog strukturu. |
| P3 | HR-facing MWMS AI report | Parking lot | HR report | Razmotriti nakon composite arhitekture ili HR dashboard prioriteta. |

## 1. Svrha dokumenta

Ovaj dokument je centralni to-do registar za Deep Profile / AI Psychometric Analyst razvoj. Koristi se za bilježenje stvari koje primijetimo tokom razgovora, testiranja i razvoja, ali koje nisu nužno trenutni prioritet. Cilj je da ništa važno ne ostane izgubljeno u chatu.

## 2. Pravila korištenja

- Ako nešto primijetimo, a nije za trenutni task, ide ovdje.
- Ako je važno za proizvod, ali ne smije prekidati trenutni fokus, ide u backlog.
- Ako je tehnički dug, označava se jasno kao tehnički dug.
- Ako je samo ideja, ide u parking lot.
- Kad nešto pređe u aktivni rad, pomjera se u "Aktivni backlog".
- Kad se završi, ide u "Dnevnik završenih odluka".

### 2.1 Dogovoreni todo workflow

Koristimo tri sloja:

1. Canvas — radna memorija tokom razgovora.
2. Repo dokument — trajna verzija u GitHubu: docs/deep-profile-todo.md.
3. Trello — execution board za taskove koji ulaze u rad, kasnije i po potrebi.

Dogovorene komande:

- "zabilježi u todo" → ažurira se canvas dokument.
- "sync todo u repo" → kreira se Codex prompt za update docs/deep-profile-todo.md.
- "update todo i sync" → ažurira se canvas i odmah priprema Codex prompt za repo update.

Codex workflow za repo sync:

1. Sanela priprema precizan Codex prompt na osnovu trenutnog canvas to-do registra i dogovora.
2. Namchy šalje prompt Codexu.
3. Codex ažurira docs/deep-profile-todo.md u repou.
4. Namchy provjerava diff.
5. Promjena se commit/push-a, najčešće porukom: Update Deep Profile todo register.

Pravilo:
Canvas je prostor za razmišljanje i živi backlog, a GitHub dokument je trajna verzija sa historijom promjena.

## 3. Prioriteti

P0 — Kritično: blokira osnovni tok, sigurnost, scoring, report generation ili korisnički pristup.

P1 — Važno: direktno utiče na kvalitet proizvoda, korisničko razumijevanje ili diferencijator Deep Profile-a.

P2 — Korisno: polish, bolja konzistentnost, manji UX ili copy problemi.

P3 — Kasnije: dobre ideje koje nisu za sadašnji razvojni sprint.

## 4. Aktivni backlog

| Prioritet | Task | Status | Kategorija | Sljedeći korak |
| --- | --- | --- | --- | --- |
| P1 | MWMS pitanja / item UX | Otvoreno | Assessment UX / Copy | Redizajnirati MWMS prikaz tako da kandidat vidi zajednički uvodni stem i pojedinačne odgovore kao "Mogući razlog", umjesto da svaka stavka izgleda kao samostalno pitanje. |
| P1 | IPIP radar chart | Otvoreno | Report UI / Visualization | Vratiti radar chart za IPIP kao deterministic visual summary glavnih domena, bez AI zavisnosti i bez mijenjanja scoringa. |
| P1 | Oblik obraćanja: muški/ženski jezički oblik | Otvoreno | UX / i18n / AI promptovi | Definisati UX modal, DB preferencu, snapshot na attempt/report nivou i prompt/rendering pravila za muški i ženski jezički oblik. |
| P1 | Kompozitni AI profil IPIP + SAFRAN + MWMS | Planirano | Product / AI report | Definisati composite input payload, output schema, audience, fallback ponašanje i UI strukturu koja spaja osobine, motivaciju i kognitivni rezultat. |
| P2 | Candidate dashboard labels | Otvoreno | UX copy | Razmotriti da candidate dashboard prikazuje "Radna motivacija" umjesto internog naziva "MWMS", uz očuvanje test slugova i tehničkih identifikatora. |
| P2 | MWMS AI report copy ton | Otvoreno | Report copy / Tone | Uskladiti "ti" vs. "vi/Vaš" u MWMS participant reportu nakon odluke o obliku obraćanja i opštem tonu aplikacije. |

## 5. Product / UX odluke

### Radar chart politika

- IPIP: radar chart ima smisla i treba ga vratiti.
- MWMS: ne radar; bolji su motivacijski barovi/grupisani profil.
- SAFRAN: ne radar; bolji su score cards i horizontalni barovi.
- Composite: ne jedan veliki radar; bolja je integrisana mapa profila.

### MWMS report status

- MWMS V1 ima deterministic scoring, deterministic fallback report i participant-facing AI report V1 kroz attempt_reports pipeline.
- MWMS HR report nije podržan u V1 i unsupported_audience je očekivano ponašanje.

### Oblik obraćanja

- Ne pitati korisnika za "spol".
- Pitati: "Kako želiš da ti se aplikacija obraća?"
- Opcije: Muški oblik, Ženski oblik.
- Napomena: izbor ne utiče na rezultate procjene.

## 6. Tehnički dug

| Prioritet | Task | Opis | Napomena |
| --- | --- | --- | --- |
| P1 | Snapshot jezičkog oblika | Oblik obraćanja treba snapshotovati na attempt/report nivou. | Slično locale snapshotu. |
| P1 | MWMS prompt/pipeline monitoring | Treba pratiti queued/processing/ready/failed prelaze za report worker. | Posebno prije produkcije. |
| P2 | Branch features | Trenutno se radi na branchu features; main ostaje stabilan. | Ne mergati dok report/copy/pitanja nisu dotjerani. |
| P2 | MWMS licenca | MWMS tehnički radi, ali komercijalni rollout zavisi od licencnog/pravno-poslovnog odobrenja. | Nije dev blocker, jeste produkcijski blocker. |

## 7. Kasnije / parking lot

- Trello workflow
- Composite report UI
- HR-facing MWMS report
- Report visual language
- Trello automation bridge

## 8. Dnevnik završenih odluka

### 2026-05-04 — MWMS V1 functional + AI report

Završeno:

- MWMS aktivan DB paket.
- MWMS dio standardne baterije.
- Dashboard start/progress/resume/completion radi.
- dimension_scores upisuje 6 MWMS dimenzija kao prosjeke 1–7.
- Deterministic fallback report očišćen od generičkih Big Five/fallback sekcija.
- MWMS participant AI report V1 implementiran kroz postojeći attempt_reports pipeline.
- MWMS prompt aktiviran u DB.
- OpenAI schema compatibility bug riješen.
- Realni browser smoke test potvrdio report_status = ready i AI report render.

Nezavršeno:

- MWMS HR report nije podržan u V1.
- MWMS licencno pitanje ostaje otvoreno za komercijalni rollout.
- MWMS pitanja treba UX/copy doraditi zbog stem/item strukture.
