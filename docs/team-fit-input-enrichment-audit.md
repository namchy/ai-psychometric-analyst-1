# Team Fit Input Enrichment Audit

## 1. Trenutni input snapshot shape

Status ovog dokumenta:

* audit/spec slice
* bez runtime implementacije
* bez DB schema promjene
* bez provider prompt promjene
* bez lifecycle promjene

Postojeći Team Fit input koristi:

* `inputType = "team_fit_report_input_v1"`
* `inputVersion = "team_fit_report_input_v1"`

Glavni source helperi/fajlovi:

* `lib/b2b/team-fit-report-input.ts`
* `lib/b2b/team-fit-report-lifecycle.ts`
* `lib/b2b/team-fit-report-processor.ts`
* `lib/b2b/team-fit-report-openai-provider.ts`
* `scripts/test-team-fit-report-input-builder.cjs`

Trenutne top-level sekcije snapshota:

* `inputType`
* `inputVersion`
* `reportType`
* `reportVersion`
* `locale`
* `generatedAt`
* `organizationContext`
* `teamContext`
* `candidateContext`
* `sourceReferences`
* `candidateSignals`
* `teamSignals`
* `interpretationGuardrails`

Šta je stvarni deterministic source danas:

* `organizationContext` se čita direktno iz `organizations`
* `teamContext.teamId/teamName` se čita direktno iz `teams`
* `candidateContext.participantId/displayName` se čita direktno iz `participants`
* `candidateSourceType/candidateSourceId` i `teamSourceType/teamSourceId` se čitaju iz queued `team_fit_reports` row-a
* `locale` dolazi iz `optional_context.locale` kada postoji, inače fallback na `"bs"`
* `interpretationGuardrails` su hard-coded deterministic flags

Šta je placeholder/fallback danas:

* `candidateSignals.sourceStatus = "placeholder_pending_composite_input"`
* `candidateSignals.summary = null`
* `teamSignals.sourceStatus = "placeholder_pending_team_aggregation_input"`
* `teamSignals.summary = null`
* `sourceReferences.executiveOverviewContextIncluded = false`
* `sourceReferences.roleContextIncluded = false`

Praktično značenje:

* Team Fit input trenutno ne dereferencira stvarni candidate-side composite deterministic snapshot.
* Team Fit input trenutno ne dereferencira verified Team Dynamics aggregation/input snapshot.
* Provider danas dobija canonical shell sa identitetom, izvor ID referencama i guardrail zastavicama, ali bez bogatih signalnih payload-a.

## 2. Current limitations

Gdje je input tanak:

* candidate side nema stvarne deterministic signale, samo source ID referencu i placeholder status
* team side nema stvarne agregirane timske signale, samo source ID referencu i placeholder status
* nema coverage metadata o tome koliko je candidate-side ili team-side signal pouzdan/kompletan
* nema confidence/fallback oznaka osim grubih placeholder statusa
* nema read-only preuzetih summary signala iz postojećeg Composite HR input sloja
* nema read-only preuzetih verified aggregation summary signala iz Team Dynamics sloja

Sekcije koje vjerovatno vode generičkom OpenAI outputu:

* `fitOverview`
* `candidateSignals`
* `complementaritySignals`
* `frictionRisks`
* `interviewFocus`
* `onboardingGuidance`
* `managerGuidance`

Razlog:

* model ima guardraile i strukturu, ali nema dovoljno specifičnih source signala da razlikuje stvarnu komplementarnost od opreznog generičkog HR savjeta
* bez candidate-side signalnih vektora i team-side agregata, relationship reasoning se svodi na generički “needs validation” framing

Šta se ne može kvalitetno zaključiti iz trenutnog inputa:

