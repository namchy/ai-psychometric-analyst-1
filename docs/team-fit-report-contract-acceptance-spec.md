# Team Fit report contract acceptance spec v0.1

## 1. Svrha dokumenta

Ovaj dokument je canonical acceptance spec za budući `team_fit_report_v1` contract i provider output.

Svrha je zaključati standard kvaliteta prije bilo kakvog contract, provider, validator, renderer ili runtime rada. Team Fit report mora biti dubok, konkretan, evidence-linked i operativan HR report. Ne smije biti generički tekst koji samo parafrazira score ili daje savjete koji bi mogli važiti za bilo kojeg kandidata i bilo koji tim.

## 2. Status

Status:

- spec/acceptance standard;
- nije implementacija;
- ne uvodi TypeScript contract;
- ne uvodi provider prompt;
- ne uvodi validator;
- ne uvodi renderer;
- ne uvodi DB/migration promjene;
- ne pokreće report generation ili regeneration;
- ne otvara worker/scheduler.

## 3. Odnos prema postojećim dokumentima i storage modelu

### 3.1. `docs/team-dynamics-product-tech-spec.md`

Team Dynamics product/tech spec definiše širi Team Fit & Dynamics modul.

Ovaj acceptance spec preuzima sljedeće odluke:

- Team Fit je candidate-vs-team HR report.
- Team Fit koristi agregirani timski kontekst, ne individualne prikaze članova tima.
- Team Fit nema numeric fit score.
- Team Fit nema hire/no-hire, pass/fail ili sličnu konačnu odluku.
- Team Fit ne smije imenovati pojedinačne članove tima u glavnom reportu.

### 3.2. `docs/team-style-collaboration-product-spec.md`

Team Style & Collaboration spec definiše `team_style_collaboration_v1` kao mogući budući individualni modul.

Ovaj acceptance spec tretira Team Style signale kao opcionalni budući input za Team Fit. Ako Team Style nije implementiran ili nije dostupan, Team Fit ne smije izmišljati individualni saradnički signal.

### 3.3. Postojeći `team_fit_reports` storage model

Postojeći storage model za Team Fit artefakte je `team_fit_reports`.

Ovaj acceptance spec ne mijenja storage. Budući contract/provider output treba biti kompatibilan s idejom persisted artefakta koji ima:

- kandidat-side source;
- team-side source;
- optional context;
- input snapshot;
- report snapshot;
- lifecycle status.

Migration drift audit za `team_fit_reports` je read-only završen u `docs/supabase-team-fit-migration-drift-audit.md`. Runtime schema parity je potvrđena dovoljno jako, ali migration history repair/mirror ostaje zaseban operator-approved task.

## 4. Šta Team Fit report jeste

Team Fit report je HR/admin-facing relacijski report koji tumači odnos između kandidata i konkretnog tima.

Report treba pomoći HR-u i menadžeru da razumiju:

- gdje kandidat može pojačati konkretan tim;
- gdje može nastati trenje;
- koje hipoteze treba provjeriti u razgovoru;
- kakav onboarding i management pristup ima smisla;
- koji su limiti interpretacije.

Report mora razlikovati:

- kandidat-side signal;
- team-side signal;
- relacijsku interpretaciju;
- hipotezu za provjeru;
- preporuku ili naredni korak.

## 5. Šta Team Fit report nije

Team Fit report nije:

- hiring decision engine;
- pass/fail model;
- numeric fit score;
- procentualni fit;
- rang lista kandidata;
- zamjena za intervju, reference, radni uzorak ili ljudsku odluku;
- report o pojedinačnim članovima tima;
- klinička ili dijagnostička procjena;
- opšti kandidat report bez konkretnog timskog konteksta;
- automatska preporuka za zapošljavanje.

## 6. Minimalni report input model na product nivou

Minimalni input model mora jasno razdvojiti izvore.

Required inputi:

- candidate context: minimalni HR-safe identitet i assessment context kandidata;
- candidate Deep Profile signals: dozvoljeni HR-facing individualni signali iz postojećih Deep Profile izvora;
- team context: organizacija, tim i dozvoljeni metadata;
- Team Dynamics aggregation snapshot: agregirani timski signal koji ne imenuje pojedince;
- locale/report language context;
- generated/version metadata;
- interpretation limits metadata.

