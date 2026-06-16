# Team Fit & Dynamics — product/tech spec v0.1

## 1. Svrha i status dokumenta

Ovaj dokument je canonical product/tech spec v0.1 za Team Fit & Dynamics modul u Deep Profile proizvodu.

Status v0.1:

- Dokument definiše MVP granice, ključne product odluke, osnovni data model i lifecycle.
- Dokument je operativni izvor istine za buduće implementacijske slice-ove vezane za Team Dynamics i Team Fit.
- Dokument ne mijenja postojeći runtime, bazu, report providere, renderere, validatore, lifecycle helpere ili UI.
- Dokument ne autorizuje report regeneraciju, scheduler, automatic worker ili nove DB migracije.

## 2. Terminologija i razgraničenje

Team Fit & Dynamics nije jedan report. To je modul koji obuhvata timsku procjenu, timski izvještaj i kandidat-vs-team izvještaj.

### 2.1. Team Dynamics assessment

Team Dynamics assessment je instrument koji popunjavaju članovi tima.

Svrha:

- prikupiti standardizovane odgovore članova tima o timskoj dinamici, saradnji, psihološkoj sigurnosti, situacionim reakcijama i kratkom outcome pulse-u;
- proizvesti validne member score snapshot-e za svakog uključenog člana;
- omogućiti kasniju timsku agregaciju tek kada je inclusion set potpun.

Assessment nije report i ne daje kandidat-team fit interpretaciju.

### 2.2. Team Dynamics Executive Overview report

Team Dynamics Executive Overview report je HR/admin-facing timski izvještaj nastao iz agregiranih rezultata članova tima.

Svrha:

- dati pregled timskih obrazaca, snaga, rizika i tema za upravljanje timom;
- raditi isključivo nad potpunim i validnim inclusion setom;
- ostati read-only nakon što je report spreman.

Ovaj report ne smije biti dostupan dok svi uključeni članovi nisu završili procjenu i dok za sve njih ne postoje validni score snapshot-i.

### 2.3. Team Fit kandidata report

Team Fit kandidata report je HR/admin-facing izvještaj koji poredi kandidata sa agregiranim timskim kontekstom.

Svrha:

- pomoći HR/admin korisniku da razumije kako se kandidatov radni stil može uklopiti u postojeću timsku dinamiku;
- identifikovati moguće komplementarnosti, napetosti, onboarding potrebe i teme za intervju;
- podržati ljudsku odluku, ne zamijeniti je.

Team Fit nije hiring decision engine. Ne daje hire/no-hire odluku i ne sadrži numeric fit score.

## 3. MVP scope

MVP obuhvata:

- Team setup za definisanje tima i relevantnog assessment konteksta.
- Dodavanje članova u tim i definisanje inclusion seta za timski report.
- Dodjelu Team Dynamics assessmenta članovima tima.
- Praćenje completion statusa za uključene članove.
- Kreiranje member score snapshot-a nakon završetka assessmenta.
- Full readiness check prije timske agregacije.
- Timski aggregation snapshot nad kompletnim inclusion setom.
- Ručni izbor/generisanje Team Dynamics Executive Overview reporta.
- Ručni izbor/generisanje Team Fit reporta za kandidata kada postoje potrebni inputi.
- Read-only rendering gotovih reporta za HR/admin korisnike.
- Controlled report lifecycle statusi: pending, processing, ready, failed.

## 4. Šta nije dio MVP-a

Nije dio MVP-a:

- automatski scheduler kao default način obrade;
- background automatic worker kao obavezni dio osnovnog product flow-a;
- parcijalna timska agregacija;
- Team Dynamics report prije potpune spremnosti inclusion seta;
- numeric fit score za Team Fit;
- hire/no-hire odluka;
- imenovanje pojedinačnih članova tima u glavnom Team Fit reportu;
- participant-facing prikaz HR/admin reporta;
- admin observability bez eksplicitnog authorization dizajna;
- empirijska validacija i kalibracija instrumenta kao završena tvrdnja;
- dodatni Team Dynamics report kinds osim Executive Overview MVP reporta;
- Composite HR promjene;
- report regeneration postojećih artefakata bez eksplicitnog odobrenja.

## 5. Ključne product odluke

### 5.1. Potpuna spremnost je obavezna

Team Dynamics timski report nije dostupan dok svi uključeni članovi nisu završili procjenu i imaju validne score snapshot-e.

Parcijalna agregacija nije dozvoljena u MVP-u. Razlog je product jasnoća: timski report mora predstavljati definisani inclusion set, a ne privremeni subset koji može zavesti HR/admin korisnika.

Ako član neće završiti procjenu, HR/admin ga mora eksplicitno ukloniti iz inclusion seta. Tek nakon uklanjanja može se ponovo izračunati readiness za preostali set.

