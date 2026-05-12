const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
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
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  buildCompositeHrInputSnapshotFromLoadedData,
  COMPOSITE_HR_INPUT_CONTRACT_VERSION,
  COMPOSITE_HR_REPORT_CONTRACT_VERSION,
} = require("../lib/assessment/composite-input.ts");

function buildAssignment(overrides = {}) {
  return {
    id: "assignment-1",
    organization_id: "org-1",
    participant_id: "participant-1",
    assignment_type: "standard_battery",
    status: "active",
    locale: "hr",
    created_at: "2026-05-12T10:00:00.000Z",
    ...overrides,
  };
}

function buildPreparedAttempt({
  attemptId,
  testId,
  testSlug,
  position,
  status = "completed",
  completedAt = "2026-05-12T10:30:00.000Z",
  requiredForComposite = true,
  requiredForTeamFit = false,
  results,
}) {
  return {
    assessmentAssignmentId: "assignment-1",
    attemptId,
    testId,
    testSlug,
    status,
    completedAt,
    requiredForComposite,
    requiredForTeamFit,
    position,
    results,
  };
}

function buildIpipResults() {
  const facetScores = [
    ["FRIENDLINESS", 24],
    ["GREGARIOUSNESS", 20],
    ["ASSERTIVENESS", 18],
    ["ACTIVITY_LEVEL", 23],
    ["EXCITEMENT_SEEKING", 17],
    ["CHEERFULNESS", 25],
    ["TRUST", 21],
    ["MORALITY", 22],
    ["ALTRUISM", 23],
    ["COOPERATION", 19],
    ["MODESTY", 18],
    ["SYMPATHY", 24],
    ["SELF_EFFICACY", 25],
    ["ORDERLINESS", 23],
    ["DUTIFULNESS", 24],
    ["ACHIEVEMENT_STRIVING", 22],
    ["SELF_DISCIPLINE", 21],
    ["CAUTIOUSNESS", 20],
    ["ANXIETY", 10],
    ["ANGER", 11],
    ["DEPRESSION", 9],
    ["SELF_CONSCIOUSNESS", 12],
    ["IMMODERATION", 13],
    ["VULNERABILITY", 10],
    ["IMAGINATION", 23],
    ["ARTISTIC_INTERESTS", 22],
    ["EMOTIONALITY", 20],
    ["ADVENTUROUSNESS", 24],
    ["INTELLECT", 25],
    ["LIBERALISM", 21],
  ];

  return {
    attemptId: "attempt-ipip",
    scoringMethod: "likert",
    dimensions: facetScores.map(([dimension, rawScore]) => ({
      dimension,
      rawScore,
      scoredQuestionCount: 6,
    })),
    scoredResponseCount: 120,
    unscoredResponses: [],
  };
}

function buildSafranResults() {
  return {
    attemptId: "attempt-safran",
    scoringMethod: "correct_answers",
    dimensions: [],
    scoredResponseCount: 54,
    unscoredResponses: [],
    derived: {
      safranV1: {
        verbalScore: 14,
        figuralScore: 10,
        numericalRawScore: 15,
        numericalAdjustedScore: 12,
        numericalScore: 12,
        numericalSeriesScore: 12,
        cognitiveCompositeScore: 36,
        cognitiveCompositeV1: 36,
      },
    },
  };
}

function buildMwmsResults() {
  return {
    attemptId: "attempt-mwms",
    scoringMethod: "likert",
    dimensions: [
      { dimension: "intrinsic", rawScore: 6.2, scoredQuestionCount: 1 },
      { dimension: "identified", rawScore: 5.8, scoredQuestionCount: 1 },
      { dimension: "introjected", rawScore: 3.9, scoredQuestionCount: 1 },
      { dimension: "external_social", rawScore: 3.1, scoredQuestionCount: 1 },
      { dimension: "external_material", rawScore: 4.2, scoredQuestionCount: 1 },
      { dimension: "amotivation", rawScore: 1.8, scoredQuestionCount: 1 },
    ],
    scoredResponseCount: 18,
    unscoredResponses: [],
  };
}