Optional inputi:

- Team Style & Collaboration signals, samo ako je `team_style_collaboration_v1` implementiran i validno dostupan;
- Team Dynamics Executive Overview signals, samo ako su eksplicitno dozvoljeni kao dodatni interpreted context;
- HR/admin optional context, samo ako je eksplicitno unesen i auditabilan;
- role/team context, samo ako postoji standardizovan i autorizovan izvor.

Forbidden inputi:

- raw individual answers članova tima;
- individualni score prikaz članova tima u glavnom reportu;
- privatni narrative reporti članova tima;
- candidate-facing report kao jedini source of truth;
- nezaštićeni ili nelicencirani sadržaj izvan dozvoljenog HR/team input sloja.

## 7. Minimalni report output model na product nivou

Budući output mora biti strukturiran, ali ovaj dokument ne definiše TypeScript schema.

Minimalni output mora imati:

- report identity: `team_fit_report_v1`, verzija, locale, generated timestamp;
- source summary: koji kandidat-side i team-side izvori su korišteni;
- sectioned report body;
- evidence references za ključne tvrdnje;
- interview probes;
- onboarding and manager guidance;
- risk and mitigation map;
- evidence appendix;
- interpretation limits;
- explicit no-score/no-decision posture.

Svaka sekcija mora biti čitljiva kao HR-operativan artefakt. Report ne smije zavisiti od toga da ga autor dodatno objašnjava.

## 8. Evidence model

Evidence model mora razlikovati izvore.

Dozvoljeni evidence source tipovi:

- `candidate_deep_profile_signal`: kandidatovi individualni Deep Profile signali;
- `team_style_collaboration_signal`: Team Style & Collaboration signali, ako budu uvedeni;
- `team_dynamics_aggregation_signal`: Team Dynamics aggregation snapshot;
- `team_dynamics_executive_overview_signal`: Executive Overview signal, samo ako je eksplicitno dozvoljen;
- `hr_admin_optional_context`: HR/admin context koji je eksplicitno unesen;
- `interpretive_link`: jasan razlog koji povezuje kandidatov signal sa timskim kontekstom.

Svaka evidence reference na product nivou treba imati:

- source type;
- source label prikladan HR korisniku;
- signal label;
- signal direction ili band ako postoji;
- relevantnost za tvrdnju;
- confidence/limit note kada je potrebno;
- timestamp ili snapshot/version reference kada postoji.

Evidence ne mora otkriti raw odgovor. Mora objasniti zašto tvrdnja postoji.

## 9. Obavezne report sekcije

### 9.1. Executive summary

Svrha: dati HR-u brz, relacijski sažetak najvažnijeg kandidat-vs-team signala.

Mora sadržavati:

- najvažniji candidate-vs-team obrazac;
- jednu konkretnu priliku za doprinos;
- jednu konkretnu tačku opreza;
- jednu rečenicu o tome šta provjeriti dalje.

Evidence signal:

- najmanje jedan kandidat-side signal;
- najmanje jedan team-side aggregation signal;
- interpretive link koji povezuje ta dva izvora.

Zabranjeno:

- presuda o kandidatu;
- score-like etiketa;
- opšti summary bez timskog konteksta.

Loš generički obrazac:

- "Kandidat može doprinijeti timu na različite načine i važno je pratiti dinamiku."

Prihvatljiv konkretan obrazac:

- "Kandidat pokazuje signal strukturiranja i ranog razjašnjavanja očekivanja, dok timski snapshot ukazuje na trenje oko vlasništva odluka; HR treba provjeriti kako kandidat uvodi strukturu bez preuzimanja kontrole nad timskim dogovorima."

### 9.2. Candidate-vs-team fit overview

Svrha: objasniti relacijski obrazac između kandidata i tima bez numeric fit score-a.

Mora sadržavati:

- da li je glavni obrazac alignment, complementarity, mixed signal ili needs validation;
- šta taj obrazac znači u konkretnom timu;
- gdje je interpretacija najjača i gdje je ograničena.

Evidence signal:

- candidate Deep Profile signal ili Team Style signal;
- Team Dynamics aggregation signal;
- interpretive link.

Zabranjeno:

