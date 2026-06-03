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
  "20260523133000_add_team_assessment_participant_scores.sql",
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
  /create table if not exists public\.team_assessment_participant_scores/i,
);
assert.match(
  migrationSql,
  /team_assessment_participant_id uuid not null references public\.team_assessment_participants\(id\) on delete cascade/i,
);
assert.match(
  migrationSql,
  /attempt_id uuid not null references public\.attempts\(id\) on delete cascade/i,
);
assert.match(
  migrationSql,
  /check \(scoring_status in \('scored', 'not_ready', 'not_completed', 'no_supported_items', 'not_scored', 'failed', 'stale'\)\)/i,
);
assert.match(
  migrationSql,
  /create unique index if not exists team_assessment_participant_scores_wrapper_version_idx/i,
);
assert.match(
  migrationSql,
  /create trigger set_team_assessment_participant_scores_updated_at/i,
);
assert.match(
  migrationSql,
  /alter table public\.team_assessment_participant_scores enable row level security/i,
);
assert.match(
  migrationSql,
  /create policy "team_assessment_participant_scores_read_member"/i,
);

const source = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "team-assessment-score-persistence.ts"),
  "utf8",
);

assert.match(source, /TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION/);
assert.match(source, /persistTeamAssessmentMinimalScoreForContext/);
assert.match(source, /persistTeamAssessmentMinimalScore/);
assert.match(source, /\.from\("team_assessment_participant_scores"\)/);
assert.doesNotMatch(source, /attempt_reports/);
assert.doesNotMatch(source, /assessment_reports/);
assert.doesNotMatch(source, /aggregate/i);
assert.doesNotMatch(source, /Team Fit/i);
assert.doesNotMatch(source, /report orchestration/i);
assert.doesNotMatch(source, /revalidatePath/);

const {
  TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
  persistTeamAssessmentMinimalScore,
  persistTeamAssessmentMinimalScoreForContext,
} = require("../lib/assessment/team-assessment-score-persistence.ts");

const completedContext = {
  teamAssessmentParticipantId: "tap-1",
  teamAssessmentAssignmentId: "assignment-1",
  teamMembershipId: "membership-1",
  participantId: "participant-1",
  attemptId: "attempt-1",
  teamId: "team-1",
  organizationId: "org-1",
  packageSlug: "team_dynamics_v1_strong",
  wrapperStatus: "completed",
  attemptStatus: "completed",
  locale: "bs",
  test: {
    id: "test-team-dynamics",
    slug: "team_dynamics_v1_strong",
    name: "Procjena timske dinamike",
    status: "active",
    isActive: true,
  },
};

const uiOnlyItems = [
  {
    mode: "ui_only_ready",
    questionId: "question-1",
    order: 1,
    localizedTitle: "Q1",
    localizedStem: "Q1",
    optionIds: ["option-1", "option-2"],
    options: [],
    locale: "bs",
    isUiOnlySkeleton: true,
  },
];

