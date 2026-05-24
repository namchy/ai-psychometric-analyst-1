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

  if (
    request === "server-only" ||
    request === "@/lib/auth/session" ||
    request === "@/lib/b2b/organizations" ||
    request === "@/lib/assessment/team-assessments" ||
    request === "@/lib/assessment/team-dynamics-action-contract"
  ) {
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

const actionSource = fs.readFileSync(
  path.join(projectRoot, "app", "actions", "team-assessments.ts"),
  "utf8",
);
const smokeSource = fs.readFileSync(__filename, "utf8");

assert.match(actionSource, /completeTeamAssessmentAction/);
assert.match(actionSource, /persistTeamAssessmentMinimalScoreForContext/);
assert.match(actionSource, /transitionTeamAssessmentExecutionToCompleted/);
assert.match(actionSource, /loadTeamAssessmentCompletionReadinessForContext/);
assert.doesNotMatch(smokeSource, /attempt_reports\.push/);
assert.doesNotMatch(smokeSource, /assessment_reports\.push/);

const {
  completeTeamAssessmentAction,
} = require("../app/actions/team-assessments.ts");
const {
  TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
} = require("../lib/assessment/team-assessment-score-persistence.ts");
const {
  loadTeamAssessmentScoreVerification,
} = require("../lib/assessment/team-assessment-score-read.ts");
const {
  loadTeamAssessmentAggregationDraft,
} = require("../lib/assessment/team-assessment-aggregation-draft.ts");
const {
  TEAM_ASSESSMENT_AGGREGATION_VERSION,
  persistTeamAssessmentAggregationSnapshot,
} = require("../lib/assessment/team-assessment-aggregation-persistence.ts");
const {
  loadTeamAssessmentAggregationVerification,
} = require("../lib/assessment/team-assessment-aggregation-read.ts");

function createSupabaseStub(initialState = {}) {
  const counters = {
    team_assessment_participant_scores:
      initialState.team_assessment_participant_scores?.length ?? 0,
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
    attempts: [...(initialState.attempts ?? [])],
    responses: [...(initialState.responses ?? [])],
    answer_options: [...(initialState.answer_options ?? [])],
    team_assessment_participant_scores: [
      ...(initialState.team_assessment_participant_scores ?? []),
    ],
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

function createLoadExecutionContext(state) {
  return async function loadExecutionContext({ teamAssessmentParticipantId }) {
    const wrapper = state.team_assessment_participants.find(
      (row) => row.id === teamAssessmentParticipantId,
    );

    if (!wrapper) {
      return {
        ok: false,
        code: "wrapper_not_found",
        message: "Wrapper not found.",
      };
    }

    const assignment = state.team_assessment_assignments.find(
      (row) => row.id === wrapper.team_assessment_assignment_id,
    );
    const attempt = state.attempts.find((row) => row.id === wrapper.attempt_id);

    if (!assignment || !attempt) {
      return {
        ok: false,
        code: "assignment_not_found",
        message: "Assignment or attempt not found.",
      };
    }

    return {
      ok: true,
      context: {
        teamAssessmentParticipantId: wrapper.id,
        teamAssessmentAssignmentId: assignment.id,
        teamMembershipId: wrapper.team_membership_id,
        participantId: wrapper.participant_id,
        attemptId: attempt.id,
        teamId: assignment.team_id,
        organizationId: "org-1",
        packageSlug: "team_dynamics_v1_strong",
        wrapperStatus: wrapper.status,
        attemptStatus: attempt.status,
        locale: "bs",
        test: {
          id: "test-team-dynamics",
          slug: "team_dynamics_v1_strong",
          name: "Procjena timske dinamike",
          status: "active",
          isActive: true,
        },
      },
    };
  };
}

const questionOutline = {
  orderedQuestionIds: ["question-1", "question-2"],
  questions: [],
  locale: "bs",
  count: 2,
};

const uiOnlyItemsResult = {
  items: [
    {
      mode: "ui_only_ready",
      questionId: "question-1",
      order: 1,
      localizedTitle: "Q1",
      localizedStem: "Q1",
      optionIds: ["option-1", "option-2", "option-3", "option-4"],
      options: [],
      locale: "bs",
      isUiOnlySkeleton: true,
    },
    {
      mode: "ui_only_ready",
      questionId: "question-2",
      order: 2,
      localizedTitle: "Q2",
      localizedStem: "Q2",
      optionIds: ["option-5", "option-6", "option-7", "option-8"],
      options: [],
      locale: "bs",
      isUiOnlySkeleton: true,
    },
  ],
  itemCount: 2,
  unsupportedCount: 0,
  mode: "ready",
};

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
        team_membership_id: "membership-1",
        participant_id: "participant-1",
        attempt_id: "attempt-1",
        status: "started",
        invited_at: "2026-05-24T08:00:00.000Z",
        started_at: "2026-05-24T08:05:00.000Z",
        completed_at: null,
      },
      {
        id: "tap-2",
        team_assessment_assignment_id: "assignment-1",
        team_membership_id: "membership-2",
        participant_id: "participant-2",
        attempt_id: "attempt-2",
        status: "started",
        invited_at: "2026-05-24T08:01:00.000Z",
        started_at: "2026-05-24T08:06:00.000Z",
        completed_at: null,
      },
    ],
    attempts: [
      {
        id: "attempt-1",
        status: "in_progress",
        started_at: "2026-05-24T08:05:00.000Z",
        completed_at: null,
      },
      {
        id: "attempt-2",
        status: "in_progress",
        started_at: "2026-05-24T08:06:00.000Z",
        completed_at: null,
      },
    ],
    responses: [
      {
        attempt_id: "attempt-1",
        question_id: "question-1",
        answer_option_id: "option-4",
        response_kind: "single_choice",
      },
      {
        attempt_id: "attempt-1",
        question_id: "question-2",
        answer_option_id: "option-8",
        response_kind: "single_choice",
      },
      {
        attempt_id: "attempt-2",
        question_id: "question-1",
        answer_option_id: "option-1",
        response_kind: "single_choice",
      },
      {
        attempt_id: "attempt-2",
        question_id: "question-2",
        answer_option_id: "option-5",
        response_kind: "single_choice",
      },
    ],
    answer_options: [
      { id: "option-1", question_id: "question-1", value: 1 },
      { id: "option-2", question_id: "question-1", value: 2 },
      { id: "option-3", question_id: "question-1", value: 3 },
      { id: "option-4", question_id: "question-1", value: 4 },
      { id: "option-5", question_id: "question-2", value: 1 },
      { id: "option-6", question_id: "question-2", value: 2 },
      { id: "option-7", question_id: "question-2", value: 3 },
      { id: "option-8", question_id: "question-2", value: 4 },
    ],
  });

  const loadExecutionContext = createLoadExecutionContext(currentSupabaseStub.state);

  const prePersistVerification = await loadTeamAssessmentAggregationVerification({
    teamAssessmentAssignmentId: "assignment-1",
  });
  assert.equal(prePersistVerification.exists, false);
  assert.equal(prePersistVerification.verificationStatus, "missing");

  const firstCompletionResult = await completeTeamAssessmentAction(
    {
      teamAssessmentParticipantId: "tap-1",
    },
    {
      requireUser: async () => ({ id: "user-1" }),
      loadExecutionContext,
      loadQuestionOutline: async () => questionOutline,
      loadUiOnlyItems: async () => uiOnlyItemsResult,
      resolveShellState: ({ route, wrapperStatus }) => ({
        kind: "run_started",
        route,
        wrapperStatus,
        isRunnable: true,
        shouldTransitionToStarted: false,
        title: "",
        message: "",
      }),
    },
  );

  const secondCompletionResult = await completeTeamAssessmentAction(
    {
      teamAssessmentParticipantId: "tap-2",
    },
    {
      requireUser: async () => ({ id: "user-1" }),
      loadExecutionContext,
      loadQuestionOutline: async () => questionOutline,
      loadUiOnlyItems: async () => uiOnlyItemsResult,
      resolveShellState: ({ route, wrapperStatus }) => ({
        kind: "run_started",
        route,
        wrapperStatus,
        isRunnable: true,
        shouldTransitionToStarted: false,
        title: "",
        message: "",
      }),
    },
  );

  assert.equal(firstCompletionResult.ok, true);
  assert.equal(firstCompletionResult.mode, "completed");
  assert.deepEqual(firstCompletionResult.postCompletionScoring, {
    ok: true,
    mode: "inserted",
    scoringVersion: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
  });
  assert.equal(secondCompletionResult.ok, true);
  assert.equal(secondCompletionResult.mode, "completed");
  assert.deepEqual(secondCompletionResult.postCompletionScoring, {
    ok: true,
    mode: "inserted",
    scoringVersion: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
  });

  assert.deepEqual(
    currentSupabaseStub.state.team_assessment_participants.map((row) => row.status),
    ["completed", "completed"],
  );
  assert.deepEqual(
    currentSupabaseStub.state.attempts.map((row) => row.status),
    ["completed", "completed"],
  );
  assert.equal(
    currentSupabaseStub.state.team_assessment_participant_scores.length,
    2,
  );

  const scoreVerification = await loadTeamAssessmentScoreVerification({
    teamAssessmentAssignmentId: "assignment-1",
  });

  assert.deepEqual(scoreVerification, {
    teamAssessmentAssignmentId: "assignment-1",
    participantCount: 2,
    completedParticipantCount: 2,
    scoreSnapshotCount: 2,
    missingCompletedScoreParticipantIds: [],
    scoreRows: [
      {
        scoreRowId: "team_assessment_participant_scores-2",
        teamAssessmentParticipantId: "tap-2",
        participantId: "participant-2",
        attemptId: "attempt-2",
        scoringVersion: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
        scoringStatus: "scored",
        sourceCompletedAt: currentSupabaseStub.state.attempts[1].completed_at,
        calculatedAt: currentSupabaseStub.state.team_assessment_participant_scores[1].calculated_at,
      },
      {
        scoreRowId: "team_assessment_participant_scores-1",
        teamAssessmentParticipantId: "tap-1",
        participantId: "participant-1",
        attemptId: "attempt-1",
        scoringVersion: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
        scoringStatus: "scored",
        sourceCompletedAt: currentSupabaseStub.state.attempts[0].completed_at,
        calculatedAt: currentSupabaseStub.state.team_assessment_participant_scores[0].calculated_at,
      },
    ],
  });

  const aggregationDraft = await loadTeamAssessmentAggregationDraft({
    teamAssessmentAssignmentId: "assignment-1",
  });

  assert.deepEqual(aggregationDraft, {
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
  });

  const persistenceResult = await persistTeamAssessmentAggregationSnapshot({
    teamAssessmentAssignmentId: "assignment-1",
  });

  assert.equal(persistenceResult.ok, true);
  assert.equal(persistenceResult.mode, "inserted");
  assert.equal(
    currentSupabaseStub.state.team_assessment_aggregation_snapshots.length,
    1,
  );

  const persistedRow =
    currentSupabaseStub.state.team_assessment_aggregation_snapshots[0];
  const expectedSourceScoreSnapshotIds = currentSupabaseStub.state.team_assessment_participant_scores
    .map((row) => row.id)
    .sort();

  assert.equal(persistedRow.team_assessment_assignment_id, "assignment-1");
  assert.equal(persistedRow.aggregation_version, TEAM_ASSESSMENT_AGGREGATION_VERSION);
  assert.deepEqual(persistedRow.source_score_snapshot_ids, expectedSourceScoreSnapshotIds);
  assert.equal(persistedRow.participant_count, 2);
  assert.equal(persistedRow.completed_participant_count, 2);
  assert.equal(persistedRow.included_score_count, 2);
  assert.equal(persistedRow.excluded_score_count, 0);
  assert.equal(persistedRow.mean_score_0_100, 50);
  assert.equal(persistedRow.min_score_0_100, 0);
  assert.equal(persistedRow.max_score_0_100, 100);
  assert.equal(persistedRow.range_score_0_100, 100);

  const readVerification = await loadTeamAssessmentAggregationVerification({
    teamAssessmentAssignmentId: "assignment-1",
  });

  assert.equal(readVerification.exists, true);
  assert.equal(readVerification.verificationStatus, "verified");
  assert.equal(readVerification.teamAssessmentAssignmentId, "assignment-1");
  assert.equal(readVerification.aggregationVersion, TEAM_ASSESSMENT_AGGREGATION_VERSION);
  assert.equal(readVerification.aggregationSnapshotId, persistedRow.id);
  assert.equal(readVerification.teamId, "team-1");
  assert.equal(readVerification.aggregationStatus, "ready");
  assert.equal(
    readVerification.sourceScoringVersion,
    TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
  );
  assert.equal(readVerification.participantCount, 2);
  assert.equal(readVerification.completedParticipantCount, 2);
  assert.equal(readVerification.includedScoreCount, 2);
  assert.equal(readVerification.excludedScoreCount, 0);
  assert.deepEqual(readVerification.missingCompletedScoreParticipantIds, []);
  assert.deepEqual(readVerification.sourceScoreSnapshotIds, expectedSourceScoreSnapshotIds);
  assert.equal(readVerification.meanScore0To100, 50);
  assert.equal(readVerification.minScore0To100, 0);
  assert.equal(readVerification.maxScore0To100, 100);
  assert.equal(readVerification.rangeScore0To100, 100);
  assert.equal(
    readVerification.meanScore0To100 >= 0 && readVerification.meanScore0To100 <= 100,
    true,
  );
  assert.equal(
    readVerification.rangeScore0To100 >= 0 && readVerification.rangeScore0To100 <= 100,
    true,
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

  console.log("test-team-dynamics-aggregation-runtime-smoke: ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