- "fit je visok/umjeren/nizak";
- procentualni fit;
- "dobro se uklapa" bez evidence i granica.

Loš generički obrazac:

- "Fit je umjeren i kandidat se može uklopiti uz praćenje."

Prihvatljiv konkretan obrazac:

- "Relacijski signal je mješovit: kandidat ima izražen obrazac samostalnog strukturiranja rada, dok tim pokazuje potrebu za češćim usklađivanjem prioriteta. Ovo može pomoći u raščišćavanju nejasnoća, ali treba provjeriti da li kandidat prihvata ritam timskih sinhronizacija."

### 9.3. Likely team contribution

Svrha: opisati gdje kandidat može pojačati konkretan tim.

Mora sadržavati:

- jedan do tri konkretna doprinosa;
- uslove pod kojima doprinos vjerovatno postaje koristan;
- timski signal koji čini doprinos relevantnim.

Evidence signal:

- kandidat-side snaga ili radni obrazac;
- timski gap, potreba ili napetost iz aggregation snapshot-a.

Zabranjeno:

- opšte pohvale;
- tvrdnje o "idealnom kandidatu";
- doprinos bez veze s timskim kontekstom.

Loš generički obrazac:

- "Kandidat može donijeti pozitivnu energiju i pomoći timu."

Prihvatljiv konkretan obrazac:

- "Ako tim nastavlja imati nejasno vlasništvo nad odlukama, kandidatov signal za strukturiranje sljedećih koraka može biti koristan u završavanju otvorenih dogovora, posebno kada menadžer unaprijed definiše granice odlučivanja."

### 9.4. Possible friction points

Svrha: opisati provjerljive hipoteze o mogućem trenju.

Mora sadržavati:

- konkretan okidač trenja;
- ponašanje koje se može posmatrati;
- razlog zašto je hipoteza relevantna;
- način provjere u intervjuu, onboarding-u ili menadžerskom planu.

Evidence signal:

- kandidat-side preference ili pattern;
- team-side pattern koji može pojačati trenje;
- interpretive link.

Zabranjeno:

- etiketiranje kandidata kao rizičnog;
- neprovjerljive tvrdnje;
- "potrebno je pratiti dinamiku" bez šta/zašto/kako.

Loš generički obrazac:

- "Potrebno je dodatno pratiti dinamiku jer može doći do izazova."

Prihvatljiv konkretan obrazac:

- "Ako tim brzo prelazi preko neslaganja, kandidatova direktnost može otvoriti korisne teme, ali i biti doživljena kao pritisak. Provjeriti kroz primjer kada je kandidat morao iznijeti neslaganje timu koji nije bio spreman za otvoren razgovor."

### 9.5. Team conditions that improve fit

Svrha: navesti uslove u timu koji povećavaju šansu da kandidatov stil bude koristan.

Mora sadržavati:

- konkretne timske norme ili management uslove;
- šta treba biti eksplicitno dogovoreno;
- zašto taj uslov pomaže baš ovom candidate-vs-team odnosu.

Evidence signal:

- team-side pattern;
- kandidat-side need/preference;
- optional HR/admin context ako je relevantan.

Zabranjeno:

- opšti savjeti tipa "osigurati podršku";
- uslovi koji nisu povezani s input signalima.

Loš generički obrazac:

- "Tim treba obratiti pažnju na komunikaciju."

Prihvatljiv konkretan obrazac:

- "Fit se vjerovatno poboljšava ako menadžer uvede jasno pravilo kada se odluke zaključavaju, jer kandidat pokazuje potrebu za jasnim sljedećim korakom, a timski snapshot ukazuje na trenje oko vlasništva odluka."

### 9.6. Interview probes

Svrha: dati HR-u pitanja koja provjeravaju relacijske hipoteze.

Mora sadržavati:

- konkretno pitanje;
- koju hipotezu provjerava;
- koji dobar ili problematičan signal treba slušati;
- vezu sa timskim kontekstom.

Evidence signal:

- friction hypothesis ili contribution hypothesis;
- kandidat-side i team-side evidence reference.

Zabranjeno:

- sugestivna pitanja;
- opšta pitanja bez veze s timom;
- pitanja koja vode prema presudi.

Loš generički obrazac:

- "Kako radite u timu?"

Prihvatljiv konkretan obrazac:

- "Opišite situaciju kada ste morali razjasniti odgovornost za odluku koja je ostala između više ljudi. Šta ste uradili prvo, kako ste uključili druge i kako ste znali da ne preuzimate tuđu odluku?"

### 9.7. Onboarding and manager guidance

Svrha: pretvoriti report u praktičan plan za prve sedmice rada.

Mora sadržavati:

- šta menadžer treba razjasniti;
- šta pratiti u prvom periodu;
- kakav ritam feedbacka ili check-in-a ima smisla;
- kako smanjiti potencijalno trenje.

Evidence signal:

- kandidat-side način rada;
- team-side uslovi i napetosti;
- interpretive link.

Zabranjeno:

- dekorativne preporuke;
- "pružiti podršku" bez vrste podrške, trenutka i vlasnika;
- preporuke bez ownera ili sljedećeg koraka.

Loš generički obrazac:

- "Menadžer treba pružiti podršku kandidatu tokom onboardinga."

Prihvatljiv konkretan obrazac:

- "U prve dvije sedmice menadžer treba eksplicitno dogovoriti ko zaključava odluke i kada se eskaliraju blokade, jer kandidatov stil traži jasan sljedeći korak, a timski signal pokazuje ranije trenje oko prioriteta."

### 9.8. Risk and mitigation map

Svrha: povezati mogući rizik trenja sa konkretnom mitigacijom.

Mora sadržavati:

- risk hypothesis;
- trigger;
- early warning signal;
- mitigation action;
- owner ili odgovorna strana.

Evidence signal:

- friction point evidence;
- team condition evidence;
- HR/admin context ako je eksplicitno unesen.

Zabranjeno:

- sigurnosno/rizično etiketiranje osobe;
- rizik bez mitigacije;
- mitigacija bez operativnog vlasništva.

Loš generički obrazac:

- "Postoji rizik u komunikaciji, pa treba biti oprezan."

Prihvatljiv konkretan obrazac:

- "Rizik: kandidatova direktnost može ubrzati raspravu prije nego što tim uskladi prioritete. Early warning: sastanci završavaju bez vlasnika odluke. Mitigacija: menadžer uvodi završni krug 'odluka, vlasnik, rok' na sedmičnim sync sastancima."

### 9.9. Evidence appendix

Svrha: dati provjerljiv trag bez pretvaranja reporta u debug dump.

Mora sadržavati:

- grupisane evidence reference po izvoru;
- user-facing label izvora;
- kratak signal summary;
- za koje tvrdnje je evidence korišten.

Evidence signal:

- candidate Deep Profile;
- Team Style, ako postoji;
- Team Dynamics aggregation;
- Executive Overview, ako je dozvoljen;
- optional HR context, ako je unesen.

Zabranjeno:

- raw individual answers članova tima;
- individualno imenovanje članova tima;
- tehnički dump bez HR značenja.

Loš generički obrazac:

- "Dokazi: rezultati procjena."

Prihvatljiv konkretan obrazac:

- "Kandidat-side: izražen signal strukturiranja obaveza iz HR-safe Deep Profile inputa. Team-side: aggregation snapshot ukazuje na trenje oko vlasništva odluka. Korišteno za executive summary, contribution i onboarding guidance."

### 9.10. Interpretation limits

Svrha: jasno ograničiti kako se report smije koristiti.

Mora sadržavati:

- da report nije odluka;
- da ne daje numeric fit score;
- da team snapshot opisuje konkretan inclusion set i trenutak;
- da Team Style može biti validation pending ako je korišten;
- da report treba kombinovati s intervjuom, referencama i drugim relevantnim dokazima.

Evidence signal:

- report metadata;
- source validity metadata;
- snapshot/version metadata.

Zabranjeno:

- sakrivanje validacijskih ograničenja;
- tvrdnja da report predviđa buduće ponašanje sa sigurnošću;
- preporuka za zapošljavanje ili odbijanje.

Loš generički obrazac:

- "Ovaj izvještaj treba koristiti uz oprez."

Prihvatljiv konkretan obrazac:

