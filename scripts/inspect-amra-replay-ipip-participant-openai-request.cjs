const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const CONFIRM_ENV = "CONFIRM_AMRA_REPLAY_IPIP_PARTICIPANT_REQUEST_CAPTURE";
const DATA_ONLY_QA_ENV = "CONFIRM_AMRA_REPLAY_PARTICIPANT_DATA_ONLY_QA";
const PARTICIPANT_ID_ENV = "TARGET_REPLAY_PARTICIPANT_ID";
const ASSIGNMENT_ID_ENV = "TARGET_REPLAY_ASSESSMENT_ASSIGNMENT_ID";
const ATTEMPT_ID_ENV = "TARGET_REPLAY_ATTEMPT_ID";
const DUMP_PATH_ENV = "IPIP_PARTICIPANT_REQUEST_CAPTURE_PATH";

const TARGET = {
  participantId: "a5678fd5-8fea-4308-8569-5448f26b4f71",
  participantEmail: "amra.new1@example.test",
  assignmentId: "033f8975-5d9c-4c66-8842-f37527d556d5",
  attemptId: "e71d472a-13cb-4cc9-9582-6eaa262affca",
  organizationId: "5d93f3a1-3765-4ec4-b668-c0d1228a8445",
  testSlug: "ipip-neo-120-v1",
  fixture: "amra_replay_fixture_v1",
  reportType: "individual",
  audience: "participant",
  sourceType: "single_test",
  provider: "openai",
  model: "gpt-5.5",
};

let runtimeInstalled = false;

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

function installTypeScriptRuntime() {
  if (runtimeInstalled) {
    return;
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

  runtimeInstalled = true;
}

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validateEnv(env = process.env) {
  const missing = [];
  const mismatches = [];
  const values = {
    participantId: normalizeString(env[PARTICIPANT_ID_ENV]),
    assignmentId: normalizeString(env[ASSIGNMENT_ID_ENV]),
    attemptId: normalizeString(env[ATTEMPT_ID_ENV]),
  };

  if (env.NODE_ENV !== "development") {
    missing.push("NODE_ENV=development");
  }
  if (env[CONFIRM_ENV] !== "true") {
    missing.push(CONFIRM_ENV);
  }
  if (env[DATA_ONLY_QA_ENV] !== "true") {
    missing.push(DATA_ONLY_QA_ENV);
  }

  for (const [envName, field, expected] of [
    [PARTICIPANT_ID_ENV, "participantId", TARGET.participantId],
    [ASSIGNMENT_ID_ENV, "assignmentId", TARGET.assignmentId],
    [ATTEMPT_ID_ENV, "attemptId", TARGET.attemptId],
  ]) {
    if (!values[field]) {
      missing.push(envName);
    } else if (values[field] !== expected) {
      mismatches.push({ env: envName, expected, received: values[field] });
    }
  }

  return {
    ok: missing.length === 0 && mismatches.length === 0,
    missing,
    mismatches,
    values,
  };
}

function sanitizeForDump(value, key = "") {
  if (/(?:api[_-]?key|authorization|secret|password|token|service[_-]?role)/i.test(key)) {
    return "[REDACTED]";
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForDump(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeForDump(childValue, childKey),
      ]),
    );
  }
  return value;
}

function buildMetrics({ requestBody, schema, systemPrompt, userPrompt, deterministicInput, inputSnapshot }) {
  const requestBodyJson = JSON.stringify(requestBody);
  const schemaJson = JSON.stringify(schema);
  const deterministicInputJson = JSON.stringify(deterministicInput);
  const inputSnapshotJson = inputSnapshot == null ? null : JSON.stringify(inputSnapshot);
  const combinedMessagesCharCount = systemPrompt.length + userPrompt.length;

  return {
    systemMessageCharCount: systemPrompt.length,
    userMessageCharCount: userPrompt.length,
    combinedMessagesCharCount,
    requestBodyCharCount: requestBodyJson.length,
    requestBodyByteCount: Buffer.byteLength(requestBodyJson, "utf8"),
    jsonSchemaCharCount: schemaJson.length,
    deterministicInputCharCount: deterministicInputJson.length,
    inputSnapshotCharCount: inputSnapshotJson?.length ?? null,
    approximateTokenEstimate: Math.ceil(requestBodyJson.length / 4),
    approximateTokenEstimateMethod: "requestBodyCharCount / 4; approximate only",
    messageCount: requestBody.messages.length,
    topLevelRequestBodyKeys: Object.keys(requestBody),
    responseFormatJsonSchemaName: requestBody.response_format?.json_schema?.name ?? null,
  };
}

