const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(
  projectRoot,
  "scripts",
  "probe-amra-replay-ipip-participant-openai-direct.cjs",
);
const source = fs.readFileSync(scriptPath, "utf8");

assert.match(source, /https:\/\/api\.openai\.com\/v1\/chat\/completions/);
assert.doesNotMatch(source, /\.(?:insert|update|upsert|delete)\(/);
assert.doesNotMatch(source, /processClaimedReportJob|generateCompletedAssessmentReport|createSupabaseAdminClient/);
assert.doesNotMatch(source, /fallbackToMock/);

const {
  CAPTURE_PATH_ENV,
  CONFIRM_ENV,
  TARGET,
  TIMEOUT_ENV,
  assertCaptureArtifact,
  classifyProbeFailure,
  callOpenAiDirect,
  loadOpenAiTransportHelpers,
  runProbe,
  validateEnv,
} = require(scriptPath);

function confirmedEnv(extra = {}) {
  return {
    NODE_ENV: "development",
    OPENAI_API_KEY: "test-openai-key",
    [CONFIRM_ENV]: "true",
    [CAPTURE_PATH_ENV]: "/tmp/amra-replay-ipip-participant-v2-single-request.json",
    ...extra,
  };
}

function createCaptureArtifact(overrides = {}) {
  return {
    metadata: {
      participantDataOnlyQa: true,
      aiProseMutated: false,
    },
    target: {
      participantId: TARGET.participantId,
      assignmentId: TARGET.assignmentId,
      attemptId: TARGET.attemptId,
      testSlug: TARGET.testSlug,
      fixture: TARGET.fixture,
      reportType: TARGET.reportType,
      audience: TARGET.audience,
      sourceType: TARGET.sourceType,
      ...(overrides.target ?? {}),
    },
    providerMode: overrides.providerMode ?? TARGET.providerMode,
    runtime: {
      provider: TARGET.provider,
      model: TARGET.model,
      timeoutMs: 900000,
      ...(overrides.runtime ?? {}),
    },
    preparedOpenAiRequest: {
      schemaName: overrides.schemaName ?? TARGET.schemaName,
      requestBody: {
        model: overrides.model ?? TARGET.model,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: overrides.responseFormatSchemaName ?? TARGET.schemaName,
            strict: true,
            schema: { type: "object" },
          },
        },
        messages: [
          { role: "system", content: "system prompt" },
          { role: "user", content: "user prompt" },
        ],
      },
    },
  };
}

