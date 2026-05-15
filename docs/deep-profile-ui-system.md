# Deep Profile UI System

## 1. Svrha dokumenta

Ovaj dokument je source of truth za ponavljajuće Deep Profile UI elemente. Codex ga mora pročitati prije svakog UI taska koji dira:

- dashboard
- HR workspace
- candidate dashboard
- participant reports
- HR reports
- composite reports
- app navigation
- CTA/buttons
- cards/surfaces
- report renderer layout

Pravila:

- Ako ovaj dokument pokriva element, ne uvoditi novi vizuelni obrazac.
- Ako postojeći sistem ne pokriva potrebu, prvo eksplicitno prijaviti odstupanje u task summaryju. Ne improvizovati novi obrazac usput.
- Ovaj dokument je implementacijski standard, ne inspiracijski tekst.

## 2. Product visual direction

Deep Profile je:

- HR people-intelligence / decision-support proizvod
- premium B2B proizvod, ali topao i ljudski
- fokusiran na ljude, procjene, interpretaciju i odlučivanje

Deep Profile nije:

- računovodstveni dashboard
- medicinski sistem
- generički SaaS admin panel

Obavezna pravila:

- UI mora prvo odgovoriti na pitanja: “Čiji podatak ili izvještaj gledam?” i “Šta HR treba uraditi s ovim?”
- HR report hero mora primarno prikazati kandidata ili osobu kada je identitet dostupan.
- Report sekcije moraju imati jasnu funkciju: zaključak, dokaz, provjera, smjernica ili ograničenje.
- Izbjegavati UI koji izgleda kao neutralni dokument bez osobe.
- Ako sekcija nema jasnu HR funkciju, treba je preoblikovati ili pojednostaviti.

## 3. Color palette and semantics

Osnovna paleta:

```css
--bubblegum-pink: #ef476f;
--golden-pollen: #ffd166;
--emerald: #06d6a0;
--ocean-blue: #118ab2;
--dark-teal: #073b4c;
```

### 3.1 Semantika boja

| Boja | Hex | Primarna semantika | Dozvoljena upotreba | Zabranjena upotreba |
| --- | --- | --- | --- | --- |
| Bubblegum pink | `#ef476f` | upozorenje, tenzija, konflikt, rizik | akcent, kritični signal, izdvojeni oprez | velika pozadina hero sekcija, primarni CTA |
| Golden pollen | `#ffd166` | provjera, pažnja, “šta dodatno ispitati” | verification paneli, oprez, fokus za provjeru | dominantna pozadina cijelog ekrana |
| Emerald | `#06d6a0` | pozitivan status, spremno, uspješno, potvrđeno | status badge, success state, potvrda | ambijentalna gradient boja, velika dekorativna pozadina, opća “svježina” UI-ja |
| Ocean blue | `#118ab2` | analitika, intervju, provjera, aktivna radnja | intervju paneli, secondary emphasis, info akcent | copy za greške, success status |
| Dark teal | `#073b4c` | glavni identitet, naslovi, menadžerski okvir, navigacija | naslovi, onboarding, primarni tekst, top accents | alarmni status, error-only signal |

### 3.2 Pravila upotrebe boja

- `dark-teal` je osnovna identitetska boja sistema.
- `ocean-blue` je radna analitička boja. Koristiti je za intervju, provjeru i info akcente.
- `golden-pollen` koristiti samo kada UI govori “obrati pažnju” ili “provjeri”.
- `emerald` koristiti samo za pozitivan status ili spremnost.
- `bubblegum-pink` koristiti samo za realnu tačku opreza, konflikt ili rizičan signal.
- Ne koristiti više od dvije akcentne boje u istoj kartici, osim kada je kartica eksplicitno multi-signalni prikaz.
- Ne graditi cijelu sekciju na emerald atmosferi. Emerald nije osnovna površinska boja proizvoda.

## 4. Typography and font roles

Deep Profile koristi tri tipografske uloge:

| Uloga | Implementacija | Namjena |
| --- | --- | --- |
| Headline | `font-headline` | H1, H2, glavne kartične titule, hero identitet |
| Body | `font-body` | paragrafi, opisi, pomoćni tekst, list body |
| Label | `font-label` | eyebrow, section labels, pills, mikro-UI labele |

