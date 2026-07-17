# Deep Profile Golden Demo Cohort

## Status i autoritet

- **Workstream:** `Deep Profile Golden Demo Cohort`
- **Status:** Active; prioritet i formalni status određuje [canonical todo](./deep-profile-todo.md), ne ovaj tracker.
- **Technical preflight:** [deep-profile-golden-demo-cohort-preflight.md](./deep-profile-golden-demo-cohort-preflight.md)
- **Demo organizacija:** **Partner Plus d.o.o. — Mikrokreditna organizacija**

Ovo je kontrolisani sintetički dataset za demonstraciju, report QA i regresiju. Nije trening niti model fine-tuning. Iterativno se kalibriraju prompt, content contract, schema zahtjevi, input builder i, samo kada je opravdano, validator granice.

## Implementacijski checkpoint — GD-001 database fixture

- GD-001 offline dataset (profil, 184 odgovora, očekivani scoreovi i AI kriteriji) je završen.
- Controlled DB writer foundation je završen; default ostaje read-only dry-run, a apply zahtijeva `--apply --candidate GD-001`.
- Migracije za atomski RPC `create_golden_demo_gd001_fixture_v1(jsonb)` i multi-active test contract primijenjene su na live bazu; live preflight je potvrdio tri active standard-battery testa i execute pravo samo za `postgres`/`service_role`.
- Partner Plus organizacija postoji i aktivna je. GD-001 fixture je kreiran atomskim RPC-om; pre-scoring read-only preflight je bio `EXACT_MATCH` sa 184 odgovora (`120` IPIP, `45` SAFRAN, `19` MWMS).
- Production scoring audit potvrdio je odvojenu deterministic scoring granicu: completion akcija eksplicitno poziva score persistence pa zasebno report orchestration. Kontrolisani GD-001 scoring operator je pripremljen kao default read-only dry-run i ne importuje niti poziva report/OpenAI put.
- GD-001 production scoring je izvršen live: završni scoring state je `SCORED_EXACT`, svih 184 odgovora imaju `raw_value` i `scored_value`, postoji 40 persisted dimensions, a expected-score provjera je `47/47`. Report generation i OpenAI pozivi ostali su `false`.
- Scoring operator sada razdvaja `fixtureWriterState` (nakon scoringa očekivano `CONFLICT`, što štiti nescorovani seed od ponovnog upisa), `fixtureCompatibilityState` (`EXACT_MATCH` samo uz nezavisnu provjeru dozvoljenih production mutacija) i `scoringState` (`SCORED_EXACT`). Naredni ljudski korak je review report-generation/AI lanea; scoring se ne ponavlja.

## Svrha i poslovna vrijednost

Golden cohort istovremeno služi za:

- realističan demo dataset za budući HR dashboard i mogući web demo;
- provjeru da production scoring iz kontrolisanih odgovora daje željene profile;
- sistematsku evaluaciju individualnih i timskih AI izvještaja;
- iterativnu kalibraciju promptova i content contracta;
- regresijsko testiranje poslije promjene modela, prompta, scheme, scoringa ili input buildera;
- provjeru cross-report konzistentnosti i praktične HR vrijednosti;
- razvoj UI-ja nad realističnim brojem korisnika, timova, statusa i report artefakata;
- klijentsku demonstraciju u poslovnom kontekstu mikrokreditne organizacije.

## Zaključena struktura kohorte

- Kohorta ima **24 Golden Demo kandidata**, bez dummy kandidata.
- Kandidati su `GD-001` do `GD-024`; svaki ima namjerno dizajniran, međusobno dovoljno različit profil i mora na kraju biti kvalitetan za klijentsku demonstraciju.
- Postoje četiri sintetička tima sa po šest članova.
- Development/calibration skup je `GD-001`–`GD-018`; holdout je `GD-019`–`GD-024`.
- Holdout kandidati su jednako kvalitetni Golden Demo kandidati, ali se ne koriste za prompt kalibraciju prije privremenog prompt freezea.
- Holdout je uravnotežen na 3 žene i 3 muškarca te po dvije osobe iz svake korisnikove izvorne grupe imena.
- Samo jedan tim ima dva kontrolisana nezavršena lifecycle slučaja. Ostala tri tima trebaju djelovati potpuno završeno i demo-ready; nezavršeni članovi se ne distribuiraju po svim timovima.
- Lifecycle tim je `GDT-04`; tačna dva kandidata i model historijske/aktivne runde ostaju odluka prije njegovog Team Dynamics fixturea.

