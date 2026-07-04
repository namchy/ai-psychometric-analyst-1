const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
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
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const completionPath = path.join(projectRoot, "lib", "assessment", "completion.ts");
const completionServerPath = path.join(projectRoot, "lib", "assessment", "completion-server.ts");
const assessmentActionsPath = path.join(projectRoot, "app", "actions", "assessment.ts");

const {
  getAssessmentCompletionState,
  isCompleteNumericInputValue,
  isTextQuestionSelectionValidForPersistence,
} = require("../lib/assessment/completion.ts");
const {
  getAssessmentQuestionRendererType,
} = require("../lib/assessment/test-render-types.ts");

assert.equal(getAssessmentQuestionRendererType({ code: "NZ01", question_type: "text" }), "numeric_input");
assert.equal(getAssessmentQuestionRendererType({ code: "IPIP01", question_type: "text" }), "text_input");
assert.equal(
  getAssessmentQuestionRendererType({
    code: "FA01",
    question_type: "single_choice",
    stimulus_image_path: "/stimulus.png",
  }),
  "image_choice",
);

for (const value of ["12", "-12", "12.5", "12,5"]) {
  assert.equal(isCompleteNumericInputValue(value), true, `Expected ${value} to be a valid numeric input.`);
}

for (const value of ["abc", "-", "12.", ""]) {
  assert.equal(
    isCompleteNumericInputValue(value),
    false,
    `Expected ${value || "<empty>"} to be rejected by the complete numeric rule.`,
  );
}

const numericQuestion = { question_type: "text", renderer_type: "numeric_input" };
const textQuestion = { question_type: "text", renderer_type: "text_input" };

assert.equal(isTextQuestionSelectionValidForPersistence(numericQuestion, "12"), true);
assert.equal(isTextQuestionSelectionValidForPersistence(numericQuestion, "12,5"), true);
assert.equal(isTextQuestionSelectionValidForPersistence(numericQuestion, "-"), false);
assert.equal(isTextQuestionSelectionValidForPersistence(numericQuestion, "abc"), false);
assert.equal(isTextQuestionSelectionValidForPersistence(numericQuestion, ""), true);

assert.equal(isTextQuestionSelectionValidForPersistence(textQuestion, "abc"), true);
assert.equal(isTextQuestionSelectionValidForPersistence(textQuestion, "-"), true);

const numericCompletionState = getAssessmentCompletionState(
  [
    {
      id: "q-numeric",
      text: "Numeric question",
      question_type: "text",
      is_required: true,
      renderer_type: "numeric_input",
    },
  ],
  { "q-numeric": "-" },
);

assert.equal(numericCompletionState.isComplete, false);
assert.deepEqual(numericCompletionState.missingRequiredQuestionIds, ["q-numeric"]);

const validNumericCompletionState = getAssessmentCompletionState(
  [
    {
      id: "q-numeric",
      text: "Numeric question",
      question_type: "text",
      is_required: true,
      renderer_type: "numeric_input",
    },
  ],
  { "q-numeric": "12,5" },
);

assert.equal(validNumericCompletionState.isComplete, true);

const nonNumericCompletionState = getAssessmentCompletionState(
  [
    {
      id: "q-text",
      text: "Text question",
      question_type: "text",
      is_required: true,
      renderer_type: "text_input",
    },
  ],
  { "q-text": "abc" },
);

assert.equal(nonNumericCompletionState.isComplete, true);

const completionSource = fs.readFileSync(completionServerPath, "utf8");
const assessmentActionsSource = fs.readFileSync(assessmentActionsPath, "utf8");
const completionModuleSource = fs.readFileSync(completionPath, "utf8");

assert.match(completionModuleSource, /export function isCompleteNumericInputValue/);
assert.match(completionModuleSource, /export function isTextQuestionSelectionValidForPersistence/);
assert.match(completionSource, /getAssessmentQuestionRendererType/);
assert.match(completionSource, /renderer_type:\s*getAssessmentQuestionRendererType\(question\)/);
assert.match(assessmentActionsSource, /isTextQuestionSelectionValidForPersistence/);
assert.match(assessmentActionsSource, /renderer_type:\s*getAssessmentQuestionRendererType\(question\)/);
assert.match(assessmentActionsSource, /Numeric responses must contain a valid number\./);

console.log("Assessment numeric validation parity tests passed.");