* koji su dominantni kandidatovi obrasci saradnje relevantni baš za timski kontekst
* da li kandidat vjerovatno dopunjuje tim ili samo liči na postojeći timski obrazac
* koji timski friction obrasci su stvarno prisutni na agregiranom nivou
* da li je signal više alignment, complementarity ili mixed
* koliko je preporučeni intervju/onboarding guidance ukorijenjen u stvarnim deterministic signalima, a koliko je generički HR template

Šta QA reviewer ne može otkriti jer input nema dovoljno source signala:

* reviewer može provjeriti guardraile i minimalnu HR-operativnost outputa
* reviewer ne može provjeriti da li je output previše generičan u odnosu na stvarne candidate/team signale kada ti signali nisu ni prisutni u inputu
* reviewer ne može provjeriti da li su `alignment_signal` ili `complementarity_signal` opravdani stvarnim evidence summaryjem
* reviewer ne može razlikovati “siguran ali generičan” output od “siguran i dobro utemeljen” outputa bez richer input source-a

## 3. Candidate-side enrichment candidates

Dozvoljeni candidate-side source za budući Team Fit enrichment:

* read-only HR-safe `CompositeHrInputSnapshot`
* read-only deterministic summary signali iz postojećeg composite input sloja
* po potrebi read-only minimalni interpreted HR-safe summary iz future composite reporta, ali ne kao primary source of truth

Ne uključivati:

* raw answers
* raw item text
* candidate-facing report text kao primary source
* private/sensitive inferencije
* medicinske, kliničke ili dijagnostičke etikete

Minimalni candidate-side enrichment skup:

* `candidateProfile.summarySignals`
  * `personalityHighestDomains`
  * `personalityLowestDomains`
  * `cognitiveStrongestDomain`
  * `cognitiveLowestDomain`
  * `motivationHighestDrivers`
  * `motivationLowestDrivers`
  * `crossInstrumentFlags`

* `candidateProfile.collaborationRelevantSignals`
  * 3 do 5 kratkih HR-safe signalnih stavki izvedenih iz IPIP domena/faceta relevantnih za saradnju
  * fokus na radni stil, otvorenost za koordinaciju, tempo/usmjerenost, stil interakcije i toleranciju na strukturu/neizvjesnost

* `candidateProfile.motivationSignals`
  * dominant drivers
  * lower drivers
  * caution flags iz MWMS ako postoje kao deterministic summary

* `candidateProfile.problemSolvingSignals`
  * strongest/lowest SAFRAN domain signal
  * oprezna radna implikacija, ne capability presuda

* `candidateProfile.interpretationLimits`
  * candidate-side confidence/fallback zastavice
  * npr. kada neki instrument nije dostupan, kada signal dolazi iz incomplete coverage fallbacka, kada je summary reduciran

Candidate-side princip:

* Team Fit ne treba pun composite payload.
* Team Fit treba mali, HR-safe, relation-ready candidate signal paket.

## 4. Team-side enrichment candidates

Dozvoljeni team-side source za budući Team Fit enrichment:

* read-only verified `TeamDynamicsReportInputSnapshot`
* read-only verified final aggregation summary koji je već u Team Dynamics input sloju
* optional read-only Executive Overview snapshot samo kao secondary interpreted context, ne kao canonical team source

Ne uključivati:

* individualne member answers
* individualne member scores
* imenovanje pojedinaca
* raw response-level evidence

Minimalni team-side enrichment skup:

* `teamProfile.aggregationCoverage`
  * `includedMemberCount`
  * `completedMemberCount`
  * `readyScoredMemberCount`
  * `incompleteMemberCount`
  * `missingScoreCount`
  * `invalidScoreCount`

* `teamProfile.coreSignals`
  * team-level aggregated signals izvedeni iz `scoreEntryAggregations`
  * mali broj već prežvakanih summary stavki pogodnih za Team Fit, ne cijeli aggregation blob

* `teamProfile.psychologicalSafetySignal`
  * prisutnost signala
  * kratki team-level summary ako verified source to podržava