## Demo identity policy

- Display identitet i tehnički fixture identitet su odvojeni.
- Interni ključevi su `GD-001`–`GD-024`, `GDT-01`–`GDT-04` i budući org-scoped fixture key.
- Aplikacija prikazuje ljudska imena, funkcije, timove i naziv organizacije, ne fixture ključeve, development/holdout status ili QA oznake.
- Sva imena i podaci su sintetički za potrebe ovog projekta.
- Nacionalna pripadnost nije product podatak, ne unosi se u manifest kandidata, bazu, report, dashboard ili review bundle.
- Korisnikove tri liste imena služe samo kao offline kontrola ravnoteže: ukupno 8 + 8 + 8, a u svakom timu 2 + 2 + 2.
- Kohorta je uravnotežena i po spolu: ukupno 12 žena i 12 muškaraca, a u svakom timu 3 žene i 3 muškarca.
- Demo email adrese koriste zaključani deterministic namespace `ime.prezime@partnerplus.ba`, lowercase i bez dijakritike.
- Ne koristiti stvarne telefonske brojeve, adrese, identifikacione dokumente, LinkedIn profile ili fotografije stvarnih osoba.

## Organizacija i timovi

| Team ID | Tim | Članovi | Poslovna uloga |
| --- | --- | ---: | --- |
| `GDT-01` | Kreditno poslovanje i rad s klijentima | 6 | Prijem i razvoj klijenata, kreditno savjetovanje i terenski rad. |
| `GDT-02` | Obrada kreditnih zahtjeva i kreditna administracija | 6 | Analiza zahtjeva, provjera dokumentacije, ugovori, isplate i dosjei. |
| `GDT-03` | Upravljanje kreditnim rizikom i portfoliom | 6 | Rizik, kvalitet procesa, praćenje portfolija i kreditna analiza. |
| `GDT-04` | Naplata i operativna podrška poslovnicama | 6 | Rana i terenska naplata, podrška poslovnicama, prigovori i operativno izvještavanje. |

## Registry korisnika

