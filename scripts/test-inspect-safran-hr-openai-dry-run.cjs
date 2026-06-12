const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(projectRoot, "scripts", "inspect-safran-hr-openai-dry-run.cjs");
const providerPath = path.join(projectRoot, "lib", "assessment", "report-provider-openai.ts");
const scriptSource = fs.readFileSync(scriptPath, "utf8");
const providerSource = fs.readFileSync(providerPath, "utf8");

assert.match(scriptSource, /CONFIRM_SAFRAN_HR_OPENAI_DRY_RUN/);
assert.match(scriptSource, /SAFRAN_HR_INPUT_SNAPSHOT_PATH/);
assert.match(scriptSource, /databaseWrites:\s*false/);
assert.match(scriptSource, /reportRegenerated:\s*false/);
assert.match(scriptSource, /productionFlowChanged:\s*false/);
assert.match(scriptSource, /artifactWritten:\s*false/);
assert.match(scriptSource, /mode:\s*0o600/);
assert.doesNotMatch(scriptSource, /createSupabaseAdminClient/);
assert.doesNotMatch(scriptSource, /\.(?:insert|update|upsert|delete)\(/);
assert.doesNotMatch(scriptSource, /processAssessmentReport/);
assert.doesNotMatch(scriptSource, /regenerateSafranHrReport/);
assert.match(providerSource, /export async function requestOpenAiSafranHrReportRaw/);
assert.match(providerSource, /validateStructuredReport/);

const {
  CONFIRM_ENV,
  INPUT_PATH_ENV,
  evaluateSafranHrDryRunDiagnostic,
  installTypeScriptRuntime,
  runSafranHrOpenAiDryRun,
} = require(scriptPath);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildSafranHrInputSnapshotFixture() {
  return {
    test: {
      slug: "safran_v1",
      audience: "hr",
      reportType: "individual",
      sourceType: "single_test",
      locale: "bs",
    },
    scores: {
      overall: {
        rawScore: 26,
        maxScore: 54,
        scoreLabel: "26/54",
        band: "moderate",
        bandLabel: "Umjeren signal",
      },
      verbal: {
        rawScore: 12,
        maxScore: 18,
        scoreLabel: "12/18",
        band: "moderate",
        bandLabel: "Umjeren signal",
      },
      figural: {
        rawScore: 9,
        maxScore: 18,
        scoreLabel: "9/18",
        band: "moderate",
        bandLabel: "Umjeren signal",
      },
      numeric: {
        rawScore: 5,
        maxScore: 18,
        scoreLabel: "5/18",
        band: "lower",
        bandLabel: "Nizi signal",
      },
    },
    interpretationBoundaries: {
      noIq: true,
      noPercentiles: true,
      noNorms: true,
      noHireNoHire: true,
      noScoreRecalculation: true,
      noScoreMutation: true,
    },
    reportRules: {
      useHrPerspective: true,
      generateInterviewQuestions: true,
      generatePointsOfCaution: true,
      generateOnboardingGuidance: true,
      avoidDiagnosticLanguage: true,
      keepSignalsAsHypotheses: true,
    },
  };
}

function buildSafranResults() {
  return {
    attemptId: "attempt-safran-hr-inspector-parity",
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

function buildProductionPreparedSafranHrInput() {
  const {
    buildPreparedReportGenerationInput,
  } = require("../lib/assessment/report-provider-helpers.ts");

  return buildPreparedReportGenerationInput(
    {
      attemptId: "attempt-safran-hr-inspector-parity",
      testId: "test-safran",
      testSlug: "safran_v1",
      audience: "hr",
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

async function main() {
  let reads = 0;
  let writes = 0;
  let openAiCalls = 0;
  const noCallResult = await runSafranHrOpenAiDryRun({
    env: {},
    readFile: () => {
      reads += 1;
      return "{}";
    },
    writeFile: () => {
      writes += 1;
    },
    requestRawReport: async () => {
      openAiCalls += 1;
      return {};
    },
  });

  assert.equal(noCallResult.confirmed, false);
  assert.equal(noCallResult.openAiCalled, false);
  assert.equal(noCallResult.databaseAccessed, false);
  assert.equal(noCallResult.databaseWrites, false);
  assert.equal(noCallResult.artifactWritten, false);
  assert.equal(reads, 0);
  assert.equal(writes, 0);
  assert.equal(openAiCalls, 0);

  await assert.rejects(
    () =>
      runSafranHrOpenAiDryRun({
        env: {
          NODE_ENV: "development",
          [CONFIRM_ENV]: "true",
          AI_REPORT_MODEL: "gpt-5.5",
          OPENAI_API_KEY: "test-key",
        },
        argv: [],
        requestRawReport: async () => {
          throw new Error("should not call without input path");
        },
      }),
    new RegExp(INPUT_PATH_ENV),
  );

  installTypeScriptRuntime();
  const {
    buildOpenAiStructuredRequestPayload,
    buildSafranHrPreparedOpenAiInput,
  } = require("../lib/assessment/report-provider-openai.ts");
  const {
    SAFRAN_HR_REPORT_V1_CONTRACT,
    buildMockSafranHrReportV1,
    safranHrReportV1OpenAiSchema,
    validateSafranHrReport,
  } = require("../lib/assessment/safran-hr-report-v1.ts");
  const {
    resolveAiReportLanguagePolicy,
  } = require("../lib/assessment/ai-report-language-policy.ts");

  const inputSnapshot = buildSafranHrInputSnapshotFixture();
  const validReport = buildMockSafranHrReportV1(inputSnapshot);
  validReport.interpretationLimits = [
    "SAFRAN rezultat treba čitati samo u okviru ovog seta zadataka i čitati zajedno sa iskustvom, intervjuom i kontekstom uloge.",
    "Izvještaj nije odluka o zapošljavanju i ne treba ga koristiti za rangiranje osobe u odnosu na druge.",
    "Nalaze ne treba koristiti za rangiranje osobe u odnosu na druge.",
    "Nalaz ne treba čitati kao poređenje sa širom populacijom; čitajte kao signal iz ove procjene.",
    "Kognitivni signal je hipoteza za provjeru, ne konačan zaključak.",
  ];

  const productionPreparedInput = buildProductionPreparedSafranHrInput();
  const diagnosticPreparedInput = buildSafranHrPreparedOpenAiInput(
    productionPreparedInput.promptInput,
  );
  const productionPayload = buildOpenAiStructuredRequestPayload(productionPreparedInput, {
    apiKey: "test-key",
    model: "gpt-5.5",
    timeoutMs: 120000,
  });
  const diagnosticPayload = buildOpenAiStructuredRequestPayload(diagnosticPreparedInput, {
    apiKey: "test-key",
    model: "gpt-5.5",
    timeoutMs: 120000,
  });

  assert.equal(diagnosticPreparedInput.requestedLocale, productionPreparedInput.requestedLocale);
  assert.equal(diagnosticPreparedInput.promptVersion, productionPreparedInput.promptVersion);
  assert.equal(diagnosticPreparedInput.promptVersionId, null);
  assert.equal(diagnosticPreparedInput.promptTemplate, null);
  assert.deepEqual(diagnosticPreparedInput.promptInput, productionPreparedInput.promptInput);
  assert.deepEqual(diagnosticPreparedInput.reportContract, productionPreparedInput.reportContract);
  assert.deepEqual(diagnosticPreparedInput.reportContract, {
    family: "safran",
    reportType: SAFRAN_HR_REPORT_V1_CONTRACT.reportType,
    sourceType: SAFRAN_HR_REPORT_V1_CONTRACT.sourceType,
    promptKey: SAFRAN_HR_REPORT_V1_CONTRACT.promptKey,
    schemaName: SAFRAN_HR_REPORT_V1_CONTRACT.schemaId,
    outputSchemaJson: SAFRAN_HR_REPORT_V1_CONTRACT.outputSchemaJson,
  });
  assert.equal(diagnosticPayload.schemaName, productionPayload.schemaName);
  assert.deepEqual(diagnosticPayload.schema, safranHrReportV1OpenAiSchema);
  assert.deepEqual(diagnosticPayload.requestBody, productionPayload.requestBody);
  assert.doesNotMatch(JSON.stringify(diagnosticPayload.requestBody), /dry-run/);
  assert.doesNotMatch(JSON.stringify(diagnosticPayload.requestBody), /safran-hr-openai-dry-run/);

  const preparedInput = buildSafranHrPreparedOpenAiInput(inputSnapshot);
  const gpt55Payload = buildOpenAiStructuredRequestPayload(preparedInput, {
    apiKey: "test-key",
    model: "gpt-5.5",
    timeoutMs: 120000,
  });
  const gpt41Payload = buildOpenAiStructuredRequestPayload(preparedInput, {
    apiKey: "test-key",
    model: "gpt-4.1",
    timeoutMs: 120000,
  });

  assert.equal(gpt55Payload.requestBody.model, "gpt-5.5");
  assert.equal(Object.prototype.hasOwnProperty.call(gpt55Payload.requestBody, "temperature"), false);
  assert.equal(gpt41Payload.requestBody.temperature, 0.2);

  const dependencies = {
    resolveAiReportLanguagePolicy,
    validateSafranHrReport,
  };
  const writesList = [];
  const chmodCalls = [];
  const artifact = await runSafranHrOpenAiDryRun({
    env: {
      NODE_ENV: "development",
      [CONFIRM_ENV]: "true",
      [INPUT_PATH_ENV]: "/tmp/safran-hr-input-test.json",
      AI_REPORT_MODEL: "gpt-5.5",
      AI_REPORT_PROVIDER: "openai",
      OPENAI_API_KEY: "test-key",
    },
    now: () => "2026-06-12T11:00:00.000Z",
    readFile: (filePath) => {
      assert.equal(filePath, "/tmp/safran-hr-input-test.json");
      return JSON.stringify(inputSnapshot);
    },
    writeFile: (filePath, data, options) => {
      writesList.push({ filePath, data, options });
    },
    chmodFile: (filePath, mode) => {
      chmodCalls.push({ filePath, mode });
    },
    requestRawReport: async (input, options) => {
      openAiCalls += 1;
      assert.deepEqual(input, inputSnapshot);
      assert.equal(options.model, "gpt-5.5");
      return validReport;
    },
    evaluateDiagnostic: (input, output) =>
      evaluateSafranHrDryRunDiagnostic(input, output, dependencies),
  });

  assert.equal(openAiCalls, 1);
  assert.equal(artifact.metadata.confirmed, true);
  assert.equal(artifact.metadata.openAiCalled, true);
  assert.equal(artifact.metadata.databaseWrites, false);
  assert.equal(artifact.metadata.reportRegenerated, false);
  assert.equal(artifact.metadata.productionFlowChanged, false);
  assert.equal(artifact.inputSummary.testSlug, "safran_v1");
  assert.equal(artifact.inputSummary.locale, "bs");
  assert.deepEqual(artifact.parseResult, { ok: true, error: null });
  assert.equal(artifact.bhsLanguagePolicyResult.ok, true);
  assert.equal(artifact.safranValidatorResult.ok, true);
  assert.equal(artifact.hardGateWouldPersist, true);
  assert.equal(artifact.validatorOnWouldPersist, true);
  assert.deepEqual(artifact.phraseGateFailures, []);
  assert.deepEqual(artifact.failureReasons, []);
  assert.match(artifact.dumpPath, /^\/tmp\/safran-hr-openai-dry-run-/);
  assert.equal(writesList.length, 1);
  assert.equal(writesList[0].filePath, artifact.dumpPath);
  assert.equal(writesList[0].options.mode, 0o600);
  assert.match(writesList[0].data, /"rawParsedOutput"/);
  assert.match(writesList[0].data, /"bhsLanguagePolicyResult"/);
  assert.match(writesList[0].data, /"safranValidatorResult"/);
  assert.match(writesList[0].data, /"hardGateWouldPersist": true/);
  assert.match(writesList[0].data, /"validatorOnWouldPersist": true/);
  assert.doesNotMatch(writesList[0].data, /test-key/);
  assert.deepEqual(chmodCalls, [
    {
      filePath: artifact.dumpPath,
      mode: 0o600,
    },
  ]);

  const phraseOnlyReport = clone(validReport);
  phraseOnlyReport.executiveSummary.summary =
    "Profil pokazuje jače verbalne i figuralne signale, uz slabiji numerički signal. HR može povezati nalaz sa intervjuom, iskustvom i zahtjevima uloge.";
  const phraseDiagnostic = evaluateSafranHrDryRunDiagnostic(
    inputSnapshot,
    phraseOnlyReport,
    dependencies,
  );

  assert.equal(phraseDiagnostic.bhsLanguagePolicyResult.ok, true);
  assert.equal(phraseDiagnostic.safranValidatorResult.ok, false);
  assert.equal(phraseDiagnostic.hardGateWouldPersist, true);
  assert.equal(phraseDiagnostic.validatorOnWouldPersist, false);
  assert.equal(phraseDiagnostic.phraseGateFailures.length, 1);
  assert.equal(phraseDiagnostic.phraseGateFailures[0].category, "phrase_prose");
  assert.match(phraseDiagnostic.failureReasons.join(" "), /phrase\/prose gate only/);

  const safetyReport = clone(validReport);
  safetyReport.executiveSummary.summary =
    "Ovaj rezultat treba čitati kao opreznu HR hipotezu, ne kao konačan sud o osobi. IQ i percentil pokazuju da je ovo idealni kandidat.";
  const safetyDiagnostic = evaluateSafranHrDryRunDiagnostic(
    inputSnapshot,
    safetyReport,
    dependencies,
  );

  assert.equal(safetyDiagnostic.safranValidatorResult.ok, false);
  assert.equal(safetyDiagnostic.hardGateWouldPersist, false);
  assert.equal(
    safetyDiagnostic.safranValidatorResult.errors.some((error) => error.category === "safety"),
    true,
  );

  console.log("test-inspect-safran-hr-openai-dry-run: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