### 4.1 Tipografska hijerarhija

| Element | Preporuka |
| --- | --- |
| Hero identitet | `text-3xl` do `text-4xl`, `font-extrabold`, `tracking-[-0.05em]`, `text-[#073b4c]` |
| Sekcijski naslov | `text-2xl` ili `text-[1.55rem]`, `font-semibold` ili `font-bold`, `tracking-[-0.035em]` |
| Naslov unutrašnjeg panela | `text-[0.95rem]` do `text-base`, `font-semibold`, `leading-5` |
| Body tekst | `text-sm` ili `text-[14px]`, `leading-6` ili `leading-7` |
| Eyebrow / label | `text-[11px]`, `font-semibold`, `uppercase`, `tracking-[0.18em]` do `tracking-[0.2em]` |

### 4.2 Pravila tipografije

- Ne koristiti sitan tekst za ključne HR uvide.
- Ne koristiti dugačke paragrafe preko pune širine bez unutrašnje strukture.
- Ne koristiti uppercase za duže body rečenice.
- Eyebrow služi za vrstu sekcije, ne za glavni sadržaj.
- Naslov sekcije mora biti semantički jači od eyebrow-a i metadata reda.

## 5. Surface, card i panel sistem

### 5.1 Dozvoljeni nivoi površina

| Nivo | Namjena | Tipična klasa |
| --- | --- | --- |
| Page shell | cijela dashboard površina | pozadinski gradient i layout frame |
| Section shell | velika logička cjelina | `DashboardSectionShell` |
| Info card | glavna kartica sekcije | `DashboardInfoCardShell` |
| Inner panel | podsekcija unutar kartice | ručno definisan `rounded` panel sa suptilnim borderom |

### 5.2 Pravila za nesting

- Maksimalno 3 vizuelna nivoa: section shell -> card -> inner panel.
- Ne uvoditi card unutar card unutar card unutar card.
- Ako sekcija traži više od 3 nivoa, problem je u strukturi, ne u nedostatku novih kartica.
- Inner panel mora imati jasnu informacijsku funkciju. Ne dodavati ga samo zbog “dubine”.

### 5.3 Standardi kartica

| Tip | Standard |
| --- | --- |
| Glavna info kartica | `rounded-[1.5rem]`, suptilan border, svijetla neutralna ili lagano tonirana pozadina, miran shadow |
| Hero kartica | može biti `rounded-[1.6rem]` do `rounded-[1.75rem]`, veći padding, identitet osobe na vrhu |
| Inner panel | `rounded-[1rem]` do `rounded-[1.15rem]`, border niskog kontrasta, `bg-white/75` ili slična svijetla pozadina |
| Purpose strip | `rounded-[1rem]`, tonirani border i blaga tonirana pozadina, `text-sm`, `leading-6` |

### 5.4 Zabranjeni obrasci

- Teški dokument-stil blokovi bez unutrašnjih panela.
- Debeli tamni borderi oko svih elemenata.
- Različiti border radius bez razloga unutar iste sekcije.
- Nasumično miješanje `18px`, `22px`, `28px`, `32px` radijusa u istoj kartici.

## 6. Shadow sistem

Shadow je hijerarhijski signal, ne dekoracija.

| Nivo | Preporuka | Upotreba |
| --- | --- | --- |
| Low | `shadow-[0_8px_18px_rgba(15,23,42,0.035)]` do `shadow-[0_14px_27px_rgba(15,23,42,0.06)]` | standardne info kartice |
| Medium | `shadow-[0_18px_42px_rgba(15,23,42,0.08)]` | istaknute dashboard kartice |
| High | `shadow-[0_20px_46px_rgba(15,23,42,0.10)]` do `shadow-[0_28px_60px_rgba(15,23,42,0.12)]` | hero ili veliki executive wrapper |

Pravila:

- U jednoj sekciji koristiti najviše dva shadow nivoa.
- Inner panel ne smije imati jači shadow od parent kartice.
- Ne koristiti inset dekorativne sjene kao zamjenu za strukturu.
- Ne koristiti hover shadow koji potpuno mijenja vizuelnu težinu CTA-a ili kartice.

## 7. CTA i button sistem

Kanon za dashboard CTA je postojeći helper `getDashboardCtaClassName` u `components/dashboard/primitives.tsx`.

