const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(
  projectRoot,
  "scripts",
  "inspect-amra-replay-ipip-participant-openai-request.cjs",
);
const source = fs.readFileSync(scriptPath, "utf8");

assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /\.(?:insert|update|upsert|delete)\(/);
assert.doesNotMatch(source, /processClaimedReportJob|generateCompletedAssessmentReport/);
assert.match(source, /buildOpenAiStructuredRequestPayload/);
assert.match(source, /participantDataOnlyQa:\s*true/);

const {
  ASSIGNMENT_ID_ENV,
  ATTEMPT_ID_ENV,
  CONFIRM_ENV,
  DATA_ONLY_QA_ENV,
  DUMP_PATH_ENV,
  PARTICIPANT_ID_ENV,
  TARGET,
  buildMetrics,
  runInspector,
  validateEnv,
} = require(scriptPath);

function confirmedEnv(extra = {}) {
  return {
    NODE_ENV: "development",
    [CONFIRM_ENV]: "true",
    [DATA_ONLY_QA_ENV]: "true",
    [PARTICIPANT_ID_ENV]: TARGET.participantId,
    [ASSIGNMENT_ID_ENV]: TARGET.assignmentId,
    [ATTEMPT_ID_ENV]: TARGET.attemptId,
    ...extra,
  };
}

function createQuery(result) {
  return {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    async maybeSingle() {
      return { data: result, error: null };
    },
  };
}

function createDeps(overrides = {}) {
  const participant = {
    id: TARGET.participantId,
    organization_id: TARGET.organizationId,
    email: TARGET.participantEmail,
  };
  const assignment = {
    id: TARGET.assignmentId,
    organization_id: TARGET.organizationId,
    participant_id: TARGET.participantId,
    assignment_type: "standard_battery",
    status: "completed",
    locale: "bs",
    metadata: { fixture: TARGET.fixture },
  };
  const link = {
    assessment_assignment_id: TARGET.assignmentId,
    attempt_id: TARGET.attemptId,
    test_slug: TARGET.testSlug,
    attempts: {
      id: TARGET.attemptId,
      test_id: "test-ipip-id",
      organization_id: TARGET.organizationId,
      participant_id: TARGET.participantId,
      status: "completed",
      locale: "bs",
    },
    tests: { slug: TARGET.testSlug },
  };
  const promptInput = {
    attempt_id: TARGET.attemptId,
    test_id: "test-ipip-id",
    test_slug: TARGET.testSlug,
    audience: "participant",
    locale: "bs",
  };
  const deterministicInput = {
    contract_version: "ipip_neo_120_participant_v2_input",
    locale: "bs",
    domains: [],
  };
  const requestBody = {
    model: TARGET.model,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ipip_neo_120_participant_v2",
        strict: true,
        schema: { type: "object" },
      },
    },
    messages: [
      { role: "system", content: "system prompt" },
      { role: "user", content: "user prompt" },
    ],
  };

  return {
    createSupabaseAdminClient() {
      return {
        from(table) {
          if (table === "participants") return createQuery(overrides.participant ?? participant);
          if (table === "assessment_assignments") return createQuery(overrides.assignment ?? assignment);
          if (table === "assessment_assignment_attempts") return createQuery(overrides.link ?? link);
          throw new Error(`Unexpected table ${table}`);
        },
      };
    },
    resolveReportLocale() {
      return "bs";
    },
    getAiReportConfig() {
      return {
        model: TARGET.model,
        promptVersion: "v1",
        openAiTimeoutMs: 900000,
        fallbackToMock: false,
      };
    },
    async getActiveReportRuntimeConfig() {
      return {
        id: "runtime-id",
        modelName: TARGET.model,
        reasoningEffort: "medium",
      };
    },
    async getActivePromptVersion() {
      return {
        id: "prompt-id",
        version: "participant-v2",
      };
    },
    normalizeAiReportModel(model) {
      return model;
    },
    async buildCompletedAssessmentReportRequest() {
      return {
        attemptId: TARGET.attemptId,
        testId: "test-ipip-id",
        testSlug: TARGET.testSlug,
        audience: "participant",
        locale: "bs",
        promptVersion: "participant-v2",
      };
    },
    buildPreparedReportGenerationInput(_request, options) {
      assert.equal(options.participantDataOnlyQa, true);
      return {
        attemptId: TARGET.attemptId,
        testSlug: TARGET.testSlug,
        participantDataOnlyQa: true,
        promptVersion: "participant-v2",
        promptVersionId: "prompt-id",
        promptTemplate: null,
        promptInput,
        reportContract: {
          family: "big_five",
          reportType: TARGET.reportType,
          sourceType: TARGET.sourceType,
          promptKey: "ipip_neo_120_participant_v1",
          schemaName: "ipip-neo-120-participant-v1",
          outputSchemaJson: { type: "object" },
        },
      };
    },
    resolveIpipNeo120ParticipantProviderMode() {
      return "v2-single";
    },
    prepareIpipNeo120ParticipantAiInputV2ForOpenAi() {
      return deterministicInput;
    },
    buildOpenAiStructuredRequestPayload() {
      return {
        schemaName: "ipip_neo_120_participant_v2",
        schema: requestBody.response_format.json_schema.schema,
        systemPrompt: requestBody.messages[0].content,
        userPrompt: requestBody.messages[1].content,
        requestBody,
      };
    },
  };
}

