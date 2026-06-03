# HR Report Architecture Spec

## 0. Status

**Status:** Draft v0.1  
**Kategorija:** Product architecture / HR report / AI report  
**Vlasništvo sadržaja:** Product odluke iz razgovora Namchy + Sanela  
**Codex uloga:** zapisivanje dokumenta, bez product interpretacije

Ovaj dokument definiše arhitekturu HR izvještaja za Deep Profile.

Dokument ne implementira report pipeline, UI, DB migracije ili AI promptove. Njegova svrha je da zaključa product i architecture smjer prije implementacije.

---

## 1. Svrha HR reporta

HR report u Deep Profile-u je decision-support izvještaj za HR profesionalce i organizacije koje žele bolje razumjeti kandidata, zaposlenika ili člana tima kroz psihometrijske procjene.

HR report ne donosi automatsku odluku o kandidatu. Ne daje presudu. Ne zamjenjuje intervju, CV, reference, portfolio, probni rad ili poslovni kontekst.

Njegova svrha je da HR-u pomogne da:

- bolje razumije radne obrasce osobe
- prepozna motivacijske izvore i moguće tačke frikcije
- razumije kognitivne signale u kontekstu radnih zadataka
- dobije praktične hipoteze koje treba provjeriti u intervjuu
- pripremi bolji onboarding
- uskladi stil menadžmenta sa profilom osobe
- prepozna potencijalne tačke opreza bez etiketiranja osobe
- donese informisaniju, ali i dalje ljudsku odluku

North star rečenica:

> HR report u Deep Profile-u povezuje rezultate psihometrijskih procjena u praktične uvide za selekciju, intervju, onboarding i menadžersku podršku, bez automatskog odlučivanja o kandidatu.

---

## 2. Primarna publika i use case-ovi

### 2.1 Primarna publika

HR report je namijenjen za:

- HR profesionalce
- talent acquisition timove
- people operations timove
- hiring menadžere
- team leadove
- organizacije koje procjenjuju postojeće timove
- organizacije koje žele razumjeti fit kandidata u odnosu na konkretan tim

### 2.2 Glavni use case-ovi

#### Kandidat u selekciji

HR želi razumjeti:

- kako kandidat vjerovatno pristupa radu
- šta ga motiviše
- kako se može ponašati pod pritiskom
- kako razmišlja kroz različite tipove zadataka
- koja pitanja vrijedi postaviti u intervjuu
- gdje treba biti oprezan prije odluke

#### Novi zaposlenik u onboardingu

HR i menadžer žele razumjeti:

- kakav onboarding pristup može najbolje raditi
- gdje osobi treba struktura
- gdje joj treba autonomija
- kako pratiti prvih 30, 60 i 90 dana
- koje rane signale disengagementa treba pratiti

#### Postojeći zaposlenik

Organizacija želi razumjeti:

- razvojne potrebe
- motivacijske obrasce
- moguće izvore zasićenja
- stil rada i saradnje
- bolji način vođenja osobe

#### Team-fit scenario

Kasnija faza.

HR želi razumjeti:

- kako se kandidat uklapa u postojeći tim
- gdje može donijeti balans
- gdje može pojačati postojeće napetosti
- kakva menadžerska podrška je potrebna za uspješnu integraciju

---

## 3. Razlika između candidate reporta i HR reporta

Candidate report i HR report nisu isti izvještaj sa drugačijim naslovom.

### 3.1 Candidate report

Candidate report odgovara na pitanje:

> Šta moji rezultati znače za mene?

Karakteristike:

- pisan direktno kandidatu
- edukativan
- neutralan i podržavajući
- fokusiran na samorazumijevanje
- izbjegava organizacijske pretpostavke
- ne govori HR-u šta da radi
- ne sadrži selekcijske preporuke
- ne sadrži intervju pitanja
- ne sadrži menadžerske smjernice

### 3.2 HR report

HR report odgovara na pitanje:

> Šta ovi rezultati znače za radno ponašanje, selekciju, intervju, onboarding i upravljanje osobom?

Karakteristike:

- pisan za HR profesionalca
- praktičan
- konkretniji
- povezuje više testova
- daje hipoteze, ne presude
- uključuje intervju pitanja
- uključuje onboarding preporuke
- uključuje menadžerske smjernice
- uključuje tačke opreza
- zadržava etičke i interpretacijske granice

