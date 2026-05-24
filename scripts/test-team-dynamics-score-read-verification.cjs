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
  path.join(projectRoot, "lib", "assessment", "team-assessment-score-read.ts"),
  "utf8",
);

assert.match(source, /TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION/);
assert.match(source, /loadTeamAssessmentScoreVerification/);
assert.match(source, /\.from\("team_assessment_participants"\)/);
assert.match(source, /\.from\("team_assessment_participant_scores"\)/);
assert.doesNotMatch(source, /\.insert\(/);
assert.doesNotMatch(source, /\.update\(/);
assert.doesNotMatch(source, /\.upsert\(/);
assert.doesNotMatch(source, /persistTeamAssessmentMinimalScore/);
assert.doesNotMatch(source, /attempt_reports/);
assert.doesNotMatch(source, /assessment_reports/);
assert.doesNotMatch(source, /aggregate/i);
assert.doesNotMatch(source, /Team Fit/i);
assert.doesNotMatch(source, /AssessmentForm/);

const {
  TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
} = require("../lib/assessment/team-assessment-score-persistence.ts");
const {
  loadTeamAssessmentScoreVerification,
} = require("../lib/assessment/team-assessment-score-read.ts");

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
          throw new Error("insert should not be called by score verification helper.");
        },
        update() {
          throw new Error("update should not be called by score verification helper.");
        },
        upsert() {
          throw new Error("upsert should not be called by score verification helper.");
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
  const supabase = createSupabaseStub({
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
      },
      {
        id: "score-2",
        team_assessment_participant_id: "tap-4",
        attempt_id: "attempt-4",
        scoring_version: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
        scoring_status: "scored",
        source_completed_at: "2026-05-24T09:10:00.000Z",
        calculated_at: "2026-05-24T09:10:05.000Z",
      },
      {
        id: "score-3",
        team_assessment_participant_id: "tap-2",
        attempt_id: "attempt-2",
        scoring_version: "team_dynamics_minimal_likert_v0",
        scoring_status: "scored",
        source_completed_at: "2026-05-24T09:05:00.000Z",
        calculated_at: "2026-05-24T09:05:05.000Z",
      },
    ],
  });

  const result = await loadTeamAssessmentScoreVerification(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase,
    },
  );

  assert.deepEqual(result, {
    teamAssessmentAssignmentId: "assignment-1",
    participantCount: 3,
    completedParticipantCount: 2,
    scoreSnapshotCount: 1,
    missingCompletedScoreParticipantIds: ["tap-2"],
    scoreRows: [
      {
        scoreRowId: "score-1",
        teamAssessmentParticipantId: "tap-1",
        participantId: "participant-1",
        attemptId: "attempt-1",
        scoringVersion: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
        scoringStatus: "scored",
        sourceCompletedAt: "2026-05-24T09:00:00.000Z",
        calculatedAt: "2026-05-24T09:00:05.000Z",
      },
    ],
  });

  assert.equal(
    result.scoreRows.some((row) => row.teamAssessmentParticipantId === "tap-4"),
    false,
  );
  assert.equal(
    result.missingCompletedScoreParticipantIds.includes("tap-3"),
    false,
  );
  assert.equal(
    supabase.operations.some((operation) => operation.table === "attempt_reports"),
    false,
  );
  assert.equal(
    supabase.operations.some((operation) => operation.table === "assessment_reports"),
    false,
  );
  assert.equal(supabase.state.attempt_reports.length, 0);
  assert.equal(supabase.state.assessment_reports.length, 0);

  const emptyResult = await loadTeamAssessmentScoreVerification(
    {
      teamAssessmentAssignmentId: "assignment-missing",
    },
    {
      supabase: createSupabaseStub(),
    },
  );

  assert.deepEqual(emptyResult, {
    teamAssessmentAssignmentId: "assignment-missing",
    participantCount: 0,
    completedParticipantCount: 0,
    scoreSnapshotCount: 0,
    missingCompletedScoreParticipantIds: [],
    scoreRows: [],
  });

  console.log("test-team-dynamics-score-read-verification: ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
