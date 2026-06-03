const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;
const migrationPath = path.join(
  projectRoot,
  "supabase",
  "migrations",
  "20260524110000_add_team_assessment_aggregation_snapshots.sql",
);

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

const migrationSql = fs.readFileSync(migrationPath, "utf8");

assert.match(
  migrationSql,
  /create table if not exists public\.team_assessment_aggregation_snapshots/i,
);
assert.match(
  migrationSql,
  /team_assessment_assignment_id uuid not null references public\.team_assessment_assignments\(id\) on delete cascade/i,
);
assert.match(
  migrationSql,
  /team_id uuid not null references public\.teams\(id\) on delete cascade/i,
);
assert.match(
  migrationSql,
  /check \(aggregation_status in \('ready', 'not_ready', 'stale', 'failed'\)\)/i,
);
assert.match(
  migrationSql,
  /create unique index if not exists team_assessment_aggregation_snapshots_assignment_version_idx/i,
);
assert.match(
  migrationSql,
  /create trigger set_team_assessment_aggregation_snapshots_updated_at/i,
);
assert.match(
  migrationSql,
  /alter table public\.team_assessment_aggregation_snapshots enable row level security/i,
);
assert.match(
  migrationSql,
  /create policy "team_assessment_aggregation_snapshots_read_member"/i,
);
assert.match(
  migrationSql,
  /from public\.team_assessment_assignments assignment[\s\S]*join public\.teams team[\s\S]*join public\.organization_memberships membership/i,
);

const source = fs.readFileSync(
  path.join(
    projectRoot,
    "lib",
    "assessment",
    "team-assessment-aggregation-persistence.ts",
  ),
  "utf8",
);

assert.match(source, /TEAM_ASSESSMENT_AGGREGATION_VERSION/);
assert.match(source, /loadTeamAssessmentAggregationDraft/);
assert.match(source, /loadTeamAssessmentScoreVerification/);
assert.match(source, /\.from\("team_assessment_aggregation_snapshots"\)/);
assert.doesNotMatch(source, /attempt_reports/);
assert.doesNotMatch(source, /assessment_reports/);
assert.doesNotMatch(source, /persistTeamAssessmentMinimalScore/);
assert.doesNotMatch(source, /AssessmentForm/);
assert.doesNotMatch(source, /Team Fit/i);
assert.doesNotMatch(source, /report orchestration/i);

const {
  TEAM_ASSESSMENT_AGGREGATION_VERSION,
  persistTeamAssessmentAggregationSnapshot,
} = require("../lib/assessment/team-assessment-aggregation-persistence.ts");
const {
  TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
} = require("../lib/assessment/team-assessment-score-persistence.ts");

