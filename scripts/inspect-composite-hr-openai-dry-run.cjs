const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const CONFIRM_ENV = "CONFIRM_COMPOSITE_HR_OPENAI_DRY_RUN";
const INPUT_PATH_ENV = "COMPOSITE_HR_INPUT_SNAPSHOT_PATH";
const TIMEOUT_ENV = "COMPOSITE_HR_OPENAI_DRY_RUN_TIMEOUT_MS";
const OUTPUT_PREFIX = "composite-hr-openai-dry-run";

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
    wouldDo: [
      `Read CompositeHrInputSnapshot JSON from ${INPUT_PATH_ENV} or --input.`,
      "Call the Composite HR OpenAI report request only after explicit confirmation.",
      "Capture raw parsed model output before app validator gates.",
      "Run local contract, source, evidence, language and addressing diagnostics.",
      "Optionally run the isolated Composite HR reviewer diagnostic after validator-on gates pass.",
      "Write diagnostic JSON only under /tmp.",
    ],
    confirmationRequired: `${CONFIRM_ENV}=true`,
    inputPathEnv: INPUT_PATH_ENV,
    optionalTimeoutOverride: TIMEOUT_ENV,
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
    throw new Error("Composite HR OpenAI dry-run inspector requires non-production NODE_ENV.");
  }
}

function parseCliInputPath(argv = process.argv.slice(2)) {
  const inputFlag = argv.find((arg) => arg.startsWith("--input="));

  if (inputFlag) {
    return inputFlag.slice("--input=".length);
  }

  const inputFlagIndex = argv.findIndex((arg) => arg === "--input");

  if (inputFlagIndex >= 0 && argv[inputFlagIndex + 1]) {
    return argv[inputFlagIndex + 1];
  }

  const firstPositional = argv.find((arg) => !arg.startsWith("-"));

  return firstPositional ?? null;
}

function resolveInputSnapshotPath({ env = process.env, argv = process.argv.slice(2) } = {}) {
  return env[INPUT_PATH_ENV] || parseCliInputPath(argv);
}

