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

const scoringSource = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "team-dynamics-mixed-scoring.ts"),
  "utf8",
);
const persistenceSource = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "team-dynamics-mixed-score-persistence.ts"),
  "utf8",
);

assert.match(scoringSource, /buildTeamDynamicsMixedScore/);
assert.match(scoringSource, /loadTeamDynamicsMixedScoreForContext/);
assert.match(scoringSource, /best_choice_points/);
assert.match(scoringSource, /worst_choice_points/);
assert.match(scoringSource, /unsupported_likert_scoring_contract/);
assert.match(scoringSource, /missing_reverse_scored_metadata/);
assert.match(scoringSource, /invalid_tdm_domain_metadata/);
assert.doesNotMatch(scoringSource, /attempt_reports/);
assert.doesNotMatch(scoringSource, /assessment_reports/);
assert.match(persistenceSource, /TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION/);
assert.match(persistenceSource, /persistTeamDynamicsMixedScoreForContext/);
assert.match(persistenceSource, /\.from\("team_assessment_participant_scores"\)/);
assert.doesNotMatch(persistenceSource, /attempt_reports/);
assert.doesNotMatch(persistenceSource, /assessment_reports/);

const {
  buildTeamDynamicsMixedScore,
} = require("../lib/assessment/team-dynamics-mixed-scoring.ts");
const {
  TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
  persistTeamDynamicsMixedScoreForContext,
} = require("../lib/assessment/team-dynamics-mixed-score-persistence.ts");

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
          query.filters.push({ type: "eq", column, value });
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
                  id: row.id ?? `mixed-score-row-${scoreRowCounter}`,
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
  assert.equal(score.supportedQuestionCount, 5);
  assert.equal(score.scoredQuestionCount, 5);
  assert.equal(score.scoreEntries.length, 5);
  const tdmOverall = score.scoreEntries.find((entry) => entry.scoreKey === "tdm-31-V1_overall");
  assert.equal(tdmOverall.rawTotal, 8);
  assert.equal(tdmOverall.score0To100, 100);
  const tdmCommunication = score.scoreEntries.find(
    (entry) => entry.scoreKey === "tdm_domain_communication",
  );
  assert.equal(tdmCommunication.score0To100, 100);
  const sjtOverall = score.scoreEntries.find(
    (entry) => entry.scoreKey === "situational_judgment_overall",
  );
  assert.equal(sjtOverall.rawTotal, 4);
  assert.equal(sjtOverall.score0To100, 100);
  const psychOverall = score.scoreEntries.find(
    (entry) => entry.scoreKey === "psychological_safety_overall",
  );
  assert.equal(psychOverall.score0To100, 66.67);
  const outcomeOverall = score.scoreEntries.find(
    (entry) => entry.scoreKey === "outcome_pulse_overall",
  );
  assert.equal(outcomeOverall.score0To100, 33.33);

  const unsupportedLikertContractScore = buildTeamDynamicsMixedScore({
    context: completedContext,
    runtimeHandoff: {
      ...runtimeHandoff,
      blocks: runtimeHandoff.blocks.map((block) =>
        block.blockKey === "psychological_safety"
          ? {
              ...block,
              metadata: {
                response_scale: "likert_1_4_agreement",
                scoring_mode: "unsupported_linear_v2",
              },
            }
          : block,
      ),
    },
    savedAnswerState,
  });
  assert.equal(unsupportedLikertContractScore.status, "failed");
  assert.equal(
    unsupportedLikertContractScore.reason,
    "unsupported_likert_scoring_contract",
  );

  const missingReverseScore = buildTeamDynamicsMixedScore({
    context: completedContext,
    runtimeHandoff: {
      ...runtimeHandoff,
      items: runtimeHandoff.items.map((item) =>
        item.code === "TDM31_03"
          ? {
              ...item,
              metadata: {
                domain_group: "Communication",
                domain_scored: true,
              },
            }
          : item,
      ),
    },
    savedAnswerState,
  });
  assert.equal(missingReverseScore.status, "failed");
  assert.equal(missingReverseScore.reason, "missing_reverse_scored_metadata");

  const invalidDomainGroupScore = buildTeamDynamicsMixedScore({
    context: completedContext,
    runtimeHandoff: {
      ...runtimeHandoff,
      items: runtimeHandoff.items.map((item) =>
        item.code === "TDM31_01"
          ? {
              ...item,
              metadata: {
                reverse_scored: false,
                domain_scored: true,
              },
            }
          : item,
      ),
    },
    savedAnswerState,
  });
  assert.equal(invalidDomainGroupScore.status, "failed");
  assert.equal(invalidDomainGroupScore.reason, "invalid_tdm_domain_metadata");

  const missingSjtPointsScore = buildTeamDynamicsMixedScore({
    context: completedContext,
    runtimeHandoff: {
      ...runtimeHandoff,
      items: runtimeHandoff.items.map((item) =>
        item.code === "SJT_TD_01"
          ? {
              ...item,
              options: item.options.map((option) =>
                option.optionId === "sjt-d"
                  ? {
                      ...option,
                      metadata: { worst_choice_points: -1 },
                    }
                  : option,
              ),
            }
          : item,
      ),
    },
    savedAnswerState,
  });
  assert.equal(missingSjtPointsScore.status, "not_scored");
  assert.equal(missingSjtPointsScore.reason, "missing_sjt_scoring_metadata");

  const incompleteScore = buildTeamDynamicsMixedScore({
    context: completedContext,
    runtimeHandoff,
    savedAnswerState: {
      ...savedAnswerState,
      savedLikertSelectionsByQuestionId: {
        "question-tdm-1": "tdm1-4",
      },
      savedSjtSelectionsByQuestionId: {},
      savedAnswerCount: 1,
    },
  });
  assert.equal(incompleteScore.status, "not_ready");
  assert.deepEqual(incompleteScore.missingQuestionIds, [
    "question-tdm-3",
    "question-ps-1",
    "question-sjt-1",
    "question-outcome-1",
  ]);

  const unsupportedScore = buildTeamDynamicsMixedScore({
    context: completedContext,
    runtimeHandoff: {
      ...runtimeHandoff,
      unsupportedItems: [
        {
          questionId: "question-sjt-1",
          code: "SJT_TD_01",
          blockKey: "situational_judgment",
          reason: "unsupported_block_type",
        },
      ],
    },
    savedAnswerState,
  });
  assert.equal(unsupportedScore.status, "failed");
  assert.equal(unsupportedScore.reason, "unsupported_runtime_scoring_shape");

  const scoredSupabase = createSupabaseStub({
    attempts: [
      {
        id: "attempt-final-1",
        completed_at: "2026-05-28T12:00:00.000Z",
      },
    ],
  });

  const inserted = await persistTeamDynamicsMixedScoreForContext(
    {
      context: completedContext,
      scoringVersion: TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
    },
    {
      supabase: scoredSupabase,
      loadScoreForContext: async () => score,
    },
  );
  assert.equal(inserted.ok, true);
  if (inserted.ok) {
    assert.equal(inserted.mode, "inserted");
    assert.equal(inserted.value.scoringStatus, "scored");
  }
  assert.equal(scoredSupabase.state.team_assessment_participant_scores.length, 1);

  const updated = await persistTeamDynamicsMixedScoreForContext(
    {
      context: completedContext,
      scoringVersion: TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
    },
    {
      supabase: scoredSupabase,
      loadScoreForContext: async () => ({
        ...score,
        scoreEntries: score.scoreEntries.map((entry) =>
          entry.scoreKey === "outcome_pulse_overall"
            ? { ...entry, rawTotal: 4, meanRaw: 4, score0To100: 100 }
            : entry,
        ),
      }),
    },
  );
  assert.equal(updated.ok, true);
  if (updated.ok) {
    assert.equal(updated.mode, "updated");
  }
  assert.equal(scoredSupabase.state.team_assessment_participant_scores.length, 1);
  const updatedSnapshot =
    scoredSupabase.state.team_assessment_participant_scores[0].score_snapshot;
  assert.equal(
    updatedSnapshot.scoreEntries.find((entry) => entry.scoreKey === "outcome_pulse_overall").score0To100,
    100,
  );

  const notReadySupabase = createSupabaseStub({
    attempts: [
      {
        id: "attempt-final-1",
        completed_at: "2026-05-28T12:00:00.000Z",
      },
    ],
  });
  const notReady = await persistTeamDynamicsMixedScoreForContext(
    {
      context: completedContext,
    },
    {
      supabase: notReadySupabase,
      loadScoreForContext: async () => incompleteScore,
    },
  );
  assert.deepEqual(notReady, {
    ok: false,
    code: "score_not_persistable",
    reason: "Team Dynamics mixed-format score is not in a persistable completed-state status.",
    score: incompleteScore,
  });
  assert.equal(notReadySupabase.state.team_assessment_participant_scores.length, 0);

  const unsupportedSupabase = createSupabaseStub({
    attempts: [
      {
        id: "attempt-final-1",
        completed_at: "2026-05-28T12:00:00.000Z",
      },
    ],
  });
  const unsupported = await persistTeamDynamicsMixedScoreForContext(
    {
      context: completedContext,
    },
    {
      supabase: unsupportedSupabase,
      loadScoreForContext: async () => unsupportedScore,
    },
  );
  assert.deepEqual(unsupported, {
    ok: false,
    code: "score_not_persistable",
    reason: "Team Dynamics mixed-format score is not in a persistable completed-state status.",
    score: unsupportedScore,
  });
  assert.equal(unsupportedSupabase.state.team_assessment_participant_scores.length, 0);

  const invalidReverseSupabase = createSupabaseStub({
    attempts: [
      {
        id: "attempt-final-1",
        completed_at: "2026-05-28T12:00:00.000Z",
      },
    ],
  });
  const invalidReversePersist = await persistTeamDynamicsMixedScoreForContext(
    {
      context: completedContext,
    },
    {
      supabase: invalidReverseSupabase,
      loadScoreForContext: async () => missingReverseScore,
    },
  );
  assert.deepEqual(invalidReversePersist, {
    ok: false,
    code: "score_not_persistable",
    reason: "Team Dynamics mixed-format score is not in a persistable completed-state status.",
    score: missingReverseScore,
  });
  assert.equal(invalidReverseSupabase.state.team_assessment_participant_scores.length, 0);

  for (const state of [
    scoredSupabase.state,
    notReadySupabase.state,
    unsupportedSupabase.state,
    invalidReverseSupabase.state,
  ]) {
    assert.equal(state.attempt_reports.length, 0);
    assert.equal(state.assessment_reports.length, 0);
  }

  console.log("test-team-dynamics-assessment-v1-scoring: ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
