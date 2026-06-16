# Timski stil saradnje — product/spec v0.1

## 1. Svrha i status dokumenta

Ovaj dokument je canonical product/spec v0.1 za modul `Timski stil saradnje` / `team_style_collaboration_v1`.

Svrha dokumenta:

- definisati product namjenu modula prije implementacije;
- razdvojiti modul od Team Dynamics assessmenta, Team Fit reporta i postojećih individualnih Deep Profile testova;
- opisati predložene konstrukte, format instrumenta, scoring okvir i validacijski status;
- zaključati kvalitet budućih Team Dynamics i Team Fit reporta: reporti moraju biti konkretni, evidence-linked i operativni za HR/menadžera.

Status v0.1:

- Modul je planiran.
- Modul nije implementiran.
- Modul je u validacijskoj fazi.
- Dokument ne uvodi runtime, DB migracije, import package, test iteme, report generation, OpenAI pozive, worker/scheduler promjene ili Composite HR promjene.

## 2. Product definicija

`Timski stil saradnje` je individualni modul za kandidata ili člana tima.

Modul procjenjuje kako osoba tipično doprinosi radu u timu, kako prosuđuje saradničke situacije i kako reaguje kada se u timu pojave napetost, neslaganje, nejasna koordinacija ili psihološki rizik u komunikaciji.

Product svrha:

- individualni timski potencijal;
- saradničko prosuđivanje;
- konfliktni stil;
- preferirani način saradnje;
- obrasci ponašanja u timskim napetostima;
- doprinos timskoj koordinaciji;
- doprinos psihološkoj sigurnosti;
- input za kandidat-vs-team tumačenje u `team_fit_report_v1`.

Modul nije samostalan hiring decision alat. Njegova vrijednost je u tome da daje stabilne, specifične i provjerljive individualne signale koji se kasnije mogu povezati sa konkretnim timskim kontekstom.

## 3. Razgraničenje

### 3.1. Razlika od `team_dynamics_assessment_v1`

`team_dynamics_assessment_v1` mjeri timski sistem.

Team Dynamics:

- popunjavaju članovi tima;
- služi za agregirani timski uvid;
- proizvodi member score snapshot-e i timski aggregation snapshot;
- opisuje obrasce tima kao sistema;
- nije individualni kandidat-side modul.

`team_style_collaboration_v1` mjeri individualni saradnički stil kandidata ili člana.

Team Style & Collaboration:

- popunjava pojedinac;
- daje individualne signale o načinu rada u timu;
- može biti kandidat-side ili member-side input;
- ne proizvodi timsku agregaciju kao primarni output;
- ne zamjenjuje Team Dynamics.

### 3.2. Razlika od `team_fit_report_v1`

`team_fit_report_v1` je relacijski HR report.

Team Fit:

- poredi individualni kandidat-side kontekst sa agregiranim team-side kontekstom;
- koristi `team_style_collaboration_v1` kao mogući individualni input;
- koristi Team Dynamics aggregation snapshot kao team-side input;
- ne predstavlja novi assessment;
- ne daje numeric fit score;
- ne daje hire/no-hire odluku.

`team_style_collaboration_v1` je assessment modul, ne report.

### 3.3. Razlika od postojećih individualnih Deep Profile testova

Postojeći individualni Deep Profile testovi, kao što su ličnost, motivacija ili kognitivni testovi, daju opšte individualne signale.

`team_style_collaboration_v1` je uži i relacijski orijentisan modul:

- fokusira se na timski rad, koordinaciju i napetosti;
- koristi situacije i procjene relevantne za saradnju;
- ne pokušava zamijeniti Big Five, motivaciju, kognitivne rezultate ili druge postojeće testove;
- dodaje candidate/member signal koji je posebno koristan kada se čita u odnosu na konkretan tim.

## 4. Predloženi konstrukti na product nivou