function readInputSnapshot(filePath, readFile = fs.readFileSync) {
  if (!filePath) {
    throw new Error(
      `Confirmed Composite HR OpenAI dry-run requires ${INPUT_PATH_ENV} or --input pointing to a CompositeHrInputSnapshot JSON file.`,
    );
  }

  let parsed;

  try {
    parsed = JSON.parse(readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Failed to read CompositeHrInputSnapshot JSON from ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return parsed;
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
    assignmentId: input?.generatedFor?.assessmentAssignmentId ?? input?.assessmentAssignment?.id ?? null,
    organizationId: input?.generatedFor?.organizationId ?? null,
    participantId: input?.generatedFor?.participantId ?? null,
    locale: input?.locale ?? null,
    coverage: input?.coverage
      ? {
          requiredCount: input.coverage.requiredCount ?? null,
          completedCount: input.coverage.completedCount ?? null,
          requiredTestSlugs: input.coverage.requiredTestSlugs ?? [],
          completedTestSlugs: input.coverage.completedTestSlugs ?? [],
          missingTestSlugs: input.coverage.missingTestSlugs ?? [],
        }
      : null,
    sourceAttemptIds: Array.isArray(input?.sourceAttempts)
      ? input.sourceAttempts.map((attempt) => attempt?.attemptId).filter(Boolean)
      : [],
    sourceTestSlugs: Array.isArray(input?.sourceAttempts)
      ? input.sourceAttempts.map((attempt) => attempt?.testSlug).filter(Boolean)
      : [],
  };
}

function buildReviewerSkipped(reason) {
  return {
    skipped: true,
    reason,
  };
}

async function runCompositeHrOpenAiDryRun({
  env = process.env,
  argv = process.argv.slice(2),
  now = () => new Date().toISOString(),
  readFile = fs.readFileSync,
  writeFile = fs.writeFileSync,
  chmodFile = fs.chmodSync,
  requestRawReport,
  requestReviewerResult,
  evaluateValidatorBoundary,
  classifyReviewerBoundary,
  installRuntime = installTypeScriptRuntime,
  dumpPath,
} = {}) {
  if (!isExecutionConfirmed(env)) {
    return buildNoCallSummary();
  }

  assertDevelopmentOnly(env);

  const inputPath = resolveInputSnapshotPath({ env, argv });
  const inputSnapshot = readInputSnapshot(inputPath, readFile);
  const timestamp = now();
  const outputPath = dumpPath ?? buildOutputPath(timestamp.replace(/[:.]/g, "-"));
  const model = env.AI_REPORT_MODEL || null;
  const provider = env.AI_REPORT_PROVIDER || "openai";

  if (!requestRawReport || !requestReviewerResult || !evaluateValidatorBoundary) {
    installRuntime();
  }

  const providerModule =
    requestRawReport && requestReviewerResult && evaluateValidatorBoundary
      ? null
      : require("../lib/assessment/composite-hr-report-provider-openai.ts");
  const rawRequester = requestRawReport ?? providerModule.requestOpenAiCompositeHrReportRaw;
  const reviewerRequester =
    requestReviewerResult ?? providerModule.reviewOpenAiCompositeHrReportForDiagnostic;
  const validatorEvaluator =
    evaluateValidatorBoundary ?? providerModule.evaluateCompositeHrReportValidatorBoundary;
  const reviewerClassifier =
    classifyReviewerBoundary ??
    providerModule?.classifyCompositeHrReviewerBoundary ??
    ((review) => ({
      hardIssues: review.approved ? [] : review.issues.filter((issue) => issue.severity === "blocking"),
      warnings: review.approved ? review.issues : review.issues.filter((issue) => issue.severity !== "blocking"),
      hardFailureReasons: review.approved
        ? []
        : review.issues
            .filter((issue) => issue.severity === "blocking")
            .map((issue) => `${issue.severity}:${issue.code}:${issue.message}`),
    }));

  if (!env.OPENAI_API_KEY && !requestRawReport) {
    throw new Error("OPENAI_API_KEY is required for confirmed Composite HR OpenAI dry-run.");
  }

  if (!model && !requestRawReport) {
    throw new Error("AI_REPORT_MODEL is required for confirmed Composite HR OpenAI dry-run.");
  }

  const options = {
    apiKey: env.OPENAI_API_KEY ?? null,
    model,
    timeoutMs: resolveTimeoutMs(env),
    now,
  };
  const rawParsedOutput = await rawRequester(inputSnapshot, options);
  const parseResult = {
    ok: true,
    error: null,
  };
  const validation = validatorEvaluator(inputSnapshot, rawParsedOutput, { now });
  let reviewerResult = buildReviewerSkipped(
    "Production validator-on gates did not pass before reviewer step.",
  );
  let reviewerBoundary = {
    hardIssues: [],
    warnings: [],
    hardFailureReasons: [],
  };
  const failureReasons = [...validation.failureReasons];

  if (validation.validatorOnWouldPersist && validation.canonicalizedOutput) {
    try {
      const review = await reviewerRequester(inputSnapshot, validation.canonicalizedOutput, options);
      reviewerBoundary = reviewerClassifier(review);
      reviewerResult = {
        skipped: false,
        ok: true,
        approved: review.approved,
        issues: review.issues,
        summary: review.summary,
        hardIssues: reviewerBoundary.hardIssues,
        warnings: reviewerBoundary.warnings,
      };

      if (reviewerBoundary.hardIssues.length > 0) {
        failureReasons.push(`reviewer hard rejection: ${reviewerBoundary.hardFailureReasons.join("; ")}`);
      }
    } catch (error) {
      reviewerResult = {
        skipped: false,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
      failureReasons.push(`reviewer failed: ${reviewerResult.error}`);
    }
  }

  const reviewerHardGateOk =
    reviewerResult.skipped === false &&
    reviewerResult.ok === true &&
    reviewerBoundary.hardIssues.length === 0;
  const hardGateWouldPersist = validation.hardGateWouldPersist ?? validation.validatorOnWouldPersist;
  const productionWouldPersist = hardGateWouldPersist && reviewerHardGateOk;
  const validatorOnWouldPersist = hardGateWouldPersist;

  if (hardGateWouldPersist && !productionWouldPersist && failureReasons.length === 0) {
    failureReasons.push("reviewer did not pass hard production boundary.");
  }

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
      inputSnapshotPath: inputPath,
    },
    inputSummary: summarizeInput(inputSnapshot),
    rawParsedOutput,
    parseResult,
    canonicalizedOutput: validation.canonicalizedOutput,
    contractValidationResult: validation.contractValidationResult,
    languageQualityResult: validation.languageQualityResult,
    languageQualityHardIssues: validation.languageQualityHardIssues ?? [],
    languageQualityWarnings: validation.languageQualityWarnings ?? [],
    reviewerResult,
    styleReviewerWarnings: reviewerBoundary.warnings,
    validatorDiagnostics: {
      evidenceLockedValidationResult: validation.evidenceLockedValidationResult,
      sourceIntegrityResult: validation.sourceIntegrityResult,
      evidenceIntegrityResult: validation.evidenceIntegrityResult,
      hardSafetyResult: validation.hardSafetyResult,
      addressingFormResult: validation.addressingFormResult,
      normalizedValidationResult: validation.normalizedValidationResult,
    },
    validatorOffWouldHaveRawOutput: parseResult.ok,
    hardGateWouldPersist,
    validatorOnWouldPersist,
    productionWouldPersist,
    failureReasons,
    humanReviewHints: [
      "summary",
      "integratedSignals",
      "interviewGuidance",
      "onboardingGuidance",
      "limitations",
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
  const result = await runCompositeHrOpenAiDryRun();

  console.log(
    JSON.stringify(
      result.confirmed === false
        ? result
        : {
            metadata: result.metadata,
            inputSummary: result.inputSummary,
            parseResult: result.parseResult,
            contractValidationResult: result.contractValidationResult,
            languageQualityResult: result.languageQualityResult,
            languageQualityHardIssues: result.languageQualityHardIssues,
            languageQualityWarnings: result.languageQualityWarnings,
            reviewerResult: result.reviewerResult,
            styleReviewerWarnings: result.styleReviewerWarnings,
            hardGateWouldPersist: result.hardGateWouldPersist,
            validatorOnWouldPersist: result.validatorOnWouldPersist,
            productionWouldPersist: result.productionWouldPersist,
            failureReasons: result.failureReasons,
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
  CONFIRM_ENV,
  INPUT_PATH_ENV,
  TIMEOUT_ENV,
  buildNoCallSummary,
  buildOutputPath,
  installTypeScriptRuntime,
  isExecutionConfirmed,
  readInputSnapshot,
  resolveInputSnapshotPath,
  runCompositeHrOpenAiDryRun,
};
