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
  if (request === "server-only" || request === "@/lib/supabase/admin") {
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

const lifecycleSource = fs.readFileSync(
  path.join(
    projectRoot,
    "lib",
    "assessment",
    "team-assessment-aggregation-lifecycle.ts",
  ),
  "utf8",
);
const actionSource = fs.readFileSync(
  path.join(projectRoot, "app", "actions", "team-assessments.ts"),
  "utf8",
);
const reportOrchestrationSource = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "report-orchestration.ts"),
  "utf8",
);

assert.match(lifecycleSource, /loadTeamAssessmentAggregationDraft/);
assert.match(lifecycleSource, /persistTeamAssessmentAggregationSnapshot/);
assert.match(lifecycleSource, /loadTeamAssessmentAggregationVerification/);
assert.match(lifecycleSource, /TEAM_ASSESSMENT_AGGREGATION_VERSION/);
assert.doesNotMatch(lifecycleSource, /\.from\("responses"\)/);
assert.doesNotMatch(lifecycleSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(lifecycleSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(lifecycleSource, /persistTeamAssessmentMinimalScore/);
assert.doesNotMatch(lifecycleSource, /AssessmentForm/);
assert.doesNotMatch(lifecycleSource, /Team Fit/i);

assert.doesNotMatch(actionSource, /refreshTeamAssessmentAggregationSnapshot/);
assert.doesNotMatch(actionSource, /team-assessment-aggregation-lifecycle/);
assert.doesNotMatch(reportOrchestrationSource, /refreshTeamAssessmentAggregationSnapshot/);
assert.doesNotMatch(reportOrchestrationSource, /team-assessment-aggregation-lifecycle/);

const {
  TEAM_ASSESSMENT_AGGREGATION_VERSION,
} = require("../lib/assessment/team-assessment-aggregation-persistence.ts");
const {
  refreshTeamAssessmentAggregationSnapshot,
} = require("../lib/assessment/team-assessment-aggregation-lifecycle.ts");

const readyDraft = {
  teamAssessmentAssignmentId: "assignment-1",
  participantCount: 2,
  completedParticipantCount: 2,
  scoreSnapshotCount: 2,
  missingCompletedScoreParticipantIds: [],
  includedScoreCount: 2,
  excludedScoreCount: 0,
  score0To100Values: [0, 100],
  meanScore0To100: 50,
  minScore0To100: 0,
  maxScore0To100: 100,
  rangeScore0To100: 100,
  aggregationReadinessStatus: "ready",
  reasons: [],
};

const notReadyDraft = {
  ...readyDraft,
  completedParticipantCount: 1,
  scoreSnapshotCount: 0,
  missingCompletedScoreParticipantIds: ["participant-2"],
  includedScoreCount: 0,
  excludedScoreCount: 0,
  score0To100Values: [],
  meanScore0To100: null,
  minScore0To100: null,
  maxScore0To100: null,
  rangeScore0To100: null,
  aggregationReadinessStatus: "not_ready",
  reasons: ["no_completed_score_snapshots", "missing_completed_score_snapshots"],
};

function createPersistSuccessResult(mode, draft = readyDraft) {
  return {
    ok: true,
    mode,
    value: {
      id: "aggregation-row-1",
      teamAssessmentAssignmentId: draft.teamAssessmentAssignmentId,
      teamId: "team-1",
      aggregationVersion: TEAM_ASSESSMENT_AGGREGATION_VERSION,
      aggregationStatus: draft.aggregationReadinessStatus === "ready" ? "ready" : "not_ready",
      sourceScoringVersion: "team_dynamics_minimal_likert_v1",
      sourceScoreSnapshotIds: ["score-1", "score-2"],
      calculatedAt: "2026-05-24T18:00:00.000Z",
      draft,
    },
  };
}

function createVerificationResult(overrides = {}) {
  return {
    teamAssessmentAssignmentId: "assignment-1",
    aggregationVersion: TEAM_ASSESSMENT_AGGREGATION_VERSION,
    exists: true,
    aggregationSnapshotId: "aggregation-row-1",
    teamId: "team-1",
    aggregationStatus: "ready",
    sourceScoringVersion: "team_dynamics_minimal_likert_v1",
    participantCount: 2,
    completedParticipantCount: 2,
    includedScoreCount: 2,
    excludedScoreCount: 0,
    missingCompletedScoreParticipantIds: [],
    sourceScoreSnapshotIds: ["score-1", "score-2"],
    meanScore0To100: 50,
    minScore0To100: 0,
    maxScore0To100: 100,
    rangeScore0To100: 100,
    calculatedAt: "2026-05-24T18:00:00.000Z",
    updatedAt: "2026-05-24T18:00:01.000Z",
    verificationStatus: "verified",
    reasons: [],
    ...overrides,
  };
}

function createSupabaseStub() {
  return {
    from(table) {
      throw new Error(`Unexpected direct DB access in lifecycle helper test: ${table}`);
    },
  };
}

function createLifecycleDeps(options = {}) {
  const order = [];
  const draftResult = options.draftResult ?? readyDraft;
  const persistResult = options.persistResult ?? createPersistSuccessResult("inserted", draftResult);
  const verificationResult =
    options.verificationResult ?? createVerificationResult();
  const draftError = options.draftError ?? null;
  const persistError = options.persistError ?? null;
  const verificationError = options.verificationError ?? null;
  const supabase = options.supabase ?? createSupabaseStub();

  return {
    order,
    deps: {
      supabase,
      async loadAggregationDraft(input, helperDeps) {
        order.push("draft");
        assert.equal(input.teamAssessmentAssignmentId, "assignment-1");
        assert.equal(helperDeps.supabase, supabase);

        if (draftError) {
          throw draftError;
        }

        return draftResult;
      },
      async persistAggregationSnapshot(input, helperDeps) {
        order.push("persist");
        assert.equal(input.teamAssessmentAssignmentId, "assignment-1");
        assert.equal(input.aggregationVersion, TEAM_ASSESSMENT_AGGREGATION_VERSION);
        assert.equal(helperDeps.supabase, supabase);

        const replayedDraft = await helperDeps.loadAggregationDraft(
          {
            teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
          },
          {
            supabase,
          },
        );

        assert.deepEqual(replayedDraft, draftResult);

        if (persistError) {
          throw persistError;
        }

        return persistResult;
      },
      async loadAggregationVerification(input, helperDeps) {
        order.push("read");
        assert.equal(input.teamAssessmentAssignmentId, "assignment-1");
        assert.equal(input.aggregationVersion, TEAM_ASSESSMENT_AGGREGATION_VERSION);
        assert.equal(helperDeps.supabase, supabase);

        if (verificationError) {
          throw verificationError;
        }

        return verificationResult;
      },
    },
  };
}

function walkFiles(rootDir, predicate, matches = []) {
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      walkFiles(fullPath, predicate, matches);
      continue;
    }

    if (predicate(fullPath)) {
      matches.push(fullPath);
    }
  }

  return matches;
}