function createSupabaseStub(initialState = {}) {
  let aggregationRowCounter = 0;
  const state = {
    team_assessment_assignments: [
      ...(initialState.team_assessment_assignments ?? []),
    ],
    team_assessment_participants: [
      ...(initialState.team_assessment_participants ?? []),
    ],
    team_assessment_aggregation_snapshots: [
      ...(initialState.team_assessment_aggregation_snapshots ?? []),
    ],
    team_assessment_participant_scores: [
      ...(initialState.team_assessment_participant_scores ?? []),
    ],
    responses: [...(initialState.responses ?? [])],
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
          if (table !== "team_assessment_aggregation_snapshots") {
            throw new Error(`Unexpected update on ${table}.`);
          }

          query.mode = "update";
          query.patch = patch;
          return builder;
        },
        insert(rows) {
          if (table !== "team_assessment_aggregation_snapshots") {
            throw new Error(`Unexpected insert on ${table}.`);
          }

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
              const updatedRows = rows.map((row) => Object.assign(row, query.patch ?? {}));
              const payload = query.single ? updatedRows[0] ?? null : updatedRows;
              return Promise.resolve({ data: payload, error: null }).then(resolve, reject);
            }

            if (query.mode === "insert") {
              const insertedRows = (query.insertRows ?? []).map((row) => {
                aggregationRowCounter += 1;
                const nextRow = {
                  id: row.id ?? `aggregation-row-${aggregationRowCounter}`,
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
  const readyDraft = {
    teamAssessmentAssignmentId: "assignment-1",
    participantCount: 3,
    completedParticipantCount: 2,
    scoreSnapshotCount: 2,
    missingCompletedScoreParticipantIds: [],
    includedScoreCount: 2,
    excludedScoreCount: 0,
    score0To100Values: [70, 85],
    meanScore0To100: 77.5,
    minScore0To100: 70,
    maxScore0To100: 85,
    rangeScore0To100: 15,
    aggregationReadinessStatus: "ready",
    reasons: [],
  };
  const readyVerification = {
    teamAssessmentAssignmentId: "assignment-1",
    participantCount: 3,
    completedParticipantCount: 2,
    scoreSnapshotCount: 3,
    missingCompletedScoreParticipantIds: [],
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
      {
        scoreRowId: "score-2",
        teamAssessmentParticipantId: "tap-2",
        participantId: "participant-2",
        attemptId: "attempt-2",
        scoringVersion: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
        scoringStatus: "scored",
        sourceCompletedAt: "2026-05-24T09:05:00.000Z",
        calculatedAt: "2026-05-24T09:05:05.000Z",
      },
      {
        scoreRowId: "score-3-started",
        teamAssessmentParticipantId: "tap-3",
        participantId: "participant-3",
        attemptId: "attempt-3",
        scoringVersion: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
        scoringStatus: "scored",
        sourceCompletedAt: "2026-05-24T09:06:00.000Z",
        calculatedAt: "2026-05-24T09:06:05.000Z",
      },
    ],
  };

  const readySupabase = createSupabaseStub({
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
        status: "completed",
      },
      {
        id: "tap-2",
        team_assessment_assignment_id: "assignment-1",
        status: "completed",
      },
      {
        id: "tap-3",
        team_assessment_assignment_id: "assignment-1",
        status: "started",
      },
    ],
    team_assessment_participant_scores: [
      { id: "score-1" },
      { id: "score-2" },
    ],
  });
  const draftCalls = [];
  const verificationCalls = [];

  const insertedResult = await persistTeamAssessmentAggregationSnapshot(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase: readySupabase,
      async loadAggregationDraft(input) {
        draftCalls.push(input);
        return readyDraft;
      },
      async loadScoreVerification(input) {
        verificationCalls.push(input);
        return readyVerification;
      },
    },
  );

  assert.equal(insertedResult.ok, true);
  assert.equal(insertedResult.mode, "inserted");
  assert.equal(draftCalls.length, 1);
  assert.equal(verificationCalls.length, 1);
  assert.deepEqual(draftCalls[0], {
    teamAssessmentAssignmentId: "assignment-1",
    scoringVersion: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
  });
  assert.deepEqual(verificationCalls[0], {
    teamAssessmentAssignmentId: "assignment-1",
    scoringVersion: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
  });
  assert.equal(readySupabase.state.team_assessment_aggregation_snapshots.length, 1);

  const insertedRow = readySupabase.state.team_assessment_aggregation_snapshots[0];
  assert.equal(insertedRow.team_assessment_assignment_id, "assignment-1");
  assert.equal(insertedRow.team_id, "team-1");
  assert.equal(insertedRow.aggregation_version, TEAM_ASSESSMENT_AGGREGATION_VERSION);
  assert.equal(insertedRow.aggregation_status, "ready");
  assert.equal(
    insertedRow.source_scoring_version,
    TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
  );
  assert.deepEqual(insertedRow.source_score_snapshot_ids, [
    "score-1",
    "score-2",
  ]);
  assert.deepEqual(insertedRow.missing_completed_score_participant_ids, []);
  assert.equal(insertedRow.participant_count, 3);
  assert.equal(insertedRow.completed_participant_count, 2);
  assert.equal(insertedRow.included_score_count, 2);
  assert.equal(insertedRow.excluded_score_count, 0);
  assert.equal(insertedRow.mean_score_0_100, 77.5);
  assert.equal(insertedRow.min_score_0_100, 70);
  assert.equal(insertedRow.max_score_0_100, 85);
  assert.equal(insertedRow.range_score_0_100, 15);
  assert.deepEqual(insertedRow.aggregation_snapshot, {
    teamAssessmentAssignmentId: "assignment-1",
    aggregationVersion: TEAM_ASSESSMENT_AGGREGATION_VERSION,
    sourceScoringVersion: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
    sourceScoreSnapshotIds: ["score-1", "score-2"],
    participantCount: 3,
    completedParticipantCount: 2,
    scoreSnapshotCount: 2,
    missingCompletedScoreParticipantIds: [],
    includedScoreCount: 2,
    excludedScoreCount: 0,
    meanScore0To100: 77.5,
    minScore0To100: 70,
    maxScore0To100: 85,
    rangeScore0To100: 15,
    aggregationReadinessStatus: "ready",
    reasons: [],
  });

  const notReadyDraft = {
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
  };
  const notReadyVerification = {
    teamAssessmentAssignmentId: "assignment-1",
    participantCount: 3,
    completedParticipantCount: 2,
    scoreSnapshotCount: 1,
    missingCompletedScoreParticipantIds: ["tap-2"],
    scoreRows: [
      {
        scoreRowId: "score-1-updated",
        teamAssessmentParticipantId: "tap-1",
        participantId: "participant-1",
        attemptId: "attempt-1",
        scoringVersion: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
        scoringStatus: "scored",
        sourceCompletedAt: "2026-05-24T10:00:00.000Z",
        calculatedAt: "2026-05-24T10:00:05.000Z",
      },
    ],
  };

  const updatedResult = await persistTeamAssessmentAggregationSnapshot(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase: readySupabase,
      async loadAggregationDraft() {
        return notReadyDraft;
      },
      async loadScoreVerification() {
        return notReadyVerification;
      },
    },
  );

  assert.equal(updatedResult.ok, true);
  assert.equal(updatedResult.mode, "updated");
  assert.equal(readySupabase.state.team_assessment_aggregation_snapshots.length, 1);

  const updatedRow = readySupabase.state.team_assessment_aggregation_snapshots[0];
  assert.equal(updatedRow.id, insertedRow.id);
  assert.equal(updatedRow.aggregation_status, "not_ready");
  assert.deepEqual(updatedRow.source_score_snapshot_ids, ["score-1-updated"]);
  assert.deepEqual(updatedRow.missing_completed_score_participant_ids, ["tap-2"]);
  assert.equal(updatedRow.participant_count, 3);
  assert.equal(updatedRow.completed_participant_count, 2);
  assert.equal(updatedRow.included_score_count, 1);
  assert.equal(updatedRow.excluded_score_count, 0);
  assert.equal(updatedRow.mean_score_0_100, 70);
  assert.equal(updatedRow.min_score_0_100, 70);
  assert.equal(updatedRow.max_score_0_100, 70);
  assert.equal(updatedRow.range_score_0_100, 0);
  assert.equal(
    readySupabase.state.team_assessment_participant_scores.length,
    2,
  );
  assert.equal(readySupabase.state.responses.length, 0);
  assert.equal(readySupabase.state.attempt_reports.length, 0);
  assert.equal(readySupabase.state.assessment_reports.length, 0);
  assert.equal(
    readySupabase.operations.some((operation) => operation.table === "attempt_reports"),
    false,
  );
  assert.equal(
    readySupabase.operations.some((operation) => operation.table === "assessment_reports"),
    false,
  );
  assert.equal(
    readySupabase.operations.some(
      (operation) =>
        operation.table === "team_assessment_participant_scores" &&
        (operation.type === "insert" || operation.type === "update"),
    ),
    false,
  );
  assert.equal(
    readySupabase.operations.some(
      (operation) =>
        operation.table === "responses" &&
        (operation.type === "insert" || operation.type === "update"),
    ),
    false,
  );

  console.log("test-team-dynamics-aggregation-persistence: ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
