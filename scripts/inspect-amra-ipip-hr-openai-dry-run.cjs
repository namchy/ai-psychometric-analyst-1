const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const TARGET_REPORT_ID = "9ef593a9-ebcf-4606-a16e-f245b47deb0c";
const TARGET_ATTEMPT_ID = "2432eb12-2b54-4881-bef2-2ac687b59e0b";
const TARGET_TEST_SLUG = "ipip-neo-120-v1";
const TARGET_PARTICIPANT_NAME = "Amra";
const TARGET_AUDIENCE = "hr";
const TARGET_REPORT_TYPE = "individual";
const TARGET_SOURCE_TYPE = "single_test";
const TARGET_REPORT_CONTRACT = "ipip_neo_120_hr_v2";
const TARGET_PROMPT_KEY = "ipip_neo_120_hr_v2";
const CONFIRM_ENV = "CONFIRM_AMRA_IPIP_HR_OPENAI_DRY_RUN";
const TIMEOUT_OVERRIDE_ENV = "IPIP_HR_OPENAI_DRY_RUN_TIMEOUT_MS";
const OUTPUT_PATH = path.join(os.tmpdir(), "amra-ipip-hr-openai-dry-run.json");

const STRUCTURAL_FIELDS = new Set([
  "score_label_or_band",
  "domain_name",
  "facet_name",
  "contract_version",
  "prompt_version",
  "prompt_version_id",
  "prompt_key",
  "report_type",
  "source_type",
  "generator_type",
  "audience",
  "locale",
  "language",
  "code",
  "domain_code",
  "facet_code",
  "test_code",
  "test_slug",
  "test_id",
  "attempt_id",
  "report_id",
  "band",
  "score",
  "status",
  "type",
  "id",
]);

const WARNING_PATTERNS = [
  { term: "high", regex: /\bhigh\b/giu },
  { term: "low", regex: /\blow\b/giu },
  { term: "medium", regex: /\bmedium\b/giu },
  { term: "moderate", regex: /\bmoderate\b/giu },
  { term: "Snapshot", regex: /\bSnapshot\b/gu },
  { term: "HR hipoteza je", regex: /\bHR hipoteza je\b/giu },
  { term: "facete + capitalized word", regex: /\bfacete\s+[A-ZČĆŽŠĐ][\p{L}-]*/gu },
  {
    term: "capitalized domain form mid-sentence",
    regex:
      /[a-zčćžšđ][.!?;,:]?\s+(Ekstraverziju|Savjesnost|Neuroticizam|Otvorenost prema iskustvu)\b/gu,
  },
];

function isExecutionConfirmed(env = process.env) {
  return env[CONFIRM_ENV] === "true";
}

function buildNoCallSummary() {
  return {
    mode: "no-call preflight",
    confirmed: false,
    openAiCalled: false,
    databaseAccessed: false,
    databaseWrites: false,
    lifecycleHelpersUsed: false,
    target: {
      reportId: TARGET_REPORT_ID,
      attemptId: TARGET_ATTEMPT_ID,
      participant: TARGET_PARTICIPANT_NAME,
      reportContract: TARGET_REPORT_CONTRACT,
    },
    wouldDo: [
      "Read the target attempt_report and completed attempt context.",
      "Load the active OpenAI prompt version and report runtime model.",
      "Build the current IPIP HR prepared generation input.",
      "Call the existing OpenAI report provider with no fallback.",
      "Record existing BHS and strict IPIP validation results.",
      `Write diagnostic JSON to ${OUTPUT_PATH}.`,
    ],
    confirmationRequired: `${CONFIRM_ENV}=true`,
    optionalTimeoutOverride: TIMEOUT_OVERRIDE_ENV,
  };
}

