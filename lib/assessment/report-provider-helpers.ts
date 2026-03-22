import "server-only";

export { formatDimensionLabel } from "@/lib/assessment/result-display";
import type { ActivePromptVersion } from "@/lib/assessment/prompt-version";
import type {
  AiReportPromptInput,
  CompletedAssessmentReportRequest,
  PreparedReportGenerationInput,
} from "@/lib/assessment/report-providers";

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getAverageScore(rawScore: number, scoredQuestionCount: number): number {
  if (scoredQuestionCount === 0) {
    return 0;
  }

  return roundScore(rawScore / scoredQuestionCount);
}

function getRankedDimensions(input: CompletedAssessmentReportRequest) {
  return [...input.results.dimensions]
    .map((dimension) => ({
      ...dimension,
      averageScore: getAverageScore(dimension.rawScore, dimension.scoredQuestionCount),
    }))
    .sort(
      (left, right) =>
        right.averageScore - left.averageScore || left.dimension.localeCompare(right.dimension),
    );
}

export function buildAiReportPromptInput(
  input: CompletedAssessmentReportRequest,
): AiReportPromptInput {
  const rankedDimensions = getRankedDimensions(input);

  return {
    attempt_id: input.attemptId,
    test_slug: input.testSlug,
    scoring_method: input.scoringMethod,
    prompt_version: input.promptVersion,
    scored_response_count: input.results.scoredResponseCount,
    dimension_scores: rankedDimensions.map((dimension) => ({
      dimension_key: dimension.dimension,
      raw_score: dimension.rawScore,
      scored_question_count: dimension.scoredQuestionCount,
    })),
    deterministic_summary: {
      highest_dimension: rankedDimensions[0]?.dimension ?? null,
      lowest_dimension: rankedDimensions[rankedDimensions.length - 1]?.dimension ?? null,
      dimensions_ranked: rankedDimensions.map((dimension) => dimension.dimension),
    },
  };
}

export function buildPreparedReportGenerationInput(
  input: CompletedAssessmentReportRequest,
  options?: {
    promptVersionId?: string | null;
    promptTemplate?: ActivePromptVersion | null;
  },
): PreparedReportGenerationInput {
  return {
    attemptId: input.attemptId,
    testSlug: input.testSlug,
    promptVersion: input.promptVersion,
    promptVersionId: options?.promptVersionId ?? null,
    promptTemplate: options?.promptTemplate ?? null,
    promptInput: buildAiReportPromptInput(input),
  };
}
