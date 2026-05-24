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

function compileTypeScript(module, filename) {
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
}

require.extensions[".ts"] = compileTypeScript;
require.extensions[".tsx"] = compileTypeScript;

const routePath = path.join(
  projectRoot,
  "app",
  "(protected)",
  "app",
  "team-assessments",
  "[teamAssessmentParticipantId]",
  "run",
  "page.tsx",
);
const componentPath = path.join(
  projectRoot,
  "components",
  "assessment",
  "team-dynamics-mixed-run-preview.tsx",
);
const executionHelperPath = path.join(
  projectRoot,
  "lib",
  "assessment",
  "team-assessment-execution.ts",
);

const routeSource = fs.readFileSync(routePath, "utf8");
const componentSource = fs.readFileSync(componentPath, "utf8");
const executionHelperSource = fs.readFileSync(executionHelperPath, "utf8");

assert.match(executionHelperSource, /loadTeamDynamicsMixedRuntimeHandoff/);
assert.match(executionHelperSource, /TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG/);
assert.match(executionHelperSource, /runShellVariant: "mixed_runtime_preview"/);
assert.match(executionHelperSource, /mixedRuntimeHandoff/);
assert.doesNotMatch(executionHelperSource, /loadTeamAssessmentSavedAnswerStateForContext[\s\S]+mixed_runtime_preview/);

assert.match(routeSource, /TeamDynamicsMixedRunPreview/);
assert.match(routeSource, /handoff\.runShellVariant === "mixed_runtime_preview"/);
assert.match(routeSource, /handoff\.mixedRuntimeHandoff !== null/);
assert.match(routeSource, /teamAssessmentParticipantId=\{handoff\.teamAssessmentParticipantId\}/);
assert.match(routeSource, /4 kratka bloka, oko 12[-–]15 minuta/);
assert.doesNotMatch(routeSource, /AssessmentForm/);
assert.doesNotMatch(routeSource, /attemptId/);

