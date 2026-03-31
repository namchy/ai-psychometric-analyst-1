import "server-only";

import {
  CANONICAL_DETAILED_REPORT_DIMENSION_ORDER,
  getDetailedReportDimensionLabel,
  getDetailedReportScoreBand,
  normalizeDimensionCode,
} from "@/lib/assessment/detailed-report-v1";
import {
  IPC_TEST_FAMILY,
  isIpcTestSlug,
  type IpcRawOctantScores,
  type IpcReportPromptInput,
} from "@/lib/assessment/ipc-report-contract";
export { formatDimensionLabel } from "@/lib/assessment/result-display";
import type { ActivePromptVersion } from "@/lib/assessment/prompt-version";
import type {
  AiReportPromptInput,
  CompletedAssessmentReportRequest,
  PreparedReportGenerationInput,
  ReportPromptInput,
} from "@/lib/assessment/report-providers";
import { resolveReportContract } from "@/lib/assessment/report-providers";

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
      dimensionCode: normalizeDimensionCode(dimension.dimension),
      averageScore: getAverageScore(dimension.rawScore, dimension.scoredQuestionCount),
    }))
    .filter(
      (dimension): dimension is typeof dimension & { dimensionCode: NonNullable<typeof dimension.dimensionCode> } =>
        dimension.dimensionCode !== null,
    )
    .sort(
      (left, right) =>
        right.averageScore - left.averageScore || left.dimension.localeCompare(right.dimension),
    );
}

export function buildAiReportPromptInput(
  input: CompletedAssessmentReportRequest,
): AiReportPromptInput {
  const rankedDimensions = getRankedDimensions(input);
  const dimensionByCode = new Map(rankedDimensions.map((dimension) => [dimension.dimensionCode, dimension]));
  const canonicalDimensionScores = CANONICAL_DETAILED_REPORT_DIMENSION_ORDER.map(
    (dimensionCode) => {
      const dimension = dimensionByCode.get(dimensionCode);
      const averageScore = dimension
        ? getAverageScore(dimension.rawScore, dimension.scoredQuestionCount)
        : 0;

      return {
        dimension_code: dimensionCode,
        dimension_label: getDetailedReportDimensionLabel(dimensionCode),
        raw_score: dimension?.rawScore ?? 0,
        scored_question_count: dimension?.scoredQuestionCount ?? 0,
        average_score: averageScore,
        score_band: getDetailedReportScoreBand(averageScore),
      };
    },
  );

  return {
    attempt_id: input.attemptId,
    test_id: input.testId,
    test_slug: input.testSlug,
    audience: input.audience,
    locale: input.locale,
    scoring_method: input.scoringMethod,
    prompt_version: input.promptVersion,
    scored_response_count: input.results.scoredResponseCount,
    dimension_scores: canonicalDimensionScores,
    deterministic_summary: {
      highest_dimension: rankedDimensions[0]?.dimensionCode ?? null,
      lowest_dimension: rankedDimensions[rankedDimensions.length - 1]?.dimensionCode ?? null,
      dimensions_ranked: rankedDimensions.map((dimension) => dimension.dimensionCode),
    },
  };
}

function buildIpcRawOctants(input: CompletedAssessmentReportRequest): IpcRawOctantScores {
  const dimensionsByCode = new Map(
    input.results.dimensions.map((dimension) => [dimension.dimension, dimension.rawScore]),
  );

  return {
    PA: dimensionsByCode.get("PA") ?? 0,
    BC: dimensionsByCode.get("BC") ?? 0,
    DE: dimensionsByCode.get("DE") ?? 0,
    FG: dimensionsByCode.get("FG") ?? 0,
    HI: dimensionsByCode.get("HI") ?? 0,
    JK: dimensionsByCode.get("JK") ?? 0,
    LM: dimensionsByCode.get("LM") ?? 0,
    NO: dimensionsByCode.get("NO") ?? 0,
  };
}

export function buildIpcReportPromptInput(
  input: CompletedAssessmentReportRequest,
): IpcReportPromptInput {
  const ipcDerived = input.results.derived?.ipc;

  if (!ipcDerived) {
    throw new Error(`IPC prompt input requires derived IPC results for test ${input.testSlug}.`);
  }

  return {
    attemptId: input.attemptId,
    testId: input.testId,
    testSlug: input.testSlug,
    testFamily: IPC_TEST_FAMILY,
    audience: input.audience,
    locale: input.locale,
    scoringMethod: input.scoringMethod,
    rawOctants: buildIpcRawOctants(input),
    derived: {
      dominance: ipcDerived.dominance,
      warmth: ipcDerived.warmth,
      primaryDisc: ipcDerived.primaryDisc,
      dominantOctant: ipcDerived.dominantOctant,
      secondaryOctant: ipcDerived.secondaryOctant,
    },
  };
}

export function buildReportPromptInput(
  input: CompletedAssessmentReportRequest,
): ReportPromptInput {
  return isIpcTestSlug(input.testSlug)
    ? buildIpcReportPromptInput(input)
    : buildAiReportPromptInput(input);
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
    promptInput: buildReportPromptInput(input),
    reportContract: resolveReportContract(input.testSlug, input.audience),
  };
}
