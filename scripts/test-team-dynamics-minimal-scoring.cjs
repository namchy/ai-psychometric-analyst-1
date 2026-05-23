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
  path.join(projectRoot, "lib", "assessment", "team-assessment-scoring.ts"),
  "utf8",
);

assert.match(source, /export function buildTeamAssessmentMinimalScore/);
assert.match(source, /export async function loadTeamAssessmentMinimalScoreForContext/);
assert.match(source, /export async function loadTeamAssessmentMinimalScore/);
assert.match(source, /\.from\("responses"\)/);
assert.match(source, /\.from\("answer_options"\)/);
assert.match(source, /answer_option_value/);
assert.doesNotMatch(source, /\.insert\(/);
assert.doesNotMatch(source, /\.update\(/);
assert.doesNotMatch(source, /\.upsert\(/);
assert.doesNotMatch(source, /\.delete\(/);
assert.doesNotMatch(source, /attempt_reports/);
assert.doesNotMatch(source, /assessment_reports/);
assert.doesNotMatch(source, /aggregate/i);
assert.doesNotMatch(source, /team fit/i);
assert.doesNotMatch(source, /report orchestration/i);

const {
  buildTeamAssessmentMinimalScore,
  loadTeamAssessmentMinimalScore,
  loadTeamAssessmentMinimalScoreForContext,
} = require("../lib/assessment/team-assessment-scoring.ts");

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
    optionIds: ["option-1", "option-2", "option-3", "option-4", "option-5"],
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
    optionIds: ["option-6", "option-7", "option-8", "option-9", "option-10"],
    options: [],
    locale: "bs",
    isUiOnlySkeleton: true,
  },
];

const answerOptions = [
  { id: "option-1", question_id: "question-1", value: 1 },
  { id: "option-2", question_id: "question-1", value: 2 },
  { id: "option-3", question_id: "question-1", value: 3 },
  { id: "option-4", question_id: "question-1", value: 4 },
  { id: "option-5", question_id: "question-1", value: 5 },
  { id: "option-6", question_id: "question-2", value: 1 },
  { id: "option-7", question_id: "question-2", value: 2 },
  { id: "option-8", question_id: "question-2", value: 3 },
  { id: "option-9", question_id: "question-2", value: 4 },
  { id: "option-10", question_id: "question-2", value: 5 },
];

function createSupabaseStub(initialState = {}) {
  const state = {
    responses: [...(initialState.responses ?? [])],
    answer_options: [...(initialState.answer_options ?? [])],
    attempt_reports: [...(initialState.attempt_reports ?? [])],
    assessment_reports: [...(initialState.assessment_reports ?? [])],
    team_assessment_participants: [...(initialState.team_assessment_participants ?? [])],
  };
  let writeCount = 0;

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
    getWriteCount() {
      return writeCount;
    },
    from(table) {
      const query = {
        filters: [],
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
        in(column, values) {
          query.filters.push({
            type: "in",
            column,
            values,
          });
          return builder;
        },
        insert() {
          writeCount += 1;
          return builder;
        },
        update() {
          writeCount += 1;
          return builder;
        },
        upsert() {
          writeCount += 1;
          return builder;
        },
        delete() {
          writeCount += 1;
          return builder;
        },
        then(resolve, reject) {
          try {
            const rows = applyFilters(state[table] ?? [], query.filters);
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

assert.deepEqual(
  buildTeamAssessmentMinimalScore({
    context: completedContext,
    uiOnlyItems,
    savedResponses: [
      {
        question_id: "question-1",
        answer_option_id: "option-4",
        response_kind: "single_choice",
      },
      {
        question_id: "question-2",
        answer_option_id: "option-10",
        response_kind: "single_choice",
      },
    ],
    answerOptions,
  }),
  {
    status: "scored",
    supportedQuestionCount: 2,
    scoredQuestionCount: 2,
    rawTotal: 9,
    meanRaw: 4.5,
    score0To100: 87.5,
    missingQuestionIds: [],
    ignoredInvalidAnswerCount: 0,
    scaleMin: 1,
    scaleMax: 5,
    scoreValueSource: "answer_option_value",
    reason: null,
  },
);

assert.deepEqual(
  buildTeamAssessmentMinimalScore({
    context: {
      ...completedContext,
      wrapperStatus: "started",
      attemptStatus: "in_progress",
    },
    uiOnlyItems,
    savedResponses: [],
    answerOptions,
  }),
  {
    status: "not_completed",
    supportedQuestionCount: 2,
    scoredQuestionCount: 0,
    rawTotal: null,
    meanRaw: null,
    score0To100: null,
    missingQuestionIds: ["question-1", "question-2"],
    ignoredInvalidAnswerCount: 0,
    scaleMin: null,
    scaleMax: null,
    scoreValueSource: null,
    reason: "wrapper_or_attempt_not_completed",
  },
);

assert.deepEqual(
  buildTeamAssessmentMinimalScore({
    context: completedContext,
    uiOnlyItems,
    savedResponses: [
      {
        question_id: "question-1",
        answer_option_id: "option-4",
        response_kind: "single_choice",
      },
    ],
    answerOptions,
  }),
  {
    status: "not_ready",
    supportedQuestionCount: 2,
    scoredQuestionCount: 1,
    rawTotal: null,
    meanRaw: null,
    score0To100: null,
    missingQuestionIds: ["question-2"],
    ignoredInvalidAnswerCount: 0,
    scaleMin: 1,
    scaleMax: 5,
    scoreValueSource: null,
    reason: "completion_readiness_not_satisfied",
  },
);

assert.deepEqual(
  buildTeamAssessmentMinimalScore({
    context: completedContext,
    uiOnlyItems,
    savedResponses: [
      {
        question_id: "question-1",
        answer_option_id: "option-99",
        response_kind: "single_choice",
      },
      {
        question_id: "question-9",
        answer_option_id: "option-10",
        response_kind: "single_choice",
      },
      {
        question_id: "question-2",
        answer_option_id: "option-10",
        response_kind: "single_choice",
      },
    ],
    answerOptions,
  }),
  {
    status: "not_ready",
    supportedQuestionCount: 2,
    scoredQuestionCount: 1,
    rawTotal: null,
    meanRaw: null,
    score0To100: null,
    missingQuestionIds: ["question-1"],
    ignoredInvalidAnswerCount: 1,
    scaleMin: 1,
    scaleMax: 5,
    scoreValueSource: null,
    reason: "completion_readiness_not_satisfied",
  },
);

assert.deepEqual(
  buildTeamAssessmentMinimalScore({
    context: completedContext,
    uiOnlyItems: [],
    savedResponses: [],
    answerOptions: [],
  }),
  {
    status: "no_supported_items",
    supportedQuestionCount: 0,
    scoredQuestionCount: 0,
    rawTotal: null,
    meanRaw: null,
    score0To100: null,
    missingQuestionIds: [],
    ignoredInvalidAnswerCount: 0,
    scaleMin: null,
    scaleMax: null,
    scoreValueSource: null,
    reason: null,
  },
);

assert.deepEqual(
  buildTeamAssessmentMinimalScore({
    context: completedContext,
    uiOnlyItems,
    savedResponses: [
      {
        question_id: "question-1",
        answer_option_id: "option-4",
        response_kind: "single_choice",
      },
      {
        question_id: "question-2",
        answer_option_id: "option-10",
        response_kind: "single_choice",
      },
    ],
    answerOptions: answerOptions.map((option) =>
      option.id === "option-10" ? { ...option, value: null } : option,
    ),
  }),
  {
    status: "not_scored",
    supportedQuestionCount: 2,
    scoredQuestionCount: 0,
    rawTotal: null,
    meanRaw: null,
    score0To100: null,
    missingQuestionIds: ["question-1", "question-2"],
    ignoredInvalidAnswerCount: 0,
    scaleMin: null,
    scaleMax: null,
    scoreValueSource: null,
    reason: "missing_numeric_option_value",
  },
);

Promise.resolve()
  .then(async () => {
    const supabase = createSupabaseStub({
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
          answer_option_id: "option-10",
          response_kind: "single_choice",
        },
        {
          attempt_id: "attempt-2",
          question_id: "question-1",
          answer_option_id: "option-1",
          response_kind: "single_choice",
        },
      ],
      answer_options: answerOptions,
    });

    const scoreForContext = await loadTeamAssessmentMinimalScoreForContext(
      {
        context: completedContext,
        uiOnlyItems,
      },
      {
        supabase,
      },
    );

    assert.equal(scoreForContext.status, "scored");
    assert.equal(scoreForContext.rawTotal, 9);
    assert.equal(scoreForContext.score0To100, 87.5);

    const scoreForWrapperBoundary = await loadTeamAssessmentMinimalScore(
      {
        userId: "user-1",
        teamAssessmentParticipantId: "tap-1",
        uiOnlyItems,
      },
      {
        supabase,
        loadExecutionContext: async () => ({
          ok: true,
          context: completedContext,
        }),
      },
    );

    assert.equal(scoreForWrapperBoundary.status, "scored");

    const deniedScore = await loadTeamAssessmentMinimalScore(
      {
        userId: "user-2",
        teamAssessmentParticipantId: "tap-other",
        uiOnlyItems,
      },
      {
        supabase,
        loadExecutionContext: async () => ({
          ok: false,
          code: "wrapper_access_denied",
          message: "Wrapper access denied.",
        }),
      },
    );

    assert.deepEqual(deniedScore, {
      status: "not_completed",
      supportedQuestionCount: 2,
      scoredQuestionCount: 0,
      rawTotal: null,
      meanRaw: null,
      score0To100: null,
      missingQuestionIds: ["question-1", "question-2"],
      ignoredInvalidAnswerCount: 0,
      scaleMin: null,
      scaleMax: null,
      scoreValueSource: null,
      reason: "wrapper_or_attempt_not_completed",
    });

    assert.equal(supabase.getWriteCount(), 0);
    assert.equal(supabase.state.attempt_reports.length, 0);
    assert.equal(supabase.state.assessment_reports.length, 0);
    assert.deepEqual(supabase.state.team_assessment_participants, []);

    console.log("test-team-dynamics-minimal-scoring: ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
