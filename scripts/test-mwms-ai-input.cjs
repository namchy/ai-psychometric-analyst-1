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

const {
  buildMwmsParticipantReportPromptInput,
  validateMwmsParticipantReportPromptInput,
} = require("../lib/assessment/mwms-participant-ai-input-v1.ts");

const request = {
  attemptId: "attempt-mwms-ai-input",
  testId: "test-mwms",
  testSlug: "mwms_v1",
  audience: "participant",
  locale: "bs",
  scoringMethod: "likert_sum",
  promptVersion: "v1",
  testName: "Procjena radne motivacije",
  results: {
    attemptId: "attempt-mwms-ai-input",
    scoringMethod: "likert_sum",
    dimensions: [
      { dimension: "amotivation", rawScore: 5.25, scoredQuestionCount: 3 },
      { dimension: "external_social", rawScore: 5, scoredQuestionCount: 3 },
      { dimension: "external_material", rawScore: 4.75, scoredQuestionCount: 3 },
      { dimension: "introjected", rawScore: 5.5, scoredQuestionCount: 4 },
      { dimension: "identified", rawScore: 4.75, scoredQuestionCount: 3 },
      { dimension: "intrinsic", rawScore: 4.5, scoredQuestionCount: 3 },
    ],
    scoredResponseCount: 19,
    unscoredResponses: [],
  },
};

const input = buildMwmsParticipantReportPromptInput(request);
const validation = validateMwmsParticipantReportPromptInput(input);

assert.equal(validation.ok, true, validation.ok ? undefined : validation.errors.join(" | "));
assert.equal(input.test_slug, "mwms_v1");
assert.equal(input.report_type, "individual");
assert.equal(input.audience, "participant");
assert.deepEqual(input.scale, { min: 1, max: 7 });
assert.equal(input.dimensions.length, 6);
assert.equal(input.dimensions.every((dimension) => dimension.raw_score >= 1 && dimension.raw_score <= 7), true);
assert.equal(input.derived_profile.autonomous_motivation_score, 4.63);
assert.equal(input.derived_profile.controlled_motivation_score, 5.08);
assert.equal(input.derived_profile.amotivation_score, 5.25);
assert.deepEqual(input.derived_profile.dominant_dimensions, ["introjected", "amotivation"]);
assert.deepEqual(input.derived_profile.lower_dimensions, ["intrinsic", "identified"]);
assert.deepEqual(input.derived_profile.caution_flags, {
  elevated_amotivation: true,
  high_controlled_relative_to_autonomous: false,
  mixed_profile: true,
});
assert.deepEqual(input.guardrails, [
  "no_hiring_decision",
  "no_diagnosis",
  "no_total_score",
  "no_percentile",
  "interpret_as_profile",
  "use_as_conversation_starting_point",
]);
assert.equal("responses" in input, false);
assert.equal("raw_answers" in input, false);

console.log("MWMS AI input tests passed.");