async function loadReplayContext(supabase) {
  const [{ data: participant, error: participantError }, { data: assignment, error: assignmentError }] =
    await Promise.all([
      supabase
        .from("participants")
        .select("id, organization_id, email")
        .eq("id", TARGET.participantId)
        .maybeSingle(),
      supabase
        .from("assessment_assignments")
        .select("id, organization_id, participant_id, assignment_type, status, locale, metadata")
        .eq("id", TARGET.assignmentId)
        .maybeSingle(),
    ]);

  if (participantError) {
    throw new Error(`Failed to load replay participant: ${participantError.message}`);
  }
  if (assignmentError) {
    throw new Error(`Failed to load replay assignment: ${assignmentError.message}`);
  }

  const { data: link, error: linkError } = await supabase
    .from("assessment_assignment_attempts")
    .select(
      "assessment_assignment_id, attempt_id, test_slug, attempts!inner(id, test_id, organization_id, participant_id, status, locale), tests!inner(slug)",
    )
    .eq("assessment_assignment_id", TARGET.assignmentId)
    .eq("attempt_id", TARGET.attemptId)
    .eq("test_slug", TARGET.testSlug)
    .maybeSingle();

  if (linkError) {
    throw new Error(`Failed to load replay attempt ownership: ${linkError.message}`);
  }

  return { participant, assignment, link };
}

function assertReplayContext(context) {
  const attempt = Array.isArray(context.link?.attempts)
    ? context.link.attempts[0]
    : context.link?.attempts;
  const test = Array.isArray(context.link?.tests) ? context.link.tests[0] : context.link?.tests;

  if (
    context.participant?.id !== TARGET.participantId ||
    context.participant?.organization_id !== TARGET.organizationId ||
    context.participant?.email !== TARGET.participantEmail
  ) {
    throw new Error("Replay participant ownership guard failed.");
  }

  if (
    context.assignment?.id !== TARGET.assignmentId ||
    context.assignment?.organization_id !== TARGET.organizationId ||
    context.assignment?.participant_id !== TARGET.participantId ||
    context.assignment?.assignment_type !== "standard_battery" ||
    context.assignment?.status !== "completed" ||
    context.assignment?.metadata?.fixture !== TARGET.fixture
  ) {
    throw new Error("Replay assignment fixture ownership guard failed.");
  }

  if (
    context.link?.assessment_assignment_id !== TARGET.assignmentId ||
    context.link?.attempt_id !== TARGET.attemptId ||
    context.link?.test_slug !== TARGET.testSlug ||
    attempt?.id !== TARGET.attemptId ||
    attempt?.organization_id !== TARGET.organizationId ||
    attempt?.participant_id !== TARGET.participantId ||
    attempt?.status !== "completed" ||
    test?.slug !== TARGET.testSlug
  ) {
    throw new Error("Replay IPIP attempt ownership guard failed.");
  }

  return {
    testId: attempt.test_id,
    locale: attempt.locale ?? context.assignment.locale,
  };
}

function loadRuntimeDependencies() {
  installTypeScriptRuntime();

  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const { buildCompletedAssessmentReportRequest } = require("../lib/assessment/reports.ts");
  const { buildPreparedReportGenerationInput } = require("../lib/assessment/report-provider-helpers.ts");
  const {
    buildOpenAiStructuredRequestPayload,
    prepareIpipNeo120ParticipantAiInputV2ForOpenAi,
    resolveIpipNeo120ParticipantProviderMode,
  } = require("../lib/assessment/report-provider-openai.ts");
  const { getAiReportConfig, normalizeAiReportModel } = require("../lib/assessment/report-config.ts");
  const { getActivePromptVersion } = require("../lib/assessment/prompt-version.ts");
  const { getActiveReportRuntimeConfig } = require("../lib/assessment/report-runtime-config.ts");
  const { resolveReportLocale } = require("../lib/assessment/locale.ts");

  return {
    buildCompletedAssessmentReportRequest,
    buildOpenAiStructuredRequestPayload,
    buildPreparedReportGenerationInput,
    createSupabaseAdminClient,
    getActivePromptVersion,
    getActiveReportRuntimeConfig,
    getAiReportConfig,
    normalizeAiReportModel,
    prepareIpipNeo120ParticipantAiInputV2ForOpenAi,
    resolveIpipNeo120ParticipantProviderMode,
    resolveReportLocale,
  };
}

