import "server-only";

import { loadAssessmentCompletionState } from "@/lib/assessment/completion-server";
import { resolveReportLocale, type AssessmentLocale } from "@/lib/assessment/locale";
import type {
  CompletedAssessmentReportState,
} from "@/lib/assessment/report-state-types";
import {
  getReportGenerationCapability,
  planPostCompletionReportJobs,
  type ExistingAttemptReportArtifact,
  type PostCompletionReportPlan,
} from "@/lib/assessment/report-capabilities";
import { getAiReportConfig, type AiReportConfig } from "@/lib/assessment/report-config";
import { buildPreparedReportGenerationInput } from "@/lib/assessment/report-provider-helpers";
import { mockReportProvider } from "@/lib/assessment/report-provider-mock";
import { createSelectedReportProvider } from "@/lib/assessment/report-provider-registry";
import { isMwmsTestSlug } from "@/lib/assessment/mwms-report-contract";
import type { ActivePromptVersion } from "@/lib/assessment/prompt-version";
import type {
  AttemptReportStatus,
  CompletedAssessmentReportRequest,
  ReportAudience,
  ReportFamily,
  ReportGeneratorType,
  ReportRenderFormat,
  ReportVersion,
  RuntimeCompletedAssessmentReport,
} from "@/lib/assessment/report-providers";
import {
  isAttemptReportStatus,
  resolveReportSignal,
  validateRuntimeCompletedAssessmentReport,
} from "@/lib/assessment/report-providers";
import type { CompletedAssessmentResults } from "@/lib/assessment/scoring";
import { calculateCompletedAssessmentResults } from "@/lib/assessment/scoring";
import type { ScoringMethod } from "@/lib/assessment/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AiUsageContext, AiUsageRecorder } from "@/lib/assessment/ai-usage-accounting";

type AttemptReportRow = {
  id: string;
  attempt_id: string;
  test_slug: string;
  audience: "participant" | "hr";
  generator_type: ReportGeneratorType | null;
  generated_at: string;
  completed_at: string | null;
  report_status: AttemptReportStatus;
  failure_code: string | null;
  failure_reason: string | null;
  report_snapshot: unknown;
};

type AttemptReportQueueRow = ExistingAttemptReportArtifact & {
  id: string;
  attempt_id: string;
};

type ReadySingleTestHrReportRow = {
  id: string;
  attempt_id: string;
  test_slug: string;
  audience: "participant" | "hr";
  report_type: string | null;
  source_type: string | null;
  report_status: AttemptReportStatus;
  generator_type: ReportGeneratorType | null;
};

const PARTICIPANT_REPORT_TYPE = "individual";
const PARTICIPANT_REPORT_AUDIENCE = "participant";
const PARTICIPANT_REPORT_SOURCE_TYPE = "single_test";
const HR_REPORT_TYPE = "individual";
const HR_REPORT_AUDIENCE = "hr";
const HR_REPORT_SOURCE_TYPE = "single_test";

type AttemptRecord = {
  id: string;
  locale: string | null;
  status: "in_progress" | "completed" | "abandoned";
};

type TestRecord = {
  id: string;
  slug: string;
  name: string | null;
  scoring_method: ScoringMethod;
};

type LoadedReportContext = {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  attemptLocale: AssessmentLocale;
  test: TestRecord;
  results: CompletedAssessmentResults;
};

type ReportGenerationResult =
  | {
      status: "ready";
      report: RuntimeCompletedAssessmentReport;
    }
  | {
      status: "unavailable";
      generatorType: ReportGeneratorType;
      failureCode: string;
      failureReason: string;
    };

export type ReportGenerationOverrides = Partial<
  Pick<
    AiReportConfig,
    | "provider"
    | "model"
    | "reasoningEffort"
    | "promptVersion"
    | "fallbackToMock"
    | "openAiApiKey"
    | "openAiTimeoutMs"
  >
> & {
  promptVersionId?: string | null;
  promptTemplate?: ActivePromptVersion | null;
  participantDataOnlyQa?: boolean;
  aiUsageRecorder?: AiUsageRecorder;
  aiUsageContext?: AiUsageContext;
};

export type EnqueueCompletedAssessmentReportsSummary = {
  testSlug: string | null;
  plan: PostCompletionReportPlan | null;
};

export type HrReportRecoveryAction =
  | "noop_ready"
  | "noop_active_job"
  | "noop_inactive_capability"
  | "noop_incomplete_attempt"
  | "noop_existing_unavailable"
  | "generate"
  | "retry_failed";