### 3.3 Zabranjeno miješanje

Candidate report ne smije prikazivati HR-only sekcije.

HR report ne smije koristiti candidate-facing ton ako time ublažava važne radne implikacije.

Oba reporta moraju koristiti iste deterministic rezultate, ali različitu interpretacijsku perspektivu.

---

## 4. Nivoi HR izvještaja

Deep Profile treba podržati više nivoa HR reporta.

### 4.1 IPIP HR report

Svrha:

- razumjeti radne obrasce
- opisati stil saradnje
- opisati odnos prema odgovornosti, strukturi, pritisku, promjenama i komunikaciji
- dati HR-u pitanja za intervju na osnovu profila ličnosti

Status:

- djelimično već postoji kroz postojeći IPIP HR report lane
- treba ga uskladiti sa budućom kompozitnom arhitekturom

### 4.2 SAFRAN HR report

Svrha:

- opisati kognitivne signale
- prikazati verbalni, figuralni, numerički i ukupni rezultat
- dati opreznu HR interpretaciju bez normi, IQ jezika ili selekcijske presude
- povezati rezultate sa vrstama radnih zadataka

Mora izbjegavati:

- “inteligentan”
- “neinteligentan”
- “iznadprosječan”
- “ispodprosječan”
- IQ
- percentile
- definitivne zaključke o sposobnosti za posao

Pravilniji jezik:

- “rezultat ukazuje na…”
- “može biti korisno provjeriti kroz intervju ili radni zadatak…”
- “ovaj signal treba čitati zajedno sa iskustvom, intervjuom i kontekstom uloge…”

### 4.3 MWMS HR report

Svrha:

- opisati motivacijski profil
- prepoznati šta osobu pokreće
- prepoznati gdje može doći do pada angažmana
- dati preporuke za menadžerski pristup
- povezati motivaciju sa radnim okruženjem

Treba uključiti:

- intrinsic motivation
- identified regulation
- introjected regulation
- external regulation
- amotivation, ako postoji u scoring modelu
- dominantne motivacijske obrasce
- moguće frikcije između motivacije i radnog konteksta

### 4.4 Composite HR report

Glavni B2B artefakt.

Composite HR report povezuje:

- IPIP: radni obrasci i ponašanje
- SAFRAN: kognitivni signali
- MWMS: motivacija
- kasnije DATCH/team-fit: timska dinamika

Composite report nije zbir tri reporta. On treba sintetizirati.

Primjer vrijednosti:

- IPIP pokazuje visoku savjesnost
- MWMS pokazuje dominantnu eksternu motivaciju
- SAFRAN pokazuje jak verbalni signal
- Composite HR report treba objasniti šta ta kombinacija može značiti za radni stil, angažman, onboarding i intervju

### 4.5 Team-fit report

Kasnija faza.

Svrha:

- kandidat u odnosu na konkretan tim
- postojeći timski obrasci
- potencijalni doprinos kandidata
- moguće napetosti
- onboarding u timu
- menadžerska intervencija

Ne ulazi u MVP HR report architecture implementaciju, ali spec mora ostaviti prostor za njega.

---

## 5. MVP scope

MVP HR report architecture treba pokriti:

1. report nivoe
2. audience razlikovanje
3. single-test HR report princip
4. composite HR report princip
5. input contract
6. deterministic vs AI pravila
7. dashboard access flow
8. fallback ponašanje
9. report status lifecycle
10. guardrails protiv pogrešne interpretacije

MVP ne mora odmah implementirati:

- team-fit report
- normativne percentile
- role-specific benchmarking
- hiring recommendation score
- organization-specific success model
- custom competency framework
- advanced comparison između kandidata
- bulk ranking kandidata

MVP mora isporučiti vrijednost kroz:

- jasan HR summary
- praktične uvide
- intervju pitanja
- onboarding smjernice
- menadžerske preporuke
- tačke opreza

Radna odluka:

> Composite HR report je glavni B2B cilj, ali se gradi preko jasnih single-test HR blokova i zajedničke arhitekture.

---

## 6. Struktura kompozitnog HR reporta

Kompozitni HR report treba imati standardnu strukturu.

### 6.1 Executive summary za HR

Svrha:

- dati HR-u brzi pregled najvažnijih signala
- ne donositi odluku
- ne prepričavati sve rezultate
- istaknuti 3 do 5 najvažnijih radnih implikacija

Format:

- 5 do 7 rečenica
- jasan, poslovni ton
- bez hype jezika
- bez “idealni kandidat”
- bez “ne preporučuje se”

### 6.2 Ključni radni obrasci

Izvor primarno:

- IPIP domains
- IPIP facets
- eventualno povezivanje sa MWMS motivacijom

Treba opisati:

- stil rada
- odnos prema odgovornosti
- odnos prema saradnji
- reakciju na pritisak
- odnos prema promjenama
- komunikacijski obrazac
- potrebu za strukturom ili autonomijom

Ne treba opisivati:

- ličnost kao etiketu
- privatni karakter
- psihološku dijagnozu
- moralne kvalitete osobe

### 6.3 Motivacijski profil

Izvor:

- MWMS rezultati

Treba opisati:

- šta kandidata vjerovatno pokreće
- da li motivacija više dolazi iz interesa, smisla, identifikacije, pritiska, nagrade ili izbjegavanja negativnih posljedica
- koji radni kontekst može pojačati angažman
- koji radni kontekst može smanjiti angažman

Pitanja koja sekcija treba odgovoriti:

- Zašto osoba ulaže trud?
- Kada će vjerovatno biti najangažovanija?
- Kada može doći do pada energije?
- Kakva vrsta feedbacka može raditi bolje?
- Kakva očekivanja treba postaviti rano?

### 6.4 Kognitivni signali

Izvor:

- SAFRAN verbal score
- SAFRAN figural score
- SAFRAN numeric score
- SAFRAN overall score

Treba opisati:

- verbalno razumijevanje
- figuralno zaključivanje
- numeričko rezonovanje
- opšti kognitivni signal u ovom instrumentu

Mora biti oprezno.

Zabranjen jezik:

- IQ
- inteligencija kao etiketa
- nadaren
- slab
- iznadprosječan
- ispodprosječan
- “nije za kompleksne zadatke”
- “odličan za analitičke poslove”

Dozvoljen jezik:

- “u ovom setu zadataka”
- “rezultat može ukazivati”
- “signal treba provjeriti kroz konkretne radne zadatke”
- “korisno je povezati sa iskustvom i intervjuom”

### 6.5 Tačke opreza

Naziv treba ostati:

> Tačke opreza

Ne koristiti:

- rizici zapošljavanja
- red flags
- problemi
- slabosti
- negativne strane

Tačke opreza su hipoteze koje HR treba provjeriti.

Svaka tačka opreza treba imati:

- šta je signal
- zašto je važno
- kako ga provjeriti

### 6.6 Preporučena intervju pitanja

Ovo je obavezna MVP vrijednost HR reporta.

Pitanja moraju biti:

- konkretna
- vezana za profil
- otvorena
- profesionalna
- korisna hiring menadžeru

Ne smiju biti:

- sugestivna
- diskriminatorna
- terapijska
- invazivna
- bazirana na dijagnozama

Preporučene kategorije:

- pitanja o radnom stilu
- pitanja o motivaciji
- pitanja o pritisku i promjenama
- pitanja o kognitivnim zahtjevima posla
- pitanja za provjeru tačaka opreza

### 6.7 Onboarding preporuke

Ova sekcija prevodi profil u prvih 30/60/90 dana.

Treba uključiti:

- kako postaviti očekivanja
- kakav nivo strukture dati
- koliko često davati feedback
- koje zadatke dati rano
- koje situacije pratiti
- kako smanjiti rizik pogrešnog starta

Struktura:

- prvih 30 dana
- 60 dana
- 90 dana

### 6.8 Menadžerske smjernice

Svrha:

- pomoći menadžeru da bolje vodi osobu
- prevesti rezultate u svakodnevni rad

Treba uključiti:

- stil feedbacka
- nivo autonomije
- potrebu za strukturom
- način delegiranja
- način praćenja napretka
- moguće izvore konflikta
- kako održati angažman

### 6.9 Interpretacijska ograničenja

Ova sekcija je obavezna.

Treba reći:

