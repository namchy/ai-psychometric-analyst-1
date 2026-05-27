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

const {
  buildTeamDynamicsMixedSavedAnswerState,
} = require("../lib/assessment/team-dynamics-mixed-answer-read.ts");
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
    invalidSavedAnswerCount: 2,
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
  },
);

assert.deepEqual(
  mergeMixedPreviewStoredStateWithSavedAnswers({
    savedAnswerState,
    storedState: {
      currentIndex: 1,
      likertSelectionsByQuestionId: {
        "question-1": "option-2",
      },
      sjtSelectionsByQuestionId: {
        "question-2": {
          bestOptionId: "sjt-option-3",
          worstOptionId: "sjt-option-4",
        },
      },
    },
  }),
  {
    currentIndex: 1,
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
);

console.log("test-team-dynamics-assessment-v1-answer-rehydration: ok");
