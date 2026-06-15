const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const envLocalPath = path.join(projectRoot, ".env.local");

function loadEnvFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function unique(values) {
  return [...new Set(values)];
}

function isCompositeHrReportSnapshotCandidate(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return false;
  }

  const reportType = snapshot.reportType ?? snapshot.metadata?.reportType;
  const contractVersion = snapshot.contractVersion ?? snapshot.metadata?.contractVersion;
  const reportKind = snapshot.reportKind ?? snapshot.metadata?.reportKind ?? null;

  if (reportType !== "composite") {
    return false;
  }

  if (contractVersion !== "composite_hr_v1" && contractVersion !== "composite_hr_report_v1") {
    return false;
  }

  if (reportKind !== null && reportKind !== "composite_hr") {
    return false;
  }

  return true;
}

function buildSmokeSummaryBase({
  inputResolutionMode,
  resolvedCompositeHrReportId,
  resolvedAssessmentAssignmentId,
  autoDiscoveryUsed,
}) {
  return {
    ok: true,
    smokeName: "composite_hr_data_only_shadow_db_smoke",
    reportKind: "composite_hr",
    reportType: "composite",
    contractVersion: "composite_hr_v1",
    inputResolutionMode,
    resolvedCompositeHrReportId: resolvedCompositeHrReportId ?? null,
    resolvedAssessmentAssignmentId: resolvedAssessmentAssignmentId ?? null,
    autoDiscoveryUsed: autoDiscoveryUsed === true,
    openAiCalled: false,
    databaseWrites: false,
    reportRegenerated: false,
    productionBehaviorChanged: false,
    persistedReportSnapshotEvaluated: false,
    boundaryDiagnosticPresent: false,
    dataOnlyShadowComparatorPresent: false,
    wouldPassDataOnlyBlockingValidation: "not_evaluated",
    blockingFindingCount: 0,
    diagnosticOnlyFindingCount: 0,
    mutationRiskFindingCount: 0,
    blockingCategories: [],
    diagnosticOnlyCategories: [],
    mutationRiskCategories: [],
    notEvaluatedReasons: [],
  };
}

function buildSkipSummary(reason, resolution = {}) {
  return {
    ...buildSmokeSummaryBase({
      inputResolutionMode: resolution.inputResolutionMode ?? "skip_no_candidate",
      resolvedCompositeHrReportId: resolution.resolvedCompositeHrReportId ?? null,
      resolvedAssessmentAssignmentId: resolution.resolvedAssessmentAssignmentId ?? null,
      autoDiscoveryUsed: resolution.autoDiscoveryUsed ?? false,
    }),
    skipped: true,
    persistedReportSnapshotEvaluated: false,
    boundaryDiagnosticPresent: false,
    dataOnlyShadowComparatorPresent: false,
    wouldPassDataOnlyBlockingValidation: "not_evaluated",
    notEvaluatedReasons: [reason],
  };
}