| Candidate ID | Ime i prezime | Funkcija | Tim | Skup |
| --- | --- | --- | --- | --- |
| `GD-001` | Amel Kovačević | Kreditni službenik za poljoprivredne klijente | Kreditno poslovanje i rad s klijentima | Development |
| `GD-002` | Nataša Rapaić | Voditeljica tima kreditnih službenika | Kreditno poslovanje i rad s klijentima | Development |
| `GD-003` | Vladimir Lučić | Terenski kreditni službenik | Kreditno poslovanje i rad s klijentima | Development |
| `GD-004` | Natali Delić | Kreditna službenica za stanovništvo | Kreditno poslovanje i rad s klijentima | Development |
| `GD-005` | Anisa Lojo Bajrić | Savjetnica za klijente i kreditne proizvode | Kreditno poslovanje i rad s klijentima | Development |
| `GD-019` | Ivan Bartulović | Kreditni službenik za poslovne klijente | Kreditno poslovanje i rad s klijentima | Holdout |
| `GD-006` | Marijana Bačić | Referentica za kreditne ugovore i isplate | Obrada kreditnih zahtjeva i kreditna administracija | Development |
| `GD-007` | Siniša Đuranović | Saradnik za provjeru kreditne dokumentacije | Obrada kreditnih zahtjeva i kreditna administracija | Development |
| `GD-008` | Draško Marković | Voditelj obrade kreditnih zahtjeva | Obrada kreditnih zahtjeva i kreditna administracija | Development |
| `GD-009` | Haris Lučkin | Saradnik za finansijsku analizu klijenata | Obrada kreditnih zahtjeva i kreditna administracija | Development |
| `GD-010` | Ela Halilhodžić | Referentica za administraciju kreditnih dosjea | Obrada kreditnih zahtjeva i kreditna administracija | Development |
| `GD-020` | Katarina Subotić | Analitičarka kreditnih zahtjeva | Obrada kreditnih zahtjeva i kreditna administracija | Holdout |
| `GD-011` | Ljiljana Ulemek Šapina | Saradnica za kontrolu kvaliteta kreditnog procesa | Upravljanje kreditnim rizikom i portfoliom | Development |
| `GD-012` | Gordana Trhulj | Specijalistica za upravljanje rizicima | Upravljanje kreditnim rizikom i portfoliom | Development |
| `GD-013` | Branislav Bošković | Analitičar kreditnog rizika | Upravljanje kreditnim rizikom i portfoliom | Development |
| `GD-014` | Muamer Durić | Saradnik za praćenje kreditnog portfolija | Upravljanje kreditnim rizikom i portfoliom | Development |
| `GD-021` | Davor Doko | Viši analitičar kreditnog portfolija | Upravljanje kreditnim rizikom i portfoliom | Holdout |
| `GD-022` | Alma Čatović Ademović | Voditeljica upravljanja rizicima i portfoliom | Upravljanje kreditnim rizikom i portfoliom | Holdout |
| `GD-015` | Jelena Kalinić | Saradnica za korisničku podršku i prigovore | Naplata i operativna podrška poslovnicama | Development |
| `GD-016` | Stefan Ječmenić | Saradnik za ranu naplatu potraživanja | Naplata i operativna podrška poslovnicama | Development |
| `GD-017` | Aleksandra Kalman | Referentica za operativnu podršku poslovnicama | Naplata i operativna podrška poslovnicama | Development |
| `GD-018` | Safet Burina | Koordinator naplate i podrške poslovnicama | Naplata i operativna podrška poslovnicama | Development |
| `GD-023` | Goran Tasić | Terenski saradnik za naplatu | Naplata i operativna podrška poslovnicama | Holdout |
| `GD-024` | Zenaida Hasić | Saradnica za operativno izvještavanje | Naplata i operativna podrška poslovnicama | Holdout |

### Kontrola ravnoteže

| Kontrola | Rezultat |
| --- | ---: |
| Ukupno kandidata | 24 |
| Development / calibration | 18 |
| Holdout | 6 |
| Žene / muškarci | 12 / 12 |
| Korisnikove tri izvorne grupe imena | 8 / 8 / 8 |
| Članovi po timu | 6 |
| Raspodjela u svakom timu | 3 žene / 3 muškarca i 2 / 2 / 2 iz izvornih grupa |
| Holdout ravnoteža | 3 žene / 3 muškarca i 2 / 2 / 2 iz izvornih grupa |

## Candidate-by-candidate workflow

Ne generisati svih 24 kandidata prije pregleda. Za svakog kandidata obavezni redoslijed je:

1. Definisati expected profil.
2. Definisati expected score bandove.
3. Definisati očekivane ključne signale.
4. Definisati zabranjene ili kontradiktorne tvrdnje i known ambiguities.
5. Deterministički generisati assessment odgovore.
6. Uraditi kontrolisani DB fixture upis.
7. Pokrenuti production scoring.
8. Verificirati scoreove prema expected bandovima.
9. Generisati pojedinačne report laneove production-equivalent putem.
10. Izvesti machine-readable review bundle.
11. Uraditi strukturisanu evaluaciju.
12. Klasifikovati svaki pronađeni problem.
13. Napraviti ciljanu promjenu prompta ili content contracta samo kada je opravdana.
14. Regenerisati pogođeni lane.
15. Uraditi regresiju nad ranije prihvaćenim kandidatima pogođenog lanea.
16. Donijeti `DEMO READY` odluku.
17. Tek tada preći na sljedećeg kandidata.