Ovi konstrukti su product-level hipoteze za v0.1. Nisu finalno psihometrijski zaključani.

### 4.1. Saradničko prosuđivanje

Opisuje kako osoba procjenjuje timske situacije u kojima postoje nejasne odgovornosti, različiti prioriteti, informacijski jaz ili pritisak rokova.

Primjeri signala:

- prepoznaje kada treba tražiti usklađivanje;
- razlikuje konstruktivno neslaganje od eskalacije;
- bira reakcije koje čuvaju radni odnos i fokus na ishod;
- ne izbjegava bitan problem samo radi kratkoročnog mira.

### 4.2. Preferirani način saradnje

Opisuje kako osoba tipično voli raditi sa drugima.

Primjeri signala:

- preferira jasnu podjelu odgovornosti ili fleksibilno zajedničko rješavanje;
- traži česte provjere ili veću autonomiju;
- doprinosi kroz strukturiranje, povezivanje ljudi, izazivanje pretpostavki ili stabilizaciju procesa;
- jasno komunicira granice, potrebe i očekivanja.

### 4.3. Konfliktni stil

Opisuje kako osoba pristupa neslaganju i napetostima.

Primjeri signala:

- ulazi u konflikt direktno, posredno ili oprezno;
- pokušava razumjeti perspektivu druge strane;
- eskalira kada je potrebno ili predugo odgađa razgovor;
- razlikuje problem od osobe;
- ostaje fokusirana na rješenje i sljedeći korak.

### 4.4. Koordinacijski doprinos

Opisuje kako osoba doprinosi zajedničkom ritmu rada.

Primjeri signala:

- pomaže timu da razjasni prioritete;
- rano signalizira blokere;
- dijeli relevantne informacije bez preopterećenja tima;
- preuzima odgovornost za dogovorene obaveze;
- pomaže u zatvaranju otvorenih pitanja.

### 4.5. Doprinos psihološkoj sigurnosti

Opisuje kako osoba svojim stilom može pomoći ili otežati otvorenu razmjenu u timu.

Primjeri signala:

- ostavlja prostor za druga mišljenja;
- priznaje greške i nejasnoće bez defanzivnosti;
- postavlja pitanja koja otvaraju problem, ne etiketiraju osobu;
- može osporiti ideju bez ponižavanja sagovornika;
- reaguje na rizik ili propust na način koji čuva učenje i odgovornost.

### 4.6. Reakcija pod timskim pritiskom

Opisuje kako osoba reaguje kada se pojave rokovi, konflikt prioriteta, loša komunikacija ili nejasan vlasnik odluke.

Primjeri signala:

- traži strukturu kada pritisak raste;
- komunicira rizike rano;
- ostaje konstruktivna pod neslaganjem;
- izbjegava pasivnu saglasnost kada vidi problem;
- ne preuzima koordinaciju na način koji guši druge.

## 5. Mogući format instrumenta

Format je research-informed hibrid. Konačan format mora biti potvrđen kroz zaseban content/spec i validacijski rad.

### 5.1. Kratki Likert blokovi

Namjena:

- efikasno mjeriti stabilnije preferencije i obrasce rada;
- dobiti dimenzijske indikatore za candidate/member profile;
- omogućiti bandove bez pretjerane preciznosti.

Primjeri područja:

- koordinacija;
- otvorena komunikacija;
- reakcija na neslaganje;
- potreba za strukturom;
- doprinos psihološkoj sigurnosti.

### 5.2. SJT scenariji

SJT scenariji mogu procjenjivati saradničko prosuđivanje u konkretnim timskim situacijama.

Namjena:

- provjeriti kako osoba bira između realističnih timskih reakcija;
- uhvatiti tradeoff između direktnosti, odnosa, brzine i kvaliteta odluke;
- dati evidence anchors za report.

SJT scenariji moraju biti originalno napisani za ovaj proizvod. Ne smiju kopirati zaštićene scenarije iz literature ili komercijalnih instrumenata.

