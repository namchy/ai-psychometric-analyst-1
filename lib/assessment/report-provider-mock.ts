import "server-only";

import type {
  CompletedAssessmentReport,
  PreparedReportGenerationInput,
  ReportProvider,
} from "@/lib/assessment/report-providers";
import {
  formatDimensionLabel,
  getAverageScore,
} from "@/lib/assessment/report-provider-helpers";

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

function buildMockReport(input: PreparedReportGenerationInput): CompletedAssessmentReport {
  const { promptInput } = input;
  const primaryDimension = promptInput.deterministic_summary.highest_dimension;
  const lowestDimension = promptInput.deterministic_summary.lowest_dimension;
  const secondaryDimension = promptInput.deterministic_summary.dimensions_ranked[1] ?? null;

  const dimensions = promptInput.dimension_scores
    .map((dimension) => ({
      dimension_key: dimension.dimension_key,
      score: dimension.raw_score,
      short_interpretation: getDimensionInterpretation(
        dimension.dimension_key,
        getAverageScore(dimension.raw_score, dimension.scored_question_count),
      ),
    }))
    .sort(
      (left, right) =>
        right.score - left.score || left.dimension_key.localeCompare(right.dimension_key),
    );

  const summaryParts = [
    `Report for ${input.testSlug} built from persisted ${promptInput.scoring_method} scores.`,
    primaryDimension
      ? `${formatDimensionLabel(primaryDimension)} is the strongest visible signal in this attempt.`
      : "No dimension scores were available for this attempt.",
    lowestDimension && lowestDimension !== primaryDimension
      ? `${formatDimensionLabel(lowestDimension)} is comparatively lower and should be read as a development area, not a deficit.`
      : null,
  ].filter((part): part is string => Boolean(part));

  const strengths = promptInput.deterministic_summary.dimensions_ranked
    .slice(0, 2)
    .map((dimensionKey) => {
      const matchingDimension = promptInput.dimension_scores.find(
        (dimension) => dimension.dimension_key === dimensionKey,
      );
      const averageScore = matchingDimension
        ? getAverageScore(matchingDimension.raw_score, matchingDimension.scored_question_count)
        : 0;

      return `${formatDimensionLabel(dimensionKey)}: ${getDimensionInterpretation(dimensionKey, averageScore)}`;
    });

  const blindSpots = lowestDimension
    ? [
        `${formatDimensionLabel(lowestDimension)} is lower in this response pattern, so the candidate may underuse behaviors associated with that area in some contexts.`,
        "Narrative statements should be checked against real behavior, role context, and observation.",
      ]
    : ["No blind-spot interpretation is available because no scored dimensions were found."];

  const workStyle = [
    primaryDimension
      ? `Likely work-style anchor: ${formatDimensionLabel(primaryDimension).toLowerCase()} themes are most prominent in this completed attempt.`
      : "Likely work-style anchor is unavailable without scored dimensions.",
    secondaryDimension
      ? `Secondary signal: ${formatDimensionLabel(secondaryDimension).toLowerCase()} meaningfully shapes how the overall profile may show up day to day.`
      : "A secondary work-style signal was not available from the current score set.",
  ];

  const developmentRecommendations = lowestDimension
    ? [
        `Create one deliberate practice habit tied to ${formatDimensionLabel(lowestDimension).toLowerCase()} behaviors in weekly work routines.`,
        primaryDimension
          ? `Use the stronger ${formatDimensionLabel(primaryDimension).toLowerCase()} pattern as leverage while building range in lower-scoring areas.`
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
      "This report is built from deterministic scoring data. It describes tendencies and development themes, not diagnosis, clinical judgment, or hiring advice.",
  };
}

export const mockReportProvider: ReportProvider = {
  type: "mock",
  async generateReport(input) {
    return {
      ok: true,
      report: buildMockReport(input),
    };
  },
};
