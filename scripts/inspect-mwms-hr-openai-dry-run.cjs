const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const CONFIRM_ENV = "CONFIRM_MWMS_HR_OPENAI_DRY_RUN";
const CAPTURE_PATH_ENV = "MWMS_HR_INPUT_CAPTURE_PATH";
const SKIP_BHS_GATE_ENV = "MWMS_HR_DRY_RUN_SKIP_BHS_GATE";
const TIMEOUT_ENV = "MWMS_HR_OPENAI_DRY_RUN_TIMEOUT_MS";
const OUTPUT_PREFIX = "mwms-hr-openai-dry-run";

function isExecutionConfirmed(env = process.env) {
  return env[CONFIRM_ENV] === "true";
}

function buildTimestamp(now = () => new Date().toISOString()) {
  return now().replace(/[:.]/g, "-");
}

function buildOutputPath(timestamp = buildTimestamp()) {
  return path.join(os.tmpdir(), `${OUTPUT_PREFIX}-${timestamp}.json`);
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
      `Read a production-equivalent MWMS HR AI input capture from ${CAPTURE_PATH_ENV} or --capture.`,
      "Refuse missing, invalid, reconstructed, or synthetic capture artifacts.",
      "Call the captured OpenAI structured request only after explicit confirmation.",
      "Run local parse, BHS, and MWMS validator diagnostics without DB writes.",
      `Optional diagnostic-only bypass: ${SKIP_BHS_GATE_ENV}=true ignores BHS as a persistence blocker in this script only.`,
      "Write diagnostic JSON only under /tmp.",
    ],
    confirmationRequired: `${CONFIRM_ENV}=true`,
    requiredCapturePathEnv: CAPTURE_PATH_ENV,
    optionalTimeoutOverride: TIMEOUT_ENV,
  };
}

function shouldSkipBhsGateForDiagnostic(env = process.env) {
  return env[SKIP_BHS_GATE_ENV] === "true";
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
    throw new Error("MWMS HR OpenAI dry-run inspector requires non-production NODE_ENV.");
  }
}

function parseCliCapturePath(argv = process.argv.slice(2)) {
  const flag = argv.find((arg) => arg.startsWith("--capture="));

  if (flag) {
    return flag.slice("--capture=".length);
  }

  const index = argv.findIndex((arg) => arg === "--capture");

  if (index >= 0 && argv[index + 1]) {
    return argv[index + 1];
  }

  return null;
}

function resolveInputCapturePath({ env = process.env, argv = process.argv.slice(2) } = {}) {
  return env[CAPTURE_PATH_ENV] || parseCliCapturePath(argv);
}