async function main() {
  const missing = validateEnv({});
  assert.equal(missing.ok, false);
  assert(missing.missing.includes(CONFIRM_ENV));
  assert(missing.missing.includes(CAPTURE_PATH_ENV));

  const timeoutOverride = validateEnv(
    confirmedEnv({
      [TIMEOUT_ENV]: "123456",
    }),
  );
  assert.equal(timeoutOverride.ok, true);
  assert.equal(timeoutOverride.timeoutMs, 123456);

  await assert.rejects(
    async () => assertCaptureArtifact(createCaptureArtifact({ target: { participantId: "wrong" } })),
    /participantId mismatch/,
  );

  await assert.rejects(
    async () => assertCaptureArtifact(createCaptureArtifact({ providerMode: "v2-segmented" })),
    /providerMode mismatch/,
  );

  await assert.rejects(
    async () => assertCaptureArtifact(createCaptureArtifact({ schemaName: "wrong-schema" })),
    /schemaName mismatch/,
  );

  await assert.rejects(
    async () =>
      assertCaptureArtifact(
        createCaptureArtifact({ responseFormatSchemaName: "ipip_neo_120_participant_v2" }),
      ),
    /response_format\.json_schema\.name mismatch/,
  );

  const blocked = await runProbe({ env: {} });
  assert.equal(blocked.status, "blocked_confirmation");
  assert.equal(blocked.openAiCalled, false);
  assert.equal(blocked.databaseWrites, false);

  const transportHelpers = loadOpenAiTransportHelpers();
  assert.equal(typeof transportHelpers.resolveOpenAiFetchTransport, "function");

  let transportFetchUrl = null;
  let transportFetchInit = null;
  const transport = {
    fetchImplementation: "undici.fetch",
    dispatcher: { kind: "probe-dispatcher" },
    transportTimeoutApplied: true,
    transportHeadersTimeoutMs: 900000,
    transportBodyTimeoutMs: 900000,
    async fetchImpl(url, init) {
      transportFetchUrl = url;
      transportFetchInit = init;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async json() {
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({ report_type: "individual", audience: "participant" }),
                },
              },
            ],
          };
        },
      };
    },
  };
  const directCall = await callOpenAiDirect({
    apiKey: "probe-key",
    timeoutMs: 900000,
    requestBody: createCaptureArtifact().preparedOpenAiRequest.requestBody,
    transport,
  });
  assert.equal(directCall.transport.fetchImplementation, "undici.fetch");
  assert.equal(directCall.transport.dispatcherPassedToFetchInit, true);
  assert.equal(transportFetchUrl, "https://api.openai.com/v1/chat/completions");
  assert.equal(transportFetchInit.dispatcher, transport.dispatcher);
  assert.equal(transportFetchInit.headers.Authorization, "Bearer probe-key");
  assert.deepEqual(
    JSON.parse(transportFetchInit.body),
    createCaptureArtifact().preparedOpenAiRequest.requestBody,
  );

  let fetchCalled = false;
  let callCount = 0;
  const success = await runProbe({
    env: confirmedEnv(),
    readFile() {
      return JSON.stringify(createCaptureArtifact());
    },
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error("fetch should not be called when callOpenAi is stubbed");
    },
    callOpenAi: async ({ timeoutMs, requestBody }) => {
      callCount += 1;
      assert.equal(timeoutMs, 900000);
      assert.equal(requestBody.model, TARGET.model);
      return {
        rawContent: JSON.stringify({
          report_type: "individual",
          audience: "participant",
        }),
        httpStatus: 200,
        httpStatusText: "OK",
        transport,
      };
    },
    now: (() => {
      let tick = 0;
      return () => {
        tick += 25;
        return tick;
      };
    })(),
  });
  assert.equal(callCount, 1);
  assert.equal(fetchCalled, false);
  assert.equal(success.openAiCalled, true);
  assert.equal(success.databaseWrites, false);
  assert.equal(success.resultClassification, "direct_openai_succeeded");
  assert.equal(success.parsedJson, true);
  assert.equal(success.transportTimeoutApplied, true);
  assert.equal(success.transportHeadersTimeoutMs, 900000);
  assert.equal(success.transportBodyTimeoutMs, 900000);
  assert.equal(success.fetchImplementation, "undici.fetch");
  assert.deepEqual(success.topLevelResponseKeys, ["report_type", "audience"]);

  let unsafeFetchCalled = false;
  const unsafeTransportRefusal = await runProbe({
    env: confirmedEnv(),
    readFile() {
      return JSON.stringify(createCaptureArtifact());
    },
    resolveTransport() {
      return {
        fetchImplementation: "global.fetch",
        dispatcher: null,
        dispatcherConfigured: false,
        transportTimeoutApplied: false,
        transportHeadersTimeoutMs: null,
        transportBodyTimeoutMs: null,
        async fetchImpl() {
          unsafeFetchCalled = true;
          throw new Error("unsafe transport fetch should not be called");
        },
      };
    },
    now: (() => {
      let tick = 0;
      return () => {
        tick += 5;
        return tick;
      };
    })(),
  });
  assert.equal(unsafeFetchCalled, false);
  assert.equal(unsafeTransportRefusal.openAiCalled, false);
  assert.equal(unsafeTransportRefusal.databaseWrites, false);
  assert.equal(unsafeTransportRefusal.transportTimeoutApplied, false);
  assert.equal(unsafeTransportRefusal.fetchImplementation, "global.fetch");
  assert.match(
    unsafeTransportRefusal.errorMessage,
    /requires explicit OpenAI transport timeouts/,
  );

  const parseFailure = await runProbe({
    env: confirmedEnv(),
    readFile() {
      return JSON.stringify(createCaptureArtifact());
    },
    callOpenAi: async () => ({
      rawContent: "{not-json",
      httpStatus: 200,
      httpStatusText: "OK",
      transport,
    }),
    now: (() => {
      let tick = 0;
      return () => {
        tick += 10;
        return tick;
      };
    })(),
  });
  assert.equal(parseFailure.resultClassification, "direct_openai_parse_failed");
  assert.equal(parseFailure.responseReceived, true);
  assert.equal(parseFailure.parsedJson, false);
  assert.match(parseFailure.responseBodyExcerpt, /\{not-json/);

  const timeoutFailure = await runProbe({
    env: confirmedEnv(),
    readFile() {
      return JSON.stringify(createCaptureArtifact());
    },
    callOpenAi: async () => {
      const error = new Error("OpenAI direct IPIP participant probe timed out after 900000ms.");
      error.transport = transport;
      throw error;
    },
    now: (() => {
      let tick = 0;
      return () => {
        tick += 100;
        return tick;
      };
    })(),
  });
  assert.equal(timeoutFailure.resultClassification, "direct_openai_timeout");

  const fetchFailure = await runProbe({
    env: confirmedEnv(),
    readFile() {
      return JSON.stringify(createCaptureArtifact());
    },
    callOpenAi: async () => {
      const error = new Error("fetch failed");
      error.transport = transport;
      throw error;
    },
  });
  assert.equal(fetchFailure.resultClassification, "direct_openai_fetch_failed");

  assert.equal(classifyProbeFailure(new Error("fetch failed")), "direct_openai_fetch_failed");
  assert.equal(
    classifyProbeFailure(new Error("OpenAI direct IPIP participant probe timed out after 1ms.")),
    "direct_openai_timeout",
  );
  assert.equal(
    classifyProbeFailure(new Error("OpenAI direct IPIP participant probe parse failed: bad json")),
    "direct_openai_parse_failed",
  );

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "amra-ipip-probe-test-"));
  const capturePath = path.join(tempDir, "capture.json");
  fs.writeFileSync(capturePath, JSON.stringify(createCaptureArtifact()), "utf8");
  const artifactRead = await runProbe({
    env: confirmedEnv({
      [CAPTURE_PATH_ENV]: capturePath,
      [TIMEOUT_ENV]: "777000",
    }),
    callOpenAi: async ({ timeoutMs }) => {
      assert.equal(timeoutMs, 777000);
      return {
        rawContent: JSON.stringify({ ok: true }),
        httpStatus: 200,
        httpStatusText: "OK",
        transport,
      };
    },
  });
  assert.equal(artifactRead.resultClassification, "direct_openai_succeeded");
  assert.equal(artifactRead.timeoutMs, 777000);
  assert.equal(artifactRead.fetchImplementation, "undici.fetch");

  console.log("test-probe-amra-replay-ipip-participant-openai-direct: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