- "Ovaj report opisuje odnos kandidata i konkretnog timskog snapshot-a; ne daje odluku o zapošljavanju, ne sadrži fit score i ne zamjenjuje intervju. Ako se timski inclusion set promijeni, relacijsko tumačenje treba ponovo provjeriti."

## 10. Quality gates

Budući contract, provider i validator ne smiju proći acceptance ako report krši bilo koji od ovih gate-ova.

Quality gates:

- svaka bitna tvrdnja mora biti evidence-linked;
- svaka preporuka mora biti actionable;
- svaka friction hypothesis mora biti provjerljiva kroz intervju, onboarding ili menadžerski plan;
- report ne smije samo parafrazirati score;
- report ne smije koristiti rečenice koje se mogu primijeniti na bilo kojeg kandidata ili bilo koji tim;
- report mora jasno razlikovati signal, interpretaciju, hipotezu i preporuku;
- report mora biti HR-operativan, ne akademski esej;
- report mora ostati candidate-vs-team, ne candidate-vs-individual-member;
- report mora poštovati no-score/no-decision guardrail.

## 11. Anti-genericity standard

Zabranjeni obrasci:

- "kandidat može doprinijeti timu na različite načine" bez konkretizacije;
- "potrebno je dodatno pratiti dinamiku" bez objašnjenja šta, zašto i kako;
- "fit je umjeren" ili slične score-like etikete;
- "kandidat se dobro uklapa" bez evidence i granica;
- "tim treba obratiti pažnju na komunikaciju" bez konkretnog okidača, ponašanja i intervencije;
- "menadžer treba pružiti podršku" bez vrste podrške, vlasnika i trenutka;
- "postoji potencijal za razvoj" bez relacijskog konteksta;
- "preporučuje se dodatni razgovor" bez hipoteze koju razgovor testira.

Minimalni specificity standard:

- imenovati konkretan kandidat-side signal;
- imenovati konkretan team-side signal;
- objasniti relacijski mehanizam;
- navesti kada se signal može pokazati u radu;
- navesti šta HR ili menadžer treba uraditi sljedeće.

## 12. Zabranjene tvrdnje

Strogo zabranjeno:

- hire/no-hire;
- zaposliti/ne zaposliti;
- pass/fail;
- numeric fit score;
- procentualni fit;
- rangiranje kandidata;
- tvrdnje o pojedinačnim članovima tima u glavnom reportu;
- kliničke ili dijagnostičke tvrdnje;
- sigurnosno/rizično etiketiranje osobe;
- tvrdnje koje nisu podržane input signalima;
- tvrdnje da kandidat "pripada" ili "ne pripada" timu;
- tvrdnje da report samostalno određuje selekcijsku odluku;
- tvrdnje o zaštićenim karakteristikama ili privatnim podacima koji nisu dio dozvoljenog inputa.

## 13. Acceptance checklist za budući contract

Required root fields:

- report type i version;
- locale;
- generated/version metadata;
- candidate context;
- team context;
- source summary;
- interpretation limits;
- sections collection;
- evidence appendix;
- no-score/no-decision metadata ili equivalent guardrail.

Required section fields:

- section id;
- title/display label;
- purpose;
- narrative body;
- evidence references;
- interpretation type: signal, interpretation, hypothesis ili recommendation;
- confidence/limit note gdje je potrebno.

Evidence reference shape na product nivou:

- evidence id;
- source type;
- source label;
- signal label;
- signal summary;
- relation to claim;
- source snapshot/version reference;
- privacy level;
- limit note ako postoji.

Interpretation limit fields:

- no hire/no-hire statement;
- no numeric fit score statement;
- snapshot/inclusion-set limit;
- source validation limit;
- human decision support statement;
- stale input warning kada je relevantno.

Recommendation fields:

- recommendation text;
- owner: HR, menadžer, hiring panel ili onboarding owner;
- timing;
- reason;
- linked evidence;
- expected observation ili follow-up signal.

Interview probe fields:

- question;
- hypothesis being tested;
- linked evidence;
- what to listen for;
- concern signal;
- positive signal;
- follow-up prompt optional.

No-score/no-hire guardrails:

- contract ne smije imati numeric `fitScore`;
- contract ne smije imati decision enum tipa hire/no-hire/pass/fail;
- contract ne smije imati rank, percentile fit ili pass threshold;
- contract mora dozvoliti relationship labels samo kao navigacijske i opisne, ne kao odluku.

