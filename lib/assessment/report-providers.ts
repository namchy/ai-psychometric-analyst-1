import "server-only";

import type { AssessmentLocale } from "@/lib/assessment/locale";
import type {
  DetailedReportV1,
  DetailedReportDimensionCode,
  DetailedReportScoreBand,
} from "@/lib/assessment/detailed-report-v1";
import { validateDetailedReportV1 } from "@/lib/assessment/detailed-report-v1";
import type { CompletedAssessmentResults } from "@/lib/assessment/scoring";
import type { ActivePromptVersion } from "@/lib/assessment/prompt-version";
import type { ScoringMethod } from "@/lib/assessment/types";

export type ReportGeneratorType = "mock" | "openai";
export type AttemptReportStatus =
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "unavailable";

export type CompletedAssessmentReport = DetailedReportV1;

export type CompletedAssessmentReportRequest = {
  attemptId: string;
  testId: string;
  testSlug: string;
  audience: "participant" | "hr";
  locale: AssessmentLocale;
  scoringMethod: ScoringMethod;
  promptVersion: string;
  results: CompletedAssessmentResults;
};

export type AiReportDimensionInput = {
  dimension_code: DetailedReportDimensionCode;
  dimension_label: string;
  raw_score: number;
  scored_question_count: number;
  average_score: number;
  score_band: DetailedReportScoreBand;
};

export type AiReportPromptInput = {
  attempt_id: string;
  test_id: string;
  test_slug: string;
  audience: "participant" | "hr";
  locale: AssessmentLocale;
  scoring_method: ScoringMethod;
  prompt_version: string;
  scored_response_count: number;
  dimension_scores: AiReportDimensionInput[];
  deterministic_summary: {
    highest_dimension: DetailedReportDimensionCode | null;
    lowest_dimension: DetailedReportDimensionCode | null;
    dimensions_ranked: DetailedReportDimensionCode[];
  };
};

export type PreparedReportGenerationInput = {
  attemptId: string;
  testSlug: string;
  promptVersion: string;
  promptVersionId: string | null;
  promptTemplate: ActivePromptVersion | null;
  promptInput: AiReportPromptInput;
};

export type ReportProviderResult =
  | {
      ok: true;
      report: CompletedAssessmentReport;
    }
  | {
      ok: false;
      reason: string;
    };

export type ReportProvider = {
  type: ReportGeneratorType;
  generateReport: (input: PreparedReportGenerationInput) => Promise<ReportProviderResult>;
};

export function isCompletedAssessmentReport(value: unknown): value is CompletedAssessmentReport {
  return validateDetailedReportV1(value).ok;
}

export function isAttemptReportStatus(value: unknown): value is AttemptReportStatus {
  return (
    value === "queued" ||
    value === "processing" ||
    value === "ready" ||
    value === "failed" ||
    value === "unavailable"
  );
}
