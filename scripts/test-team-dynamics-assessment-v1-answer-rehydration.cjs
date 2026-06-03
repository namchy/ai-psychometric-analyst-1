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
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

require.extensions[".tsx"] = require.extensions[".ts"];

const helperPath = path.join(
  projectRoot,
  "lib",
  "assessment",
  "team-dynamics-mixed-answer-rehydration.ts",
);
const compatibilityPath = path.join(
  projectRoot,
  "lib",
  "assessment",
  "team-dynamics-mixed-answer-read.ts",
);
const helperSource = fs.readFileSync(helperPath, "utf8");
const compatibilitySource = fs.readFileSync(compatibilityPath, "utf8");

assert.match(helperSource, /export function buildTeamDynamicsMixedSavedAnswerState/);
assert.match(helperSource, /export async function loadTeamDynamicsMixedSavedAnswersForContext/);
assert.match(helperSource, /\.from\("responses"\)/);
assert.match(helperSource, /response_selections/);
assert.doesNotMatch(helperSource, /persistValidatedTeamDynamicsMixedAnswer/);
assert.doesNotMatch(helperSource, /saveTeamDynamicsMixedAnswerAction/);
assert.doesNotMatch(helperSource, /transitionTeamAssessmentExecutionToCompleted/);
assert.doesNotMatch(helperSource, /persistTeamAssessmentMinimalScoreForContext/);
assert.doesNotMatch(helperSource, /attempt_reports/);
assert.doesNotMatch(helperSource, /assessment_reports/);
assert.doesNotMatch(helperSource, /Team Fit/);
assert.match(compatibilitySource, /team-dynamics-mixed-answer-rehydration/);

const {
  buildTeamDynamicsMixedSavedAnswerState,
  loadTeamDynamicsMixedSavedAnswersForContext,
} = require("../lib/assessment/team-dynamics-mixed-answer-rehydration.ts");
const {
  createInitialMixedPreviewClientState,
  mergeMixedPreviewStoredStateWithSavedAnswers,
  sanitizeMixedPreviewSavedAnswerState,
} = require("../components/assessment/team-dynamics-mixed-run-preview.tsx");

const likertItem = {
  questionId: "question-1",
  code: "TDM31_01",
  order: 1,
  blockKey: "tdm-31-V1",
  responseFormat: "single_select_likert",
  questionType: "single_choice",
  localizedText: "Likert item",
  metadata: {},
  options: Array.from({ length: 4 }, (_, index) => ({
    optionId: `option-${index + 1}`,
    code: null,
    label: `Option ${index + 1}`,
    value: index + 1,
    order: index + 1,
    metadata: {},
  })),
};

const sjtItem = {
  questionId: "question-2",
  code: "SJT_TD_01",
  order: 2,
  blockKey: "situational_judgment",
  responseFormat: "best_worst",
  questionType: "multiple_choice",
  localizedText: "SJT item",
  metadata: {
    scenario_id: "SJT_TD_01",
  },
  options: Array.from({ length: 4 }, (_, index) => ({
    optionId: `sjt-option-${index + 1}`,
    code: null,
    label: `Scenario option ${index + 1}`,
    value: null,
    order: index + 1,
    metadata: {
      scenario_id: "SJT_TD_01",
    },
  })),
};

const runtimeHandoff = {
  testSlug: "team_dynamics_assessment_v1",
  assessmentKey: "team-dynamics-v1",
  importMode: "content_spec",
  locale: "bs",
  scoringMethod: "mixed_v1",
  blockCount: 2,
  itemCount: 2,
  likertItemCount: 1,
  sjtScenarioCount: 1,
  outcomePulseItemCount: 0,
  blocks: [],
  items: [likertItem, sjtItem],
  unsupportedItems: [],
  warnings: [],
};

