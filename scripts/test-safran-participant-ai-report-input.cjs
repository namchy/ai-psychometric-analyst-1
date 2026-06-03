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
  if (request === "server-only") {
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
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  buildSafranParticipantAiReportInput,
  SAFRAN_PARTICIPANT_PROMPT_KEY,
} = require("../lib/assessment/safran-participant-ai-report-v1.ts");
const {
  buildPreparedReportGenerationInput,
} = require("../lib/assessment/report-provider-helpers.ts");
const {
  resolveReportContract,
  resolveReportSignal,
} = require("../lib/assessment/report-providers.ts");

const request = {
  attemptId: "attempt-safran-input",
  testId: "test-safran",
  testSlug: "safran_v1",
  audience: "participant",
  locale: "bs",
  scoringMethod: "correct_answers",
  promptVersion: "v1",
  testName: "SAFRAN",
  results: {
    attemptId: "attempt-safran-input",
    scoringMethod: "correct_answers",
    dimensions: [
      { dimension: "verbal_score", rawScore: 5, scoredQuestionCount: 18 },
      { dimension: "figural_score", rawScore: 12, scoredQuestionCount: 18 },
      { dimension: "numerical_series_score", rawScore: 14, scoredQuestionCount: 18 },
      { dimension: "cognitive_composite_v1", rawScore: 31, scoredQuestionCount: 54 },
    ],
    scoredResponseCount: 45,
    unscoredResponses: [],
    derived: {
      safranV1: {
        verbalScore: 5,
        figuralScore: 12,
        numericalRawScore: 7,
        numericalAdjustedScore: 14,
        numericalScore: 14,
        numericalSeriesScore: 14,
        cognitiveCompositeScore: 31,
        cognitiveCompositeV1: 31,
      },
    },
  },
};

const input = buildSafranParticipantAiReportInput(request);
assert.equal(input.test.slug, "safran_v1");
assert.equal(input.test.displayName, "SAFRAN");
assert.equal(input.test.audience, "participant");
assert.equal(input.test.locale, "bs");
assert.equal(input.scores.overall.scoreLabel, "31/54");
assert.equal(input.scores.overall.bandLabel, "umjeren ukupni broj tačnih odgovora");
assert.deepEqual(
  input.scores.domains.map((domain) => ({
    code: domain.code,
    scoreLabel: domain.scoreLabel,
    bandLabel: domain.bandLabel,
  })),
  [
    {
      code: "verbal",
      scoreLabel: "5/18",
      bandLabel: "manji broj tačnih odgovora",
    },
    {
      code: "figural",
      scoreLabel: "12/18",
      bandLabel: "umjeren broj tačnih odgovora",
    },
    {
      code: "numeric",
      scoreLabel: "14/18",
      bandLabel: "veći broj tačnih odgovora",
    },
  ],
);
assert.equal(input.scores.domains.every((domain) => typeof domain.deterministicMeaning === "string" && domain.deterministicMeaning.length > 0), true);

const serialized = JSON.stringify(input);
for (const forbiddenKey of ["responses", "raw_answers", "answer_options", "questions", "item_bank"]) {
  assert.equal(serialized.includes(forbiddenKey), false, `Input should not include ${forbiddenKey}.`);
}

const preparedInput = buildPreparedReportGenerationInput(request, {
  promptVersionId: null,
  promptTemplate: null,
});
assert.equal(preparedInput.reportContract.promptKey, SAFRAN_PARTICIPANT_PROMPT_KEY);
assert.deepEqual(preparedInput.promptInput, input);

const contract = resolveReportContract("safran_v1", "participant");
assert.equal(contract.family, "safran");
assert.equal(contract.promptKey, SAFRAN_PARTICIPANT_PROMPT_KEY);

const signal = resolveReportSignal({ testSlug: "safran_v1", audience: "participant" });
assert.equal(signal.reportFamily, "safran");
assert.equal(signal.reportRenderFormat, "safran_participant_ai_report_v1");

console.log("SAFRAN participant AI report input tests passed.");