async function main() {
  const missing = validateEnv({});
  assert.equal(missing.ok, false);
  assert(missing.missing.includes(CONFIRM_ENV));
  assert(missing.missing.includes(DATA_ONLY_QA_ENV));

  const wrongParticipant = validateEnv(
    confirmedEnv({ [PARTICIPANT_ID_ENV]: "wrong-participant" }),
  );
  assert.equal(wrongParticipant.ok, false);
  assert.equal(wrongParticipant.mismatches[0].env, PARTICIPANT_ID_ENV);

  const wrongAssignment = validateEnv(
    confirmedEnv({ [ASSIGNMENT_ID_ENV]: "wrong-assignment" }),
  );
  assert.equal(wrongAssignment.ok, false);
  assert.equal(wrongAssignment.mismatches[0].env, ASSIGNMENT_ID_ENV);

  const wrongAttempt = validateEnv(
    confirmedEnv({ [ATTEMPT_ID_ENV]: "wrong-attempt" }),
  );
  assert.equal(wrongAttempt.ok, false);
  assert.equal(wrongAttempt.mismatches[0].env, ATTEMPT_ID_ENV);

  const blocked = await runInspector({ env: {} });
  assert.equal(blocked.status, "blocked_confirmation");
  assert.equal(blocked.openAiCalled, false);
  assert.equal(blocked.databaseWrites, false);

  const artifact = await runInspector({
    env: confirmedEnv(),
    deps: createDeps(),
    generatedAt: "2026-06-22T12:00:00.000Z",
  });

  assert.equal(artifact.providerMode, "v2-single");
  assert.equal(artifact.runtime.model, TARGET.model);
  assert.equal(artifact.runtime.reasoning_effort, "medium");
  assert.equal(artifact.runtime.timeoutMs, 900000);
  assert.equal(artifact.metadata.openAiCalled, false);
  assert.equal(artifact.metadata.databaseWrites, false);
  assert.equal(artifact.metadata.participantDataOnlyQa, true);
  assert.equal(artifact.metadata.proseSafetyBhsValidatorsDiagnosticOnly, true);
  assert.equal(artifact.metadata.aiProseMutated, false);
  assert.equal(artifact.metrics.dataOnlyQaModeActive, true);

  for (const field of [
    "providerMode",
    "model",
    "reasoning_effort",
    "timeoutMs",
    "promptVersion",
    "promptVersionId",
    "schemaName",
    "systemMessageCharCount",
    "userMessageCharCount",
    "combinedMessagesCharCount",
    "requestBodyCharCount",
    "requestBodyByteCount",
    "jsonSchemaCharCount",
    "deterministicInputCharCount",
    "inputSnapshotCharCount",
    "approximateTokenEstimate",
    "messageCount",
    "topLevelRequestBodyKeys",
    "responseFormatJsonSchemaName",
  ]) {
    assert(Object.prototype.hasOwnProperty.call(artifact.metrics, field), `Missing metric ${field}`);
  }

  const writes = [];
  const chmods = [];
  const dumped = await runInspector({
    env: confirmedEnv({ [DUMP_PATH_ENV]: "/tmp/ipip-capture-test.json" }),
    deps: createDeps(),
    writeFile(filePath, data, options) {
      writes.push({ filePath, data, options });
    },
    chmodFile(filePath, mode) {
      chmods.push({ filePath, mode });
    },
  });
  assert.equal(dumped.dumpPath, "/tmp/ipip-capture-test.json");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].options.mode, 0o600);
  assert.deepEqual(chmods, [{ filePath: "/tmp/ipip-capture-test.json", mode: 0o600 }]);
  assert.match(writes[0].data, /"preparedOpenAiRequest"/);
  assert.match(writes[0].data, /"deterministicInputSnapshot"/);

  assert.throws(
    () =>
      buildMetrics({
        requestBody: null,
        schema: {},
        systemPrompt: "",
        userPrompt: "",
        deterministicInput: {},
        inputSnapshot: null,
      }),
    TypeError,
  );

  const wrongOwnershipDeps = createDeps({
    assignment: {
      id: TARGET.assignmentId,
      organization_id: TARGET.organizationId,
      participant_id: TARGET.participantId,
      assignment_type: "standard_battery",
      status: "completed",
      locale: "bs",
      metadata: { fixture: "not-replay" },
    },
  });
  await assert.rejects(
    () => runInspector({ env: confirmedEnv(), deps: wrongOwnershipDeps }),
    /fixture ownership guard failed/,
  );

  console.log("test-inspect-amra-replay-ipip-participant-openai-request: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
