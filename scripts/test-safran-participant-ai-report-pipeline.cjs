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
  resolveReportContract,
  resolveReportSignal,
  validateRuntimeCompletedAssessmentReport,
} = require("../lib/assessment/report-providers.ts");
const {
  buildPreparedReportGenerationInput,
} = require("../lib/assessment/report-provider-helpers.ts");

const request = {
  attemptId: "attempt-safran-pipeline",
  testId: "test-safran",
  testSlug: "safran_v1",
  audience: "participant",
  locale: "bs",
  scoringMethod: "correct_answers",
  promptVersion: "v1",
  testName: "SAFRAN",
  results: {
    attemptId: "attempt-safran-pipeline",
    scoringMethod: "correct_answers",
    dimensions: [
      { dimension: "verbal_score", rawScore: 10, scoredQuestionCount: 18 },
      { dimension: "figural_score", rawScore: 10, scoredQuestionCount: 18 },
      { dimension: "numerical_series_score", rawScore: 10, scoredQuestionCount: 18 },
      { dimension: "cognitive_composite_v1", rawScore: 30, scoredQuestionCount: 54 },
    ],
    scoredResponseCount: 45,
    unscoredResponses: [],
    derived: {
      safranV1: {
        verbalScore: 10,
        figuralScore: 10,
        numericalRawScore: 5,
        numericalAdjustedScore: 10,
        numericalScore: 10,
        numericalSeriesScore: 10,
        cognitiveCompositeScore: 30,
        cognitiveCompositeV1: 30,
      },
    },
  },
};

async function main() {
  const preparedInput = buildPreparedReportGenerationInput(request, {
    promptVersionId: null,
    promptTemplate: null,
  });
  const signal = resolveReportSignal({ testSlug: "safran_v1", audience: "participant" });

  assert.equal(preparedInput.reportContract.promptKey, "safran_participant_ai_report_v1");
  assert.equal(resolveReportContract("safran_v1", "participant").family, "safran");
  assert.equal(signal.reportRenderFormat, "safran_participant_ai_report_v1");

  const result = await mockReportProvider.generateReport(preparedInput);
  assert.equal(result.ok, true, result.ok ? undefined : result.reason);

  if (!result.ok) {
    throw new Error("Expected mock SAFRAN report generation to succeed.");
  }

  const runtimeValidation = validateRuntimeCompletedAssessmentReport(result.report, {
    testSlug: "safran_v1",
    audience: "participant",
  });
  assert.equal(runtimeValidation.ok, true, runtimeValidation.ok ? undefined : runtimeValidation.reason);
  assert.equal(result.report.reportType, "safran_participant_ai_report_v1");
  assert.equal(result.report.header.title, "SAFRAN");
  assert.match(
    [
      result.report.summary.interpretation,
      result.report.cognitiveSignals.primarySignal,
      result.report.cognitiveSignals.cautionSignal,
      result.report.cognitiveSignals.balanceNote,
    ].join(" "),
    /obrazac|odnos|kontrast|razlika|u odnosu na/i,
  );

  console.log("SAFRAN participant AI report pipeline tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
