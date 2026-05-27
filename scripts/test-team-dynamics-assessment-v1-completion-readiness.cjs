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

const readinessSource = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "team-dynamics-mixed-completion-readiness.ts"),
  "utf8",
);
const executionSource = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "team-assessment-execution.ts"),
  "utf8",
);
const routeSource = fs.readFileSync(
  path.join(
    projectRoot,
    "app",
    "(protected)",
    "app",
    "team-assessments",
    "[teamAssessmentParticipantId]",
    "run",
    "page.tsx",
  ),
  "utf8",
);
const previewSource = fs.readFileSync(
  path.join(projectRoot, "components", "assessment", "team-dynamics-mixed-run-preview.tsx"),
  "utf8",
);

assert.match(readinessSource, /export async function loadTeamDynamicsMixedCompletionReadinessForContext/);
assert.match(readinessSource, /loadTeamDynamicsMixedSavedAnswersForContext/);
assert.match(readinessSource, /supportedItemCount/);
assert.match(readinessSource, /savedValidAnswerCount/);
assert.match(readinessSource, /likertItemCount/);
assert.match(readinessSource, /sjtItemCount/);
assert.match(readinessSource, /readinessStatus/);
assert.doesNotMatch(readinessSource, /sessionStorage/);
assert.doesNotMatch(readinessSource, /attemptId:/);
assert.doesNotMatch(readinessSource, /AssessmentForm/);

assert.match(executionSource, /loadTeamDynamicsMixedCompletionReadinessForContext/);
assert.match(executionSource, /mixedCompletionReadiness/);
assert.match(routeSource, /completionReadiness=\{handoff\.mixedCompletionReadiness\}/);
assert.doesNotMatch(routeSource, /attemptId/);

assert.match(previewSource, /Spremljeno: \$\{props\.completionReadiness\.savedValidAnswerCount\}\/\$\{props\.completionReadiness\.supportedItemCount\} odgovora\./);
assert.match(previewSource, /Svi odgovori su spremljeni\./);
assert.match(previewSource, /Nema podrzanih pitanja za zavrsetak\./);
assert.doesNotMatch(previewSource, /Zavrsi procjenu/);

const {
  buildTeamDynamicsMixedCompletionReadiness,
  loadTeamDynamicsMixedCompletionReadinessForContext,
} = require("../lib/assessment/team-dynamics-mixed-completion-readiness.ts");

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
  items: [
    {
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
    },
    {
      questionId: "question-2",
      code: "SJT_TD_01",
      order: 2,
      blockKey: "situational_judgment",
      responseFormat: "best_worst",
      questionType: "multiple_choice",
      localizedText: "SJT item",
      metadata: {},
      options: Array.from({ length: 4 }, (_, index) => ({
        optionId: `sjt-option-${index + 1}`,
        code: null,
        label: `Scenario option ${index + 1}`,
        value: null,
        order: index + 1,
        metadata: {},
      })),
    },
  ],
  unsupportedItems: [],
  warnings: [],
};

const finalContext = {
  packageSlug: "team_dynamics_assessment_v1",
  test: {
    slug: "team_dynamics_assessment_v1",
  },
};

