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

const aggregationSource = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "team-dynamics-final-aggregation.ts"),
  "utf8",
);
const persistenceSource = fs.readFileSync(
  path.join(
    projectRoot,
    "lib",
    "assessment",
    "team-dynamics-final-aggregation-persistence.ts",
  ),
  "utf8",
);

assert.match(aggregationSource, /teamAssessmentAssignmentId/);
assert.match(aggregationSource, /\.from\("team_assessment_assignments"\)/);
assert.match(aggregationSource, /\.from\("team_assessment_participants"\)/);
assert.match(aggregationSource, /\.from\("team_assessment_participant_scores"\)/);
assert.doesNotMatch(aggregationSource, /loadTeamDynamicsMixedScoreForContext/);
assert.doesNotMatch(aggregationSource, /responses/);
assert.doesNotMatch(aggregationSource, /completeTeamDynamicsMixedAssessmentAction/);
assert.doesNotMatch(aggregationSource, /attempt_reports/);
assert.doesNotMatch(aggregationSource, /assessment_reports/);
assert.match(persistenceSource, /\.from\("team_assessment_aggregation_snapshots"\)/);

const {
  buildTeamDynamicsMixedScore,
} = require("../lib/assessment/team-dynamics-mixed-scoring.ts");
const {
  TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
} = require("../lib/assessment/team-dynamics-mixed-score-persistence.ts");
const {
  TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION,
  loadTeamDynamicsFinalAggregation,
} = require("../lib/assessment/team-dynamics-final-aggregation.ts");
const {
  persistTeamDynamicsFinalAggregationSnapshot,
} = require("../lib/assessment/team-dynamics-final-aggregation-persistence.ts");

