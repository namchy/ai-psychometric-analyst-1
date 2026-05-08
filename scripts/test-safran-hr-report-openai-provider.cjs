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
  buildPreparedReportGenerationInput,
} = require("../lib/assessment/report-provider-helpers.ts");
const {
  buildDefaultUserPrompt,
  resolveOpenAiResponseFormatSchemaForInput,
  validateStructuredReport,
} = require("../lib/assessment/report-provider-openai.ts");
const {
  buildMockSafranHrReportV1,
  safranHrReportV1OpenAiSchema,
} = require("../lib/assessment/safran-hr-report-v1.ts");
const {
  buildMockSafranParticipantAiReport,
  safranParticipantAiReportV1OpenAiSchema,
} = require("../lib/assessment/safran-participant-ai-report-v1.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildSafranResults() {
  return {
    attemptId: "attempt-safran-hr-openai-provider",
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

function buildPreparedInput(audience) {
  return buildPreparedReportGenerationInput(
    {
      attemptId: `attempt-safran-${audience}-openai-provider`,
      testId: "test-safran",
      testSlug: "safran_v1",
      audience,
      locale: "bs",
      scoringMethod: "correct_answers",
      promptVersion: "v1",
      testName: "SAFRAN",
      results: buildSafranResults(),
    },
    {
      promptVersionId: null,
      promptTemplate: null,
    },
  );
}

function main() {
  const hrInput = buildPreparedInput("hr");
  const participantInput = buildPreparedInput("participant");
  const hrPromptInputBefore = clone(hrInput.promptInput);

  const hrSchema = resolveOpenAiResponseFormatSchemaForInput(hrInput);
  const participantSchema = resolveOpenAiResponseFormatSchemaForInput(participantInput);

  assert.deepEqual(hrSchema, safranHrReportV1OpenAiSchema);
  assert.deepEqual(participantSchema, safranParticipantAiReportV1OpenAiSchema);
  assert.notDeepEqual(hrSchema, participantSchema);

  const hrPrompt = JSON.parse(buildDefaultUserPrompt(hrInput));
  assert.equal(hrPrompt.input.test.audience, "hr");
  assert.equal(hrPrompt.input.test.sourceType, "single_test");
  assert.equal(hrPrompt.input.test.slug, "safran_v1");
  assert.equal(hrPrompt.input.scores.overall.rawScore, 26);
  assert.equal(hrPrompt.input.scores.verbal.rawScore, 12);
  assert.match(hrPrompt.instructions.output_contract, /safran_hr_report_v1/);
  assert.match(hrPrompt.instructions.decision_support_rule, /decision-support/i);
  assert.match(hrPrompt.instructions.source_rule, /Do not calculate scores/i);
  assert.match(
    hrPrompt.instructions.interpretation_rule,
    /moze ukazivati|korisno je provjeriti|u ovom setu zadataka/i,
  );
  assert.equal(
    hrPrompt.instructions.hard_guardrails.some((item) => /participant/i.test(item)),
    false,
  );

  const participantPrompt = JSON.parse(buildDefaultUserPrompt(participantInput));
  assert.equal(participantPrompt.input.test.audience, "participant");
  assert.match(participantPrompt.instructions.output_contract, /safran_participant_ai_report_v1/);
  assert.doesNotMatch(participantPrompt.instructions.output_contract, /safran_hr_report_v1/);

  const validHrReport = buildMockSafranHrReportV1(hrInput.promptInput);
  const validatedHrReport = validateStructuredReport(validHrReport, hrInput);
  assert.equal(validatedHrReport.reportType, "safran_hr_report_v1");
  assert.equal(validatedHrReport.audience, "hr");
  assert.equal(validatedHrReport.sourceType, "single_test");
  assert.equal(validatedHrReport.testSlug, "safran_v1");
  assert.deepEqual(hrInput.promptInput, hrPromptInputBefore);

  const allHrText = [
    validatedHrReport.executiveSummary.title,
    validatedHrReport.executiveSummary.summary,
    ...Object.values(validatedHrReport.cognitiveSignals),
    ...validatedHrReport.pointsOfCaution.flatMap((item) => [
      item.signal,
      item.whyItMatters,
      item.howToCheck,
    ]),
    ...validatedHrReport.interviewQuestions.flatMap((item) => [
      item.category,
      item.question,
      item.whatToListenFor,
    ]),
    ...validatedHrReport.onboardingGuidance.first30Days,
    ...validatedHrReport.onboardingGuidance.days60,
    ...validatedHrReport.onboardingGuidance.days90,
    ...validatedHrReport.interpretationLimits,
  ].join(" ");
  assert.equal(
    /iq|kvocijent inteligencije|inteligentan|neinteligentan|nadaren|iznadprosječan|ispodprosječan|percentile|percentil|norma|normativno|preporučuje se zapošljavanje|ne preporučuje se zapošljavanje|hiring score|idealni kandidat|loš fit|red flag|rizičan kandidat/i.test(
      allHrText,
    ),
    false,
  );

  const invalidHrReport = clone(validHrReport);
  invalidHrReport.executiveSummary.summary =
    "IQ i percentil ukazuju da je ovo idealni kandidat i preporučuje se zapošljavanje.";
  assert.throws(
    () => validateStructuredReport(invalidHrReport, hrInput),
    /SAFRAN HR report validation/i,
  );

  const participantReport = buildMockSafranParticipantAiReport(participantInput.promptInput);
  const validatedParticipantReport = validateStructuredReport(participantReport, participantInput);
  assert.equal(validatedParticipantReport.reportType, "safran_participant_ai_report_v1");
  assert.equal(validatedParticipantReport.audience, "participant");

  assert.throws(
    () => validateStructuredReport(validHrReport, participantInput),
    /SAFRAN participant report validation/i,
  );
  assert.throws(
    () => validateStructuredReport(participantReport, hrInput),
    /SAFRAN HR report validation/i,
  );

  console.log("SAFRAN HR report OpenAI provider tests passed.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