function resolveDryRunTimeoutMs(config, env = process.env) {
  const rawOverride = env[TIMEOUT_OVERRIDE_ENV];

  if (rawOverride === undefined || rawOverride === "") {
    return config.openAiTimeoutMs;
  }

  const parsed = Number(rawOverride);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${TIMEOUT_OVERRIDE_ENV} must be a positive integer in milliseconds.`);
  }

  return parsed;
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

function shouldScanField(key) {
  const normalizedKey = key.toLowerCase();

  return (
    !STRUCTURAL_FIELDS.has(normalizedKey) &&
    !normalizedKey.startsWith("_") &&
    !normalizedKey.includes("schema") &&
    !normalizedKey.endsWith("_enum")
  );
}

function scanProseWarnings(value, pathParts = [], findings = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanProseWarnings(item, [...pathParts, String(index)], findings));
    return findings;
  }

  if (!value || typeof value !== "object") {
    return findings;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = [...pathParts, key];

    if (typeof child === "string" && shouldScanField(key)) {
      for (const pattern of WARNING_PATTERNS) {
        const matches = [...child.matchAll(pattern.regex)];

        for (const match of matches) {
          findings.push({
            path: childPath.join("."),
            term: pattern.term,
            match: match[0],
          });
        }
      }
    } else if (child && typeof child === "object") {
      scanProseWarnings(child, childPath, findings);
    }
  }

  return findings;
}

function normalizeJoined(value) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function assertTargetContext(report, attempt, participant) {
  if (report.id !== TARGET_REPORT_ID || report.attempt_id !== TARGET_ATTEMPT_ID) {
    throw new Error("Loaded report identity does not match the fixed diagnostic target.");
  }

  if (
    report.test_slug !== TARGET_TEST_SLUG ||
    report.audience !== TARGET_AUDIENCE ||
    report.report_type !== TARGET_REPORT_TYPE ||
    report.source_type !== TARGET_SOURCE_TYPE
  ) {
    throw new Error("Loaded report lane does not match the IPIP HR single-test target.");
  }

  if (attempt?.id !== TARGET_ATTEMPT_ID || !attempt.test_id || attempt.status !== "completed") {
    throw new Error("Target attempt is missing, mismatched, or not completed.");
  }

  if (!participant?.full_name?.toLocaleLowerCase("bs").includes("amra")) {
    throw new Error(`Unexpected target participant: ${participant?.full_name ?? "null"}`);
  }
}

async function loadDryRunContext() {
  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const { getActivePromptVersion } = require("../lib/assessment/prompt-version.ts");
  const { getActiveReportRuntimeConfig } = require("../lib/assessment/report-runtime-config.ts");

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attempt_reports")
    .select(`
      id,
      attempt_id,
      test_slug,
      audience,
      report_type,
      source_type,
      report_status,
      generator_type,
      prompt_version_id,
      model_name,
      attempts!inner(
        id,
        test_id,
        status,
        locale,
        participants!inner(full_name, email)
      )
    `)
    .eq("id", TARGET_REPORT_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load target attempt_report: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Target attempt_report ${TARGET_REPORT_ID} not found.`);
  }

  const attempt = normalizeJoined(data.attempts);
  const participant = normalizeJoined(attempt?.participants);
  assertTargetContext(data, attempt, participant);

  const [activePrompt, runtimeConfig] = await Promise.all([
    getActivePromptVersion(
      {
        testId: attempt.test_id,
        reportType: data.report_type,
        audience: data.audience,
        sourceType: data.source_type,
        generatorType: "openai",
        promptKey: TARGET_PROMPT_KEY,
      },
      {
        locale: attempt.locale ?? "bs",
      },
    ),
    getActiveReportRuntimeConfig({
      reportType: data.report_type,
      audience: data.audience,
      sourceType: data.source_type,
      generatorType: "openai",
    }),
  ]);

  return {
    report: data,
    attempt,
    participant,
    activePrompt,
    runtimeConfig,
  };
}