export type HrReportRecoveryResult = {
  action: HrReportRecoveryAction;
  status: "ready" | "queued" | "processing" | "skipped";
  reason: string | null;
  reportId: string | null;
};

export type ReadySingleTestHrRegenerationMode = "regenerate_ready";

export type ReadySingleTestHrRegenerationAction =
  | "regenerate_ready"
  | "noop_missing_report"
  | "noop_mode_not_confirmed"
  | "noop_wrong_status"
  | "noop_wrong_lane"
  | "noop_unsupported_test"
  | "noop_inactive_capability";

export type ReadySingleTestHrRegenerationResult = {
  action: ReadySingleTestHrRegenerationAction;
  status: "queued" | "skipped";
  reason: string | null;
  reportId: string | null;
  attemptId: string | null;
};

export type HrAttemptReportQueueInsertPayload = {
  attempt_id: string;
  test_slug: string;
  generator_type: ReportGeneratorType;
  generated_at: string;
  report_status: "queued";
  failure_code: null;
  failure_reason: null;
  report_snapshot: null;
  completed_at: null;
  report_type: "individual";
  audience: "hr";
  source_type: "single_test";
  prompt_version_id: null;
  model_name: string | null;
  generator_version: null;
  input_snapshot: null;
  started_at: null;
};

function resolveAiReportConfig(overrides?: ReportGenerationOverrides): AiReportConfig {
  const baseConfig = getAiReportConfig();

  return {
    ...baseConfig,
    ...overrides,
    promptVersion: overrides?.promptVersion ?? baseConfig.promptVersion,
  };
}

function buildReadyCompletedAssessmentReportState(context: {
  testSlug: string;
  audience: ReportAudience;
  report: RuntimeCompletedAssessmentReport;
}): Extract<CompletedAssessmentReportState, { status: "ready" }> {
  const resolvedSignal = resolveReportSignal({
    testSlug: context.testSlug,
    audience: context.audience,
  });

  return {
    status: "ready",
    ...resolvedSignal,
    report: context.report,
  };
}

async function generateReportWithFallback(
  input: CompletedAssessmentReportRequest,
  overrides?: ReportGenerationOverrides,
): Promise<ReportGenerationResult> {
  const config = resolveAiReportConfig(overrides);
  const selectedProvider = createSelectedReportProvider(config, {
    aiUsageRecorder: overrides?.aiUsageRecorder,
  });
  const preparedInput = buildPreparedReportGenerationInput(input, {
    promptVersionId: overrides?.promptVersionId ?? null,
    promptTemplate: overrides?.promptTemplate ?? null,
    participantDataOnlyQa: overrides?.participantDataOnlyQa,
    aiUsageContext: overrides?.aiUsageContext,
  });
  const primaryResult = await selectedProvider.generateReport(preparedInput);

  if (primaryResult.ok) {
    return {
      status: "ready",
      report: primaryResult.report,
    };
  }

  console.error("Report generation failed for primary provider", {
    provider: selectedProvider.type,
    attemptId: input.attemptId,
    testSlug: input.testSlug,
    reason: primaryResult.reason,
    fallbackToMockEnabled: config.fallbackToMock,
  });

  if (selectedProvider.type !== "mock" && config.fallbackToMock) {
    const fallbackResult = await mockReportProvider.generateReport(preparedInput);

    if (fallbackResult.ok) {
      return {
        status: "ready",
        report: fallbackResult.report,
      };
    }

    console.error("Report generation fallback failed", {
      provider: mockReportProvider.type,
      attemptId: input.attemptId,
      testSlug: input.testSlug,
      reason: fallbackResult.reason,
    });

    return {
      status: "unavailable",
      generatorType: mockReportProvider.type,
      failureCode: "report_generation_failed",
      failureReason: fallbackResult.reason,
    };
  }

  return {
    status: "unavailable",
    generatorType: selectedProvider.type,
    failureCode: "report_generation_failed",
    failureReason: primaryResult.reason,
  };
}

