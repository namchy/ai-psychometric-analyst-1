const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const CONFIRM_ENV = "CONFIRM_SAFRAN_HR_OPENAI_DRY_RUN";
const INPUT_PATH_ENV = "SAFRAN_HR_INPUT_SNAPSHOT_PATH";
const TIMEOUT_ENV = "SAFRAN_HR_OPENAI_DRY_RUN_TIMEOUT_MS";
const OUTPUT_PREFIX = "safran-hr-openai-dry-run";

const PHRASE_GATE_PATTERNS = [
  /Must frame the interpretation as a cautious HR hypothesis/i,
  /Missing guidance to read the signal with experience, interview and role context/i,
  /REQUIRED_HYPOTHESIS_PATTERNS/i,
  /rezultat može ukazivati/i,
  /u ovom setu zadataka/i,
  /ovaj signal treba provjeriti/i,
  /korisno je provjeriti kroz intervju ili radni zadatak/i,
  /čitati zajedno sa iskustvom, intervjuom i kontekstom uloge/i,
  /hipoteza za provjeru/i,
];

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
      `Read SafranHrReportInput JSON from ${INPUT_PATH_ENV} or --input.`,
      "Call the SAFRAN HR OpenAI report request only after explicit confirmation.",
      "Capture raw parsed model output before BHS and SAFRAN validator gates.",
      "Run local BHS policy and SAFRAN validator diagnostics.",
      "Classify structural/safety/source failures separately from cautious phrase/prose failures.",
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
    throw new Error("SAFRAN HR OpenAI dry-run inspector requires non-production NODE_ENV.");
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
      `Confirmed SAFRAN HR OpenAI dry-run requires ${INPUT_PATH_ENV} or --input pointing to a SafranHrReportInput JSON file.`,
    );
  }

  try {
    return JSON.parse(readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Failed to read SafranHrReportInput JSON from ${filePath}: ${
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
    attemptId: input?.attemptId ?? input?.sourceAttemptId ?? null,
    reportId: input?.reportId ?? null,
    testSlug: input?.test?.slug ?? null,
    audience: input?.test?.audience ?? null,
    sourceType: input?.test?.sourceType ?? null,
    locale: input?.test?.locale ?? null,
    scores: input?.scores
      ? {
          overall: input.scores.overall?.scoreLabel ?? null,
          verbal: input.scores.verbal?.scoreLabel ?? null,
          figural: input.scores.figural?.scoreLabel ?? null,
          numeric: input.scores.numeric?.scoreLabel ?? null,
        }
      : null,
  };
}

function mapErrors(errors) {
  return errors.map((error) => ({
    message: error,
    category: classifySafranValidationError(error),
  }));
}

function classifySafranValidationError(error) {
  if (PHRASE_GATE_PATTERNS.some((pattern) => pattern.test(error))) {
    return "phrase_prose";
  }

  if (/Forbidden phrase|safetyChecks|hire|no-hire|IQ|percentile|percentil|norma|diagnos|clinical|medic/i.test(error)) {
    return "safety";
  }

  if (/Must match deterministic input|sourceType|testSlug|audience|locale|score|mutation|noScoreMutation/i.test(error)) {
    return "source_integrity";
  }

  if (/Expected|Unexpected property|non-empty|<root>|reportType|generatedLanguage|executiveSummary|cognitiveSignals|pointsOfCaution|interviewQuestions|onboardingGuidance|interpretationLimits/i.test(error)) {
    return "structural";
  }

  return "unknown";
}

function buildFailureReasons({
  bhsLanguagePolicyResult,
  safranValidatorResult,
  hardGateWouldPersist,
  validatorOnWouldPersist,
}) {
  const reasons = [];

  if (bhsLanguagePolicyResult?.ok === false) {
    for (const error of bhsLanguagePolicyResult.errors) {
      reasons.push(`bhs_language:${error.path}: ${error.message}`);
    }
  }

  if (safranValidatorResult?.ok === false) {
    for (const error of safranValidatorResult.errors) {
      reasons.push(`safran_validator:${error.category}:${error.message}`);
    }
  }

  if (hardGateWouldPersist && !validatorOnWouldPersist) {
    reasons.push("validator blocks persistence due to phrase/prose gate only.");
  }

  return reasons;
}

function evaluateSafranHrDryRunDiagnostic(inputSnapshot, rawParsedOutput, dependencies) {
  const {
    resolveAiReportLanguagePolicy,
    validateSafranHrReport,
  } = dependencies;
  const languagePolicy = resolveAiReportLanguagePolicy(inputSnapshot?.test?.locale);
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
  const validation = validateSafranHrReport(canonicalizedOutput, {
    expectedInput: inputSnapshot,
  });
  const safranValidatorResult = validation.ok
    ? {
        ok: true,
        errors: [],
      }
    : {
        ok: false,
        errors: mapErrors(validation.errors),
      };
  const phraseGateFailures = safranValidatorResult.errors.filter(
    (error) => error.category === "phrase_prose",
  );
  const hardSafranFailures = safranValidatorResult.errors.filter(
    (error) => error.category !== "phrase_prose",
  );
  const bhsHardFailure = bhsLanguagePolicyResult.skipped === false && !bhsLanguagePolicyResult.ok;
  const hardGateWouldPersist = hardSafranFailures.length === 0 && !bhsHardFailure;
  const validatorOnWouldPersist =
    safranValidatorResult.ok &&
    (bhsLanguagePolicyResult.skipped === true || bhsLanguagePolicyResult.ok);
  const warningReasons = phraseGateFailures.map((error) => error.message);
  const failureReasons = buildFailureReasons({
    bhsLanguagePolicyResult,
    safranValidatorResult,
    hardGateWouldPersist,
    validatorOnWouldPersist,
  });

  return {
    rawParsedOutput,
    parseResult: {
      ok: true,
      error: null,
    },
    canonicalizedOutput,
    contractValidationResult: safranValidatorResult,
    bhsLanguagePolicyResult,
    safranValidatorResult,
    hardGateWouldPersist,
    validatorOnWouldPersist,
    phraseGateWarnings: hardGateWouldPersist && phraseGateFailures.length > 0
      ? phraseGateFailures
      : [],
    phraseGateFailures,
    failureReasons,
    warningReasons,
    diagnosticNotes: [
      "hardGateWouldPersist ignores cautious phrase/prose-only failures for diagnostic comparison.",
      "validatorOnWouldPersist reflects the current SAFRAN production validator result.",
    ],
  };
}

function loadDiagnosticDependencies() {
  const {
    resolveAiReportLanguagePolicy,
  } = require("../lib/assessment/ai-report-language-policy.ts");
  const {
    validateSafranHrReport,
  } = require("../lib/assessment/safran-hr-report-v1.ts");

  return {
    resolveAiReportLanguagePolicy,
    validateSafranHrReport,
  };
}

async function runSafranHrOpenAiDryRun({
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

  const inputPath = resolveInputSnapshotPath({ env, argv });
  const inputSnapshot = readInputSnapshot(inputPath, readFile);
  const timestamp = now();
  const outputPath = dumpPath ?? buildOutputPath(timestamp.replace(/[:.]/g, "-"));
  const model = env.AI_REPORT_MODEL || null;
  const provider = env.AI_REPORT_PROVIDER || "openai";

  if (!requestRawReport || !evaluateDiagnostic) {
    installRuntime();
  }

  const providerModule = requestRawReport
    ? null
    : require("../lib/assessment/report-provider-openai.ts");
  const rawRequester = requestRawReport ?? providerModule.requestOpenAiSafranHrReportRaw;

  if (!env.OPENAI_API_KEY && !requestRawReport) {
    throw new Error("OPENAI_API_KEY is required for confirmed SAFRAN HR OpenAI dry-run.");
  }

  if (!model && !requestRawReport) {
    throw new Error("AI_REPORT_MODEL is required for confirmed SAFRAN HR OpenAI dry-run.");
  }

  const rawParsedOutput = await rawRequester(inputSnapshot, {
    apiKey: env.OPENAI_API_KEY ?? null,
    model,
    timeoutMs: resolveTimeoutMs(env),
  });
  const diagnosticEvaluator =
    evaluateDiagnostic ??
    ((input, output) => evaluateSafranHrDryRunDiagnostic(input, output, loadDiagnosticDependencies()));
  const diagnostic = diagnosticEvaluator(inputSnapshot, rawParsedOutput);
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
    parseResult: diagnostic.parseResult,
    canonicalizedOutput: diagnostic.canonicalizedOutput,
    contractValidationResult: diagnostic.contractValidationResult,
    bhsLanguagePolicyResult: diagnostic.bhsLanguagePolicyResult,
    safranValidatorResult: diagnostic.safranValidatorResult,
    hardGateWouldPersist: diagnostic.hardGateWouldPersist,
    validatorOnWouldPersist: diagnostic.validatorOnWouldPersist,
    phraseGateWarnings: diagnostic.phraseGateWarnings,
    phraseGateFailures: diagnostic.phraseGateFailures,
    failureReasons: diagnostic.failureReasons,
    warningReasons: diagnostic.warningReasons,
    diagnosticNotes: diagnostic.diagnosticNotes,
    humanReviewHints: [
      "executiveSummary",
      "cognitiveSignals",
      "pointsOfCaution",
      "interviewQuestions",
      "onboardingGuidance",
      "interpretationLimits",
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
  const result = await runSafranHrOpenAiDryRun();

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
            safranValidatorResult: result.safranValidatorResult,
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
  CONFIRM_ENV,
  INPUT_PATH_ENV,
  TIMEOUT_ENV,
  buildNoCallSummary,
  buildOutputPath,
  evaluateSafranHrDryRunDiagnostic,
  installTypeScriptRuntime,
  isExecutionConfirmed,
  readInputSnapshot,
  resolveInputSnapshotPath,
  runSafranHrOpenAiDryRun,
};
