import "server-only";

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

export type CompletedAssessmentReportDimension = {
  dimension_key: string;
  score: number;
  short_interpretation: string;
};

export type CompletedAssessmentReport = {
  attempt_id: string;
  test_slug: string;
  generated_at: string;
  generator_type: ReportGeneratorType;
  summary: string;
  dimensions: CompletedAssessmentReportDimension[];
  strengths: string[];
  blind_spots: string[];
  work_style: string[];
  development_recommendations: string[];
  disclaimer: string;
};

export type CompletedAssessmentReportRequest = {
  attemptId: string;
  testSlug: string;
  scoringMethod: ScoringMethod;
  promptVersion: string;
  results: CompletedAssessmentResults;
};

export type AiReportDimensionInput = {
  dimension_key: string;
  raw_score: number;
  scored_question_count: number;
};

export type AiReportPromptInput = {
  attempt_id: string;
  test_slug: string;
  scoring_method: ScoringMethod;
  prompt_version: string;
  scored_response_count: number;
  dimension_scores: AiReportDimensionInput[];
  deterministic_summary: {
    highest_dimension: string | null;
    lowest_dimension: string | null;
    dimensions_ranked: string[];
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isReportDimension(value: unknown): value is CompletedAssessmentReportDimension {
  if (!value || typeof value !== "object") {
    return false;
  }

  const dimension = value as Record<string, unknown>;

  return (
    typeof dimension.dimension_key === "string" &&
    typeof dimension.score === "number" &&
    typeof dimension.short_interpretation === "string"
  );
}

export function isCompletedAssessmentReport(value: unknown): value is CompletedAssessmentReport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const report = value as Record<string, unknown>;
  const generatorType = report.generator_type;

  return (
    typeof report.attempt_id === "string" &&
    typeof report.test_slug === "string" &&
    typeof report.generated_at === "string" &&
    (generatorType === "mock" || generatorType === "openai") &&
    typeof report.summary === "string" &&
    Array.isArray(report.dimensions) &&
    report.dimensions.every(isReportDimension) &&
    isStringArray(report.strengths) &&
    isStringArray(report.blind_spots) &&
    isStringArray(report.work_style) &&
    isStringArray(report.development_recommendations) &&
    typeof report.disclaimer === "string"
  );
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
