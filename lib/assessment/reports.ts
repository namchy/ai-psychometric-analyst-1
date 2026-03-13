import "server-only";

import { loadAssessmentCompletionState } from "@/lib/assessment/completion-server";
import { getAiReportConfig } from "@/lib/assessment/report-config";
import { buildPreparedReportGenerationInput } from "@/lib/assessment/report-provider-helpers";
import { mockReportProvider } from "@/lib/assessment/report-provider-mock";
import { createSelectedReportProvider } from "@/lib/assessment/report-provider-registry";
import type {
  AttemptReportStatus,
  CompletedAssessmentReport,
  CompletedAssessmentReportRequest,
  ReportGeneratorType,
} from "@/lib/assessment/report-providers";
import {
  isAttemptReportStatus,
  isCompletedAssessmentReport,
} from "@/lib/assessment/report-providers";
import type { CompletedAssessmentResults } from "@/lib/assessment/scoring";
import { calculateCompletedAssessmentResults } from "@/lib/assessment/scoring";
import type { ScoringMethod } from "@/lib/assessment/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AttemptReportRow = {
  attempt_id: string;
  test_slug: string;
  generator_type: ReportGeneratorType;
  generated_at: string;
  report_status: AttemptReportStatus;
  failure_code: string | null;
  failure_reason: string | null;
  report_snapshot: unknown;
};

type AttemptRecord = {
  id: string;
  status: "in_progress" | "completed" | "abandoned";
};

type TestRecord = {
  id: string;
  slug: string;
  scoring_method: ScoringMethod;
};

type LoadedReportContext = {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  test: TestRecord;
  results: CompletedAssessmentResults;
};

export type CompletedAssessmentReportState =
  | {
      status: "ready";
      report: CompletedAssessmentReport;
    }
  | {
      status: "unavailable";
      generatorType: ReportGeneratorType;
      generatedAt: string;
      failureCode: string | null;
      failureReason: string | null;
    };

type ReportGenerationResult =
  | {
      status: "ready";
      report: CompletedAssessmentReport;
    }
  | {
      status: "unavailable";
      generatorType: ReportGeneratorType;
      failureCode: string;
      failureReason: string;
    };

async function generateReportWithFallback(
  input: CompletedAssessmentReportRequest,
): Promise<ReportGenerationResult> {
  const config = getAiReportConfig();
  const selectedProvider = createSelectedReportProvider();
  const preparedInput = buildPreparedReportGenerationInput(input);
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
    .select("id, slug, scoring_method")
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

async function loadPersistedReportSnapshot(
  context: LoadedReportContext,
  attemptId: string,
): Promise<CompletedAssessmentReportState | null> {
  const { data, error } = await context.supabase
    .from("attempt_reports")
    .select(
      "attempt_id, test_slug, generator_type, generated_at, report_status, failure_code, failure_reason, report_snapshot",
    )
    .eq("attempt_id", attemptId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load attempt report: ${error.message}`);
  }

  const row = data as AttemptReportRow | null;

  if (!row) {
    return null;
  }

  if (!isAttemptReportStatus(row.report_status)) {
    throw new Error(`Invalid attempt report status for attempt ${attemptId}.`);
  }

  if (row.report_status === "ready") {
    if (!isCompletedAssessmentReport(row.report_snapshot)) {
      throw new Error(`Attempt report ${attemptId} is marked ready without a valid snapshot.`);
    }

    return {
      status: "ready",
      report: row.report_snapshot,
    };
  }

  return {
    status: "unavailable",
    generatorType: row.generator_type,
    generatedAt: row.generated_at,
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

  const persistedReport = await loadPersistedReportSnapshot(context, attemptId);

  if (persistedReport) {
    return persistedReport;
  }

  return persistCompletedAssessmentReport(testId, attemptId, context);
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

  const existingReport = await loadPersistedReportSnapshot(context, attemptId);

  if (existingReport) {
    return existingReport;
  }

  const generationResult = await generateReportWithFallback({
    attemptId,
    testSlug: context.test.slug,
    scoringMethod: context.test.scoring_method,
    promptVersion: getAiReportConfig().promptVersion,
    results: context.results,
  });

  const persistedGeneratedAt =
    generationResult.status === "ready"
      ? generationResult.report.generated_at
      : new Date().toISOString();

  const { error } = await context.supabase.from("attempt_reports").upsert(
    generationResult.status === "ready"
      ? {
          attempt_id: attemptId,
          test_slug: generationResult.report.test_slug,
          generator_type: generationResult.report.generator_type,
          generated_at: persistedGeneratedAt,
          report_status: "ready",
          failure_code: null,
          failure_reason: null,
          report_snapshot: generationResult.report,
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
    return generationResult;
  }

  return {
    status: "unavailable",
    generatorType: generationResult.generatorType,
    generatedAt: persistedGeneratedAt,
    failureCode: generationResult.failureCode,
    failureReason: generationResult.failureReason,
  };
}

export type { CompletedAssessmentReport } from "@/lib/assessment/report-providers";