- report nije odluka o zapošljavanju
- report ne mjeri sve aspekte osobe
- rezultate treba kombinovati sa intervjuom, CV-jem, referencama i poslovnim kontekstom
- kognitivni rezultati nisu IQ
- motivacijski profil nije trajna etiketa
- ponašajni obrasci nisu dijagnoza
- report daje hipoteze za provjeru

---

## 7. Input podaci

HR report generator ne smije raditi nad sirovim odgovorima ako to nije potrebno.

Primarni input treba biti strukturisani, deterministic output scoring sloja.

### 7.1 IPIP input

Input treba uključiti:

- test slug
- attempt id
- report audience
- domains
- facets
- canonical scores
- display scores
- bands
- labels
- deterministic summary ako postoji
- participant locale
- report version

### 7.2 SAFRAN input

Input treba uključiti:

- verbal score
- figural score
- numeric score
- overall score
- max scores
- deterministic band labels
- interpretation constraints
- informaciju da nema normi/percentila/IQ interpretacije

### 7.3 MWMS input

Input treba uključiti:

- motivational dimensions
- scores
- bands
- dominant motivation pattern
- possible low/high indicators
- interpretation constraints

### 7.4 Metadata

Input treba uključiti:

- candidate/participant id
- organization id
- attempt ids
- completed_at timestamps
- report locale
- report type
- source type
- generator version
- prompt version id
- model name ako se koristi AI
- fallback mode ako se koristi deterministic fallback

## 7.5 Locale model and multilingual readiness

MVP aplikacija i report sadržaj trenutno ostaju na bosanskom jeziku, ali HR report architecture mora biti locale-aware od početka.

Važna razlika:

- `assessmentLocale` označava jezik na kojem kandidat rješava test.
- `participantReportLocale` označava jezik candidate reporta.
- `hrReportLocale` označava jezik HR reporta i/ili HR interfejsa.
- `reportLocale` označava target jezik konkretnog report artefakta.

Ovi jezici ne moraju uvijek biti isti.

Primjer validnog budućeg scenarija:

```json
{
  "assessmentLocale": "bs",
  "participantReportLocale": "bs",
  "hrReportLocale": "sr"
}
```

Radna odluka:

- MVP može koristiti `attempt.locale` kao fallback.
- Future HR report generation ne smije dugoročno zavisiti isključivo od `attempt.locale`.
- Za HR report, target report locale treba doći iz HR user/workspace/report-request locale-a kada takav izvor postoji.
- `attempt.locale` smije biti fallback, ne jedini source of truth.
- Snapshot mora čuvati jezik u kojem je report generisan.
- Input za buduće HR/composite reportove treba moći čuvati i assessment locale i report locale kada se razlikuju.

---

## 8. Deterministic vs AI odgovornosti

Ovo mora biti tvrda granica.

### 8.1 Deterministic sloj radi

- scoring
- raw score calculations
- display score
- band assignment
- label assignment
- max score
- completion status
- attempt status
- report readiness
- fallback osnovne interpretacije
- validation inputa

### 8.2 AI sloj smije raditi

- povezivanje više rezultata
- formulaciju HR-friendly uvida
- objašnjenje mogućih radnih implikacija
- generisanje intervju pitanja
- generisanje onboarding smjernica
- generisanje menadžerskih preporuka
- sintezu između IPIP, SAFRAN i MWMS
- ton i narativ, u okviru zadatih pravila

### 8.3 AI sloj ne smije raditi

- računati score
- mijenjati score
- mijenjati band
- izmišljati podatke
- izmišljati norme
- izmišljati percentile
- izmišljati IQ
- donositi hire/no-hire odluku
- tvrditi da će osoba sigurno raditi na određeni način
- patologizirati osobu
- koristiti medicinski ili dijagnostički jezik
- donositi zaključke o zaštićenim karakteristikama
- koristiti privatne pretpostavke koje nisu u inputu

---

## 9. Safety i interpretacijski guardrails

HR report mora imati stroža pravila od candidate reporta, jer može uticati na poslovne odluke.

### 9.1 Jezik vjerovatnoće

Preferirani izrazi:

- može ukazivati
- vjerovatno
- moguće je da
- korisno je provjeriti
- ovaj signal treba čitati zajedno sa
- u ovom kontekstu
- na osnovu dostupnih rezultata

Izbjegavati:

- sigurno
- dokazano
- garantuje
- uvijek
- nikada
- kandidat je
- kandidat nije sposoban za
- treba ga zaposliti
- ne treba ga zaposliti

