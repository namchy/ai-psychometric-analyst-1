const fs = require("node:fs");
const path = require("node:path");

const CONFIRM_ENV = "CONFIRM_AMRA_REPLAY_IPIP_PARTICIPANT_OPENAI_DIRECT_PROBE";
const CAPTURE_PATH_ENV = "IPIP_PARTICIPANT_REQUEST_CAPTURE_PATH";
const TIMEOUT_ENV = "AI_REPORT_OPENAI_TIMEOUT_MS";

const TARGET = {
  participantId: "a5678fd5-8fea-4308-8569-5448f26b4f71",
  assignmentId: "033f8975-5d9c-4c66-8842-f37527d556d5",
  attemptId: "e71d472a-13cb-4cc9-9582-6eaa262affca",
  testSlug: "ipip-neo-120-v1",
  fixture: "amra_replay_fixture_v1",
  reportType: "individual",
  audience: "participant",
  sourceType: "single_test",
  provider: "openai",
  model: "gpt-5.5",
  providerMode: "v2-single",
  schemaName: "ipip-neo-120-participant-v2",
};

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function coercePositiveInteger(value) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function sanitizeExcerpt(value, limit = 240) {
  if (typeof value !== "string") {
    return null;
  }

  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return null;
  }

  return compact.slice(0, limit);
}

function validateEnv(env = process.env) {
  const missing = [];

  if (env.NODE_ENV !== "development") {
    missing.push("NODE_ENV=development");
  }
  if (env[CONFIRM_ENV] !== "true") {
    missing.push(CONFIRM_ENV);
  }
  if (!normalizeString(env[CAPTURE_PATH_ENV])) {
    missing.push(CAPTURE_PATH_ENV);
  }

  return {
    ok: missing.length === 0,
    missing,
    capturePath: normalizeString(env[CAPTURE_PATH_ENV]),
    timeoutMs: coercePositiveInteger(env[TIMEOUT_ENV]),
  };
}

function readCaptureArtifact(capturePath, readFile = fs.readFileSync) {
  const raw = readFile(capturePath, "utf8");

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Invalid request capture artifact ${capturePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function assertCaptureArtifact(artifact) {
  const target = artifact?.target ?? null;
  const runtime = artifact?.runtime ?? null;
  const metadata = artifact?.metadata ?? null;
  const request = artifact?.preparedOpenAiRequest ?? null;
  const requestBody = request?.requestBody ?? null;
  const artifactSchemaName = request?.schemaName ?? null;
  const responseFormatSchemaName =
    requestBody?.response_format?.json_schema?.name ?? null;

  if (!target || typeof target !== "object") {
    throw new Error("Capture artifact is missing target metadata.");
  }
  if (!requestBody || typeof requestBody !== "object") {
    throw new Error("Capture artifact is missing preparedOpenAiRequest.requestBody.");
  }
  if (!runtime || typeof runtime !== "object") {
    throw new Error("Capture artifact is missing runtime metadata.");
  }

  const checks = [
    ["target.participantId", target.participantId, TARGET.participantId],
    ["target.assignmentId", target.assignmentId, TARGET.assignmentId],
    ["target.attemptId", target.attemptId, TARGET.attemptId],
    ["target.testSlug", target.testSlug, TARGET.testSlug],
    ["target.fixture", target.fixture, TARGET.fixture],
    ["target.reportType", target.reportType, TARGET.reportType],
    ["target.audience", target.audience, TARGET.audience],
    ["target.sourceType", target.sourceType, TARGET.sourceType],
    ["runtime.provider", runtime.provider, TARGET.provider],
    ["runtime.model", runtime.model, TARGET.model],
    ["artifact.providerMode", artifact?.providerMode, TARGET.providerMode],
    ["preparedOpenAiRequest.schemaName", artifactSchemaName, TARGET.schemaName],
    [
      "preparedOpenAiRequest.requestBody.model",
      requestBody?.model,
      TARGET.model,
    ],
  ];

  for (const [label, received, expected] of checks) {
    if (received !== expected) {
      throw new Error(`Capture artifact ${label} mismatch: expected ${expected}, received ${received}.`);
    }
  }

  if (responseFormatSchemaName !== artifactSchemaName) {
    throw new Error(
      `Capture artifact preparedOpenAiRequest.requestBody.response_format.json_schema.name mismatch: expected ${artifactSchemaName}, received ${responseFormatSchemaName}.`,
    );
  }

  if (metadata?.participantDataOnlyQa !== true) {
    throw new Error("Capture artifact must come from participant data-only QA mode.");
  }

  if (metadata?.aiProseMutated !== false) {
    throw new Error("Capture artifact indicates AI prose mutation, expected false.");
  }

  return {
    artifact,
    requestBody,
    timeoutMs: coercePositiveInteger(runtime.timeoutMs),
  };
}

function classifyProbeFailure(error, rawContent) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("timed out") ||
    normalized.includes("aborterror") ||
    normalized.includes("aborted")
  ) {
    return "direct_openai_timeout";
  }

  if (
    normalized.includes("fetch failed") ||
    normalized.includes("networkerror") ||
    normalized.includes("econnreset") ||
    normalized.includes("econnrefused") ||
    normalized.includes("connect") ||
    normalized.includes("enotfound")
  ) {
    return "direct_openai_fetch_failed";
  }

  if (normalized.includes("parse failed") || normalized.includes("did not contain structured content")) {
    return "direct_openai_parse_failed";
  }

  if (typeof rawContent === "string" && rawContent.trim()) {
    return "direct_openai_parse_failed";
  }

  return "direct_openai_other_error";
}

