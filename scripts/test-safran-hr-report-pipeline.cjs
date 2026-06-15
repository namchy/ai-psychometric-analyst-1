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

const { mockReportProvider } = require("../lib/assessment/report-provider-mock.ts");
const {
  buildPreparedReportGenerationInput,
} = require("../lib/assessment/report-provider-helpers.ts");
const {
  generateCompletedAssessmentReport,
} = require("../lib/assessment/reports.ts");
const {
  resolveReportContract,
  resolveReportSignal,
  validateRuntimeCompletedAssessmentReport,
} = require("../lib/assessment/report-providers.ts");
const {
  validateSafranHrReport,
} = require("../lib/assessment/safran-hr-report-v1.ts");

function buildSafranResults() {
  return {
    attemptId: "attempt-safran-hr-pipeline",
    scoringMethod: "correct_answers",
    dimensions: [
      { dimension: "verbal_score", rawScore: 12, scoredQuestionCount: 18 },
      { dimension: "figural_score", rawScore: 9, scoredQuestionCount: 18 },
      { dimension: "numerical_series_score", rawScore: 5, scoredQuestionCount: 18 },
      { dimension: "cognitive_composite_v1", rawScore: 26, scoredQuestionCount: 54 },
    ],
    scoredResponseCount: 45,
    unscoredResponses: [],
    derived: {
      safranV1: {
        verbalScore: 12,
        figuralScore: 9,
        numericalRawScore: 2.5,
        numericalAdjustedScore: 5,
        numericalScore: 5,
        numericalSeriesScore: 5,
        cognitiveCompositeScore: 26,
        cognitiveCompositeV1: 26,
      },
    },
  };
}

async function main() {
  const hrRequest = {
    attemptId: "attempt-safran-hr-pipeline",
    testId: "test-safran",
    testSlug: "safran_v1",
    audience: "hr",
    locale: "bs",
    scoringMethod: "correct_answers",
    promptVersion: "v1",
    testName: "SAFRAN",
    results: buildSafranResults(),
  };

  const participantRequest = {
    ...hrRequest,
    attemptId: "attempt-safran-participant-regression",
    audience: "participant",
  };

  const preparedHrInput = buildPreparedReportGenerationInput(hrRequest, {
    promptVersionId: null,
    promptTemplate: null,
  });
  const preparedParticipantInput = buildPreparedReportGenerationInput(participantRequest, {
    promptVersionId: null,
    promptTemplate: null,
  });

  assert.equal(preparedHrInput.promptInput.test.audience, "hr");
  assert.equal(preparedHrInput.promptInput.test.sourceType, "single_test");
  assert.equal(preparedHrInput.promptInput.test.reportType, "individual");
  assert.equal(preparedHrInput.promptInput.test.slug, "safran_v1");
  assert.equal(preparedParticipantInput.promptInput.test.audience, "participant");

  const hrContract = resolveReportContract("safran_v1", "hr");
  assert.equal(hrContract.family, "safran");
  assert.equal(hrContract.promptKey, "safran_hr_report_v1");

  const hrSignal = resolveReportSignal({ testSlug: "safran_v1", audience: "hr" });
  assert.equal(hrSignal.reportFamily, "safran");
  assert.equal(hrSignal.reportRenderFormat, "safran_hr_report_v1");

  const mockResult = await mockReportProvider.generateReport(preparedHrInput);
  assert.equal(mockResult.ok, true, mockResult.ok ? undefined : mockResult.reason);

  if (!mockResult.ok) {
    throw new Error("Expected SAFRAN HR mock report generation to succeed.");
  }

  const runtimeValidation = validateRuntimeCompletedAssessmentReport(mockResult.report, {
    testSlug: "safran_v1",
    audience: "hr",
  });
  assert.equal(runtimeValidation.ok, true, runtimeValidation.ok ? undefined : runtimeValidation.reason);
  assert.equal(mockResult.report.reportType, "safran_hr_report_v1");
  assert.equal(mockResult.report.audience, "hr");
  assert.equal(mockResult.report.sourceType, "single_test");
  assert.deepEqual(mockResult.report.scoreReferences, {
    overall: { key: "overall", ...preparedHrInput.promptInput.scores.overall },
    verbal: { key: "verbal", ...preparedHrInput.promptInput.scores.verbal },
    figural: { key: "figural", ...preparedHrInput.promptInput.scores.figural },
    numeric: { key: "numeric", ...preparedHrInput.promptInput.scores.numeric },
  });

  const allTexts = [
    mockResult.report.executiveSummary.summary,
    ...Object.values(mockResult.report.cognitiveSignals),
    ...mockResult.report.pointsOfCaution.flatMap((item) => [
      item.signal,
      item.whyItMatters,
      item.howToCheck,
    ]),
    ...mockResult.report.interviewQuestions.flatMap((item) => [
      item.category,
      item.question,
      item.whatToListenFor,
    ]),
    ...mockResult.report.onboardingGuidance.first30Days,
    ...mockResult.report.onboardingGuidance.days60,
    ...mockResult.report.onboardingGuidance.days90,
    ...mockResult.report.interpretationLimits,
  ].join(" ");

  assert.equal(/iq|percentil|percentile|norma|normativno|hire|no-hire|red flag|rizičan kandidat|idealni kandidat|iznadprosječan|ispodprosječan/i.test(allTexts), false);
  assert.equal(preparedHrInput.promptInput.scores.overall.rawScore, hrRequest.results.derived.safranV1.cognitiveCompositeV1);
  assert.equal(preparedHrInput.promptInput.scores.verbal.rawScore, hrRequest.results.derived.safranV1.verbalScore);

  const generatedResult = await generateCompletedAssessmentReport(hrRequest, {
    provider: "mock",
    promptVersionId: null,
    promptTemplate: null,
  });
  assert.equal(generatedResult.status, "ready");
  assert.equal(generatedResult.report.reportType, "safran_hr_report_v1");
  assert.equal(generatedResult.report.audience, "hr");

  const invalidReport = JSON.parse(JSON.stringify(mockResult.report));
  invalidReport.executiveSummary.summary =
    "IQ i percentil sugerišu idealni kandidat i preporučuje se zapošljavanje.";
  assert.equal(validateSafranHrReport(invalidReport, { expectedInput: preparedHrInput.promptInput }).ok, false);

  console.log("SAFRAN HR report pipeline tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
