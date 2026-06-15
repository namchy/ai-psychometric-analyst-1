const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(projectRoot, "scripts", "inspect-single-test-hr-ai-input.cjs");
const scriptSource = fs.readFileSync(scriptPath, "utf8");

assert.match(scriptSource, /CONFIRM_SINGLE_TEST_HR_INPUT_INSPECT/);
assert.match(scriptSource, /SINGLE_TEST_HR_FAMILY/);
assert.match(scriptSource, /SINGLE_TEST_HR_AI_REQUEST_DUMP_PATH/);
assert.match(scriptSource, /databaseWrites:\s*false/);
assert.match(scriptSource, /openAiCalled:\s*false/);
assert.match(scriptSource, /reportRegenerated:\s*false/);
assert.match(scriptSource, /productionFlowChanged:\s*false/);
assert.match(scriptSource, /reconstructedInputUsed:\s*false/);
assert.match(scriptSource, /buildCompletedAssessmentReportRequest/);
assert.match(scriptSource, /buildPreparedReportGenerationInput/);
assert.match(scriptSource, /buildOpenAiStructuredRequestPayload/);
assert.doesNotMatch(scriptSource, /\.(?:insert|update|upsert|delete)\(/);
assert.doesNotMatch(scriptSource, /fetch\(/);
assert.doesNotMatch(scriptSource, /generateCompletedAssessmentReport\(/);
assert.doesNotMatch(scriptSource, /generateOpenAiReport\(/);
assert.doesNotMatch(scriptSource, /processAssessmentReport/);
assert.doesNotMatch(scriptSource, /regenerateReadySingleTestHrReport\(/);

const {
  ATTEMPT_ID_ENV,
  CONFIRM_ENV,
  FAMILY_ENV,
  REPORT_ID_ENV,
  REQUEST_DUMP_PATH_ENV,
  buildSingleTestHrAiRequestObservabilityRecord,
  buildSingleTestHrAiInputArtifact,
  getPromptKeyForSingleTestHrJob,
  installTypeScriptRuntime,
  resolveRequestDumpPath,
  runSingleTestHrAiInputInspect,
} = require(scriptPath);

function buildIpipResults() {
  const {
    IPIP_NEO_120_DOMAIN_ORDER,
    IPIP_NEO_120_FACETS_BY_DOMAIN,
  } = require("../lib/assessment/ipip-neo-120-labels.ts");
  const dimensions = [];

  for (const [domainIndex, domainCode] of IPIP_NEO_120_DOMAIN_ORDER.entries()) {
    for (const [facetIndex, facetCode] of IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].entries()) {
      dimensions.push({
        dimension: facetCode,
        rawScore: 4.5 - domainIndex * 0.2 - facetIndex * 0.05,
        scoredQuestionCount: 4,
      });
    }
  }

  return {
    attemptId: "attempt-ipip-single-test-hr-input-capture",
    scoringMethod: "likert_mean",
    dimensions,
    scoredResponseCount: 120,
    unscoredResponses: [],
  };
}

function buildSafranResults() {
  return {
    attemptId: "attempt-single-test-hr-input-capture",
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

function buildMwmsResults() {
  return {
    attemptId: "attempt-mwms-single-test-hr-input-capture",
    scoringMethod: "likert_sum",
    dimensions: [
      { dimension: "amotivation", rawScore: 4, scoredQuestionCount: 3 },
      { dimension: "external_social", rawScore: 4.25, scoredQuestionCount: 3 },
      { dimension: "external_material", rawScore: 4.5, scoredQuestionCount: 3 },
      { dimension: "introjected", rawScore: 3.75, scoredQuestionCount: 4 },
      { dimension: "identified", rawScore: 4.75, scoredQuestionCount: 3 },
      { dimension: "intrinsic", rawScore: 5, scoredQuestionCount: 3 },
    ],
    scoredResponseCount: 19,
    unscoredResponses: [],
  };
}

function buildCompletedSafranHrRequest() {
  return {
    attemptId: "attempt-single-test-hr-input-capture",
    testId: "test-safran",
    testSlug: "safran_v1",
    audience: "hr",
    locale: "bs",
    scoringMethod: "correct_answers",
    promptVersion: "v1",
    testName: "SAFRAN",
    results: buildSafranResults(),
  };
}

async function main() {
  let contextReads = 0;
  let artifactBuilds = 0;
  let writes = 0;

  const noCallResult = await runSingleTestHrAiInputInspect({
    env: {},
    loadContext: async () => {
      contextReads += 1;
      throw new Error("default mode must not read DB context");
    },
    buildArtifact: async () => {
      artifactBuilds += 1;
      throw new Error("default mode must not build artifact");
    },
    writeFile: () => {
      writes += 1;
    },
  });

  assert.equal(noCallResult.confirmed, false);
  assert.equal(noCallResult.openAiCalled, false);
  assert.equal(noCallResult.databaseAccessed, false);
  assert.equal(noCallResult.databaseWrites, false);
  assert.equal(noCallResult.reportRegenerated, false);
  assert.equal(noCallResult.productionFlowChanged, false);
  assert.equal(noCallResult.artifactWritten, false);
  assert.equal(contextReads, 0);
  assert.equal(artifactBuilds, 0);
  assert.equal(writes, 0);

  await assert.rejects(
    () =>
      runSingleTestHrAiInputInspect({
        env: {
          NODE_ENV: "development",
          [CONFIRM_ENV]: "true",
        },
        dependencies: {},
      }),
    new RegExp(FAMILY_ENV),
  );

  await assert.rejects(
    () =>
      runSingleTestHrAiInputInspect({
        env: {
          NODE_ENV: "development",
          [CONFIRM_ENV]: "true",
          [FAMILY_ENV]: "safran",
        },
        dependencies: {},
      }),
    new RegExp(`${ATTEMPT_ID_ENV}|${REPORT_ID_ENV}`),
  );

  assert.equal(
    resolveRequestDumpPath({
      [REQUEST_DUMP_PATH_ENV]: "/tmp/single-test-hr-ai-request-test.json",
    }),
    "/tmp/single-test-hr-ai-request-test.json",
  );
  for (const invalidPath of [
    "./request-dump.json",
    "/etc/request-dump.json",
    "/tmp/request-dump.txt",
    "/tmpx/request-dump.json",
  ]) {
    assert.throws(() =>
      resolveRequestDumpPath({
        [REQUEST_DUMP_PATH_ENV]: invalidPath,
      }),
    );
  }

  assert.equal(getPromptKeyForSingleTestHrJob({ family: "safran" }), "safran_hr_report_v1");
  assert.equal(getPromptKeyForSingleTestHrJob({ family: "mwms" }), "mwms_hr_report_v1");
  assert.equal(getPromptKeyForSingleTestHrJob({ family: "ipip" }), "completed_assessment_report");

  installTypeScriptRuntime();
  const {
    buildPreparedReportGenerationInput,
  } = require("../lib/assessment/report-provider-helpers.ts");
  const {
    buildOpenAiStructuredRequestPayload,
  } = require("../lib/assessment/report-provider-openai.ts");
  const {
    buildAiReportDebugDumpRecord,
    sanitizeAiReportDebugValue,
  } = require("../lib/assessment/ai-report-debug-dump.ts");
  const {
    SAFRAN_HR_REPORT_V1_CONTRACT,
  } = require("../lib/assessment/safran-hr-report-v1.ts");

  const completedRequest = buildCompletedSafranHrRequest();
  const expectedPreparedInput = buildPreparedReportGenerationInput(completedRequest, {
    promptVersionId: null,
    promptTemplate: null,
  });
  const expectedPayload = buildOpenAiStructuredRequestPayload(expectedPreparedInput, {
    apiKey: null,
    model: "gpt-5.5",
    timeoutMs: 120000,
  });
  const context = {
    family: "safran",
    reportId: "report-single-test-hr-input-capture",
    reportStatus: "ready",
    attemptId: completedRequest.attemptId,
    testId: completedRequest.testId,
    testSlug: completedRequest.testSlug,
    locale: completedRequest.locale,
    reportType: "individual",
    audience: "hr",
    sourceType: "single_test",
    generatorType: "openai",
    persistedGeneratorType: "openai",
    persistedPromptVersionId: null,
    persistedModelName: null,
    persistedInputSnapshotPresent: false,
  };
  const dependencies = {
    buildAiReportDebugDumpRecord,
    buildCompletedAssessmentReportRequest: async (testId, attemptId, options) => {
      assert.equal(testId, completedRequest.testId);
      assert.equal(attemptId, completedRequest.attemptId);
      assert.deepEqual(options, {
        audience: "hr",
        locale: "bs",
        promptVersion: "v1",
      });
      return completedRequest;
    },
    buildPreparedReportGenerationInput,
    buildOpenAiStructuredRequestPayload,
    getActivePromptVersion: async (query, options) => {
      assert.equal(query.promptKey, "safran_hr_report_v1");
      assert.equal(query.reportType, "individual");
      assert.equal(query.audience, "hr");
      assert.equal(query.sourceType, "single_test");
      assert.equal(query.generatorType, "openai");
      assert.equal(options.locale, "bs");
      return null;
    },
    getActiveReportRuntimeConfig: async (query) => {
      assert.deepEqual(query, {
        reportType: "individual",
        audience: "hr",
        sourceType: "single_test",
        generatorType: "openai",
      });
      return {
        modelName: "gpt-5.5",
      };
    },
    getAiReportConfig: () => ({
      model: "fallback-model",
      promptVersion: "v1",
      openAiTimeoutMs: 120000,
    }),
    normalizeAiReportModel: (model) => model,
    sanitizeAiReportDebugValue,
  };

  const directArtifact = await buildSingleTestHrAiInputArtifact(context, dependencies, {
    timestamp: "2026-06-12T12:00:00.000Z",
  });

  assert.equal(directArtifact.metadata.reportFamily, "safran");
  assert.equal(directArtifact.metadata.reportType, "individual");
  assert.equal(directArtifact.metadata.audience, "hr");
  assert.equal(directArtifact.metadata.sourceType, "single_test");
  assert.equal(directArtifact.metadata.locale, "bs");
  assert.equal(directArtifact.metadata.model, "gpt-5.5");
  assert.equal(directArtifact.metadata.databaseWrites, false);
  assert.equal(directArtifact.metadata.openAiCalled, false);
  assert.equal(directArtifact.metadata.reportRegenerated, false);
  assert.equal(directArtifact.metadata.productionFlowChanged, false);
  assert.equal(directArtifact.metadata.reconstructedInputUsed, false);
  assert.equal(directArtifact.metadata.diagnosticInputSource, "production buildCompletedAssessmentReportRequest + buildPreparedReportGenerationInput");
  assert.deepEqual(directArtifact.promptInput, expectedPreparedInput.promptInput);
  assert.deepEqual(directArtifact.reportContract, {
    family: "safran",
    reportType: SAFRAN_HR_REPORT_V1_CONTRACT.reportType,
    sourceType: SAFRAN_HR_REPORT_V1_CONTRACT.sourceType,
    promptKey: SAFRAN_HR_REPORT_V1_CONTRACT.promptKey,
    schemaName: SAFRAN_HR_REPORT_V1_CONTRACT.schemaId,
    outputSchemaJson: SAFRAN_HR_REPORT_V1_CONTRACT.outputSchemaJson,
  });
  assert.equal(directArtifact.preparedOpenAiRequest.schemaName, expectedPayload.schemaName);
  assert.deepEqual(directArtifact.preparedOpenAiRequest.schema, expectedPayload.schema);
  assert.deepEqual(directArtifact.preparedOpenAiRequest.requestBody, expectedPayload.requestBody);
  assert.equal(
    Object.prototype.hasOwnProperty.call(directArtifact.preparedOpenAiRequest.requestBody, "temperature"),
    false,
  );
  assert.doesNotMatch(JSON.stringify(directArtifact), /test-api-key/);

  const familyFixtures = [
    {
      family: "ipip",
      request: {
        attemptId: "attempt-ipip-single-test-hr-input-capture",
        testId: "test-ipip",
        testSlug: "ipip-neo-120-v1",
        audience: "hr",
        locale: "bs",
        scoringMethod: "likert_mean",
        promptVersion: "v1",
        testName: "IPIP-NEO-120",
        results: buildIpipResults(),
      },
      promptKey: "ipip_neo_120_hr_v2",
    },
    {
      family: "safran",
      request: completedRequest,
      promptKey: "safran_hr_report_v1",
    },
    {
      family: "mwms",
      request: {
        attemptId: "attempt-mwms-single-test-hr-input-capture",
        testId: "test-mwms",
        testSlug: "mwms_v1",
        audience: "hr",
        locale: "bs",
        scoringMethod: "likert_sum",
        promptVersion: "v1",
        testName: "Procjena radne motivacije",
        results: buildMwmsResults(),
      },
      promptKey: "mwms_hr_report_v1",
    },
  ];

  for (const fixture of familyFixtures) {
    const preparedInput = buildPreparedReportGenerationInput(fixture.request, {
      promptVersionId: null,
      promptTemplate: null,
    });
    const payload = buildOpenAiStructuredRequestPayload(preparedInput, {
      apiKey: null,
      model: "gpt-5.5",
      timeoutMs: 120000,
    });
    const record = buildSingleTestHrAiRequestObservabilityRecord({
      preparedInput,
      openAiPayload: payload,
      locale: fixture.request.locale,
      timestamp: "2026-06-12T12:15:00.000Z",
      buildDebugRecord: buildAiReportDebugDumpRecord,
      sanitizeDebugValue: sanitizeAiReportDebugValue,
    });

    assert.equal(record.provider, "openai");
    assert.equal(record.model, "gpt-5.5");
    assert.equal(record.report_family, preparedInput.reportContract.family);
    assert.equal(record.report_type, preparedInput.reportContract.reportType);
    assert.equal(record.audience, "hr");
    assert.equal(record.locale, "bs");
    assert.equal(record.prompt_key, fixture.promptKey);
    assert.equal(record.prompt_version, "v1");
    assert.equal(record.report_schema_name, preparedInput.reportContract.schemaName);
    assert.deepEqual(record.authority_metadata, payload.authorityMetadata);
    assert.deepEqual(record.structured_output_schema, payload.schema);
    assert.deepEqual(record.request_body, payload.requestBody);
    assert.deepEqual(record.deterministic_prompt_input, preparedInput.promptInput);
    assert.deepEqual(record.report_contract, preparedInput.reportContract);
  }

  const sensitivePreparedInput = structuredClone(expectedPreparedInput);
  sensitivePreparedInput.promptInput.visibleValue = "sk-test-secret";
  const sensitivePayload = buildOpenAiStructuredRequestPayload(sensitivePreparedInput, {
    apiKey: null,
    model: "gpt-5.5",
    timeoutMs: 120000,
  });
  const sensitiveRecord = buildSingleTestHrAiRequestObservabilityRecord({
    preparedInput: sensitivePreparedInput,
    openAiPayload: sensitivePayload,
    locale: "bs",
    timestamp: "2026-06-12T12:20:00.000Z",
    redactValues: [
      "sk-test-secret",
      "cookie-test-secret",
      "service-role-test-secret",
      "token-test-secret",
    ],
    buildDebugRecord: buildAiReportDebugDumpRecord,
    sanitizeDebugValue: sanitizeAiReportDebugValue,
  });
  const sensitiveRecordText = JSON.stringify(sensitiveRecord);
  for (const forbiddenValue of [
    "apiKey",
    "authorization",
    "cookie",
    "service_role",
    "token",
    "secret",
    "password",
    "Bearer",
    "sk-test-secret",
    "cookie-test-secret",
    "service-role-test-secret",
    "token-test-secret",
  ]) {
    assert.equal(
      sensitiveRecordText.toLowerCase().includes(forbiddenValue.toLowerCase()),
      false,
      `Serialized observability dump must not contain ${forbiddenValue}.`,
    );
  }

  const writesList = [];
  const chmodCalls = [];
  const runArtifact = await runSingleTestHrAiInputInspect({
    env: {
      NODE_ENV: "development",
      [CONFIRM_ENV]: "true",
      [FAMILY_ENV]: "safran",
      [ATTEMPT_ID_ENV]: completedRequest.attemptId,
      [REQUEST_DUMP_PATH_ENV]: "/tmp/single-test-hr-ai-request-safran-test.json",
      OPENAI_API_KEY: "sk-test-secret",
      SESSION_COOKIE: "cookie-test-secret",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test-secret",
      INTERNAL_TOKEN: "token-test-secret",
      TEST_PASSWORD: "password-test-secret",
    },
    now: () => "2026-06-12T12:30:00.000Z",
    dependencies,
    loadContext: async (input) => {
      assert.deepEqual(input, {
        family: "safran",
        attemptId: completedRequest.attemptId,
        reportId: null,
      });
      return context;
    },
    writeFile: (filePath, data, options) => {
      writesList.push({ filePath, data, options });
    },
    chmodFile: (filePath, mode) => {
      chmodCalls.push({ filePath, mode });
    },
  });

  assert.match(runArtifact.dumpPath, /^\/tmp\/single-test-hr-ai-input-safran-/);
  assert.equal(
    runArtifact.requestDumpPath,
    "/tmp/single-test-hr-ai-request-safran-test.json",
  );
  assert.equal(runArtifact.metadata.openAiCalled, false);
  assert.equal(runArtifact.metadata.databaseWrites, false);
  assert.equal(runArtifact.metadata.reportRegenerated, false);
  assert.equal(runArtifact.metadata.productionFlowChanged, false);
  assert.equal(writesList.length, 2);
  assert.equal(writesList[0].filePath, runArtifact.dumpPath);
  assert.equal(writesList[0].options.mode, 0o600);
  assert.match(writesList[0].data, /"preparedOpenAiRequest"/);
  assert.match(writesList[0].data, /"promptInput"/);
  assert.doesNotMatch(writesList[0].data, /sk-test-secret/);
  assert.equal(writesList[1].filePath, runArtifact.requestDumpPath);
  assert.equal(writesList[1].options.mode, 0o600);
  assert.match(writesList[1].data, /"deterministic_prompt_input"/);
  assert.match(writesList[1].data, /"report_contract"/);
  assert.match(writesList[1].data, /"request_body"/);
  for (const forbiddenValue of [
    "apiKey",
    "authorization",
    "cookie",
    "service_role",
    "token",
    "secret",
    "password",
    "Bearer",
    "sk-test-secret",
    "cookie-test-secret",
    "service-role-test-secret",
    "token-test-secret",
  ]) {
    assert.equal(
      writesList[1].data.toLowerCase().includes(forbiddenValue.toLowerCase()),
      false,
      `Serialized request dump must not contain ${forbiddenValue}.`,
    );
  }
  assert.doesNotMatch(writesList[1].data, /response_headers/i);
  assert.doesNotMatch(writesList[1].data, /stack_trace|stackTrace/i);
  assert.deepEqual(chmodCalls, [
    {
      filePath: runArtifact.dumpPath,
      mode: 0o600,
    },
    {
      filePath: runArtifact.requestDumpPath,
      mode: 0o600,
    },
  ]);

  console.log("test-inspect-single-test-hr-ai-input: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