### Pravilo klasifikacije problema

Svaki nalaz pripada najmanje jednoj kategoriji: target profil/generator odgovora, scoring, AI input builder, prompt, schema/content contract, provider/model varijacija, validator/canonicalization, persistence, display mapping/renderer ili UI presentation.

Ne dodavati prompt instrukciju za izolovani stilski komentar. Prompt se mijenja samo za materijalan ili ponavljajući problem koji stvarno pripada prompt sloju.

### Regresijska pravila

- Promjena jednog report lanea ne pokreće automatski nepovezane laneove.
- Rano se ponavljaju svi ranije prihvaćeni kandidati pogođenog lanea; kasnije se za male promjene može koristiti reprezentativni sentinel skup.
- Velike promjene zahtijevaju širu ili punu regresiju.
- Holdout dolazi nakon privremenog prompt freezea; prije demo releasea svih 24 prolaze finalnu demo-readiness provjeru.
- Regresija je gubitak ranije podržanog signala, nova kontradikcija, slabija kalibracija ili materijalno lošija praktična vrijednost. Drugačija formulacija istog ispravnog značenja nije regresija.

## Review bundle contract

Canonical evaluator artefakt je jedan verzionisani strukturisani JSON bundle po kandidatu. Markdown je opcioni human-readable pratilac; JSON je glavni evaluator input.

Gdje je tehnički moguće, bundle sadrži fixture key i sintetičke osnovne podatke, team key, expected profil/bandove/signale/zabranjene tvrdnje/ambiguities, konkretne odgovore ili sigurnu determinističku referencu, stvarne production scoreove i score-verification rezultat, AI input snapshot po laneu, model/prompt/schema verzije, sigurno uhvaćen provider raw structured output, persisted report snapshot, display model ili tekstualnu display projekciju, validator rezultate i generation metadata. Bundle nikada ne sadrži secrets, tokene, service-role vrijednosti, nationality/ethnicity polja ili nepotrebne lične podatke.

V1 ne uvodi novu QA tabelu. Preferirani model je versioned fixture manifest u repou, production podaci u postojećim tabelama, read-only export skripta, JSON bundle, opcioni Markdown i strukturisani evaluator rezultat.

## Evaluator workflow

ChatGPT je glavni semantički evaluator u odnosu na unaprijed definisano očekivano stanje. Svaki report ocjenjuje vjernost podacima, pokrivenost signala, kontradikcije, sigurnost jezika, kandidat-specifičnost, HR praktičnu vrijednost, audience fit, bosanski ijekavski jezik/terminologiju, sigurnosne granice, cross-report konzistentnost i demo readiness.

Evaluator rezultat najmanje sadrži `PASS`, `PASS WITH NOTES` ili `FAIL`, `demoReady`, pogođene laneove, root-cause klasifikaciju, preporučenu narednu akciju i preporučeni regresijski skup.

## Trackeri

### Candidate execution registry