const baseContext = {
  teamAssessmentAssignmentId: "assignment-1",
  teamMembershipId: "membership-1",
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

function createMixedScore(teamAssessmentParticipantId, participantId, attemptId, answers) {
  const score = buildTeamDynamicsMixedScore({
    context: {
      ...baseContext,
      teamAssessmentParticipantId,
      participantId,
      attemptId,
    },
    runtimeHandoff,
    savedAnswerState: answers,
  });
  assert.equal(score.status, "scored");
  return score;
}

const scoreA = createMixedScore("tap-1", "participant-1", "attempt-1", {
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
});

const scoreB = createMixedScore("tap-2", "participant-2", "attempt-2", {
  savedLikertSelectionsByQuestionId: {
    "question-tdm-1": "tdm1-2",
    "question-tdm-3": "tdm3-2",
    "question-ps-1": "ps1-2",
    "question-outcome-1": "out1-4",
  },
  savedSjtSelectionsByQuestionId: {
    "question-sjt-1": {
      bestOptionId: "sjt-a",
      worstOptionId: "sjt-b",
    },
  },
  savedAnswerCount: 5,
  invalidSavedAnswerCount: 0,
  ignoredStaleAnswerCount: 0,
  warnings: [],
});

const scoreC = createMixedScore("tap-3", "participant-3", "attempt-3", {
  savedLikertSelectionsByQuestionId: {
    "question-tdm-1": "tdm1-3",
    "question-tdm-3": "tdm3-4",
    "question-ps-1": "ps1-4",
    "question-outcome-1": "out1-1",
  },
  savedSjtSelectionsByQuestionId: {
    "question-sjt-1": {
      bestOptionId: "sjt-b",
      worstOptionId: "sjt-d",
    },
  },
  savedAnswerCount: 5,
  invalidSavedAnswerCount: 0,
  ignoredStaleAnswerCount: 0,
  warnings: [],
});

function createSupabaseStub(initialState = {}) {
  let aggregationRowCounter = 0;
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
        in(column, values) {
          query.filters.push({ type: "in", column, values });
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
                aggregationRowCounter += 1;
                const nextRow = {
                  id: row.id ?? `final-aggregation-row-${aggregationRowCounter}`,
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

function buildReadyState() {
  return {
    team_assessment_assignments: [
      {
        id: "assignment-1",
        team_id: "team-1",
        package_slug: "team_dynamics_assessment_v1",
      },
    ],
    team_assessment_participants: [
      {
        id: "tap-1",
        team_assessment_assignment_id: "assignment-1",
        participant_id: "participant-1",
        status: "completed",
      },
      {
        id: "tap-2",
        team_assessment_assignment_id: "assignment-1",
        participant_id: "participant-2",
        status: "completed",
      },
      {
        id: "tap-3",
        team_assessment_assignment_id: "assignment-1",
        participant_id: "participant-3",
        status: "completed",
      },
    ],
    team_assessment_participant_scores: [
      {
        id: "score-row-1",
        team_assessment_participant_id: "tap-1",
        scoring_version: TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
        scoring_status: "scored",
        raw_total: null,
        mean_raw: null,
        score_0_100: null,
        score_snapshot: scoreA,
        calculated_at: "2026-05-28T12:00:00.000Z",
      },
      {
        id: "score-row-2",
        team_assessment_participant_id: "tap-2",
        scoring_version: TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
        scoring_status: "scored",
        raw_total: null,
        mean_raw: null,
        score_0_100: null,
        score_snapshot: scoreB,
        calculated_at: "2026-05-28T12:01:00.000Z",
      },
      {
        id: "score-row-3",
        team_assessment_participant_id: "tap-3",
        scoring_version: TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
        scoring_status: "scored",
        raw_total: null,
        mean_raw: null,
        score_0_100: null,
        score_snapshot: scoreC,
        calculated_at: "2026-05-28T12:02:00.000Z",
      },
    ],
  };
}

(async () => {
  const readySupabase = createSupabaseStub(buildReadyState());
  const readyAggregation = await loadTeamDynamicsFinalAggregation(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase: readySupabase,
    },
  );

  assert.equal(readyAggregation.status, "ready");
  assert.equal(readyAggregation.teamId, "team-1");
  assert.equal(readyAggregation.aggregationVersion, TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION);
  assert.equal(readyAggregation.scoringVersion, TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION);
  assert.equal(readyAggregation.participantCount, 3);
  assert.equal(readyAggregation.completedParticipantCount, 3);
  assert.equal(readyAggregation.incompleteMemberCount, 0);
  assert.equal(readyAggregation.readyScoredMemberCount, 3);
  assert.equal(readyAggregation.missingScoreCount, 0);
  assert.equal(readyAggregation.invalidScoreCount, 0);
  assert.equal(readyAggregation.hasTopLevelOverallScore, false);
  assert.equal(readyAggregation.teamOverallScore0To100, null);
  assert.equal(readyAggregation.meanScore0To100, null);
  assert.equal(readyAggregation.outcomePulseAggregationEntry.entryType, "outcome_signal");
  assert.equal(
    readyAggregation.scoreEntryAggregations.some((entry) => entry.scoreKey === "tdm-31-V1_overall"),
    true,
  );
  assert.equal(
    readyAggregation.scoreEntryAggregations.some((entry) => entry.scoreKey === "psychological_safety_overall"),
    true,
  );
  assert.equal(
    readyAggregation.scoreEntryAggregations.some((entry) => entry.scoreKey === "situational_judgment_overall"),
    true,
  );
  assert.equal(
    readyAggregation.scoreEntryAggregations.some((entry) => entry.scoreKey === "outcome_pulse_overall"),
    true,
  );
  assert.equal(
    readyAggregation.tdmDomainAggregations.some((entry) => entry.scoreKey === "tdm_domain_communication"),
    true,
  );
  const tdmOverall = readyAggregation.scoreEntryAggregations.find(
    (entry) => entry.scoreKey === "tdm-31-V1_overall",
  );
  assert.equal(tdmOverall.memberCount, 3);
  assert.equal(tdmOverall.meanScore0To100, 61.11);
  assert.equal(tdmOverall.minScore0To100, 33.33);
  assert.equal(tdmOverall.maxScore0To100, 100);
  assert.equal(tdmOverall.standardDeviationScore0To100, 28.33);
  assert.equal(readySupabase.state.attempt_reports.length, 0);
  assert.equal(readySupabase.state.assessment_reports.length, 0);

  const incompleteSupabase = createSupabaseStub({
    ...buildReadyState(),
    team_assessment_participants: [
      buildReadyState().team_assessment_participants[0],
      {
        id: "tap-2",
        team_assessment_assignment_id: "assignment-1",
        participant_id: "participant-2",
        status: "started",
      },
    ],
    team_assessment_participant_scores: [
      buildReadyState().team_assessment_participant_scores[0],
    ],
  });
  const incompleteAggregation = await loadTeamDynamicsFinalAggregation(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase: incompleteSupabase,
    },
  );
  assert.equal(incompleteAggregation.status, "not_ready");
  assert.equal(incompleteAggregation.participantCount, 2);
  assert.equal(incompleteAggregation.completedParticipantCount, 1);
  assert.equal(incompleteAggregation.incompleteMemberCount, 1);
  assert.equal(incompleteAggregation.readyScoredMemberCount, 1);
  assert.equal(incompleteAggregation.missingScoreCount, 0);
  assert.equal(incompleteAggregation.invalidScoreCount, 0);
  assert.deepEqual(incompleteAggregation.scoreEntryAggregations, []);
  assert.deepEqual(incompleteAggregation.incompleteMemberParticipantIds, ["tap-2"]);
  assert.match(incompleteAggregation.reasons.join(","), /incomplete_included_members/);

  const incompletePersisted = await persistTeamDynamicsFinalAggregationSnapshot(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase: incompleteSupabase,
    },
  );
  assert.equal(incompletePersisted.ok, true);
  if (incompletePersisted.ok) {
    assert.equal(incompletePersisted.value.aggregationStatus, "not_ready");
    assert.equal(incompletePersisted.value.aggregation.scoreEntryAggregations.length, 0);
  }
  assert.equal(incompleteSupabase.state.team_assessment_aggregation_snapshots.length, 1);
  assert.equal(
    incompleteSupabase.state.team_assessment_aggregation_snapshots[0].aggregation_status,
    "not_ready",
  );

  const missingSupabase = createSupabaseStub({
    ...buildReadyState(),
    team_assessment_participant_scores: buildReadyState().team_assessment_participant_scores.slice(0, 2),
  });
  const missingAggregation = await loadTeamDynamicsFinalAggregation(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase: missingSupabase,
    },
  );
  assert.equal(missingAggregation.status, "not_ready");
  assert.equal(missingAggregation.incompleteMemberCount, 0);
  assert.equal(missingAggregation.readyScoredMemberCount, 2);
  assert.equal(missingAggregation.missingScoreCount, 1);
  assert.equal(missingAggregation.invalidScoreCount, 0);
  assert.deepEqual(missingAggregation.scoreEntryAggregations, []);
  assert.match(missingAggregation.reasons.join(","), /missing_completed_score_snapshots/);

  const invalidSupabase = createSupabaseStub({
    ...buildReadyState(),
    team_assessment_participant_scores: [
      buildReadyState().team_assessment_participant_scores[0],
      {
        ...buildReadyState().team_assessment_participant_scores[1],
        score_snapshot: {
          status: "scored",
          blocks: [],
        },
      },
      buildReadyState().team_assessment_participant_scores[2],
    ],
  });
  const invalidAggregation = await loadTeamDynamicsFinalAggregation(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase: invalidSupabase,
    },
  );
  assert.equal(invalidAggregation.status, "not_ready");
  assert.equal(invalidAggregation.incompleteMemberCount, 0);
  assert.equal(invalidAggregation.missingScoreCount, 0);
  assert.equal(invalidAggregation.invalidScoreCount, 1);
  assert.deepEqual(invalidAggregation.scoreEntryAggregations, []);
  assert.match(invalidAggregation.reasons.join(","), /invalid_completed_score_snapshots/);

  const persistenceSupabase = createSupabaseStub(buildReadyState());
  const inserted = await persistTeamDynamicsFinalAggregationSnapshot(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase: persistenceSupabase,
    },
  );
  assert.equal(inserted.ok, true);
  if (inserted.ok) {
    assert.equal(inserted.mode, "inserted");
    assert.equal(inserted.value.aggregationStatus, "ready");
    assert.equal(inserted.value.aggregation.teamOverallScore0To100, null);
  }
  assert.equal(persistenceSupabase.state.team_assessment_aggregation_snapshots.length, 1);
  const persistedRow = persistenceSupabase.state.team_assessment_aggregation_snapshots[0];
  assert.equal(persistedRow.aggregation_version, TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION);
  assert.equal(persistedRow.aggregation_status, "ready");
  assert.equal(persistedRow.mean_score_0_100, null);
  assert.equal(persistedRow.min_score_0_100, null);
  assert.equal(persistedRow.max_score_0_100, null);
  assert.equal(
    persistedRow.aggregation_snapshot.outcomePulseAggregationEntry.scoreKey,
    "outcome_pulse_overall",
  );

  const updated = await persistTeamDynamicsFinalAggregationSnapshot(
    {
      teamAssessmentAssignmentId: "assignment-1",
    },
    {
      supabase: persistenceSupabase,
      loadFinalAggregation: async () => ({
        ...readyAggregation,
        scoreEntryAggregations: readyAggregation.scoreEntryAggregations.map((entry) =>
          entry.scoreKey === "outcome_pulse_overall"
            ? { ...entry, meanScore0To100: 99.99 }
            : entry,
        ),
        outcomePulseAggregationEntry: {
          ...readyAggregation.outcomePulseAggregationEntry,
          meanScore0To100: 99.99,
        },
      }),
    },
  );
  assert.equal(updated.ok, true);
  if (updated.ok) {
    assert.equal(updated.mode, "updated");
  }
  assert.equal(persistenceSupabase.state.team_assessment_aggregation_snapshots.length, 1);
  assert.equal(
    persistenceSupabase.state.team_assessment_aggregation_snapshots[0].aggregation_snapshot
      .outcomePulseAggregationEntry.meanScore0To100,
    99.99,
  );

  assert.equal(
    readySupabase.operations.some((operation) => operation.table === "attempt_reports"),
    false,
  );
  assert.equal(
    readySupabase.operations.some((operation) => operation.table === "assessment_reports"),
    false,
  );

  console.log("test-team-dynamics-assessment-v1-final-aggregation: ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
