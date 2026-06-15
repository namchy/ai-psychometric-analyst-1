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
const CAPTURE_PATH_ENV = "SAFRAN_HR_INPUT_CAPTURE_PATH";
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
      `Prefer a production-equivalent single-test HR AI input capture from ${CAPTURE_PATH_ENV} or --capture.`,
      `Legacy/dev fallback: read SafranHrReportInput JSON from ${INPUT_PATH_ENV} or --input. This is not audit proof.`,
      "Call the SAFRAN HR OpenAI report request only after explicit confirmation.",
      "Capture raw parsed model output before BHS and SAFRAN validator gates.",
      "Run local BHS policy and SAFRAN validator diagnostics.",
      "Classify structural/safety/source failures separately from cautious phrase/prose failures.",
      "Write diagnostic JSON only under /tmp.",
    ],
    confirmationRequired: `${CONFIRM_ENV}=true`,
    preferredCapturePathEnv: CAPTURE_PATH_ENV,
    inputPathEnv: INPUT_PATH_ENV,
    legacyInputPathNote: "SAFRAN_HR_INPUT_SNAPSHOT_PATH/--input accepts dev JSON input only; use capture path for audit mode.",
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
  return parseCliPathValue(argv, "input");
}

function parseCliCapturePath(argv = process.argv.slice(2)) {
  return parseCliPathValue(argv, "capture");
}

function parseCliPathValue(argv, name) {
  const inputFlag = argv.find((arg) => arg.startsWith(`--${name}=`));

  if (inputFlag) {
    return inputFlag.slice(`--${name}=`.length);
  }

  const inputFlagIndex = argv.findIndex((arg) => arg === `--${name}`);

  if (inputFlagIndex >= 0 && argv[inputFlagIndex + 1]) {
    return argv[inputFlagIndex + 1];
  }

  return null;
}

function resolveInputSnapshotPath({ env = process.env, argv = process.argv.slice(2) } = {}) {
  return env[INPUT_PATH_ENV] || parseCliInputPath(argv) || argv.find((arg) => !arg.startsWith("-")) || null;
}

