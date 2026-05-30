const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const helperPath = path.join(projectRoot, "lib", "b2b", "team-fit-report-contract.ts");
const helperSource = fs.readFileSync(helperPath, "utf8");
const todoPath = path.join(projectRoot, "docs", "deep-profile-todo.md");
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
assert.match(helperSource, /TEAM_FIT_RELATIONSHIP_PATTERNS/);
assert.match(helperSource, /validateTeamFitReportSnapshot/);
assert.doesNotMatch(helperSource, /\.from\("/);
assert.doesNotMatch(helperSource, /OpenAI|renderer|worker/i);
assert.doesNotMatch(helperSource, /team-fit-report-input|team-fit-report-lifecycle/);

const {
  TEAM_FIT_REPORT_TYPE,
  TEAM_FIT_REPORT_VERSION,
  TEAM_FIT_RELATIONSHIP_PATTERNS,
  validateTeamFitReportSnapshot,
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

function expectInvalid(snapshot, pattern) {
  const validation = validateTeamFitReportSnapshot(snapshot);
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

  const forbiddenHireWording = clone(valid);
  forbiddenHireWording.fitOverview.summary = "This should drive a hire decision.";
  expectInvalid(forbiddenHireWording, /forbiddenText/);

  const forbiddenBadFitWording = clone(valid);
  forbiddenBadFitWording.watchouts = ["bad fit risk"]; 
  expectInvalid(forbiddenBadFitWording, /forbiddenText/);

  const forbiddenCultureFitWording = clone(valid);
  forbiddenCultureFitWording.teamContextSummary.relevantTeamPatterns[0].summary = "culture fit signal";
  expectInvalid(forbiddenCultureFitWording, /forbiddenText/);

  const forbiddenWillPerformWording = clone(valid);
  forbiddenWillPerformWording.complementaritySignals[0].summary = "Candidate will perform above the team baseline.";
  expectInvalid(forbiddenWillPerformWording, /forbiddenText/);

  const forbiddenDiagnosisWording = clone(valid);
  forbiddenDiagnosisWording.watchouts = ["diagnosis is implied"]; 
  expectInvalid(forbiddenDiagnosisWording, /forbiddenText/);

  const undefinedSnapshot = clone(valid);
  undefinedSnapshot.metadata.providerVersion = undefined;
  const undefinedResult = validateTeamFitReportSnapshot(undefinedSnapshot);
  assert.equal(undefinedResult.ok, false);
  assert.equal(undefinedResult.errors.some((error) => /undefined/.test(error)), true);

  const todoSource = fs.readFileSync(todoPath, "utf8");
  assert.match(todoSource, /Completion note — Team Fit contract\/validator shell/);

  console.log("test-team-fit-report-contract: ok");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
