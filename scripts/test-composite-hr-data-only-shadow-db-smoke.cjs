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

function buildSkipSummary(reason) {
  return {
    ok: true,
    skipped: true,
    smokeName: "composite_hr_data_only_shadow_db_smoke",
    reportKind: "composite_hr",
    reportType: "composite",
    contractVersion: "composite_hr_v1",
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
    notEvaluatedReasons: [reason],
  };
}

function summarizeSmokeArtifact(artifact) {
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
    ok: true,
    skipped: false,
    smokeName: "composite_hr_data_only_shadow_db_smoke",
    reportKind: artifact?.metadata?.reportKind ?? "composite_hr",
    reportType: artifact?.metadata?.reportType ?? "composite",
    contractVersion: artifact?.metadata?.contractVersion ?? "composite_hr_v1",
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
    summary.reportId &&
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

async function runCompositeHrDataOnlyShadowDbSmoke({
  env = process.env,
  loadEnv = loadEnvFileIfPresent,
  envLocalFilePath = envLocalPath,
  runCapture,
} = {}) {
  loadEnv(envLocalFilePath);

  const { ASSIGNMENT_ID_ENV, REPORT_ID_ENV, CONFIRM_ENV, runCompositeHrAiInputCapture } =
    require("./inspect-composite-hr-ai-input.cjs");

  const effectiveRunCapture = runCapture ?? runCompositeHrAiInputCapture;
  const hasAssignmentId = typeof env[ASSIGNMENT_ID_ENV] === "string" && env[ASSIGNMENT_ID_ENV].trim().length > 0;
  const hasReportId = typeof env[REPORT_ID_ENV] === "string" && env[REPORT_ID_ENV].trim().length > 0;

  if (!hasAssignmentId && !hasReportId) {
    const summary = buildSkipSummary(
      `Missing ${ASSIGNMENT_ID_ENV} or ${REPORT_ID_ENV}. Composite HR data-only shadow DB smoke skipped.`,
    );
    assertSmokeSummary(summary);
    return summary;
  }

  const artifact = await effectiveRunCapture({
    env: {
      ...env,
      [CONFIRM_ENV]: "true",
    },
    preferPersistedReportForAssignment: true,
    persistDump: false,
  });
  const summary = summarizeSmokeArtifact(artifact);
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
