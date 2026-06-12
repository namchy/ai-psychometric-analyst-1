const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const CONFIRM_ENV = "CONFIRM_SINGLE_TEST_HR_INPUT_INSPECT";
const FAMILY_ENV = "SINGLE_TEST_HR_FAMILY";
const ATTEMPT_ID_ENV = "SINGLE_TEST_HR_ATTEMPT_ID";
const REPORT_ID_ENV = "SINGLE_TEST_HR_REPORT_ID";
const OUTPUT_PREFIX = "single-test-hr-ai-input";

const FAMILY_TO_TEST_SLUG = {
  safran: "safran_v1",
  mwms: "mwms_v1",
  ipip: "ipip-neo-120-v1",
};

const SINGLE_TEST_HR_REPORT_TYPE = "individual";
const SINGLE_TEST_HR_AUDIENCE = "hr";
const SINGLE_TEST_HR_SOURCE_TYPE = "single_test";

function isExecutionConfirmed(env = process.env) {
  return env[CONFIRM_ENV] === "true";
}

function buildTimestamp(now = () => new Date().toISOString()) {
  return now().replace(/[:.]/g, "-");
}

function buildOutputPath(family, timestamp = buildTimestamp()) {
  return path.join(os.tmpdir(), `${OUTPUT_PREFIX}-${family}-${timestamp}.json`);
}

function buildNoCallSummary() {
  return {
    mode: "no-call preflight",
    confirmed: false,
    openAiCalled: false,
    databaseAccessed: false,
    databaseWrites: false,
    reportRegenerated: false,
    productionFlowChanged: false,
    artifactWritten: false,
    wouldDo: [
      `Read a real completed single-test HR attempt/report context after ${CONFIRM_ENV}=true.`,
      "Build the production-equivalent CompletedAssessmentReportRequest.",
      "Build the production PreparedReportGenerationInput and OpenAI structured request body.",
      "Write diagnostic JSON only under /tmp.",
    ],
    usage: [
      `${FAMILY_ENV}=safran ${ATTEMPT_ID_ENV}=<attempt-id> ${CONFIRM_ENV}=true node --env-file=.env.local scripts/inspect-single-test-hr-ai-input.cjs`,
      `${FAMILY_ENV}=mwms ${REPORT_ID_ENV}=<attempt-report-id> ${CONFIRM_ENV}=true node --env-file=.env.local scripts/inspect-single-test-hr-ai-input.cjs`,
      `${FAMILY_ENV}=ipip ${ATTEMPT_ID_ENV}=<attempt-id> ${CONFIRM_ENV}=true node --env-file=.env.local scripts/inspect-single-test-hr-ai-input.cjs`,
    ],
    supportedFamilies: Object.keys(FAMILY_TO_TEST_SLUG),
  };
}

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

function assertDevelopmentOnly(env = process.env) {
  if (env.NODE_ENV === "production") {
    throw new Error("Single-test HR AI input inspector requires non-production NODE_ENV.");
  }
}

function parseCliValue(argv, name) {
  const equalsPrefix = `--${name}=`;
  const equalsValue = argv.find((arg) => arg.startsWith(equalsPrefix));

  if (equalsValue) {
    return equalsValue.slice(equalsPrefix.length);
  }

  const index = argv.findIndex((arg) => arg === `--${name}`);

  if (index >= 0 && argv[index + 1]) {
    return argv[index + 1];
  }

  return null;
}

function normalizeFamily(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return Object.prototype.hasOwnProperty.call(FAMILY_TO_TEST_SLUG, normalized)
    ? normalized
    : null;
}

function resolveRunInput({ env = process.env, argv = process.argv.slice(2) } = {}) {
  const family = normalizeFamily(env[FAMILY_ENV] || parseCliValue(argv, "family"));
  const attemptId = env[ATTEMPT_ID_ENV] || parseCliValue(argv, "attempt") || null;
  const reportId = env[REPORT_ID_ENV] || parseCliValue(argv, "report") || null;

  if (!family) {
    throw new Error(`${FAMILY_ENV} must be one of: ${Object.keys(FAMILY_TO_TEST_SLUG).join(", ")}.`);
  }

  if (!attemptId && !reportId) {
    throw new Error(`Confirmed input inspect requires ${ATTEMPT_ID_ENV} or ${REPORT_ID_ENV}.`);
  }

  return {
    family,
    attemptId,
    reportId,
  };
}