### 9.2 Bez selekcijske presude

Zabranjeno:

- “preporučuje se zapošljavanje”
- “ne preporučuje se zapošljavanje”
- “visok hiring score”
- “loš fit”
- “rizičan kandidat”
- “idealni kandidat”

Dozvoljeno:

- “ovo je signal koji vrijedi provjeriti”
- “ovo može biti važno za uloge koje zahtijevaju…”
- “intervju treba dodatno istražiti…”

### 9.3 Bez normativnog jezika kada nemamo norme

Posebno za SAFRAN:

Zabranjeno:

- percentile
- IQ
- iznadprosječan
- ispodprosječan
- prosječan u populaciji
- visok kognitivni kapacitet kao definitivna tvrdnja

Dozvoljeno:

- veći broj tačnih odgovora u ovom setu
- umjeren broj tačnih odgovora u ovom setu
- manji broj tačnih odgovora u ovom setu
- preliminarni kognitivni signal
- rezultat u okviru ove procjene

### 9.4 Bez psihologiziranja i dijagnoza

Zabranjeno:

- anksiozan
- narcisoidan
- depresivan
- emocionalno nestabilan kao dijagnostička tvrdnja
- problematična ličnost
- poremećaj
- trauma
- klinički zaključci

Dozvoljeno:

- može imati nižu toleranciju na nejasnoću
- može preferirati jasniju strukturu
- može biti osjetljiviji na nepredvidive promjene
- može pokazivati izraženiju potrebu za feedbackom

---

## 10. Report generation flow

### 10.1 Single-test HR report flow

Za pojedinačni test:

1. kandidat završi test
2. scoring sloj izračuna deterministic rezultate
3. sistem provjeri da li postoji HR report konfiguracija za test
4. kreira se report job sa:
   - audience = hr
   - source_type = single_test
   - report_type = individual
5. report provider generiše HR report
6. validator provjerava schema contract
7. report se sprema kao report snapshot
8. HR dashboard prikazuje status i link ka reportu

### 10.2 Composite HR report flow

Za kompozitni report:

1. sistem provjeri da li su završeni potrebni testovi
2. za MVP: IPIP + SAFRAN + MWMS
3. sistem gradi composite input iz deterministic rezultata
4. kreira se composite report job
5. report ima:
   - audience = hr
   - source_type = composite
   - report_type = candidate_profile
6. AI generiše strukturisani report
7. validator provjerava schema contract
8. report se sprema kao composite report snapshot
9. HR dashboard prikazuje “Kompozitni izvještaj spreman”

### 10.3 Regeneration

Regeneration treba biti dozvoljen samo u kontrolisanim slučajevima:

- report failed
- promijenjena report verzija
- promijenjen prompt version
- admin/HR eksplicitno zatraži regeneraciju, ako je podržano

Ne regenerisati report pri svakom otvaranju stranice.

---

## 11. HR dashboard UX flow

HR dashboard mora razlikovati procjenu od izvještaja.

### 11.1 Status procjene

Primarni statusi:

- nije dodijeljeno
- dodijeljeno
- kandidat započeo
- djelimično završeno
- svi testovi završeni
- spremno za pregled
- traži pažnju

### 11.2 Status reporta

Report statusi:

- nije generisan
- u redu čekanja
- generiše se
- spreman
- greška
- fallback prikaz dostupan

### 11.3 Row action logika

Za kandidata u HR dashboardu:

Ako nema dodijeljene procjene:

- CTA: Kreiraj procjenu

Ako je procjena u toku:

- CTA: Prati status
- ne prikazivati lažni report

Ako su pojedinačni testovi završeni, ali composite nije spreman:

- CTA: Pogledaj dostupne rezultate
- sekundarno: Generiši HR izvještaj, ako nije automatski

Ako je composite HR report spreman:

- CTA: Pogledaj HR izvještaj

Ako je report failed:

- CTA: Pokušaj ponovo
- prikazati tehnički neutralnu poruku

### 11.4 Report page struktura

HR report page treba imati:

- kandidat header
- status procjene
- završeni testovi
- composite HR report
- single-test report cards
- metadata collapse
- interpretacijsku napomenu
- eventualno download/export kasnije

### 11.5 UX princip

HR ne treba loviti report kroz tehničke route-ove.