function createSupabaseStub(initialState = {}) {
  let scoreRowCounter = 0;
  const state = {
    team_assessment_participant_scores: [
      ...(initialState.team_assessment_participant_scores ?? []),
    ],
    attempts: [...(initialState.attempts ?? [])],
    attempt_reports: [...(initialState.attempt_reports ?? [])],
    assessment_reports: [...(initialState.assessment_reports ?? [])],
  };

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
    from(table) {
      const query = {
        filters: [],
        mode: "select",
        patch: null,
        insertRows: null,
        single: false,
      };

      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          query.filters.push({
            type: "eq",
            column,
            value,
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
                scoreRowCounter += 1;
                const nextRow = {
                  id: row.id ?? `score-row-${scoreRowCounter}`,
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
  const scoredSupabase = createSupabaseStub({
    attempts: [
      {
        id: "attempt-1",
        completed_at: "2026-05-23T10:15:00.000Z",
      },
    ],
  });

  const inserted = await persistTeamAssessmentMinimalScoreForContext(
    {
      context: completedContext,
      uiOnlyItems,
      scoringVersion: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
    },
    {
      supabase: scoredSupabase,
      loadMinimalScoreForContext: async () => ({
        status: "scored",
        supportedQuestionCount: 1,
        scoredQuestionCount: 1,
        rawTotal: 4,
        meanRaw: 4,
        score0To100: 75,
        missingQuestionIds: [],
        ignoredInvalidAnswerCount: 0,
        scaleMin: 1,
        scaleMax: 5,
        scoreValueSource: "answer_option_value",
        reason: null,
      }),
    },
  );

  assert.equal(inserted.ok, true);
  if (inserted.ok) {
    assert.equal(inserted.mode, "inserted");
    assert.equal(inserted.value.scoringVersion, TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION);
    assert.equal(inserted.value.scoringStatus, "scored");
    assert.equal(inserted.value.attemptId, "attempt-1");
  }
  assert.equal(scoredSupabase.state.team_assessment_participant_scores.length, 1);
  assert.equal(
    scoredSupabase.state.team_assessment_participant_scores[0].attempt_id,
    "attempt-1",
  );
  assert.deepEqual(
    scoredSupabase.state.team_assessment_participant_scores[0].score_snapshot,
    {
      status: "scored",
      supportedQuestionCount: 1,
      scoredQuestionCount: 1,
      rawTotal: 4,
      meanRaw: 4,
      score0To100: 75,
      missingQuestionIds: [],
      ignoredInvalidAnswerCount: 0,
      scaleMin: 1,
      scaleMax: 5,
      scoreValueSource: "answer_option_value",
      reason: null,
    },
  );
  assert.equal(
    scoredSupabase.state.team_assessment_participant_scores[0].source_response_count,
    1,
  );

  const updated = await persistTeamAssessmentMinimalScoreForContext(
    {
      context: completedContext,
      uiOnlyItems,
      scoringVersion: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
    },
    {
      supabase: scoredSupabase,
      loadMinimalScoreForContext: async () => ({
        status: "scored",
        supportedQuestionCount: 1,
        scoredQuestionCount: 1,
        rawTotal: 5,
        meanRaw: 5,
        score0To100: 100,
        missingQuestionIds: [],
        ignoredInvalidAnswerCount: 0,
        scaleMin: 1,
        scaleMax: 5,
        scoreValueSource: "answer_option_value",
        reason: null,
      }),
    },
  );

  assert.equal(updated.ok, true);
  if (updated.ok) {
    assert.equal(updated.mode, "updated");
  }
  assert.equal(scoredSupabase.state.team_assessment_participant_scores.length, 1);
  assert.equal(
    scoredSupabase.state.team_assessment_participant_scores[0].score_0_100,
    100,
  );
  assert.equal(
    scoredSupabase.state.team_assessment_participant_scores[0].raw_total,
    5,
  );

  const notReadySupabase = createSupabaseStub({
    attempts: [
      {
        id: "attempt-1",
        completed_at: "2026-05-23T10:15:00.000Z",
      },
    ],
  });

  const notReady = await persistTeamAssessmentMinimalScoreForContext(
    {
      context: completedContext,
      uiOnlyItems,
    },
    {
      supabase: notReadySupabase,
      loadMinimalScoreForContext: async () => ({
        status: "not_ready",
        supportedQuestionCount: 2,
        scoredQuestionCount: 1,
        rawTotal: null,
        meanRaw: null,
        score0To100: null,
        missingQuestionIds: ["question-2"],
        ignoredInvalidAnswerCount: 1,
        scaleMin: 1,
        scaleMax: 5,
        scoreValueSource: null,
        reason: "completion_readiness_not_satisfied",
      }),
    },
  );

  assert.equal(notReady.ok, true);
  if (notReady.ok) {
    assert.equal(notReady.value.scoringStatus, "not_ready");
  }
  assert.equal(notReadySupabase.state.team_assessment_participant_scores.length, 1);
  assert.deepEqual(
    notReadySupabase.state.team_assessment_participant_scores[0].missing_question_ids,
    ["question-2"],
  );

  const notCompletedSupabase = createSupabaseStub({
    attempts: [
      {
        id: "attempt-1",
        completed_at: null,
      },
    ],
  });

  const notCompleted = await persistTeamAssessmentMinimalScoreForContext(
    {
      context: {
        ...completedContext,
        wrapperStatus: "started",
        attemptStatus: "in_progress",
      },
      uiOnlyItems,
    },
    {
      supabase: notCompletedSupabase,
      loadMinimalScoreForContext: async () => ({
        status: "not_completed",
        supportedQuestionCount: 1,
        scoredQuestionCount: 0,
        rawTotal: null,
        meanRaw: null,
        score0To100: null,
        missingQuestionIds: ["question-1"],
        ignoredInvalidAnswerCount: 0,
        scaleMin: null,
        scaleMax: null,
        scoreValueSource: null,
        reason: "wrapper_or_attempt_not_completed",
      }),
    },
  );

  assert.deepEqual(notCompleted, {
    ok: false,
    code: "score_not_persistable",
    reason: "Team Dynamics minimal score is not in a persistable completed-state status.",
    score: {
      status: "not_completed",
      supportedQuestionCount: 1,
      scoredQuestionCount: 0,
      rawTotal: null,
      meanRaw: null,
      score0To100: null,
      missingQuestionIds: ["question-1"],
      ignoredInvalidAnswerCount: 0,
      scaleMin: null,
      scaleMax: null,
      scoreValueSource: null,
      reason: "wrapper_or_attempt_not_completed",
    },
  });
  assert.equal(notCompletedSupabase.state.team_assessment_participant_scores.length, 0);

  const wrapperScopedSupabase = createSupabaseStub({
    attempts: [
      {
        id: "attempt-1",
        completed_at: "2026-05-23T10:15:00.000Z",
      },
    ],
  });

  const wrapperScoped = await persistTeamAssessmentMinimalScore(
    {
      userId: "user-1",
      teamAssessmentParticipantId: "tap-1",
    },
    {
      supabase: wrapperScopedSupabase,
      loadExecutionContext: async () => ({
        ok: true,
        context: completedContext,
      }),
      loadQuestionOutline: async () => ({
        orderedQuestionIds: ["question-1"],
        questions: [],
        locale: "bs",
        count: 1,
      }),
      loadUiOnlyItems: async () => ({
        items: uiOnlyItems,
        itemCount: uiOnlyItems.length,
        unsupportedCount: 0,
        mode: "ready",
      }),
      loadMinimalScoreForContext: async () => ({
        status: "not_scored",
        supportedQuestionCount: 1,
        scoredQuestionCount: 0,
        rawTotal: null,
        meanRaw: null,
        score0To100: null,
        missingQuestionIds: [],
        ignoredInvalidAnswerCount: 0,
        scaleMin: null,
        scaleMax: null,
        scoreValueSource: null,
        reason: "missing_numeric_option_value",
      }),
    },
  );

  assert.equal(wrapperScoped.ok, true);
  if (wrapperScoped.ok) {
    assert.equal(wrapperScoped.value.scoringStatus, "not_scored");
  }
  assert.equal(wrapperScopedSupabase.state.team_assessment_participant_scores.length, 1);

  const deniedSupabase = createSupabaseStub();
  const denied = await persistTeamAssessmentMinimalScore(
    {
      userId: "user-2",
      teamAssessmentParticipantId: "tap-other",
    },
    {
      supabase: deniedSupabase,
      loadExecutionContext: async () => ({
        ok: false,
        code: "wrapper_access_denied",
        message: "Wrapper access denied.",
      }),
    },
  );

  assert.deepEqual(denied, {
    ok: false,
    code: "wrapper_access_denied",
    reason: "Wrapper access denied.",
  });
  assert.equal(deniedSupabase.state.team_assessment_participant_scores.length, 0);

  for (const state of [
    scoredSupabase.state,
    notReadySupabase.state,
    notCompletedSupabase.state,
    wrapperScopedSupabase.state,
    deniedSupabase.state,
  ]) {
    assert.equal(state.attempt_reports.length, 0);
    assert.equal(state.assessment_reports.length, 0);
  }

  console.log("test-team-dynamics-score-persistence: ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