function summarizeSmokeArtifact(artifact, resolution = {}) {
  const boundaryDiagnosticPresent = !!artifact?.boundaryDiagnostic;
  const dataOnlyShadowComparatorPresent =
    artifact?.dataOnlyShadowComparator?.shadowMode === true &&
    !!artifact?.dataOnlyShadowResult;
  const reportSnapshotStatus = artifact?.boundaryDiagnostic?.reportSnapshotStatus ?? null;
  const persistedReportSnapshotEvaluated =
    reportSnapshotStatus === "evaluated" || reportSnapshotStatus === "invalid_report_snapshot";
  const dataOnlyShadowResult = artifact?.dataOnlyShadowResult ?? null;
  const blockingFindings = dataOnlyShadowResult?.blockingFindings ?? [];
  const diagnosticOnlyFindings = dataOnlyShadowResult?.diagnosticOnlyFindings ?? [];
  const mutationRiskFindings = dataOnlyShadowResult?.mutationRiskFindings ?? [];

  return {
    ...buildSmokeSummaryBase({
      inputResolutionMode: resolution.inputResolutionMode ?? "skip_no_candidate",
      resolvedCompositeHrReportId:
        resolution.resolvedCompositeHrReportId ?? artifact?.inputSummary?.identity?.reportId ?? null,
      resolvedAssessmentAssignmentId:
        resolution.resolvedAssessmentAssignmentId ??
        artifact?.inputSummary?.identity?.assessmentAssignmentId ??
        null,
      autoDiscoveryUsed: resolution.autoDiscoveryUsed ?? false,
    }),
    skipped: false,
    openAiCalled: artifact?.openAiCalled === true || artifact?.metadata?.openAiCalled === true,
    databaseWrites:
      artifact?.databaseWrites === true || artifact?.metadata?.databaseWrites === true,
    reportRegenerated:
      artifact?.reportRegenerated === true || artifact?.metadata?.reportRegenerated === true,
    productionBehaviorChanged:
      artifact?.productionBehaviorChanged === true ||
      artifact?.metadata?.productionBehaviorChanged === true,
    persistedReportSnapshotEvaluated,
    boundaryDiagnosticPresent,
    dataOnlyShadowComparatorPresent,
    wouldPassDataOnlyBlockingValidation:
      dataOnlyShadowResult?.wouldPassDataOnlyBlockingValidation ?? "not_evaluated",
    blockingFindingCount: blockingFindings.length,
    diagnosticOnlyFindingCount: diagnosticOnlyFindings.length,
    mutationRiskFindingCount: mutationRiskFindings.length,
    blockingCategories: unique(blockingFindings.map((finding) => finding.category)),
    diagnosticOnlyCategories: dataOnlyShadowResult?.diagnosticOnlyCategories ?? [],
    mutationRiskCategories: unique(mutationRiskFindings.map((finding) => finding.category)),
    notEvaluatedReasons: dataOnlyShadowResult?.notEvaluatedReasons ?? [],
    reportId: artifact?.inputSummary?.identity?.reportId ?? null,
    assessmentAssignmentId: artifact?.inputSummary?.identity?.assessmentAssignmentId ?? null,
    schemaName: artifact?.preparedOpenAiRequest?.schemaName ?? null,
    requestBodyModel: artifact?.preparedOpenAiRequest?.requestBody?.model ?? null,
    responseFormatSchemaName:
      artifact?.preparedOpenAiRequest?.requestBody?.response_format?.json_schema?.name ?? null,
  };
}

function assertSmokeSummary(summary) {
  if (summary.openAiCalled !== false) {
    throw new Error("Composite HR data-only shadow DB smoke detected an OpenAI call.");
  }

  if (summary.databaseWrites !== false) {
    throw new Error("Composite HR data-only shadow DB smoke detected a DB write.");
  }

  if (summary.reportRegenerated !== false) {
    throw new Error("Composite HR data-only shadow DB smoke detected report regeneration.");
  }

  if (summary.productionBehaviorChanged !== false) {
    throw new Error("Composite HR data-only shadow DB smoke detected production behavior change.");
  }

  if (summary.skipped) {
    return;
  }

  if (summary.boundaryDiagnosticPresent !== true) {
    throw new Error("Composite HR data-only shadow DB smoke is missing boundary diagnostic.");
  }

  if (summary.dataOnlyShadowComparatorPresent !== true) {
    throw new Error("Composite HR data-only shadow DB smoke is missing shadow comparator.");
  }

  if (
    summary.resolvedCompositeHrReportId &&
    summary.persistedReportSnapshotEvaluated !== true &&
    summary.wouldPassDataOnlyBlockingValidation === "not_evaluated"
  ) {
    throw new Error(
      "Composite HR data-only shadow DB smoke found a persisted report but did not evaluate the snapshot.",
    );
  }

  if (summary.schemaName !== "composite_hr_v1") {
    throw new Error(`Unexpected schemaName in smoke summary: ${summary.schemaName}`);
  }

  if (summary.responseFormatSchemaName !== "composite_hr_v1") {
    throw new Error(
      `Unexpected response_format.json_schema.name in smoke summary: ${summary.responseFormatSchemaName}`,
    );
  }
}

