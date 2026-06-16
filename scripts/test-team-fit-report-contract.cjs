const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const helperPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-contract.ts");
const helperSource = fs.readFileSync(helperPath, "utf8");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  for (const extension of [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]) {
    const withExtension = `${candidatePath}${extension}`;
    if (fs.existsSync(withExtension)) {
      return withExtension;
    }
  }

  return candidatePath;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") {
    return emptyModulePath;
  }

  if (request.startsWith("@/")) {
    return originalResolveFilename.call(
      this,
      resolveWithExtensions(path.join(projectRoot, request.slice(2))),
      parent,
      isMain,
      options,
    );
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

assert.match(helperSource, /TEAM_FIT_REPORT_TYPE/);
assert.match(helperSource, /TEAM_FIT_REPORT_CONTRACT_VERSION/);
assert.match(helperSource, /TEAM_FIT_RELATIONSHIP_PATTERNS/);
assert.match(helperSource, /validateTeamFitReportSnapshot/);
assert.match(helperSource, /validateTeamFitReportV1ContractSnapshot/);
assert.doesNotMatch(helperSource, /\.from\("/);
assert.doesNotMatch(helperSource, /OpenAI|renderer|worker/i);
assert.doesNotMatch(helperSource, /team-fit-report-input|team-fit-report-lifecycle/);

const {
  TEAM_FIT_REPORT_TYPE,
  TEAM_FIT_REPORT_VERSION,
  TEAM_FIT_REPORT_CONTRACT_VERSION,
  TEAM_FIT_REPORT_CONTRACT_REPORT_TYPE,
  TEAM_FIT_REPORT_CONTRACT_AUDIENCE,
  TEAM_FIT_RELATIONSHIP_PATTERNS,
  validateTeamFitReportSnapshot,
  validateTeamFitReportV1ContractSnapshot,
} = require(helperPath);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildValidSnapshot() {
  return {
    reportType: TEAM_FIT_REPORT_TYPE,
    reportVersion: TEAM_FIT_REPORT_VERSION,
    locale: "bs",
    generatedAt: "2026-05-30T12:00:00.000Z",
    inputSnapshotVersion: "team_fit_report_input_v1",
    teamFitReportVersion: "v1",
    audience: "hr_internal",
    sourceType: "candidate_team_relational",
    teamContext: {
      organizationId: "org-1",
      teamId: "team-1",
      teamName: "Team A",
      teamDynamicsAggregationSnapshotId: "agg-1",
    },
    candidateContext: {
      organizationId: "org-1",
      participantId: "participant-1",
      compositeInputSnapshotId: "composite-1",
      displayName: "Amina Candidate",
    },
    source: {
      candidateCompositeInputVersion: "composite_hr_input_v1",
      candidateSourceReportIds: [],
      candidateSourceTestSlugs: ["ipip_neo_120", "safran_hr_v1", "mwms_v1"],
      teamInputVersion: "team_dynamics_final_aggregation_v1",
      teamSourceReportIds: [],
      teamSourceSnapshotIds: ["agg-1"],
      optionalContextKeys: [],
    },
    fitOverview: {
      relationshipPattern: "needs_validation",
      headline: "Kandidat i tim pokazuju signal koji traži dodatnu provjeru.",
      summary: "Postoje i tačke poravnanja i teme koje treba dodatno validirati kroz razgovor.",
    },
    teamContextSummary: {
      relevantTeamPatterns: [
        {
          title: "Stabilan timski ritam",
          summary: "Tim djeluje kroz relativno konzistentan način saradnje.",
        },
      ],
    },
    candidateSignals: [
      {
        title: "Strukturiran pristup",
        summary: "Kandidat djeluje konzistentno i pregledno u načinu rada.",
        relevanceToFit: "Ovo može pomoći uklapanju u postojeći timski ritam.",
      },
    ],
    complementaritySignals: [
      {
        title: "Dodatna perspektiva",
        summary: "Kandidat može donijeti korisnu dopunu postojećim obrascima rada tima.",
        practicalValue: "To može proširiti raspon pristupa u složenijim situacijama.",
      },
    ],
    frictionRisks: [
      {
        title: "Tempo usklađivanja",
        summary: "Početna usklađivanja oko očekivanja mogu tražiti više eksplicitnosti.",
        whyItMayMatter: "Bez jasnog dogovora može doći do pogrešnog tumačenja prioriteta.",
        mitigationFocus: "Rano uskladiti očekivanja i ritam povratne informacije.",
      },
    ],
    interviewFocus: {
      areas: [
        {
          title: "Preferirani način saradnje",
          rationale: "Korisno je provjeriti kako kandidat gradi radni odnos u timu.",
          prompts: ["Kako najlakše usklađujete očekivanja u novom timu?"],
        },
      ],
    },
    onboardingGuidance: {
      priorities: ["Prve sedmice jasno definisati očekivanja saradnje."],
      supportNeeds: ["Dogovoriti ritam povratnih informacija u ranom onboarding periodu."],
    },
    managerGuidance: {
      workingStyleGuidance: ["Postaviti jasan okvir prioriteta i odgovornosti."],
      communicationGuidance: ["Koristiti kratke i eksplicitne check-in razgovore."],
    },
    watchouts: ["Ne donositi brze zaključke bez dodatne provjere kroz razgovor."],
    interpretationLimits: ["Ovaj izvještaj je pomoć za strukturisano tumačenje odnosa kandidata i tima."],
    metadata: {
      generatedAt: "2026-05-30T12:00:00.000Z",
    },
  };
}

function evidence(id, sourceType = "candidate_deep_profile_signal") {
  return {
    id,
    sourceType,
    sourceLabel: sourceType,
    signalLabel: `${id} signal`,
    summary: `${id} summary`,
    relationToClaim: `${id} links candidate signal to team context.`,
    snapshotId: `${id}-snapshot`,
    version: "v1",
  };
}

function buildValidContractSnapshot() {
  const candidateEvidence = evidence("candidate-1", "candidate_deep_profile_signal");
  const teamEvidence = evidence("team-1", "team_dynamics_aggregation_signal");
  const linkEvidence = evidence("link-1", "interpretive_link");
  const sectionEvidence = [candidateEvidence, teamEvidence, linkEvidence];

  return {
    contractVersion: TEAM_FIT_REPORT_CONTRACT_VERSION,
    reportType: TEAM_FIT_REPORT_CONTRACT_REPORT_TYPE,
    audience: TEAM_FIT_REPORT_CONTRACT_AUDIENCE,
    sourceType: "candidate_team_relational",
    locale: "bs-BA",
    generatedFor: {
      organizationId: "org-1",
      teamId: "team-1",
      participantId: "participant-1",
      teamName: "Tim operacija",
      candidateDisplayName: "Amina Candidate",
    },
    source: {
      candidateDeepProfileSignals: [candidateEvidence],
      teamStyleCollaborationSignals: [],
      teamDynamicsAggregationSignals: [teamEvidence],
      teamDynamicsExecutiveOverviewSignals: [],
      hrAdminOptionalContextSignals: [],
      interpretiveLinks: [linkEvidence],
    },
    summary: {
      headline: "Kandidat može pojačati koordinaciju ako se očekivanja rano ekspliciraju.",
      summary: "Signal kandidata se poredi s timskim ritmom i pokazuje konkretnu temu za razgovor.",
      evidence: sectionEvidence,
    },
    fitOverview: {
      relationshipPattern: "mixed_signal",
      headline: "Postoji kombinacija dopune i potencijalnog trenja.",
      summary: "Kandidatov strukturisan pristup može pomoći timu, ali tempo usklađivanja treba provjeriti.",
      evidence: sectionEvidence,
    },
    likelyTeamContribution: {
      items: [
        {
          title: "Strukturiranje dogovora",
          signal: "Kandidat preferira jasne radne okvire.",
          interpretation: "To može pomoći timu koji već koristi koordinirane ritmove rada.",
          recommendation: "Provjeriti kako kandidat uvodi strukturu bez usporavanja tima.",
          evidence: sectionEvidence,
        },
      ],
    },
    possibleFrictionPoints: {
      items: [
        {
          title: "Ritam povratne informacije",
          signal: "Kandidat traži eksplicitne dogovore.",
          interpretation: "U timu s brzim ad hoc odlukama to može otvoriti trenje.",
          recommendation: "U intervjuu provjeriti reakciju na nepotpune informacije.",
          evidence: sectionEvidence,
        },
      ],
    },
    teamConditionsThatImproveFit: {
      items: [
        {
          title: "Jasan početni okvir",
          signal: "Timski signal pokazuje korist od dogovorenih pravila saradnje.",
          interpretation: "Fit se poboljšava kada menadžer rano definiše očekivanja.",
          recommendation: "Postaviti 30-dnevni onboarding dogovor o ritmu check-ina.",
          evidence: sectionEvidence,
        },
      ],
    },
    interviewProbes: {
      items: [
        {
          question: "Opišite situaciju kada ste se morali brzo uskladiti s novim timom.",
          rationale: "Provjerava konkretnu kandidat-vs-team hipotezu o tempu usklađivanja.",
          whatToListenFor: ["Kako traži informacije", "Kako reaguje na nejasne prioritete"],
          evidence: sectionEvidence,
        },
      ],
    },
    onboardingAndManagerGuidance: {
      items: [
        {
          title: "Prve dvije sedmice",
          signal: "Kombinacija kandidatovog i timskog signala traži eksplicitan onboarding okvir.",
          interpretation: "Menadžer može smanjiti trenje jasnim dogovorima.",
          recommendation: "Dodijeliti vlasnika onboarding check-ina i sedmični ritam povratne informacije.",
          evidence: sectionEvidence,
        },
      ],
    },
    riskAndMitigationMap: {
      items: [
        {
          risk: "Neusklađen tempo donošenja odluka.",
          trigger: "Tim odlučuje brzo, a kandidat traži dodatno razjašnjenje.",
          mitigation: "Dogovoriti koje odluke traže dubinsko razjašnjenje, a koje ne.",
          owner: "manager",
          evidence: sectionEvidence,
        },
      ],
    },
    evidenceAppendix: {
      entries: sectionEvidence,
    },
    interpretationLimits: {
      limits: ["Report daje hipoteze za HR razgovor, ne odluku o zapošljavanju."],
      evidence: sectionEvidence,
    },
    metadata: {
      generatedAt: "2026-06-16T12:00:00.000Z",
      schemaVersion: "team_fit_report_v1_contract_shape",
    },
  };
}

function expectInvalid(snapshot, pattern, validator = validateTeamFitReportSnapshot) {
  const validation = validator(snapshot);
  assert.equal(validation.ok, false);
  assert.equal(validation.errors.some((error) => pattern.test(error)), true);
}

function main() {
  const valid = buildValidSnapshot();
  const validResult = validateTeamFitReportSnapshot(valid);

  assert.equal(validResult.ok, true);
  assert.equal(valid.reportType, TEAM_FIT_REPORT_TYPE);
  assert.deepEqual(TEAM_FIT_RELATIONSHIP_PATTERNS, [
    "alignment_signal",
    "complementarity_signal",
    "mixed_signal",
    "needs_validation",
  ]);

  const missingFitOverview = clone(valid);
  delete missingFitOverview.fitOverview;
  expectInvalid(missingFitOverview, /fitOverview/);

  const missingCandidateSignals = clone(valid);
  delete missingCandidateSignals.candidateSignals;
  expectInvalid(missingCandidateSignals, /candidateSignals/);

  const missingInterpretationLimits = clone(valid);
  delete missingInterpretationLimits.interpretationLimits;
  expectInvalid(missingInterpretationLimits, /interpretationLimits/);

  TEAM_FIT_RELATIONSHIP_PATTERNS.forEach((pattern) => {
    const sample = clone(valid);
    sample.fitOverview.relationshipPattern = pattern;
    assert.equal(validateTeamFitReportSnapshot(sample).ok, true);
  });

  const invalidRelationshipPattern = clone(valid);
  invalidRelationshipPattern.fitOverview.relationshipPattern = "strong_alignment_signal";
  expectInvalid(invalidRelationshipPattern, /relationshipPattern/);

  const fitScoreSnapshot = clone(valid);
  fitScoreSnapshot.fitScore = 0.82;
  expectInvalid(fitScoreSnapshot, /fitScore/);

  const hireScoreSnapshot = clone(valid);
  hireScoreSnapshot.hireScore = 91;
  expectInvalid(hireScoreSnapshot, /hireScore/);

  const hireRecommendationSnapshot = clone(valid);
  hireRecommendationSnapshot.hireRecommendation = "Proceed";
  expectInvalid(hireRecommendationSnapshot, /hireRecommendation/);

  const rejectRecommendationSnapshot = clone(valid);
  rejectRecommendationSnapshot.rejectRecommendation = "Do not proceed";
  expectInvalid(rejectRecommendationSnapshot, /rejectRecommendation/);

  const decisionRecommendationSnapshot = clone(valid);
  decisionRecommendationSnapshot.decisionRecommendation = "Advance";
  expectInvalid(decisionRecommendationSnapshot, /decisionRecommendation/);

  const rawAnswersSnapshot = clone(valid);
  rawAnswersSnapshot.rawAnswers = [{ item: "q1", answer: "x" }];
  expectInvalid(rawAnswersSnapshot, /rawAnswers/);

  const teamMemberScoresSnapshot = clone(valid);
  teamMemberScoresSnapshot.teamMemberScores = [{ memberId: "m1", score: 88 }];
  expectInvalid(teamMemberScoresSnapshot, /teamMemberScores/);

  const narrativeReportsSnapshot = clone(valid);
  narrativeReportsSnapshot.individualNarrativeReports = [{ memberId: "m1", text: "x" }];
  expectInvalid(narrativeReportsSnapshot, /individualNarrativeReports/);

  const candidateVisibleSnapshot = clone(valid);
  candidateVisibleSnapshot.candidateVisible = true;
  expectInvalid(candidateVisibleSnapshot, /candidateVisible/);

  const undefinedSnapshot = clone(valid);
  undefinedSnapshot.metadata.providerVersion = undefined;
  const undefinedResult = validateTeamFitReportSnapshot(undefinedSnapshot);
  assert.equal(undefinedResult.ok, false);
  assert.equal(undefinedResult.errors.some((error) => /undefined/.test(error)), true);

  const contractValid = buildValidContractSnapshot();
  const contractValidResult = validateTeamFitReportV1ContractSnapshot(contractValid);
  assert.equal(contractValidResult.ok, true);

  const wrongContractVersion = clone(contractValid);
  wrongContractVersion.contractVersion = "team_fit_report_v0";
  expectInvalid(wrongContractVersion, /contractVersion/, validateTeamFitReportV1ContractSnapshot);

  const missingRequiredSection = clone(contractValid);
  delete missingRequiredSection.possibleFrictionPoints;
  expectInvalid(missingRequiredSection, /possibleFrictionPoints/, validateTeamFitReportV1ContractSnapshot);

  const contractFitScore = clone(contractValid);
  contractFitScore.fitScore = 0.71;
  expectInvalid(contractFitScore, /fitScore/, validateTeamFitReportV1ContractSnapshot);

  const contractHireDecision = clone(contractValid);
  contractHireDecision.hireDecision = "hire";
  expectInvalid(contractHireDecision, /hireDecision/, validateTeamFitReportV1ContractSnapshot);

  const invalidEvidenceReference = clone(contractValid);
  delete invalidEvidenceReference.source.candidateDeepProfileSignals[0].sourceType;
  expectInvalid(
    invalidEvidenceReference,
    /source\.candidateDeepProfileSignals\[0\]\.sourceType/,
    validateTeamFitReportV1ContractSnapshot,
  );

  const sectionWithoutEvidence = clone(contractValid);
  sectionWithoutEvidence.summary.evidence = [];
  expectInvalid(sectionWithoutEvidence, /summary\.evidence/, validateTeamFitReportV1ContractSnapshot);

  const proseOnlyConcern = clone(contractValid);
  proseOnlyConcern.summary.summary = "This narrative mentions hire wording, but no structural decision field exists.";
  assert.equal(validateTeamFitReportV1ContractSnapshot(proseOnlyConcern).ok, true);

  console.log("test-team-fit-report-contract: ok");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
