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

const readSource = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "team-dynamics-final-aggregation-read.ts"),
  "utf8",
);

assert.match(readSource, /loadTeamDynamicsFinalAggregationVerification/);
assert.match(readSource, /\.from\("team_assessment_assignments"\)/);
assert.match(readSource, /\.from\("team_assessment_aggregation_snapshots"\)/);
assert.doesNotMatch(readSource, /\.insert\(/);
assert.doesNotMatch(readSource, /\.update\(/);
assert.doesNotMatch(readSource, /\.upsert\(/);
assert.doesNotMatch(readSource, /loadTeamDynamicsFinalAggregation\(/);
assert.doesNotMatch(readSource, /persistTeamDynamicsFinalAggregationSnapshot/);
assert.doesNotMatch(readSource, /buildTeamDynamicsMixedScore/);
assert.doesNotMatch(readSource, /attempt_reports/);
assert.doesNotMatch(readSource, /assessment_reports/);
assert.doesNotMatch(readSource, /Team Fit/i);
assert.doesNotMatch(readSource, /AI generation/i);

const {
  TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION,
} = require("../lib/assessment/team-dynamics-final-aggregation.ts");
const {
  persistTeamDynamicsFinalAggregationSnapshot,
} = require("../lib/assessment/team-dynamics-final-aggregation-persistence.ts");
const {
  loadTeamDynamicsFinalAggregationVerification,
} = require("../lib/assessment/team-dynamics-final-aggregation-read.ts");

function buildReadyAggregationSnapshot() {
  const scoreEntryAggregations = [
    {
      scoreKey: "tdm-31-V1_overall",
      label: "Razvojna zrelost tima",
      blockKey: "tdm-31-V1",
      scoreModel: "simple_linear_v1",
      entryType: "block_overall",
      memberCount: 3,
      meanScore0To100: 61.11,
      minScore0To100: 33.33,
      maxScore0To100: 100,
      standardDeviationScore0To100: 28.33,
    },
    {
      scoreKey: "tdm_domain_communication",
      label: "Communication",
      blockKey: "tdm-31-V1",
      scoreModel: "simple_linear_v1",
      entryType: "domain",
      memberCount: 3,
      meanScore0To100: 61.11,
      minScore0To100: 33.33,
      maxScore0To100: 100,
      standardDeviationScore0To100: 28.33,
    },
    {
      scoreKey: "psychological_safety_overall",
      label: "Psiholoska sigurnost u timu",
      blockKey: "psychological_safety",
      scoreModel: "simple_linear_v1",
      entryType: "block_overall",
      memberCount: 3,
      meanScore0To100: 66.67,
      minScore0To100: 33.33,
      maxScore0To100: 100,
      standardDeviationScore0To100: 27.22,
    },
    {
      scoreKey: "situational_judgment_overall",
      label: "Timsko prosudjivanje u situacijama",
      blockKey: "situational_judgment",
      scoreModel: "expert_key_partial_credit_v1",
      entryType: "situational_judgment",
      memberCount: 3,
      meanScore0To100: 55.56,
      minScore0To100: 16.67,
      maxScore0To100: 100,
      standardDeviationScore0To100: 34.25,
    },
    {
      scoreKey: "outcome_pulse_overall",
      label: "Ishodi timskog rada",
      blockKey: "outcome_pulse",
      scoreModel: "simple_linear_v1",
      entryType: "outcome_signal",
      memberCount: 3,
      meanScore0To100: 55.56,
      minScore0To100: 0,
      maxScore0To100: 100,
      standardDeviationScore0To100: 41.57,
    },
  ];

  return {
    status: "ready",
    teamAssessmentAssignmentId: "assignment-1",
    teamId: "team-1",
    testSlug: "team_dynamics_assessment_v1",
    aggregationVersion: TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION,
    scoringVersion: "team_dynamics_assessment_v1_mixed_v1",
    participantCount: 3,
    completedParticipantCount: 3,
    incompleteMemberCount: 0,
    readyScoredMemberCount: 3,
    missingScoreCount: 0,
    invalidScoreCount: 0,
    sourceScoreSnapshotIds: ["score-row-1", "score-row-2", "score-row-3"],
    incompleteMemberParticipantIds: [],
    missingScoreParticipantIds: [],
    invalidScoreParticipantIds: [],
    issues: [],
    scoreEntryAggregations,
    tdmDomainAggregations: scoreEntryAggregations.filter((entry) =>
      entry.scoreKey.startsWith("tdm_domain_"),
    ),
    psychologicalSafetyAggregationEntry: scoreEntryAggregations[2],
    sjtAggregationEntry: scoreEntryAggregations[3],
    outcomePulseAggregationEntry: scoreEntryAggregations[4],
    hasTopLevelOverallScore: false,
    teamOverallScore0To100: null,
    meanScore0To100: null,
    minScore0To100: null,
    maxScore0To100: null,
    standardDeviationScore0To100: null,
    reasons: [],
  };
}

function createSupabaseStub(initialState = {}) {
  let aggregationRowCounter = 0;
  const state = {
    team_assessment_assignments: [...(initialState.team_assessment_assignments ?? [])],
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
        mode: "select",
        patch: null,
        insertRows: null,
        single: false,
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
        update(patch) {
          operations.push({ type: "update", table });
          query.mode = "update";
          query.patch = patch;
          return builder;
        },
        insert(rows) {
          operations.push({ type: "insert", table });
          query.mode = "insert";
          query.insertRows = Array.isArray(rows) ? rows : [rows];
          return builder;
        },
        single() {
          query.single = true;
          return builder;
        },
        async maybeSingle() {
          const rows = applyFilters(state[table] ?? [], query.filters);
          return { data: rows[0] ?? null, error: null };
        },
        then(resolve, reject) {
          try {
            if (query.mode === "select") {
              const rows = applyFilters(state[table] ?? [], query.filters);
              const payload = query.single ? rows[0] ?? null : rows;
              return Promise.resolve({ data: payload, error: null }).then(resolve, reject);
            }

            if (query.mode === "update") {
              const rows = applyFilters(state[table] ?? [], query.filters);
              const updatedRows = rows.map((row) =>
                Object.assign(row, query.patch ?? {}, {
                  updated_at: row.updated_at ?? "2026-05-28T12:02:00.000Z",
                }),
              );
              const payload = query.single ? updatedRows[0] ?? null : updatedRows;
              return Promise.resolve({ data: payload, error: null }).then(resolve, reject);
            }

            if (query.mode === "insert") {
              const insertedRows = (query.insertRows ?? []).map((row) => {
                aggregationRowCounter += 1;
                const nextRow = {
                  id: row.id ?? `final-aggregation-read-row-${aggregationRowCounter}`,
                  created_at: row.created_at ?? "2026-05-28T12:00:00.000Z",
                  updated_at: row.updated_at ?? "2026-05-28T12:01:00.000Z",
                  ...row,
                };
                state[table].push(nextRow);
                return nextRow;
              });
              const payload = query.single ? insertedRows[0] ?? null : insertedRows;
              return Promise.resolve({ data: payload, error: null }).then(resolve, reject);
            }

            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          } catch (error) {
            return Promise.reject(error).then(resolve, reject);
          }
        },
      };

      return builder;
    },
  };
}

(async () => {
  const baseAssignmentState = {
    team_assessment_assignments: [
      {
        id: "assignment-1",
        team_id: "team-1",
        package_slug: "team_dynamics_assessment_v1",
      },
    ],
  };

  const missingSupabase = createSupabaseStub(baseAssignmentState);
  const missingResult = await loadTeamDynamicsFinalAggregationVerification(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase: missingSupabase,
    },
  );

  assert.deepEqual(missingResult, {
    status: "not_found",
    teamAssessmentAssignmentId: "assignment-1",
    testSlug: "team_dynamics_assessment_v1",
    aggregationVersion: TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION,
    aggregationSnapshotId: null,
    aggregationSnapshot: null,
    scoreEntryAggregations: [],
    hasUnifiedOverallTeamScore: false,
    hasTdmBlockAggregation: false,
    hasTdmDomainAggregations: false,
    hasPsychologicalSafetyAggregation: false,
    hasSjtAggregation: false,
    hasOutcomePulseAggregation: false,
    includedMemberCount: null,
    completedMemberCount: null,
    readyScoredMemberCount: null,
    incompleteMemberCount: null,
    missingScoreCount: null,
    invalidScoreCount: null,
    createdAt: null,
    updatedAt: null,
    calculatedAt: null,
    reason: null,
  });

  const readySupabase = createSupabaseStub(baseAssignmentState);
  const readySnapshot = buildReadyAggregationSnapshot();
  const persisted = await persistTeamDynamicsFinalAggregationSnapshot(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase: readySupabase,
      loadFinalAggregation: async () => readySnapshot,
    },
  );
  assert.equal(persisted.ok, true);

  const operationsBeforeRead = readySupabase.operations.length;
  const readyResult = await loadTeamDynamicsFinalAggregationVerification(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase: readySupabase,
    },
  );

  assert.equal(readyResult.status, "ready");
  assert.equal(readyResult.aggregationSnapshotId, "final-aggregation-read-row-1");
  assert.equal(readyResult.hasUnifiedOverallTeamScore, false);
  assert.equal(readyResult.hasTdmBlockAggregation, true);
  assert.equal(readyResult.hasTdmDomainAggregations, true);
  assert.equal(readyResult.hasPsychologicalSafetyAggregation, true);
  assert.equal(readyResult.hasSjtAggregation, true);
  assert.equal(readyResult.hasOutcomePulseAggregation, true);
  assert.equal(readyResult.includedMemberCount, 3);
  assert.equal(readyResult.completedMemberCount, 3);
  assert.equal(readyResult.readyScoredMemberCount, 3);
  assert.equal(readyResult.incompleteMemberCount, 0);
  assert.equal(readyResult.missingScoreCount, 0);
  assert.equal(readyResult.invalidScoreCount, 0);
  assert.ok(
    readyResult.scoreEntryAggregations.some((entry) => entry.scoreKey === "tdm-31-V1_overall"),
  );
  assert.ok(
    readyResult.scoreEntryAggregations.some((entry) =>
      entry.scoreKey.startsWith("tdm_domain_"),
    ),
  );
  assert.ok(
    readyResult.scoreEntryAggregations.some(
      (entry) => entry.scoreKey === "psychological_safety_overall",
    ),
  );
  assert.ok(
    readyResult.scoreEntryAggregations.some(
      (entry) => entry.scoreKey === "situational_judgment_overall",
    ),
  );
  assert.ok(
    readyResult.scoreEntryAggregations.some(
      (entry) => entry.scoreKey === "outcome_pulse_overall",
    ),
  );
  const writesAfterRead = readySupabase.operations
    .slice(operationsBeforeRead)
    .filter((operation) => operation.type === "insert" || operation.type === "update");
  assert.deepEqual(writesAfterRead, []);

  const operationsBeforeSecondRead = readySupabase.operations.length;
  const rowCountBeforeSecondRead = readySupabase.state.team_assessment_aggregation_snapshots.length;
  const readyAgain = await loadTeamDynamicsFinalAggregationVerification(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase: readySupabase,
    },
  );
  assert.deepEqual(readyAgain, readyResult);
  assert.equal(
    readySupabase.state.team_assessment_aggregation_snapshots.length,
    rowCountBeforeSecondRead,
  );
  const writesAfterSecondRead = readySupabase.operations
    .slice(operationsBeforeSecondRead)
    .filter((operation) => operation.type === "insert" || operation.type === "update");
  assert.deepEqual(writesAfterSecondRead, []);

  const invalidShapeSupabase = createSupabaseStub({
    ...baseAssignmentState,
    team_assessment_aggregation_snapshots: [
      {
        id: "invalid-aggregation-shape-row",
        team_assessment_assignment_id: "assignment-1",
        team_id: "team-1",
        aggregation_version: TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION,
        aggregation_status: "ready",
        source_scoring_version: "team_dynamics_assessment_v1_mixed_v1",
        source_score_snapshot_ids: ["score-row-1"],
        participant_count: 1,
        completed_participant_count: 1,
        included_score_count: 1,
        excluded_score_count: 0,
        aggregation_snapshot: {
          status: "ready",
          scoreEntryAggregations: [],
        },
        created_at: "2026-05-28T12:10:00.000Z",
        updated_at: "2026-05-28T12:11:00.000Z",
        calculated_at: "2026-05-28T12:11:00.000Z",
      },
    ],
  });
  const invalidShapeResult = await loadTeamDynamicsFinalAggregationVerification(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase: invalidShapeSupabase,
    },
  );
  assert.equal(invalidShapeResult.status, "invalid");
  assert.equal(invalidShapeResult.reason, "invalid_aggregation_snapshot_shape");

  const partialSupabase = createSupabaseStub({
    ...baseAssignmentState,
    team_assessment_aggregation_snapshots: [
      {
        id: "partial-aggregation-row",
        team_assessment_assignment_id: "assignment-1",
        team_id: "team-1",
        aggregation_version: TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION,
        aggregation_status: "ready",
        source_scoring_version: "team_dynamics_assessment_v1_mixed_v1",
        source_score_snapshot_ids: ["score-row-1", "score-row-2"],
        participant_count: 3,
        completed_participant_count: 2,
        included_score_count: 2,
        excluded_score_count: 1,
        aggregation_snapshot: {
          ...buildReadyAggregationSnapshot(),
          completedParticipantCount: 2,
          readyScoredMemberCount: 2,
          incompleteMemberCount: 1,
          incompleteMemberParticipantIds: ["tap-3"],
          reasons: ["incomplete_included_members"],
        },
        created_at: "2026-05-28T12:20:00.000Z",
        updated_at: "2026-05-28T12:21:00.000Z",
        calculated_at: "2026-05-28T12:21:00.000Z",
      },
    ],
  });
  const partialResult = await loadTeamDynamicsFinalAggregationVerification(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase: partialSupabase,
    },
  );
  assert.equal(partialResult.status, "invalid");
  assert.match(partialResult.reason, /partial_aggregation_detected_completed_coverage/);
  assert.match(partialResult.reason, /partial_aggregation_detected_incomplete_members/);

  assert.equal(readySupabase.state.attempt_reports.length, 0);
  assert.equal(readySupabase.state.assessment_reports.length, 0);
  assert.equal(missingSupabase.state.attempt_reports.length, 0);
  assert.equal(missingSupabase.state.assessment_reports.length, 0);

  console.log("test-team-dynamics-assessment-v1-final-aggregation-read: ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