async function loadCompositeHrReportIdentityById(supabase, reportId) {
  const { data, error } = await supabase
    .from("assessment_reports")
    .select(
      "id, assessment_assignment_id, report_status, report_snapshot, report_type, audience, source_type, contract_version, generated_at, updated_at, completed_at, created_at",
    )
    .eq("id", reportId)
    .eq("report_type", "composite")
    .eq("audience", "hr")
    .eq("source_type", "assessment")
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load Composite HR report ${reportId}: ${error.message}`);
  }

  return data ?? null;
}

async function loadLatestUsableCompositeHrReadyReportCandidate(supabase) {
  const { data, error } = await supabase
    .from("assessment_reports")
    .select(
      "id, assessment_assignment_id, report_status, report_snapshot, report_type, audience, source_type, contract_version, generated_at, updated_at, completed_at, created_at",
    )
    .eq("report_type", "composite")
    .eq("audience", "hr")
    .eq("source_type", "assessment")
    .eq("report_status", "ready")
    .not("report_snapshot", "is", null)
    .order("completed_at", { ascending: false })
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    throw new Error(`Unable to query Composite HR ready report candidates: ${error.message}`);
  }

  for (const row of data ?? []) {
    if (isCompositeHrReportSnapshotCandidate(row.report_snapshot)) {
      return row;
    }
  }

  return null;
}

async function loadLatestCompositeHrAssignmentReportCandidate(supabase, assignmentId = null) {
  let query = supabase
    .from("assessment_reports")
    .select(
      "id, assessment_assignment_id, report_status, report_snapshot, report_type, audience, source_type, contract_version, generated_at, updated_at, completed_at, created_at",
    )
    .eq("report_type", "composite")
    .eq("audience", "hr")
    .eq("source_type", "assessment")
    .order("completed_at", { ascending: false })
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(25);

  if (assignmentId) {
    query = query.eq("assessment_assignment_id", assignmentId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to query Composite HR assignment candidates: ${error.message}`);
  }

  for (const row of data ?? []) {
    if (row?.assessment_assignment_id) {
      return row;
    }
  }

  return null;
}

async function resolveCompositeHrSmokeTarget({
  env,
  createSupabaseClient,
  findLatestUsableReadyReportCandidate = loadLatestUsableCompositeHrReadyReportCandidate,
  findLatestAssignmentCandidate = loadLatestCompositeHrAssignmentReportCandidate,
  loadReportIdentityById = loadCompositeHrReportIdentityById,
}) {
  const reportId = typeof env.COMPOSITE_HR_REPORT_ID === "string" ? env.COMPOSITE_HR_REPORT_ID.trim() : "";
  const assignmentId =
    typeof env.COMPOSITE_HR_ASSESSMENT_ASSIGNMENT_ID === "string"
      ? env.COMPOSITE_HR_ASSESSMENT_ASSIGNMENT_ID.trim()
      : "";
  const supabase = createSupabaseClient();

  if (reportId) {
    const row = await loadReportIdentityById(supabase, reportId);

    return {
      inputResolutionMode: "env_report_id",
      resolvedCompositeHrReportId: row?.id ?? reportId,
      resolvedAssessmentAssignmentId: row?.assessment_assignment_id ?? null,
      autoDiscoveryUsed: false,
      reportRow: row,
      skipReason:
        row && isCompositeHrReportSnapshotCandidate(row.report_snapshot)
          ? null
          : `Composite HR report ${reportId} does not contain a usable persisted report snapshot.`,
    };
  }

  if (assignmentId) {
    const row = await loadLatestCompositeHrAssignmentReportCandidate(supabase, assignmentId);

    if (!row) {
      return {
        inputResolutionMode: "env_assignment_id",
        resolvedCompositeHrReportId: null,
        resolvedAssessmentAssignmentId: assignmentId,
        autoDiscoveryUsed: false,
        reportRow: null,
        skipReason: `No Composite HR report found for assessment assignment ${assignmentId}.`,
      };
    }

    return {
      inputResolutionMode: "env_assignment_id",
      resolvedCompositeHrReportId: row.id,
      resolvedAssessmentAssignmentId: row.assessment_assignment_id ?? assignmentId,
      autoDiscoveryUsed: false,
      reportRow: isCompositeHrReportSnapshotCandidate(row.report_snapshot) ? row : null,
      skipReason: isCompositeHrReportSnapshotCandidate(row.report_snapshot)
        ? null
        : `Latest Composite HR report for assessment assignment ${assignmentId} does not contain a usable persisted report snapshot.`,
    };
  }

  const readyCandidate = await findLatestUsableReadyReportCandidate(supabase);

  if (readyCandidate) {
    return {
      inputResolutionMode: "auto_latest_ready_report",
      resolvedCompositeHrReportId: readyCandidate.id,
      resolvedAssessmentAssignmentId: readyCandidate.assessment_assignment_id ?? null,
      autoDiscoveryUsed: true,
      reportRow: readyCandidate,
      skipReason: null,
    };
  }

  const assignmentCandidate = await findLatestAssignmentCandidate(supabase);

  if (!assignmentCandidate) {
    return {
      inputResolutionMode: "skip_no_candidate",
      resolvedCompositeHrReportId: null,
      resolvedAssessmentAssignmentId: null,
      autoDiscoveryUsed: true,
      reportRow: null,
      skipReason: "No Composite HR persisted report candidate was found.",
    };
  }

  return {
    inputResolutionMode: "auto_latest_assignment",
    resolvedCompositeHrReportId: assignmentCandidate.id ?? null,
    resolvedAssessmentAssignmentId: assignmentCandidate.assessment_assignment_id ?? null,
    autoDiscoveryUsed: true,
    reportRow: isCompositeHrReportSnapshotCandidate(assignmentCandidate.report_snapshot)
      ? assignmentCandidate
      : null,
    skipReason: isCompositeHrReportSnapshotCandidate(assignmentCandidate.report_snapshot)
      ? null
      : `Latest Composite HR assignment candidate ${assignmentCandidate.id} does not contain a usable persisted report snapshot.`,
  };
}

