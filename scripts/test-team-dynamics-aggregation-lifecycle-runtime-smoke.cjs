const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const adminStubPath = path.join(__dirname, "__team_dynamics_admin_stub__.cjs");
const originalResolveFilename = Module._resolveFilename;

let currentSupabaseStub = null;

require.cache[adminStubPath] = {
  id: adminStubPath,
  filename: adminStubPath,
  loaded: true,
  exports: {
    createSupabaseAdminClient() {
      if (!currentSupabaseStub) {
        throw new Error("Supabase stub is not initialized.");
      }

      return currentSupabaseStub;
    },
  },
};

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
  if (request === "@/lib/supabase/admin") {
    return adminStubPath;
  }

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

const smokeSource = fs.readFileSync(__filename, "utf8");
assert.match(smokeSource, /refreshTeamAssessmentAggregationSnapshot/);

const {
  TEAM_ASSESSMENT_AGGREGATION_VERSION,
} = require("../lib/assessment/team-assessment-aggregation-persistence.ts");
const {
  TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
} = require("../lib/assessment/team-assessment-score-persistence.ts");
const {
  refreshTeamAssessmentAggregationSnapshot,
} = require("../lib/assessment/team-assessment-aggregation-lifecycle.ts");
const {
  loadTeamAssessmentAggregationVerification,
} = require("../lib/assessment/team-assessment-aggregation-read.ts");