### 7.1 Dozvoljene varijante

| Varijanta | Namjena |
| --- | --- |
| `primary` | glavna akcija u sekciji ili ekranu |
| `secondary` | sporedna, ali aktivna akcija |
| `disabled` | neaktivna akcija sa jasnim disabled stanjem |

### 7.2 Pravila stanja

- Hover smije pojačati jasnoću, ne smije promijeniti CTA u drugi vizuelni sistem.
- Focus mora ostati vidljiv kroz `focus-visible` ring. Ne uklanjati ring bez zamjene.
- Active stanje smije blago vratiti element nazad, ali ne smije “skakati”.
- Disabled stanje ne smije izgledati klikabilno.
- CTA kontrast mora ostati čitljiv u default, hover i focus stanju.

### 7.3 Zabranjeno

- Ručno praviti novi CTA stil kad već postoji dashboard CTA helper.
- Uvoditi drugačiji hover smjer na srodnim ekranima.
- Uklanjati `focus-visible` stilove.
- Koristiti emerald kao primarni CTA background.

## 8. Status pills i badges

Status badge je semantički indikator, ne dekorativni čip.

### 8.1 Pravila

- Koristiti `DashboardStatusBadge` kad god je moguće.
- Badge mora signalizirati stanje: spremno, aktivno, u toku, oprez, greška, organizacija, jezik, tip izvještaja.
- Emerald koristiti samo za pozitivno ili spremno stanje.
- Ocean blue koristiti za informativni ili neutralno-aktivan signal.
- Golden koristiti za oprez ili “potrebna provjera”.
- Bubblegum pink koristiti samo za problem ili povišen rizik.

### 8.2 Zabranjeno

- Badge za čistu dekoraciju.
- Previše badgeva u jednom redu bez prioriteta.
- Miješanje status badgeva i navigacijskih čipova kao da su isti element.

## 9. Navigacijski obrazac

### 9.1 Page-level navigation

Za report i dashboard detaljne ekrane koristiti isti obrazac:

- gornji red sa back akcijom lijevo
- context label desno ili ispod na malim ekranima
- koristiti `PageNavigation` kada obrazac odgovara

### 9.2 Pravila

- Nazad akcija mora biti odmah vidljiva pri vrhu ekrana.
- Context label je pomoćni orijentir, ne glavni naslov.
- Ne uvoditi zaseban navigacijski čip obrazac po ekranu ako već postoji `PageNavigation`.
- Mobile i desktop moraju ostati isti obrazac, samo drugačiji flow.

### 9.3 Zabranjeno

- Jedan ekran sa back pill linkom, drugi sa plain text linkom, treći sa ikonim-only povratkom bez razloga.
- Navigacijski elementi koji izgledaju kao status pills.

## 10. Report layout obrasci

### 10.1 Opšti princip

Report nije članak i nije debug dump. Mora podržati brzo skeniranje.

Svaka bitna sekcija treba odgovoriti barem na jedno pitanje:

- Šta je glavni zaključak?
- Šta HR treba provjeriti?
- Koji su dokazi?
- Kako koristiti ovo u intervjuu?
- Kako koristiti ovo u onboarding-u?
- Koja su ograničenja?

### 10.2 Obavezni layout obrasci

| Obrazac | Pravilo |
| --- | --- |
| Hero | prvo identitet osobe, zatim status i kratak opis svrhe |
| Summary | executive wrapper + strukturisani blokovi umjesto jednog širokog paragrafa |
| Evidence | grupisano po izvoru procjene, ne jedan dugi red čipova |
| Verification | zaseban panel za “šta provjeriti” |
| Guidance | zaseban panel ili kartica za intervju ili onboarding |
| Limitations | sekundarna sekcija, vizuelno mirnija od glavnih insight sekcija |

### 10.3 Grid pravila

- Dvokolonski layout koristiti kada sekcije imaju paralelnu funkciju, na primjer intervju i onboarding.
- Na mobile i tablet širini sekcije moraju pasti u jednu kolonu bez horizontalnog scrolla.
- Ako su dvije susjedne kartice iste važnosti, koristiti `h-full` kada sadržaj to dozvoljava.
- Gap između srodnih kartica držati u rasponu `gap-4` do `gap-6`, osim ako ekran jasno traži drugačije.

