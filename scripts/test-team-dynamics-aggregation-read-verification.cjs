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

const source = fs.readFileSync(
  path.join(
    projectRoot,
    "lib",
    "assessment",
    "team-assessment-aggregation-read.ts",
  ),
  "utf8",
);

assert.match(source, /TEAM_ASSESSMENT_AGGREGATION_VERSION/);
assert.match(source, /\.from\("team_assessment_aggregation_snapshots"\)/);
assert.doesNotMatch(source, /\.insert\(/);
assert.doesNotMatch(source, /\.update\(/);
assert.doesNotMatch(source, /\.upsert\(/);
assert.doesNotMatch(source, /persistTeamAssessmentAggregationSnapshot/);
assert.doesNotMatch(source, /loadTeamAssessmentAggregationDraft/);
assert.doesNotMatch(source, /attempt_reports/);
assert.doesNotMatch(source, /assessment_reports/);
assert.doesNotMatch(source, /AssessmentForm/);
assert.doesNotMatch(source, /Team Fit/i);
assert.doesNotMatch(source, /report orchestration/i);

const {
  TEAM_ASSESSMENT_AGGREGATION_VERSION,
} = require("../lib/assessment/team-assessment-aggregation-persistence.ts");
const {
  loadTeamAssessmentAggregationVerification,
} = require("../lib/assessment/team-assessment-aggregation-read.ts");

function createSupabaseStub(initialState = {}) {
  const state = {
    team_assessment_aggregation_snapshots: [
      ...(initialState.team_assessment_aggregation_snapshots ?? []),
    ],
    attempt_reports: [...(initialState.attempt_reports ?? [])],
    assessment_reports: [...(initialState.assessment_reports ?? [])],
  };
  const operations = [];

  function applyFilters(rows, filters) {
    return rows.filter((row) =>
      filters.every((filter) => {
        if (filter.type === "eq") {
          return row[filter.column] === filter.value;
        }

        return true;
      }),
    );
  }

  return {
    state,
    operations,
    from(table) {
      operations.push({ type: "from", table });

      const query = {
        filters: [],
      };

      const builder = {
        select() {
          operations.push({ type: "select", table });
          return builder;
        },
        eq(column, value) {
          query.filters.push({ type: "eq", column, value });
          return builder;
        },
        insert() {
          throw new Error("insert should not be called by aggregation read helper.");
        },
        update() {
          throw new Error("update should not be called by aggregation read helper.");
        },
        upsert() {
          throw new Error("upsert should not be called by aggregation read helper.");
        },
        async maybeSingle() {
          const rows = applyFilters(state[table] ?? [], query.filters);
          return { data: rows[0] ?? null, error: null };
        },
      };

      return builder;
    },
  };
}

(async () => {
  const missingSupabase = createSupabaseStub();
  const missingResult = await loadTeamAssessmentAggregationVerification(
    {
      teamAssessmentAssignmentId: "assignment-missing",
    },
    {
      supabase: missingSupabase,
    },
  );

  assert.deepEqual(missingResult, {
    teamAssessmentAssignmentId: "assignment-missing",
    aggregationVersion: TEAM_ASSESSMENT_AGGREGATION_VERSION,
    exists: false,
    aggregationSnapshotId: null,
    teamId: null,
    aggregationStatus: null,
    sourceScoringVersion: null,
    participantCount: null,
    completedParticipantCount: null,
    includedScoreCount: null,
    excludedScoreCount: null,
    missingCompletedScoreParticipantIds: [],
    sourceScoreSnapshotIds: [],
    meanScore0To100: null,
    minScore0To100: null,
    maxScore0To100: null,
    rangeScore0To100: null,
    calculatedAt: null,
    updatedAt: null,
    verificationStatus: "missing",
    reasons: ["aggregation_snapshot_not_found"],
  });

  const readySupabase = createSupabaseStub({
    team_assessment_aggregation_snapshots: [
      {
        id: "aggregation-1",
        team_assessment_assignment_id: "assignment-1",
        team_id: "team-1",
        aggregation_version: TEAM_ASSESSMENT_AGGREGATION_VERSION,
        aggregation_status: "ready",
        source_scoring_version: "team_dynamics_minimal_likert_v1",
        source_score_snapshot_ids: ["score-1", "score-2"],
        participant_count: 3,
        completed_participant_count: 2,
        included_score_count: 2,
        excluded_score_count: 0,
        missing_completed_score_participant_ids: [],
        mean_score_0_100: 77.5,
        min_score_0_100: 70,
        max_score_0_100: 85,
        range_score_0_100: 15,
        aggregation_snapshot: {
          participantCount: 3,
        },
        calculated_at: "2026-05-24T12:00:00.000Z",
        updated_at: "2026-05-24T12:01:00.000Z",
      },
      {
        id: "aggregation-2",
        team_assessment_assignment_id: "assignment-2",
        team_id: "team-2",
        aggregation_version: TEAM_ASSESSMENT_AGGREGATION_VERSION,
        aggregation_status: "ready",
        source_scoring_version: "team_dynamics_minimal_likert_v1",
        source_score_snapshot_ids: ["score-9"],
        participant_count: 2,
        completed_participant_count: 2,
        included_score_count: 2,
        excluded_score_count: 0,
        missing_completed_score_participant_ids: [],
        mean_score_0_100: 80,
        min_score_0_100: 75,
        max_score_0_100: 85,
        range_score_0_100: 10,
        aggregation_snapshot: {
          participantCount: 2,
        },
        calculated_at: "2026-05-24T13:00:00.000Z",
        updated_at: "2026-05-24T13:01:00.000Z",
      },
      {
        id: "aggregation-3",
        team_assessment_assignment_id: "assignment-1",
        team_id: "team-1",
        aggregation_version: "team_dynamics_minimal_aggregation_v2",
        aggregation_status: "ready",
        source_scoring_version: "team_dynamics_minimal_likert_v1",
        source_score_snapshot_ids: ["score-3"],
        participant_count: 3,
        completed_participant_count: 3,
        included_score_count: 3,
        excluded_score_count: 0,
        missing_completed_score_participant_ids: [],
        mean_score_0_100: 78,
        min_score_0_100: 70,
        max_score_0_100: 86,
        range_score_0_100: 16,
        aggregation_snapshot: {
          participantCount: 3,
        },
        calculated_at: "2026-05-24T14:00:00.000Z",
        updated_at: "2026-05-24T14:01:00.000Z",
      },
    ],
  });

  const readyResult = await loadTeamAssessmentAggregationVerification(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase: readySupabase,
    },
  );

  assert.deepEqual(readyResult, {
    teamAssessmentAssignmentId: "assignment-1",
    aggregationVersion: TEAM_ASSESSMENT_AGGREGATION_VERSION,
    exists: true,
    aggregationSnapshotId: "aggregation-1",
    teamId: "team-1",
    aggregationStatus: "ready",
    sourceScoringVersion: "team_dynamics_minimal_likert_v1",
    participantCount: 3,
    completedParticipantCount: 2,
    includedScoreCount: 2,
    excludedScoreCount: 0,
    missingCompletedScoreParticipantIds: [],
    sourceScoreSnapshotIds: ["score-1", "score-2"],
    meanScore0To100: 77.5,
    minScore0To100: 70,
    maxScore0To100: 85,
    rangeScore0To100: 15,
    calculatedAt: "2026-05-24T12:00:00.000Z",
    updatedAt: "2026-05-24T12:01:00.000Z",
    verificationStatus: "verified",
    reasons: [],
  });

  const missingByVersionResult = await loadTeamAssessmentAggregationVerification(
    {
      teamAssessmentAssignmentId: "assignment-1",
      aggregationVersion: "team_dynamics_minimal_aggregation_missing",
    },
    {
      supabase: readySupabase,
    },
  );

  assert.equal(missingByVersionResult.exists, false);
  assert.equal(missingByVersionResult.verificationStatus, "missing");

  const invalidSupabase = createSupabaseStub({
    team_assessment_aggregation_snapshots: [
      {
        id: "aggregation-invalid",
        team_assessment_assignment_id: "assignment-invalid",
        team_id: null,
        aggregation_version: TEAM_ASSESSMENT_AGGREGATION_VERSION,
        aggregation_status: "broken",
        source_scoring_version: "team_dynamics_minimal_likert_v1",
        source_score_snapshot_ids: ["score-invalid"],
        participant_count: -1,
        completed_participant_count: 1,
        included_score_count: 2,
        excluded_score_count: -3,
        missing_completed_score_participant_ids: ["tap-9"],
        mean_score_0_100: 120,
        min_score_0_100: -1,
        max_score_0_100: 101,
        range_score_0_100: 999,
        aggregation_snapshot: null,
        calculated_at: "2026-05-24T15:00:00.000Z",
        updated_at: "2026-05-24T15:01:00.000Z",
      },
    ],
  });

  const invalidResult = await loadTeamAssessmentAggregationVerification(
    {
      teamAssessmentAssignmentId: "assignment-invalid",
    },
    {
      supabase: invalidSupabase,
    },
  );

  assert.equal(invalidResult.exists, true);
  assert.equal(invalidResult.verificationStatus, "invalid");
  assert.deepEqual(invalidResult.missingCompletedScoreParticipantIds, ["tap-9"]);
  assert.deepEqual(invalidResult.sourceScoreSnapshotIds, ["score-invalid"]);
  assert.deepEqual(invalidResult.reasons, [
    "team_id_missing",
    "aggregation_status_invalid",
    "participant_count_invalid",
    "excluded_score_count_invalid",
    "included_score_count_exceeds_completed_participant_count",
    "mean_score_0_100_invalid",
    "min_score_0_100_invalid",
    "max_score_0_100_invalid",
    "range_score_0_100_invalid",
    "aggregation_snapshot_missing",
  ]);

  assert.equal(
    readySupabase.operations.some((operation) => operation.table === "attempt_reports"),
    false,
  );
  assert.equal(
    readySupabase.operations.some((operation) => operation.table === "assessment_reports"),
    false,
  );
  assert.equal(readySupabase.state.attempt_reports.length, 0);
  assert.equal(readySupabase.state.assessment_reports.length, 0);

  console.log("test-team-dynamics-aggregation-read-verification: ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