Dashboard mora jasno reći:

- šta je završeno
- šta nedostaje
- šta je spremno
- šta nije moguće prikazati
- šta HR može uraditi sljedeće

---

## 12. Data model i report storage pristup

### 12.1 Postojeći princip

Koristiti postojeći report lifecycle za single-test reportove gdje je primjenjivo.

Za HR single-test report:

- audience = hr
- source_type = single_test
- report_type = individual

Za candidate report:

- audience = participant
- source_type = single_test
- report_type = individual

### 12.2 Composite report potreba

Composite report vjerovatno ne može čisto pripadati jednom attemptu.

Postoje dvije opcije.

#### Opcija A: Composite report kroz postojeći report model

Prednost:

- manje promjena u DB-u
- koristi postojeći lifecycle
- brže za MVP

Problem:

- composite report nema prirodan jedan attempt_id
- mora se vezati za “primary” attempt ili workaround
- semantički prljavije

#### Opcija B: Nova tabela assessment_reports

Prednost:

- čistiji model
- prirodno podržava composite izvještaje
- može se vezati za assessment assignment / participant / organization
- bolje za budući team-fit

Problem:

- veći task
- zahtijeva migracije
- zahtijeva nove query-je i UI wiring

Radna preporuka:

Za arhitekturu planirati Opciju B kao dugoročno ispravnu, ali za MVP procijeniti da li je dozvoljen privremeni bridge kroz postojeći model.

Ne donositi konačnu implementacijsku odluku dok se ne uradi audit postojećeg koda i realne cijene uvođenja nove tabele.

### 12.3 Assessment assignment dependency

Dugoročno, composite HR report prirodno traži entitet:

- assessment_assignments
- assessment_assignment_attempts
- assessment_reports

Trenutno standardna procjena živi kao skup attempts. To radi za MVP, ali nije idealno za ozbiljan composite reporting.

Spec mora jasno zabilježiti da je assessment_assignment vjerovatna buduća arhitektonska potreba.

---

## 13. Fallback ponašanje

HR report sistem mora imati fallback.

### 13.1 Ako AI generisanje ne uspije

Prikazati:

- deterministic score summary
- status da AI interpretacija nije dostupna
- mogućnost retry ako je podržano
- bez lažnog reporta

Ne prikazivati mock report kao stvarni HR report.

### 13.2 Ako je jedan test završen, a drugi nisu

Prikazati:

- dostupne pojedinačne rezultate
- jasno reći da composite report još nije spreman
- ne generisati partial composite report osim ako ga eksplicitno podržimo

Radna odluka za MVP:

> Composite HR report se generiše tek kada su završeni IPIP, SAFRAN i MWMS.

### 13.3 Ako nedostaje MWMS

Do tada:

- composite report nije spreman
- dostupni su IPIP/SAFRAN pojedinačni rezultati ako postoje
- dashboard mora jasno pokazati šta nedostaje

### 13.4 Ako postoji schema validation error

Report status:

- failed

Failure reason:

- tehnički log interno
- HR vidi neutralnu poruku

Primjer HR-facing poruke:

> Izvještaj trenutno nije moguće prikazati. Rezultati procjene su sačuvani, ali interpretacija nije uspješno generisana.

---

## 14. Otvorene odluke

Ovo su odluke koje treba zaključati prije implementacije.

### 14.1 Da li composite HR report čuvamo u postojećem report modelu ili uvodimo novu tabelu?

Radni smjer:

- kratkoročno procijeniti postojeći model
- dugoročno vjerovatno nova assessment_reports tabela

### 14.2 Da li HR report generišemo automatski nakon završetka svih testova?

Opcije:

- automatski
- na klik HR-a
- automatski za single-test, ručno za composite
- automatski za sve, ali sa retry logikom

Radna preporuka:

> Automatski generisati kada su svi potrebni testovi završeni, ali HR dashboard mora podržati retry.

### 14.3 Da li partial composite report postoji?

Radna preporuka za MVP:

> Ne. Composite report tek nakon IPIP + SAFRAN + MWMS.

### 14.4 Da li HR report uključuje role/job context?

MVP:

> Ne obavezno.

Kasnije:

> Da, jer HR report postaje mnogo snažniji kada zna ulogu, senioritet, timski kontekst i ključne kompetencije.

