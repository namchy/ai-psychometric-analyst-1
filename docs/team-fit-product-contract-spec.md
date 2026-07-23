# Team Fit Product / Report Contract Spec

## 1. Status

* Status: `Canonical product/report contract spec draft`
* Scope: product/report contract, input/output/guardrail definition
* Ovaj dokument još nije implementation-ready.
* Ovaj dokument ne otvara DB/provider/renderer/worker rad.
* Source of truth za backlog/status ostaje `docs/deep-profile-todo.md`.

## 2. Product definition

* `Timski fit kandidata` je relational HR report.
* Report tumači odnos između:
  * kandidatovog `kompozitnog profila`
  * timskog `agregiranog profila`
* Report pomaže HR-u i lideru da razumiju:
  * poravnanje
  * komplementarnost
  * potencijalna trenja
  * potrebe za integracijom u konkretni tim
  * teme za intervju ili naredni razgovor
* Report nije presuda o kandidatu.
* Report nije automatska odluka.
* Report smije dati jasan kvalitativni zaključak o odnosu kandidat-tim kada ga evidence podržava.

## 3. Audience and visibility

Ko vidi report:

* HR
* hiring manager / team lead
* eventualno interni leadership stakeholder sa odgovarajućim pristupom

Ko ne vidi report u MVP-u:

* kandidat
* pojedinačni članovi tima
* candidate-facing dashboard

## 4. Terminology

* pojedinac: `kompozitni profil`
* tim: `agregirani profil`
* odnos kandidat + tim: `timski fit kandidata`

Ne koristiti kao glavni framing:

* `culture fit`
* `dobar/loš kandidat`
* `ne uklapa se` kao opštu etiketu bez konkretnog tima, razloga i evidence-a
* `hire/no-hire`
* `konačna preporuka za zapošljavanje`

Dozvoljen je relacijski zaključak poput „kandidat je slabiji izbor za ovaj konkretni tim zbog A, B i C“ kada je vezan za candidate-side signal, team-side signal i interpretivni mehanizam. Nije dozvoljeno reći da je kandidat slab kao osoba ili da ga ne treba zaposliti.

## 5. MVP input model

| Input | Status | Source | Purpose | Privacy note |
| ----- | ------ | ------ | ------- | ------------ |
| candidate HR-safe composite deterministic input snapshot | Required | composite deterministic input layer | stabilan kandidat-side signal | HR-safe, versioned input |
| candidate HR-facing signals from IPIP/SAFRAN/MWMS when available in allowed HR input layer | Required | postojeći HR signal slojevi | dopuna kandidat-side fit tumačenja | bez raw odgovora |
| verified Team Dynamics aggregation/input snapshot | Required | Team Dynamics aggregation/input layer | canonical team-side temelj | agregirano, bez individualnih detalja |
| organization metadata | Required | org context | audit, scoping | privacy-safe metadata |
| team metadata | Required | team context | kontekst tima za report | privacy-safe metadata |
| candidate metadata | Required | candidate context | kontekst kandidata za report | minimalni identifikatori |
| locale | Required | report metadata | jezik i prikaz | bez posebnog privacy rizika |
| generatedAt/version metadata | Required | report metadata | verzionisanje i audit | bez posebnog privacy rizika |
| Team Dynamics Executive Overview snapshot/input as optional interpreted team context | Optional MVP | Executive Overview output/input | dodatni interpreted timski kontekst | nije canonical source |
| role context, only when standardized/versioned source exists | Future optional | future role source | budući role-aware kontekst | tek nakon standardizacije |
| team composition context, only as privacy-safe aggregate | Future optional | future aggregate context | dodatni timski kontekst | samo agregirano |
| raw individual answers from team members | Forbidden | member responses | zabranjen ulaz | privacy zabranjeno |
| individual team member score values in display | Forbidden | member score layer | zabranjen prikaz | privacy zabranjeno |
| private narrative reports of team members | Forbidden | individual member reports | zabranjen ulaz | privacy zabranjeno |
| candidate-facing report as sole source of truth | Forbidden | candidate report layer | zabranjen canonical source | nije HR-safe temelj sam po sebi |
| protected/private content outside allowed HR/team input layer | Forbidden | bilo koji privatni izvor | zabranjen ulaz | privacy/fairness zabranjeno |

