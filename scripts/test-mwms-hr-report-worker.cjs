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

const workerSource = fs.readFileSync(
  path.join(projectRoot, "lib/assessment/report-job-worker.ts"),
  "utf8",
);

assert.equal(/MWMS V1 supports participant reports only/i.test(workerSource), false);
assert.equal(/MWMS_HR_REPORT_V1_CONTRACT\.promptKey/.test(workerSource), true);
assert.equal(/isMwmsTestSlug\(job\.test_slug\) && job\.audience === "hr"/.test(workerSource), true);

const { buildPreparedReportGenerationInput } = require("../lib/assessment/report-provider-helpers.ts");
const { mockReportProvider } = require("../lib/assessment/report-provider-mock.ts");
const {
  validateRuntimeCompletedAssessmentReport,
} = require("../lib/assessment/report-providers.ts");
const {
  formatMwmsHrReportValidationErrors,
  validateMwmsHrReportV1,
} = require("../lib/assessment/mwms-hr-report-v1.ts");

const queuedMwmsHrRequest = {
  attemptId: "attempt-mwms-hr-worker",
  testId: "test-mwms",
  testSlug: "mwms_v1",
  audience: "hr",
  locale: "bs",
  scoringMethod: "likert_sum",
  promptVersion: "v1",
  testName: "Procjena radne motivacije",
  results: {
    attemptId: "attempt-mwms-hr-worker",
    scoringMethod: "likert_sum",
    dimensions: [
      { dimension: "amotivation", rawScore: 2.25, scoredQuestionCount: 3 },
      { dimension: "external_social", rawScore: 4, scoredQuestionCount: 3 },
      { dimension: "external_material", rawScore: 5, scoredQuestionCount: 3 },
      { dimension: "introjected", rawScore: 3.75, scoredQuestionCount: 4 },
      { dimension: "identified", rawScore: 4.67, scoredQuestionCount: 3 },
      { dimension: "intrinsic", rawScore: 5.5, scoredQuestionCount: 3 },
    ],
    scoredResponseCount: 19,
    unscoredResponses: [],
  },
};

async function main() {
  const preparedInput = buildPreparedReportGenerationInput(queuedMwmsHrRequest);
  const generationResult = await mockReportProvider.generateReport(preparedInput);

  assert.equal(generationResult.ok, true, generationResult.ok ? undefined : generationResult.reason);

  if (!generationResult.ok) {
    throw new Error("Expected MWMS HR worker mock generation path to succeed.");
  }

  const runtimeValidation = validateRuntimeCompletedAssessmentReport(generationResult.report, {
    testSlug: "mwms_v1",
    audience: "hr",
  });
  assert.equal(runtimeValidation.ok, true, runtimeValidation.ok ? undefined : runtimeValidation.reason);

  const contractValidation = validateMwmsHrReportV1(generationResult.report, {
    expectedInput: preparedInput.promptInput,
  });
  assert.equal(
    contractValidation.ok,
    true,
    contractValidation.ok ? undefined : formatMwmsHrReportValidationErrors(contractValidation.errors),
  );

  assert.equal(generationResult.report.contractVersion, "mwms_hr_report_v1");
  assert.equal(generationResult.report.reportType, "mwms_hr_report_v1");
  assert.equal(generationResult.report.audience, "hr");
  assert.equal(generationResult.report.motivation_profile_snapshot.dimensions.length, 6);

  const simulatedWorkerResult = {
    status: "ready",
    reportId: "report-mwms-hr-worker",
    snapshot: runtimeValidation.value,
  };
  assert.equal(simulatedWorkerResult.status, "ready");
  assert.equal(simulatedWorkerResult.snapshot.reportType, "mwms_hr_report_v1");

  console.log("MWMS HR report worker admission tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
