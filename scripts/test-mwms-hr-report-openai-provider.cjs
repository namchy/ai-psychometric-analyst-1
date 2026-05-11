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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

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
  buildDefaultUserPrompt,
  resolveOpenAiResponseFormatSchemaForInput,
  validateStructuredReport,
} = require("../lib/assessment/report-provider-openai.ts");
const {
  mwmsHrReportV1OpenAiSchema,
} = require("../lib/assessment/mwms-hr-report-v1.ts");
const {
  mwmsParticipantReportV1OpenAiSchema,
} = require("../lib/assessment/mwms-participant-report-v1.ts");
const { getReportGenerationCapability } = require("../lib/assessment/report-capabilities.ts");

function buildMwmsResults() {
  return {
    attemptId: "attempt-mwms-hr-openai-provider",
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
}

function buildPreparedInput(audience) {
  return buildPreparedReportGenerationInput(
    {
      attemptId: `attempt-mwms-${audience}-openai-provider`,
      testId: "test-mwms",
      testSlug: "mwms_v1",
      audience,
      locale: "bs",
      scoringMethod: "likert_sum",
      promptVersion: "v1",
      testName: "Procjena radne motivacije",
      results: buildMwmsResults(),
    },
    {
      promptVersionId: null,
      promptTemplate: null,
    },
  );
}

function loadPackagePrompt(filePath, promptKey) {
  const rows = JSON.parse(fs.readFileSync(path.join(projectRoot, filePath), "utf8"));
  return rows.find((prompt) => prompt.prompt_key === promptKey) ?? null;
}

async function main() {
  const hrInput = buildPreparedInput("hr");
  const participantInput = buildPreparedInput("participant");

  assert.equal(hrInput.reportContract.promptKey, "mwms_hr_report_v1");
  assert.equal(hrInput.reportContract.schemaName, "mwms-hr-report-v1");
  assert.deepEqual(resolveOpenAiResponseFormatSchemaForInput(hrInput), mwmsHrReportV1OpenAiSchema);
  assert.deepEqual(
    resolveOpenAiResponseFormatSchemaForInput(participantInput),
    mwmsParticipantReportV1OpenAiSchema,
  );

  const hrPrompt = JSON.parse(buildDefaultUserPrompt(hrInput));

  assert.equal(hrPrompt.input.testSlug, "mwms_v1");
  assert.equal(hrPrompt.input.audience, "hr");
  assert.match(hrPrompt.instructions.output_contract, /mwms_hr_report_v1/);
  assert.match(hrPrompt.instructions.source_rule, /deterministic MWMS input/i);
  assert.match(hrPrompt.instructions.score_integrity_rule, /rawScore, band and bandLabel exactly/i);
  assert.match(hrPrompt.instructions.single_test_rule, /single-test MWMS report/i);
  assert.match(
    hrPrompt.instructions.interpretation_rule,
    /HR hypotheses|angazman|intervju|onboarding|menadzersku podrsku/i,
  );
  assert.equal(
    hrPrompt.instructions.structure_rules.some((item) => /key_motivational_drivers.*exactly 3/i.test(item)),
    true,
  );
  assert.equal(
    hrPrompt.instructions.structure_rules.some((item) => /interview_questions.*exactly 5/i.test(item)),
    true,
  );
  assert.equal(
    hrPrompt.instructions.content_rules.some((item) => /selection verdict|ranking|fit score|performance forecast/i.test(item)),
    true,
  );

  const participantPrompt = JSON.parse(buildDefaultUserPrompt(participantInput));
  assert.equal(participantPrompt.input.audience, "participant");
  assert.match(participantPrompt.instructions.output_contract, /mwms_participant_report_v1/);
  assert.doesNotMatch(participantPrompt.instructions.output_contract, /mwms_hr_report_v1/);

  const packagePrompt = loadPackagePrompt("assessment-packages/mwms_v1/prompts.json", "mwms_hr_report_v1");
  const packagePromptBs = loadPackagePrompt("assessment-packages/mwms_v1/locales/bs/prompts.json", "mwms_hr_report_v1");
  const packagePromptHr = loadPackagePrompt("assessment-packages/mwms_v1/locales/hr/prompts.json", "mwms_hr_report_v1");

  assert.ok(packagePrompt, "Expected MWMS HR package prompt.");
  assert.ok(packagePromptBs, "Expected MWMS HR bs package prompt localization.");
  assert.ok(packagePromptHr, "Expected MWMS HR hr package prompt localization.");
  assert.equal(packagePrompt.audience, "hr");
  assert.equal(packagePrompt.report_type, "individual");
  assert.equal(packagePrompt.source_type, "single_test");
  assert.equal(packagePrompt.generator_type, "openai");
  assert.equal(packagePrompt.is_active, true);
  assert.deepEqual(packagePrompt.output_schema_json, mwmsHrReportV1OpenAiSchema);
  assert.match(packagePrompt.system_prompt, /deterministic MWMS input/i);
  assert.match(packagePrompt.user_prompt_template, /motivation_profile_snapshot\.dimensions/i);

  const hrMockResult = await mockReportProvider.generateReport(hrInput);
  assert.equal(hrMockResult.ok, true, hrMockResult.ok ? undefined : hrMockResult.reason);

  if (!hrMockResult.ok) {
    throw new Error("Expected MWMS HR mock report to be available for OpenAI validator branch test.");
  }

  const validatedHrReport = validateStructuredReport(hrMockResult.report, hrInput);
  assert.equal(validatedHrReport.contractVersion, "mwms_hr_report_v1");
  assert.equal(validatedHrReport.reportType, "mwms_hr_report_v1");
  assert.equal(validatedHrReport.audience, "hr");
  assert.equal(validatedHrReport.key_motivational_drivers.length, 3);
  assert.equal(validatedHrReport.potential_friction_points.length, 3);
  assert.equal(validatedHrReport.work_context_hypotheses.length, 3);
  assert.equal(validatedHrReport.manager_support_guidance.length, 4);
  assert.equal(validatedHrReport.interview_questions.length, 5);
  assert.equal(validatedHrReport.onboarding_recommendations.length, 4);

  const expectedDimensions = new Map(
    hrInput.promptInput.dimensions.map((dimension) => [dimension.code, dimension]),
  );

  for (const dimension of validatedHrReport.motivation_profile_snapshot.dimensions) {
    const expected = expectedDimensions.get(dimension.code);

    assert.ok(expected, `Unexpected MWMS HR dimension ${dimension.code}.`);
    assert.equal(dimension.label, expected.label);
    assert.equal(dimension.rawScore, expected.rawScore);
    assert.equal(dimension.band, expected.band);
    assert.equal(dimension.bandLabel, expected.bandLabel);
  }

  const allHrText = collectStrings(validatedHrReport).join(" ");
  assert.equal(
    /hire|no-hire|hiring score|fit score|preporucuje se zaposljavanje|preporučuje se zapošljavanje|dijagnoz|diagnos|clinical|klinick|kliničk|disorder|mental health|IQ|percentile|percentil|IPIP|SAFRAN/i.test(
      allHrText,
    ),
    false,
  );

  const mutatedScore = clone(hrMockResult.report);
  mutatedScore.motivation_profile_snapshot.dimensions[0].rawScore = 4.25;
  assert.throws(
    () => validateStructuredReport(mutatedScore, hrInput),
    /MWMS HR report validation.*rawScore/i,
  );

  const forbiddenReport = clone(hrMockResult.report);
  forbiddenReport.interpretation_note =
    "Ovaj tekst kaze da se preporucuje se zaposljavanje i zato mora pasti validaciju.";
  assert.throws(
    () => validateStructuredReport(forbiddenReport, hrInput),
    /MWMS HR report validation.*Forbidden phrase/i,
  );

  const participantMockResult = await mockReportProvider.generateReport(participantInput);
  assert.equal(participantMockResult.ok, true, participantMockResult.ok ? undefined : participantMockResult.reason);

  if (!participantMockResult.ok) {
    throw new Error("Expected MWMS participant mock generation to remain available.");
  }

  const validatedParticipantReport = validateStructuredReport(participantMockResult.report, participantInput);
  assert.equal(validatedParticipantReport.schema_version, "mwms_participant_report_v1");
  assert.equal(validatedParticipantReport.audience, "participant");
  assert.throws(
    () => validateStructuredReport(hrMockResult.report, participantInput),
    /MWMS participant report validation/i,
  );
  assert.throws(
    () => validateStructuredReport(participantMockResult.report, hrInput),
    /MWMS HR report validation/i,
  );

  assert.deepEqual(
    getReportGenerationCapability({
      testSlug: "mwms_v1",
      audience: "hr",
      reportType: "individual",
      sourceType: "single_test",
    }),
    { active: true, status: "active" },
  );

  console.log("MWMS HR report OpenAI provider tests passed. Real OpenAI call skipped: offline routing and validation test only.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