async function loadReportContext(testId: string, attemptId: string): Promise<LoadedReportContext | null> {
  const supabase = createSupabaseAdminClient();

  const { data: attemptData, error: attemptError } = await supabase
    .from("attempts")
    .select("id, locale, status")
    .eq("id", attemptId)
    .eq("test_id", testId)
    .maybeSingle();

  if (attemptError) {
    throw new Error(`Failed to load attempt for report generation: ${attemptError.message}`);
  }

  const attempt = attemptData as AttemptRecord | null;

  if (!attempt || attempt.status !== "completed") {
    return null;
  }

  const completionState = await loadAssessmentCompletionState(testId, attemptId);

  if (!completionState.isComplete) {
    return null;
  }

  const { data: testData, error: testError } = await supabase
    .from("tests")
    .select("id, slug, name, scoring_method")
    .eq("id", testId)
    .maybeSingle();

  if (testError || !testData) {
    throw new Error(
      `Failed to load test for report generation: ${testError?.message ?? "Unknown error"}`,
    );
  }

  const results = await calculateCompletedAssessmentResults(testId, attemptId);

  if (!results) {
    return null;
  }

  return {
    supabase,
    attemptLocale: resolveReportLocale(attempt.locale),
    test: testData as TestRecord,
    results,
  };
}

export async function buildCompletedAssessmentReportRequest(
  testId: string,
  attemptId: string,
  options?: Pick<ReportGenerationOverrides, "promptVersion"> & {
    audience?: "participant" | "hr";
    locale?: string | null;
  },
): Promise<CompletedAssessmentReportRequest | null> {
  const context = await loadReportContext(testId, attemptId);

  if (!context) {
    return null;
  }

  return {
    attemptId,
    testId,
    testSlug: context.test.slug,
    testName: context.test.name,
    audience: options?.audience ?? "participant",
    locale: resolveReportLocale(options?.locale ?? context.attemptLocale),
    scoringMethod: context.test.scoring_method,
    promptVersion: options?.promptVersion ?? getAiReportConfig().promptVersion,
    results: context.results,
  };
}

export async function generateCompletedAssessmentReport(
  request: CompletedAssessmentReportRequest,
  overrides?: ReportGenerationOverrides,
): Promise<ReportGenerationResult> {
  return generateReportWithFallback(request, overrides);
}

async function loadPersistedReportSnapshot(
  attemptId: string,
): Promise<CompletedAssessmentReportState | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attempt_reports")
    .select(
      "id, attempt_id, test_slug, audience, generator_type, generated_at, completed_at, report_status, failure_code, failure_reason, report_snapshot",
    )
    .eq("attempt_id", attemptId)
    .order("generated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load attempt report: ${error.message}`);
  }

  const row = ((data ?? []) as AttemptReportRow[])[0] ?? null;

  if (!row) {
    return null;
  }

  if (!isAttemptReportStatus(row.report_status)) {
    throw new Error(`Invalid attempt report status for attempt ${attemptId}.`);
  }

  if (row.report_status === "ready") {
    const validationResult = validateRuntimeCompletedAssessmentReport(row.report_snapshot, {
      testSlug: row.test_slug,
      audience: row.audience,
    });

    if (!validationResult.ok) {
      return {
        status: "failed",
        generatorType: row.generator_type,
        generatedAt: row.generated_at,
        completedAt: row.completed_at,
        failureCode: "invalid_report_snapshot",
        failureReason: "Persisted report snapshot does not match the current report contract.",
      };
    }

    return buildReadyCompletedAssessmentReportState({
      testSlug: row.test_slug,
      audience: row.audience,
      report: validationResult.value,
    });
  }

  if (row.report_status === "queued" || row.report_status === "processing") {
    return {
      status: row.report_status,
      generatorType: row.generator_type,
      generatedAt: row.generated_at,
      completedAt: row.completed_at,
    };
  }

  return {
    status: row.report_status,
    generatorType: row.generator_type,
    generatedAt: row.generated_at,
    completedAt: row.completed_at,
    failureCode: row.failure_code,
    failureReason: row.failure_reason,
  };
}

