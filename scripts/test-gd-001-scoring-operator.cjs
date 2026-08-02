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

function exactPersistedDimensions(candidateId = "GD-001") {
  return foundation.expectedScores.rows
    .filter(
      (row) =>
        row.values.candidate_id === candidateId &&
        row.values.score_scope === "persisted_dimension",
    )
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
assert.throws(() => parseGd001ScoringCli(["--apply"]), /explicit --candidate/);
assert.throws(() => parseGd001ScoringCli(["--candidate"]), /requires an explicit/);
assert.deepEqual(parseGd001ScoringCli(["--candidate", "GD-002"]), {
  mode: "dry-run",
  candidateId: "GD-002",
  verbose: false,
});
assert.deepEqual(parseGd001ScoringCli(["--candidate", "GD-003"]), {
  mode: "dry-run",
  candidateId: "GD-003",
  verbose: false,
});
assert.deepEqual(parseGd001ScoringCli(["--apply", "--candidate", "GD-003"]), {
  mode: "apply",
  candidateId: "GD-003",
  verbose: false,
});
assert.deepEqual(parseGd001ScoringCli(["--candidate", "GD-004"]), {
  mode: "dry-run",
  candidateId: "GD-004",
  verbose: false,
});
assert.deepEqual(parseGd001ScoringCli(["--apply", "--candidate", "GD-005"]), {
  mode: "apply",
  candidateId: "GD-005",
  verbose: false,
});
assert.throws(() => parseGd001ScoringCli(["--candidate", "GD-019"]), /Only GD-001, GD-002, GD-003, GD-004, GD-005/);
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
const gd002ExactScores = exactPersistedDimensions("GD-002");
assert.equal(gd002ExactScores.length, 40);
const gd002ExactVerification = verifyPersistedGd001Scores({
  foundation,
  dimensionScores: gd002ExactScores,
  candidateId: "GD-002",
});
assert.equal(gd002ExactVerification.ok, true);
assert.equal(gd002ExactVerification.matched, 47);
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

const gd002AttemptIds = {
  "ipip-neo-120-v1": "3608daff-684c-42e1-b83f-6cc5a9b27d23",
  safran_v1: "8b6fb680-550a-4a4f-b795-8f1aed31e5c8",
  mwms_v1: "e2986bb4-3b13-4797-a120-5e6e6a0c778f",
};
const gd002Unscored = {
  ...unscoredSnapshot(),
  participantId: "1bbeff4d-e77d-4442-b69d-5d30bb4f608e",
  assignmentId: "45cf751d-08ae-4dc0-ba7e-73533e348d31",
  attemptIds: gd002AttemptIds,
};
const gd002UnscoredClassification = classifyGd001ScoringState({
  snapshot: gd002Unscored,
  verification: verifyPersistedGd001Scores({
    foundation,
    dimensionScores: [],
    candidateId: "GD-002",
  }),
  candidateId: "GD-002",
});
assert.equal(gd002UnscoredClassification.state, "UNSCORED_EXACT");

const gd002Scored = {
  ...scoredSnapshot(),
  participantId: gd002Unscored.participantId,
  assignmentId: gd002Unscored.assignmentId,
  attemptIds: gd002AttemptIds,
  dimensionScores: gd002ExactScores,
};
const gd002ScoredClassification = classifyGd001ScoringState({
  snapshot: gd002Scored,
  verification: gd002ExactVerification,
  candidateId: "GD-002",
});
assert.equal(gd002ScoredClassification.state, "SCORED_EXACT");

const gd003AttemptIds = {
  "ipip-neo-120-v1": "423ecf59-c3a2-498b-8cb7-1dd82a867b5f",
  safran_v1: "374a4ce8-1531-4d1d-8c76-58613d025b0d",
  mwms_v1: "ee81a3ea-4163-49fc-8234-f71882a5716f",
};
const gd003Unscored = {
  ...unscoredSnapshot(),
  participantId: "a7b7f687-0daf-42ce-95c1-ee9053f35056",
  assignmentId: "d0b23f90-cb71-4c0d-bcd3-dc21d282e9d2",
  attemptIds: gd003AttemptIds,
};
assert.equal(gd003Unscored.fixtureState, "EXACT_MATCH");
assert.equal(gd003Unscored.structuralFixtureExact, true);
assert.deepEqual(gd003Unscored.attemptIds, gd003AttemptIds);
assert.equal(gd003Unscored.attempts.length, 3);
assert.equal(Object.values(gd003Unscored.responseCounts).reduce((sum, count) => sum + count, 0), 184);
assert.equal(Object.values(gd003Unscored.rawValueCounts).reduce((sum, count) => sum + count, 0), 0);
assert.equal(Object.values(gd003Unscored.scoredValueCounts).reduce((sum, count) => sum + count, 0), 0);
assert.equal(gd003Unscored.dimensionScores.length, 0);
assert.equal(gd003Unscored.attemptReportCount, 0);
assert.equal(gd003Unscored.assessmentReportCount, 0);
const gd003UnscoredVerification = verifyPersistedGd001Scores({
  foundation,
  dimensionScores: [],
  candidateId: "GD-003",
});
assert.equal(gd003UnscoredVerification.ok, false);
assert.equal(gd003UnscoredVerification.matched, 0);
assert.equal(gd003UnscoredVerification.expected, 47);
const gd003UnscoredClassification = classifyGd001ScoringState({
  snapshot: gd003Unscored,
  verification: gd003UnscoredVerification,
  candidateId: "GD-003",
});
assert.equal(gd003UnscoredClassification.fixtureWriterState, "EXACT_MATCH");
assert.equal(gd003UnscoredClassification.fixtureCompatibilityState, "EXACT_MATCH");
assert.equal(gd003UnscoredClassification.scoringState, "UNSCORED_EXACT");
assert.equal(gd003UnscoredClassification.state, "UNSCORED_EXACT");
assert.deepEqual(gd003UnscoredClassification.blockers, []);

const gd003ExactScores = exactPersistedDimensions("GD-003");
assert.equal(gd003ExactScores.length, 40);
const gd003ExactVerification = verifyPersistedGd001Scores({
  foundation,
  dimensionScores: gd003ExactScores,
  candidateId: "GD-003",
});
assert.equal(gd003ExactVerification.ok, true);
assert.equal(gd003ExactVerification.matched, 47);
assert.equal(gd003ExactVerification.expected, 47);
assert.deepEqual(gd003ExactVerification.errors, []);
const gd003Scored = {
  ...scoredSnapshot(),
  participantId: gd003Unscored.participantId,
  assignmentId: gd003Unscored.assignmentId,
  attemptIds: gd003AttemptIds,
  dimensionScores: gd003ExactScores,
};
assert.equal(gd003Scored.attempts.length, 3);
assert.equal(Object.values(gd003Scored.rawValueCounts).reduce((sum, count) => sum + count, 0), 184);
assert.equal(Object.values(gd003Scored.scoredValueCounts).reduce((sum, count) => sum + count, 0), 184);
assert.equal(gd003Scored.dimensionScores.length, 40);
assert.equal(gd003Scored.attemptReportCount, 0);
assert.equal(gd003Scored.assessmentReportCount, 0);
const gd003ScoredClassification = classifyGd001ScoringState({
  snapshot: gd003Scored,
  verification: gd003ExactVerification,
  candidateId: "GD-003",
});
assert.equal(gd003ScoredClassification.fixtureWriterState, "CONFLICT");
assert.equal(gd003ScoredClassification.fixtureCompatibilityState, "EXACT_MATCH");
assert.equal(gd003ScoredClassification.scoringState, "SCORED_EXACT");
assert.equal(gd003ScoredClassification.state, "SCORED_EXACT");
assert.deepEqual(gd003ScoredClassification.blockers, []);

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
  assert.equal(result.writesPerformed, true);
  assert.equal(result.scoringExecution, true);
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

  let gd002ProductionCalls = 0;
  let gd002PostChecks = 0;
  const gd002Result = await executeGd001ScoringApply({
    snapshot: gd002Unscored,
    classification: gd002UnscoredClassification,
    runProductionScoring: async () => {
      gd002ProductionCalls += 1;
    },
    inspectAfter: async () => {
      gd002PostChecks += 1;
      return { snapshot: gd002Scored, verification: gd002ExactVerification };
    },
  });
  assert.equal(gd002Result.stateBefore, "UNSCORED_EXACT");
  assert.equal(gd002Result.stateAfter, "SCORED_EXACT");
  assert.equal(gd002Result.participantId, gd002Unscored.participantId);
  assert.equal(gd002Result.assignmentId, gd002Unscored.assignmentId);
  assert.deepEqual(gd002Result.attemptIds, gd002AttemptIds);
  assert.equal(gd002Result.expectedScoreVerification.matched, 47);
  assert.equal(gd002Result.writesPerformed, true);
  assert.equal(gd002Result.scoringExecution, true);
  assert.equal(gd002Result.reportGeneration, false);
  assert.equal(gd002Result.openAiCalls, false);
  assert.equal(gd002ProductionCalls, 1);
  assert.equal(gd002PostChecks, 1);

  let gd003ProductionCalls = 0;
  let gd003PostChecks = 0;
  const gd003Result = await executeGd001ScoringApply({
    snapshot: gd003Unscored,
    classification: gd003UnscoredClassification,
    runProductionScoring: async () => {
      gd003ProductionCalls += 1;
    },
    inspectAfter: async () => {
      gd003PostChecks += 1;
      return { snapshot: gd003Scored, verification: gd003ExactVerification };
    },
  });
  assert.equal(gd003Result.stateBefore, "UNSCORED_EXACT");
  assert.equal(gd003Result.stateAfter, "SCORED_EXACT");
  assert.equal(gd003Result.participantId, gd003Unscored.participantId);
  assert.equal(gd003Result.assignmentId, gd003Unscored.assignmentId);
  assert.deepEqual(gd003Result.attemptIds, gd003AttemptIds);
  assert.equal(gd003Result.writesPerformed, true);
  assert.equal(gd003Result.scoringExecution, true);
  assert.equal(gd003Result.reportGeneration, false);
  assert.equal(gd003Result.openAiCalls, false);
  assert.equal(gd003Result.expectedScoreVerification.matched, 47);
  assert.equal(gd003ProductionCalls, 1);
  assert.equal(gd003PostChecks, 1);

  const gd002Partial = {
    ...gd002Unscored,
    attempts: gd002Unscored.attempts.map((attempt, index) =>
      index === 0
        ? { ...attempt, status: "completed", completedAt: "2026-08-01T00:00:00.000Z" }
        : attempt,
    ),
    rawValueCounts: { ...gd002Unscored.rawValueCounts, "ipip-neo-120-v1": 120 },
    scoredValueCounts: { ...gd002Unscored.scoredValueCounts, "ipip-neo-120-v1": 120 },
  };
  const gd002PartialClassification = classifyGd001ScoringState({
    snapshot: gd002Partial,
    verification: gd002UnscoredClassification.verification,
    candidateId: "GD-002",
  });
  assert.equal(gd002PartialClassification.state, "PARTIAL");
  await assert.rejects(
    executeGd001ScoringApply({
      snapshot: gd002Partial,
      classification: gd002PartialClassification,
      runProductionScoring: async () => {
        gd002ProductionCalls += 1;
      },
      inspectAfter: async () => ({ snapshot: gd002Scored, verification: gd002ExactVerification }),
    }),
    /blocked/,
  );
  assert.equal(gd002ProductionCalls, 1);

  const gd002ReportState = { ...gd002Unscored, attemptReportCount: 1 };
  const gd002ReportClassification = classifyGd001ScoringState({
    snapshot: gd002ReportState,
    verification: gd002UnscoredClassification.verification,
    candidateId: "GD-002",
  });
  await assert.rejects(
    executeGd001ScoringApply({
      snapshot: gd002ReportState,
      classification: gd002ReportClassification,
      runProductionScoring: async () => {
        gd002ProductionCalls += 1;
      },
      inspectAfter: async () => ({ snapshot: gd002Scored, verification: gd002ExactVerification }),
    }),
    /blocked/,
  );
  assert.equal(gd002ProductionCalls, 1);

  await assert.rejects(
    executeGd001ScoringApply({
      snapshot: gd002Unscored,
      classification: gd002UnscoredClassification,
      runProductionScoring: async () => {
        gd002ProductionCalls += 1;
      },
      inspectAfter: async () => ({ snapshot: gd002Unscored, verification: gd002UnscoredClassification.verification }),
    }),
    /Post-scoring verification requires SCORED_EXACT/,
  );
  assert.equal(gd002ProductionCalls, 2);

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
  assert.match(operatorSource, /getGoldenDemoCandidateContract/);
  assert.match(operatorSource, /candidateId: candidate\.candidateId/);
  assert.match(operatorSource, /\["GD-002", "GD-003"\]\.includes\(resolved\.candidate\.candidateId\)/);
  assert.match(operatorSource, /attempt\.addressing_form_snapshot === resolved\.candidate\.addressingForm/);
  assert.doesNotMatch(operatorSource, /resolved\.candidate\.candidateId === "GD-002"\s*&&\s*participant\.addressing_form === null/);
  for (const forbidden of ["raw_value:", "scored_value:", "dimension_scores\")\.insert"] ) {
    assert.equal(operatorSource.includes(forbidden), false, `operator must not directly write ${forbidden}`);
  }

  process.stdout.write("GD-001 scoring operator offline tests passed.\n");
})().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