### 5.3. Forced-choice ili best/worst

Forced-choice ili best/worst format može biti koristan kada treba smanjiti očigledno poželjno odgovaranje.

Moguća upotreba:

- izbor između različitih saradničkih prioriteta;
- izbor najvjerovatnije i najmanje vjerovatne reakcije;
- balans između brzine, odnosa, kvaliteta i jasnoće odgovornosti.

Ovaj format treba koristiti samo gdje donosi stvarnu mjernu vrijednost, ne kao dekorativnu složenost.

### 5.4. Outcome/friction pulse

Kratki outcome/friction pulse može mjeriti kako osoba percipira učestalost ili težinu određenih timskih trenja u svom iskustvu.

Moguća upotreba:

- trenje oko prioriteta;
- nejasno vlasništvo odluka;
- izbjegavanje teških razgovora;
- prekasno dijeljenje rizika;
- preopterećenje koordinacijom.

Pulse ne smije postati zamjena za timsku agregaciju. To je individualni signal, ne mjera cijelog tima.

## 6. Scoring okvir na visokom nivou

Scoring okvir mora ostati jednostavan, objašnjiv i bez lažne preciznosti.

### 6.1. Dimenzije

Predložene v0.1 dimenzije:

- saradničko prosuđivanje;
- konfliktni stil;
- koordinacijski doprinos;
- preferirani način saradnje;
- doprinos psihološkoj sigurnosti;
- reakcija pod timskim pritiskom.

Dimenzije su radni product model. Finalna struktura zavisi od SME reviewa, pilot validacije i empirijske kalibracije.

### 6.2. Indikatori

Svaka dimenzija treba imati više indikatora.

Primjeri:

- rano signaliziranje rizika;
- traženje razjašnjenja prije eskalacije;
- spremnost da se iznese neslaganje;
- očuvanje odnosa tokom konflikta;
- strukturiranje dogovora i sljedećih koraka;
- otvorenost prema povratnoj informaciji.

Indikatori moraju biti povezani sa konkretnim itemima, scenarijima ili izborima.

### 6.3. Bandovi

MVP scoring treba koristiti bandove umjesto numerički pretjerano preciznih tvrdnji.

Primjeri bandova:

- niži signal;
- umjeren signal;
- izražen signal;
- mješovit signal;
- signal zahtijeva dodatnu provjeru.

Bandovi nisu vrijednosna presuda. Oni označavaju interpretativni raspon i temu za razgovor.

### 6.4. Evidence anchors

Svaki važan score ili report signal mora imati evidence anchors.

Evidence anchors mogu biti:

- dimenzijski score/band;
- relevantan indikator;
- SJT izbor;
- best/worst tradeoff;
- pulse signal;
- dosljednost ili napetost između više izvora.

Evidence anchor ne mora otkrivati raw odgovor, ali mora jasno pokazati zašto interpretacija postoji.

### 6.5. Bez lažne preciznosti

Zabranjeno:

- numeric fit score;
- tvrdnja da mala razlika u bodovima ima veliku poslovnu važnost bez validacije;
- rangiranje kandidata kao boljih/lošijih na osnovu ovog modula;
- finalna selekcijska odluka;
- report tvrdnje koje izgledaju preciznije nego što validacija dopušta.

## 7. Veza sa Team Fit reportom

`team_style_collaboration_v1` treba biti jedan od individualnih inputa za `team_fit_report_v1`.

### 7.1. Kandidat-vs-team framing

Team Fit koristi kandidatov individualni stil u odnosu na konkretni timski kontekst.

Primjeri relacijskog čitanja:

- kandidat preferira više strukture, a timski aggregation snapshot pokazuje nejasnu koordinaciju;
- kandidat pokazuje izražen signal konstruktivnog neslaganja, a tim ima slabije signale otvorene razmjene;
- kandidat pokazuje visoku potrebu za autonomijom, a tim funkcioniše kroz česte sinhronizacije;
- kandidat dobro stabilizuje procese, a tim pokazuje trenje oko prioriteta i vlasništva odluka.

