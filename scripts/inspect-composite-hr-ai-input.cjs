const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const CONFIRM_ENV = "CONFIRM_COMPOSITE_HR_AI_INPUT_CAPTURE";
const ASSIGNMENT_ID_ENV = "COMPOSITE_HR_ASSESSMENT_ASSIGNMENT_ID";
const REPORT_ID_ENV = "COMPOSITE_HR_REPORT_ID";
const DUMP_PATH_ENV = "COMPOSITE_HR_AI_REQUEST_DUMP_PATH";
const OUTPUT_PREFIX = "composite-hr-ai-request";

function isExecutionConfirmed(env = process.env) {
  return env[CONFIRM_ENV] === "true";
}

function buildTimestamp(now = () => new Date().toISOString()) {
  return now().replace(/[:.]/g, "-");
}

function buildDefaultDumpPath(timestamp = buildTimestamp()) {
  return path.join(os.tmpdir(), `${OUTPUT_PREFIX}-${timestamp}.json`);
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

function buildNoCallSummary() {
  return {
    mode: "no-call preflight",
    confirmed: false,
    reportKind: "composite_hr",
    databaseAccessed: false,
    databaseWrites: false,
    openAiCalled: false,
    reportRegenerated: false,
    productionFlowChanged: false,
    productionBehaviorChanged: false,
    reconstructedInputUsed: false,
    wouldDo: [
      `Resolve real identity from ${ASSIGNMENT_ID_ENV} or ${REPORT_ID_ENV}.`,
      "Build CompositeHrInputSnapshot through the production input builder.",
      "Build the Composite HR OpenAI request body without calling OpenAI.",
      "Optionally write sanitized JSON dump under /tmp with 0600 permissions.",
    ],
    confirmationRequired: `${CONFIRM_ENV}=true`,
  };
}

function parseCliValue(flagName, argv = process.argv.slice(2)) {
  const withEquals = argv.find((arg) => arg.startsWith(`${flagName}=`));

  if (withEquals) {
    return withEquals.slice(flagName.length + 1);
  }

  const index = argv.findIndex((arg) => arg === flagName);
  return index >= 0 ? argv[index + 1] ?? null : null;
}

function resolveIdentity({ env = process.env, argv = process.argv.slice(2) } = {}) {
  const assessmentAssignmentId =
    env[ASSIGNMENT_ID_ENV] || parseCliValue("--assignment-id", argv);
  const reportId = env[REPORT_ID_ENV] || parseCliValue("--report-id", argv);

  if (assessmentAssignmentId) {
    return { kind: "assessment_assignment_id", assessmentAssignmentId, reportId: reportId ?? null };
  }

  if (reportId) {
    return { kind: "report_id", assessmentAssignmentId: null, reportId };
  }

  throw new Error(`Composite HR input capture requires ${ASSIGNMENT_ID_ENV} or ${REPORT_ID_ENV}.`);
}

function assertSafeDumpPath(filePath) {
  if (!path.isAbsolute(filePath)) {
    throw new Error(`${DUMP_PATH_ENV} must be an absolute path under /tmp.`);
  }

  if (!filePath.startsWith(`${os.tmpdir()}/`)) {
    throw new Error(`${DUMP_PATH_ENV} must be under /tmp.`);
  }

  if (path.extname(filePath) !== ".json") {
    throw new Error(`${DUMP_PATH_ENV} must end with .json.`);
  }
}

function resolveDumpPath({ env = process.env, argv = process.argv.slice(2), now = () => new Date().toISOString() } = {}) {
  const explicitPath = env[DUMP_PATH_ENV] || parseCliValue("--dump", argv);
  const dumpPath = explicitPath || buildDefaultDumpPath(buildTimestamp(now));

  assertSafeDumpPath(dumpPath);
  return dumpPath;
}

function redactString(value) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [REDACTED]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-[REDACTED]");
}