assert.match(componentSource, /"use client"/);
assert.match(componentSource, /team-dynamics-mixed-preview:/);
assert.match(componentSource, /window\.sessionStorage/);
assert.match(componentSource, /hasHydratedPreviewState/);
assert.match(componentSource, /Vracam preview stanje/);
assert.match(componentSource, /useState<MixedPreviewClientState>\(\s*createInitialMixedPreviewClientState\(/);
assert.match(componentSource, /useEffect\(\(\) => \{[\s\S]*readMixedPreviewStoredState/);
assert.match(componentSource, /currentIndex: safeIndex/);
assert.match(
  componentSource,
  /if \(!hasHydratedPreviewState\) \{\s*return;\s*\}[\s\S]*writeMixedPreviewStoredState/,
);
assert.match(componentSource, /setHasHydratedPreviewState\(true\)/);
assert.doesNotMatch(componentSource, /useState<MixedPreviewClientState>\(\(\) =>\s*createInitialMixedPreviewClientState/);
assert.match(componentSource, /Najefikasnija reakcija/);
assert.match(componentSource, /Najmanje efikasna reakcija/);
assert.match(componentSource, /Preview bez spremanja odgovora/);
assert.match(componentSource, /Izbori se cuvaju samo u ovoj browser sesiji i ne ulaze u rezultat/);
assert.match(
  componentSource,
  /Nema save action poziva, autosave logike, completion tranzicije, scoring-a ni report\s+side-effecta/,
);
assert.match(componentSource, /Ista opcija ne moze biti oba izbora/);
assert.match(componentSource, /disabled=\{isLastItem \|\| \(itemKind !== "unsupported" && !isCurrentAnswerComplete\)\}/);
assert.doesNotMatch(componentSource, /saveTeamAssessmentAnswerAction/);
assert.doesNotMatch(componentSource, /completeTeamAssessmentAction/);
assert.doesNotMatch(componentSource, /AssessmentForm/);
assert.doesNotMatch(componentSource, /attemptId/);
assert.doesNotMatch(componentSource, /fetch\(/);

const {
  buildMixedPreviewSessionStorageKey,
  createInitialMixedPreviewClientState,
  getMixedPreviewItemKind,
  isCurrentItemAnswerComplete,
  readMixedPreviewStoredState,
  sanitizeMixedPreviewStoredState,
  updateSjtPreviewSelection,
} = require("../components/assessment/team-dynamics-mixed-run-preview.tsx");
const {
  shouldHideAssessmentFromCandidateDashboard,
} = require("../lib/assessment/availability.ts");
const {
  STANDARD_ASSESSMENT_BATTERY_SLUGS,
} = require("../lib/assessment/standard-battery.ts");
const {
  getReportGenerationCapability,
} = require("../lib/assessment/report-capabilities.ts");

assert.equal(
  getMixedPreviewItemKind({
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
  }),
  "likert",
);

assert.equal(
  getMixedPreviewItemKind({
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
  }),
  "sjt_best_worst",
);

assert.equal(
  getMixedPreviewItemKind({
    questionId: "question-3",
    code: "BROKEN_01",
    order: 3,
    blockKey: "unknown",
    responseFormat: "free_text",
    questionType: "text",
    localizedText: "Unsupported item",
    metadata: {},
    options: [],
  }),
  "unsupported",
);

assert.deepEqual(
  updateSjtPreviewSelection({
    current: {
      bestOptionId: "option-1",
      worstOptionId: "option-2",
    },
    selectionKind: "best",
    optionId: "option-2",
  }),
  {
    bestOptionId: "option-2",
    worstOptionId: null,
  },
);

assert.deepEqual(
  updateSjtPreviewSelection({
    current: {
      bestOptionId: "option-2",
      worstOptionId: null,
    },
    selectionKind: "worst",
    optionId: "option-2",
  }),
  {
    bestOptionId: null,
    worstOptionId: "option-2",
  },
);

assert.equal(
  buildMixedPreviewSessionStorageKey("participant-123"),
  "team-dynamics-mixed-preview:participant-123",
);

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
  scoringMethod: "team_dynamics_preview",
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

assert.equal(
  isCurrentItemAnswerComplete({
    item: likertItem,
    selectionState: {
      likertSelectionsByQuestionId: {},
      sjtSelectionsByQuestionId: {},
    },
  }),
  false,
);

assert.equal(
  isCurrentItemAnswerComplete({
    item: likertItem,
    selectionState: {
      likertSelectionsByQuestionId: {
        "question-1": "option-3",
      },
      sjtSelectionsByQuestionId: {},
    },
  }),
  true,
);

assert.equal(
  isCurrentItemAnswerComplete({
    item: sjtItem,
    selectionState: {
      likertSelectionsByQuestionId: {},
      sjtSelectionsByQuestionId: {
        "question-2": {
          bestOptionId: "sjt-option-1",
          worstOptionId: null,
        },
      },
    },
  }),
  false,
);

assert.equal(
  isCurrentItemAnswerComplete({
    item: sjtItem,
    selectionState: {
      likertSelectionsByQuestionId: {},
      sjtSelectionsByQuestionId: {
        "question-2": {
          bestOptionId: "sjt-option-1",
          worstOptionId: "sjt-option-1",
        },
      },
    },
  }),
  false,
);

assert.equal(
  isCurrentItemAnswerComplete({
    item: sjtItem,
    selectionState: {
      likertSelectionsByQuestionId: {},
      sjtSelectionsByQuestionId: {
        "question-2": {
          bestOptionId: "sjt-option-1",
          worstOptionId: "sjt-option-3",
        },
      },
    },
  }),
  true,
);

assert.deepEqual(
  sanitizeMixedPreviewStoredState({
    runtimeHandoff,
    rawState: {
      currentIndex: 99,
      likertSelectionsByQuestionId: {
        "question-1": "option-4",
        stale: "option-1",
      },
      sjtSelectionsByQuestionId: {
        "question-2": {
          bestOptionId: "sjt-option-2",
          worstOptionId: "missing-option",
        },
        stale: {
          bestOptionId: "ghost",
          worstOptionId: "ghost-2",
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
        bestOptionId: "sjt-option-2",
        worstOptionId: null,
      },
    },
  },
);

assert.deepEqual(
  sanitizeMixedPreviewStoredState({
    runtimeHandoff,
    rawState: {
      currentIndex: 1,
    },
  }),
  {
    currentIndex: 1,
    likertSelectionsByQuestionId: {},
    sjtSelectionsByQuestionId: {},
  },
);

const originalWindow = global.window;

global.window = {
  sessionStorage: {
    getItem(key) {
      assert.equal(key, "team-dynamics-mixed-preview:participant-123");
      return JSON.stringify({
        currentIndex: 1,
        likertSelectionsByQuestionId: {
          "question-1": "option-2",
        },
        sjtSelectionsByQuestionId: {
          "question-2": {
            bestOptionId: "sjt-option-1",
            worstOptionId: "sjt-option-3",
          },
        },
      });
    },
    setItem() {
      throw new Error("write should not happen during read test");
    },
  },
};

assert.deepEqual(
  readMixedPreviewStoredState({
    runtimeHandoff,
    teamAssessmentParticipantId: "participant-123",
  }),
  {
    currentIndex: 1,
    likertSelectionsByQuestionId: {
      "question-1": "option-2",
    },
    sjtSelectionsByQuestionId: {
      "question-2": {
        bestOptionId: "sjt-option-1",
        worstOptionId: "sjt-option-3",
      },
    },
  },
);

assert.deepEqual(
  createInitialMixedPreviewClientState({
    runtimeHandoff,
    teamAssessmentParticipantId: "participant-123",
  }),
  {
    currentIndex: 0,
    selectionState: {
      likertSelectionsByQuestionId: {},
      sjtSelectionsByQuestionId: {},
    },
  },
);

global.window = originalWindow;

assert.equal(
  shouldHideAssessmentFromCandidateDashboard({ slug: "team_dynamics_assessment_v1" }),
  true,
);
assert.equal(STANDARD_ASSESSMENT_BATTERY_SLUGS.includes("team_dynamics_assessment_v1"), false);
assert.deepEqual(
  getReportGenerationCapability({
    testSlug: "team_dynamics_assessment_v1",
    audience: "participant",
    reportType: "individual",
    sourceType: "single_test",
  }),
  { active: false, status: "inactive", reason: "unknown_test" },
);
assert.deepEqual(
  getReportGenerationCapability({
    testSlug: "team_dynamics_assessment_v1",
    audience: "hr",
    reportType: "individual",
    sourceType: "single_test",
  }),
  { active: false, status: "inactive", reason: "unknown_test" },
);

console.log("Team Dynamics assessment v1 UI preview shell tests passed.");
