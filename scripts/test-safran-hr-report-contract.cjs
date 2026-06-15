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
  buildMockSafranHrReportV1,
  buildSafranHrReportInput,
  validateSafranHrReport,
} = require("../lib/assessment/safran-hr-report-v1.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const input = buildSafranHrReportInput({
  testSlug: "safran_v1",
  locale: "bs",
  results: {
    attemptId: "attempt-safran-hr-contract",
    scoringMethod: "correct_answers",
    dimensions: [
      { dimension: "verbal_score", rawScore: 13, scoredQuestionCount: 18 },
      { dimension: "figural_score", rawScore: 9, scoredQuestionCount: 18 },
      { dimension: "numerical_series_score", rawScore: 6, scoredQuestionCount: 18 },
      { dimension: "cognitive_composite_v1", rawScore: 28, scoredQuestionCount: 54 },
    ],
    scoredResponseCount: 45,
    unscoredResponses: [],
    derived: {
      safranV1: {
        verbalScore: 13,
        figuralScore: 9,
        numericalRawScore: 3,
        numericalAdjustedScore: 6,
        numericalScore: 6,
        numericalSeriesScore: 6,
        cognitiveCompositeScore: 28,
        cognitiveCompositeV1: 28,
      },
    },
  },
});

const validReport = buildMockSafranHrReportV1(input);
const validResult = validateSafranHrReport(validReport, { expectedInput: input });
assert.equal(validResult.ok, true, validResult.ok ? undefined : validResult.errors.join(" | "));
assert.deepEqual(validReport.scoreReferences, {
  overall: { key: "overall", ...input.scores.overall },
  verbal: { key: "verbal", ...input.scores.verbal },
  figural: { key: "figural", ...input.scores.figural },
  numeric: { key: "numeric", ...input.scores.numeric },
});

function assertInvalidReport(mutator) {
  const report = clone(validReport);
  mutator(report);
  assert.equal(validateSafranHrReport(report, { expectedInput: input }).ok, false);
}

assertInvalidReport((report) => {
  delete report.scoreReferences;
});
assertInvalidReport((report) => {
  report.scoreReferences.overall.rawScore += 1;
});
assertInvalidReport((report) => {
  report.scoreReferences.verbal.maxScore += 1;
});
assertInvalidReport((report) => {
  report.scoreReferences.figural.scoreLabel = "wrong";
});
assertInvalidReport((report) => {
  report.scoreReferences.numeric.band =
    input.scores.numeric.band === "moderate" ? "higher" : "moderate";
});
assertInvalidReport((report) => {
  report.scoreReferences.overall.bandLabel = "Wrong band label";
});
assertInvalidReport((report) => {
  const overall = report.scoreReferences.overall;
  report.scoreReferences.overall = report.scoreReferences.verbal;
  report.scoreReferences.verbal = overall;
});
assertInvalidReport((report) => {
  report.scoreReferences.figural.key = "numeric";
});
assertInvalidReport((report) => {
  report.scoreReferences.numeric.extra = true;
});
assertInvalidReport((report) => {
  report.generatedLanguage = "en";
});

const wrongAudience = clone(validReport);
wrongAudience.audience = "participant";
assert.equal(validateSafranHrReport(wrongAudience, { expectedInput: input }).ok, false);

const iqReport = clone(validReport);
iqReport.executiveSummary.summary = "IQ rezultat može ukazivati na inteligentan profil.";
assert.equal(validateSafranHrReport(iqReport, { expectedInput: input }).ok, false);

const percentileReport = clone(validReport);
percentileReport.cognitiveSignals.overall =
  "Ovaj signal izgleda kao percentil u populaciji.";
assert.equal(validateSafranHrReport(percentileReport, { expectedInput: input }).ok, false);

const normReport = clone(validReport);
normReport.pointsOfCaution[0].whyItMatters =
  "Ovo je norma i normativno poređenje u odnosu na populaciju.";
assert.equal(validateSafranHrReport(normReport, { expectedInput: input }).ok, false);

const hireReport = clone(validReport);
hireReport.interviewQuestions[0].whatToListenFor =
  "Ako odgovor zvuči snažno, preporučuje se zapošljavanje.";
assert.equal(validateSafranHrReport(hireReport, { expectedInput: input }).ok, false);

const missingSafetyChecks = clone(validReport);
delete missingSafetyChecks.safetyChecks;
assert.equal(validateSafranHrReport(missingSafetyChecks, { expectedInput: input }).ok, false);

const falseSafetyChecks = clone(validReport);
falseSafetyChecks.safetyChecks.noScoreMutation = false;
assert.equal(validateSafranHrReport(falseSafetyChecks, { expectedInput: input }).ok, false);

const wrongSourceType = clone(validReport);
wrongSourceType.sourceType = "composite";
assert.equal(validateSafranHrReport(wrongSourceType, { expectedInput: input }).ok, false);

console.log("SAFRAN HR report contract tests passed.");