(async () => {
  const readyDeps = createLifecycleDeps({
    persistResult: createPersistSuccessResult("inserted", readyDraft),
    verificationResult: createVerificationResult(),
  });
  const readyResult = await refreshTeamAssessmentAggregationSnapshot(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    readyDeps.deps,
  );

  assert.deepEqual(readyDeps.order, ["draft", "persist", "read"]);
  assert.equal(readyResult.lifecycleStatus, "refreshed");
  assert.equal(readyResult.draftStatus, "ready");
  assert.equal(readyResult.persistenceMode, "inserted");
  assert.equal(readyResult.verificationStatus, "verified");
  assert.equal(readyResult.aggregationSnapshotId, "aggregation-row-1");
  assert.deepEqual(readyResult.reasons, []);
  assert.deepEqual(readyResult.counts, {
    participantCount: 2,
    completedParticipantCount: 2,
    scoreSnapshotCount: 2,
    includedScoreCount: 2,
    excludedScoreCount: 0,
  });

  const notReadyDeps = createLifecycleDeps({
    draftResult: notReadyDraft,
    persistResult: createPersistSuccessResult("updated", notReadyDraft),
    verificationResult: createVerificationResult({
      aggregationStatus: "not_ready",
      completedParticipantCount: 1,
      includedScoreCount: 0,
      missingCompletedScoreParticipantIds: ["participant-2"],
    }),
  });
  const notReadyResult = await refreshTeamAssessmentAggregationSnapshot(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    notReadyDeps.deps,
  );

  assert.deepEqual(notReadyDeps.order, ["draft", "persist", "read"]);
  assert.equal(notReadyResult.lifecycleStatus, "not_ready");
  assert.equal(notReadyResult.draftStatus, "not_ready");
  assert.equal(notReadyResult.persistenceMode, "updated");
  assert.equal(notReadyResult.verificationStatus, "verified");
  assert.deepEqual(notReadyResult.reasons, notReadyDraft.reasons);

  const missingVerificationDeps = createLifecycleDeps({
    verificationResult: createVerificationResult({
      exists: false,
      aggregationSnapshotId: null,
      verificationStatus: "missing",
      reasons: ["aggregation_snapshot_not_found"],
    }),
  });
  const missingVerificationResult = await refreshTeamAssessmentAggregationSnapshot(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    missingVerificationDeps.deps,
  );

  assert.equal(missingVerificationResult.lifecycleStatus, "verification_failed");
  assert.equal(missingVerificationResult.persistenceMode, "inserted");
  assert.equal(missingVerificationResult.verificationStatus, "missing");
  assert.deepEqual(missingVerificationResult.reasons, ["aggregation_snapshot_not_found"]);

  const invalidVerificationDeps = createLifecycleDeps({
    verificationResult: createVerificationResult({
      verificationStatus: "invalid",
      reasons: ["aggregation_status_invalid"],
    }),
  });
  const invalidVerificationResult = await refreshTeamAssessmentAggregationSnapshot(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    invalidVerificationDeps.deps,
  );

  assert.equal(invalidVerificationResult.lifecycleStatus, "verification_failed");
  assert.equal(invalidVerificationResult.verificationStatus, "invalid");
  assert.deepEqual(invalidVerificationResult.reasons, ["aggregation_status_invalid"]);

  const persistenceFailureDeps = createLifecycleDeps({
    persistResult: {
      ok: false,
      code: "insert_failed",
      reason: "Unable to persist Team Dynamics aggregation snapshot.",
    },
  });
  const persistenceFailureResult = await refreshTeamAssessmentAggregationSnapshot(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    persistenceFailureDeps.deps,
  );

  assert.deepEqual(persistenceFailureDeps.order, ["draft", "persist"]);
  assert.equal(persistenceFailureResult.lifecycleStatus, "failed");
  assert.equal(persistenceFailureResult.persistenceMode, null);
  assert.equal(persistenceFailureResult.verificationStatus, null);
  assert.deepEqual(persistenceFailureResult.reasons, [
    "Unable to persist Team Dynamics aggregation snapshot.",
    "insert_failed",
  ]);

  const thrownPersistenceFailureDeps = createLifecycleDeps({
    persistError: new Error("Persistence helper threw."),
  });
  const thrownPersistenceFailureResult = await refreshTeamAssessmentAggregationSnapshot(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    thrownPersistenceFailureDeps.deps,
  );

  assert.equal(thrownPersistenceFailureResult.lifecycleStatus, "failed");
  assert.deepEqual(thrownPersistenceFailureResult.reasons, ["Persistence helper threw."]);

  const uiSourceFiles = walkFiles(
    path.join(projectRoot, "app"),
    (fullPath) => /\.(ts|tsx)$/.test(fullPath),
  ).concat(
    walkFiles(path.join(projectRoot, "components"), (fullPath) => /\.(ts|tsx)$/.test(fullPath)),
  );

  for (const fullPath of uiSourceFiles) {
    const source = fs.readFileSync(fullPath, "utf8");
    assert.doesNotMatch(
      source,
      /team-assessment-aggregation-lifecycle|refreshTeamAssessmentAggregationSnapshot/,
      `Unexpected aggregation lifecycle helper usage in ${path.relative(projectRoot, fullPath)}`,
    );
  }

  console.log("test-team-dynamics-aggregation-lifecycle-helper: ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