function createSupabaseStub(initialState = {}) {
  const counters = {
    team_assessment_aggregation_snapshots:
      initialState.team_assessment_aggregation_snapshots?.length ?? 0,
  };
  const state = {
    team_assessment_assignments: [
      ...(initialState.team_assessment_assignments ?? []),
    ],
    team_assessment_participants: [
      ...(initialState.team_assessment_participants ?? []),
    ],
    team_assessment_participant_scores: [
      ...(initialState.team_assessment_participant_scores ?? []),
    ],
    team_assessment_aggregation_snapshots: [
      ...(initialState.team_assessment_aggregation_snapshots ?? []),
    ],
    attempt_reports: [...(initialState.attempt_reports ?? [])],
    assessment_reports: [...(initialState.assessment_reports ?? [])],
    responses: [...(initialState.responses ?? [])],
  };
  const operations = [];

  function applyFilters(rows, filters) {
    return rows.filter((row) =>
      filters.every((filter) => {
        if (filter.type === "eq") {
          return row[filter.column] === filter.value;
        }

        if (filter.type === "in") {
          return filter.values.includes(row[filter.column]);
        }

        return true;
      }),
    );
  }

  function applyOrders(rows, orders) {
    return [...rows].sort((left, right) => {
      for (const order of orders) {
        const leftValue = left[order.column];
        const rightValue = right[order.column];

        if (leftValue === rightValue) {
          continue;
        }

        if (leftValue == null) {
          return order.ascending ? 1 : -1;
        }

        if (rightValue == null) {
          return order.ascending ? -1 : 1;
        }

        if (leftValue < rightValue) {
          return order.ascending ? -1 : 1;
        }

        if (leftValue > rightValue) {
          return order.ascending ? 1 : -1;
        }
      }

      return 0;
    });
  }

  function executeQuery(table, query) {
    if (query.mode === "select") {
      const rows = applyOrders(applyFilters(state[table] ?? [], query.filters), query.orders);
      return query.single ? rows[0] ?? null : rows;
    }

    if (query.mode === "update") {
      const rows = applyFilters(state[table] ?? [], query.filters);
      const updatedRows = rows.map((row) => Object.assign(row, query.patch ?? {}));
      return query.single ? updatedRows[0] ?? null : updatedRows;
    }

    if (query.mode === "insert") {
      const insertedRows = (query.insertRows ?? []).map((row) => {
        counters[table] = (counters[table] ?? 0) + 1;
        const nextRow = {
          id: row.id ?? `${table}-${counters[table]}`,
          ...row,
        };
        state[table].push(nextRow);
        return nextRow;
      });
      return query.single ? insertedRows[0] ?? null : insertedRows;
    }

    return null;
  }

  return {
    state,
    operations,
    from(table) {
      operations.push({ type: "from", table });

      const query = {
        filters: [],
        orders: [],
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
        in(column, values) {
          query.filters.push({ type: "in", column, values });
          return builder;
        },
        order(column, options = {}) {
          query.orders.push({
            column,
            ascending: options.ascending !== false,
          });
          return builder;
        },
        update(patch) {
          query.mode = "update";
          query.patch = patch;
          return builder;
        },
        insert(rows) {
          query.mode = "insert";
          query.insertRows = Array.isArray(rows) ? rows : [rows];
          return builder;
        },
        single() {
          query.single = true;
          return builder;
        },
        async maybeSingle() {
          query.single = true;
          return {
            data: executeQuery(table, query),
            error: null,
          };
        },
        then(resolve, reject) {
          try {
            return Promise.resolve({
              data: executeQuery(table, query),
              error: null,
            }).then(resolve, reject);
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
  currentSupabaseStub = createSupabaseStub({
    team_assessment_assignments: [
      {
        id: "assignment-1",
        team_id: "team-1",
      },
    ],
    team_assessment_participants: [
      {
        id: "tap-1",
        team_assessment_assignment_id: "assignment-1",
        participant_id: "participant-1",
        attempt_id: "attempt-1",
        status: "completed",
        completed_at: "2026-05-24T10:00:00.000Z",
        invited_at: "2026-05-24T09:00:00.000Z",
      },
      {
        id: "tap-2",
        team_assessment_assignment_id: "assignment-1",
        participant_id: "participant-2",
        attempt_id: "attempt-2",
        status: "completed",
        completed_at: "2026-05-24T10:05:00.000Z",
        invited_at: "2026-05-24T09:05:00.000Z",
      },
    ],
    team_assessment_participant_scores: [
      {
        id: "score-row-1",
        team_assessment_participant_id: "tap-1",
        attempt_id: "attempt-1",
        scoring_version: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
        scoring_status: "scored",
        source_completed_at: "2026-05-24T10:00:00.000Z",
        calculated_at: "2026-05-24T10:10:00.000Z",
        score_0_100: 25,
      },
      {
        id: "score-row-2",
        team_assessment_participant_id: "tap-2",
        attempt_id: "attempt-2",
        scoring_version: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
        scoring_status: "scored",
        source_completed_at: "2026-05-24T10:05:00.000Z",
        calculated_at: "2026-05-24T10:12:00.000Z",
        score_0_100: 75,
      },
    ],
  });

  const preRefreshVerification = await loadTeamAssessmentAggregationVerification({
    teamAssessmentAssignmentId: "assignment-1",
  });

  assert.equal(preRefreshVerification.exists, false);
  assert.equal(preRefreshVerification.verificationStatus, "missing");
  assert.deepEqual(preRefreshVerification.reasons, ["aggregation_snapshot_not_found"]);

  const refreshResult = await refreshTeamAssessmentAggregationSnapshot({
    teamAssessmentAssignmentId: "assignment-1",
  });

  assert.deepEqual(refreshResult, {
    teamAssessmentAssignmentId: "assignment-1",
    aggregationVersion: TEAM_ASSESSMENT_AGGREGATION_VERSION,
    lifecycleStatus: "refreshed",
    draftStatus: "ready",
    persistenceMode: "inserted",
    verificationStatus: "verified",
    aggregationSnapshotId: "team_assessment_aggregation_snapshots-1",
    reasons: [],
    counts: {
      participantCount: 2,
      completedParticipantCount: 2,
      scoreSnapshotCount: 2,
      includedScoreCount: 2,
      excludedScoreCount: 0,
    },
  });

  assert.equal(
    currentSupabaseStub.state.team_assessment_aggregation_snapshots.length,
    1,
  );

  const persistedRow =
    currentSupabaseStub.state.team_assessment_aggregation_snapshots[0];
  const expectedSourceScoreSnapshotIds = ["score-row-1", "score-row-2"];

  assert.equal(persistedRow.team_assessment_assignment_id, "assignment-1");
  assert.equal(persistedRow.team_id, "team-1");
  assert.equal(persistedRow.aggregation_version, TEAM_ASSESSMENT_AGGREGATION_VERSION);
  assert.equal(persistedRow.aggregation_status, "ready");
  assert.equal(
    persistedRow.source_scoring_version,
    TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
  );
  assert.deepEqual(persistedRow.source_score_snapshot_ids, expectedSourceScoreSnapshotIds);
  assert.equal(persistedRow.participant_count, 2);
  assert.equal(persistedRow.completed_participant_count, 2);
  assert.equal(persistedRow.included_score_count, 2);
  assert.equal(persistedRow.excluded_score_count, 0);
  assert.deepEqual(persistedRow.missing_completed_score_participant_ids, []);
  assert.equal(persistedRow.mean_score_0_100, 50);
  assert.equal(persistedRow.min_score_0_100, 25);
  assert.equal(persistedRow.max_score_0_100, 75);
  assert.equal(persistedRow.range_score_0_100, 50);
  assert.equal(
    persistedRow.mean_score_0_100 >= 0 && persistedRow.mean_score_0_100 <= 100,
    true,
  );
  assert.equal(
    persistedRow.range_score_0_100 >= 0 && persistedRow.range_score_0_100 <= 100,
    true,
  );

  const postRefreshVerification = await loadTeamAssessmentAggregationVerification({
    teamAssessmentAssignmentId: "assignment-1",
  });

  assert.equal(postRefreshVerification.exists, true);
  assert.equal(postRefreshVerification.verificationStatus, "verified");
  assert.equal(postRefreshVerification.teamAssessmentAssignmentId, "assignment-1");
  assert.equal(
    postRefreshVerification.aggregationVersion,
    TEAM_ASSESSMENT_AGGREGATION_VERSION,
  );
  assert.equal(
    postRefreshVerification.aggregationSnapshotId,
    "team_assessment_aggregation_snapshots-1",
  );
  assert.equal(postRefreshVerification.teamId, "team-1");
  assert.equal(postRefreshVerification.aggregationStatus, "ready");
  assert.equal(
    postRefreshVerification.sourceScoringVersion,
    TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
  );
  assert.equal(postRefreshVerification.participantCount, 2);
  assert.equal(postRefreshVerification.completedParticipantCount, 2);
  assert.equal(postRefreshVerification.includedScoreCount, 2);
  assert.equal(postRefreshVerification.excludedScoreCount, 0);
  assert.deepEqual(
    postRefreshVerification.missingCompletedScoreParticipantIds,
    [],
  );
  assert.deepEqual(
    postRefreshVerification.sourceScoreSnapshotIds,
    expectedSourceScoreSnapshotIds,
  );
  assert.equal(postRefreshVerification.meanScore0To100, 50);
  assert.equal(postRefreshVerification.minScore0To100, 25);
  assert.equal(postRefreshVerification.maxScore0To100, 75);
  assert.equal(postRefreshVerification.rangeScore0To100, 50);

  const secondRefreshResult = await refreshTeamAssessmentAggregationSnapshot({
    teamAssessmentAssignmentId: "assignment-1",
  });

  assert.equal(secondRefreshResult.lifecycleStatus, "refreshed");
  assert.equal(secondRefreshResult.persistenceMode, "updated");
  assert.equal(secondRefreshResult.verificationStatus, "verified");
  assert.equal(
    currentSupabaseStub.state.team_assessment_aggregation_snapshots.length,
    1,
  );

  assert.equal(
    currentSupabaseStub.operations.some((operation) => operation.table === "attempt_reports"),
    false,
  );
  assert.equal(
    currentSupabaseStub.operations.some((operation) => operation.table === "assessment_reports"),
    false,
  );
  assert.equal(currentSupabaseStub.state.attempt_reports.length, 0);
  assert.equal(currentSupabaseStub.state.assessment_reports.length, 0);
  assert.equal(currentSupabaseStub.state.responses.length, 0);

  console.log("test-team-dynamics-aggregation-lifecycle-runtime-smoke: ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
