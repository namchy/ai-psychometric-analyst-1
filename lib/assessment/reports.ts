import "server-only";

import { loadAssessmentCompletionState } from "@/lib/assessment/completion-server";
import type { AssessmentLocale } from "@/lib/assessment/locale";
import { getAiReportConfig, type AiReportConfig } from "@/lib/assessment/report-config";
import { buildPreparedReportGenerationInput } from "@/lib/assessment/report-provider-helpers";
import { mockReportProvider } from "@/lib/assessment/report-provider-mock";
import { createSelectedReportProvider } from "@/lib/assessment/report-provider-registry";
import { isMwmsTestSlug } from "@/lib/assessment/mwms-report-contract";
import type { ActivePromptVersion } from "@/lib/assessment/prompt-version";
import { getActiveReportRuntimeConfig } from "@/lib/assessment/report-runtime-config";
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

const PARTICIPANT_REPORT_TYPE = "individual";
const PARTICIPANT_REPORT_AUDIENCE = "participant";
const PARTICIPANT_REPORT_SOURCE_TYPE = "single_test";

type AttemptRecord = {
  id: string;
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
  test: TestRecord;
  results: CompletedAssessmentResults;
};

type AttemptReportLifecycleState = {
  generatorType: ReportGeneratorType | null;
  generatedAt: string;
  completedAt: string | null;
};

export type CompletedAssessmentReportState =
  | {
      status: "queued" | "processing";
    } & AttemptReportLifecycleState
  | {
      status: "ready";
      reportFamily: ReportFamily;
      reportAudience: ReportAudience;
      reportVersion: ReportVersion;
      reportRenderFormat: ReportRenderFormat | null;
      report: RuntimeCompletedAssessmentReport;
    }
  | {
      status: "failed" | "unavailable";
    } & AttemptReportLifecycleState & {
      failureCode: string | null;
      failureReason: string | null;
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
    "provider" | "model" | "promptVersion" | "fallbackToMock" | "openAiApiKey" | "openAiTimeoutMs"
  >
> & {
  promptVersionId?: string | null;
  promptTemplate?: ActivePromptVersion | null;
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
  const selectedProvider = createSelectedReportProvider(config);
  const preparedInput = buildPreparedReportGenerationInput(input, {
    promptVersionId: overrides?.promptVersionId ?? null,
    promptTemplate: overrides?.promptTemplate ?? null,
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
    .select("id, status")
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
    test: testData as TestRecord,
    results,
  };
}

export async function buildCompletedAssessmentReportRequest(
  testId: string,
  attemptId: string,
  options?: Pick<ReportGenerationOverrides, "promptVersion"> & {
    audience?: "participant" | "hr";
    locale?: AssessmentLocale;
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
    locale: options?.locale ?? "bs",
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

export async function enqueueCompletedAssessmentReports(attemptId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("enqueue_individual_reports", {
    p_attempt_id: attemptId,
  });

  if (error) {
    throw new Error(`Failed to enqueue attempt reports: ${error.message}`);
  }

  const { data: attemptData, error: attemptError } = await supabase
    .from("attempts")
    .select("test_id, tests(slug)")
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptError) {
    throw new Error(`Failed to load attempt for queued report input snapshot: ${attemptError.message}`);
  }

  const attempt = attemptData as {
    test_id: string;
    tests: { slug: string } | { slug: string }[] | null;
  } | null;
  const testSlug = Array.isArray(attempt?.tests)
    ? attempt?.tests[0]?.slug
    : attempt?.tests?.slug;

  if (attempt?.test_id && testSlug && isMwmsTestSlug(testSlug)) {
    const request = await buildCompletedAssessmentReportRequest(attempt.test_id, attemptId, {
      audience: PARTICIPANT_REPORT_AUDIENCE,
      locale: "bs",
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

    const { error: hrDisableError } = await supabase
      .from("attempt_reports")
      .update({
        report_status: "unavailable",
        completed_at: new Date().toISOString(),
        failure_code: "unsupported_audience",
        failure_reason: "MWMS V1 supports participant reports only.",
        report_snapshot: null,
      })
      .eq("attempt_id", attemptId)
      .eq("report_type", PARTICIPANT_REPORT_TYPE)
      .eq("audience", "hr")
      .eq("source_type", PARTICIPANT_REPORT_SOURCE_TYPE)
      .eq("report_status", "queued");

    if (hrDisableError) {
      throw new Error(`Failed to disable unsupported MWMS HR report job: ${hrDisableError.message}`);
    }
  }

  const runtimeConfig = await getActiveReportRuntimeConfig({
    reportType: PARTICIPANT_REPORT_TYPE,
    audience: PARTICIPANT_REPORT_AUDIENCE,
    sourceType: PARTICIPANT_REPORT_SOURCE_TYPE,
    generatorType: "openai",
  });

  if (!runtimeConfig?.modelName) {
    return;
  }

  const { error: freezeError } = await supabase
    .from("attempt_reports")
    .update({
      model_name: runtimeConfig.modelName,
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
    locale: "bs",
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

export type {
  RuntimeCompletedAssessmentReport as CompletedAssessmentReport,
  RuntimeCompletedAssessmentReport as CompletedAssessmentReportSnapshot,
} from "@/lib/assessment/report-providers";
