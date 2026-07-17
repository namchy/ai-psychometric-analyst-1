const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const projectRoot = path.resolve(__dirname, "..");
const { loadGoldenDemoCsvFoundation } = require("../lib/golden-demo/csv-loader.ts");
const {
  buildGd001ScoringPlan,
  classifyGd001ScoringState,
  executeGd001ScoringApply,
  parseGd001ScoringCli,
  verifyPersistedGd001Scores,
} = require("../lib/golden-demo/gd-001-scoring-operator.ts");
const { redactSecrets } = require("./write-gd-001-db-fixture.cjs");

const foundation = loadGoldenDemoCsvFoundation(projectRoot);
const slugs = ["ipip-neo-120-v1", "safran_v1", "mwms_v1"];

function counts(ipip, safran, mwms) {
  return { "ipip-neo-120-v1": ipip, safran_v1: safran, mwms_v1: mwms };
}

function unscoredSnapshot() {
  return {
    fixtureState: "EXACT_MATCH",
    fixtureBlockers: [],
    structuralFixtureExact: true,
    participantId: "participant-runtime-id",
    assignmentId: "assignment-runtime-id",
    attemptIds: Object.fromEntries(slugs.map((slug) => [slug, `attempt:${slug}`])),
    attempts: slugs.map((testSlug) => ({
      testSlug,
      status: "in_progress",
      completedAt: null,
      scoredStartedAt: null,
    })),
    responseCounts: counts(120, 45, 19),
    rawValueCounts: counts(0, 0, 0),
    scoredValueCounts: counts(0, 0, 0),
    dimensionScores: [],
    attemptReportCount: 0,
    assessmentReportCount: 0,
  };
}

function exactPersistedDimensions() {
  return foundation.expectedScores.rows
    .filter((row) => row.values.score_scope === "persisted_dimension")
    .map((row) => ({
      testSlug: row.values.test_slug,
      dimension: row.values.score_key,
      rawScore: Number(row.values.expected_value),
    }));
}

function scoredSnapshot() {
  return {
    ...unscoredSnapshot(),
    fixtureState: "CONFLICT",
    fixtureBlockers: ["Attempts have entered scoring lifecycle."],
    attempts: slugs.map((testSlug) => ({
      testSlug,
      status: "completed",
      completedAt: "2026-07-17T12:00:00.000Z",
      scoredStartedAt: null,
    })),
    rawValueCounts: counts(120, 45, 19),
    scoredValueCounts: counts(120, 45, 19),
    dimensionScores: exactPersistedDimensions(),
  };
}

assert.deepEqual(parseGd001ScoringCli([]), {
  mode: "dry-run",
  candidateId: "GD-001",
  verbose: false,
});
assert.equal(parseGd001ScoringCli(["--dry-run", "--verbose"]).verbose, true);
assert.throws(() => parseGd001ScoringCli(["--apply"]), /--candidate GD-001/);
assert.throws(
  () => parseGd001ScoringCli(["--apply", "--candidate", "GD-002"]),
  /GD-001/,
);
for (const flag of ["--delete", "--cleanup", "--reset", "--force", "--overwrite"]) {
  assert.throws(() => parseGd001ScoringCli([flag]), /separate operator task/);
}

const emptyVerification = verifyPersistedGd001Scores({ foundation, dimensionScores: [] });
const unscored = unscoredSnapshot();
const unscoredClassification = classifyGd001ScoringState({
  snapshot: unscored,
  verification: emptyVerification,
});
assert.equal(unscoredClassification.state, "UNSCORED_EXACT");
assert.equal(unscoredClassification.fixtureWriterState, "EXACT_MATCH");
assert.equal(unscoredClassification.fixtureCompatibilityState, "EXACT_MATCH");
assert.equal(unscoredClassification.scoringState, "UNSCORED_EXACT");
const unscoredPlan = buildGd001ScoringPlan({
  mode: "dry-run",
  snapshot: unscored,
  classification: unscoredClassification,
  verification: emptyVerification,
});
assert.deepEqual(unscoredPlan.plannedProductionScoringSteps.map((step) => step.testSlug), slugs);
assert.equal(
  unscoredPlan.scoringExecution,
  false,
);

const fixtureConflict = unscoredSnapshot();
fixtureConflict.fixtureState = "CONFLICT";
fixtureConflict.fixtureBlockers = ["fixture mismatch"];
assert.equal(
  classifyGd001ScoringState({ snapshot: fixtureConflict, verification: emptyVerification }).state,
  "CONFLICT",
);

const partial = unscoredSnapshot();
partial.attempts[0] = {
  ...partial.attempts[0],
  status: "completed",
  completedAt: "2026-07-17T12:00:00.000Z",
};
partial.rawValueCounts["ipip-neo-120-v1"] = 120;
partial.scoredValueCounts["ipip-neo-120-v1"] = 120;
assert.equal(
  classifyGd001ScoringState({ snapshot: partial, verification: emptyVerification }).state,
  "PARTIAL",
);

const exactScores = exactPersistedDimensions();
assert.equal(exactScores.length, 40);
const exactVerification = verifyPersistedGd001Scores({
  foundation,
  dimensionScores: exactScores,
});
assert.equal(exactVerification.ok, true);
assert.equal(exactVerification.matched, 47);
const scored = scoredSnapshot();
const scoredClassification = classifyGd001ScoringState({
  snapshot: scored,
  verification: exactVerification,
});
assert.equal(scoredClassification.state, "SCORED_EXACT");
assert.equal(scoredClassification.fixtureWriterState, "CONFLICT");
assert.equal(scoredClassification.fixtureCompatibilityState, "EXACT_MATCH");
assert.equal(scoredClassification.scoringState, "SCORED_EXACT");
assert.deepEqual(scoredClassification.blockers, []);
const scoredPlan = buildGd001ScoringPlan({
  mode: "dry-run",
  snapshot: scored,
  classification: scoredClassification,
  verification: exactVerification,
});
assert.deepEqual(scoredPlan.plannedProductionScoringSteps, []);
assert.equal(scoredPlan.fixtureWriterState, "CONFLICT");
assert.equal(scoredPlan.fixtureCompatibilityState, "EXACT_MATCH");