function familyFromTestSlug(testSlug) {
  return (
    Object.entries(FAMILY_TO_TEST_SLUG).find(([, slug]) => slug === testSlug)?.[0] ?? null
  );
}

function getPromptKeyForSingleTestHrJob(context) {
  if (context.family === "mwms") {
    return "mwms_hr_report_v1";
  }

  if (context.family === "safran") {
    return "safran_hr_report_v1";
  }

  // Mirrors report-job-worker.ts for IPIP HR, which falls back to completed_assessment_report.
  return "completed_assessment_report";
}

function getPromptInputIdentity(promptInput) {
  if (promptInput?.test && typeof promptInput.test === "object") {
    return {
      testSlug: promptInput.test.slug ?? null,
      audience: promptInput.test.audience ?? null,
      sourceType: promptInput.test.sourceType ?? null,
      locale: promptInput.test.locale ?? null,
      attemptId: promptInput.attemptId ?? null,
      testId: promptInput.testId ?? null,
    };
  }

  return {
    testSlug: promptInput?.test_slug ?? promptInput?.testSlug ?? null,
    audience: promptInput?.audience ?? null,
    sourceType: promptInput?.sourceType ?? promptInput?.source_type ?? null,
    locale: promptInput?.locale ?? null,
    attemptId: promptInput?.attempt_id ?? promptInput?.attemptId ?? null,
    testId: promptInput?.test_id ?? promptInput?.testId ?? null,
  };
}

function assertFamilyMatches(family, testSlug) {
  const expectedSlug = FAMILY_TO_TEST_SLUG[family];

  if (testSlug !== expectedSlug) {
    throw new Error(`Requested ${family} diagnostic requires test slug ${expectedSlug}, received ${testSlug}.`);
  }
}

async function loadReportRowById(supabase, reportId) {
  const { data, error } = await supabase
    .from("attempt_reports")
    .select(
      "id, attempt_id, test_slug, audience, report_type, source_type, generator_type, report_status, prompt_version_id, model_name, input_snapshot",
    )
    .eq("id", reportId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load single-test HR attempt_report: ${error.message}`);
  }

  return data ?? null;
}

async function loadAttemptRow(supabase, attemptId) {
  const { data, error } = await supabase
    .from("attempts")
    .select("id, test_id, locale, status, completed_at, tests(slug)")
    .eq("id", attemptId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load completed attempt context: ${error.message}`);
  }

  return data ?? null;
}

function readAttemptTestSlug(attemptRow) {
  const tests = attemptRow?.tests;

  if (Array.isArray(tests)) {
    return tests[0]?.slug ?? null;
  }

  return tests?.slug ?? null;
}

async function loadProductionDiagnosticContext(input, dependencies) {
  const { createSupabaseAdminClient, resolveReportLocale } = dependencies;
  const supabase = createSupabaseAdminClient();
  const reportRow = input.reportId ? await loadReportRowById(supabase, input.reportId) : null;
  const attemptId = reportRow?.attempt_id ?? input.attemptId;

  if (!attemptId) {
    throw new Error("Unable to resolve attempt id for diagnostic context.");
  }

  if (reportRow) {
    if (
      reportRow.audience !== SINGLE_TEST_HR_AUDIENCE ||
      reportRow.report_type !== SINGLE_TEST_HR_REPORT_TYPE ||
      reportRow.source_type !== SINGLE_TEST_HR_SOURCE_TYPE
    ) {
      throw new Error("Target report is not an HR single-test individual report.");
    }

    assertFamilyMatches(input.family, reportRow.test_slug);
  }

  const attemptRow = await loadAttemptRow(supabase, attemptId);

  if (!attemptRow?.test_id) {
    throw new Error(`Attempt ${attemptId} is missing a linked test.`);
  }

  if (attemptRow.status !== "completed") {
    throw new Error(`Attempt ${attemptId} is not completed.`);
  }

  const testSlug = reportRow?.test_slug ?? readAttemptTestSlug(attemptRow);
  assertFamilyMatches(input.family, testSlug);

  return {
    family: input.family,
    reportId: reportRow?.id ?? null,
    reportStatus: reportRow?.report_status ?? null,
    attemptId,
    testId: attemptRow.test_id,
    testSlug,
    locale: resolveReportLocale(attemptRow.locale),
    reportType: reportRow?.report_type ?? SINGLE_TEST_HR_REPORT_TYPE,
    audience: SINGLE_TEST_HR_AUDIENCE,
    sourceType: reportRow?.source_type ?? SINGLE_TEST_HR_SOURCE_TYPE,
    generatorType: "openai",
    persistedGeneratorType: reportRow?.generator_type ?? null,
    persistedPromptVersionId: reportRow?.prompt_version_id ?? null,
    persistedModelName: reportRow?.model_name ?? null,
    persistedInputSnapshotPresent: reportRow?.input_snapshot != null,
  };
}

