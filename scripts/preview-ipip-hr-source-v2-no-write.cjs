const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const TARGET = Object.freeze({
  participantId: "2c895762-76f5-4d7b-adaa-ad55ebc73020",
  attemptId: "36bd2e0f-e712-4863-873c-7253a77534ee",
  reportId: "3b79a6e8-d888-49cc-81ef-ad03f0959cd0",
  promptKey: "ipip_neo_120_hr_v2",
  promptVersion: "v2_ipip_hr_natural_bosnian_section_roles_20260729",
  testSlug: "ipip-neo-120-v1",
  audience: "hr",
  reportType: "individual",
  sourceType: "single_test",
  generatorType: "openai",
  locale: "bs",
  schemaId: "ipip-neo-120-hr-v2",
});

const SOURCE_AUTHORITY = "source_prompt_version";
const CONFIRMATION_TOKEN = "EXACT_SOURCE_V2_ONE_CALL";
const PREVIEW_PROVIDER_PLAN = Object.freeze({
  provider: "openai",
  model: "gpt-5.6-sol",
  reasoningEffort: "medium",
  temperature: null,
  timeoutMs: 120000,
  maxProviderCalls: 1,
  retryCount: 0,
  fallback: false,
});
const DEFAULT_PROVIDER_TIMEOUT_MS = PREVIEW_PROVIDER_PLAN.timeoutMs;
const MIN_PROVIDER_TIMEOUT_MS = 30000;
const MAX_PROVIDER_TIMEOUT_MS = 600000;
const PROVIDER_OUTCOMES = Object.freeze({
  NOT_ATTEMPTED: "NOT_ATTEMPTED",
  AVAILABLE_AND_VALID: "PROVIDER_RESULT_AVAILABLE_AND_VALID",
  TIMEOUT: "PROVIDER_TIMEOUT",
  ERROR: "PROVIDER_ERROR",
  INVALID: "PROVIDER_RESULT_INVALID",
  NORMALIZATION_FAILED: "PROVIDER_RESULT_NORMALIZATION_FAILED",
});
const DB_OUTCOMES = Object.freeze({
  UNCHANGED: "DB_WRITES_ZERO_AND_EXISTING_REPORT_UNCHANGED",
  CHANGED: "DB_STATE_CHANGED",
  CAPTURE_FAILED: "DB_AFTER_STATE_CAPTURE_FAILED",
});
const DEFAULT_ARTIFACT_DIR = path.join(
  os.tmpdir(),
  "deep-profile",
  "ipip-hr-source-v2-preview",
);
const EXPECTED_SHA256 = Object.freeze({
  input: "020851d3589a07ae514bdd1863cc7766d9ab65df5100e2d15aa44bf5e4654f98",
  prompt: "2a6d322fe02e8c5072d068fdaa9115d77d468ea0bd96a1df9bc2a54a3ee11525",
  request: "b45fa540f5fe2d3b00b25f330484fa62cc4862e8a6f781df4b447124fb5b4a35",
});

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
}

function fail(message) {
  throw new Error(`SOURCE_V2_NO_WRITE_PREVIEW_BLOCKED: ${message}`);
}