async function runCompositeHrDataOnlyShadowDbSmoke({
  env = process.env,
  loadEnv = loadEnvFileIfPresent,
  envLocalFilePath = envLocalPath,
  runCapture,
  createSupabaseClient = null,
  findLatestUsableReadyReportCandidate = loadLatestUsableCompositeHrReadyReportCandidate,
  findLatestAssignmentCandidate = loadLatestCompositeHrAssignmentReportCandidate,
  loadReportIdentityById = loadCompositeHrReportIdentityById,
} = {}) {
  loadEnv(envLocalFilePath);

  const { CONFIRM_ENV, runCompositeHrAiInputCapture } =
    require("./inspect-composite-hr-ai-input.cjs");
  const { installTypeScriptRuntime } = require("./inspect-composite-hr-ai-input.cjs");

  installTypeScriptRuntime();
  const effectiveRunCapture = runCapture ?? runCompositeHrAiInputCapture;
  const hasSupabaseRuntimeEnv =
    Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  const rawEnvReportId =
    typeof env.COMPOSITE_HR_REPORT_ID === "string" ? env.COMPOSITE_HR_REPORT_ID.trim() : "";
  const rawEnvAssignmentId =
    typeof env.COMPOSITE_HR_ASSESSMENT_ASSIGNMENT_ID === "string"
      ? env.COMPOSITE_HR_ASSESSMENT_ASSIGNMENT_ID.trim()
      : "";

  if (!createSupabaseClient && !hasSupabaseRuntimeEnv) {
    const summary = buildSkipSummary(
      "Missing Supabase runtime env for read-only Composite HR auto-discovery.",
      {
        inputResolutionMode: "skip_no_candidate",
        autoDiscoveryUsed: true,
      },
    );
    assertSmokeSummary(summary);
    return summary;
  }

  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const supabaseClientFactory = createSupabaseClient ?? createSupabaseAdminClient;
  let target;

  try {
    target = await resolveCompositeHrSmokeTarget({
      env,
      createSupabaseClient: supabaseClientFactory,
      findLatestUsableReadyReportCandidate,
      findLatestAssignmentCandidate,
      loadReportIdentityById,
    });
  } catch (error) {
    const summary = buildSkipSummary(
      `Composite HR smoke could not resolve a persisted report candidate: ${
        error instanceof Error ? error.message : String(error)
      }`,
      {
        inputResolutionMode: rawEnvReportId
          ? "env_report_id"
          : rawEnvAssignmentId
            ? "env_assignment_id"
            : "skip_no_candidate",
        resolvedCompositeHrReportId: rawEnvReportId || null,
        resolvedAssessmentAssignmentId: rawEnvAssignmentId || null,
        autoDiscoveryUsed: !(rawEnvReportId || rawEnvAssignmentId),
      },
    );
    assertSmokeSummary(summary);
    return summary;
  }

  if (target.skipReason) {
    const summary = buildSkipSummary(target.skipReason, target);
    assertSmokeSummary(summary);
    return summary;
  }

  const runEnv = {
    ...env,
    [CONFIRM_ENV]: "true",
  };

  if (target.resolvedAssessmentAssignmentId) {
    runEnv.COMPOSITE_HR_ASSESSMENT_ASSIGNMENT_ID = target.resolvedAssessmentAssignmentId;
  }

  if (target.resolvedCompositeHrReportId) {
    runEnv.COMPOSITE_HR_REPORT_ID = target.resolvedCompositeHrReportId;
  }

  const artifact = await effectiveRunCapture({
    env: runEnv,
    persistDump: false,
  });
  const summary = summarizeSmokeArtifact(artifact, target);
  assertSmokeSummary(summary);
  return summary;
}

async function main() {
  const summary = await runCompositeHrDataOnlyShadowDbSmoke();
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  assertSmokeSummary,
  buildSkipSummary,
  loadEnvFileIfPresent,
  runCompositeHrDataOnlyShadowDbSmoke,
  summarizeSmokeArtifact,
};