async function callOpenAiDirect(options) {
  if (!options.apiKey) {
    throw new Error("Missing required env var: OPENAI_API_KEY");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () =>
      controller.abort(
        new Error(`OpenAI direct IPIP participant probe timed out after ${options.timeoutMs}ms.`),
      ),
    options.timeoutMs,
  );

  try {
    const response = await options.fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(options.requestBody),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const error = new Error(
        `OpenAI direct IPIP participant probe failed with status ${response.status}: ${await response.text()}`,
      );
      error.httpStatus = response.status;
      error.httpStatusText = response.statusText ?? null;
      throw error;
    }

    const payload = await response.json();
    const rawContent = payload?.choices?.[0]?.message?.content;

    if (typeof rawContent !== "string" || rawContent.trim().length === 0) {
      const error = new Error("OpenAI direct IPIP participant probe response did not contain structured content.");
      error.httpStatus = response.status;
      error.httpStatusText = response.statusText ?? null;
      throw error;
    }

    return {
      rawContent,
      responsePayload: payload,
      httpStatus: response.status,
      httpStatusText: response.statusText ?? null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runProbe(options = {}) {
  const env = options.env ?? process.env;
  const validation = validateEnv(env);

  if (!validation.ok) {
    return {
      status: "blocked_confirmation",
      validation,
      openAiCalled: false,
      databaseWrites: false,
      cleanupPerformed: false,
      reportGenerated: false,
      reportRetried: false,
    };
  }

  const readFile = options.readFile ?? fs.readFileSync;
  const capture = readCaptureArtifact(validation.capturePath, readFile);
  const asserted = assertCaptureArtifact(capture);
  const fetchImpl = options.fetchImpl ?? fetch;
  const callOpenAi = options.callOpenAi ?? callOpenAiDirect;
  const timeoutMs = validation.timeoutMs ?? asserted.timeoutMs ?? 900000;
  const requestBodyJson = JSON.stringify(asserted.requestBody);
  const startedAt = options.now ? options.now() : Date.now();

  try {
    const response = await callOpenAi({
      apiKey: normalizeString(env.OPENAI_API_KEY),
      timeoutMs,
      requestBody: asserted.requestBody,
      fetchImpl,
    });
    const endedAt = options.now ? options.now() : Date.now();

    let parsed = null;
    try {
      parsed = JSON.parse(response.rawContent);
    } catch (error) {
      return {
        openAiCalled: true,
        databaseWrites: false,
        cleanupPerformed: false,
        reportGenerated: false,
        reportRetried: false,
        elapsedMs: Math.max(0, endedAt - startedAt),
        timeoutMs,
        providerMode: capture.providerMode,
        model: asserted.requestBody.model,
        schemaName: capture.preparedOpenAiRequest.schemaName,
        requestBodyByteCount: Buffer.byteLength(requestBodyJson, "utf8"),
        responseReceived: true,
        parsedJson: false,
        topLevelResponseKeys: [],
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: `OpenAI direct IPIP participant probe parse failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        errorCauseName: null,
        errorCauseMessage: null,
        errorCauseCode: null,
        errorCauseErrno: null,
        httpStatus: response.httpStatus ?? null,
        httpStatusText: response.httpStatusText ?? null,
        responseBodyExcerpt: sanitizeExcerpt(response.rawContent),
        resultClassification: "direct_openai_parse_failed",
      };
    }

    return {
      openAiCalled: true,
      databaseWrites: false,
      cleanupPerformed: false,
      reportGenerated: false,
      reportRetried: false,
      elapsedMs: Math.max(0, endedAt - startedAt),
      timeoutMs,
      providerMode: capture.providerMode,
      model: asserted.requestBody.model,
      schemaName: capture.preparedOpenAiRequest.schemaName,
      requestBodyByteCount: Buffer.byteLength(requestBodyJson, "utf8"),
      responseReceived: true,
      parsedJson: true,
      topLevelResponseKeys: Object.keys(parsed),
      errorName: null,
      errorMessage: null,
      errorCauseName: null,
      errorCauseMessage: null,
      errorCauseCode: null,
      errorCauseErrno: null,
      httpStatus: response.httpStatus ?? null,
      httpStatusText: response.httpStatusText ?? null,
      responseBodyExcerpt: null,
      resultClassification: "direct_openai_succeeded",
    };
  } catch (error) {
    const endedAt = options.now ? options.now() : Date.now();
    const cause = error instanceof Error ? error.cause : null;

    return {
      openAiCalled: true,
      databaseWrites: false,
      cleanupPerformed: false,
      reportGenerated: false,
      reportRetried: false,
      elapsedMs: Math.max(0, endedAt - startedAt),
      timeoutMs,
      providerMode: capture.providerMode,
      model: asserted.requestBody.model,
      schemaName: capture.preparedOpenAiRequest.schemaName,
      requestBodyByteCount: Buffer.byteLength(requestBodyJson, "utf8"),
      responseReceived: false,
      parsedJson: false,
      topLevelResponseKeys: [],
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCauseName: cause instanceof Error ? cause.name : cause?.name ?? null,
      errorCauseMessage: cause instanceof Error ? cause.message : cause?.message ?? null,
      errorCauseCode: cause?.code ?? error?.code ?? null,
      errorCauseErrno: cause?.errno ?? error?.errno ?? null,
      httpStatus: error?.httpStatus ?? null,
      httpStatusText: error?.httpStatusText ?? null,
      responseBodyExcerpt: sanitizeExcerpt(error instanceof Error ? error.message : String(error)),
      resultClassification: classifyProbeFailure(error),
    };
  }
}

async function main() {
  const result = await runProbe();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status === "blocked_confirmation") {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  CAPTURE_PATH_ENV,
  CONFIRM_ENV,
  TARGET,
  TIMEOUT_ENV,
  assertCaptureArtifact,
  callOpenAiDirect,
  classifyProbeFailure,
  readCaptureArtifact,
  runProbe,
  sanitizeExcerpt,
  validateEnv,
};