function readJsonFile(filePath, label, readFile = fs.readFileSync) {
  try {
    return JSON.parse(readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Failed to read ${label} JSON from ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function resolveTimeoutMs(env = process.env) {
  const raw = env[TIMEOUT_ENV];

  if (!raw) {
    return 120000;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${TIMEOUT_ENV} must be a positive integer in milliseconds.`);
  }

  return parsed;
}

function summarizeInput(input) {
  return {
    attemptId: input?.attemptId ?? null,
    testId: input?.testId ?? null,
    testSlug: input?.testSlug ?? null,
    audience: input?.audience ?? null,
    sourceType: input?.sourceType ?? null,
    locale: input?.locale ?? null,
    dimensions: Array.isArray(input?.dimensions)
      ? input.dimensions.map((dimension) => ({
          code: dimension.code ?? null,
          rawScore: dimension.rawScore ?? null,
          band: dimension.band ?? null,
        }))
      : null,
  };
}

function assertCaptureMetadata(capture, capturePath) {
  const metadata = capture?.metadata ?? {};
  const reconstructedInputUsed = metadata.reconstructedInputUsed;

  if (reconstructedInputUsed !== false) {
    throw new Error(
      `Invalid MWMS HR AI input capture ${capturePath}: MWMS input capture must not use reconstructed input. Expected metadata.reconstructedInputUsed=false, received ${JSON.stringify(
        reconstructedInputUsed,
      )}. Reconstructed or synthetic input is not acceptable audit evidence.`,
    );
  }

  const diagnosticInputSource = metadata.diagnosticInputSource;

  if (
    typeof diagnosticInputSource !== "string" ||
    !diagnosticInputSource.includes("buildCompletedAssessmentReportRequest") ||
    !diagnosticInputSource.includes("buildPreparedReportGenerationInput")
  ) {
    throw new Error(
      `Invalid MWMS HR AI input capture ${capturePath}: diagnosticInputSource must reference production-equivalent buildCompletedAssessmentReportRequest + buildPreparedReportGenerationInput path. Reconstructed or synthetic input is not acceptable audit evidence.`,
    );
  }

  const checks = [
    ["metadata.reportFamily", metadata.reportFamily, "mwms"],
    ["metadata.testSlug", metadata.testSlug, "mwms_v1"],
    ["metadata.reportType", metadata.reportType, "individual"],
    ["metadata.audience", metadata.audience, "hr"],
    ["metadata.sourceType", metadata.sourceType, "single_test"],
    ["metadata.openAiCalled", metadata.openAiCalled, false],
    ["metadata.databaseWrites", metadata.databaseWrites, false],
    ["metadata.reportRegenerated", metadata.reportRegenerated, false],
    ["metadata.productionFlowChanged", metadata.productionFlowChanged, false],
  ];

  for (const [label, actual, expected] of checks) {
    if (actual !== expected) {
      throw new Error(
        `Invalid MWMS HR AI input capture ${capturePath}: expected ${label}=${JSON.stringify(
          expected,
        )}, received ${JSON.stringify(actual)}.`,
      );
    }
  }

  if (capture?.reportContract?.promptKey !== "mwms_hr_report_v1") {
    throw new Error(
      `Invalid MWMS HR AI input capture ${capturePath}: expected reportContract.promptKey=mwms_hr_report_v1.`,
    );
  }

  if (capture?.reportContract?.schemaName !== "mwms-hr-report-v1") {
    throw new Error(
      `Invalid MWMS HR AI input capture ${capturePath}: expected reportContract.schemaName=mwms-hr-report-v1.`,
    );
  }

  if (!Array.isArray(capture?.promptInput?.dimensions) || capture.promptInput.dimensions.length !== 6) {
    throw new Error(
      `Invalid MWMS HR AI input capture ${capturePath}: missing production promptInput.dimensions.`,
    );
  }

  if (!capture?.preparedOpenAiRequest?.requestBody) {
    throw new Error(
      `Invalid MWMS HR AI input capture ${capturePath}: missing preparedOpenAiRequest.requestBody.`,
    );
  }
}

function readInputCapture(capturePath, readFile = fs.readFileSync) {
  if (!capturePath) {
    throw new Error(
      `Confirmed MWMS HR OpenAI dry-run requires ${CAPTURE_PATH_ENV} or --capture pointing to a production-equivalent MWMS HR capture JSON file.`,
    );
  }

  const capture = readJsonFile(capturePath, "MWMS HR AI input capture", readFile);
  assertCaptureMetadata(capture, capturePath);

  return {
    inputSource: "single_test_hr_ai_input_capture",
    capturePath,
    captureMetadata: capture.metadata,
    inputSnapshot: capture.promptInput,
    preparedOpenAiRequest: capture.preparedOpenAiRequest,
    model: capture.metadata?.model ?? capture.preparedOpenAiRequest?.requestBody?.model ?? null,
    provider: capture.metadata?.provider ?? "openai",
  };
}

async function requestOpenAiFromCapturedRequest(capturedRequestBody, options) {
  if (!options.apiKey) {
    throw new Error("Missing required env var: OPENAI_API_KEY");
  }

  if (!capturedRequestBody?.model) {
    throw new Error("Captured MWMS HR OpenAI request body is missing model.");
  }

  const timeoutMs = options.timeoutMs ?? 120000;
  const controller = new AbortController();
  const timeout = setTimeout(
    () =>
      controller.abort(
        new Error(`OpenAI MWMS HR capture dry-run timed out after ${timeoutMs}ms.`),
      ),
    timeoutMs,
  );

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(capturedRequestBody),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI MWMS HR capture dry-run request failed with status ${response.status}: ${errorText}`);
    }

    const responsePayload = await response.json();
    const content = responsePayload?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      throw new Error("OpenAI MWMS HR capture dry-run response did not contain structured content.");
    }

    return JSON.parse(content);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`OpenAI MWMS HR capture dry-run failed: ${error.message}`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function mapMwmsErrors(errors) {
  return errors.map((error) => ({
    message: error,
    category: classifyMwmsValidationError(error),
  }));
}

function classifyMwmsValidationError(error) {
  if (/Forbidden phrase|hire|no-hire|hiring score|fit score|dijagnoz|klinick|kliničk|patolog|IPIP|SAFRAN/i.test(error)) {
    return "safety";
  }

  if (/Score mutation detected|Expected deterministic order|rawScore|bandLabel|band: Expected|testSlug|sourceType|audience|contractVersion|reportType|locale/i.test(error)) {
    return "source_integrity";
  }

  if (/Expected object|Unexpected property|Expected exactly|Expected non-empty string|Expected canonical MWMS dimension code|Expected supported report locale|<root>/i.test(error)) {
    return "structural";
  }

  return "unknown";
}

function buildFailureReasons({
  bhsLanguagePolicyResult,
  mwmsValidatorResult,
}) {
  const reasons = [];

  if (bhsLanguagePolicyResult?.ok === false) {
    for (const error of bhsLanguagePolicyResult.errors) {
      reasons.push(`bhs_language:${error.path}: ${error.message}`);
    }
  }

  if (mwmsValidatorResult?.ok === false) {
    for (const error of mwmsValidatorResult.errors) {
      reasons.push(`mwms_validator:${error.category}:${error.message}`);
    }
  }

  return reasons;
}

function evaluateMwmsHrDryRunDiagnostic(inputSnapshot, rawParsedOutput, dependencies, options = {}) {
  const {
    resolveAiReportLanguagePolicy,
    validateMwmsHrReportV1,
  } = dependencies;
  const skipBhsGateForDiagnostic = options.skipBhsGateForDiagnostic === true;
  const languagePolicy = resolveAiReportLanguagePolicy(inputSnapshot?.locale);
  const canonicalizedOutput = languagePolicy
    ? languagePolicy.canonicalizeUserFacingOutput(rawParsedOutput)
    : rawParsedOutput;
  const bhsErrors = languagePolicy
    ? languagePolicy.validateUserFacingOutput(canonicalizedOutput, { audience: "hr" })
    : [];
  const bhsLanguagePolicyResult = languagePolicy
    ? {
        skipped: false,
        ok: bhsErrors.length === 0,
        errors: bhsErrors,
      }
    : {
        skipped: true,
        reason: "No BHS language policy for input locale.",
      };
  const validation = validateMwmsHrReportV1(canonicalizedOutput, {
    expectedInput: inputSnapshot,
  });
  const mwmsValidatorResult = validation.ok
    ? {
        ok: true,
        errors: [],
      }
    : {
        ok: false,
        errors: mapMwmsErrors(validation.errors),
      };
  const hardFailure = bhsLanguagePolicyResult.skipped === false && !bhsLanguagePolicyResult.ok;
  const bhsGateWouldHaveBlocked = hardFailure;
  const diagnosticWouldPersistWithoutBhsGate = mwmsValidatorResult.ok;
  const hardGateWouldPersist = mwmsValidatorResult.ok && (skipBhsGateForDiagnostic ? true : !hardFailure);
  const validatorOnWouldPersist = hardGateWouldPersist;
  const failureReasons = buildFailureReasons({
    bhsLanguagePolicyResult,
    mwmsValidatorResult,
  });

  return {
    rawParsedOutput,
    parseResult: {
      ok: true,
      error: null,
    },
    canonicalizedOutput,
    contractValidationResult: mwmsValidatorResult,
    bhsLanguagePolicyResult,
    mwmsValidatorResult,
    bhsGateSkippedForDiagnostic: skipBhsGateForDiagnostic,
    bhsGateWouldHaveBlocked,
    diagnosticWouldPersistWithoutBhsGate,
    hardGateWouldPersist,
    validatorOnWouldPersist,
    phraseGateWarnings: [],
    phraseGateFailures: [],
    failureReasons,
    warningReasons: [],
    diagnosticNotes: [
      "MWMS diagnostic is read-only and does not reduce the current MWMS validator boundary.",
      skipBhsGateForDiagnostic
        ? `BHS gate skip is diagnostic-only in this script via ${SKIP_BHS_GATE_ENV}=true and does not change production flow.`
        : "Default mode keeps BHS gate active for MWMS diagnostic persistence decisions.",
    ],
  };
}

function loadDiagnosticDependencies() {
  const {
    resolveAiReportLanguagePolicy,
  } = require("../lib/assessment/ai-report-language-policy.ts");
  const {
    validateMwmsHrReportV1,
  } = require("../lib/assessment/mwms-hr-report-v1.ts");

  return {
    resolveAiReportLanguagePolicy,
    validateMwmsHrReportV1,
  };
}

async function runMwmsHrOpenAiDryRun({
  env = process.env,
  argv = process.argv.slice(2),
  now = () => new Date().toISOString(),
  readFile = fs.readFileSync,
  writeFile = fs.writeFileSync,
  chmodFile = fs.chmodSync,
  requestRawReport,
  evaluateDiagnostic,
  installRuntime = installTypeScriptRuntime,
  dumpPath,
} = {}) {
  if (!isExecutionConfirmed(env)) {
    return buildNoCallSummary();
  }

  assertDevelopmentOnly(env);

  const capturePath = resolveInputCapturePath({ env, argv });
  const captureInput = readInputCapture(capturePath, readFile);
  const timestamp = now();
  const outputPath = dumpPath ?? buildOutputPath(timestamp.replace(/[:.]/g, "-"));
  const model = captureInput.model ?? null;
  const provider = captureInput.provider ?? "openai";
  const skipBhsGateForDiagnostic = shouldSkipBhsGateForDiagnostic(env);

  if (!requestRawReport || !evaluateDiagnostic) {
    installRuntime();
  }

  const rawRequester =
    requestRawReport ??
    ((_input, options) =>
      requestOpenAiFromCapturedRequest(captureInput.preparedOpenAiRequest.requestBody, options));

  if (!env.OPENAI_API_KEY && !requestRawReport) {
    throw new Error("OPENAI_API_KEY is required for confirmed MWMS HR OpenAI dry-run.");
  }

  if (!model && !requestRawReport) {
    throw new Error("Captured MWMS HR request must contain model metadata or requestBody.model.");
  }

  const rawParsedOutput = await rawRequester(captureInput.inputSnapshot, {
    apiKey: env.OPENAI_API_KEY ?? null,
    model,
    timeoutMs: resolveTimeoutMs(env),
  });
  const diagnosticEvaluator =
    evaluateDiagnostic ??
    ((input, output, diagnosticOptions) =>
      evaluateMwmsHrDryRunDiagnostic(input, output, loadDiagnosticDependencies(), diagnosticOptions));
  const diagnostic = diagnosticEvaluator(captureInput.inputSnapshot, rawParsedOutput, {
    skipBhsGateForDiagnostic,
  });
  const artifact = {
    metadata: {
      timestamp,
      model,
      provider,
      confirmed: true,
      openAiCalled: true,
      databaseWrites: false,
      reportRegenerated: false,
      productionFlowChanged: false,
      inputSource: captureInput.inputSource,
      capturePath: captureInput.capturePath,
      captureMetadata: captureInput.captureMetadata,
      bhsGateSkippedForDiagnostic: skipBhsGateForDiagnostic,
    },
    inputSource: captureInput.inputSource,
    capturePath: captureInput.capturePath,
    captureMetadata: captureInput.captureMetadata,
    inputSummary: summarizeInput(captureInput.inputSnapshot),
    rawParsedOutput,
    parseResult: diagnostic.parseResult,
    canonicalizedOutput: diagnostic.canonicalizedOutput,
    contractValidationResult: diagnostic.contractValidationResult,
    bhsLanguagePolicyResult: diagnostic.bhsLanguagePolicyResult,
    mwmsValidatorResult: diagnostic.mwmsValidatorResult,
    bhsGateSkippedForDiagnostic: diagnostic.bhsGateSkippedForDiagnostic,
    bhsGateWouldHaveBlocked: diagnostic.bhsGateWouldHaveBlocked,
    diagnosticWouldPersistWithoutBhsGate: diagnostic.diagnosticWouldPersistWithoutBhsGate,
    hardGateWouldPersist: diagnostic.hardGateWouldPersist,
    validatorOnWouldPersist: diagnostic.validatorOnWouldPersist,
    phraseGateWarnings: diagnostic.phraseGateWarnings,
    phraseGateFailures: diagnostic.phraseGateFailures,
    failureReasons: diagnostic.failureReasons,
    warningReasons: diagnostic.warningReasons,
    diagnosticNotes: diagnostic.diagnosticNotes,
    humanReviewHints: [
      "key_motivational_drivers",
      "potential_friction_points",
      "work_context_hypotheses",
      "manager_support_guidance",
      "interview_questions",
      "onboarding_recommendations",
      "decision_support_note",
      "interpretation_note",
    ],
  };

  writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { mode: 0o600 });
  chmodFile(outputPath, 0o600);

  return {
    ...artifact,
    dumpPath: outputPath,
  };
}

async function main() {
  const result = await runMwmsHrOpenAiDryRun();

  console.log(
    JSON.stringify(
      result.confirmed === false
        ? result
        : {
            metadata: result.metadata,
            inputSummary: result.inputSummary,
            parseResult: result.parseResult,
            contractValidationResult: result.contractValidationResult,
            bhsLanguagePolicyResult: result.bhsLanguagePolicyResult,
            mwmsValidatorResult: result.mwmsValidatorResult,
            hardGateWouldPersist: result.hardGateWouldPersist,
            validatorOnWouldPersist: result.validatorOnWouldPersist,
            phraseGateWarnings: result.phraseGateWarnings,
            phraseGateFailures: result.phraseGateFailures,
            failureReasons: result.failureReasons,
            warningReasons: result.warningReasons,
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
  CAPTURE_PATH_ENV,
  CONFIRM_ENV,
  SKIP_BHS_GATE_ENV,
  TIMEOUT_ENV,
  buildNoCallSummary,
  buildOutputPath,
  evaluateMwmsHrDryRunDiagnostic,
  installTypeScriptRuntime,
  isExecutionConfirmed,
  readInputCapture,
  resolveInputCapturePath,
  runMwmsHrOpenAiDryRun,
  shouldSkipBhsGateForDiagnostic,
};