async function loadPersistedParticipantReportSnapshot(
  attemptId: string,
): Promise<CompletedAssessmentReportState | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attempt_reports")
    .select(
      "id, attempt_id, test_slug, audience, generator_type, generated_at, completed_at, report_status, failure_code, failure_reason, report_snapshot",
    )
    // attempt_reports is no longer 1:1 with attempts, so participant UI must filter the
    // full artifact identity and never read HR artifacts for the same attempt.
    .eq("attempt_id", attemptId)
    .eq("report_type", PARTICIPANT_REPORT_TYPE)
    .eq("audience", PARTICIPANT_REPORT_AUDIENCE)
    .eq("source_type", PARTICIPANT_REPORT_SOURCE_TYPE)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load participant attempt report: ${error.message}`);
  }

  const row = data as AttemptReportRow | null;

  if (!row) {
    return null;
  }

  if (!isAttemptReportStatus(row.report_status)) {
    throw new Error(`Invalid attempt report status for attempt ${attemptId}.`);
  }

  if (row.report_status === "ready") {
    const validationResult = validateRuntimeCompletedAssessmentReport(row.report_snapshot, {
      testSlug: row.test_slug,
      audience: row.audience,
    });

    if (!validationResult.ok) {
      return {
        status: "failed",
        generatorType: row.generator_type,
        generatedAt: row.generated_at,
        completedAt: row.completed_at,
        failureCode: "invalid_report_snapshot",
        failureReason: "Persisted report snapshot does not match the current report contract.",
      };
    }

    return buildReadyCompletedAssessmentReportState({
      testSlug: row.test_slug,
      audience: row.audience,
      report: validationResult.value,
    });
  }

  if (row.report_status === "queued" || row.report_status === "processing") {
    return {
      status: row.report_status,
      generatorType: row.generator_type,
      generatedAt: row.generated_at,
      completedAt: row.completed_at,
    };
  }

  return {
    status: row.report_status,
    generatorType: row.generator_type,
    generatedAt: row.generated_at,
    completedAt: row.completed_at,
    failureCode: row.failure_code,
    failureReason: row.failure_reason,
  };
}

export async function loadPersistedHrReportSnapshot(
  attemptId: string,
): Promise<CompletedAssessmentReportState | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attempt_reports")
    .select(
      "id, attempt_id, test_slug, audience, generator_type, generated_at, completed_at, report_status, failure_code, failure_reason, report_snapshot",
    )
    .eq("attempt_id", attemptId)
    .eq("report_type", HR_REPORT_TYPE)
    .eq("audience", HR_REPORT_AUDIENCE)
    .eq("source_type", HR_REPORT_SOURCE_TYPE)
    .eq("report_status", "ready")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load HR attempt report: ${error.message}`);
  }

  const row = data as AttemptReportRow | null;

  if (!row) {
    return null;
  }

  if (!isAttemptReportStatus(row.report_status)) {
    throw new Error(`Invalid HR attempt report status for attempt ${attemptId}.`);
  }

  const validationResult = validateRuntimeCompletedAssessmentReport(row.report_snapshot, {
    testSlug: row.test_slug,
    audience: row.audience,
  });

  if (!validationResult.ok) {
    return {
      status: "failed",
      generatorType: row.generator_type,
      generatedAt: row.generated_at,
      completedAt: row.completed_at,
      failureCode: "invalid_report_snapshot",
      failureReason: "Persisted report snapshot does not match the current report contract.",
    };
  }

  return buildReadyCompletedAssessmentReportState({
    testSlug: row.test_slug,
    audience: row.audience,
    report: validationResult.value,
  });
}

export async function getCompletedAssessmentReport(
  testId: string,
  attemptId: string | null,
): Promise<CompletedAssessmentReportState | null> {
  if (!attemptId) {
    return null;
  }

  const context = await loadReportContext(testId, attemptId);

  if (!context) {
    return null;
  }

  const persistedReport = await loadPersistedParticipantReportSnapshot(attemptId);

  return persistedReport;
}

export async function getPersistedCompletedAssessmentReportState(
  attemptId: string | null,
): Promise<CompletedAssessmentReportState | null> {
  return getPersistedParticipantCompletedAssessmentReportState(attemptId);
}

export async function getPersistedParticipantCompletedAssessmentReportState(
  attemptId: string | null,
): Promise<CompletedAssessmentReportState | null> {
  if (!attemptId) {
    return null;
  }

  return loadPersistedParticipantReportSnapshot(attemptId);
}

export async function getPersistedHrCompletedAssessmentReportState(
  attemptId: string | null,
): Promise<CompletedAssessmentReportState | null> {
  if (!attemptId) {
    return null;
  }

  return loadPersistedHrReportSnapshot(attemptId);
}

async function loadAttemptReportQueueRows(
  attemptId: string,
): Promise<AttemptReportQueueRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attempt_reports")
    .select("id, attempt_id, test_slug, audience, report_type, source_type, report_status")
    .eq("attempt_id", attemptId)
    .order("generated_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw new Error(`Failed to load attempt report queue rows: ${error.message}`);
  }

  return (data ?? []) as AttemptReportQueueRow[];
}