const mismatchedScores = exactPersistedDimensions();
mismatchedScores[0] = { ...mismatchedScores[0], rawScore: mismatchedScores[0].rawScore + 1 };
const mismatch = verifyPersistedGd001Scores({ foundation, dimensionScores: mismatchedScores });
assert.equal(mismatch.ok, false);
assert.match(mismatch.errors.join(" "), /mismatch/i);
assert.equal(
  classifyGd001ScoringState({ snapshot: scored, verification: mismatch }).state,
  "CONFLICT",
);
{
  const changedAnswer = scoredSnapshot();
  changedAnswer.structuralFixtureExact = false;
  const changedClassification = classifyGd001ScoringState({
    snapshot: changedAnswer,
    verification: exactVerification,
  });
  assert.equal(changedClassification.fixtureCompatibilityState, "CONFLICT");
  assert.notEqual(changedClassification.scoringState, "SCORED_EXACT");
}
{
  const missingResponse = scoredSnapshot();
  missingResponse.responseCounts["ipip-neo-120-v1"] = 119;
  const missingClassification = classifyGd001ScoringState({
    snapshot: missingResponse,
    verification: exactVerification,
  });
  assert.ok(["PARTIAL", "CONFLICT"].includes(missingClassification.fixtureCompatibilityState));
  assert.notEqual(missingClassification.scoringState, "SCORED_EXACT");
}
{
  const reportState = scoredSnapshot();
  reportState.attemptReportCount = 1;
  const reportClassification = classifyGd001ScoringState({
    snapshot: reportState,
    verification: exactVerification,
  });
  assert.equal(reportClassification.fixtureCompatibilityState, "CONFLICT");
  assert.notEqual(reportClassification.scoringState, "SCORED_EXACT");
}

(async () => {
  let productionCalls = 0;
  let postChecks = 0;
  const result = await executeGd001ScoringApply({
    snapshot: unscored,
    classification: unscoredClassification,
    runProductionScoring: async () => {
      productionCalls += 1;
    },
    inspectAfter: async () => {
      postChecks += 1;
      return { snapshot: scored, verification: exactVerification };
    },
  });
  assert.equal(result.stateAfter, "SCORED_EXACT");
  assert.equal(productionCalls, 1);
  assert.equal(postChecks, 1);
  assert.equal(result.reportGeneration, false);
  assert.equal(result.openAiCalls, false);

  productionCalls = 0;
  const noop = await executeGd001ScoringApply({
    snapshot: scored,
    classification: scoredClassification,
    runProductionScoring: async () => {
      productionCalls += 1;
    },
    inspectAfter: async () => {
      throw new Error("noop must not inspect after");
    },
  });
  assert.equal(noop.writesPerformed, false);
  assert.equal(productionCalls, 0);

  const changedAnswer = scoredSnapshot();
  changedAnswer.structuralFixtureExact = false;
  const changedClassification = classifyGd001ScoringState({
    snapshot: changedAnswer,
    verification: exactVerification,
  });
  await assert.rejects(
    executeGd001ScoringApply({
      snapshot: changedAnswer,
      classification: changedClassification,
      runProductionScoring: async () => {
        productionCalls += 1;
      },
      inspectAfter: async () => ({ snapshot: scored, verification: exactVerification }),
    }),
    /blocked/,
  );
  assert.equal(productionCalls, 0);

  for (const blocked of [
    classifyGd001ScoringState({ snapshot: partial, verification: emptyVerification }),
    classifyGd001ScoringState({ snapshot: fixtureConflict, verification: emptyVerification }),
  ]) {
    await assert.rejects(
      executeGd001ScoringApply({
        snapshot: blocked.state === "PARTIAL" ? partial : fixtureConflict,
        classification: blocked,
        runProductionScoring: async () => {
          productionCalls += 1;
        },
        inspectAfter: async () => ({ snapshot: scored, verification: exactVerification }),
      }),
      /blocked/,
    );
  }
  assert.equal(productionCalls, 0);

  const secret = "service-role-secret-example";
  assert.equal(redactSecrets(`failure ${secret}`, { SUPABASE_SERVICE_ROLE_KEY: secret }), "failure [SUPABASE_SERVICE_ROLE_KEY]");

  const operatorSource = fs.readFileSync(path.join(projectRoot, "scripts/score-gd-001.cjs"), "utf8");
  assert.match(operatorSource, /persistCompletedAssessmentResults/);
  assert.match(operatorSource, /loadAssessmentCompletionState/);
  assert.doesNotMatch(operatorSource, /orchestrateReportsAfterAttemptCompletion\s*\(/);
  assert.doesNotMatch(operatorSource, /enqueueCompletedAssessmentReports\s*\(/);
  assert.doesNotMatch(operatorSource, /OpenAI\s*\(/);
  for (const forbidden of ["raw_value:", "scored_value:", "dimension_scores\")\.insert"] ) {
    assert.equal(operatorSource.includes(forbidden), false, `operator must not directly write ${forbidden}`);
  }

  process.stdout.write("GD-001 scoring operator offline tests passed.\n");
})().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