function sanitizeForDump(value) {
  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForDump(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (/(authorization|cookie|token|secret|password|api[_-]?key|service[_-]?role|bearer)/i.test(key)) {
        return [key, "[REDACTED]"];
      }

      return [key, sanitizeForDump(entry)];
    }),
  );
}

function summarizeInput(input) {
  return {
    assessmentAssignmentId: input.generatedFor?.assessmentAssignmentId ?? null,
    organizationId: input.generatedFor?.organizationId ?? null,
    participantId: input.generatedFor?.participantId ?? null,
    locale: input.locale ?? null,
    addressingForm: input.addressingForm ?? null,
    coverage: input.coverage
      ? {
          requiredCount: input.coverage.requiredCount ?? null,
          completedCount: input.coverage.completedCount ?? null,
          requiredTestSlugs: input.coverage.requiredTestSlugs ?? [],
          completedTestSlugs: input.coverage.completedTestSlugs ?? [],
          missingTestSlugs: input.coverage.missingTestSlugs ?? [],
        }
      : null,
    sourceAttemptCount: Array.isArray(input.sourceAttempts) ? input.sourceAttempts.length : 0,
    sourceAttempts: Array.isArray(input.sourceAttempts)
      ? input.sourceAttempts.map((attempt) => ({
          attemptId: attempt.attemptId,
          testSlug: attempt.testSlug,
          status: attempt.status,
          requiredForComposite: attempt.requiredForComposite,
          position: attempt.position,
        }))
      : [],
    guardrails: input.guardrails ?? null,
  };
}