* `teamProfile.communicationAndCoordinationSignals`
  * alignment/friction obrasci
  * signal o koordinaciji i radnom ritmu

* `teamProfile.situationalJudgmentSignal`
  * SJT/team judgment signal ako verified source postoji

* `teamProfile.outcomePulseSignal`
  * outcome pulse signal ako verified source postoji

* `teamProfile.varianceAndConfidence`
  * disagreement/variance/coverage metadata samo kao team-level signal
  * koristiti za `needs_validation` framing, ne za score ili rang

Team-side princip:

* Team Fit ne treba individualni timski sadržaj.
* Team Fit treba minimalni verified aggregated team context koji objašnjava gdje kandidat može biti poravnat, komplementaran ili rizičan po trenje.

## 5. Relationship reasoning model

Enriched input treba pomoći reportu da razlikuje:

* `alignment_signal`
  * kandidatovi dominantni radni obrasci i timski agregirani obrasci sugerišu korisno poravnanje u načinu saradnje, komunikacije ili radnog ritma

* `complementarity_signal`
  * kandidat ne mora ličiti timu, ali može korisno dopuniti timsku sliku kroz perspektivu, stil koordinacije ili motivacioni obrazac

* `mixed_signal`
  * postoje istovremeno realni razlozi za poravnanje/dopunu i realni razlozi za trenje ili onboarding oprez

* `needs_validation`
  * coverage je tanka, variance je visoka, source signali su nepotpuni ili konfliktni, ili candidate/team signal veza nije dovoljno jaka za snažniji framing

Ovo nije:

* score
* rang
* hire/no-hire odluka
* automatska preporuka

Poželjni reasoning princip:

* Team Fit treba koristiti hipoteze zasnovane na source signalima.
* Hipoteze se zatim pretvaraju u:
  * interview focus
  * onboarding priorities
  * manager guidance
  * watchouts

## 6. Privacy/fairness guardrails

Obavezni guardraili za enrichment model:

* bez raw candidate answers
* bez raw team member answers
* bez individualnih team member skorova
* bez imenovanja članova tima
* bez numeric fit score-a
* bez hire/no-hire jezika
* bez candidate-facing outputa
* bez dijagnoza ili etiketiranja
* bez protected/sensitive attribute inferencija
* bez tvrdnje da Team Fit predviđa uspjeh ili zamjenjuje HR odluku

Dodatni fairness princip:

* disagreement/variance signal služi za oprez i validaciju, ne za pojačavanje sigurnosti modela
* absent/missing source signal mora voditi ka `needs_validation` ili ograničenijem outputu, ne ka izmišljenoj sigurnosti

## 7. Proposed enriched input snapshot vNext

Predloženi naziv:

* `team_fit_report_input_v2_enriched`

Razlog:

* ostaje u istoj naming porodici kao postojeći Team Fit input
* jasno označava version bump
* ne uvodi docs-only “draft” ime u runtime konvenciju

Predloženi JSON-ish shape:

```ts
type TeamFitReportInputV2Enriched = {
  inputType: "team_fit_report_input_v2_enriched";
  inputVersion: "team_fit_report_input_v2_enriched";
  reportType: "team_fit_report_v1";
  reportVersion: "v1";
  locale: string;
  generatedAt: string;

  organizationContext: {
    organizationId: string;
    organizationName: string | null;
  };

  teamContext: {
    teamId: string;
    teamName: string | null;
    teamSourceType: "team_dynamics_aggregation_input_snapshot";
    teamSourceId: string | null;
    teamAssessmentAssignmentId?: string | null;
  };

  candidateContext: {
    participantId: string;
    displayName: string | null;
    candidateSourceType: "composite_deterministic_input_snapshot";
    candidateSourceId: string | null;
    assessmentAssignmentId?: string | null;
  };

  sourceReferences: {
    teamFitReportId: string;
    candidateSourceType: "composite_deterministic_input_snapshot";
    candidateSourceId: string | null;
    teamSourceType: "team_dynamics_aggregation_input_snapshot";
    teamSourceId: string | null;
    compositeInputSnapshotVersion?: string | null;
    teamDynamicsInputSnapshotVersion?: string | null;
    executiveOverviewContextIncluded: false;
    roleContextIncluded: false;
  };

  candidateSignals: {
    sourceStatus: "available" | "partial" | "unavailable";
    summary: {
      personalityHighestDomains: string[];
      personalityLowestDomains: string[];
      cognitiveStrongestDomain: string | null;
      cognitiveLowestDomain: string | null;
      motivationHighestDrivers: string[];
      motivationLowestDrivers: string[];
      crossInstrumentFlags: string[];
    } | null;
    collaborationRelevantSignals: Array<{
      key: string;
      label: string;
      summary: string;
    }>;
    motivationSignals?: Array<{
      key: string;
      label: string;
      summary: string;
    }>;
    problemSolvingSignals?: Array<{
      key: string;
      label: string;
      summary: string;
    }>;
    interpretationLimits: string[];
  };

  teamSignals: {
    sourceStatus: "available" | "partial" | "unavailable";
    summary: {
      includedMemberCount: number | null;
      completedMemberCount: number | null;
      readyScoredMemberCount: number | null;
      incompleteMemberCount: number | null;
      missingScoreCount: number | null;
      invalidScoreCount: number | null;
      psychologicalSafetyAggregationPresent: boolean;
      sjtAggregationPresent: boolean;
      outcomePulseAggregationPresent: boolean;
    } | null;
    coreSignals: Array<{
      key: string;
      label: string;
      summary: string;
    }>;
    communicationAndCoordinationSignals: Array<{
      key: string;
      label: string;
      summary: string;
    }>;
    psychologicalSafetySignal?: {
      label: string;
      summary: string;
    } | null;
    situationalJudgmentSignal?: {
      label: string;
      summary: string;
    } | null;
    outcomePulseSignal?: {
      label: string;
      summary: string;
    } | null;
    varianceAndConfidence: {
      coverageNote: string | null;
      disagreementFlags: string[];
    };
  };

  relationshipReasoningGuardrails: {
    noNumericFitScore: true;
    noHireNoHire: true;
    noRawTeamMemberAnswers: true;
    noIndividualTeamMemberScoreDisplay: true;
    noCandidateFacingOutput: true;
    noProtectedAttributeInference: true;
    relationshipPatternIsNotDecision: true;
  };
};
```

Obavezna polja:

* postojeći identity/context blokovi
* `candidateSignals.sourceStatus`
* `candidateSignals.summary`
* `candidateSignals.collaborationRelevantSignals`
* `candidateSignals.interpretationLimits`
* `teamSignals.sourceStatus`
* `teamSignals.summary`
* `teamSignals.coreSignals`
* `teamSignals.communicationAndCoordinationSignals`
* `teamSignals.varianceAndConfidence`
* `relationshipReasoningGuardrails`

Optional polja:

* `candidateContext.assessmentAssignmentId`
* `teamContext.teamAssessmentAssignmentId`
* `sourceReferences.compositeInputSnapshotVersion`
* `sourceReferences.teamDynamicsInputSnapshotVersion`
* `candidateSignals.motivationSignals`
* `candidateSignals.problemSolvingSignals`
* `teamSignals.psychologicalSafetySignal`
* `teamSignals.situationalJudgmentSignal`
* `teamSignals.outcomePulseSignal`

Source po većim sekcijama:

* `organizationContext`, `teamContext`, `candidateContext`, `sourceReferences`
  * postojeći `team_fit_reports` row + `organizations` + `teams` + `participants`

* `candidateSignals.summary`
  * `CompositeHrInputSnapshot.summarySignals`

* `candidateSignals.collaborationRelevantSignals`
  * derived read-only subset iz `CompositeHrInputSnapshot.deterministicInputs`

