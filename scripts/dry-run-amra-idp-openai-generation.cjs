const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const TARGET_REPORT_ID = "898e895a-bd4b-4a3b-a15c-04ac0da4ee8c";
const TARGET_PARTICIPANT_ID = "9b742094-53dc-4de5-87a5-174c5491e4dd";
const TARGET_ASSESSMENT_ASSIGNMENT_ID = "16943547-ef84-4fc4-a3d2-11801b1f1869";
const TARGET_REPORT_TYPE = "individual_development_profile";
const TARGET_AUDIENCE = "hr";
const TARGET_SOURCE_TYPE = "assessment";
const CONFIRM_ENV = "CONFIRM_AMRA_IDP_OPENAI_DRY_RUN";
const OUTPUT_PATH = path.join(os.tmpdir(), "amra-idp-openai-dry-run-output.json");

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

let typeScriptRuntimeInstalled = false;

function installTypeScriptRuntime() {
  if (typeScriptRuntimeInstalled) {
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

  typeScriptRuntimeInstalled = true;
}

function assertDevelopmentOnly(env = process.env) {
  if (env.NODE_ENV !== "development") {
    throw new Error("Amra IDP OpenAI dry-run requires NODE_ENV=development.");
  }
}

function assertExecutionConfirmed(env = process.env) {
  if (env[CONFIRM_ENV]?.trim().toLowerCase() !== "true") {
    throw new Error(`Amra IDP OpenAI dry-run requires ${CONFIRM_ENV}=true.`);
  }
}

function sanitizeForArtifact(value, key = "") {
  if (
    /(?:api[_-]?key|service[_-]?role|authorization|secret|password|token)/i.test(key)
  ) {
    return "[REDACTED]";
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForArtifact(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeForArtifact(childValue, childKey),
      ]),
    );
  }

  return value;
}

function assertTargetContext(report) {
  if (
    report.id !== TARGET_REPORT_ID ||
    report.participant_id !== TARGET_PARTICIPANT_ID ||
    report.assessment_assignment_id !== TARGET_ASSESSMENT_ASSIGNMENT_ID
  ) {
    throw new Error("Loaded IDP report identity does not match the fixed Amra dry-run target.");
  }

  if (
    report.report_type !== TARGET_REPORT_TYPE ||
    report.audience !== TARGET_AUDIENCE ||
    report.source_type !== TARGET_SOURCE_TYPE
  ) {
    throw new Error("Loaded report does not match the expected IDP HR assessment lane.");
  }
}

async function loadTargetReport() {
  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("assessment_reports")
    .select(
      "id, organization_id, participant_id, assessment_assignment_id, report_type, audience, source_type, report_status, generator_type, model_name",
    )
    .eq("id", TARGET_REPORT_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load target IDP assessment_report: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Target IDP assessment_report ${TARGET_REPORT_ID} was not found.`);
  }

  assertTargetContext(data);
  return data;
}

function createCapturingOpenAiClient(options) {
  return {
    async createChatCompletion(request) {
      options.onRequest(request);
      const controller = new AbortController();
      const timeout = setTimeout(
        () =>
          controller.abort(
            new Error(`OpenAI IDP dry-run timed out after ${options.timeoutMs}ms.`),
          ),
        options.timeoutMs,
      );

      try {
        const response = await options.fetchImpl(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${options.apiKey}`,
            },
            body: JSON.stringify(request),
            signal: controller.signal,
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            `OpenAI IDP dry-run failed with status ${response.status}: ${await response.text()}`,
          );
        }

        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;

        if (typeof content !== "string" || content.trim().length === 0) {
          throw new Error("OpenAI IDP dry-run response did not contain structured content.");
        }

        options.onRawContent(content);
        return { content };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function buildRequestSummary(request) {
  return {
    model: request?.model ?? null,
    temperaturePresent: Boolean(
      request && Object.prototype.hasOwnProperty.call(request, "temperature"),
    ),
    temperature: request?.temperature ?? null,
    messageCount: Array.isArray(request?.messages) ? request.messages.length : 0,
    responseFormatType: request?.response_format?.type ?? null,
    responseFormatSchemaName:
      request?.response_format?.json_schema?.name ?? null,
  };
}