async function loadCompositeReportIdentity(reportId, createSupabaseClient) {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("assessment_reports")
    .select("id, assessment_assignment_id, organization_id, participant_id, report_type, audience, source_type, report_snapshot")
    .eq("id", reportId)
    .eq("report_type", "composite")
    .eq("audience", "hr")
    .eq("source_type", "assessment")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Composite HR assessment report identity: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Composite HR assessment report ${reportId} was not found.`);
  }

  return {
    reportId: data.id,
    assessmentAssignmentId: data.assessment_assignment_id,
    organizationId: data.organization_id,
    participantId: data.participant_id,
    reportSnapshot: data.report_snapshot ?? null,
  };
}

async function loadLatestCompositeReportIdentityForAssignment(
  assessmentAssignmentId,
  createSupabaseClient,
) {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("assessment_reports")
    .select("id, assessment_assignment_id, organization_id, participant_id, report_snapshot")
    .eq("assessment_assignment_id", assessmentAssignmentId)
    .eq("report_type", "composite")
    .eq("audience", "hr")
    .eq("source_type", "assessment")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load latest Composite HR assessment report for assignment ${assessmentAssignmentId}: ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  return {
    reportId: data.id,
    assessmentAssignmentId: data.assessment_assignment_id,
    organizationId: data.organization_id,
    participantId: data.participant_id,
    reportSnapshot: data.report_snapshot ?? null,
  };
}

async function resolveProductionInputIdentity(identity, deps, options = {}) {
  if (identity.kind === "assessment_assignment_id") {
    if (identity.reportId) {
      const reportIdentity = await deps.loadReportIdentity(
        identity.reportId,
        deps.createSupabaseClient,
      );

      if (reportIdentity.assessmentAssignmentId !== identity.assessmentAssignmentId) {
        throw new Error(`${REPORT_ID_ENV} does not belong to ${ASSIGNMENT_ID_ENV}.`);
      }

      return reportIdentity;
    }

    if (options.preferPersistedReportForAssignment === true) {
      const persistedReport = await deps.loadLatestReportIdentityForAssignment(
        identity.assessmentAssignmentId,
        deps.createSupabaseClient,
      );

      if (persistedReport) {
        return persistedReport;
      }
    }

    return {
      reportId: identity.reportId,
      assessmentAssignmentId: identity.assessmentAssignmentId,
      organizationId: undefined,
      participantId: undefined,
      reportSnapshot: null,
    };
  }

  return deps.loadReportIdentity(identity.reportId, deps.createSupabaseClient);
}

async function runCompositeHrAiInputCapture({
  env = process.env,
  argv = process.argv.slice(2),
  now = () => new Date().toISOString(),
  writeFile = fs.writeFileSync,
  chmodFile = fs.chmodSync,
  installRuntime = installTypeScriptRuntime,
  buildInputSnapshot,
  buildRequestPayload,
  buildRequestBody,
  buildBoundaryDiagnostic,
  compareDataOnlyValidationShadow,
  getConfig,
  createSupabaseClient,
  loadReportIdentity,
  loadLatestReportIdentityForAssignment,
  preferPersistedReportForAssignment = false,
  persistDump = true,
} = {}) {
  if (!isExecutionConfirmed(env)) {
    return buildNoCallSummary();
  }

  installRuntime();

  const inputModule = require("../lib/assessment/composite-input.ts");
  const providerModule = require("../lib/assessment/composite-hr-report-provider-openai.ts");
  const configModule = require("../lib/assessment/report-config.ts");
  const supabaseModule = require("../lib/supabase/admin.ts");

  const deps = {
    buildInputSnapshot: buildInputSnapshot ?? inputModule.buildCompositeHrInputSnapshot,
    buildRequestPayload: buildRequestPayload ?? providerModule.buildOpenAiCompositeHrReportRequestPayload,
    buildRequestBody: buildRequestBody ?? providerModule.buildCompositeHrOpenAiChatCompletionsRequestBody,
    buildBoundaryDiagnostic:
      buildBoundaryDiagnostic ?? providerModule.buildCompositeHrBoundaryDiagnostic,
    compareDataOnlyValidationShadow:
      compareDataOnlyValidationShadow ??
      providerModule.compareCompositeHrDataOnlyValidationShadow,
    getConfig: getConfig ?? configModule.getAiReportConfig,
    createSupabaseClient: createSupabaseClient ?? supabaseModule.createSupabaseAdminClient,
    loadReportIdentity: loadReportIdentity ?? loadReportIdentityDefault,
    loadLatestReportIdentityForAssignment:
      loadLatestReportIdentityForAssignment ?? loadLatestReportIdentityForAssignmentDefault,
  };

  async function loadReportIdentityDefault(reportId, createClient) {
    return loadCompositeReportIdentity(reportId, createClient);
  }

  async function loadLatestReportIdentityForAssignmentDefault(
    assessmentAssignmentId,
    createClient,
  ) {
    return loadLatestCompositeReportIdentityForAssignment(assessmentAssignmentId, createClient);
  }

  const timestamp = now();
  const identity = resolveIdentity({ env, argv });
  const resolvedIdentity = await resolveProductionInputIdentity(identity, deps, {
    preferPersistedReportForAssignment,
  });
  const inputSnapshot = await deps.buildInputSnapshot({
    assessmentAssignmentId: resolvedIdentity.assessmentAssignmentId,
    organizationId: resolvedIdentity.organizationId,
    participantId: resolvedIdentity.participantId,
  });
  const config = deps.getConfig();
  const model = env.AI_REPORT_MODEL || config.model;
  const provider = config.provider === "openai" || env.AI_REPORT_PROVIDER === "openai" ? "openai" : config.provider;
  const requestPayload = deps.buildRequestPayload(inputSnapshot);
  const requestBody = deps.buildRequestBody(requestPayload, { model });
  const boundaryDiagnostic = deps.buildBoundaryDiagnostic(
    inputSnapshot,
    resolvedIdentity.reportSnapshot,
  );
  const dataOnlyShadowResult = deps.compareDataOnlyValidationShadow(
    inputSnapshot,
    resolvedIdentity.reportSnapshot,
    boundaryDiagnostic,
  );
  const schemaName = requestBody.response_format.json_schema.name;
  const dumpPath = persistDump ? resolveDumpPath({ env, argv, now }) : null;
  const metadata = {
    timestamp,
    reportFamily: "composite_hr",
    reportKind: "composite_hr",
    reportType: "composite",
    audience: "hr",
    sourceType: "assessment",
    provider,
    model,
    contractVersion: inputSnapshot.targetReportContractVersion,
    schemaName,
    promptSource: "code_prompt",
    databaseAccessed: true,
    databaseWrites: false,
    openAiCalled: false,
    reportRegenerated: false,
    productionFlowChanged: false,
    productionBehaviorChanged: false,
    reconstructedInputUsed: false,
  };
  const reportContract = {
    contractVersion: inputSnapshot.targetReportContractVersion,
    inputContractVersion: inputSnapshot.contractVersion,
    reportType: inputSnapshot.reportType,
    audience: inputSnapshot.audience,
    sourceType: inputSnapshot.sourceType,
    schemaName,
  };
  const requestAuthority = {
    promptSource: "code_prompt",
    promptKey: null,
    promptVersionId: null,
    reportContractKey: inputSnapshot.targetReportContractVersion,
    reportSchemaName: schemaName,
  };
  const artifact = {
    metadata,
    inputSummary: {
      ...summarizeInput(inputSnapshot),
      identity: {
        inputKind: identity.kind,
        reportId: resolvedIdentity.reportId ?? null,
        assessmentAssignmentId: resolvedIdentity.assessmentAssignmentId,
      },
    },
    reportContract,
    requestAuthority,
    boundaryDiagnostic,
    dataOnlyShadowComparator: {
      shadowMode: true,
      productionBehaviorChanged: false,
    },
    dataOnlyShadowResult,
    dataOnlyBlockingCategories: dataOnlyShadowResult.dataOnlyBlockingCategories,
    validationInventory: boundaryDiagnostic.validationInventory,
    dataOnlyReadiness: boundaryDiagnostic.dataOnlyReadiness,
    diagnosticOnlyCategories: dataOnlyShadowResult.diagnosticOnlyCategories,
    mutationRiskInventory: boundaryDiagnostic.mutationRiskInventory,
    mutationRiskFindings: dataOnlyShadowResult.mutationRiskFindings,
    productionBehaviorChanged: false,
    databaseWrites: false,
    openAiCalled: false,
    reportRegenerated: false,
    preparedOpenAiRequest: {
      schemaName,
      requestBody,
    },
    dumpPath,
    requestDumpPath: dumpPath,
  };
  const sanitizedArtifact = sanitizeForDump(artifact);

  if (dumpPath !== null) {
    writeFile(dumpPath, `${JSON.stringify(sanitizedArtifact, null, 2)}\n`, { mode: 0o600 });
    chmodFile(dumpPath, 0o600);
  }

  return sanitizedArtifact;
}

async function main() {
  const result = await runCompositeHrAiInputCapture();

  console.log(
    JSON.stringify(
      result.confirmed === false
        ? result
        : {
            metadata: result.metadata,
            inputSummary: result.inputSummary,
            reportContract: result.reportContract,
            requestAuthority: result.requestAuthority,
            boundaryDiagnostic: result.boundaryDiagnostic,
            dataOnlyShadowComparator: result.dataOnlyShadowComparator,
            dataOnlyShadowResult: result.dataOnlyShadowResult,
            dataOnlyReadiness: result.dataOnlyReadiness,
            requestDumpPath: result.requestDumpPath,
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
  ASSIGNMENT_ID_ENV,
  CONFIRM_ENV,
  DUMP_PATH_ENV,
  REPORT_ID_ENV,
  assertSafeDumpPath,
  buildDefaultDumpPath,
  buildNoCallSummary,
  installTypeScriptRuntime,
  isExecutionConfirmed,
  resolveDumpPath,
  resolveIdentity,
  runCompositeHrAiInputCapture,
  sanitizeForDump,
  loadLatestCompositeReportIdentityForAssignment,
};
