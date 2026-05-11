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

function collectStrings(value) {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStrings(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap((item) => collectStrings(item));
  }

  return [];
}

const { buildPreparedReportGenerationInput } = require("../lib/assessment/report-provider-helpers.ts");
const { mockReportProvider } = require("../lib/assessment/report-provider-mock.ts");
const {
  formatMwmsHrReportValidationErrors,
  validateMwmsHrReportV1,
} = require("../lib/assessment/mwms-hr-report-v1.ts");
const { validateMwmsParticipantReportV1 } = require("../lib/assessment/mwms-participant-report-v1.ts");
const {
  resolveReportContract,
  resolveReportSignal,
  validateRuntimeCompletedAssessmentReport,
} = require("../lib/assessment/report-providers.ts");
const { getReportGenerationCapability } = require("../lib/assessment/report-capabilities.ts");

const mwmsResults = {
  attemptId: "attempt-mwms-hr-mock",
  scoringMethod: "likert_sum",
  dimensions: [
    { dimension: "amotivation", rawScore: 4, scoredQuestionCount: 3 },
    { dimension: "external_social", rawScore: 4, scoredQuestionCount: 3 },
    { dimension: "external_material", rawScore: 5, scoredQuestionCount: 3 },
    { dimension: "introjected", rawScore: 3.75, scoredQuestionCount: 4 },
    { dimension: "identified", rawScore: 4.67, scoredQuestionCount: 3 },
    { dimension: "intrinsic", rawScore: 5, scoredQuestionCount: 3 },
  ],
  scoredResponseCount: 19,
  unscoredResponses: [],
};

async function main() {
  const hrPreparedInput = buildPreparedReportGenerationInput({
    attemptId: "attempt-mwms-hr-mock",
    testId: "test-mwms",
    testSlug: "mwms_v1",
    audience: "hr",
    locale: "bs",
    scoringMethod: "likert_sum",
    promptVersion: "v1",
    testName: "Procjena radne motivacije",
    results: mwmsResults,
  });

  assert.equal(hrPreparedInput.reportContract.promptKey, "mwms_hr_report_v1");
  assert.equal(hrPreparedInput.promptInput.audience, "hr");
  assert.equal(hrPreparedInput.promptInput.testSlug, "mwms_v1");
  assert.equal(resolveReportContract("mwms_v1", "hr").promptKey, "mwms_hr_report_v1");

  const signal = resolveReportSignal({ testSlug: "mwms_v1", audience: "hr" });
  assert.equal(signal.reportFamily, "mwms");
  assert.equal(signal.reportAudience, "hr");
  assert.equal(signal.reportRenderFormat, "mwms_hr_report_v1");

  const result = await mockReportProvider.generateReport(hrPreparedInput);
  assert.equal(result.ok, true, result.ok ? undefined : result.reason);

  if (!result.ok) {
    throw new Error("Expected MWMS HR mock generation to succeed.");
  }

  const report = result.report;
  assert.equal(report.contractVersion, "mwms_hr_report_v1");
  assert.equal(report.reportType, "mwms_hr_report_v1");
  assert.equal(report.testSlug, "mwms_v1");
  assert.equal(report.audience, "hr");
  assert.equal(report.sourceType, "single_test");
  assert.equal(report.motivation_profile_snapshot.dimensions.length, 6);
  assert.equal(report.key_motivational_drivers.length, 3);
  assert.equal(report.potential_friction_points.length, 3);
  assert.equal(report.work_context_hypotheses.length, 3);
  assert.equal(report.manager_support_guidance.length, 4);
  assert.equal(report.interview_questions.length, 5);
  assert.equal(report.onboarding_recommendations.length, 4);
  assert.equal(report.decision_support_note.length >= 2 && report.decision_support_note.length <= 3, true);

  const expectedDimensions = new Map(
    hrPreparedInput.promptInput.dimensions.map((dimension) => [dimension.code, dimension]),
  );

  for (const dimension of report.motivation_profile_snapshot.dimensions) {
    const expected = expectedDimensions.get(dimension.code);

    assert.ok(expected, `Unexpected MWMS HR dimension ${dimension.code}.`);
    assert.equal(dimension.label, expected.label);
    assert.equal(dimension.rawScore, expected.rawScore);
    assert.equal(dimension.band, expected.band);
    assert.equal(dimension.bandLabel, expected.bandLabel);
  }

  const validation = validateMwmsHrReportV1(report, {
    expectedInput: hrPreparedInput.promptInput,
  });
  assert.equal(validation.ok, true, validation.ok ? undefined : formatMwmsHrReportValidationErrors(validation.errors));

  const runtimeValidation = validateRuntimeCompletedAssessmentReport(report, {
    testSlug: "mwms_v1",
    audience: "hr",
  });
  assert.equal(runtimeValidation.ok, true, runtimeValidation.ok ? undefined : runtimeValidation.reason);

  const forbiddenText = collectStrings(report).join(" ");
  assert.equal(
    /hire|no-hire|hiring score|fit score|preporucuje se zaposljavanje|preporučuje se zapošljavanje|dijagnoz|diagnos|clinical|klinick|kliničk|disorder|mental health|IQ|percentile|percentil|IPIP|SAFRAN/i.test(
      forbiddenText,
    ),
    false,
  );

  const participantPreparedInput = buildPreparedReportGenerationInput({
    attemptId: "attempt-mwms-participant-mock-regression",
    testId: "test-mwms",
    testSlug: "mwms_v1",
    audience: "participant",
    locale: "bs",
    scoringMethod: "likert_sum",
    promptVersion: "v1",
    testName: "Procjena radne motivacije",
    results: mwmsResults,
  });
  const participantResult = await mockReportProvider.generateReport(participantPreparedInput);

  assert.equal(participantResult.ok, true, participantResult.ok ? undefined : participantResult.reason);

  if (!participantResult.ok) {
    throw new Error("Expected MWMS participant mock generation to remain available.");
  }

  const participantValidation = validateMwmsParticipantReportV1(participantResult.report);
  assert.equal(participantValidation.ok, true, participantValidation.ok ? undefined : participantValidation.errors.join(" | "));
  assert.equal(participantResult.report.schema_version, "mwms_participant_report_v1");
  assert.equal(participantResult.report.audience, "participant");

  assert.deepEqual(
    getReportGenerationCapability({
      testSlug: "mwms_v1",
      audience: "hr",
      reportType: "individual",
      sourceType: "single_test",
    }),
    { active: true, status: "active" },
  );

  console.log("MWMS HR report mock provider tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