function parseRawContent(rawContent) {
  if (typeof rawContent !== "string" || rawContent.trim().length === 0) {
    return {
      ok: false,
      value: null,
      error: "OpenAI provider did not expose raw content.",
    };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(rawContent),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runOpenAiDryRun(options = {}) {
  const env = options.env ?? process.env;
  assertDevelopmentOnly(env);
  assertExecutionConfirmed(env);
  installTypeScriptRuntime();

  const { getAiReportConfig } = require("../lib/assessment/report-config.ts");
  const {
    getActiveReportRuntimeConfig,
  } = require("../lib/assessment/report-runtime-config.ts");
  const {
    buildIndividualDevelopmentProfileInputSnapshot,
  } = require("../lib/assessment/individual-development-profile-input.ts");
  const {
    generateIndividualDevelopmentProfileWithOpenAi,
  } = require("../lib/assessment/individual-development-profile-openai-provider.ts");
  const {
    validateIndividualDevelopmentProfileSnapshot,
  } = require("../lib/assessment/individual-development-profile-contract.ts");
  const {
    resolveAiReportLanguagePolicy,
  } = require("../lib/assessment/ai-report-language-policy.ts");
  const {
    validateReportLanguageQuality,
  } = require("../lib/assessment/report-language-quality.ts");

  const loadReport = options.loadTargetReport ?? loadTargetReport;
  const buildInput =
    options.buildInputSnapshot ?? buildIndividualDevelopmentProfileInputSnapshot;
  const loadRuntimeConfig =
    options.loadRuntimeConfig ?? getActiveReportRuntimeConfig;
  const loadConfig = options.getAiReportConfig ?? getAiReportConfig;
  const generateWithOpenAi =
    options.generateWithOpenAi ?? generateIndividualDevelopmentProfileWithOpenAi;
  const validateContract =
    options.validateContract ?? validateIndividualDevelopmentProfileSnapshot;
  const resolveLanguagePolicy =
    options.resolveLanguagePolicy ?? resolveAiReportLanguagePolicy;
  const validateQuality =
    options.validateQuality ?? validateReportLanguageQuality;
  const writeFile = options.writeFile ?? fs.writeFileSync;
  const chmodFile = options.chmodFile ?? fs.chmodSync;
  const fetchImpl = options.fetchImpl ?? fetch;
  const dumpPath = options.dumpPath ?? OUTPUT_PATH;

  const targetReport = await loadReport();
  assertTargetContext(targetReport);

  const [inputResult, runtimeConfig] = await Promise.all([
    buildInput({
      assessmentAssignmentId: TARGET_ASSESSMENT_ASSIGNMENT_ID,
      organizationId: targetReport.organization_id,
      participantId: TARGET_PARTICIPANT_ID,
    }),
    loadRuntimeConfig({
      reportType: TARGET_REPORT_TYPE,
      audience: TARGET_AUDIENCE,
      sourceType: TARGET_SOURCE_TYPE,
      generatorType: "openai",
    }),
  ]);

  if (!inputResult.ok) {
    throw new Error(
      `Failed to build canonical IDP input snapshot: ${inputResult.reason}. ${inputResult.details}`,
    );
  }

  const config = loadConfig();
  const model = runtimeConfig?.modelName ?? config.model;
  const temperature = runtimeConfig?.temperature ?? null;

  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required for the confirmed IDP dry-run.");
  }

  if (!model) {
    throw new Error("No OpenAI model is configured for the IDP HR report lane.");
  }

  let capturedRequest = null;
  let rawContent = null;
  const generatedAt = new Date().toISOString();
  const client =
    options.openAiClient ??
    createCapturingOpenAiClient({
      apiKey: config.openAiApiKey,
      timeoutMs: config.openAiTimeoutMs,
      fetchImpl,
      onRequest(request) {
        capturedRequest = request;
      },
      onRawContent(content) {
        rawContent = content;
      },
    });

  const providerResult = await generateWithOpenAi(inputResult.inputSnapshot, {
    apiKey: config.openAiApiKey,
    model,
    timeoutMs: config.openAiTimeoutMs,
    temperature,
    client,
    now: () => generatedAt,
  });

  if (options.openAiClient && typeof options.captureRequest === "function") {
    capturedRequest = options.captureRequest();
  }

  if (options.openAiClient && typeof options.captureRawContent === "function") {
    rawContent = options.captureRawContent();
  }

  const parsedRaw = parseRawContent(rawContent);
  const parsedReport = providerResult.ok
    ? providerResult.reportSnapshot
    : parsedRaw.value;
  const contractValidation = parsedReport
    ? validateContract(parsedReport)
    : { ok: false, errors: [parsedRaw.error ?? "Parsed report is unavailable."] };
  const languagePolicy = parsedReport
    ? resolveLanguagePolicy(parsedReport.locale)
    : null;
  const canonicalizedReport =
    parsedReport && languagePolicy
      ? languagePolicy.canonicalizeUserFacingOutput(parsedReport)
      : parsedReport;
  const bhsErrors =
    canonicalizedReport && languagePolicy
      ? languagePolicy.validateUserFacingOutput(canonicalizedReport, {
          audience: "hr",
        })
      : [];
  const qualityValidation = canonicalizedReport
    ? validateQuality({
        snapshot: canonicalizedReport,
        locale: canonicalizedReport.locale,
        audience: "hr",
        reportType: "single_test",
        context: "individual_development_profile_hr_report",
      })
    : { ok: false, issues: [] };

  const artifact = sanitizeForArtifact({
    generatedAt,
    target: {
      reportId: targetReport.id,
      participantId: targetReport.participant_id,
      assessmentAssignmentId: targetReport.assessment_assignment_id,
      organizationId: targetReport.organization_id,
      reportStatusAtRead: targetReport.report_status,
      persistedGeneratorType: targetReport.generator_type,
      persistedModelName: targetReport.model_name,
    },
    runtimeConfig: {
      configuredProvider: config.provider,
      generatorType: "openai",
      model,
      temperature,
      reasoningEffort: runtimeConfig?.reasoningEffort ?? null,
      timeoutMs: config.openAiTimeoutMs,
      runtimeConfigId: runtimeConfig?.id ?? null,
    },
    safety: {
      openAiCalled: true,
      databaseWrites: false,
      lifecycleWrites: false,
      persistedReportUpdated: false,
    },
    requestSummary: buildRequestSummary(capturedRequest),
    rawContent,
    parsedReport,
    validation: {
      provider: providerResult.ok
        ? { ok: true, errors: [] }
        : {
            ok: false,
            reason: providerResult.reason,
            errors: providerResult.errors,
          },
      rawJsonParse: {
        ok: parsedRaw.ok,
        error: parsedRaw.error,
      },
      contract: contractValidation.ok
        ? { ok: true, errors: [] }
        : { ok: false, errors: contractValidation.errors },
      bhs: {
        ok: bhsErrors.length === 0,
        errors: bhsErrors,
      },
      quality: qualityValidation.ok
        ? { ok: true, issues: [] }
        : { ok: false, issues: qualityValidation.issues },
    },
    dumpPath,
  });

  writeFile(dumpPath, `${JSON.stringify(artifact, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  chmodFile(dumpPath, 0o600);

  return artifact;
}

async function main() {
  const artifact = await runOpenAiDryRun();

  console.log(
    JSON.stringify(
      {
        target: artifact.target,
        runtimeConfig: artifact.runtimeConfig,
        safety: artifact.safety,
        requestSummary: artifact.requestSummary,
        validation: artifact.validation,
        dumpPath: artifact.dumpPath,
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
  TARGET_REPORT_ID,
  TARGET_PARTICIPANT_ID,
  TARGET_ASSESSMENT_ASSIGNMENT_ID,
  TARGET_REPORT_TYPE,
  TARGET_AUDIENCE,
  TARGET_SOURCE_TYPE,
  CONFIRM_ENV,
  OUTPUT_PATH,
  installTypeScriptRuntime,
  assertDevelopmentOnly,
  assertExecutionConfirmed,
  sanitizeForArtifact,
  assertTargetContext,
  createCapturingOpenAiClient,
  buildRequestSummary,
  parseRawContent,
  runOpenAiDryRun,
};