async function runConfirmedDryRun() {
  installTypeScriptRuntime();

  const { getAiReportConfig, normalizeAiReportModel } = require("../lib/assessment/report-config.ts");
  const {
    buildCompletedAssessmentReportRequest,
  } = require("../lib/assessment/reports.ts");
  const {
    buildPreparedReportGenerationInput,
  } = require("../lib/assessment/report-provider-helpers.ts");
  const {
    createOpenAiReportProvider,
  } = require("../lib/assessment/report-provider-openai.ts");
  const {
    resolveAiReportLanguagePolicy,
  } = require("../lib/assessment/ai-report-language-policy.ts");
  const {
    validateIpipNeo120HrReportV1,
  } = require("../lib/assessment/ipip-neo-120-report-v1.ts");

  const context = await loadDryRunContext();
  const config = getAiReportConfig();
  const dryRunTimeoutMs = resolveDryRunTimeoutMs(config);
  const model = normalizeAiReportModel(
    context.report.model_name ?? context.runtimeConfig?.modelName ?? config.model,
  );
  const promptVersion = context.activePrompt?.version ?? config.promptVersion;
  const promptVersionId = context.activePrompt?.id ?? context.report.prompt_version_id ?? null;

  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required for the confirmed diagnostic call.");
  }

  if (!model) {
    throw new Error("No OpenAI model is configured for the target report lane.");
  }

  const request = await buildCompletedAssessmentReportRequest(
    context.attempt.test_id,
    TARGET_ATTEMPT_ID,
    {
      audience: "hr",
      locale: context.attempt.locale,
      promptVersion,
    },
  );

  if (!request) {
    throw new Error("Target attempt is not eligible for report generation.");
  }

  const preparedInput = buildPreparedReportGenerationInput(request, {
    promptVersionId,
    promptTemplate: context.activePrompt,
  });

  if (preparedInput.reportContract.promptKey !== TARGET_REPORT_CONTRACT) {
    throw new Error(
      `Unexpected report contract: ${preparedInput.reportContract.promptKey}`,
    );
  }

  const provider = createOpenAiReportProvider({
    apiKey: config.openAiApiKey,
    model,
    timeoutMs: dryRunTimeoutMs,
  });
  const generationResult = await provider.generateReport(preparedInput);

  if (!generationResult.ok) {
    throw new Error(`OpenAI dry-run failed: ${generationResult.reason}`);
  }

  const languagePolicy = resolveAiReportLanguagePolicy(request.locale);
  const bhsValidationErrors = languagePolicy
    ? languagePolicy.validateUserFacingOutput(generationResult.report, {
        audience: "hr",
      })
    : [];
  const strictValidation = validateIpipNeo120HrReportV1(generationResult.report, {
    strictContract: true,
    enforceGuardrails: true,
  });

  const diagnostic = {
    generatedAt: new Date().toISOString(),
    persistence: {
      databaseWrites: false,
      lifecycleHelpersUsed: false,
      outputPath: OUTPUT_PATH,
    },
    target: {
      reportId: TARGET_REPORT_ID,
      attemptId: TARGET_ATTEMPT_ID,
      participantName: context.participant.full_name,
      participantEmail: context.participant.email,
      reportStatusAtRead: context.report.report_status,
      reportContract: TARGET_REPORT_CONTRACT,
    },
    generation: {
      provider: provider.type,
      model,
      timeoutMs: dryRunTimeoutMs,
      promptKey: context.activePrompt?.promptKey ?? TARGET_PROMPT_KEY,
      promptVersion,
      promptVersionId,
      promptSource: context.activePrompt ? "db_prompt_version" : "code_default_prompt",
    },
    validation: {
      providerPathIncludesBhsCanonicalizationAndValidation: true,
      providerPathIncludesStrictIpipValidation: true,
      bhs: {
        ok: bhsValidationErrors.length === 0,
        errors: bhsValidationErrors,
      },
      strictIpip: {
        ok: strictValidation.ok,
        errors: strictValidation.ok ? [] : strictValidation.errors,
      },
    },
    warningTerms: scanProseWarnings(generationResult.report),
    generatedReport: generationResult.report,
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(diagnostic, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  console.log(
    JSON.stringify(
      {
        mode: "confirmed OpenAI dry-run",
        reportId: TARGET_REPORT_ID,
        attemptId: TARGET_ATTEMPT_ID,
        provider: provider.type,
        model,
        promptKey: diagnostic.generation.promptKey,
        promptVersion,
        timeoutMs: dryRunTimeoutMs,
        bhsValidationOk: diagnostic.validation.bhs.ok,
        strictIpipValidationOk: diagnostic.validation.strictIpip.ok,
        warningTermCount: diagnostic.warningTerms.length,
        databaseWrites: false,
        lifecycleHelpersUsed: false,
        outputPath: OUTPUT_PATH,
      },
      null,
      2,
    ),
  );
}

async function main() {
  if (!isExecutionConfirmed(process.env)) {
    console.log(JSON.stringify(buildNoCallSummary(), null, 2));
    return;
  }

  await runConfirmedDryRun();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  CONFIRM_ENV,
  TIMEOUT_OVERRIDE_ENV,
  OUTPUT_PATH,
  isExecutionConfirmed,
  buildNoCallSummary,
  resolveDryRunTimeoutMs,
  scanProseWarnings,
};