### 10.4 Zabranjeno

- Neutralne dokument kartice za sekcije koje trebaju izgledati kao decision-support moduli.
- Wide text blanket preko pune širine bez podjele na funkcionalne blokove.
- Evidence kao fusnota bez jasnog naslova i grupisanja.
- Sekcije koje izgledaju kao da pripadaju različitim proizvodima.

## 11. Copy pravila za BHS UX

### 11.1 Opšti ton

- bosanski, ijekavica, latinica
- direktno, jasno, profesionalno
- HR-korisno, ne akademski napuhano
- interpretativno, ali ne teatralno

### 11.2 Preferirano

| Preferirati | Umjesto |
| --- | --- |
| izvještaj | nalaz |
| HR pregled | tehnički output |
| tačke opreza | alarmistički jezik |
| teme za intervju | generičke “stavke” |
| menadžerske smjernice | neodređene preporuke |
| obrasci ponašanja | ponašajni |
| spremnost na saradnju / saradnička orijentacija | ugodnost / saradljiv |

### 11.3 Zabranjene ili nepoželjne riječi

- nalaz
- nalazi
- saradljiv
- ponašajni
- procjenski
- procjenskog
- AI interpretacija u glavnom report tijelu
- Način generisanja kao glavni metadata sadržaj
- zaposliti / ne zaposliti kao zaključak izvještaja
- idealni kandidat
- fit score
- konačna odluka

Pravila:

- Ako je riječ zabranjena u hardcoded UI copyju, zamijeniti je prije isporuke.
- Ako zabranjena riječ dolazi iz snapshot ili model sadržaja, ne mijenjati je automatski bez eksplicitnog zadatka. To treba prijaviti kao sadržajni ulaz, ne rendererski bug.

## 12. Do / Don’t sažetak

| Do | Don’t |
| --- | --- |
| koristiti postojeće primitive i njihove varijante | uvoditi novi UI sistem po ekranu |
| koristiti dark-teal kao osnovu i ocean-blue kao analitički akcent | koristiti emerald kao glavnu ambijentalnu boju |
| graditi sekcije oko funkcije: zaključak, dokaz, provjera, smjernica | graditi sekcije kao generičke dokument kartice |
| držati maksimalno 3 nivoa surface nesting-a | slagati 4 ili 5 nivoa kartica jedan u drugi |
| čuvati focus-visible i hover konzistentnost | praviti CTA hover/focus regresije |
| koristiti purpose strip kada sekcija traži kratko operativno objašnjenje | uvoditi dugačke uvodne paragrafe bez funkcije |

## 13. Codex implementation rules

Codex pravila za svaki budući UI task:

- Prvo pročitati ovaj dokument.
- Prije izmjene identifikovati koji dio sistema task dira: tipografija, boje, kartice, CTA, navigacija, report layout ili copy.
- Koristiti postojeće primitive kad god su dovoljne.
- Ako je potrebna nova varijanta postojećeg obrasca, proširiti obrazac konzistentno umjesto stvaranja paralelnog rješenja.
- Ne donositi novu vizuelnu logiku bez eksplicitnog razloga u summaryju.
- Ne uvoditi nove boje bez jasne semantike i opravdanja.
- Kod report zadataka ne dirati sadržaj snapshot/model outputa osim ako je task eksplicitno copy task.
- Kod UI polish taskova obavezno provjeriti hover, focus, active i mobile ponašanje.
- Ako task dira report renderer, provjeriti da sekcije izgledaju kao dio istog proizvoda.
- Ako task dira hardcoded BHS UI copy, provjeriti zabranjene riječi iz ovog dokumenta.

## 14. Definition of done za UI task

UI task nije završen dok nisu ispunjeni sljedeći uslovi:

- obrazac je usklađen sa ovim dokumentom
- nema novog paralelnog UI sistema
- boje su semantički ispravne
- CTA hover/focus/active nisu regressovani
- mobile nema horizontalni scroll
- sekcije imaju jasnu funkciju i hijerarhiju
- copy ne uvodi zabranjene riječi u hardcoded UI
- summary jasno navodi svako odstupanje od ovog dokumenta

## 15. Status dokumenta

Ovaj dokument je aktivni Deep Profile UI standard dok ne bude eksplicitno zamijenjen novijom verzijom.