### 14.5 Da li HR report ima export/download?

MVP:

> Ne mora.

Kasnije:

> PDF/export vjerovatno postaje važan B2B feature.

### 14.6 Da li HR može vidjeti candidate report?

Radna preporuka:

> HR treba vidjeti HR report. Candidate report ostaje kandidat-facing artefakt. Ako HR vidi candidate report, mora biti jasno označeno da nije namijenjen za HR odluke.

---

## 15. Implementacijski roadmap

### Phase 1: Spec i todo sync

Cilj:

- kreirati docs/hr-report-architecture-spec.md
- ažurirati docs/deep-profile-todo.md
- dodati HR report architecture kao P1 task
- jasno označiti dependency prema composite reportu

Output:

- dokument
- update todo-a
- bez koda aplikacije

### Phase 2: Audit postojećeg HR report sistema

Cilj:

- pregledati postojeći IPIP HR report
- mapirati postojeći report flow
- utvrditi šta već postoji
- utvrditi šta treba refaktorisati za SAFRAN/MWMS/composite

Output:

- tehnički audit
- lista fajlova
- preporuka za data model

### Phase 3: HR dashboard report access design

Cilj:

- definisati UX route-ove
- definisati CTA stanja
- definisati report status prikaz
- definisati empty/error/fallback state

Output:

- UI/UX specifikacija
- bez nužno pune implementacije

### Phase 4: SAFRAN HR report V1

Cilj:

- napraviti HR-facing SAFRAN report
- koristiti oprezni deterministic + eventualno AI interpretacijski sloj
- bez normi/IQ/percentila
- uključiti intervju pitanja i tačke opreza

Output:

- SAFRAN HR report contract
- renderer
- generation flow
- tests

### Phase 5: MWMS HR report V1

Cilj:

- napraviti HR-facing motivacijski report
- uključiti menadžerske smjernice
- povezati motivacijske obrasce sa radnim kontekstom

Output:

- MWMS HR report contract
- renderer
- generation flow
- tests

### Phase 6: Composite HR report V1

Cilj:

- povezati IPIP + SAFRAN + MWMS
- generisati jedan HR profile report
- prikazati ga u HR dashboardu
- ne praviti hiring decision score

Output:

- composite input builder
- composite schema
- provider routing
- validator
- renderer
- dashboard access
- tests

### Phase 7: Future team-fit report

Cilj:

- povezati kandidata sa postojećim timom
- koristiti DATCH/team dynamics
- prikazati usklađenosti, tačke opreza i onboarding u timu

Output:

- future spec
- nije dio MVP-a

---

## 16. Predloženi MVP HR report schema shape

Ovo nije finalna TypeScript schema, nego konceptualni oblik.

```json
{
  "report_type": "candidate_hr_composite_v1",
  "audience": "hr",
  "locale": "bs",
  "candidate_summary": {
    "headline": "Kratki radni profil kandidata",
    "summary": "..."
  },
  "work_behavior_patterns": [
    {
      "title": "Odnos prema strukturi i odgovornosti",
      "insight": "...",
      "evidence": ["IPIP: Savjesnost viša", "IPIP: Neuroticizam uravnotežen"],
      "hr_implication": "..."
    }
  ],
  "motivation_profile": {
    "dominant_pattern": "...",
    "engagement_drivers": ["..."],
    "possible_friction_points": ["..."],
    "management_notes": ["..."]
  },
  "cognitive_signals": {
    "summary": "...",
    "verbal": "...",
    "figural": "...",
    "numeric": "...",
    "overall": "..."
  },
  "points_of_caution": [
    {
      "signal": "...",
      "why_it_matters": "...",
      "how_to_check": "..."
    }
  ],
  "interview_questions": [
    {
      "category": "Radni stil",
      "question": "...",
      "what_to_listen_for": "..."
    }
  ],
  "onboarding_recommendations": {
    "first_30_days": ["..."],
    "days_60": ["..."],
    "days_90": ["..."]
  },
  "manager_guidance": [
    {
      "area": "Feedback",
      "recommendation": "..."
    }
  ],
  "interpretation_limits": [
    "Ovaj izvještaj nije odluka o zapošljavanju.",
    "Rezultate treba čitati zajedno sa intervjuom, iskustvom i kontekstom uloge."
  ]
}
```
