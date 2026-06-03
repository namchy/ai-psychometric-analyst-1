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
  buildSafranHrReportInput,
} = require("../lib/assessment/safran-hr-report-v1.ts");

function buildResults(overrides = {}) {
  return {
    attemptId: "attempt-safran-hr-input",
    scoringMethod: "correct_answers",
    dimensions: [
      { dimension: "verbal_score", rawScore: 9, scoredQuestionCount: 18 },
      { dimension: "figural_score", rawScore: 11, scoredQuestionCount: 18 },
      { dimension: "numerical_series_score", rawScore: 7, scoredQuestionCount: 18 },
      { dimension: "cognitive_composite_v1", rawScore: 27, scoredQuestionCount: 54 },
    ],
    scoredResponseCount: 45,
    unscoredResponses: [],
    derived: {
      safranV1: {
        verbalScore: 9,
        figuralScore: 11,
        numericalRawScore: 3.5,
        numericalAdjustedScore: 7,
        numericalScore: 7,
        numericalSeriesScore: 7,
        cognitiveCompositeScore: 27,
        cognitiveCompositeV1: 27,
      },
    },
    ...overrides,
  };
}

const input = buildSafranHrReportInput({
  testSlug: "safran_v1",
  locale: "hr",
  results: buildResults(),
});

assert.equal(input.test.slug, "safran_v1");
assert.equal(input.test.audience, "hr");
assert.equal(input.test.reportType, "individual");
assert.equal(input.test.sourceType, "single_test");
assert.equal(input.test.locale, "hr");
assert.equal(input.scores.overall.rawScore, 27);
assert.equal(input.scores.overall.scoreLabel, "27/54");
assert.equal(input.scores.verbal.rawScore, 9);
assert.equal(input.scores.verbal.scoreLabel, "9/18");
assert.equal(input.scores.figural.rawScore, 11);
assert.equal(input.scores.numeric.rawScore, 7);
assert.equal(input.interpretationBoundaries.noIq, true);
assert.equal(input.interpretationBoundaries.noPercentiles, true);
assert.equal(input.interpretationBoundaries.noNorms, true);
assert.equal(input.interpretationBoundaries.noHireNoHire, true);
assert.equal(input.interpretationBoundaries.noScoreMutation, true);
assert.equal(input.interpretationBoundaries.noScoreRecalculation, true);
assert.equal(input.reportRules.useHrPerspective, true);
assert.equal(input.reportRules.generateInterviewQuestions, true);
assert.equal(input.reportRules.generatePointsOfCaution, true);
assert.equal(input.reportRules.generateOnboardingGuidance, true);
assert.equal(input.reportRules.avoidDiagnosticLanguage, true);
assert.equal(input.reportRules.keepSignalsAsHypotheses, true);

assert.throws(
  () =>
    buildSafranHrReportInput({
      testSlug: "ipip-neo-120-v1",
      locale: "bs",
      results: buildResults(),
    }),
  /requires safran_v1/i,
);

assert.throws(
  () =>
    buildSafranHrReportInput({
      testSlug: "safran_v1",
      locale: "bs",
      results: buildResults({
        dimensions: [
          { dimension: "verbal_score", rawScore: 9, scoredQuestionCount: 18 },
          { dimension: "figural_score", rawScore: 11, scoredQuestionCount: 18 },
          { dimension: "numerical_series_score", rawScore: 7, scoredQuestionCount: 18 },
        ],
        derived: {
          safranV1: {
            verbalScore: 9,
            figuralScore: 11,
            numericalRawScore: 3.5,
            numericalAdjustedScore: 7,
            numericalScore: 7,
            numericalSeriesScore: 7,
            cognitiveCompositeScore: null,
            cognitiveCompositeV1: null,
          },
        },
      }),
    }),
  /requires cognitive_composite_v1/i,
);

console.log("SAFRAN HR report input tests passed.");