function findHrSingleTestReportRow(
  reports: AttemptReportQueueRow[],
): AttemptReportQueueRow | null {
  return (
    reports.find(
      (report) =>
        report.audience === HR_REPORT_AUDIENCE &&
        report.report_type === HR_REPORT_TYPE &&
        report.source_type === HR_REPORT_SOURCE_TYPE,
    ) ?? null
  );
}

export function buildHrAttemptReportQueueInsertPayload(input: {
  attemptId: string;
  testSlug: string;
  generatorType: ReportGeneratorType;
  modelName: string | null;
  generatedAt?: string;
}): HrAttemptReportQueueInsertPayload {
  return {
    attempt_id: input.attemptId,
    test_slug: input.testSlug,
    generator_type: input.generatorType,
    generated_at: input.generatedAt ?? new Date().toISOString(),
    report_status: "queued",
    failure_code: null,
    failure_reason: null,
    report_snapshot: null,
    completed_at: null,
    report_type: HR_REPORT_TYPE,
    audience: HR_REPORT_AUDIENCE,
    source_type: HR_REPORT_SOURCE_TYPE,
    prompt_version_id: null,
    model_name: input.modelName,
    generator_version: null,
    input_snapshot: null,
    started_at: null,
  };
}

async function deleteQueuedInactiveLane(attemptId: string, audience: ReportAudience): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("attempt_reports")
    .delete()
    .eq("attempt_id", attemptId)
    .eq("report_type", PARTICIPANT_REPORT_TYPE)
    .eq("audience", audience)
    .eq("source_type", PARTICIPANT_REPORT_SOURCE_TYPE)
    .eq("report_status", "queued");

  if (error) {
    throw new Error(`Failed to remove queued inactive ${audience} report lane: ${error.message}`);
  }
}

async function reconcileInactivePostCompletionLanes(
  attemptId: string,
  testSlug: string,
): Promise<void> {
  const hrCapability = getReportGenerationCapability({
    testSlug,
    audience: HR_REPORT_AUDIENCE,
    reportType: HR_REPORT_TYPE,
    sourceType: HR_REPORT_SOURCE_TYPE,
  });

  if (!hrCapability.active) {
    await deleteQueuedInactiveLane(attemptId, HR_REPORT_AUDIENCE);
  }
}

export function resolveHrReportRecoveryOperation(input: {
  attemptLifecycle: "completed" | "in_progress" | "not_started" | "abandoned" | "unknown";
  capability: {
    active: boolean;
    status: "active" | "planned" | "inactive";
  };
  existingStatus: AttemptReportStatus | null;
}): HrReportRecoveryAction {
  if (input.attemptLifecycle !== "completed") {
    return "noop_incomplete_attempt";
  }

  if (!input.capability.active) {
    return "noop_inactive_capability";
  }

  if (input.existingStatus === null) {
    return "generate";
  }

  if (input.existingStatus === "failed") {
    return "retry_failed";
  }

  if (input.existingStatus === "ready") {
    return "noop_ready";
  }

  if (input.existingStatus === "queued" || input.existingStatus === "processing") {
    return "noop_active_job";
  }

  return "noop_existing_unavailable";
}

export function buildRegenerateReadySingleTestHrReportPatch(input: {
  generatedAt?: string;
}): {
  report_status: "queued";
  generated_at: string;
  started_at: null;
  completed_at: null;
  failure_code: null;
  failure_reason: null;
  report_snapshot: null;
  input_snapshot: null;
  prompt_version_id: null;
  model_name: null;
  generator_version: null;
} {
  return {
    report_status: "queued",
    generated_at: input.generatedAt ?? new Date().toISOString(),
    started_at: null,
    completed_at: null,
    failure_code: null,
    failure_reason: null,
    report_snapshot: null,
    input_snapshot: null,
    prompt_version_id: null,
    model_name: null,
    generator_version: null,
  };
}

export function resolveReadySingleTestHrRegenerationOperation(input: {
  mode?: ReadySingleTestHrRegenerationMode | null;
  report: ReadySingleTestHrReportRow | null;
  capability: {
    active: boolean;
    status: "active" | "planned" | "inactive";
  };
}): ReadySingleTestHrRegenerationAction {
  if (input.mode !== "regenerate_ready") {
    return "noop_mode_not_confirmed";
  }

  if (!input.report) {
    return "noop_missing_report";
  }

  if (
    input.report.report_type !== HR_REPORT_TYPE ||
    input.report.audience !== HR_REPORT_AUDIENCE ||
    input.report.source_type !== HR_REPORT_SOURCE_TYPE
  ) {
    return "noop_wrong_lane";
  }

  if (!input.capability.active) {
    return "noop_inactive_capability";
  }

  if (
    input.report.test_slug !== "ipip-neo-120-v1" &&
    input.report.test_slug !== "safran_v1" &&
    input.report.test_slug !== "mwms_v1"
  ) {
    return "noop_unsupported_test";
  }

  if (input.report.report_status !== "ready") {
    return "noop_wrong_status";
  }

  return "regenerate_ready";
}