| Candidate ID | Ime | Team | Dev / holdout | Expected profile | Responses | Scores | Single-test reports | Composite / IDP | Evaluator review | Regression | Demo readiness | Napomena |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GD-001` | Amel Kovačević | `GDT-01` | Development | Defined | 184 persisted / verified | Not started | Not started | Not started | Not started | N/A | Not ready | DB fixture `EXACT_MATCH`; scoring operator review pending |
| `GD-002` | Nataša Rapaić | `GDT-01` | Development | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | — |
| `GD-003` | Vladimir Lučić | `GDT-01` | Development | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | — |
| `GD-004` | Natali Delić | `GDT-01` | Development | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | — |
| `GD-005` | Anisa Lojo Bajrić | `GDT-01` | Development | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | — |
| `GD-006` | Marijana Bačić | `GDT-02` | Development | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | — |
| `GD-007` | Siniša Đuranović | `GDT-02` | Development | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | — |
| `GD-008` | Draško Marković | `GDT-02` | Development | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | — |
| `GD-009` | Haris Lučkin | `GDT-02` | Development | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | — |
| `GD-010` | Ela Halilhodžić | `GDT-02` | Development | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | — |
| `GD-011` | Ljiljana Ulemek Šapina | `GDT-03` | Development | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | — |
| `GD-012` | Gordana Trhulj | `GDT-03` | Development | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | — |
| `GD-013` | Branislav Bošković | `GDT-03` | Development | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | — |
| `GD-014` | Muamer Durić | `GDT-03` | Development | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | — |
| `GD-015` | Jelena Kalinić | `GDT-04` | Development | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | Lifecycle allocation TBC |
| `GD-016` | Stefan Ječmenić | `GDT-04` | Development | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | Lifecycle allocation TBC |
| `GD-017` | Aleksandra Kalman | `GDT-04` | Development | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | — |
| `GD-018` | Safet Burina | `GDT-04` | Development | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | — |
| `GD-019` | Ivan Bartulović | `GDT-01` | Holdout | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | After prompt freeze |
| `GD-020` | Katarina Subotić | `GDT-02` | Holdout | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | After prompt freeze |
| `GD-021` | Davor Doko | `GDT-03` | Holdout | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | After prompt freeze |
| `GD-022` | Alma Čatović Ademović | `GDT-03` | Holdout | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | After prompt freeze |
| `GD-023` | Goran Tasić | `GDT-04` | Holdout | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | After prompt freeze |
| `GD-024` | Zenaida Hasić | `GDT-04` | Holdout | TBC | Not started | Not started | Not started | Not started | Not started | N/A | Not ready | After prompt freeze |


### Prompt calibration log

| Report lane | Stara verzija | Nova verzija | Kandidat | Root cause | Razlog promjene | Očekivani efekat | Regresijski skup | Rezultat | Odluka |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| None yet | — | — | — | — | — | — | — | — | No change |

### Team registry

| Team ID | Planirani identitet | Članovi | Readiness | Individualni profili potvrđeni | Timski izvještaji | Evaluator review | Demo readiness |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GDT-01` | Kreditno poslovanje i rad s klijentima | `GD-001`–`GD-005`, `GD-019` | Not started | No | Not started | Not started | Not ready |
| `GDT-02` | Obrada kreditnih zahtjeva i kreditna administracija | `GD-006`–`GD-010`, `GD-020` | Not started | No | Not started | Not started | Not ready |
| `GDT-03` | Upravljanje kreditnim rizikom i portfoliom | `GD-011`–`GD-014`, `GD-021`–`GD-022` | Not started | No | Not started | Not started | Not ready |
| `GDT-04` | Naplata i operativna podrška poslovnicama; jedini lifecycle tim | `GD-015`–`GD-018`, `GD-023`–`GD-024` | Not started | No | Not started | Not started | Not ready |

## Milestones

1. Plan i technical preflight. **Završeno.**
2. Demo organizacija, timovi i registry korisnika. **Završeno.**
3. Manifest i contract foundation.
4. `GD-001` end-to-end.
5. Prvi prompt calibration i regression loop.
6. Prvi kompletan tim.
7. Development kandidati `GD-001`–`GD-018`.
8. Prompt freeze.
9. Holdout `GD-019`–`GD-024`.
10. Puna cohort i cross-report provjera.
11. Timski izvještaji.
12. Demo readiness.
13. Integracija dataseta u novi HR dashboard.
14. Eventualni javni demo environment.

## Scope

U scope su sintetički kandidati/timovi, deterministički odgovori, production scoring, production-equivalent report generation, prompt calibration, regresija, review export, evaluator QA i demo data.

Nisu scope novi HR dashboard UI, shadcn implementacija, javni demo deployment, automatsko blokiranje production persistencea evaluator verdictom, stvarni korisnički podaci niti GitHub Issues/Project sync.