function main() {
  const assignment = buildAssignment();
  const snapshot = buildCompositeHrInputSnapshotFromLoadedData({
    assignment,
    locale: "hr",
    builtAt: "2026-05-12T11:00:00.000Z",
    linkedAttempts: [
      buildPreparedAttempt({
        attemptId: "attempt-ipip",
        testId: "test-ipip",
        testSlug: "ipip-neo-120-v1",
        position: 0,
        results: buildIpipResults(),
      }),
      buildPreparedAttempt({
        attemptId: "attempt-safran",
        testId: "test-safran",
        testSlug: "safran_v1",
        position: 1,
        results: buildSafranResults(),
      }),
      buildPreparedAttempt({
        attemptId: "attempt-mwms",
        testId: "test-mwms",
        testSlug: "mwms_v1",
        position: 2,
        results: buildMwmsResults(),
      }),
    ],
  });

  assert.equal(snapshot.contractVersion, COMPOSITE_HR_INPUT_CONTRACT_VERSION);
  assert.equal(snapshot.targetReportContractVersion, COMPOSITE_HR_REPORT_CONTRACT_VERSION);
  assert.equal(snapshot.sourceType, "assessment");
  assert.equal(snapshot.audience, "hr");
  assert.equal(snapshot.locale, "hr");
  assert.equal(snapshot.assessmentAssignment.id, "assignment-1");
  assert.equal(snapshot.sourceAttempts.length, 3);
  assert.deepEqual(snapshot.coverage.requiredTestSlugs, [
    "ipip-neo-120-v1",
    "safran_v1",
    "mwms_v1",
  ]);
  assert.deepEqual(snapshot.coverage.completedTestSlugs, [
    "ipip-neo-120-v1",
    "safran_v1",
    "mwms_v1",
  ]);
  assert.equal(snapshot.coverage.missingTestSlugs.length, 0);
  assert.equal(snapshot.guardrails.usesOnlyLinkedAssignmentAttempts, true);
  assert.equal(snapshot.guardrails.usesHistoricalAttemptFallback, false);
  assert.equal(snapshot.guardrails.usesSingleTestAiReportsAsPrimaryInput, false);
  assert.equal(snapshot.guardrails.aiMayNotChangeScores, true);
  assert.equal(snapshot.metadata.builtAt, "2026-05-12T11:00:00.000Z");
  assert.equal(snapshot.metadata.builderVersion, "v1");

  assert.equal(snapshot.deterministicInputs.ipip.attemptId, "attempt-ipip");
  assert.equal(snapshot.deterministicInputs.ipip.testSlug, "ipip-neo-120-v1");
  assert.equal(snapshot.deterministicInputs.ipip.domains.length, 5);
  assert.equal(snapshot.deterministicInputs.ipip.domains[0].facets.length, 6);
  assert.equal(snapshot.deterministicInputs.ipip.summarySignals.highestDomains.length >= 1, true);
  assert.equal(snapshot.summarySignals.personalityHighestDomains.length >= 1, true);

  assert.equal(snapshot.deterministicInputs.safran.attemptId, "attempt-safran");
  assert.equal(snapshot.deterministicInputs.safran.testSlug, "safran_v1");
  assert.equal(snapshot.deterministicInputs.safran.overall.rawScore, 36);
  assert.equal(snapshot.deterministicInputs.safran.verbal.rawScore, 14);
  assert.equal(snapshot.deterministicInputs.safran.summarySignals.strongestDomain, "verbal");

  assert.equal(snapshot.deterministicInputs.mwms.attemptId, "attempt-mwms");
  assert.equal(snapshot.deterministicInputs.mwms.testSlug, "mwms_v1");
  assert.equal(snapshot.deterministicInputs.mwms.dimensions.length, 6);
  assert.equal(snapshot.deterministicInputs.mwms.summarySignals.dominantDrivers.length, 2);
  assert.equal(snapshot.summarySignals.motivationHighestDrivers.length, 2);

  const serializedSnapshot = JSON.stringify(snapshot);
  assert.equal(serializedSnapshot.includes("attempt_reports"), false);
  assert.equal(serializedSnapshot.includes("executiveSummary"), false);
  assert.equal(serializedSnapshot.includes("narrative"), false);

  const noHistoricalFallbackSnapshot = buildCompositeHrInputSnapshotFromLoadedData({
    assignment,
    linkedAttempts: [
      buildPreparedAttempt({
        attemptId: "attempt-ipip-linked",
        testId: "test-ipip",
        testSlug: "ipip-neo-120-v1",
        position: 0,
        results: buildIpipResults(),
      }),
      buildPreparedAttempt({
        attemptId: "attempt-safran-linked",
        testId: "test-safran",
        testSlug: "safran_v1",
        position: 1,
        results: buildSafranResults(),
      }),
      buildPreparedAttempt({
        attemptId: "attempt-mwms-linked",
        testId: "test-mwms",
        testSlug: "mwms_v1",
        position: 2,
        results: buildMwmsResults(),
      }),
    ],
  });
  assert.deepEqual(
    noHistoricalFallbackSnapshot.sourceAttempts.map((attempt) => attempt.attemptId),
    ["attempt-ipip-linked", "attempt-safran-linked", "attempt-mwms-linked"],
  );

  assert.throws(
    () =>
      buildCompositeHrInputSnapshotFromLoadedData({
        assignment,
        linkedAttempts: [
          buildPreparedAttempt({
            attemptId: "attempt-ipip",
            testId: "test-ipip",
            testSlug: "ipip-neo-120-v1",
            position: 0,
            results: buildIpipResults(),
          }),
          buildPreparedAttempt({
            attemptId: "attempt-safran",
            testId: "test-safran",
            testSlug: "safran_v1",
            position: 1,
            results: buildSafranResults(),
          }),
        ],
      }),
    /requires ready linked attempts/i,
  );

  assert.throws(
    () =>
      buildCompositeHrInputSnapshotFromLoadedData({
        assignment,
        linkedAttempts: [
          buildPreparedAttempt({
            attemptId: "attempt-ipip",
            testId: "test-ipip",
            testSlug: "ipip-neo-120-v1",
            position: 0,
            results: buildIpipResults(),
          }),
          buildPreparedAttempt({
            attemptId: "attempt-safran",
            testId: "test-safran",
            testSlug: "safran_v1",
            position: 1,
            results: buildSafranResults(),
          }),
          buildPreparedAttempt({
            attemptId: "attempt-mwms",
            testId: "test-mwms",
            testSlug: "mwms_v1",
            position: 2,
            status: "in_progress",
            completedAt: null,
            results: buildMwmsResults(),
          }),
        ],
      }),
    /requires ready linked attempts/i,
  );

  const localeFallbackSnapshot = buildCompositeHrInputSnapshotFromLoadedData({
    assignment: buildAssignment({ locale: "en" }),
    linkedAttempts: [
      buildPreparedAttempt({
        attemptId: "attempt-ipip",
        testId: "test-ipip",
        testSlug: "ipip-neo-120-v1",
        position: 0,
        results: buildIpipResults(),
      }),
      buildPreparedAttempt({
        attemptId: "attempt-safran",
        testId: "test-safran",
        testSlug: "safran_v1",
        position: 1,
        results: buildSafranResults(),
      }),
      buildPreparedAttempt({
        attemptId: "attempt-mwms",
        testId: "test-mwms",
        testSlug: "mwms_v1",
        position: 2,
        results: buildMwmsResults(),
      }),
    ],
  });
  assert.equal(localeFallbackSnapshot.locale, "en");

  console.log("Composite input builder tests passed.");
}

main();