async function buildSingleTestHrAiInputArtifact(context, dependencies, options = {}) {
  const {
    buildCompletedAssessmentReportRequest,
    buildOpenAiStructuredRequestPayload,
    buildPreparedReportGenerationInput,
    getActivePromptVersion,
    getActiveReportRuntimeConfig,
    getAiReportConfig,
    normalizeAiReportModel,
  } = dependencies;
  const aiConfig = getAiReportConfig();
  const runtimeConfig = await getActiveReportRuntimeConfig({
    reportType: context.reportType,
    audience: context.audience,
    sourceType: context.sourceType,
    generatorType: "openai",
  });
  const activePromptVersion = await getActivePromptVersion(
    {
      testId: context.testId,
      reportType: context.reportType,
      audience: context.audience,
      sourceType: context.sourceType,
      generatorType: "openai",
      promptKey: getPromptKeyForSingleTestHrJob(context),
    },
    {
      locale: context.locale,
    },
  );
  const promptVersion = activePromptVersion?.version ?? aiConfig.promptVersion;
  const model = normalizeAiReportModel(
    context.persistedModelName ?? runtimeConfig?.modelName ?? aiConfig.model,
  );

  if (!model) {
    throw new Error("AI_REPORT_MODEL or active OpenAI runtime model is required for request-body capture.");
  }

  const request = await buildCompletedAssessmentReportRequest(context.testId, context.attemptId, {
    audience: context.audience,
    locale: context.locale,
    promptVersion,
  });

  if (!request) {
    throw new Error(`Attempt ${context.attemptId} is not eligible for single-test HR input capture.`);
  }

  const preparedInput = buildPreparedReportGenerationInput(request, {
    promptVersionId: activePromptVersion?.id ?? context.persistedPromptVersionId ?? null,
    promptTemplate: activePromptVersion,
  });
  const openAiPayload = buildOpenAiStructuredRequestPayload(preparedInput, {
    apiKey: null,
    model,
    timeoutMs: aiConfig.openAiTimeoutMs,
  });
  const promptInputIdentity = getPromptInputIdentity(preparedInput.promptInput);

  return {
    metadata: {
      timestamp: options.timestamp ?? new Date().toISOString(),
      reportFamily: context.family,
      testSlug: context.testSlug,
      reportType: preparedInput.reportContract.reportType,
      audience: context.audience,
      sourceType: preparedInput.reportContract.sourceType,
      locale: request.locale,
      attemptId: context.attemptId,
      reportId: context.reportId,
      reportStatus: context.reportStatus,
      provider: "openai",
      model,
      confirmed: true,
      databaseWrites: false,
      openAiCalled: false,
      reportRegenerated: false,
      productionFlowChanged: false,
      diagnosticInputSource:
        "production buildCompletedAssessmentReportRequest + buildPreparedReportGenerationInput",
      reconstructedInputUsed: false,
      persistedInputSnapshotPresent: context.persistedInputSnapshotPresent,
      persistedGeneratorType: context.persistedGeneratorType,
    },
    inputSummary: {
      attemptId: context.attemptId,
      reportId: context.reportId,
      testId: context.testId,
      testSlug: context.testSlug,
      promptInputIdentity,
    },
    promptSource: {
      promptVersionId: activePromptVersion?.id ?? context.persistedPromptVersionId ?? null,
      promptVersion,
      promptTemplateId: activePromptVersion?.id ?? null,
      promptTemplateVersion: activePromptVersion?.version ?? null,
      promptSource: activePromptVersion ? "db_prompt_version" : "code_default_prompt",
      promptKey: openAiPayload.authorityMetadata?.promptKey ?? preparedInput.reportContract.promptKey,
      authorityMetadata: openAiPayload.authorityMetadata,
    },
    promptInput: preparedInput.promptInput,
    reportContract: {
      family: preparedInput.reportContract.family,
      reportType: preparedInput.reportContract.reportType,
      sourceType: preparedInput.reportContract.sourceType,
      promptKey: preparedInput.reportContract.promptKey,
      schemaName: preparedInput.reportContract.schemaName,
      outputSchemaJson: preparedInput.reportContract.outputSchemaJson,
    },
    preparedOpenAiRequest: {
      schemaName: openAiPayload.schemaName,
      schema: openAiPayload.schema,
      systemPrompt: openAiPayload.systemPrompt,
      userPrompt: openAiPayload.userPrompt,
      requestBody: openAiPayload.requestBody,
    },
  };
}