function invariant(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function parseProviderTimeoutMs(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const rawValue = String(value).trim();
  invariant(/^\d+$/.test(rawValue), "--provider-timeout-ms must be an integer");

  const timeoutMs = Number(rawValue);
  invariant(Number.isSafeInteger(timeoutMs), "--provider-timeout-ms must be a safe integer");
  invariant(
    timeoutMs >= MIN_PROVIDER_TIMEOUT_MS && timeoutMs <= MAX_PROVIDER_TIMEOUT_MS,
    `--provider-timeout-ms must be between ${MIN_PROVIDER_TIMEOUT_MS} and ${MAX_PROVIDER_TIMEOUT_MS}`,
  );

  return timeoutMs;
}

function canonicalJson(value) {
  if (value === undefined) {
    return "null";
  }

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function stripStateSha(state) {
  const { state_sha256: _stateSha, ...stateWithoutSha } = state;
  return stateWithoutSha;
}

function buildStateSha(stateWithoutSha) {
  return sha256(stateWithoutSha);
}

function ensureArtifactDirectory(requestedPath = DEFAULT_ARTIFACT_DIR) {
  const resolvedPath = path.resolve(requestedPath);
  const tmpRoot = fs.realpathSync(os.tmpdir());

  invariant(
    resolvedPath === tmpRoot || resolvedPath.startsWith(`${tmpRoot}${path.sep}`),
    `artifact directory must be inside ${tmpRoot}`,
  );

  fs.mkdirSync(resolvedPath, { recursive: true, mode: 0o700 });
  return resolvedPath;
}

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

function findExactlyOnePrompt(
  prompts,
  label,
  { promptKey = TARGET.promptKey, promptVersion = TARGET.promptVersion } = {},
) {
  const matches = prompts.filter(
    (prompt) =>
      prompt.prompt_key === promptKey && prompt.version === promptVersion,
  );

  invariant(matches.length === 1, `${label} must contain exactly one target prompt record`);
  return matches[0];
}

function resolveSourcePrompt({ promptVersion = TARGET.promptVersion } = {}) {
  const packagePrompt = findExactlyOnePrompt(
    readJson("assessment-packages/ipip-neo-120-v1/prompts.json"),
    "package prompts.json",
    { promptVersion },
  );
  const bsPrompt = findExactlyOnePrompt(
    readJson("assessment-packages/ipip-neo-120-v1/locales/bs/prompts.json"),
    "BS locale prompts.json",
    { promptVersion },
  );

  for (const [label, prompt] of [
    ["package", packagePrompt],
    ["BS locale", bsPrompt],
  ]) {
    invariant(prompt.is_active === false, `${label} target prompt must remain is_active=false`);
    invariant(prompt.audience === TARGET.audience, `${label} audience must be hr`);
    invariant(prompt.report_type === TARGET.reportType, `${label} report_type must be individual`);
    invariant(prompt.source_type === TARGET.sourceType, `${label} source_type must be single_test`);
    invariant(prompt.generator_type === TARGET.generatorType, `${label} generator_type must be openai`);
    invariant(prompt.output_schema_json == null, `${label} output_schema_json must be null`);
  }

  invariant(
    packagePrompt.system_prompt === bsPrompt.system_prompt,
    "package and BS system_prompt values must match",
  );
  invariant(
    packagePrompt.user_prompt_template === bsPrompt.user_prompt_template,
    "package and BS user_prompt_template values must match",
  );

  const sourcePrompt = {
    authority: SOURCE_AUTHORITY,
    prompt_key: TARGET.promptKey,
    version: TARGET.promptVersion,
    is_active: false,
    audience: TARGET.audience,
    report_type: TARGET.reportType,
    source_type: TARGET.sourceType,
    generator_type: TARGET.generatorType,
    system_prompt: bsPrompt.system_prompt,
    user_prompt_template: bsPrompt.user_prompt_template,
    output_schema_json: null,
    source_files: [
      "assessment-packages/ipip-neo-120-v1/prompts.json",
      "assessment-packages/ipip-neo-120-v1/locales/bs/prompts.json",
    ],
  };

  return {
    sourcePrompt,
    promptSha256: sha256({
      prompt_key: sourcePrompt.prompt_key,
      version: sourcePrompt.version,
      system_prompt: sourcePrompt.system_prompt,
      user_prompt_template: sourcePrompt.user_prompt_template,
    }),
  };
}

function buildSourcePromptTemplate(source, testId) {
  return {
    id: null,
    testId,
    reportType: source.report_type,
    audience: source.audience,
    sourceType: source.source_type,
    generatorType: source.generator_type,
    promptKey: source.prompt_key,
    version: source.version,
    systemPrompt: source.system_prompt,
    userPromptTemplate: source.user_prompt_template,
    outputSchemaJson: null,
    notes: "source-only preview template",
    createdAt: "source-package",
    updatedAt: "source-package",
    updatedBy: null,
  };
}

function normalizeTestRelation(value) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function summarizeReportRow(row) {
  return {
    id: row.id,
    attempt_id: row.attempt_id,
    test_slug: row.test_slug,
    report_type: row.report_type,
    audience: row.audience,
    source_type: row.source_type,
    report_status: row.report_status,
    generator_type: row.generator_type,
    model_name: row.model_name,
    prompt_version_id: row.prompt_version_id,
    generator_version: row.generator_version,
    generated_at: row.generated_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    failure_code: row.failure_code,
    failure_reason: row.failure_reason,
    input_snapshot_sha256: row.input_snapshot == null ? null : sha256(row.input_snapshot),
    report_snapshot_sha256: row.report_snapshot == null ? null : sha256(row.report_snapshot),
  };
}

async function loadReadOnlyDbState({
  createSupabaseAdminClient,
  attemptId = TARGET.attemptId,
}) {
  const supabase = createSupabaseAdminClient();
  const [attemptResult, reportsResult] = await Promise.all([
    supabase
      .from("attempts")
      .select(
        "id, participant_id, test_id, status, locale, started_at, scored_started_at, completed_at, metadata, tests(slug)",
      )
      .eq("id", attemptId)
      .maybeSingle(),
    supabase
      .from("attempt_reports")
      .select(
        "id, attempt_id, test_slug, report_type, audience, source_type, report_status, generator_type, model_name, prompt_version_id, generator_version, input_snapshot, report_snapshot, generated_at, started_at, completed_at, failure_code, failure_reason",
      )
      .eq("attempt_id", attemptId)
      .order("id"),
  ]);

  if (attemptResult.error) {
    throw new Error(`Failed to load canonical attempt read-only state: ${attemptResult.error.message}`);
  }

  if (reportsResult.error) {
    throw new Error(`Failed to load attempt_reports read-only state: ${reportsResult.error.message}`);
  }

  const attempt = attemptResult.data;
  const reportRows = (reportsResult.data ?? []).map(summarizeReportRow).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const reportRowsRaw = reportsResult.data ?? [];
  const stateWithoutSha = {
    attempt: {
      id: attempt?.id ?? null,
      participant_id: attempt?.participant_id ?? null,
      test_id: attempt?.test_id ?? null,
      test_slug: normalizeTestRelation(attempt?.tests)?.slug ?? null,
      status: attempt?.status ?? null,
      locale: attempt?.locale ?? null,
      started_at: attempt?.started_at ?? null,
      scored_started_at: attempt?.scored_started_at ?? null,
      completed_at: attempt?.completed_at ?? null,
      metadata_sha256: attempt?.metadata == null ? null : sha256(attempt.metadata),
    },
    reports: reportRows,
    counts: {
      report_rows: reportRows.length,
      queued: reportRowsRaw.filter((row) => row.report_status === "queued").length,
      processing: reportRowsRaw.filter((row) => row.report_status === "processing").length,
    },
  };

  return {
    ...stateWithoutSha,
    state_sha256: buildStateSha(stateWithoutSha),
  };
}

function assertCanonicalReadiness(state) {
  const attempt = state.attempt;
  const report = state.reports.find((row) => row.id === TARGET.reportId);

  invariant(attempt.id === TARGET.attemptId, "attempt id does not match canonical attempt");
  invariant(
    attempt.participant_id === TARGET.participantId,
    "attempt participant_id does not match canonical participant",
  );
  invariant(attempt.test_slug === TARGET.testSlug, "attempt test slug does not match IPIP package");
  invariant(attempt.status === "completed", "canonical attempt is not completed");
  invariant(attempt.locale === TARGET.locale, "canonical attempt locale must be bs");
  invariant(report, "canonical existing report row is missing");
  invariant(report.attempt_id === TARGET.attemptId, "existing report points to another attempt");
  invariant(report.audience === TARGET.audience, "existing report audience must be hr");
  invariant(report.report_type === TARGET.reportType, "existing report type must be individual");
  invariant(report.source_type === TARGET.sourceType, "existing report source_type must be single_test");
  invariant(report.report_status === "ready", "existing canonical report must remain ready before preview");
  invariant(state.counts.report_rows === 1, "canonical attempt must have exactly one report row");
  invariant(state.counts.queued === 0, "canonical attempt must have zero queued report rows");
  invariant(state.counts.processing === 0, "canonical attempt must have zero processing report rows");

  return report;
}

function assertCanonicalInput(input) {
  invariant(input.attempt_id === TARGET.attemptId, "prompt input attempt_id mismatch");
  invariant(input.test_slug === TARGET.testSlug, "prompt input test_slug mismatch");
  invariant(input.audience === TARGET.audience, "prompt input audience mismatch");
  invariant(input.locale === TARGET.locale, "prompt input locale mismatch");
  invariant(input.scored_response_count === 120, "prompt input must contain 120 scored responses");
  invariant(Array.isArray(input.domains) && input.domains.length === 5, "prompt input must contain 5 domains");

  const facetCount = input.domains.reduce(
    (total, domain) => total + (Array.isArray(domain.facets) ? domain.facets.length : 0),
    0,
  );
  invariant(facetCount === 30, "prompt input must contain 30 facets");

  for (const domain of input.domains) {
    invariant(domain.score != null && domain.score_band, `missing score/band for ${domain.domain_code}`);

    for (const facet of domain.facets ?? []) {
      invariant(facet.score != null && facet.score_band, `missing score/band for ${facet.facet_code}`);
    }
  }
}

function loadRuntimeDependencies() {
  installTypeScriptRuntime();

  const { buildCompletedAssessmentReportRequest } = require("../lib/assessment/reports.ts");
  const { buildPreparedReportGenerationInput } = require("../lib/assessment/report-provider-helpers.ts");
  const {
    buildOpenAiStructuredRequestPayload,
    createOpenAiReportProvider,
    validateStructuredReport,
  } = require("../lib/assessment/report-provider-openai.ts");
  const { getAiReportConfig } = require("../lib/assessment/report-config.ts");
  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");

  return {
    buildCompletedAssessmentReportRequest,
    buildPreparedReportGenerationInput,
    buildOpenAiStructuredRequestPayload,
    createOpenAiReportProvider,
    validateStructuredReport,
    getAiReportConfig,
    createSupabaseAdminClient,
  };
}

function resolvePreviewRuntimeConfig(
  dependencies,
  { executeProvider = false, providerTimeoutMs = null } = {},
) {
  const aiConfig = dependencies.getAiReportConfig();
  invariant(aiConfig.provider === PREVIEW_PROVIDER_PLAN.provider, "preview provider must be OpenAI");
  invariant(aiConfig.fallbackToMock === false, "preview fallback must be disabled");

  invariant(
    aiConfig.openAiTimeoutMs === DEFAULT_PROVIDER_TIMEOUT_MS,
    `preview default timeout must be ${DEFAULT_PROVIDER_TIMEOUT_MS}, received ${aiConfig.openAiTimeoutMs}`,
  );

  const requestedTimeoutMs = parseProviderTimeoutMs(providerTimeoutMs);
  const plannedTimeoutMs = requestedTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
  const timeoutMs = executeProvider ? plannedTimeoutMs : DEFAULT_PROVIDER_TIMEOUT_MS;

  return {
    ...PREVIEW_PROVIDER_PLAN,
    timeoutMs,
    plannedTimeoutMs,
    apiKey: aiConfig.openAiApiKey ?? null,
  };
}

function buildPreviewPromptInput(preparedInput) {
  const promptInput = preparedInput.promptInput;
  assertCanonicalInput(promptInput);
  invariant(preparedInput.reportContract.schemaName === TARGET.schemaId, "existing schema contract mismatch");
  invariant(preparedInput.reportContract.outputSchemaJson, "existing schema contract output schema is missing");
  return promptInput;
}

function buildPreviewRequest(preparedInput, dependencies, runtimeConfig) {
  const previousReasoningEffort = process.env.AI_REPORT_REASONING_EFFORT;
  process.env.AI_REPORT_REASONING_EFFORT = runtimeConfig.reasoningEffort;

  let payload;
  try {
    payload = dependencies.buildOpenAiStructuredRequestPayload(preparedInput, {
      apiKey: null,
      model: runtimeConfig.model,
      timeoutMs: runtimeConfig.timeoutMs,
    });
  } finally {
    if (previousReasoningEffort === undefined) {
      delete process.env.AI_REPORT_REASONING_EFFORT;
    } else {
      process.env.AI_REPORT_REASONING_EFFORT = previousReasoningEffort;
    }
  }

  const requestBody = payload.requestBody;

  invariant(requestBody.model === "gpt-5.6-sol", "request model must be gpt-5.6-sol");
  invariant(requestBody.reasoning_effort === "medium", "request reasoning_effort must be medium");
  invariant(!Object.prototype.hasOwnProperty.call(requestBody, "temperature"), "request must omit temperature");
  invariant(requestBody.response_format.type === "json_schema", "request must use json_schema");
  invariant(
    requestBody.response_format.json_schema.name === TARGET.schemaId,
    "request schema name must be ipip-neo-120-hr-v2",
  );
  invariant(payload.schema.$id === TARGET.schemaId, "request schema $id must be ipip-neo-120-hr-v2");

  return {
    schemaName: payload.schemaName,
    schema: payload.schema,
    systemPrompt: payload.systemPrompt,
    userPrompt: payload.userPrompt,
    requestBody,
  };
}

function buildDbVerification({ beforeState, afterState, providerOutcome, captureError = null }) {
  if (!afterState) {
    return {
      provider_verdict: providerOutcome,
      db_verdict: DB_OUTCOMES.CAPTURE_FAILED,
      database_writes_zero: null,
      existing_report_unchanged: null,
      before_state_sha256: beforeState.state_sha256,
      after_state_sha256: null,
      report_row_count_unchanged: null,
      queued_count_unchanged: null,
      processing_count_unchanged: null,
      capture_error_type: captureError?.name ?? "Error",
      capture_error_message: captureError?.message ?? "after-state capture failed",
      status: DB_OUTCOMES.CAPTURE_FAILED,
    };
  }

  const existingReportUnchanged =
    canonicalJson(stripStateSha(beforeState)) === canonicalJson(stripStateSha(afterState));
  const reportRowCountUnchanged = beforeState.counts.report_rows === afterState.counts.report_rows;
  const queuedCountUnchanged = beforeState.counts.queued === afterState.counts.queued;
  const processingCountUnchanged = beforeState.counts.processing === afterState.counts.processing;
  const exactMatch =
    existingReportUnchanged &&
    reportRowCountUnchanged &&
    queuedCountUnchanged &&
    processingCountUnchanged;

  return {
    provider_verdict: providerOutcome,
    db_verdict: exactMatch ? DB_OUTCOMES.UNCHANGED : DB_OUTCOMES.CHANGED,
    database_writes_zero: exactMatch,
    existing_report_unchanged: existingReportUnchanged,
    before_state_sha256: beforeState.state_sha256,
    after_state_sha256: afterState.state_sha256,
    report_row_count_unchanged: reportRowCountUnchanged,
    queued_count_unchanged: queuedCountUnchanged,
    processing_count_unchanged: processingCountUnchanged,
    capture_error_type: null,
    capture_error_message: null,
    status: exactMatch ? DB_OUTCOMES.UNCHANGED : DB_OUTCOMES.CHANGED,
  };
}

function classifyProviderError(error) {
  if (error?.previewProviderOutcome && Object.values(PROVIDER_OUTCOMES).includes(error.previewProviderOutcome)) {
    return error.previewProviderOutcome;
  }

  const message = error instanceof Error ? error.message : String(error);
  return error?.name === "TimeoutError" || /timeout|timed out/i.test(message)
    ? PROVIDER_OUTCOMES.TIMEOUT
    : PROVIDER_OUTCOMES.ERROR;
}

function providerErrorType(providerOutcome) {
  return {
    [PROVIDER_OUTCOMES.TIMEOUT]: "TimeoutError",
    [PROVIDER_OUTCOMES.ERROR]: "ProviderError",
    [PROVIDER_OUTCOMES.INVALID]: "ValidationError",
    [PROVIDER_OUTCOMES.NORMALIZATION_FAILED]: "NormalizationError",
  }[providerOutcome] ?? null;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function buildFinalStatus({ providerOutcome, dbOutcome }) {
  if (providerOutcome === PROVIDER_OUTCOMES.AVAILABLE_AND_VALID && dbOutcome === DB_OUTCOMES.UNCHANGED) {
    return DB_OUTCOMES.UNCHANGED;
  }

  if (dbOutcome === DB_OUTCOMES.CAPTURE_FAILED) {
    return `SOURCE_V2_PREVIEW_${providerOutcome}_DB_AFTER_STATE_CAPTURE_FAILED`;
  }

  if (dbOutcome === DB_OUTCOMES.CHANGED) {
    return `SOURCE_V2_PREVIEW_${providerOutcome}_DB_CHANGED`;
  }

  const statusSuffix = {
    [PROVIDER_OUTCOMES.TIMEOUT]: "PROVIDER_TIMEOUT_DB_UNCHANGED",
    [PROVIDER_OUTCOMES.ERROR]: "PROVIDER_ERROR_DB_UNCHANGED",
    [PROVIDER_OUTCOMES.INVALID]: "RESULT_INVALID_DB_UNCHANGED",
    [PROVIDER_OUTCOMES.NORMALIZATION_FAILED]: "RESULT_NORMALIZATION_FAILED_DB_UNCHANGED",
  }[providerOutcome];

  return statusSuffix
    ? `SOURCE_V2_PREVIEW_${statusSuffix}`
    : `SOURCE_V2_PREVIEW_${providerOutcome}_DB_UNCHANGED`;
}

function buildManifest({
  mode,
  finalStatus,
  identity,
  source,
  runtimeConfig,
  hashes,
  dbBeforeState,
  providerCallCount,
  artifactDirectory,
  validationStatus,
  providerOutcome,
  providerError,
  afterState,
  verification,
  artifactErrors,
}) {
  return {
    mode,
    final_status: finalStatus,
    authority: SOURCE_AUTHORITY,
    target: identity,
    source_prompt: {
      prompt_key: source.prompt_key,
      version: source.version,
      is_active: source.is_active,
    },
    provider: {
      provider: runtimeConfig.provider,
      model: runtimeConfig.model,
      reasoningEffort: runtimeConfig.reasoningEffort,
      temperature: runtimeConfig.temperature,
      temperature_status: runtimeConfig.temperature === null ? "omitted" : "present",
      timeoutMs: runtimeConfig.timeoutMs,
      plannedTimeoutMs: runtimeConfig.plannedTimeoutMs,
      maxProviderCalls: runtimeConfig.maxProviderCalls,
      retryCount: runtimeConfig.retryCount,
      fallback: runtimeConfig.fallback,
    },
    provider_call_count: providerCallCount,
    provider_outcome: providerOutcome,
    provider_error_type: providerError ? providerErrorType(providerOutcome) : null,
    provider_error_message: providerError ? errorMessage(providerError) : null,
    provider_timeout_ms: runtimeConfig.plannedTimeoutMs,
    retry_count: 0,
    fallback_used: false,
    validation_status: validationStatus,
    hashes,
    input_sha256: hashes.input_sha256,
    prompt_sha256: hashes.prompt_sha256,
    request_sha256: hashes.request_sha256,
    raw_result_sha256: hashes.raw_result_sha256 ?? null,
    normalized_result_sha256: hashes.normalized_result_sha256 ?? null,
    db_before_state_sha256: dbBeforeState.state_sha256,
    db_after_state_sha256: afterState?.state_sha256 ?? null,
    db_state_exact_match:
      verification == null ? null : verification.db_verdict === DB_OUTCOMES.UNCHANGED,
    db_verdict: verification?.db_verdict ?? null,
    artifact_errors: artifactErrors,
    database_writes: false,
    queue_used: false,
    worker_used: false,
    artifact_directory: artifactDirectory,
    generated_at: new Date().toISOString(),
  };
}

function resolveProviderResult(result) {
  if (result && typeof result === "object" && typeof result.ok === "boolean") {
    if (!result.ok) {
      fail(`provider returned failure: ${result.reason ?? "unknown provider error"}`);
    }

    return result.report;
  }

  return result;
}

async function runPreview({
  identity = TARGET,
  executeProvider = false,
  confirmationToken = null,
  providerTimeoutMs = null,
  artifactDirectory = DEFAULT_ARTIFACT_DIR,
  dependencies = null,
  provider = null,
  env = process.env,
  now = () => new Date().toISOString(),
  assertExpectedShas = true,
} = {}) {
  invariant(env.NODE_ENV === "development" || env.NODE_ENV === "test", "preview requires NODE_ENV=development or NODE_ENV=test");

  const resolvedDependencies = dependencies ?? loadRuntimeDependencies();
  const artifactDir = ensureArtifactDirectory(artifactDirectory);
  const source = resolveSourcePrompt();
  const beforeState = await (resolvedDependencies.loadDbState ?? loadReadOnlyDbState)({
    createSupabaseAdminClient: resolvedDependencies.createSupabaseAdminClient,
    attemptId: identity.attemptId,
  });
  assertCanonicalReadiness(beforeState);

  const runtimeConfig = await resolvePreviewRuntimeConfig(resolvedDependencies, {
    executeProvider,
    providerTimeoutMs,
  });
  const request = await resolvedDependencies.buildCompletedAssessmentReportRequest(
    beforeState.attempt.test_id,
    identity.attemptId,
    {
      audience: TARGET.audience,
      locale: TARGET.locale,
      promptVersion: TARGET.promptVersion,
    },
  );
  invariant(request, "canonical completed assessment request could not be built");

  const preparedInput = resolvedDependencies.buildPreparedReportGenerationInput(request, {
    promptVersionId: null,
    promptTemplate: buildSourcePromptTemplate(source.sourcePrompt, beforeState.attempt.test_id),
  });
  const promptInput = buildPreviewPromptInput(preparedInput);
  const requestPayload = buildPreviewRequest(preparedInput, resolvedDependencies, runtimeConfig);
  const hashes = {
    input_sha256: sha256(promptInput),
    prompt_sha256: source.promptSha256,
    request_sha256: sha256(requestPayload.requestBody),
    raw_result_sha256: null,
    normalized_result_sha256: null,
  };

  if (assertExpectedShas) {
    invariant(hashes.input_sha256 === EXPECTED_SHA256.input, "canonical input SHA-256 changed");
    invariant(hashes.prompt_sha256 === EXPECTED_SHA256.prompt, "canonical prompt SHA-256 changed");
    invariant(hashes.request_sha256 === EXPECTED_SHA256.request, "canonical request SHA-256 changed");
  }

  const identityMetadata = {
    participant_id: beforeState.attempt.participant_id,
    attempt_id: identity.attemptId,
    report_id: identity.reportId,
    prompt_key: TARGET.promptKey,
    prompt_version: TARGET.promptVersion,
    test_slug: TARGET.testSlug,
    audience: TARGET.audience,
    report_type: TARGET.reportType,
    source_type: TARGET.sourceType,
    locale: TARGET.locale,
  };
  const prepareStatus =
    executeProvider && confirmationToken !== CONFIRMATION_TOKEN
      ? "PROVIDER_CALL_NOT_AUTHORIZED"
      : "READY_FOR_EXPLICIT_ONE_CALL_APPROVAL";
  const prepareArtifacts = {
    "canonical-input.json": promptInput,
    "source-prompt.json": source.sourcePrompt,
    "provider-request.json": {
      authority: SOURCE_AUTHORITY,
      schema_name: requestPayload.schemaName,
      schema: requestPayload.schema,
      system_prompt: requestPayload.systemPrompt,
      user_prompt: requestPayload.userPrompt,
      request_body: requestPayload.requestBody,
      timeout_ms: runtimeConfig.timeoutMs,
      planned_timeout_ms: runtimeConfig.plannedTimeoutMs,
      max_provider_calls: 1,
      retry_count: 0,
      fallback: false,
    },
    "db-before-state.json": beforeState,
  };

  for (const [fileName, value] of Object.entries(prepareArtifacts)) {
    writeJsonFile(path.join(artifactDir, fileName), value);
  }

  let providerCallCount = 0;
  let finalStatus = prepareStatus;
  let validationStatus = "not_run_prepare_only";
  let afterState = null;
  let verification = null;
  let providerOutcome = PROVIDER_OUTCOMES.NOT_ATTEMPTED;
  let providerError = null;
  let rawResult = null;
  let normalizedResult = null;
  const artifactErrors = [];
  const authorizedProviderAttempt =
    executeProvider && confirmationToken === CONFIRMATION_TOKEN;

  if (authorizedProviderAttempt) {
    const providerAdapter = provider ?? (async ({ preparedInput }) => {
      const adapter = resolvedDependencies.createOpenAiReportProvider({
        apiKey: runtimeConfig.apiKey,
        model: runtimeConfig.model,
        timeoutMs: runtimeConfig.timeoutMs,
      });
      return adapter.generateReport(preparedInput);
    });

    if (providerCallCount >= 1) {
      fail("provider call limit exceeded before execution");
    }

    providerCallCount += 1;
    try {
      const rawProviderResult = await providerAdapter({
        preparedInput,
        requestPayload,
        callNumber: providerCallCount,
      });
      rawResult = resolveProviderResult(rawProviderResult);
      invariant(rawResult != null, "provider returned an empty result");
      hashes.raw_result_sha256 = sha256(rawResult);

      try {
        normalizedResult = resolvedDependencies.validateStructuredReport(rawResult, preparedInput);
      } catch (error) {
        const validationError = new Error(errorMessage(error));
        validationError.previewProviderOutcome = error?.previewProviderOutcome ?? PROVIDER_OUTCOMES.INVALID;
        throw validationError;
      }

      hashes.normalized_result_sha256 = sha256(normalizedResult);
      validationStatus = "validated_and_normalized_in_memory";
      providerOutcome = PROVIDER_OUTCOMES.AVAILABLE_AND_VALID;
    } catch (error) {
      providerError = error;
      providerOutcome = classifyProviderError(error);
      validationStatus = providerOutcome.toLowerCase();
    } finally {
      try {
        afterState = await (resolvedDependencies.loadDbState ?? loadReadOnlyDbState)({
          createSupabaseAdminClient: resolvedDependencies.createSupabaseAdminClient,
          attemptId: identity.attemptId,
        });
        verification = buildDbVerification({
          beforeState,
          afterState,
          providerOutcome,
        });
      } catch (error) {
        verification = buildDbVerification({
          beforeState,
          afterState: null,
          providerOutcome,
          captureError: error,
        });
      }
    }

    const writeFailureArtifact = (fileName, value) => {
      try {
        writeJsonFile(path.join(artifactDir, fileName), value);
      } catch (error) {
        artifactErrors.push({
          file: fileName,
          error_type: error.name ?? "Error",
          error_message: errorMessage(error),
        });
      }
    };

    if (rawResult !== null) {
      writeFailureArtifact("raw-provider-result.json", rawResult);
    }
    if (normalizedResult !== null) {
      writeFailureArtifact("normalized-preview.json", normalizedResult);
    }
    if (afterState) {
      writeFailureArtifact("db-after-state.json", afterState);
    }
    if (verification) {
      writeFailureArtifact("verification.json", verification);
    }

    finalStatus = buildFinalStatus({
      providerOutcome,
      dbOutcome: verification?.db_verdict ?? DB_OUTCOMES.CAPTURE_FAILED,
    });
  }

  const manifest = buildManifest({
    mode: authorizedProviderAttempt ? "execute" : "prepare-only",
    finalStatus,
    identity: identityMetadata,
    source: source.sourcePrompt,
    runtimeConfig,
    hashes,
    dbBeforeState: beforeState,
    providerCallCount,
    artifactDirectory: artifactDir,
    validationStatus,
    providerOutcome,
    providerError,
    afterState,
    verification,
    artifactErrors,
  });
  manifest.created_at = now();
  manifest.verification_status = verification?.status ?? null;
  writeJsonFile(path.join(artifactDir, "manifest.json"), manifest);

  return {
    ...manifest,
    artifactFiles: Object.keys(prepareArtifacts).concat(
      rawResult !== null ? ["raw-provider-result.json"] : [],
      normalizedResult !== null ? ["normalized-preview.json"] : [],
      afterState ? ["db-after-state.json"] : [],
      verification ? ["verification.json"] : [],
      "manifest.json",
    ),
    preparedInput,
    requestPayload,
    beforeState,
    afterState,
    verification,
  };
}

function parseCliArgs(argv) {
  const values = {
    executeProvider: false,
    confirmationToken: null,
    artifactDirectory: DEFAULT_ARTIFACT_DIR,
    providerTimeoutMs: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--execute-provider") {
      values.executeProvider = true;
      continue;
    }

    const equalsIndex = argument.indexOf("=");
    const name = equalsIndex >= 0 ? argument.slice(0, equalsIndex) : argument;
    const inlineValue = equalsIndex >= 0 ? argument.slice(equalsIndex + 1) : null;
    const nextValue = inlineValue ?? argv[index + 1];

    if (name === "--confirm-one-call-no-write") {
      if (inlineValue === null) index += 1;
      values.confirmationToken = nextValue ?? null;
      continue;
    }

    if (name === "--artifact-dir") {
      if (inlineValue === null) index += 1;
      values.artifactDirectory = nextValue ?? DEFAULT_ARTIFACT_DIR;
      continue;
    }

    if (name === "--provider-timeout-ms") {
      if (inlineValue === null) index += 1;
      values.providerTimeoutMs = parseProviderTimeoutMs(nextValue);
      continue;
    }

    if (name === "--attempt" || name === "--report" || name === "--prompt-key" || name === "--prompt-version") {
      if (inlineValue === null) index += 1;
      const fieldName = {
        "--attempt": "attempt_id",
        "--report": "report_id",
        "--prompt-key": "prompt_key",
        "--prompt-version": "prompt_version",
      }[name];
      values[fieldName] = nextValue ?? null;
      continue;
    }

    fail(`unknown or malformed CLI argument: ${argument}`);
  }

  for (const [argumentName, expectedValue] of [
    ["attempt_id", TARGET.attemptId],
    ["report_id", TARGET.reportId],
    ["prompt_key", TARGET.promptKey],
    ["prompt_version", TARGET.promptVersion],
  ]) {
    invariant(values[argumentName] === expectedValue, `--${argumentName.replaceAll("_", "-")} must equal ${expectedValue}`);
  }

  return {
    identity: {
      attemptId: values.attempt_id,
      reportId: values.report_id,
    },
    executeProvider: values.executeProvider,
    confirmationToken: values.confirmationToken,
    artifactDirectory: values.artifactDirectory,
    providerTimeoutMs: values.providerTimeoutMs,
  };
}

async function main() {
  invariant(
    process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test",
    "CLI requires NODE_ENV=development or NODE_ENV=test",
  );

  const cli = parseCliArgs(process.argv.slice(2));
  const result = await runPreview({
    identity: {
      ...TARGET,
      ...cli.identity,
    },
    executeProvider: cli.executeProvider,
    confirmationToken: cli.confirmationToken,
    providerTimeoutMs: cli.providerTimeoutMs,
    artifactDirectory: cli.artifactDirectory,
  });

  console.log(
    JSON.stringify(
      {
        attempt_id: result.target.attempt_id,
        report_id: result.target.report_id,
        prompt_key: result.target.prompt_key,
        prompt_version: result.target.prompt_version,
        authority: result.authority,
        provider: result.provider.provider,
        model: result.provider.model,
        reasoning: result.provider.reasoningEffort,
        temperature: result.provider.temperature,
        timeout_ms: result.provider.timeoutMs,
        provider_call_count: result.provider_call_count,
        provider_outcome: result.provider_outcome,
        provider_error_type: result.provider_error_type,
        provider_error_message: result.provider_error_message,
        hashes: result.hashes,
        db_before_state_sha256: result.db_before_state_sha256,
        db_after_state_sha256: result.db_after_state_sha256,
        db_state_exact_match: result.db_state_exact_match,
        db_verdict: result.db_verdict,
        validation_status: result.validation_status,
        artifact_directory: result.artifact_directory,
        final_status: result.final_status,
      },
      null,
      2,
    ),
  );

  if (result.mode === "execute" && result.final_status !== DB_OUTCOMES.UNCHANGED) {
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
  CONFIRMATION_TOKEN,
  EXPECTED_SHA256,
  TARGET,
  installTypeScriptRuntime,
  parseCliArgs,
  parseProviderTimeoutMs,
  resolveSourcePrompt,
  runPreview,
  sha256,
};