### 5.2. Veličina tima

Pravila veličine tima:

- 4-10 članova: idealan raspon za MVP.
- 11-15 članova: dozvoljeno uz upozorenje o interpretacijskim ograničenjima.
- 16+ članova: blokirano za MVP Team Dynamics report.

Ova pravila se odnose na inclusion set za timsku agregaciju, ne nužno na sve osobe koje organizaciono pripadaju širem timu.

### 5.3. Team Fit bez scoring iluzije

Team Fit ne daje numeric fit score. Report mora koristiti kvalitativni candidate-vs-team framing:

- gdje kandidat može dopuniti tim;
- gdje može nastati napetost;
- šta HR treba provjeriti;
- šta menadžer treba znati za onboarding.

Report ne smije sadržavati hire/no-hire, pass/fail ili sličnu konačnu odluku.

### 5.4. Privatnost članova tima

Team Fit ne smije imenovati pojedinačne članove tima u glavnom reportu. Timski kontekst mora biti agregiran.

Ako postoji potreba za internom auditabilnošću, ona mora biti riješena odvojeno kroz autorizovani admin/diagnostic sloj, ne kroz glavni HR-facing report.

### 5.5. Manual processing kao MVP default

Scheduler/automatic worker nije default MVP.

MVP pretpostavka je ručna obrada:

- HR/admin pokreće ili retry-a report processing kroz kontrolisani UI/action;
- worker/procesor može postojati kao manual worker shell;
- automatski background scheduler se uvodi samo nakon eksplicitne product i authorization odluke.

## 6. High-level data model

Ovo je konceptualni model. Tačna schema i migracije moraju biti definisane u zasebnim implementacijskim slice-ovima.

### 6.1. `teams`

Predstavlja tim kao organizacionu ili procjensku jedinicu.

Ključni koncepti:

- tenant/organization scope;
- naziv tima;
- status;
- metadata za HR/admin kontekst.

### 6.2. `team_memberships`

Predstavlja članstvo osobe u timu.

Ključni koncepti:

- team id;
- participant/person id;
- membership status;
- role/label ako je potreban za HR kontekst;
- datumi ulaska/izlaska ako su relevantni.

### 6.3. `team_assessment_assignments`

Predstavlja assessment ciklus ili zadatak za tim.

Ključni koncepti:

- team id;
- assessment package/test reference;
- status assignmenta;
- created by HR/admin;
- lifecycle metadata.

### 6.4. `team_assessment_participants`

Predstavlja inclusion set za konkretni timski assessment assignment.

Ključni koncepti:

- assignment id;
- team membership/person reference;
- inclusion status;
- completion status;
- explicit removal marker kada član neće završiti;
- veza prema pokušaju/procjeni ako postoji.

Ova tabela je authority za pitanje ko ulazi u timsku agregaciju.

### 6.5. `team_member_scores`

Predstavlja member score snapshot nakon završene procjene.

Ključni koncepti:

- assignment participant id;
- score snapshot;
- scoring version;
- source attempt id;
- validation status;
- created timestamp.

Score snapshot mora biti stabilan input za agregaciju. Agregacija ne treba zavisiti od ponovnog izračunavanja sirovih odgovora u report-time fazi.

### 6.6. `team_score_aggregations` / aggregation snapshot

Predstavlja agregirani timski snapshot za kompletan inclusion set.

Ključni koncepti:

- assignment id;
- included participant ids ili stabilan inclusion fingerprint;
- aggregation version;
- aggregate scores;
- spread/variance indikatori gdje su product-validni;
- readiness metadata;
- created timestamp.

Aggregation snapshot je input za Team Dynamics report i timski input za Team Fit report.

### 6.7. `team_assessment_reports`

Predstavlja Team Dynamics report artefakte.

Ključni koncepti:

- assignment id;
- aggregation snapshot reference;
- report kind, npr. `executive_overview`;
- lifecycle status: pending, processing, ready, failed;
- input snapshot;
- report snapshot;
- error metadata za controlled retry.

### 6.8. `team_fit_reports`

Predstavlja kandidat-vs-team report artefakte.

Ključni koncepti:

- candidate/participant reference;
- candidate assessment/source references;
- team id;
- aggregation snapshot reference;
- lifecycle status: pending, processing, ready, failed;
- input snapshot;
- report snapshot;
- interpretation limits;
- error metadata za controlled retry.

## 7. High-level lifecycle

### 7.1. Team setup

HR/admin kreira ili bira tim i potvrđuje osnovni kontekst. Tim mora imati dovoljno definisan membership kontekst prije assessment assignmenta.

### 7.2. Member assignment

HR/admin kreira Team Dynamics assignment i definiše koji članovi ulaze u inclusion set.

Sistem provjerava veličinu inclusion seta:

- 4-10: dozvoljeno;
- 11-15: dozvoljeno uz upozorenje;
- 16+: blokirano.

### 7.3. Member completion

Svaki uključeni član završava Team Dynamics assessment.

Participant-facing flow smije prikazivati samo procjenu i vlastiti progress, ne HR/admin report output.

### 7.4. Member score snapshot

Nakon completiona sistem server-side kreira member score snapshot.

Snapshot mora sadržavati verziju scoring logike i dovoljno metadata da kasniji report zna kojim inputom raspolaže.

### 7.5. Full readiness check

Sistem provjerava da li svaki trenutno uključeni član ima:

- completed assessment;
- validan member score snapshot;
- inclusion status koji nije removed.

Ako bilo koji uključeni član nedostaje, timska agregacija i Team Dynamics report ostaju nedostupni.

### 7.6. Team aggregation

Kada je readiness potpun, sistem kreira aggregation snapshot za cijeli inclusion set.

Snapshot je stabilan input za report generation. Ako se inclusion set promijeni, potreban je novi readiness check i nova agregacija.

### 7.7. Report selection

HR/admin bira odgovarajući report:

- Team Dynamics Executive Overview za timski pregled;
- Team Fit za kandidata u odnosu na postojeći timski kontekst.

Report selection ne smije automatski značiti background generation osim ako je to eksplicitno implementirano u kasnijem odobrenom slice-u.

### 7.8. Manual processing

MVP processing je ručni:

- HR/admin pokreće processing;
- report prelazi u processing;
- provider/worker kreira input snapshot i report snapshot;
- uspješan output prelazi u ready;
- greška prelazi u failed sa kontrolisanim retry mogućnostima.

### 7.9. Ready/read-only rendering

Ready report se prikazuje kao read-only HR/admin artefakt.

Renderer ne treba ponovo računati scoring ili agregaciju. Renderer prikazuje persisted report snapshot i relevantne metadata elemente koji pomažu korisniku razumjeti obuhvat, datum i interpretacijska ograničenja.

## 8. Team Dynamics instrument summary

Canonical package slug: `team_dynamics_assessment_v1`

Instrument status: content/spec package završen, validation pending.

Format:

- mixed format;
- 4 bloka;
- 48 items ukupno.

Blokovi:

- TDM-31;
- psychological safety;
- SJT best/worst;
- outcome pulse.

Instrument je namijenjen za timsku dinamiku i agregirani timski uvid. Nije samostalni dokaz za individualnu selekcijsku odluku.

Validation pending stavke:

- SME review;
- pilot validation;
- licensing/legal confirmation;
- empirical calibration;
- report/scoring validation.

Dok ove stavke nisu završene, reporti moraju imati odgovarajuće interpretacijske granice i ne smiju tvrditi potpunu validacijsku zrelost.

## 9. Team Dynamics Executive Overview report

### 9.1. Purpose

Executive Overview daje HR/admin korisniku sažet, operativan pregled timske dinamike.

Report treba odgovoriti na pitanja:

- koji su dominantni timski obrasci;
- gdje tim ima stabilne snage;
- gdje postoje tačke opreza;
- šta menadžer ili HR treba provjeriti u razgovoru;
- koje teme su relevantne za rad sa timom.

### 9.2. Input source

Primary input je Team Dynamics aggregation snapshot nastao iz kompletnog inclusion seta.

Dozvoljeni inputi:

- aggregation snapshot;
- inclusion set metadata;
- instrument/scoring version metadata;
- controlled HR/admin context ako je eksplicitno dozvoljen.

Nedozvoljeno:

- parcijalni member subset;
- direktno čitanje sirovih odgovora u rendereru;
- individualno imenovanje članova kao glavni report sadržaj;
- report-time promjena scoringa ili agregacije.

### 9.3. Report status/lifecycle

Report lifecycle:

- pending;
- processing;
- ready;
- failed.

`ready` znači da report ima persisted input snapshot i persisted report snapshot koji se mogu read-only prikazati.

`failed` mora omogućiti kontrolisani retry bez nejasnog automatskog loop-a.

### 9.4. Manual worker MVP

MVP pretpostavlja manual worker ili manual processing action.

Scheduler nije default. Ako se kasnije uvede, mora imati zasebnu product odluku, observability i authorization model.

### 9.5. Renderer/read-only route

Renderer i route moraju biti HR/admin-only.

Read-only route:

- prikazuje persisted ready report;
- ne pokreće generisanje sama od sebe;
- ne radi scoring;
- ne radi agregaciju;
- ne izlaže participant-facing korisnicima HR-only sadržaj.

## 10. Team Fit report

### 10.1. Purpose

Team Fit report pomaže HR/admin korisniku razumjeti odnos kandidatovog radnog stila i postojećeg timskog konteksta.

Report treba podržati:

- pripremu intervjua;
- onboarding planiranje;
- razumijevanje potencijalnih komplementarnosti;
- razumijevanje mogućih trenja;
- menadžerske smjernice.

### 10.2. Input source

Primary inputi:

- candidate assessment/report relevantni snapshot-i;
- Team Dynamics aggregation snapshot;
- team metadata u dozvoljenom obimu;
- report context koji je HR/admin eksplicitno izabrao.

Team Fit ne smije zavisiti od parcijalne timske agregacije.

### 10.3. Candidate-vs-team framing

Framing mora biti kandidat-vs-team, ne kandidat-vs-pojedinac.

Dozvoljeni obrasci:

- kandidat može dopuniti tim u određenim obrascima rada;
- kandidat može trebati podršku u određenom timskom okruženju;
- timski kontekst može pojačati ili ublažiti određene radne stilove;
- HR treba provjeriti konkretne teme u intervjuu.

Nedozvoljeni obrasci:

- imenovanje pojedinačnih članova tima;
- rangiranje kandidata kao boljeg/lošijeg od tima;
- tvrdnja da kandidat pripada ili ne pripada timu;
- implicitna hire/no-hire preporuka.

### 10.4. Bez numeric score-a

Team Fit nema numeric fit score, procentualni fit, pass/fail prag ili sličan zbirni indikator.

Razlog je product sigurnost: broj bi stvorio lažnu preciznost i mogao bi biti pogrešno korišten kao selekcijska odluka.

### 10.5. Bez hire/no-hire odluke

Report ne smije koristiti jezik koji direktno ili indirektno daje konačnu odluku.

Zabranjeni obrasci:

- hire;
- no-hire;
- zaposliti;
- ne zaposliti;
- konačna odluka;
- idealni kandidat;
- fit score.

### 10.6. Controlled recommendations

Preporuke moraju biti kontrolisane i operativne:

- teme za intervju;
- onboarding smjernice;
- pitanja za menadžera;
- tačke opreza;
- uslovi pod kojima kandidat može bolje funkcionisati.

Preporuke moraju ostati pomoć HR/admin korisniku, ne automatizovana odluka.

### 10.7. Interpretation limits

Report mora jasno poštovati granice:

- Team Dynamics instrument ima validation pending stavke;
- timski snapshot opisuje konkretni inclusion set i trenutak mjerenja;
- kandidatov radni stil nije fiksna prognoza ponašanja;
- report ne zamjenjuje intervju, reference, radne uzorke ili ljudsku procjenu;
- report ne smije biti jedini osnov za selekcijsku odluku.

## 11. Security i role pretpostavke

### 11.1. HR/admin only

Report generation i report reading su HR/admin-only operacije.

Ovo uključuje:

- Team Dynamics Executive Overview generation;
- Team Dynamics Executive Overview read route;
- Team Fit generation;
- Team Fit read route;
- retry/manual process action.

### 11.2. Participant-facing izolacija

Participant-facing views ne smiju izlagati HR-only report sadržaj.

Participant-facing flow smije prikazivati:

- vlastiti assessment;
- progress/status koji je potreban za završetak;
- neutralne completion poruke.

Participant-facing flow ne smije prikazivati:

- Team Dynamics Executive Overview;
- Team Fit report;
- timske agregacije;
- poređenje kandidata sa timom;
- HR/admin retry ili processing kontrole.

### 11.3. Server-side granice

Write operacije za lifecycle, score snapshot, aggregation snapshot i report snapshot moraju ostati server-side.

Client ne smije direktno pisati:

- member score snapshot-e;
- aggregation snapshot-e;
- report lifecycle statuse;
- report snapshot-e.

## 12. Budući rad

Future work, bez implicitne autorizacije za implementaciju:

- Team Fit V2 information hierarchy polish.
- Dodatni Team Dynamics report kinds.
- SME review i pilot validation Team Dynamics instrumenta.
- Licensing/legal confirmation za instrument sadržaj i konstrukte.
- Empirical calibration za TDM-31, psychological safety, SJT i outcome pulse.
- Report/scoring validation.
- Scheduler samo nakon eksplicitne product i engineering odluke.
- Admin observability samo nakon eksplicitnog authorization dizajna.
- Dodatni audit trail za inclusion set promjene ako se pokaže potreba.
- Bolje supportiranje većih timova nakon validacije i product odluke.

## 13. Non-goals za trenutni dokumentacioni sync

Ovaj v0.1 sync ne radi:

- runtime code promjene;
- DB/migration promjene;
- report provider promjene;
- renderer promjene;
- validator promjene;
- lifecycle helper promjene;
- UI promjene;
- worker/scheduler implementaciju;
- DB-backed jobove;
- OpenAI pozive;
- report regeneration;
- Composite HR promjene.