async function loadReadySingleTestHrReportRow(
  reportId: string,
): Promise<ReadySingleTestHrReportRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attempt_reports")
    .select("id, attempt_id, test_slug, audience, report_type, source_type, report_status, generator_type")
    .eq("id", reportId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load target single-test HR report: ${error.message}`);
  }

  return (data as ReadySingleTestHrReportRow | null) ?? null;
}

export async function regenerateReadySingleTestHrReport(
  reportId: string,
  options: {
    mode?: ReadySingleTestHrRegenerationMode | null;
    generatedAt?: string;
  } = {},
): Promise<ReadySingleTestHrRegenerationResult> {
  const report = await loadReadySingleTestHrReportRow(reportId);
  const capability = getReportGenerationCapability({
    testSlug: report?.test_slug ?? "",
    audience: HR_REPORT_AUDIENCE,
    reportType: HR_REPORT_TYPE,
    sourceType: HR_REPORT_SOURCE_TYPE,
  });
  const operation = resolveReadySingleTestHrRegenerationOperation({
    mode: options.mode ?? null,
    report,
    capability,
  });

  if (operation !== "regenerate_ready") {
    return {
      action: operation,
      status: "skipped",
      reason:
        operation === "noop_mode_not_confirmed"
          ? "Regenerate-ready mode nije eksplicitno potvrđen."
          : operation === "noop_missing_report"
            ? "Target report nije pronađen."
            : operation === "noop_wrong_lane"
              ? "Target report nije HR single-test individual lane."
              : operation === "noop_inactive_capability"
                ? "HR single-test lane nije aktivan."
                : operation === "noop_wrong_status"
                  ? "Samo ready single-test HR artefakt može u regenerate-ready path."
                  : "Target report nije podržan za regenerate-ready path.",
      reportId: report?.id ?? null,
      attemptId: report?.attempt_id ?? null,
    };
  }

  const targetReport = report as ReadySingleTestHrReportRow;
  const supabase = createSupabaseAdminClient();
  const patch = buildRegenerateReadySingleTestHrReportPatch({
    generatedAt: options.generatedAt,
  });
  const { error } = await supabase
    .from("attempt_reports")
    .update(patch)
    .eq("id", targetReport.id)
    .eq("report_status", "ready")
    .eq("report_type", HR_REPORT_TYPE)
    .eq("audience", HR_REPORT_AUDIENCE)
    .eq("source_type", HR_REPORT_SOURCE_TYPE);

  if (error) {
    throw new Error(`Failed to queue ready single-test HR report for regeneration: ${error.message}`);
  }

  return {
    action: "regenerate_ready",
    status: "queued",
    reason: null,
    reportId: targetReport.id,
    attemptId: targetReport.attempt_id,
  };
}

export async function recoverHrAttemptReport(attemptId: string): Promise<HrReportRecoveryResult> {
  const supabase = createSupabaseAdminClient();
  const { data: attemptData, error: attemptError } = await supabase
    .from("attempts")
    .select("id, status, completed_at, test_id, locale, tests(slug)")
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptError) {
    throw new Error(`Failed to load attempt for HR report recovery: ${attemptError.message}`);
  }

  const attempt = attemptData as {
    id: string;
    status: "in_progress" | "completed" | "abandoned";
    completed_at: string | null;
    test_id: string;
    locale: string | null;
    tests: { slug: string } | { slug: string }[] | null;
  } | null;

  const testSlug = Array.isArray(attempt?.tests) ? attempt?.tests[0]?.slug : attempt?.tests?.slug;

  if (!attempt || !testSlug) {
    return {
      action: "noop_incomplete_attempt",
      status: "skipped",
      reason: "Attempt nije dostupan.",
      reportId: null,
    };
  }

  const attemptLifecycle =
    attempt.status === "completed" && attempt.completed_at
      ? "completed"
      : attempt.status === "in_progress"
        ? "in_progress"
        : attempt.status === "abandoned"
          ? "abandoned"
          : "unknown";

  const capability = getReportGenerationCapability({
    testSlug,
    audience: HR_REPORT_AUDIENCE,
    reportType: HR_REPORT_TYPE,
    sourceType: HR_REPORT_SOURCE_TYPE,
  });
  const existingReports = await loadAttemptReportQueueRows(attemptId);
  const existingHrReport = findHrSingleTestReportRow(existingReports);
  const operation = resolveHrReportRecoveryOperation({
    attemptLifecycle,
    capability,
    existingStatus: existingHrReport?.report_status ?? null,
  });

  if (operation === "noop_incomplete_attempt") {
    return {
      action: operation,
      status: "skipped",
      reason: "Procjena još nije završena.",
      reportId: existingHrReport?.id ?? null,
    };
  }

  if (operation === "noop_inactive_capability") {
    return {
      action: operation,
      status: "skipped",
      reason: "HR izvještaj za ovu procjenu još nije podržan.",
      reportId: existingHrReport?.id ?? null,
    };
  }

  if (operation === "noop_ready") {
    return {
      action: operation,
      status: "ready",
      reason: "HR izvještaj je već dostupan.",
      reportId: existingHrReport?.id ?? null,
    };
  }

  if (operation === "noop_active_job") {
    return {
      action: operation,
      status:
        existingHrReport?.report_status === "processing" ? "processing" : "queued",
      reason: "HR izvještaj je već pokrenut.",
      reportId: existingHrReport?.id ?? null,
    };
  }

  if (operation === "noop_existing_unavailable") {
    return {
      action: operation,
      status: "skipped",
      reason: "HR izvještaj trenutno nije dostupan za ponovni pokušaj.",
      reportId: existingHrReport?.id ?? null,
    };
  }

  if (operation === "retry_failed" && existingHrReport) {
    const { error } = await supabase
      .from("attempt_reports")
      .update({
        report_status: "queued",
        generated_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
        failure_code: null,
        failure_reason: null,
        report_snapshot: null,
      })
      .eq("id", existingHrReport.id)
      .eq("report_status", "failed");

    if (error) {
      throw new Error(`Failed to queue failed HR report for retry: ${error.message}`);
    }

    return {
      action: operation,
      status: "queued",
      reason: null,
      reportId: existingHrReport.id,
    };
  }

  const config = getAiReportConfig();
  const insertPayload = buildHrAttemptReportQueueInsertPayload({
    attemptId,
    testSlug,
    generatorType: config.provider,
    modelName: config.model,
  });
  const { data: insertedRow, error } = await supabase
    .from("attempt_reports")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (error && error.code !== "23505") {
    throw new Error(`Failed to queue missing HR report: ${error.message}`);
  }

  const queuedHrReport =
    (insertedRow as { id: string } | null)?.id
      ? {
          id: (insertedRow as { id: string }).id,
        }
      : findHrSingleTestReportRow(await loadAttemptReportQueueRows(attemptId));

  return {
    action: operation,
    status: "queued",
    reason: null,
    reportId: queuedHrReport?.id ?? null,
  };
}

export async function enqueueCompletedAssessmentReports(
  attemptId: string,
): Promise<EnqueueCompletedAssessmentReportsSummary> {
  const supabase = createSupabaseAdminClient();
  const { data: attemptData, error: attemptError } = await supabase
    .from("attempts")
    .select("test_id, locale, tests(slug)")
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptError) {
    throw new Error(`Failed to load attempt for queued report input snapshot: ${attemptError.message}`);
  }

  const attempt = attemptData as {
    test_id: string;
    locale: string | null;
    tests: { slug: string } | { slug: string }[] | null;
  } | null;
  const testSlug = Array.isArray(attempt?.tests)
    ? attempt?.tests[0]?.slug
    : attempt?.tests?.slug;

  if (!attempt?.test_id || !testSlug) {
    return {
      testSlug: testSlug ?? null,
      plan: null,
    };
  }

  const existingReports = await loadAttemptReportQueueRows(attemptId);
  const plan = planPostCompletionReportJobs({
    testSlug,
    existingReports,
  });

  if (plan.jobsToEnqueue.length > 0) {
    const { error } = await supabase.rpc("enqueue_individual_reports", {
      p_attempt_id: attemptId,
    });

    if (error) {
      throw new Error(`Failed to enqueue attempt reports: ${error.message}`);
    }

    try {
      await reconcileInactivePostCompletionLanes(attemptId, testSlug);
    } catch (error) {
      console.error("Failed to reconcile inactive post-completion report lanes", {
        attemptId,
        testSlug,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (isMwmsTestSlug(testSlug)) {
    const request = await buildCompletedAssessmentReportRequest(attempt.test_id, attemptId, {
      audience: PARTICIPANT_REPORT_AUDIENCE,
      locale: resolveReportLocale(attempt.locale),
    });

    if (request) {
      const preparedInput = buildPreparedReportGenerationInput(request);
      const { error: inputSnapshotError } = await supabase
        .from("attempt_reports")
        .update({
          input_snapshot: preparedInput.promptInput as unknown,
        })
        .eq("attempt_id", attemptId)
        .eq("report_type", PARTICIPANT_REPORT_TYPE)
        .eq("audience", PARTICIPANT_REPORT_AUDIENCE)
        .eq("source_type", PARTICIPANT_REPORT_SOURCE_TYPE);

      if (inputSnapshotError) {
        throw new Error(`Failed to persist MWMS report input snapshot: ${inputSnapshotError.message}`);
      }
    }
  }

  const config = getAiReportConfig();

  if (config.provider !== "openai" || !config.model) {
    return {
      testSlug,
      plan,
    };
  }

  const { error: freezeError } = await supabase
    .from("attempt_reports")
    .update({
      model_name: config.model,
    })
    .eq("attempt_id", attemptId)
    .eq("report_type", PARTICIPANT_REPORT_TYPE)
    .eq("audience", PARTICIPANT_REPORT_AUDIENCE)
    .eq("source_type", PARTICIPANT_REPORT_SOURCE_TYPE)
    .eq("generator_type", "openai")
    .eq("report_status", "queued")
    .is("model_name", null);

  if (freezeError) {
    throw new Error(`Failed to freeze queued attempt report model: ${freezeError.message}`);
  }

  return {
    testSlug,
    plan,
  };
}

export async function persistCompletedAssessmentReport(
  testId: string,
  attemptId: string,
  existingContext?: LoadedReportContext,
): Promise<CompletedAssessmentReportState | null> {
  const context = existingContext ?? (await loadReportContext(testId, attemptId));

  if (!context) {
    return null;
  }

  const existingReport = await loadPersistedReportSnapshot(attemptId);

  if (existingReport) {
    return existingReport;
  }

  const generationResult = await generateReportWithFallback({
    attemptId,
    testId,
    testSlug: context.test.slug,
    audience: "participant",
    locale: resolveReportLocale(context.attemptLocale),
    scoringMethod: context.test.scoring_method,
    promptVersion: getAiReportConfig().promptVersion,
    results: context.results,
  });

  const persistedGeneratedAt =
    generationResult.status === "ready"
      ? new Date().toISOString()
      : new Date().toISOString();

  const { error } = await context.supabase.from("attempt_reports").upsert(
    generationResult.status === "ready"
      ? {
          attempt_id: attemptId,
          test_slug: context.test.slug,
          generator_type: getAiReportConfig().provider,
          generated_at: persistedGeneratedAt,
          report_status: "ready",
          failure_code: null,
          failure_reason: null,
          report_snapshot: generationResult.report as unknown,
        }
      : {
          attempt_id: attemptId,
          test_slug: context.test.slug,
          generator_type: generationResult.generatorType,
          generated_at: persistedGeneratedAt,
          report_status: "unavailable",
          failure_code: generationResult.failureCode,
          failure_reason: generationResult.failureReason,
          report_snapshot: null,
        },
    {
      onConflict: "attempt_id",
    },
  );

  if (error) {
    throw new Error(`Failed to persist attempt report: ${error.message}`);
  }

  if (generationResult.status === "ready") {
    return buildReadyCompletedAssessmentReportState({
      testSlug: context.test.slug,
      audience: "participant",
      report: generationResult.report,
    });
  }

  return {
    status: "unavailable",
    generatorType: generationResult.generatorType,
    generatedAt: persistedGeneratedAt,
    completedAt: persistedGeneratedAt,
    failureCode: generationResult.failureCode,
    failureReason: generationResult.failureReason,
  };
}

export type { CompletedAssessmentReportState } from "@/lib/assessment/report-state-types";
export type {
  RuntimeCompletedAssessmentReport as CompletedAssessmentReport,
  RuntimeCompletedAssessmentReport as CompletedAssessmentReportSnapshot,
} from "@/lib/assessment/report-providers";