assert.deepEqual(
  buildTeamDynamicsMixedSavedAnswerState({
    context: {
      packageSlug: "team_dynamics_assessment_v1",
      test: {
        slug: "team_dynamics_assessment_v1",
      },
    },
    runtimeHandoff,
    responseRows: [
      {
        id: "response-likert",
        question_id: "question-1",
        response_kind: "single_choice",
        answer_option_id: "option-3",
        response_selections: [],
      },
      {
        id: "response-sjt",
        question_id: "question-2",
        response_kind: "best_worst",
        answer_option_id: null,
        response_selections: [
          {
            question_id: "question-2",
            answer_option_id: "sjt-option-1",
            selection_role: "best",
          },
          {
            question_id: "question-2",
            answer_option_id: "sjt-option-3",
            selection_role: "worst",
          },
        ],
      },
      {
        id: "response-stale-question",
        question_id: "stale-question",
        response_kind: "single_choice",
        answer_option_id: "ghost-option",
        response_selections: [],
      },
      {
        id: "response-stale-option",
        question_id: "question-1",
        response_kind: "single_choice",
        answer_option_id: "ghost-option",
        response_selections: [],
      },
      {
        id: "response-wrong-kind",
        question_id: "question-2",
        response_kind: "single_choice",
        answer_option_id: "sjt-option-1",
        response_selections: [],
      },
      {
        id: "response-malformed-sjt",
        question_id: "question-2",
        response_kind: "best_worst",
        answer_option_id: null,
        response_selections: [
          {
            question_id: "question-2",
            answer_option_id: "sjt-option-2",
            selection_role: "best",
          },
        ],
      },
      {
        id: "response-same-best-worst",
        question_id: "question-2",
        response_kind: "best_worst",
        answer_option_id: null,
        response_selections: [
          {
            question_id: "question-2",
            answer_option_id: "sjt-option-4",
            selection_role: "best",
          },
          {
            question_id: "question-2",
            answer_option_id: "sjt-option-4",
            selection_role: "worst",
          },
        ],
      },
    ],
  }),
  {
    savedLikertSelectionsByQuestionId: {
      "question-1": "option-3",
    },
    savedSjtSelectionsByQuestionId: {
      "question-2": {
        bestOptionId: "sjt-option-1",
        worstOptionId: "sjt-option-3",
      },
    },
    savedAnswerCount: 2,
    invalidSavedAnswerCount: 3,
    ignoredStaleAnswerCount: 2,
    warnings: [],
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedSavedAnswerState({
    context: {
      packageSlug: "team_dynamics_v1_strong",
      test: {
        slug: "team_dynamics_v1_strong",
      },
    },
    runtimeHandoff,
    responseRows: [],
  }),
  {
    savedLikertSelectionsByQuestionId: {},
    savedSjtSelectionsByQuestionId: {},
    savedAnswerCount: 0,
    invalidSavedAnswerCount: 0,
    ignoredStaleAnswerCount: 0,
    warnings: ["unsupported:team_dynamics_assessment_v1"],
  },
);

const savedAnswerState = sanitizeMixedPreviewSavedAnswerState({
  runtimeHandoff,
  rawState: {
    likertSelectionsByQuestionId: {
      "question-1": "option-4",
      stale: "option-1",
    },
    sjtSelectionsByQuestionId: {
      "question-2": {
        bestOptionId: "sjt-option-1",
        worstOptionId: "sjt-option-2",
      },
      stale: {
        bestOptionId: "ghost",
        worstOptionId: "ghost-2",
      },
    },
  },
});

assert.deepEqual(
  createInitialMixedPreviewClientState({
    runtimeHandoff,
    teamAssessmentParticipantId: "participant-1",
    savedAnswerState,
  }),
  {
    currentIndex: 0,
    selectionState: {
      likertSelectionsByQuestionId: {
        "question-1": "option-4",
      },
      sjtSelectionsByQuestionId: {
        "question-2": {
          bestOptionId: "sjt-option-1",
          worstOptionId: "sjt-option-2",
        },
      },
    },
    savedAnswerState: {
      likertSelectionsByQuestionId: {
        "question-1": "option-4",
      },
      sjtSelectionsByQuestionId: {
        "question-2": {
          bestOptionId: "sjt-option-1",
          worstOptionId: "sjt-option-2",
        },
      },
    },
    isFinalPreviewVisible: false,
    isCompletionSuccessVisible: false,
  },
);

assert.deepEqual(
  mergeMixedPreviewStoredStateWithSavedAnswers({
    savedAnswerState,
    storedState: {
      currentIndex: 1,
    },
  }),
  {
    currentIndex: 1,
  },
);

let queriedAttemptId = null;

Promise.resolve()
  .then(() =>
    loadTeamDynamicsMixedSavedAnswersForContext(
      {
        context: {
          teamAssessmentParticipantId: "wrapper-1",
          teamAssessmentAssignmentId: "assignment-1",
          teamMembershipId: "membership-1",
          participantId: "participant-1",
          attemptId: "attempt-1",
          teamId: "team-1",
          organizationId: "org-1",
          packageSlug: "team_dynamics_assessment_v1",
          wrapperStatus: "started",
          attemptStatus: "in_progress",
          locale: "bs",
          test: {
            id: "test-1",
            slug: "team_dynamics_assessment_v1",
            name: "Procjena timske dinamike",
            status: "active",
            isActive: true,
          },
        },
        runtimeHandoff,
      },
      {
        supabase: {
          from(table) {
            assert.equal(table, "responses");
            return {
              select(query) {
                assert.match(query, /response_selections/);
                return {
                  eq(column, value) {
                    if (column === "attempt_id") {
                      queriedAttemptId = value;
                    }
                    return Promise.resolve({
                      data: [],
                      error: null,
                    });
                  },
                };
              },
            };
          },
        },
      },
    ),
  )
  .then((savedState) => {
    assert.equal(queriedAttemptId, "attempt-1");
    assert.deepEqual(savedState, {
      savedLikertSelectionsByQuestionId: {},
      savedSjtSelectionsByQuestionId: {},
      savedAnswerCount: 0,
      invalidSavedAnswerCount: 0,
      ignoredStaleAnswerCount: 0,
      warnings: [],
    });
    console.log("test-team-dynamics-assessment-v1-answer-rehydration: ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
