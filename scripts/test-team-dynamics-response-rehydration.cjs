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

const {
  buildTeamAssessmentSavedAnswerState,
  loadSavedTeamAssessmentAnswers,
  loadTeamAssessmentSavedAnswerStateForContext,
} = require("../lib/assessment/team-assessment-responses.ts");
const {
  resolveTeamAssessmentExecutionShellState,
} = require("../lib/assessment/team-assessment-execution.ts");

const source = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "team-assessment-responses.ts"),
  "utf8",
);
const componentSource = fs.readFileSync(
  path.join(projectRoot, "components", "assessment", "team-dynamics-run-ui-skeleton.tsx"),
  "utf8",
);

assert.match(source, /export async function loadSavedTeamAssessmentAnswers/);
assert.match(source, /export async function loadTeamAssessmentSavedAnswerStateForContext/);
assert.match(source, /export function buildTeamAssessmentSavedAnswerState/);
assert.match(source, /\.from\("responses"\)/);
assert.match(source, /selectedOptionIdsByQuestionId/);
assert.match(source, /loadedQuestionIds/);
assert.match(source, /loadedCount/);
assert.doesNotMatch(source, /attempt_reports/);
assert.doesNotMatch(source, /assessment_reports/);
assert.doesNotMatch(source, /upsert\(/);
assert.doesNotMatch(source, /completeAssessmentAttempt/);
assert.doesNotMatch(source, /save-on-select/i);

assert.match(componentSource, /savedSelectedOptionIdsByQuestionId/);
assert.match(componentSource, /savedAnswerQuestionIds/);
assert.match(componentSource, /savedAnswerCount/);
assert.match(componentSource, /"idle" \| "loaded" \| "saving" \| "saved" \| "overwritten" \| "unchanged" \| "error"/);
assert.match(componentSource, /Ucitano\./);
assert.doesNotMatch(componentSource, /attemptId/);
assert.doesNotMatch(componentSource, /AssessmentForm/);

function createSupabaseStub(initialState = {}) {
  const state = {
    responses: [...(initialState.responses ?? [])],
    attempt_reports: [...(initialState.attempt_reports ?? [])],
    assessment_reports: [...(initialState.assessment_reports ?? [])],
    attempts: [...(initialState.attempts ?? [])],
    team_assessment_participants: [...(initialState.team_assessment_participants ?? [])],
  };

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

const context = {
  teamAssessmentParticipantId: "tap-1",
  teamAssessmentAssignmentId: "assignment-1",
  teamMembershipId: "membership-1",
  participantId: "participant-1",
  attemptId: "attempt-1",
  teamId: "team-1",
  organizationId: "org-1",
  packageSlug: "team_dynamics_v1_strong",
  wrapperStatus: "started",
  attemptStatus: "in_progress",
  locale: "bs",
  test: {
    id: "test-team-dynamics",
    slug: "team_dynamics_v1_strong",
    name: "Procjena timske dinamike",
    status: "active",
    isActive: true,
  },
};

const shellState = resolveTeamAssessmentExecutionShellState({
  route: "run",
  wrapperStatus: "started",
});

const uiOnlyItems = [
  {
    mode: "ui_only_ready",
    questionId: "question-1",
    order: 1,
    localizedTitle: "Q1",
    localizedStem: "Q1",
    optionIds: ["option-1", "option-2"],
    options: [
      { id: "option-1", label: "A", order: 1 },
      { id: "option-2", label: "B", order: 2 },
    ],
    locale: "bs",
    isUiOnlySkeleton: true,
  },
  {
    mode: "ui_only_ready",
    questionId: "question-2",
    order: 2,
    localizedTitle: "Q2",
    localizedStem: "Q2",
    optionIds: ["option-3", "option-4"],
    options: [
      { id: "option-3", label: "C", order: 1 },
      { id: "option-4", label: "D", order: 2 },
    ],
    locale: "bs",
    isUiOnlySkeleton: true,
  },
];

assert.deepEqual(
  buildTeamAssessmentSavedAnswerState({
    shellState,
    context,
    uiOnlyItems,
    savedResponses: [
      {
        question_id: "question-1",
        answer_option_id: "option-2",
        response_kind: "single_choice",
      },
      {
        question_id: "question-2",
        answer_option_id: "option-4",
        response_kind: "single_choice",
      },
      {
        question_id: "question-3",
        answer_option_id: "option-10",
        response_kind: "single_choice",
      },
      {
        question_id: "question-1",
        answer_option_id: "option-99",
        response_kind: "single_choice",
      },
      {
        question_id: "question-2",
        answer_option_id: "option-4",
        response_kind: "multiple_choice",
      },
    ],
  }),
  {
    selectedOptionIdsByQuestionId: {
      "question-1": "option-2",
      "question-2": "option-4",
    },
    loadedQuestionIds: ["question-1", "question-2"],
    loadedCount: 2,
  },
);

assert.deepEqual(
  buildTeamAssessmentSavedAnswerState({
    shellState: resolveTeamAssessmentExecutionShellState({
      route: "run",
      wrapperStatus: "completed",
    }),
    context: {
      ...context,
      wrapperStatus: "completed",
      attemptStatus: "completed",
    },
    uiOnlyItems,
    savedResponses: [
      {
        question_id: "question-1",
        answer_option_id: "option-2",
        response_kind: "single_choice",
      },
    ],
  }),
  {
    selectedOptionIdsByQuestionId: {},
    loadedQuestionIds: [],
    loadedCount: 0,
  },
);

async function runLoadTests() {
  const supabase = createSupabaseStub({
    responses: [
      {
        attempt_id: "attempt-1",
        question_id: "question-1",
        answer_option_id: "option-2",
        response_kind: "single_choice",
      },
      {
        attempt_id: "attempt-1",
        question_id: "question-2",
        answer_option_id: "option-4",
        response_kind: "single_choice",
      },
      {
        attempt_id: "attempt-1",
        question_id: "question-9",
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
  });

  const stateForContext = await loadTeamAssessmentSavedAnswerStateForContext(
    {
      context,
      shellState,
      uiOnlyItems,
    },
    {
      supabase,
    },
  );

  assert.deepEqual(stateForContext, {
    selectedOptionIdsByQuestionId: {
      "question-1": "option-2",
      "question-2": "option-4",
    },
    loadedQuestionIds: ["question-1", "question-2"],
    loadedCount: 2,
  });

  const stateForWrapperBoundary = await loadSavedTeamAssessmentAnswers(
    {
      userId: "user-1",
      teamAssessmentParticipantId: "tap-1",
      uiOnlyItems,
    },
    {
      supabase,
      loadExecutionContext: async () => ({
        ok: true,
        context,
      }),
    },
  );

  assert.deepEqual(stateForWrapperBoundary, {
    selectedOptionIdsByQuestionId: {
      "question-1": "option-2",
      "question-2": "option-4",
    },
    loadedQuestionIds: ["question-1", "question-2"],
    loadedCount: 2,
  });

  const deniedState = await loadSavedTeamAssessmentAnswers(
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

  assert.deepEqual(deniedState, {
    selectedOptionIdsByQuestionId: {},
    loadedQuestionIds: [],
    loadedCount: 0,
  });

  assert.equal(supabase.state.attempt_reports.length, 0);
  assert.equal(supabase.state.assessment_reports.length, 0);
  assert.deepEqual(supabase.state.attempts, []);
  assert.deepEqual(supabase.state.team_assessment_participants, []);
}

runLoadTests()
  .then(() => {
    console.log("test-team-dynamics-response-rehydration: ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