## 6. Candidate-side source decision

* Primary candidate-side source je HR-safe composite deterministic input snapshot.
* Composite report snapshot može biti reference/audit ili secondary interpreted context.
* Candidate-facing report ne smije biti jedini source of truth.
* Razlog: Team Fit treba stabilan, versioned i HR-safe input sloj i ne treba zavisiti od human-facing narativa kada postoji deterministic input.

## 7. Team-side source decision

* Primary team-side source je verified Team Dynamics aggregation/input snapshot.
* Team Dynamics Executive Overview snapshot je optional interpreted context.
* Executive Overview snapshot nije required MVP source.
* Team Fit ne smije zavisiti od prethodnog AI-generated Executive Overview reporta kao jedinog team-side source-a.
* Razlog: čuvati determinističku osnovu i izbjeći lančanje AI reporta kao source of truth.

## 8. Role context decision

* Role context je out-of-scope za MVP.
* Ostaje future optional input.
* Ne uvoditi role context dok ne postoji standardizovan, pouzdan i versioned role source.
* Ne uvoditi polovični role-aware fit model u MVP.

## 9. Output sections

| Section | Purpose | HR value | Guardrail |
| ------- | ------- | -------- | --------- |
| `fitOverview` | glavni relacijski sažetak | brzo razumijevanje glavnog signala | bez person-level presude ili automatizovane hiring odluke |
| `teamContextSummary` | relevantni timski obrasci | kontekst za čitanje fit-a | bez imenovanja članova |
| `candidateSignals` | relevantni kandidat-side obrasci | transparentnije tumačenje fit-a | bez raw detalja |
| `complementaritySignals` | gdje kandidat dopunjuje tim | praktična vrijednost kandidata | fit nije isto što i sličnost |
| `frictionRisks` | moguća trenja | rani fokus za mitigaciju | ne etiketirati kandidata/tim |
| `interviewFocus` | teme za provjeru | bolji intervju razgovor | decision-support, ne decisioning |
| `onboardingGuidance` | smjernice za integraciju u konkretni tim | bolja integracija kandidata u ovaj tim | ne ponavlja osnovni IDP plan |
| `managerGuidance` | smjernice za lidera | praktičan rad sa kandidatom | bez uzročnih tvrdnji |
| `watchouts` | oprezne hipoteze | šta treba pažljivo provjeriti | bez presude |
| `interpretationLimits` | granice čitanja reporta | metodološka jasnoća | guardrail ostaje eksplicitan |

## 10. Fit semantics

* MVP ne uvodi numeric `fitScore`.
* Fit nije sličnost.
* Team Fit mora razlikovati:
  * alignment
  * complementarity
  * friction risk
  * potrebe za integracijom u konkretni tim
* Koristiti structured relationship narrative + evidence.
* `relationshipPattern` je navigacijski label, dok tekst reporta smije dati direktan evidence-backed relacijski zaključak.

Zaključak može reći da je kandidat snažan izbor za konkretni tim, dobar izbor uz jasno navedene uslove, da je odnos mješovit ili da je kandidat slabiji izbor za trenutni način rada tima. `needs_validation` koristiti samo kada podaci stvarno nisu dovoljni, ne kao opšte sklonište od zaključka.

Dozvoljeni enum:

```ts
relationshipPattern:
  | "alignment_signal"
  | "complementarity_signal"
  | "mixed_signal"
  | "needs_validation"
```

Kratko značenje:

* `alignment_signal`: postoje relevantni signali poravnanja kandidata i tima.
* `complementarity_signal`: kandidat može donijeti korisnu dopunu timu.
* `mixed_signal`: postoje i poravnanje/dopuna i potencijalna trenja.
* `needs_validation`: signal najviše ukazuje na teme za dodatnu provjeru kroz intervju/onboarding razgovor.

## 11. Draft contract outline

Docs-only draft outline (nije code schema):

