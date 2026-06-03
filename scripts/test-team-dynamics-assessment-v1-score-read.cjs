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
  path.join(projectRoot, "lib", "assessment", "team-dynamics-mixed-score-read.ts"),
  "utf8",
);

assert.match(readSource, /loadTeamDynamicsMixedScoreVerification/);
assert.match(readSource, /TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION/);
assert.match(readSource, /loadTeamAssessmentExecutionContext/);
assert.match(readSource, /\.from\("team_assessment_participants"\)/);
assert.match(readSource, /\.from\("participants"\)/);
assert.match(readSource, /\.from\("team_assessment_participant_scores"\)/);
assert.doesNotMatch(readSource, /\.insert\(/);
assert.doesNotMatch(readSource, /\.update\(/);
assert.doesNotMatch(readSource, /\.upsert\(/);
assert.doesNotMatch(readSource, /attempt_reports/);
assert.doesNotMatch(readSource, /assessment_reports/);
assert.doesNotMatch(readSource, /aggregate/i);
assert.doesNotMatch(readSource, /Team Fit/i);
assert.doesNotMatch(readSource, /AI generation/i);

const {
  buildTeamDynamicsMixedScore,
} = require("../lib/assessment/team-dynamics-mixed-scoring.ts");
const {
  TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
  persistTeamDynamicsMixedScoreForContext,
} = require("../lib/assessment/team-dynamics-mixed-score-persistence.ts");
const {
  loadTeamDynamicsMixedScoreVerification,
} = require("../lib/assessment/team-dynamics-mixed-score-read.ts");

const completedContext = {
  teamAssessmentParticipantId: "tap-final-1",
  teamAssessmentAssignmentId: "assignment-1",
  teamMembershipId: "membership-1",
  participantId: "participant-1",
  attemptId: "attempt-final-1",
  teamId: "team-1",
  organizationId: "org-1",
  packageSlug: "team_dynamics_assessment_v1",
  wrapperStatus: "completed",
  attemptStatus: "completed",
  locale: "bs",
  test: {
    id: "test-final-1",
    slug: "team_dynamics_assessment_v1",
    name: "Team Dynamics Final",
    status: "active",
    isActive: true,
  },
};

const runtimeHandoff = {
  testSlug: "team_dynamics_assessment_v1",
  assessmentKey: "team_dynamics_assessment_v1",
  importMode: "package",
  locale: "bs",
  scoringMethod: "mixed_v1",
  blockCount: 4,
  itemCount: 5,
  likertItemCount: 4,
  sjtScenarioCount: 1,
  outcomePulseItemCount: 1,
  warnings: [],
  unsupportedItems: [],
  blocks: [
    {
      blockKey: "tdm-31-V1",
      blockType: "likert",
      displayOrder: 1,
      title: "Razvojna zrelost tima",
      itemCodes: ["TDM31_01", "TDM31_03"],
      itemCount: 2,
      metadata: {
        response_scale: "likert_1_4_agreement",
        reverse_scored_items: [3, 15, 16, 27],
        scoring: {
          phase_1: {
            method: "simple_linear_v1",
          },
        },
        domain_mapping: {
          Communication: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 28, 29, 30],
          "Roles and Goals": [15, 16, 17, 19],
          Cohesion: [22, 23, 25, 26],
          "Team Primacy": [18, 20],
          overall_rasch_only: [11, 12, 13, 21, 24, 27, 31],
        },
      },
    },
    {
      blockKey: "psychological_safety",
      blockType: "likert",
      displayOrder: 2,
      title: "Psiholoska sigurnost u timu",
      itemCodes: ["TPSDP_1"],
      itemCount: 1,
      metadata: {
        response_scale: "likert_1_4_agreement",
        scoring_mode: "simple_linear_v1",
      },
    },
    {
      blockKey: "situational_judgment",
      blockType: "sjt_best_worst",
      displayOrder: 3,
      title: "Timsko prosudjivanje u situacijama",
      itemCodes: ["SJT_TD_01"],
      itemCount: 1,
      metadata: {},
    },
    {
      blockKey: "outcome_pulse",
      blockType: "likert",
      displayOrder: 4,
      title: "Ishodi timskog rada",
      itemCodes: ["OUTCOME_1"],
      itemCount: 1,
      metadata: {
        response_scale: "likert_1_4_agreement",
        scoring_mode: "simple_linear_v1",
      },
    },
  ],
  items: [
    {
      questionId: "question-tdm-1",
      code: "TDM31_01",
      order: 1,
      blockKey: "tdm-31-V1",
      responseFormat: "single_select_likert",
      questionType: "single_choice",
      localizedText: "Q1",
      metadata: {
        reverse_scored: false,
        domain_group: "Communication",
        domain_scored: true,
      },
      options: [
        { optionId: "tdm1-1", code: "1", label: "1", value: 1, order: 1, metadata: {} },
        { optionId: "tdm1-2", code: "2", label: "2", value: 2, order: 2, metadata: {} },
        { optionId: "tdm1-3", code: "3", label: "3", value: 3, order: 3, metadata: {} },
        { optionId: "tdm1-4", code: "4", label: "4", value: 4, order: 4, metadata: {} },
      ],
    },
    {
      questionId: "question-tdm-3",
      code: "TDM31_03",
      order: 2,
      blockKey: "tdm-31-V1",
      responseFormat: "single_select_likert",
      questionType: "single_choice",
      localizedText: "Q2",
      metadata: {
        reverse_scored: true,
        domain_group: "Communication",
        domain_scored: true,
      },
      options: [
        { optionId: "tdm3-1", code: "1", label: "1", value: 1, order: 1, metadata: {} },
        { optionId: "tdm3-2", code: "2", label: "2", value: 2, order: 2, metadata: {} },
        { optionId: "tdm3-3", code: "3", label: "3", value: 3, order: 3, metadata: {} },
        { optionId: "tdm3-4", code: "4", label: "4", value: 4, order: 4, metadata: {} },
      ],
    },
    {
      questionId: "question-ps-1",
      code: "TPSDP_1",
      order: 3,
      blockKey: "psychological_safety",
      responseFormat: "single_select_likert",
      questionType: "single_choice",
      localizedText: "Q3",
      metadata: {
        reverse_scored: false,
      },
      options: [
        { optionId: "ps1-1", code: "1", label: "1", value: 1, order: 1, metadata: {} },
        { optionId: "ps1-2", code: "2", label: "2", value: 2, order: 2, metadata: {} },
        { optionId: "ps1-3", code: "3", label: "3", value: 3, order: 3, metadata: {} },
        { optionId: "ps1-4", code: "4", label: "4", value: 4, order: 4, metadata: {} },
      ],
    },
    {
      questionId: "question-sjt-1",
      code: "SJT_TD_01",
      order: 4,
      blockKey: "situational_judgment",
      responseFormat: "best_worst",
      questionType: "multiple_choice",
      localizedText: "Scenario",
      metadata: {
        primary_dimension: "constructive_conflict",
      },
      options: [
        {
          optionId: "sjt-a",
          code: "A",
          label: "A",
          value: null,
          order: 1,
          metadata: { best_choice_points: 1, worst_choice_points: 0 },
        },
        {
          optionId: "sjt-b",
          code: "B",
          label: "B",
          value: null,
          order: 2,
          metadata: { best_choice_points: 0, worst_choice_points: 1 },
        },
        {
          optionId: "sjt-c",
          code: "C",
          label: "C",
          value: null,
          order: 3,
          metadata: { best_choice_points: -1, worst_choice_points: 2 },
        },
        {
          optionId: "sjt-d",
          code: "D",
          label: "D",
          value: null,
          order: 4,
          metadata: { best_choice_points: 2, worst_choice_points: -1 },
        },
      ],
    },
    {
      questionId: "question-outcome-1",
      code: "OUTCOME_1",
      order: 5,
      blockKey: "outcome_pulse",
      responseFormat: "single_select_likert",
      questionType: "single_choice",
      localizedText: "Outcome",
      metadata: {
        reverse_scored: false,
      },
      options: [
        { optionId: "out1-1", code: "1", label: "1", value: 1, order: 1, metadata: {} },
        { optionId: "out1-2", code: "2", label: "2", value: 2, order: 2, metadata: {} },
        { optionId: "out1-3", code: "3", label: "3", value: 3, order: 3, metadata: {} },
        { optionId: "out1-4", code: "4", label: "4", value: 4, order: 4, metadata: {} },
      ],
    },
  ],
};

const savedAnswerState = {
  savedLikertSelectionsByQuestionId: {
    "question-tdm-1": "tdm1-4",
    "question-tdm-3": "tdm3-1",
    "question-ps-1": "ps1-3",
    "question-outcome-1": "out1-2",
  },
  savedSjtSelectionsByQuestionId: {
    "question-sjt-1": {
      bestOptionId: "sjt-d",
      worstOptionId: "sjt-c",
    },
  },
  savedAnswerCount: 5,
  invalidSavedAnswerCount: 0,
  ignoredStaleAnswerCount: 0,
  warnings: [],
};

function createSupabaseStub(initialState = {}) {
  let scoreRowCounter = 0;
  const state = {
    team_assessment_participants: [...(initialState.team_assessment_participants ?? [])],
    participants: [...(initialState.participants ?? [])],
    team_assessment_participant_scores: [
      ...(initialState.team_assessment_participant_scores ?? []),
    ],
    attempts: [...(initialState.attempts ?? [])],
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
              const updatedRows = rows.map((row) => Object.assign(row, query.patch ?? {}));
              const payload = query.single ? updatedRows[0] ?? null : updatedRows;
              return Promise.resolve({ data: payload, error: null }).then(resolve, reject);
            }

            if (query.mode === "insert") {
              const insertedRows = (query.insertRows ?? []).map((row) => {
                scoreRowCounter += 1;
                const nextRow = {
                  id: row.id ?? `mixed-score-row-${scoreRowCounter}`,
                  created_at: row.created_at ?? "2026-05-28T12:00:00.000Z",
                  updated_at: row.updated_at ?? "2026-05-28T12:00:00.000Z",
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
  const score = buildTeamDynamicsMixedScore({
    context: completedContext,
    runtimeHandoff,
    savedAnswerState,
  });
  assert.equal(score.status, "scored");

  const executionCalls = [];
  const loadExecutionContext = async ({ teamAssessmentParticipantId, userId }) => {
    executionCalls.push({ teamAssessmentParticipantId, userId });
    assert.equal(teamAssessmentParticipantId, "tap-final-1");
    assert.equal(userId, "user-1");
    return {
      ok: true,
      context: completedContext,
    };
  };

  const notFoundSupabase = createSupabaseStub({
    team_assessment_participants: [
      {
        id: "tap-final-1",
        participant_id: "participant-1",
      },
    ],
    participants: [
      {
        id: "participant-1",
        user_id: "user-1",
      },
    ],
  });

  const notFound = await loadTeamDynamicsMixedScoreVerification(
    {
      teamAssessmentParticipantId: "tap-final-1",
    },
    {
      supabase: notFoundSupabase,
      loadExecutionContext,
    },
  );
  assert.equal(notFound.status, "not_found");
  assert.equal(notFound.teamAssessmentParticipantId, "tap-final-1");
  assert.equal(notFound.scoringVersion, TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION);
  assert.equal(notFound.hasTopLevelOverallScore, false);
  assert.equal(notFound.scoreRowId, null);

  const scoredSupabase = createSupabaseStub({
    team_assessment_participants: [
      {
        id: "tap-final-1",
        participant_id: "participant-1",
      },
    ],
    participants: [
      {
        id: "participant-1",
        user_id: "user-1",
      },
    ],
    attempts: [
      {
        id: "attempt-final-1",
        completed_at: "2026-05-28T12:00:00.000Z",
      },
    ],
  });

  const persisted = await persistTeamDynamicsMixedScoreForContext(
    {
      context: completedContext,
      scoringVersion: TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
    },
    {
      supabase: scoredSupabase,
      loadScoreForContext: async () => score,
    },
  );
  assert.equal(persisted.ok, true);

  const operationsBeforeReadyRead = scoredSupabase.operations.length;
  const ready = await loadTeamDynamicsMixedScoreVerification(
    {
      teamAssessmentParticipantId: "tap-final-1",
    },
    {
      supabase: scoredSupabase,
      loadExecutionContext,
    },
  );
  assert.equal(ready.status, "ready");
  assert.equal(ready.scoreRowId, "mixed-score-row-1");
  assert.equal(ready.testSlug, "team_dynamics_assessment_v1");
  assert.equal(ready.hasTopLevelOverallScore, false);
  assert.equal(ready.hasTdmBlockScore, true);
  assert.equal(ready.hasTdmDomainScores, true);
  assert.equal(ready.hasPsychologicalSafetyScore, true);
  assert.equal(ready.hasSjtScore, true);
  assert.equal(ready.hasOutcomePulseScore, true);
  assert.equal(ready.scoreEntries.length, 5);
  assert.ok(ready.scoreEntries.some((entry) => entry.scoreKey === "tdm-31-V1_overall"));
  assert.ok(ready.scoreEntries.some((entry) => entry.scoreKey.startsWith("tdm_domain_")));
  assert.ok(
    ready.scoreEntries.some((entry) => entry.scoreKey === "psychological_safety_overall"),
  );
  assert.ok(
    ready.scoreEntries.some((entry) => entry.scoreKey === "situational_judgment_overall"),
  );
  assert.ok(ready.scoreEntries.some((entry) => entry.scoreKey === "outcome_pulse_overall"));
  assert.equal(scoredSupabase.state.team_assessment_participant_scores.length, 1);
  const writesAfterReadyRead = scoredSupabase.operations
    .slice(operationsBeforeReadyRead)
    .filter((operation) => operation.type === "insert" || operation.type === "update");
  assert.deepEqual(writesAfterReadyRead, []);

  const operationsBeforeSecondRead = scoredSupabase.operations.length;
  const rowCountBeforeSecondRead = scoredSupabase.state.team_assessment_participant_scores.length;
  const readyAgain = await loadTeamDynamicsMixedScoreVerification(
    {
      teamAssessmentParticipantId: "tap-final-1",
    },
    {
      supabase: scoredSupabase,
      loadExecutionContext,
    },
  );
  assert.deepEqual(readyAgain, ready);
  assert.equal(scoredSupabase.state.team_assessment_participant_scores.length, rowCountBeforeSecondRead);
  const writesAfterSecondRead = scoredSupabase.operations
    .slice(operationsBeforeSecondRead)
    .filter((operation) => operation.type === "insert" || operation.type === "update");
  assert.deepEqual(writesAfterSecondRead, []);

  const invalidSupabase = createSupabaseStub({
    team_assessment_participants: [
      {
        id: "tap-final-1",
        participant_id: "participant-1",
      },
    ],
    participants: [
      {
        id: "participant-1",
        user_id: "user-1",
      },
    ],
    team_assessment_participant_scores: [
      {
        id: "invalid-score-row-1",
        team_assessment_participant_id: "tap-final-1",
        scoring_version: TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
        scoring_status: "scored",
        raw_total: null,
        mean_raw: null,
        score_0_100: null,
        score_snapshot: {
          status: "scored",
          blocks: [],
        },
        created_at: "2026-05-28T12:00:00.000Z",
        updated_at: "2026-05-28T12:05:00.000Z",
        calculated_at: "2026-05-28T12:05:00.000Z",
      },
    ],
  });

  const invalid = await loadTeamDynamicsMixedScoreVerification(
    {
      teamAssessmentParticipantId: "tap-final-1",
    },
    {
      supabase: invalidSupabase,
      loadExecutionContext,
    },
  );
  assert.equal(invalid.status, "invalid");
  assert.equal(invalid.scoreRowId, "invalid-score-row-1");
  assert.equal(invalid.reason, "invalid_score_snapshot_shape");
  assert.equal(invalid.hasTopLevelOverallScore, false);
  assert.deepEqual(invalid.scoreEntries, []);

  assert.equal(scoredSupabase.state.attempt_reports.length, 0);
  assert.equal(scoredSupabase.state.assessment_reports.length, 0);
  assert.equal(notFoundSupabase.state.attempt_reports.length, 0);
  assert.equal(notFoundSupabase.state.assessment_reports.length, 0);
  assert.equal(invalidSupabase.state.attempt_reports.length, 0);
  assert.equal(invalidSupabase.state.assessment_reports.length, 0);
  assert.equal(executionCalls.length, 4);

  console.log("test-team-dynamics-assessment-v1-score-read: ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