Minimum specificity requirements:

- svaka ključna sekcija ima barem jedan candidate-side i jedan team-side signal ili jasno objašnjenje zašto ne;
- svaka friction hypothesis ima trigger, observable behavior i provjeru;
- svaka preporuka ima owner ili sljedeći korak;
- executive summary mora uključiti konkretnu priliku i konkretnu tačku opreza.

Minimum evidence coverage:

- executive summary: najmanje dva evidence reference-a i jedan interpretive link;
- fit overview: kandidat-side, team-side i interpretive link;
- friction points: evidence za trigger i expected behavior;
- onboarding guidance: evidence za zašto baš ta preporuka;
- evidence appendix: reference za sve glavne tvrdnje.

Output language/tone expectations za HR report na bosanskom jeziku:

- bosanski jezik, latinica, ijekavica;
- HR-operativan ton;
- konkretne imenice i glagoli umjesto apstraktnih fraza;
- bez candidate-facing "ti/tvoj";
- bez tehničkog provider/model jezika;
- bez akademskog eseja;
- bez presudnog selekcijskog jezika.

## 14. Acceptance checklist za budući provider output

Provider output treba proći sljedeće provjere:

- koristi konkretne candidate-vs-team odnose;
- svaka ključna tvrdnja ima evidence;
- friction hypotheses su provjerljive;
- preporuke imaju ownership ili sljedeći korak;
- report izbjegava generičke rečenice;
- nema numeric score-a;
- nema hire/no-hire jezika;
- nema pass/fail jezika;
- nema individualnog imenovanja članova tima;
- output je koristan HR-u bez dodatnog tumača;
- jasno razlikuje signal, interpretaciju, hipotezu i preporuku;
- ne izmišlja Team Style signal ako taj input nije dostupan;
- ne koristi Executive Overview kao canonical team source ako nije eksplicitno dozvoljen;
- ne prikazuje raw individual answers ili privatne timske detalje;
- sadrži interpretation limits koji odgovaraju korištenim inputima.

## 15. Reviewer/golden-example smjernice

Budući reviewer/golden harness može ocjenjivati:

- concreteness;
- evidence linkage;
- actionability;
- candidate-vs-team specificity;
- forbidden decision language;
- genericity;
- empty recommendations;
- overclaiming;
- language quality;
- privacy boundary;
- no-score/no-hire compliance;
- distinction between signal, interpretation, hypothesis and recommendation.

Golden examples trebaju uključiti:

- dobar primjer mješovitog signala;
- dobar primjer complementarity signala;
- dobar primjer needs-validation signala;
- loš primjer generičkog outputa;
- loš primjer score-like outputa;
- loš primjer presudnog hire/no-hire jezika;
- loš primjer individualnog imenovanja članova tima;
- loš primjer preporuke bez ownera i sljedećeg koraka.

Reviewer ne treba ocjenjivati report po tome da li je "pozitivan" prema kandidatu. Reviewer treba ocjenjivati da li je report provjerljiv, evidence-linked, operativan i unutar product guardrail-a.

## 16. Non-goals

Ovaj dokument ne radi:

- TypeScript contract implementaciju;
- provider implementaciju;
- prompt implementaciju;
- validator implementaciju;
- renderer ili UI promjene;
- DB/migration promjene;
- Supabase repair/mirror;
- report generation ili regeneration;
- worker/scheduler promjene;
- Composite HR promjene;
- promjenu postojećeg `team_fit_reports` storage modela;
- promjenu Team Dynamics runtime-a;
- promjenu Team Style runtime-a;
- OpenAI pozive.

## 17. Zaključak

`team_fit_report_v1` mora biti relacijski HR report koji povezuje kandidatov dozvoljeni individualni signal sa konkretnim timskim kontekstom. Prihvatljiv output mora pomoći HR-u i menadžeru da znaju šta kandidat može pojačati, gdje treba provjeriti trenje, šta pitati u razgovoru i kako postaviti onboarding.

Report ne prolazi acceptance ako je generički, score-like, presudan, nepovezan s evidence-om ili ne daje operativan sljedeći korak.