function resolveInputCapturePath({ env = process.env, argv = process.argv.slice(2) } = {}) {
  return env[CAPTURE_PATH_ENV] || parseCliCapturePath(argv);
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

function assertCaptureMetadata(capture, capturePath) {
  const metadata = capture?.metadata ?? {};
  const reconstructedInputUsed = metadata.reconstructedInputUsed;

  if (reconstructedInputUsed !== false) {
    throw new Error(
      `Invalid SAFRAN HR AI input capture ${capturePath}: SAFRAN input capture must not use reconstructed input. Expected metadata.reconstructedInputUsed=false, received ${JSON.stringify(
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
      `Invalid SAFRAN HR AI input capture ${capturePath}: diagnosticInputSource must reference production-equivalent buildCompletedAssessmentReportRequest + buildPreparedReportGenerationInput path. Reconstructed or synthetic input is not acceptable audit evidence.`,
    );
  }

  const checks = [
    ["metadata.reportFamily", metadata.reportFamily, "safran"],
    ["metadata.testSlug", metadata.testSlug, "safran_v1"],
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
        `Invalid SAFRAN HR AI input capture ${capturePath}: expected ${label}=${JSON.stringify(
          expected,
        )}, received ${JSON.stringify(actual)}.`,
      );
    }
  }

  if (capture?.reportContract?.promptKey !== "safran_hr_report_v1") {
    throw new Error(
      `Invalid SAFRAN HR AI input capture ${capturePath}: expected reportContract.promptKey=safran_hr_report_v1.`,
    );
  }

  if (capture?.reportContract?.schemaName !== "safran-hr-report-v1") {
    throw new Error(
      `Invalid SAFRAN HR AI input capture ${capturePath}: expected reportContract.schemaName=safran-hr-report-v1.`,
    );
  }

  if (!capture?.promptInput?.test) {
    throw new Error(
      `Invalid SAFRAN HR AI input capture ${capturePath}: missing production promptInput.`,
    );
  }

  if (!capture?.preparedOpenAiRequest?.requestBody) {
    throw new Error(
      `Invalid SAFRAN HR AI input capture ${capturePath}: missing preparedOpenAiRequest.requestBody.`,
    );
  }
}

function readInputCapture(capturePath, readFile = fs.readFileSync) {
  if (!capturePath) {
    return null;
  }

  const capture = readJsonFile(capturePath, "SAFRAN HR AI input capture", readFile);
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
    throw new Error("Captured SAFRAN HR OpenAI request body is missing model.");
  }

  const timeoutMs = options.timeoutMs ?? 120000;
  const controller = new AbortController();
  const timeout = setTimeout(
    () =>
      controller.abort(
        new Error(`OpenAI SAFRAN HR capture dry-run timed out after ${timeoutMs}ms.`),
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
      throw new Error(`OpenAI SAFRAN HR capture dry-run request failed with status ${response.status}: ${errorText}`);
    }

    const responsePayload = await response.json();
    const content = responsePayload?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      throw new Error("OpenAI SAFRAN HR capture dry-run response did not contain structured content.");
    }

    return JSON.parse(content);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`OpenAI SAFRAN HR capture dry-run failed: ${error.message}`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
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
    return /safetyChecks/i.test(error) ? "structural" : "safety_heuristic";
  }

  if (/Must match deterministic input|sourceType|testSlug|audience|locale|score|mutation|noScoreMutation/i.test(error)) {
    return "source_integrity";
  }

  if (/Expected|Unexpected property|non-empty|<root>|reportType|generatedLanguage|executiveSummary|cognitiveSignals|pointsOfCaution|interviewQuestions|onboardingGuidance|interpretationLimits/i.test(error)) {
    return "structural";
  }

  return "unknown";
}

function validateGeneralEnvelope({
  providerResponseReceived,
  parseResult,
  parsedOutput,
}) {
  const errors = [];

  if (providerResponseReceived !== true) {
    errors.push("OpenAI response was not received.");
  }

  if (parseResult?.ok !== true) {
    errors.push(
      `OpenAI response was not parsed successfully${
        parseResult?.error ? `: ${parseResult.error}` : "."
      }`,
    );
  }

  if (parsedOutput === undefined) {
    errors.push("Parsed output is missing.");
  } else if (parsedOutput === null) {
    errors.push("Parsed output must not be null.");
  } else if (Array.isArray(parsedOutput)) {
    errors.push("Parsed output must not be an array.");
  } else if (typeof parsedOutput !== "object") {
    errors.push("Parsed output must be a plain object.");
  } else {
    const prototype = Object.getPrototypeOf(parsedOutput);

    if (prototype !== Object.prototype && prototype !== null) {
      errors.push("Parsed output must be a plain object.");
    }
  }

  return {
    ok: errors.length === 0,
    providerResponseReceived: providerResponseReceived === true,
    parsed: parseResult?.ok === true,
    parsedOutputPresent: parsedOutput !== undefined,
    parsedOutputIsPlainObject:
      parsedOutput !== null &&
      typeof parsedOutput === "object" &&
      !Array.isArray(parsedOutput) &&
      [Object.prototype, null].includes(Object.getPrototypeOf(parsedOutput)),
    errors,
  };
}

function buildDisagreementMatrix({
  diagnosticWouldPassGeneralEnvelopeOnly,
  legacyFullGateWouldPersist,
  contractValidatorWouldPersist,
  safranValidatorWouldPersist,
  bhsGateWouldPersist,
  dataOnlyShadowGateWouldPersist,
}) {
  return {
    generalEnvelopeOnly: diagnosticWouldPassGeneralEnvelopeOnly,
    legacyFullGate: legacyFullGateWouldPersist,
    contractValidator: contractValidatorWouldPersist,
    safranDataReferenceValidator: safranValidatorWouldPersist,
    bhsGate: bhsGateWouldPersist,
    dataOnlyShadowGate: dataOnlyShadowGateWouldPersist,
    generalPassesWhileLegacyBlocks:
      diagnosticWouldPassGeneralEnvelopeOnly && !legacyFullGateWouldPersist,
    dataOnlyPassesWhileLegacyBlocks:
      dataOnlyShadowGateWouldPersist && !legacyFullGateWouldPersist,
    generalPassesWhileContractBlocks:
      diagnosticWouldPassGeneralEnvelopeOnly && !contractValidatorWouldPersist,
    generalPassesWhileSafranDataReferenceBlocks:
      diagnosticWouldPassGeneralEnvelopeOnly && !safranValidatorWouldPersist,
    generalPassesWhileBhsBlocks:
      diagnosticWouldPassGeneralEnvelopeOnly && !bhsGateWouldPersist,
  };
}

function buildLegacyBlockingCategories({
  bhsLanguagePolicyResult,
  legacySafranValidatorResult,
}) {
  const categories = [];

  if (bhsLanguagePolicyResult?.ok === false) {
    categories.push("bhs_prose_language");
  }

  if (legacySafranValidatorResult?.ok === false) {
    for (const error of legacySafranValidatorResult.errors) {
      categories.push(`safran_validator:${error.category}`);
    }
  }

  return [...new Set(categories)];
}

function buildSafranValidationInventory() {
  return {
    currentlyDataReferenceValidated: [
      "report root and nested object/array shape",
      "required fields and non-empty required strings",
      "allowed property names",
      "reportType, testSlug, audience, sourceType and supported locale constants",
      "testSlug, audience, sourceType and locale equality with expectedInput",
      "generatedLanguage equality with expectedInput.test.locale",
      "structured overall/verbal/figural/numeric score references",
      "score reference key, rawScore, maxScore, scoreLabel, band and bandLabel equality with expectedInput.scores",
      "safetyChecks object shape and required true boolean values",
    ],
    legacyOnlyProseLanguageHeuristics: [
      "global BHS user-facing language policy",
      "forbidden phrase scan across narrative fields",
      "required cautious-hypothesis wording in executiveSummary.summary",
      "required experience/interview/role-context wording in interpretationLimits",
    ],
    deterministicReferenceGaps: [
      "cognitiveSignals prose is not deterministically checked against actual score, band or ordering values",
      "safetyChecks.noScoreMutation remains declarative; score integrity proof comes from structured scoreReferences equality",
    ],
    relativeProtectionComparedWithMwms:
      "stronger than the previous SAFRAN boundary: structured score, band and label references are now checked against deterministic input; cognitiveSignals prose remains diagnostic-only",
  };
}

function buildDataOnlyShadowGate({
  generalEnvelopeValidationResult,
  contractValidatorWouldPersist,
  safranValidatorWouldPersist,
  bhsGateWouldPersist,
  legacyFullGateWouldPersist,
  legacyBlockingCategories,
}) {
  const dataOnlyShadowGateInputs = {
    generalEnvelopeOk: generalEnvelopeValidationResult.ok,
    contractValidationOk: contractValidatorWouldPersist,
    safranDataReferenceValidationOk: safranValidatorWouldPersist,
    bhsLanguagePolicyOk: bhsGateWouldPersist,
    legacyFullGateWouldPersist,
  };
  const dataOnlyShadowGateWouldPersist =
    dataOnlyShadowGateInputs.generalEnvelopeOk &&
    dataOnlyShadowGateInputs.contractValidationOk &&
    dataOnlyShadowGateInputs.safranDataReferenceValidationOk;
  const proseLanguageCategories = new Set([
    "bhs_prose_language",
    "safran_validator:phrase_prose",
    "safran_validator:safety_heuristic",
  ]);
  const legacyBlocksOnlyBecauseOfProseLanguage =
    dataOnlyShadowGateWouldPersist &&
    !legacyFullGateWouldPersist &&
    legacyBlockingCategories.length > 0 &&
    legacyBlockingCategories.every((category) => proseLanguageCategories.has(category));

  return {
    dataOnlyShadowGate: {
      diagnosticOnly: true,
      includes: [
        "general_envelope_parse",
        "safran_contract_shape_validation",
        "safran_metadata_and_structured_score_reference_validation",
      ],
      excludes: [
        "bhs_prose_language",
        "forbidden_phrase_safety_heuristics",
        "required_cautious_prose_patterns",
      ],
      wouldPersist: dataOnlyShadowGateWouldPersist,
    },
    dataOnlyShadowGateWouldPersist,
    dataOnlyShadowGateInputs,
    legacyBlocksOnlyBecauseOfProseLanguage,
    legacyBlockingCategories,
  };
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

function evaluateSafranHrDryRunDiagnostic(
  inputSnapshot,
  rawParsedOutput,
  dependencies,
  options = {},
) {
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
  const legacyValidation = validateSafranHrReport(canonicalizedOutput, {
    expectedInput: inputSnapshot,
  });
  const safranValidatorResult = legacyValidation.ok
    ? {
        ok: true,
        errors: [],
      }
    : {
        ok: false,
        errors: mapErrors(legacyValidation.errors),
      };
  const rawValidation = validateSafranHrReport(rawParsedOutput, {
    expectedInput: inputSnapshot,
  });
  const rawValidationErrors = rawValidation.ok ? [] : mapErrors(rawValidation.errors);
  const contractErrors = rawValidationErrors.filter(
    (error) => error.category === "structural",
  );
  const dataReferenceErrors = rawValidationErrors.filter(
    (error) =>
      error.category === "source_integrity" || error.category === "unknown",
  );
  const contractValidationResult = {
    ok: contractErrors.length === 0,
    errors: contractErrors,
  };
  const safranDataReferenceValidationResult = {
    ok: dataReferenceErrors.length === 0,
    errors: dataReferenceErrors,
  };
  const phraseGateFailures = safranValidatorResult.errors.filter(
    (error) =>
      error.category === "phrase_prose" ||
      error.category === "safety_heuristic",
  );
  const bhsHardFailure = bhsLanguagePolicyResult.skipped === false && !bhsLanguagePolicyResult.ok;
  const bhsGateWouldPersist = !bhsHardFailure;
  const contractValidatorWouldPersist = contractValidationResult.ok;
  const safranValidatorWouldPersist = safranDataReferenceValidationResult.ok;
  const legacyFullGateWouldPersist =
    safranValidatorResult.ok && bhsGateWouldPersist;
  const generalEnvelopeValidationResult = validateGeneralEnvelope({
    providerResponseReceived: options.providerResponseReceived !== false,
    parseResult: options.parseResult ?? { ok: true, error: null },
    parsedOutput: rawParsedOutput,
  });
  const diagnosticWouldPassGeneralEnvelopeOnly =
    generalEnvelopeValidationResult.ok;
  const legacyBlockingCategories = buildLegacyBlockingCategories({
    bhsLanguagePolicyResult,
    legacySafranValidatorResult: safranValidatorResult,
  });
  const dataOnlyShadowDecision = buildDataOnlyShadowGate({
    generalEnvelopeValidationResult,
    contractValidatorWouldPersist,
    safranValidatorWouldPersist,
    bhsGateWouldPersist,
    legacyFullGateWouldPersist,
    legacyBlockingCategories,
  });
  const hardGateWouldPersist =
    contractValidatorWouldPersist &&
    safranValidatorWouldPersist &&
    bhsGateWouldPersist;
  const validatorOnWouldPersist = legacyFullGateWouldPersist;
  const warningReasons = phraseGateFailures.map((error) => error.message);
  const failureReasons = buildFailureReasons({
    bhsLanguagePolicyResult,
    safranValidatorResult,
    hardGateWouldPersist,
    validatorOnWouldPersist,
  });
  const disagreementMatrix = buildDisagreementMatrix({
    diagnosticWouldPassGeneralEnvelopeOnly,
    legacyFullGateWouldPersist,
    contractValidatorWouldPersist,
    safranValidatorWouldPersist,
    bhsGateWouldPersist,
    dataOnlyShadowGateWouldPersist:
      dataOnlyShadowDecision.dataOnlyShadowGateWouldPersist,
  });

  return {
    rawParsedOutput,
    parseResult: options.parseResult ?? { ok: true, error: null },
    generalEnvelopeValidationResult,
    diagnosticWouldPassGeneralEnvelopeOnly,
    legacyFullGateWouldPersist,
    contractValidatorWouldPersist,
    safranValidatorWouldPersist,
    bhsGateWouldPersist,
    ...dataOnlyShadowDecision,
    disagreementMatrix,
    canonicalizedOutput,
    contractValidationResult,
    safranDataReferenceValidationResult,
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
    validationInventory: buildSafranValidationInventory(),
    diagnosticNotes: [
      "SAFRAN data-only shadow gate evaluates raw parsed output and does not canonicalize or mutate it.",
      "legacyFullGateWouldPersist reflects current production-equivalent BHS canonicalization/validation plus the full SAFRAN validator.",
      "SAFRAN deterministic reference protection is currently limited to report metadata equality; score, band, label and derived-profile references are not structured in the report contract.",
      "All shadow decisions are diagnostic-only and do not change provider, worker, runtime or persistence behavior.",
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

  const capturePath = resolveInputCapturePath({ env, argv });
  const captureInput = readInputCapture(capturePath, readFile);
  const inputPath = captureInput ? null : resolveInputSnapshotPath({ env, argv });
  const inputSnapshot = captureInput?.inputSnapshot ?? readInputSnapshot(inputPath, readFile);
  const inputSource = captureInput?.inputSource ?? "legacy_safran_hr_input_snapshot";
  const timestamp = now();
  const outputPath = dumpPath ?? buildOutputPath(timestamp.replace(/[:.]/g, "-"));
  const model = captureInput?.model ?? env.AI_REPORT_MODEL ?? null;
  const provider = captureInput?.provider ?? env.AI_REPORT_PROVIDER ?? "openai";

  if (!requestRawReport || !evaluateDiagnostic) {
    installRuntime();
  }

  const providerModule = requestRawReport
    ? null
    : require("../lib/assessment/report-provider-openai.ts");
  const rawRequester =
    requestRawReport ??
    (captureInput
      ? (_input, options) =>
          requestOpenAiFromCapturedRequest(captureInput.preparedOpenAiRequest.requestBody, options)
      : providerModule.requestOpenAiSafranHrReportRaw);

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
      inputSource,
      capturePath: captureInput?.capturePath ?? null,
      captureMetadata: captureInput?.captureMetadata ?? null,
      inputSnapshotPath: inputPath,
    },
    inputSource,
    capturePath: captureInput?.capturePath ?? null,
    captureMetadata: captureInput?.captureMetadata ?? null,
    inputSummary: summarizeInput(inputSnapshot),
    rawParsedOutput,
    parseResult: diagnostic.parseResult,
    generalEnvelopeValidationResult: diagnostic.generalEnvelopeValidationResult,
    diagnosticWouldPassGeneralEnvelopeOnly:
      diagnostic.diagnosticWouldPassGeneralEnvelopeOnly,
    legacyFullGateWouldPersist: diagnostic.legacyFullGateWouldPersist,
    contractValidatorWouldPersist: diagnostic.contractValidatorWouldPersist,
    safranValidatorWouldPersist: diagnostic.safranValidatorWouldPersist,
    bhsGateWouldPersist: diagnostic.bhsGateWouldPersist,
    dataOnlyShadowGate: diagnostic.dataOnlyShadowGate,
    dataOnlyShadowGateWouldPersist:
      diagnostic.dataOnlyShadowGateWouldPersist,
    dataOnlyShadowGateInputs: diagnostic.dataOnlyShadowGateInputs,
    legacyBlocksOnlyBecauseOfProseLanguage:
      diagnostic.legacyBlocksOnlyBecauseOfProseLanguage,
    legacyBlockingCategories: diagnostic.legacyBlockingCategories,
    disagreementMatrix: diagnostic.disagreementMatrix,
    canonicalizedOutput: diagnostic.canonicalizedOutput,
    contractValidationResult: diagnostic.contractValidationResult,
    safranDataReferenceValidationResult:
      diagnostic.safranDataReferenceValidationResult,
    bhsLanguagePolicyResult: diagnostic.bhsLanguagePolicyResult,
    safranValidatorResult: diagnostic.safranValidatorResult,
    hardGateWouldPersist: diagnostic.hardGateWouldPersist,
    validatorOnWouldPersist: diagnostic.validatorOnWouldPersist,
    phraseGateWarnings: diagnostic.phraseGateWarnings,
    phraseGateFailures: diagnostic.phraseGateFailures,
    failureReasons: diagnostic.failureReasons,
    warningReasons: diagnostic.warningReasons,
    validationInventory: diagnostic.validationInventory,
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
            generalEnvelopeValidationResult:
              result.generalEnvelopeValidationResult,
            diagnosticWouldPassGeneralEnvelopeOnly:
              result.diagnosticWouldPassGeneralEnvelopeOnly,
            legacyFullGateWouldPersist: result.legacyFullGateWouldPersist,
            contractValidatorWouldPersist:
              result.contractValidatorWouldPersist,
            safranValidatorWouldPersist:
              result.safranValidatorWouldPersist,
            bhsGateWouldPersist: result.bhsGateWouldPersist,
            dataOnlyShadowGate: result.dataOnlyShadowGate,
            dataOnlyShadowGateWouldPersist:
              result.dataOnlyShadowGateWouldPersist,
            dataOnlyShadowGateInputs: result.dataOnlyShadowGateInputs,
            legacyBlocksOnlyBecauseOfProseLanguage:
              result.legacyBlocksOnlyBecauseOfProseLanguage,
            legacyBlockingCategories: result.legacyBlockingCategories,
            disagreementMatrix: result.disagreementMatrix,
            contractValidationResult: result.contractValidationResult,
            safranDataReferenceValidationResult:
              result.safranDataReferenceValidationResult,
            bhsLanguagePolicyResult: result.bhsLanguagePolicyResult,
            safranValidatorResult: result.safranValidatorResult,
            hardGateWouldPersist: result.hardGateWouldPersist,
            validatorOnWouldPersist: result.validatorOnWouldPersist,
            phraseGateWarnings: result.phraseGateWarnings,
            phraseGateFailures: result.phraseGateFailures,
            failureReasons: result.failureReasons,
            warningReasons: result.warningReasons,
            validationInventory: result.validationInventory,
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
  INPUT_PATH_ENV,
  TIMEOUT_ENV,
  buildNoCallSummary,
  buildOutputPath,
  evaluateSafranHrDryRunDiagnostic,
  installTypeScriptRuntime,
  isExecutionConfirmed,
  readInputCapture,
  readInputSnapshot,
  resolveInputCapturePath,
  resolveInputSnapshotPath,
  runSafranHrOpenAiDryRun,
  validateGeneralEnvelope,
};