function loadRuntimeDependencies() {
  const {
    buildCompletedAssessmentReportRequest,
  } = require("../lib/assessment/reports.ts");
  const {
    buildPreparedReportGenerationInput,
  } = require("../lib/assessment/report-provider-helpers.ts");
  const {
    buildOpenAiStructuredRequestPayload,
  } = require("../lib/assessment/report-provider-openai.ts");
  const {
    getAiReportConfig,
    normalizeAiReportModel,
  } = require("../lib/assessment/report-config.ts");
  const {
    getActivePromptVersion,
  } = require("../lib/assessment/prompt-version.ts");
  const {
    getActiveReportRuntimeConfig,
  } = require("../lib/assessment/report-runtime-config.ts");
  const {
    resolveReportLocale,
  } = require("../lib/assessment/locale.ts");
  const {
    createSupabaseAdminClient,
  } = require("../lib/supabase/admin.ts");

  return {
    buildCompletedAssessmentReportRequest,
    buildOpenAiStructuredRequestPayload,
    buildPreparedReportGenerationInput,
    createSupabaseAdminClient,
    getActivePromptVersion,
    getActiveReportRuntimeConfig,
    getAiReportConfig,
    normalizeAiReportModel,
    resolveReportLocale,
  };
}

async function runSingleTestHrAiInputInspect({
  env = process.env,
  argv = process.argv.slice(2),
  now = () => new Date().toISOString(),
  writeFile = fs.writeFileSync,
  chmodFile = fs.chmodSync,
  installRuntime = installTypeScriptRuntime,
  loadContext,
  buildArtifact,
  dependencies,
  dumpPath,
} = {}) {
  if (!isExecutionConfirmed(env)) {
    return buildNoCallSummary();
  }

  assertDevelopmentOnly(env);

  const input = resolveRunInput({ env, argv });

  if (!dependencies) {
    installRuntime();
  }

  const runtimeDependencies = dependencies ?? loadRuntimeDependencies();
  const timestamp = now();
  const contextLoader = loadContext ?? loadProductionDiagnosticContext;
  const artifactBuilder = buildArtifact ?? buildSingleTestHrAiInputArtifact;
  const context = await contextLoader(input, runtimeDependencies);
  const artifact = await artifactBuilder(context, runtimeDependencies, { timestamp });
  const outputPath = dumpPath ?? buildOutputPath(input.family, timestamp.replace(/[:.]/g, "-"));

  writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { mode: 0o600 });
  chmodFile(outputPath, 0o600);

  return {
    ...artifact,
    dumpPath: outputPath,
  };
}

async function main() {
  const result = await runSingleTestHrAiInputInspect();

  console.log(
    JSON.stringify(
      result.confirmed === false
        ? result
        : {
            metadata: result.metadata,
            inputSummary: result.inputSummary,
            promptSource: result.promptSource,
            reportContract: {
              ...result.reportContract,
              outputSchemaJson: "[omitted from console summary]",
            },
            preparedOpenAiRequest: {
              schemaName: result.preparedOpenAiRequest.schemaName,
              requestBody: result.preparedOpenAiRequest.requestBody,
            },
            dumpPath: result.dumpPath,
          },
      null,
      2,
    ),
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  ATTEMPT_ID_ENV,
  CONFIRM_ENV,
  FAMILY_ENV,
  REPORT_ID_ENV,
  buildNoCallSummary,
  buildOutputPath,
  buildSingleTestHrAiInputArtifact,
  getPromptKeyForSingleTestHrJob,
  installTypeScriptRuntime,
  isExecutionConfirmed,
  loadProductionDiagnosticContext,
  resolveRunInput,
  runSingleTestHrAiInputInspect,
};