* `candidateSignals.motivationSignals`
  * `CompositeHrInputSnapshot.deterministicInputs.mwms`

* `candidateSignals.problemSolvingSignals`
  * `CompositeHrInputSnapshot.deterministicInputs.safran`

* `teamSignals.summary`
  * `TeamDynamicsReportInputSnapshot.aggregationSummary`

* `teamSignals.coreSignals`
  * reduced read-only subset iz verified `scoreEntryAggregations`

* `teamSignals.communicationAndCoordinationSignals`
  * read-only reduced subset iz verified team-level aggregation summary

* `teamSignals.psychologicalSafetySignal`, `teamSignals.situationalJudgmentSignal`, `teamSignals.outcomePulseSignal`
  * verified Team Dynamics aggregation/input snapshot only when available

Izvan scope-a za vNext:

* role context
* member-level narratives
* individual score evidence
* candidate-facing phrasing
* team-composition demographic analysis
* success prediction
* hiring decisioning

## 8. Minimal implementation plan

Najmanji budući implementation slice nakon ovog audita:

* proširiti Team Fit input builder da read-only dereferencira:
  * postojeći candidate-side composite deterministic snapshot
  * postojeći verified Team Dynamics aggregation/input snapshot
* u Team Fit input snapshot upisati samo minimalni reduced summary payload, ne full upstream snapshot dump
* zadržati isti `team_fit_reports` storage i lifecycle
* zadržati mock default provider path
* ne uvoditi worker/scheduler
* ne uvoditi DB migraciju ako enriched payload i dalje stane u postojeći `input_snapshot` jsonb model
* ne mijenjati view route

Minimalni testovi za taj budući implementation slice:

* unit/script test da `buildTeamFitReportInputSnapshot(...)` vraća enriched vNext shape
* test da candidate-side source dolazi samo iz HR-safe composite deterministic inputa
* test da team-side source dolazi samo iz verified team-level aggregation/input snapshota
* test da enrichment ne uvodi raw answers, raw item text, member scores ni candidate-facing copy
* test da fallback radi kontrolisano kada candidate-side ili team-side source nije dostupan
* postojeći Team Fit OpenAI DB smoke treba proširiti assertionima da real persisted `input_snapshot` nosi stvarne candidate/team summary signale
* QA/reviewer test treba dobiti najmanje jedan fixture koji pokazuje da richer input može opravdati manje generičan `alignment` ili `mixed` output

## 9. Open questions / risks

Product odluke:

* koliko candidate-side signal treba biti “sažeti label + summary”, a koliko “mini evidence packet”
* da li Team Fit smije koristiti future composite interpreted HR report kao secondary context ili striktno samo deterministic input
* koliko variance/disagreement metadata treba biti vidljivo provideru kao zaseban timski oprezni signal

Zavisnosti od composite snapshot-a:

* Team Fit enrichment zavisi od dostupnosti stabilnog read-only candidate-side source-a po `candidate_source_id`
* treba potvrditi da `candidate_source_id` mapira na stvarni composite deterministic artefakt koji je dovoljno stabilan za read-only reuse

Zavisnosti od Team Dynamics aggregation readiness-a:

* Team Fit enrichment zavisi od verified team-side aggregation/input source-a po `team_source_id`
* treba potvrditi da `team_source_id` mapira na source koji sadrži dovoljno read-only team summary podataka, ne samo identity shell

MVP fallback koji može ostati:

* kada candidate-side source nije dostupan, `candidateSignals.sourceStatus` može ostati `partial` ili `unavailable`
* kada team-side source nije dostupan ili coverage nije dovoljno jaka, relationship framing treba ići prema `needs_validation`
* Executive Overview i role context mogu ostati izvan scope-a dokle god deterministic composite + verified aggregation daju dovoljan minimalni signal za Team Fit vNext