```ts
type TeamFitReportV1 = {
  reportType: "team_fit_report_v1";
  reportVersion: "v1";
  locale: ReportLocale;

  generatedAt: string;
  inputSnapshotVersion: string;
  teamFitReportVersion: "v1";

  audience: "hr_internal";
  sourceType: "candidate_team_relational";

  teamContext: {
    organizationId: string;
    teamId: string;
    teamName: string;
    teamAssessmentAssignmentId?: string | null;
    teamDynamicsAggregationSnapshotId?: string | null;
    teamDynamicsReportId?: string | null;
  };

  candidateContext: {
    organizationId: string;
    participantId: string;
    assessmentAssignmentId?: string | null;
    compositeInputSnapshotId?: string | null;
    compositeReportId?: string | null;
    displayName?: string | null;
  };

  source: {
    candidateCompositeInputVersion: string;
    candidateSourceReportIds: string[];
    candidateSourceTestSlugs: string[];
    teamInputVersion: string;
    teamSourceReportIds: string[];
    teamSourceSnapshotIds: string[];
    optionalContextKeys: string[];
  };

  fitOverview: {
    relationshipPattern:
      | "alignment_signal"
      | "complementarity_signal"
      | "mixed_signal"
      | "needs_validation";
    headline: string;
    summary: string;
  };

  teamContextSummary: {
    relevantTeamPatterns: Array<{
      title: string;
      summary: string;
    }>;
  };

  candidateSignals: Array<{
    title: string;
    summary: string;
    relevanceToFit: string;
  }>;

  complementaritySignals: Array<{
    title: string;
    summary: string;
    practicalValue: string;
  }>;

  frictionRisks: Array<{
    title: string;
    summary: string;
    whyItMayMatter: string;
    mitigationFocus: string;
  }>;

  interviewFocus: {
    areas: Array<{
      title: string;
      rationale: string;
      prompts: string[];
    }>;
  };

  onboardingGuidance: {
    priorities: string[];
    supportNeeds: string[];
  };

  managerGuidance: {
    workingStyleGuidance: string[];
    communicationGuidance: string[];
  };

  watchouts: string[];

  interpretationLimits: string[];

  metadata: {
    provider?: string;
    providerVersion?: string;
    generatedAt: string;
  };
};
```

## 12. Privacy and fairness guardrails

* no hire/no-hire recommendation
* no rejection recommendation
* no generic or person-level candidate “bad fit” label
* no team “bad/disfunctional” label
* no individual team member naming as friction source
* no raw answers
* no individual team member score display
* no private member narrative reports
* no deterministic performance prediction
* no causality claims
* no medical/clinical language
* no protected-class inference
* no culture-fit bias framing
* decision-support, not decision automation
* candidate-facing output is not part of MVP

## 13. Out of MVP

* implementation
* DB migration
* provider
* renderer
* worker
* lifecycle/orchestration
* scheduler/cron/background loop
* candidate-facing Team Fit output
* numeric hire score
* numeric fit score
* raw team member details
* automatic decisioning
* second Team Dynamics report kind
* Team Fit UI lane
* role-aware fit model

## 14. Relationship to existing lanes

Team Fit je odvojen od:

* Team Dynamics Executive Overview
* Team Development Report / future Team Dynamics report kinds
* Composite HR report
* Individualni razvojni profil
* Candidate-facing participant reports

Team Fit je relacijski report: candidate + team.

## 15. Implementation readiness notes

* Ovaj spec sam po sebi nije implementation-ready.
* Prije implementacije potreban je zaseban implementation planning slice koji definiše:
  * storage artefact
  * input snapshot builder
  * lifecycle
  * provider contract
  * validator
  * renderer
  * access/visibility model
  * tests/smoke strategy
* Ovaj spec sam po sebi ne odobrava implementation rad.

## 16. Implementation planning summary

* Future implementation should use dedicated `team_fit_reports`.
* Primary candidate input remains composite deterministic input snapshot.
* Primary team input remains verified Team Dynamics aggregation/input snapshot.
* Executive Overview context remains optional and may be deferred from first implementation slice.
* MVP processing model remains manual/controlled, no scheduler default.
* This planning summary does not approve implementation.

### First implementation prerequisites

* Dedicated `team_fit_reports` ostaje obavezan prvi storage artefakt.
* MVP access ostaje HR/admin-only u odgovarajućem organization/team/candidate scope-u; manager/leadership access ostaje future explicit decision.
* Executive Overview interpreted context ostaje optional i deferred iz prvog implementation slice-a.
* Prvi implementation slice mora biti storage/lifecycle shell before provider/renderer/worker.
* Manual retry u MVP-u koristi isti persisted `input_snapshot`, bez automatic rebuilda.
