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
  path.join(projectRoot, "lib", "assessment", "team-assessment-aggregation-draft.ts"),
  "utf8",
);

assert.match(source, /loadTeamAssessmentScoreVerification/);
assert.match(source, /TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION/);
assert.match(source, /\.from\("team_assessment_participants"\)/);
assert.match(source, /\.from\("team_assessment_participant_scores"\)/);
assert.doesNotMatch(source, /\.insert\(/);
assert.doesNotMatch(source, /\.update\(/);
assert.doesNotMatch(source, /\.upsert\(/);
assert.doesNotMatch(source, /persistTeamAssessmentMinimalScore/);
assert.doesNotMatch(source, /attempt_reports/);
assert.doesNotMatch(source, /assessment_reports/);
assert.doesNotMatch(source, /Team Fit/i);
assert.doesNotMatch(source, /AssessmentForm/);

const {
  TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
} = require("../lib/assessment/team-assessment-score-persistence.ts");
const {
  loadTeamAssessmentAggregationDraft,
} = require("../lib/assessment/team-assessment-aggregation-draft.ts");

function createSupabaseStub(initialState = {}) {
  const state = {
    team_assessment_participants: [...(initialState.team_assessment_participants ?? [])],
    team_assessment_participant_scores: [
      ...(initialState.team_assessment_participant_scores ?? []),
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

  return {
    state,
    operations,
    from(table) {
      operations.push({ type: "from", table });

      const query = {
        filters: [],
        orders: [],
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
        insert() {
          throw new Error("insert should not be called by aggregation draft helper.");
        },
        update() {
          throw new Error("update should not be called by aggregation draft helper.");
        },
        upsert() {
          throw new Error("upsert should not be called by aggregation draft helper.");
        },
        then(resolve, reject) {
          try {
            const rows = applyOrders(
              applyFilters(state[table] ?? [], query.filters),
              query.orders,
            );
            return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
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
  const readySupabase = createSupabaseStub({
    team_assessment_participants: [
      {
        id: "tap-1",
        team_assessment_assignment_id: "assignment-1",
        participant_id: "participant-1",
        attempt_id: "attempt-1",
        status: "completed",
        completed_at: "2026-05-24T09:00:00.000Z",
        invited_at: "2026-05-24T08:00:00.000Z",
      },
      {
        id: "tap-2",
        team_assessment_assignment_id: "assignment-1",
        participant_id: "participant-2",
        attempt_id: "attempt-2",
        status: "completed",
        completed_at: "2026-05-24T09:05:00.000Z",
        invited_at: "2026-05-24T08:01:00.000Z",
      },
      {
        id: "tap-3",
        team_assessment_assignment_id: "assignment-1",
        participant_id: "participant-3",
        attempt_id: "attempt-3",
        status: "started",
        completed_at: null,
        invited_at: "2026-05-24T08:02:00.000Z",
      },
      {
        id: "tap-4",
        team_assessment_assignment_id: "assignment-2",
        participant_id: "participant-4",
        attempt_id: "attempt-4",
        status: "completed",
        completed_at: "2026-05-24T09:10:00.000Z",
        invited_at: "2026-05-24T08:03:00.000Z",
      },
    ],
    team_assessment_participant_scores: [
      {
        id: "score-1",
        team_assessment_participant_id: "tap-1",
        attempt_id: "attempt-1",
        scoring_version: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
        scoring_status: "scored",
        source_completed_at: "2026-05-24T09:00:00.000Z",
        calculated_at: "2026-05-24T09:00:05.000Z",
        score_0_100: 70,
      },
      {
        id: "score-2",
        team_assessment_participant_id: "tap-2",
        attempt_id: "attempt-2",
        scoring_version: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
        scoring_status: "scored",
        source_completed_at: "2026-05-24T09:05:00.000Z",
        calculated_at: "2026-05-24T09:05:05.000Z",
        score_0_100: 85,
      },
      {
        id: "score-3",
        team_assessment_participant_id: "tap-3",
        attempt_id: "attempt-3",
        scoring_version: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
        scoring_status: "not_ready",
        source_completed_at: null,
        calculated_at: "2026-05-24T09:06:00.000Z",
        score_0_100: 55,
      },
      {
        id: "score-4",
        team_assessment_participant_id: "tap-4",
        attempt_id: "attempt-4",
        scoring_version: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
        scoring_status: "scored",
        source_completed_at: "2026-05-24T09:10:00.000Z",
        calculated_at: "2026-05-24T09:10:05.000Z",
        score_0_100: 90,
      },
    ],
  });

  const readyResult = await loadTeamAssessmentAggregationDraft(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase: readySupabase,
    },
  );

  assert.deepEqual(readyResult, {
    teamAssessmentAssignmentId: "assignment-1",
    participantCount: 3,
    completedParticipantCount: 2,
    scoreSnapshotCount: 3,
    missingCompletedScoreParticipantIds: [],
    includedScoreCount: 2,
    excludedScoreCount: 1,
    score0To100Values: [70, 85],
    meanScore0To100: 77.5,
    minScore0To100: 70,
    maxScore0To100: 85,
    rangeScore0To100: 15,
    aggregationReadinessStatus: "ready",
    reasons: [],
  });

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

  const missingSupabase = createSupabaseStub({
    team_assessment_participants: [
      {
        id: "tap-1",
        team_assessment_assignment_id: "assignment-1",
        participant_id: "participant-1",
        attempt_id: "attempt-1",
        status: "completed",
        completed_at: "2026-05-24T09:00:00.000Z",
        invited_at: "2026-05-24T08:00:00.000Z",
      },
      {
        id: "tap-2",
        team_assessment_assignment_id: "assignment-1",
        participant_id: "participant-2",
        attempt_id: "attempt-2",
        status: "completed",
        completed_at: "2026-05-24T09:05:00.000Z",
        invited_at: "2026-05-24T08:01:00.000Z",
      },
      {
        id: "tap-3",
        team_assessment_assignment_id: "assignment-1",
        participant_id: "participant-3",
        attempt_id: "attempt-3",
        status: "started",
        completed_at: null,
        invited_at: "2026-05-24T08:02:00.000Z",
      },
    ],
    team_assessment_participant_scores: [
      {
        id: "score-1",
        team_assessment_participant_id: "tap-1",
        attempt_id: "attempt-1",
        scoring_version: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
        scoring_status: "scored",
        source_completed_at: "2026-05-24T09:00:00.000Z",
        calculated_at: "2026-05-24T09:00:05.000Z",
        score_0_100: 70,
      },
    ],
  });

  const missingResult = await loadTeamAssessmentAggregationDraft(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase: missingSupabase,
    },
  );

  assert.deepEqual(missingResult, {
    teamAssessmentAssignmentId: "assignment-1",
    participantCount: 3,
    completedParticipantCount: 2,
    scoreSnapshotCount: 1,
    missingCompletedScoreParticipantIds: ["tap-2"],
    includedScoreCount: 1,
    excludedScoreCount: 0,
    score0To100Values: [70],
    meanScore0To100: 70,
    minScore0To100: 70,
    maxScore0To100: 70,
    rangeScore0To100: 0,
    aggregationReadinessStatus: "not_ready",
    reasons: ["missing_completed_score_snapshots"],
  });
  assert.equal(
    missingResult.missingCompletedScoreParticipantIds.includes("tap-3"),
    false,
  );

  const emptySupabase = createSupabaseStub({
    team_assessment_participants: [
      {
        id: "tap-9",
        team_assessment_assignment_id: "assignment-9",
        participant_id: "participant-9",
        attempt_id: "attempt-9",
        status: "completed",
        completed_at: "2026-05-24T11:00:00.000Z",
        invited_at: "2026-05-24T10:00:00.000Z",
      },
    ],
  });

  const emptyResult = await loadTeamAssessmentAggregationDraft(
    {
      teamAssessmentAssignmentId: "assignment-9",
    },
    {
      supabase: emptySupabase,
    },
  );

  assert.deepEqual(emptyResult, {
    teamAssessmentAssignmentId: "assignment-9",
    participantCount: 1,
    completedParticipantCount: 1,
    scoreSnapshotCount: 0,
    missingCompletedScoreParticipantIds: ["tap-9"],
    includedScoreCount: 0,
    excludedScoreCount: 0,
    score0To100Values: [],
    meanScore0To100: null,
    minScore0To100: null,
    maxScore0To100: null,
    rangeScore0To100: null,
    aggregationReadinessStatus: "not_ready",
    reasons: [
      "no_completed_score_snapshots",
      "missing_completed_score_snapshots",
      "no_included_completed_scores",
    ],
  });

  console.log("test-team-dynamics-aggregation-draft: ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
