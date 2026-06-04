# Deep Profile AI Report Content Architecture

## 1. Product decision

Deep Profile se diferencira kroz hyper-smart AI interpretaciju. AI/provider promptovi i report contracts moraju definirati sadržaj za svaki UI segment, umjesto da frontend improvizira interpretaciju ili prepakira generički copy.

Ova odluka se retroaktivno primjenjuje na individualne reportove, IDP, participant/HR reportove i buduće report tipove. Team Fit ostaje referentni obrazac za segment-aware pristup, ali nije glavni fokus ovog dokumenta.

## 2. Core principle

Za svaki AI-generisani UI tekstualni element mora postojati eksplicitno definisan content contract:

- svrha
- korisnik
- forma/struktura
- ton
- dužina
- zabrane
- JSON/report polje
- validator/test expectations
- renderer mapping

Bez tog ugovora frontend ne smije preuzeti autorstvo nad interpretacijom.

## 3. Frontend responsibility boundary

Frontend smije:

- renderovati
- organizovati
- labelirati
- collapse/expand ponašanje
- formatirati

Frontend ne smije:

- generisati psihološke ili HR zaključke
- spajati scoreove u nove domain zaključke
- parafrazirati AI zaključke kao da su provider-authored ako nisu
- popunjavati nedostajuća analitička polja izmišljenom interpretacijom

## 4. Audit summary by report type

### IDP

IDP već ima jasan report snapshot i višeslojni renderer, ali P0 summary dio duplira `overallPattern`, a dio hero/meta copyja i dalje nema dovoljno precizno razdvojen segment contract. Najveći rizik je da se isti interpretacijski tekst prikazuje više puta ili da frontend implicitno pojačava autoritet jednog polja bez eksplicitnog segment contracta.

### Legacy Big Five

Legacy Big Five path još uvijek koristi frontend-authored zaključke za `topInsights` i `conclusionParagraphs`. Najveći rizik je da UI pravi novu interpretaciju kombinovanjem više AI polja i score-derived sentence-a umjesto da renderer mapira namjenski content contract.

### MWMS participant

Participant MWMS prikaz koristi frontend-generisane headline/one-liner/signals slojeve iz skorova, iako AI report postoji kao zaseban artefakt. Najveći rizik je da frontend preuzima autorstvo nad glavnim sažetkom i time zamagljuje granicu između score displaya i AI interpretacije.

### SAFRAN participant

SAFRAN participant display još uvijek spaja više AI signala u jedan prikaz, a dio domain kartica koristi hardcoded helper copy umjesto direktnog AI segment mapiranja. Najveći rizik je miješanje AI outputa i frontend-generated interpretacije u istom vidljivom bloku.

### SAFRAN HR

SAFRAN HR je najbliži segment-aware sadržajnom ugovoru: ima poseban executive summary, cognitive signals, caution points, interview guidance, onboarding guidance i interpretation limits. Rizik je manji nego kod drugih lane-ova, ali i dalje treba strogo držati contract-aware prompt instrukcije i kvalitetne guardraile po segmentu.

### IPIP participant/HR

IPIP participant i HR lane već imaju više segmentiranih blokova i v2 segment architecture je najbliži željenom obrascu. Ipak, frontend i dalje koristi dijelove derived narrative logike i mora ostati striktno iza renderer mapping granice.

### IPC participant/HR

IPC path ima relativno direktan mapping, ali pojedini UI blokovi i dalje spajaju više polja u jednu rečenicu ili list item. Rizik je slabiji nego kod legacy Big Five, ali i dalje postoji potreba za jasnijim contractom na nivou vidljivog segmenta.

## 5. Priority model

- P0: hero/executive i najvidljivija interpretacija
- P1: risks/recommendations/interview/manager/onboarding guidance
- P2: secondary detail/evidence sekcije
- P3: interpretation limits, disclaimers i microcopy

## 6. Remediation categories

### A) UI mapping cleanup

Rješava slučajeve gdje postojeći AI fields već postoje, ali su pogrešno raspoređeni, duplirani ili frontend previše govori vlastitim glasom.

### B) Provider prompt update

Rješava slučajeve gdje provider prompt nema dovoljno precizne instrukcije za svaku UI segmentaciju: svrha, audience, formu, ton, dužinu i zabrane.

### C) Contract/validator update

Rješava slučajeve gdje report contract ili validator ne pokrivaju stvarne UI potrebe, ne hvataju generički copy, duplicate text, mapping mismatch ili kvalitetne guardraile.

### D) Legacy snapshot / regeneration / migration strategy

Rješava slučajeve gdje stari snapshotovi nemaju nove contract polja. Potreban je plan za kompatibilnost, regeneraciju ili adapter sloj prije širenja contracta.

## 7. Recommended implementation order

1. IDP P0 summary mapping cleanup
2. Legacy Big Five/MWMS participant P0 cleanup
3. SAFRAN participant display contract cleanup
4. quality guardrails in validators/tests
5. provider prompt updates per report type
6. legacy snapshot strategy

## 8. Guardrails

- no frontend-authored domain interpretation
- no broad all-report refactor in one slice
- no DB/storage migration without explicit decision
- `docs/deep-profile-todo.md` remains canonical backlog
- ovaj spec je supporting product/tech rationale, ne zamjena za backlog

## 9. Content contract template

Svaki AI-generisani UI tekstualni element treba imati eksplicitan template sa poljima:

- UI segment
- report JSON field
- purpose
- audience
- input evidence/source
- required structure
- tone
- length
- must include
- must not include
- fallback behavior
- validator/test expectations
- renderer mapping

Kratak primjer za P0 executive field:

- UI segment: executive summary hero block
- report JSON field: `executiveSnapshot.hrMeaning` ili `fitOverview.hrMeaning`
- purpose: dati glavni HR-friendly interpretativni signal
- audience: hiring manager / HR reviewer
- required structure: 1 kratki naslov + 2-4 jasne rečenice
- tone: siguran, konkretan, ne-akademski
- must not include: metodološke ograde, generički filler, nove zaključke koje frontend izvodi iz skora

## 10. Legacy snapshot policy

- Legacy snapshot se ne smije frontend-nadograditi izmišljanjem novih domain zaključaka.
- Ako novo segment-aware polje ne postoji, koristiti legacy fallback/legacy renderer ili donijeti eksplicitnu regeneration/migration odluku.
- Adapter smije mapirati postojeća polja samo bez nove interpretacije.
- Provider/contract update mora imati plan za stare snapshot-e prije širenja contracta.

## 11. Slice acceptance rules

- Svaki slice mora biti jasno označen kao UI-only, provider prompt, contract/validator, quality guardrail ili legacy migration/regeneration.
- Svaki slice mora navesti dozvoljene fajlove/slojeve.
- Svaki slice mora potvrditi da frontend ne generiše novu domain interpretaciju.
- P0/P1 slice mora imati test/guardrail protiv dupliranja, pogrešnog mappinga ili generičkog teksta kada je praktično.
- Broad all-report refactor je zabranjen bez posebne odluke.
