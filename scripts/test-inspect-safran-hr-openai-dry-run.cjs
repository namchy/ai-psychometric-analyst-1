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
assert.match(scriptSource, /SAFRAN_HR_INPUT_CAPTURE_PATH/);
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
  CAPTURE_PATH_ENV,
  CONFIRM_ENV,
  INPUT_PATH_ENV,
  evaluateSafranHrDryRunDiagnostic,
  installTypeScriptRuntime,
  readInputCapture,
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

function buildSafranInputCaptureArtifact({ preparedInput, payload, timestamp = "2026-06-12T11:46:45.140Z" }) {
  return {
    metadata: {
      timestamp,
      reportFamily: "safran",
      testSlug: "safran_v1",
      reportType: "individual",
      audience: "hr",
      sourceType: "single_test",
      locale: "bs",
      attemptId: preparedInput.attemptId,
      reportId: "report-safran-hr-input-capture",
      provider: "openai",
      model: payload.requestBody.model,
      confirmed: true,
      databaseWrites: false,
      openAiCalled: false,
      reportRegenerated: false,
      productionFlowChanged: false,
      diagnosticInputSource:
        "production buildCompletedAssessmentReportRequest + buildPreparedReportGenerationInput",
      reconstructedInputUsed: false,
    },
    inputSummary: {
      attemptId: preparedInput.attemptId,
      reportId: "report-safran-hr-input-capture",
      testId: "test-safran",
      testSlug: "safran_v1",
    },
    promptInput: preparedInput.promptInput,
    reportContract: preparedInput.reportContract,
    preparedOpenAiRequest: {
      schemaName: payload.schemaName,
      schema: payload.schema,
      systemPrompt: payload.systemPrompt,
      userPrompt: payload.userPrompt,
      requestBody: payload.requestBody,
    },
  };
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

  const captureArtifact = buildSafranInputCaptureArtifact({
    preparedInput: productionPreparedInput,
    payload: productionPayload,
  });
  assert.equal(
    Object.prototype.hasOwnProperty.call(captureArtifact.preparedOpenAiRequest.requestBody, "temperature"),
    false,
  );

  const validCapture = readInputCapture("/tmp/single-test-hr-ai-input-safran-test.json", () =>
    JSON.stringify(captureArtifact),
  );
  assert.equal(validCapture.inputSource, "single_test_hr_ai_input_capture");
  assert.equal(validCapture.capturePath, "/tmp/single-test-hr-ai-input-safran-test.json");
  assert.equal(validCapture.captureMetadata.reconstructedInputUsed, false);
  assert.match(
    validCapture.captureMetadata.diagnosticInputSource,
    /buildCompletedAssessmentReportRequest.*buildPreparedReportGenerationInput/,
  );
  assert.deepEqual(validCapture.inputSnapshot, productionPreparedInput.promptInput);
  assert.deepEqual(
    validCapture.preparedOpenAiRequest.requestBody,
    captureArtifact.preparedOpenAiRequest.requestBody,
  );

  for (const [field, value] of [
    ["reportFamily", "mwms"],
    ["testSlug", "mwms_v1"],
    ["audience", "participant"],
    ["sourceType", "composite"],
  ]) {
    const invalidCapture = clone(captureArtifact);
    invalidCapture.metadata[field] = value;

    assert.throws(
      () => readInputCapture("/tmp/invalid-safran-capture.json", () => JSON.stringify(invalidCapture)),
      new RegExp(`metadata\\.${field}`),
    );
  }

  const reconstructedCapture = clone(captureArtifact);
  reconstructedCapture.metadata.reconstructedInputUsed = true;
  assert.throws(
    () => readInputCapture("/tmp/reconstructed-safran-capture.json", () => JSON.stringify(reconstructedCapture)),
    /SAFRAN input capture must not use reconstructed input\..*not acceptable audit evidence/i,
  );

  const missingReconstructedCapture = clone(captureArtifact);
  delete missingReconstructedCapture.metadata.reconstructedInputUsed;
  assert.throws(
    () =>
      readInputCapture("/tmp/missing-reconstructed-safran-capture.json", () =>
        JSON.stringify(missingReconstructedCapture),
      ),
    /SAFRAN input capture must not use reconstructed input\..*not acceptable audit evidence/i,
  );

  const invalidDiagnosticSourceCapture = clone(captureArtifact);
  invalidDiagnosticSourceCapture.metadata.diagnosticInputSource = "reconstructed fixture";
  assert.throws(
    () =>
      readInputCapture("/tmp/invalid-diagnostic-source-safran-capture.json", () =>
        JSON.stringify(invalidDiagnosticSourceCapture),
      ),
    /diagnosticInputSource must reference production-equivalent .*not acceptable audit evidence/i,
  );

  const missingDiagnosticSourceCapture = clone(captureArtifact);
  delete missingDiagnosticSourceCapture.metadata.diagnosticInputSource;
  assert.throws(
    () =>
      readInputCapture("/tmp/missing-diagnostic-source-safran-capture.json", () =>
        JSON.stringify(missingDiagnosticSourceCapture),
      ),
    /diagnosticInputSource must reference production-equivalent .*not acceptable audit evidence/i,
  );

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

  const captureWritesList = [];
  const captureChmodCalls = [];
  const captureArtifactResult = await runSafranHrOpenAiDryRun({
    env: {
      NODE_ENV: "development",
      [CONFIRM_ENV]: "true",
      [CAPTURE_PATH_ENV]: "/tmp/single-test-hr-ai-input-safran-test.json",
      AI_REPORT_PROVIDER: "openai",
      OPENAI_API_KEY: "test-key",
    },
    now: () => "2026-06-12T11:46:45.140Z",
    readFile: (filePath) => {
      assert.equal(filePath, "/tmp/single-test-hr-ai-input-safran-test.json");
      return JSON.stringify(captureArtifact);
    },
    writeFile: (filePath, data, options) => {
      captureWritesList.push({ filePath, data, options });
    },
    chmodFile: (filePath, mode) => {
      captureChmodCalls.push({ filePath, mode });
    },
    requestRawReport: async (input, options) => {
      openAiCalls += 1;
      assert.deepEqual(input, productionPreparedInput.promptInput);
      assert.equal(options.model, "gpt-5.5");
      assert.equal(
        Object.prototype.hasOwnProperty.call(captureArtifact.preparedOpenAiRequest.requestBody, "temperature"),
        false,
      );
      return validReport;
    },
    evaluateDiagnostic: (input, output) =>
      evaluateSafranHrDryRunDiagnostic(input, output, dependencies),
  });

  assert.equal(openAiCalls, 2);
  assert.equal(captureArtifactResult.metadata.inputSource, "single_test_hr_ai_input_capture");
  assert.equal(captureArtifactResult.inputSource, "single_test_hr_ai_input_capture");
  assert.equal(captureArtifactResult.metadata.capturePath, "/tmp/single-test-hr-ai-input-safran-test.json");
  assert.equal(captureArtifactResult.capturePath, "/tmp/single-test-hr-ai-input-safran-test.json");
  assert.equal(captureArtifactResult.metadata.inputSnapshotPath, null);
  assert.equal(captureArtifactResult.metadata.openAiCalled, true);
  assert.equal(captureArtifactResult.metadata.databaseWrites, false);
  assert.equal(captureArtifactResult.metadata.reportRegenerated, false);
  assert.equal(captureArtifactResult.metadata.productionFlowChanged, false);
  assert.equal(captureArtifactResult.captureMetadata.reconstructedInputUsed, false);
  assert.match(
    captureArtifactResult.captureMetadata.diagnosticInputSource,
    /buildCompletedAssessmentReportRequest.*buildPreparedReportGenerationInput/,
  );
  assert.equal(captureArtifactResult.captureMetadata.openAiCalled, false);
  assert.equal(captureArtifactResult.captureMetadata.databaseWrites, false);
  assert.equal(captureArtifactResult.captureMetadata.reportRegenerated, false);
  assert.equal(captureArtifactResult.captureMetadata.productionFlowChanged, false);
  assert.deepEqual(captureArtifactResult.parseResult, { ok: true, error: null });
  assert.equal(captureArtifactResult.safranValidatorResult.ok, true);
  assert.equal(captureArtifactResult.hardGateWouldPersist, true);
  assert.equal(captureArtifactResult.validatorOnWouldPersist, true);
  assert.deepEqual(captureArtifactResult.phraseGateFailures, []);
  assert.deepEqual(captureArtifactResult.failureReasons, []);
  assert.equal(captureWritesList.length, 1);
  assert.equal(captureWritesList[0].filePath, captureArtifactResult.dumpPath);
  assert.equal(captureWritesList[0].options.mode, 0o600);
  assert.match(captureWritesList[0].data, /"inputSource": "single_test_hr_ai_input_capture"/);
  assert.match(captureWritesList[0].data, /"capturePath": "\/tmp\/single-test-hr-ai-input-safran-test\.json"/);
  assert.match(captureWritesList[0].data, /"captureMetadata"/);
  assert.match(captureWritesList[0].data, /"reconstructedInputUsed": false/);
  assert.match(captureWritesList[0].data, /"rawParsedOutput"/);
  assert.doesNotMatch(captureWritesList[0].data, /test-key/);
  assert.deepEqual(captureChmodCalls, [
    {
      filePath: captureArtifactResult.dumpPath,
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