assert.deepEqual(
  buildTeamDynamicsMixedCompletionReadiness({
    context: finalContext,
    runtimeHandoff,
    savedAnswerState: {
      savedLikertSelectionsByQuestionId: {},
      savedSjtSelectionsByQuestionId: {},
      savedAnswerCount: 0,
      invalidSavedAnswerCount: 0,
      ignoredStaleAnswerCount: 0,
      warnings: [],
    },
  }),
  {
    readinessStatus: "not_ready",
    isReadyForCompletion: false,
    supportedItemCount: 2,
    savedValidAnswerCount: 0,
    missingQuestionIds: ["question-1", "question-2"],
    invalidSavedAnswerCount: 0,
    ignoredStaleAnswerCount: 0,
    likertItemCount: 1,
    sjtItemCount: 1,
    savedLikertAnswerCount: 0,
    savedSjtAnswerCount: 0,
    warnings: [],
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedCompletionReadiness({
    context: finalContext,
    runtimeHandoff,
    savedAnswerState: {
      savedLikertSelectionsByQuestionId: {
        "question-1": "option-2",
      },
      savedSjtSelectionsByQuestionId: {
        "question-2": {
          bestOptionId: "sjt-option-1",
        },
      },
      savedAnswerCount: 2,
      invalidSavedAnswerCount: 1,
      ignoredStaleAnswerCount: 0,
      warnings: [],
    },
  }),
  {
    readinessStatus: "not_ready",
    isReadyForCompletion: false,
    supportedItemCount: 2,
    savedValidAnswerCount: 1,
    missingQuestionIds: ["question-2"],
    invalidSavedAnswerCount: 1,
    ignoredStaleAnswerCount: 0,
    likertItemCount: 1,
    sjtItemCount: 1,
    savedLikertAnswerCount: 1,
    savedSjtAnswerCount: 0,
    warnings: [],
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedCompletionReadiness({
    context: finalContext,
    runtimeHandoff,
    savedAnswerState: {
      savedLikertSelectionsByQuestionId: {
        "question-1": "option-2",
      },
      savedSjtSelectionsByQuestionId: {
        "question-2": {
          bestOptionId: "sjt-option-1",
          worstOptionId: "sjt-option-1",
        },
      },
      savedAnswerCount: 2,
      invalidSavedAnswerCount: 1,
      ignoredStaleAnswerCount: 0,
      warnings: [],
    },
  }),
  {
    readinessStatus: "not_ready",
    isReadyForCompletion: false,
    supportedItemCount: 2,
    savedValidAnswerCount: 1,
    missingQuestionIds: ["question-2"],
    invalidSavedAnswerCount: 1,
    ignoredStaleAnswerCount: 0,
    likertItemCount: 1,
    sjtItemCount: 1,
    savedLikertAnswerCount: 1,
    savedSjtAnswerCount: 0,
    warnings: [],
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedCompletionReadiness({
    context: finalContext,
    runtimeHandoff,
    savedAnswerState: {
      savedLikertSelectionsByQuestionId: {
        "question-1": "ghost-option",
      },
      savedSjtSelectionsByQuestionId: {
        "stale-question": {
          bestOptionId: "ghost-best",
          worstOptionId: "ghost-worst",
        },
      },
      savedAnswerCount: 2,
      invalidSavedAnswerCount: 0,
      ignoredStaleAnswerCount: 2,
      warnings: [],
    },
  }),
  {
    readinessStatus: "not_ready",
    isReadyForCompletion: false,
    supportedItemCount: 2,
    savedValidAnswerCount: 0,
    missingQuestionIds: ["question-1", "question-2"],
    invalidSavedAnswerCount: 0,
    ignoredStaleAnswerCount: 2,
    likertItemCount: 1,
    sjtItemCount: 1,
    savedLikertAnswerCount: 0,
    savedSjtAnswerCount: 0,
    warnings: [],
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedCompletionReadiness({
    context: finalContext,
    runtimeHandoff,
    savedAnswerState: {
      savedLikertSelectionsByQuestionId: {
        "question-1": "option-2",
      },
      savedSjtSelectionsByQuestionId: {},
      savedAnswerCount: 1,
      invalidSavedAnswerCount: 0,
      ignoredStaleAnswerCount: 0,
      warnings: [],
    },
  }),
  {
    readinessStatus: "not_ready",
    isReadyForCompletion: false,
    supportedItemCount: 2,
    savedValidAnswerCount: 1,
    missingQuestionIds: ["question-2"],
    invalidSavedAnswerCount: 0,
    ignoredStaleAnswerCount: 0,
    likertItemCount: 1,
    sjtItemCount: 1,
    savedLikertAnswerCount: 1,
    savedSjtAnswerCount: 0,
    warnings: [],
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedCompletionReadiness({
    context: finalContext,
    runtimeHandoff,
    savedAnswerState: {
      savedLikertSelectionsByQuestionId: {
        "question-1": "option-2",
      },
      savedSjtSelectionsByQuestionId: {
        "question-2": {
          bestOptionId: "sjt-option-1",
          worstOptionId: "sjt-option-3",
        },
      },
      savedAnswerCount: 2,
      invalidSavedAnswerCount: 1,
      ignoredStaleAnswerCount: 2,
      warnings: [],
    },
  }),
  {
    readinessStatus: "ready",
    isReadyForCompletion: true,
    supportedItemCount: 2,
    savedValidAnswerCount: 2,
    missingQuestionIds: [],
    invalidSavedAnswerCount: 1,
    ignoredStaleAnswerCount: 2,
    likertItemCount: 1,
    sjtItemCount: 1,
    savedLikertAnswerCount: 1,
    savedSjtAnswerCount: 1,
    warnings: [],
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedCompletionReadiness({
    context: finalContext,
    runtimeHandoff: {
      ...runtimeHandoff,
      items: [
        {
          ...runtimeHandoff.items[0],
          responseFormat: "free_text",
          options: [],
        },
      ],
    },
    savedAnswerState: {
      savedLikertSelectionsByQuestionId: {},
      savedSjtSelectionsByQuestionId: {},
      savedAnswerCount: 0,
      invalidSavedAnswerCount: 0,
      ignoredStaleAnswerCount: 0,
      warnings: [],
    },
  }),
  {
    readinessStatus: "no_supported_items",
    isReadyForCompletion: false,
    supportedItemCount: 0,
    savedValidAnswerCount: 0,
    missingQuestionIds: [],
    invalidSavedAnswerCount: 0,
    ignoredStaleAnswerCount: 0,
    likertItemCount: 0,
    sjtItemCount: 0,
    savedLikertAnswerCount: 0,
    savedSjtAnswerCount: 0,
    warnings: [],
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedCompletionReadiness({
    context: {
      packageSlug: "team_dynamics_v1_strong",
      test: {
        slug: "team_dynamics_v1_strong",
      },
    },
    runtimeHandoff,
    savedAnswerState: {
      savedLikertSelectionsByQuestionId: {},
      savedSjtSelectionsByQuestionId: {},
      savedAnswerCount: 0,
      invalidSavedAnswerCount: 0,
      ignoredStaleAnswerCount: 0,
      warnings: [],
    },
  }),
  {
    readinessStatus: "no_supported_items",
    isReadyForCompletion: false,
    supportedItemCount: 0,
    savedValidAnswerCount: 0,
    missingQuestionIds: [],
    invalidSavedAnswerCount: 0,
    ignoredStaleAnswerCount: 0,
    likertItemCount: 0,
    sjtItemCount: 0,
    savedLikertAnswerCount: 0,
    savedSjtAnswerCount: 0,
    warnings: ["unsupported:team_dynamics_assessment_v1"],
  },
);

Promise.resolve()
  .then(async () => {
    let loadSavedAnswersCallCount = 0;
    const readiness = await loadTeamDynamicsMixedCompletionReadinessForContext(
      {
        context: {
          attemptId: "attempt-1",
          packageSlug: "team_dynamics_assessment_v1",
          test: {
            slug: "team_dynamics_assessment_v1",
          },
        },
        runtimeHandoff,
      },
      {
        loadSavedAnswers: async () => {
          loadSavedAnswersCallCount += 1;

          return {
            savedLikertSelectionsByQuestionId: {
              "question-1": "option-1",
            },
            savedSjtSelectionsByQuestionId: {},
            savedAnswerCount: 1,
            invalidSavedAnswerCount: 0,
            ignoredStaleAnswerCount: 0,
            warnings: [],
          };
        },
      },
    );

    assert.equal(loadSavedAnswersCallCount, 1);
    assert.deepEqual(readiness, {
      readinessStatus: "not_ready",
      isReadyForCompletion: false,
      supportedItemCount: 2,
      savedValidAnswerCount: 1,
      missingQuestionIds: ["question-2"],
      invalidSavedAnswerCount: 0,
      ignoredStaleAnswerCount: 0,
      likertItemCount: 1,
      sjtItemCount: 1,
      savedLikertAnswerCount: 1,
      savedSjtAnswerCount: 0,
      warnings: [],
    });
    assert.equal("attemptId" in readiness, false);

    const unsupportedReadiness = await loadTeamDynamicsMixedCompletionReadinessForContext(
      {
        context: {
          attemptId: "attempt-2",
          packageSlug: "team_dynamics_v1_strong",
          test: {
            slug: "team_dynamics_v1_strong",
          },
        },
        runtimeHandoff,
      },
      {
        loadSavedAnswers: async () => {
          throw new Error("loadSavedAnswers should not run for unsupported slug.");
        },
      },
    );

    assert.deepEqual(unsupportedReadiness, {
      readinessStatus: "no_supported_items",
      isReadyForCompletion: false,
      supportedItemCount: 0,
      savedValidAnswerCount: 0,
      missingQuestionIds: [],
      invalidSavedAnswerCount: 0,
      ignoredStaleAnswerCount: 0,
      likertItemCount: 0,
      sjtItemCount: 0,
      savedLikertAnswerCount: 0,
      savedSjtAnswerCount: 0,
      warnings: ["unsupported:team_dynamics_assessment_v1"],
    });
    assert.equal("attemptId" in unsupportedReadiness, false);

    console.log("test-team-dynamics-assessment-v1-completion-readiness: ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
