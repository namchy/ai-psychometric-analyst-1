import "server-only";

import { loadAssessmentCompletionState } from "@/lib/assessment/completion-server";
import { getAiReportConfig } from "@/lib/assessment/report-config";
import { buildPreparedReportGenerationInput } from "@/lib/assessment/report-provider-helpers";
import { mockReportProvider } from "@/lib/assessment/report-provider-mock";
import { createSelectedReportProvider } from "@/lib/assessment/report-provider-registry";
import type {
  CompletedAssessmentReport,
  CompletedAssessmentReportRequest,
  ReportGeneratorType,
} from "@/lib/assessment/report-providers";
import { isCompletedAssessmentReport } from "@/lib/assessment/report-providers";
import type { CompletedAssessmentResults } from "@/lib/assessment/scoring";
import { calculateCompletedAssessmentResults } from "@/lib/assessment/scoring";
import type { ScoringMethod } from "@/lib/assessment/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AttemptReportRow = {
  attempt_id: string;
  test_slug: string;
  generator_type: ReportGeneratorType;
  generated_at: string;
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

async function generateReportWithFallback(
  input: CompletedAssessmentReportRequest,
): Promise<CompletedAssessmentReport | null> {
  const config = getAiReportConfig();
  const selectedProvider = createSelectedReportProvider();
  const preparedInput = buildPreparedReportGenerationInput(input);
  const primaryResult = await selectedProvider.generateReport(preparedInput);

  if (primaryResult.ok) {
    return primaryResult.report;
  }

  console.error(`Report generation failed for provider ${selectedProvider.type}: ${primaryResult.reason}`);

  if (selectedProvider.type !== "mock" && config.fallbackToMock) {
    const fallbackResult = await mockReportProvider.generateReport(preparedInput);

    if (fallbackResult.ok) {
      return fallbackResult.report;
    }

    console.error(`Mock report fallback failed: ${fallbackResult.reason}`);
  }

  return null;
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
): Promise<CompletedAssessmentReport | null> {
  const { data, error } = await context.supabase
    .from("attempt_reports")
    .select("attempt_id, test_slug, generator_type, generated_at, report_snapshot")
    .eq("attempt_id", attemptId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load attempt report: ${error.message}`);
  }

  const row = data as AttemptReportRow | null;

  if (row && isCompletedAssessmentReport(row.report_snapshot)) {
    return row.report_snapshot;
  }

  return null;
}

export async function getCompletedAssessmentReport(
  testId: string,
  attemptId: string | null,
): Promise<CompletedAssessmentReport | null> {
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
): Promise<CompletedAssessmentReport | null> {
  const context = existingContext ?? (await loadReportContext(testId, attemptId));

  if (!context) {
    return null;
  }

  const existingReport = await loadPersistedReportSnapshot(context, attemptId);

  if (existingReport) {
    return existingReport;
  }

  const report = await generateReportWithFallback({
    attemptId,
    testSlug: context.test.slug,
    scoringMethod: context.test.scoring_method,
    promptVersion: getAiReportConfig().promptVersion,
    results: context.results,
  });

  if (!report) {
    return null;
  }

  const { error } = await context.supabase.from("attempt_reports").upsert(
    {
      attempt_id: attemptId,
      test_slug: report.test_slug,
      generator_type: report.generator_type,
      generated_at: report.generated_at,
      report_snapshot: report,
    },
    {
      onConflict: "attempt_id",
    },
  );

  if (error) {
    throw new Error(`Failed to persist attempt report: ${error.message}`);
  }

  return report;
}

export type { CompletedAssessmentReport } from "@/lib/assessment/report-providers";