async function buildCaptureArtifact(deps, options = {}) {
  const supabase = deps.createSupabaseAdminClient();
  const context = await loadReplayContext(supabase);
  const { testId, locale: rawLocale } = assertReplayContext(context);
  const locale = deps.resolveReportLocale(rawLocale);
  const aiConfig = deps.getAiReportConfig();
  const [runtimeConfig, promptVersion] = await Promise.all([
    deps.getActiveReportRuntimeConfig({
      reportType: TARGET.reportType,
      audience: TARGET.audience,
      sourceType: TARGET.sourceType,
      generatorType: TARGET.provider,
    }),
    deps.getActivePromptVersion(
      {
        testId,
        reportType: TARGET.reportType,
        audience: TARGET.audience,
        sourceType: TARGET.sourceType,
        generatorType: TARGET.provider,
        promptKey: "ipip_neo_120_participant_v1",
      },
      { locale },
    ),
  ]);
  const model = deps.normalizeAiReportModel(runtimeConfig?.modelName ?? aiConfig.model);

  if (!runtimeConfig || model !== TARGET.model || aiConfig.fallbackToMock) {
    throw new Error("Participant lane must resolve to openai/gpt-5.5 with mock fallback disabled.");
  }

  const resolvedPromptVersion = promptVersion?.version ?? aiConfig.promptVersion;
  const request = await deps.buildCompletedAssessmentReportRequest(testId, TARGET.attemptId, {
    audience: TARGET.audience,
    locale,
    promptVersion: resolvedPromptVersion,
  });

  if (!request) {
    throw new Error("Replay IPIP attempt is not eligible for participant request capture.");
  }

  const preparedInput = deps.buildPreparedReportGenerationInput(request, {
    promptVersionId: promptVersion?.id ?? null,
    promptTemplate: promptVersion,
    participantDataOnlyQa: true,
  });
  const providerMode = deps.resolveIpipNeo120ParticipantProviderMode(preparedInput);

  if (providerMode !== "v2-single") {
    throw new Error(`Expected IPIP participant providerMode v2-single, received ${providerMode}.`);
  }

  const deterministicInput =
    deps.prepareIpipNeo120ParticipantAiInputV2ForOpenAi(preparedInput);
  const payload = deps.buildOpenAiStructuredRequestPayload(preparedInput, {
    apiKey: null,
    model,
    timeoutMs: aiConfig.openAiTimeoutMs,
  });
  const metrics = buildMetrics({
    requestBody: payload.requestBody,
    schema: payload.schema,
    systemPrompt: payload.systemPrompt,
    userPrompt: payload.userPrompt,
    deterministicInput,
    inputSnapshot: preparedInput.promptInput,
  });

  return sanitizeForDump({
    metadata: {
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      devOnly: true,
      captureOnly: true,
      confirmed: true,
      openAiCalled: false,
      databaseWrites: false,
      cleanupPerformed: false,
      reportGenerated: false,
      reportRetried: false,
      participantDataOnlyQa: true,
      proseSafetyBhsValidatorsDiagnosticOnly: true,
      aiProseMutated: false,
    },
    target: TARGET,
    providerMode,
    runtime: {
      provider: TARGET.provider,
      model,
      reasoning_effort: runtimeConfig?.reasoningEffort ?? null,
      timeoutMs: aiConfig.openAiTimeoutMs ?? null,
      runtimeConfigId: runtimeConfig?.id ?? null,
    },
    prompt: {
      promptVersion: resolvedPromptVersion,
      promptVersionId: promptVersion?.id ?? null,
      promptSource: promptVersion ? "db_prompt_version" : "code_default_prompt",
    },
    metrics: {
      providerMode,
      model,
      reasoning_effort: runtimeConfig?.reasoningEffort ?? null,
      timeoutMs: aiConfig.openAiTimeoutMs ?? null,
      promptVersion: resolvedPromptVersion,
      promptVersionId: promptVersion?.id ?? null,
      schemaName: payload.schemaName,
      ...metrics,
      dataOnlyQaModeActive: true,
      proseSafetyBhsValidatorsDiagnosticOnly: true,
      aiProseMutated: false,
    },
    preparedOpenAiRequest: {
      schemaName: payload.schemaName,
      requestBody: payload.requestBody,
    },
    deterministicInputSnapshot: deterministicInput,
    inputSnapshot: preparedInput.promptInput,
    reportContract: {
      ...preparedInput.reportContract,
      outputSchemaJson: payload.schema,
    },
  });
}

async function runInspector(options = {}) {
  const env = options.env ?? process.env;
  const validation = validateEnv(env);

  if (!validation.ok) {
    return {
      status: "blocked_confirmation",
      validation,
      openAiCalled: false,
      databaseWrites: false,
    };
  }

  const deps = options.deps ?? loadRuntimeDependencies();
  const artifact = await buildCaptureArtifact(deps, {
    generatedAt: options.generatedAt,
  });
  const dumpPath = normalizeString(env[DUMP_PATH_ENV]);

  if (dumpPath) {
    const writeFile = options.writeFile ?? fs.writeFileSync;
    const chmodFile = options.chmodFile ?? fs.chmodSync;
    writeFile(dumpPath, `${JSON.stringify(artifact, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    chmodFile(dumpPath, 0o600);
  }

  return {
    ...artifact,
    dumpPath,
  };
}

async function main() {
  const result = await runInspector();
  const output =
    result.status === "blocked_confirmation"
      ? result
      : {
          metadata: result.metadata,
          target: result.target,
          providerMode: result.providerMode,
          runtime: result.runtime,
          prompt: result.prompt,
          metrics: result.metrics,
          dumpPath: result.dumpPath,
        };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
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
  ASSIGNMENT_ID_ENV,
  ATTEMPT_ID_ENV,
  CONFIRM_ENV,
  DATA_ONLY_QA_ENV,
  DUMP_PATH_ENV,
  PARTICIPANT_ID_ENV,
  TARGET,
  assertReplayContext,
  buildCaptureArtifact,
  buildMetrics,
  runInspector,
  sanitizeForDump,
  validateEnv,
};
