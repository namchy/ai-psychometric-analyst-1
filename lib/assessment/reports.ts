import "server-only";

import {
  loadAssessmentCompletionState,
} from "@/lib/assessment/completion-server";
import type { CompletedAssessmentResults } from "@/lib/assessment/scoring";
import { calculateCompletedAssessmentResults } from "@/lib/assessment/scoring";
import type { ScoringMethod } from "@/lib/assessment/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AttemptReportRow = {
  attempt_id: string;
  test_slug: string;
  generator_type: "mock";
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

export type CompletedAssessmentReportDimension = {
  dimension_key: string;
  score: number;
  short_interpretation: string;
};

export type CompletedAssessmentReport = {
  attempt_id: string;
  test_slug: string;
  generated_at: string;
  generator_type: "mock";
  summary: string;
  dimensions: CompletedAssessmentReportDimension[];
  strengths: string[];
  blind_spots: string[];
  work_style: string[];
  development_recommendations: string[];
  disclaimer: string;
};

type CompletedAssessmentReportInput = {
  attemptId: string;
  testSlug: string;
  scoringMethod: ScoringMethod;
  results: CompletedAssessmentResults;
};

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatDimensionLabel(dimensionKey: string): string {
  return dimensionKey
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getAverageScore(rawScore: number, scoredQuestionCount: number): number {
  if (scoredQuestionCount === 0) {
    return 0;
  }

  return roundScore(rawScore / scoredQuestionCount);
}

function getScoreBand(score: number): "high" | "mid" | "low" {
  if (score >= 3.67) {
    return "high";
  }

  if (score >= 2.34) {
    return "mid";
  }

  return "low";
}

function getDimensionInterpretation(dimensionKey: string, averageScore: number): string {
  const band = getScoreBand(averageScore);

  const interpretationsByDimension: Record<string, Record<"high" | "mid" | "low", string>> = {
    extraversion: {
      high: "Often appears energized by social contact and visible engagement.",
      mid: "Shows a balanced mix of outward engagement and reflective pacing.",
      low: "May prefer quieter environments and deliberate interpersonal pacing.",
    },
    agreeableness: {
      high: "Tends to emphasize cooperation, tact, and relational harmony.",
      mid: "Can balance candor with collaboration depending on the context.",
      low: "May default to direct challenge over accommodation or consensus.",
    },
    conscientiousness: {
      high: "Likely to value structure, follow-through, and dependable execution.",
      mid: "Can adapt between planning and flexibility as demands change.",
      low: "May work more spontaneously and need clearer external structure.",
    },
    emotional_stability: {
      high: "Likely to stay even-keeled under routine pressure.",
      mid: "Shows a mixed stress profile that may vary by workload or context.",
      low: "May feel pressure more intensely and benefit from steadier recovery habits.",
    },
    intellect: {
      high: "Often drawn to ideas, exploration, and conceptual variety.",
      mid: "Can engage with new ideas while still valuing familiar approaches.",
      low: "May prefer practical clarity over abstract exploration.",
    },
  };

  const fallback = {
    high: "This area is relatively elevated in the current response pattern.",
    mid: "This area is in the middle range in the current response pattern.",
    low: "This area is relatively lower in the current response pattern.",
  };

  return (interpretationsByDimension[dimensionKey] ?? fallback)[band];
}

function getRankedDimensions(results: CompletedAssessmentResults) {
  return [...results.dimensions]
    .map((dimension) => ({
      ...dimension,
      averageScore: getAverageScore(dimension.rawScore, dimension.scoredQuestionCount),
    }))
    .sort(
      (left, right) =>
        right.averageScore - left.averageScore || left.dimension.localeCompare(right.dimension),
    );
}

function buildMockReport(input: CompletedAssessmentReportInput): CompletedAssessmentReport {
  const rankedDimensions = getRankedDimensions(input.results);
  const primaryDimension = rankedDimensions[0];
  const secondaryDimension = rankedDimensions[1];
  const lowestDimension = rankedDimensions[rankedDimensions.length - 1];

  const dimensions = rankedDimensions.map((dimension) => ({
    dimension_key: dimension.dimension,
    score: dimension.rawScore,
    short_interpretation: getDimensionInterpretation(dimension.dimension, dimension.averageScore),
  }));

  const summaryParts = [
    `Mock report for ${input.testSlug} built from persisted ${input.scoringMethod} scores.`,
    primaryDimension
      ? `${formatDimensionLabel(primaryDimension.dimension)} is the strongest visible signal in this attempt.`
      : "No dimension scores were available for this attempt.",
    lowestDimension && lowestDimension !== primaryDimension
      ? `${formatDimensionLabel(lowestDimension.dimension)} is comparatively lower and should be read as a development area, not a deficit.`
      : null,
  ].filter((part): part is string => Boolean(part));

  const strengths = rankedDimensions.slice(0, 2).map((dimension) => {
    const label = formatDimensionLabel(dimension.dimension);
    return `${label}: ${getDimensionInterpretation(dimension.dimension, dimension.averageScore)}`;
  });

  const blindSpots = lowestDimension
    ? [
        `${formatDimensionLabel(lowestDimension.dimension)} is lower in this response pattern, so the candidate may underuse behaviors associated with that area in some contexts.`,
        "Narrative statements are deterministic mock interpretations and should be checked against real behavior and context.",
      ]
    : ["No blind-spot interpretation is available because no scored dimensions were found."];

  const workStyle = [
    primaryDimension
      ? `Likely work-style anchor: ${formatDimensionLabel(primaryDimension.dimension).toLowerCase()} themes are most prominent in this completed attempt.`
      : "Likely work-style anchor is unavailable without scored dimensions.",
    secondaryDimension
      ? `Secondary signal: ${formatDimensionLabel(secondaryDimension.dimension).toLowerCase()} meaningfully shapes how the overall profile may show up day to day.`
      : "A secondary work-style signal was not available from the current score set.",
  ];

  const developmentRecommendations = lowestDimension
    ? [
        `Create one deliberate practice habit tied to ${formatDimensionLabel(lowestDimension.dimension).toLowerCase()} behaviors in weekly work routines.`,
        primaryDimension
          ? `Use the stronger ${formatDimensionLabel(primaryDimension.dimension).toLowerCase()} pattern as leverage while building range in lower-scoring areas.`
          : "Use repeated reflection on score patterns to turn results into concrete behavioral experiments.",
      ]
    : ["Collect a fuller scored attempt before making development recommendations."];

  return {
    attempt_id: input.attemptId,
    test_slug: input.testSlug,
    generated_at: new Date().toISOString(),
    generator_type: "mock",
    summary: summaryParts.join(" "),
    dimensions,
    strengths,
    blind_spots: blindSpots,
    work_style: workStyle,
    development_recommendations: developmentRecommendations,
    disclaimer:
      "This is a deterministic mock narrative built from persisted scoring data for MVP validation. It is not an AI-generated or clinical interpretation.",
  };
}

function isCompletedAssessmentReport(value: unknown): value is CompletedAssessmentReport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const report = value as Record<string, unknown>;

  return (
    typeof report.attempt_id === "string" &&
    typeof report.test_slug === "string" &&
    typeof report.generated_at === "string" &&
    report.generator_type === "mock" &&
    typeof report.summary === "string" &&
    Array.isArray(report.dimensions) &&
    Array.isArray(report.strengths) &&
    Array.isArray(report.blind_spots) &&
    Array.isArray(report.work_style) &&
    Array.isArray(report.development_recommendations) &&
    typeof report.disclaimer === "string"
  );
}

async function loadReportContext(testId: string, attemptId: string) {
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

  return persistCompletedAssessmentReport(testId, attemptId);
}

export async function persistCompletedAssessmentReport(
  testId: string,
  attemptId: string,
): Promise<CompletedAssessmentReport | null> {
  const context = await loadReportContext(testId, attemptId);

  if (!context) {
    return null;
  }

  const report = buildMockReport({
    attemptId,
    testSlug: context.test.slug,
    scoringMethod: context.test.scoring_method,
    results: context.results,
  });

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