Ovo su hipoteze za HR provjeru, ne konačne tvrdnje.

### 7.2. Friction hypotheses

Team Fit može koristiti Team Style signale za friction hypotheses.

Primjeri:

- gdje kandidatov stil može pojačati postojeće timsko trenje;
- gdje kandidat može donijeti korisnu dopunu;
- gdje se može pojaviti nesporazum oko tempa, autonomije ili direktnosti;
- gdje menadžer treba unaprijed postaviti jasna očekivanja.

Friction hypotheses moraju biti evidence-linked i napisane kao teme za provjeru.

### 7.3. Interview pitanja

Team Style signali trebaju hraniti konkretna pitanja za intervju.

Pitanja moraju:

- provjeravati stvarne situacije, ne tražiti opšte samopredstavljanje;
- povezati kandidatov signal sa timskim kontekstom;
- pomoći HR-u da testira hipotezu;
- izbjegavati sugestivni ili presudni ton.

Primjer obrasca:

- "Opišite situaciju kada ste morali otvoriti neslaganje u timu koji izbjegava konflikt. Kako ste procijenili trenutak i način razgovora?"

### 7.4. Onboarding i manager guidance

Team Fit može koristiti Team Style signale za onboarding/manager guidance.

Smjernice moraju biti operativne:

- šta menadžer treba razjasniti u prvim sedmicama;
- kakav ritam check-in razgovora može pomoći;
- gdje treba postaviti jasne granice odgovornosti;
- koje timske norme treba eksplicitno objasniti;
- kako smanjiti rizik pogrešnog čitanja kandidatovog stila.

Smjernice ne smiju biti dekorativne rečenice tipa "pružiti podršku" bez objašnjenja kakvu podršku, zašto i kada.

### 7.5. Kombinovanje sa agregiranim timskim signalima

Team Fit mora kombinovati:

- individualne signale iz `team_style_collaboration_v1`;
- agregirane timske signale iz Team Dynamics snapshot-a;
- druge dozvoljene candidate-side HR-safe izvore;
- role/team context samo ako postoji standardizovan i autorizovan izvor.

Relacijska interpretacija mora jasno reći da li signal dolazi iz kandidata, tima ili njihove kombinacije.

## 8. Veza sa Team Dynamics i Team Fit modelom

Operativni model:

- Team Dynamics mjeri timski sistem.
- Team Style & Collaboration mjeri individualni saradnički stil kandidata ili člana.
- Team Fit je relacijski report koji poredi individualni i timski kontekst.

Posljedice:

- Team Dynamics report ne smije čitati Team Style kao zamjenu za timsku agregaciju.
- Team Style ne smije proizvoditi Team Fit zaključke samostalno.
- Team Fit ne smije postati opšti kandidat report; mora ostati candidate-vs-team report.
- Individualni signal bez timskog konteksta ne smije se predstavljati kao "fit".

## 9. Quality standard za buduće reporte

Finalni product cilj nije generički report. Team Dynamics i Team Fit reporti moraju biti duboki, konkretni i operativni.

### 9.1. Obavezni kvalitet outputa

Budući report output mora biti:

- evidence-linked;
- konkretan u opisivanju obrazaca ponašanja;
- role/team-context aware kada postoji validan kontekst;
- actionable za HR/menadžera;
- jasan o tome šta je kandidat-side signal, šta je team-side signal, a šta je relacijska interpretacija;
- bez numeric fit score-a;
- bez hire/no-hire odluke.

### 9.2. Zabranjeni obrasci

Zabranjeno je proizvoditi:

- maglovite rečenice koje se mogu primijeniti na bilo kojeg kandidata ili bilo koji tim;
- opšte savjete bez veze sa izvorom signala;
- parafraze score-a koje ne dodaju novu vrijednost;
- "dobro se uklapa" bez objašnjenja zašto, u kojem kontekstu i šta treba provjeriti;
- "može biti izazov" bez konkretne friction hipoteze;
- preporuke koje ne govore šta HR ili menadžer treba uraditi;
- numeric fit score;
- hire/no-hire ili implicitnu selekcijsku presudu.

### 9.3. Evidence i interpretativni razlog

Svaka važna tvrdnja mora imati:

- izvorni signal; ili
- jasan interpretativni razlog; ili
- eksplicitno navedenu vezu između kandidat-side i team-side signala.

Ako report ne može objasniti zašto tvrdnja postoji, tvrdnja ne treba biti prikazana.

### 9.4. Operativne preporuke

Preporuke moraju pomoći HR-u ili menadžeru da odluči:

- šta provjeriti u intervjuu;
- kako voditi razgovor;
- šta razjasniti prije ponude ili početka rada;
- kako postaviti onboarding;
- koje timske norme učiniti eksplicitnim;
- gdje pratiti rani rizik trenja.

Preporuke nisu dekoracija. Ako preporuka ne vodi prema konkretnoj radnji, treba je ukloniti ili preformulisati.

## 10. Validacijski status

Status modula:

- research-informed;
- validation pending;
- SME review pending;
- pilot validation pending;
- empirical calibration pending;
- report/scoring validation pending.

Implikacije:

- konstrukti su radni product model, ne finalna psihometrijska struktura;
- score bandovi ne smiju tvrditi veću preciznost od dostupne validacije;
- report mora sadržavati interpretacijska ograničenja;
- modul se ne smije koristiti kao jedini osnov za selekcijsku odluku;
- prije produkcijske upotrebe potrebni su SME review, pilot podaci, kalibracija i report/scoring validacija.

## 11. Research/legal guardrails

Modul može biti research-informed, ali ne smije kopirati zaštićeni sadržaj.

Guardrails:

- Ne kopirati zaštićene iteme.
- Ne unositi licencirane iteme ili scenarije u repo.
- Ne koristiti komercijalne ili akademski zaštićene instrumente kao direktan item bank.
- DUTCH, TCS, TREO i SJT literatura može informisati konstrukte, format i hipoteze.
- DUTCH, TCS, TREO i SJT sadržaj ne smije biti kopiran bez licence.
- Svi itemi i scenariji za repo moraju biti originalno napisani ili licencno očišćeni.
- Pravna/licencna pitanja rješavaju se posebno prije bilo kakvog content package-a.
- Finalni BHS prevod rješava se posebno kroz jezički i SME review.

Ovaj dokument ne sadrži finalne iteme, scenarije ili scoring ključ.

## 12. Non-goals

Ovaj v0.1 spec ne radi:

- runtime implementaciju;
- DB migracije;
- import package;
- nove test iteme u code-u;
- scoring engine implementaciju;
- report contract implementaciju;
- OpenAI pozive;
- report generation;
- report regeneration;
- Team Dynamics runtime promjene;
- Team Fit runtime promjene;
- Composite HR promjene;
- scheduler/worker promjene;
- UI promjene;
- provider, renderer, validator ili lifecycle helper promjene.

## 13. Minimalni acceptance okvir za budući implementation slice

Prije bilo kakve implementacije treba zasebno zaključati:

- finalni item/scenario content source i legal status;
- konstrukte koji ulaze u v1;
- format po bloku;
- scoring rules i band definitions;
- evidence anchor model;
- BHS terminologiju;
- report input contract za Team Fit;
- validation plan i minimalne SME/pilot kriterije;
- privacy i role granice za kandidat-side i member-side upotrebu.

Bez ovoga, implementacija bi rizikovala generički report, nejasan scoring i nedovoljno odvojene product odgovornosti između Team Style, Team Dynamics i Team Fit slojeva.
