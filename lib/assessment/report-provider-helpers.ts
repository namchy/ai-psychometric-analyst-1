import "server-only";

import {
  CANONICAL_DETAILED_REPORT_DIMENSION_ORDER,
  getDetailedReportDimensionLabel,
  getDetailedReportScoreBand,
  normalizeDimensionCode,
} from "@/lib/assessment/detailed-report-v1";
import {
  getIpipNeo120DomainLabel,
  getIpipNeo120FacetDomainCode,
  getIpipNeo120FacetLabel,
  IPIP_NEO_120_DOMAIN_ORDER,
  IPIP_NEO_120_FACETS_BY_DOMAIN,
  IPIP_NEO_120_TEST_FAMILY,
  isIpipNeo120TestSlug,
  type IpipNeo120DomainCode,
  type IpipNeo120FacetCode,
} from "@/lib/assessment/ipip-neo-120-labels";
import {
  type IpipNeo120HrPromptDomain,
  type IpipNeo120HrPromptFacet,
  type IpipNeo120HrReportBand,
  type IpipNeo120HrReportPromptInput,
  type IpipNeo120ParticipantPromptDomain,
  type IpipNeo120ParticipantReportPromptInput,
  type IpipNeo120ParticipantPromptSubdimension,
  type IpipNeo120ParticipantReportBand,
} from "@/lib/assessment/ipip-neo-120-report-contract";
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

function getIpipNeo120ScoreBand(averageScore: number): IpipNeo120ParticipantReportBand {
  if (averageScore >= 3.67) {
    return "higher";
  }

  if (averageScore >= 2.34) {
    return "balanced";
  }

  return "lower";
}

function getIpipNeo120HrScoreBand(averageScore: number): IpipNeo120HrReportBand {
  if (averageScore >= 3.67) {
    return "high";
  }

  if (averageScore >= 2.34) {
    return "moderate";
  }

  return "low";
}

function requireIpipNeo120FacetLabel(facetCode: IpipNeo120FacetCode): string {
  const label = getIpipNeo120FacetLabel(facetCode);

  if (!label) {
    throw new Error(`Missing canonical IPIP-NEO-120 facet label for code ${facetCode}`);
  }

  return label;
}

function requireIpipNeo120DomainLabel(domainCode: IpipNeo120DomainCode): string {
  const label = getIpipNeo120DomainLabel(domainCode);

  if (!label) {
    throw new Error(`Missing canonical IPIP-NEO-120 domain label for code ${domainCode}`);
  }

  return label;
}

function buildIpipNeo120ParticipantPromptInput(
  input: CompletedAssessmentReportRequest,
): IpipNeo120ParticipantReportPromptInput {
  const facetScores = new Map<
    IpipNeo120FacetCode,
    {
      rawScore: number;
      scoredQuestionCount: number;
      averageScore: number;
      domainCode: IpipNeo120DomainCode;
    }
  >();

  for (const dimension of input.results.dimensions) {
    const facetCode = dimension.dimension.trim().toUpperCase() as IpipNeo120FacetCode;
    const facetLabel = getIpipNeo120FacetLabel(facetCode);
    const domainCode = getIpipNeo120FacetDomainCode(facetCode);

    if (!facetLabel || !domainCode) {
      continue;
    }

    facetScores.set(facetCode, {
      rawScore: dimension.rawScore,
      scoredQuestionCount: dimension.scoredQuestionCount,
      averageScore: getAverageScore(dimension.rawScore, dimension.scoredQuestionCount),
      domainCode,
    });
  }

  const domains: IpipNeo120ParticipantPromptDomain[] = IPIP_NEO_120_DOMAIN_ORDER.map((domainCode) => {
    const facetCodes = IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode];
    const subdimensions: IpipNeo120ParticipantPromptSubdimension[] = facetCodes.map((facetCode) => {
      const score = facetScores.get(facetCode);

      return {
        facet_code: facetCode,
        label: requireIpipNeo120FacetLabel(facetCode),
        score: score?.averageScore ?? 0,
        band: getIpipNeo120ScoreBand(score?.averageScore ?? 0),
      };
    });
    const totalRawScore = facetCodes.reduce(
      (sum, facetCode) => sum + (facetScores.get(facetCode)?.rawScore ?? 0),
      0,
    );
    const totalQuestionCount = facetCodes.reduce(
      (sum, facetCode) => sum + (facetScores.get(facetCode)?.scoredQuestionCount ?? 0),
      0,
    );
    const averageScore = getAverageScore(totalRawScore, totalQuestionCount);

    return {
      domain_code: domainCode,
      label: requireIpipNeo120DomainLabel(domainCode),
      score: averageScore,
      band: getIpipNeo120ScoreBand(averageScore),
      subdimensions,
    };
  });

  const rankedDomains = [...domains]
    .sort((left, right) => right.score - left.score || left.domain_code.localeCompare(right.domain_code))
    .map((domain) => domain.domain_code);
  const topSubdimensions = [...facetScores.entries()]
    .sort((left, right) => right[1].averageScore - left[1].averageScore || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([facetCode]) => facetCode);

  return {
    attempt_id: input.attemptId,
    test_id: input.testId,
    test_slug: "ipip-neo-120-v1",
    test_name: input.testName ?? input.testSlug,
    test_family: IPIP_NEO_120_TEST_FAMILY,
    audience: "participant",
    locale: input.locale,
    scoring_method: input.scoringMethod,
    prompt_version: input.promptVersion,
    scored_response_count: input.results.scoredResponseCount,
    scale_hint: {
      min: 1,
      max: 5,
      display_mode: "visual_with_discreet_numeric_support",
    },
    domains,
    deterministic_summary: {
      highest_domain: rankedDomains[0] ?? null,
      lowest_domain: rankedDomains[rankedDomains.length - 1] ?? null,
      ranked_domains: rankedDomains,
      top_subdimensions: topSubdimensions,
    },
  };
}

function buildIpipNeo120HrPromptInput(
  input: CompletedAssessmentReportRequest,
): IpipNeo120HrReportPromptInput {
  const facetScores = new Map<
    IpipNeo120FacetCode,
    {
      rawScore: number;
      scoredQuestionCount: number;
      averageScore: number;
      domainCode: IpipNeo120DomainCode;
    }
  >();

  for (const dimension of input.results.dimensions) {
    const facetCode = dimension.dimension.trim().toUpperCase() as IpipNeo120FacetCode;
    const facetLabel = getIpipNeo120FacetLabel(facetCode);
    const domainCode = getIpipNeo120FacetDomainCode(facetCode);

    if (!facetLabel || !domainCode) {
      if (!facetLabel) {
        throw new Error(`unknown IPIP-NEO-120 HR facet code ${facetCode}`);
      }

      throw new Error(`unknown IPIP-NEO-120 HR domain code for facet ${facetCode}`);
    }

    facetScores.set(facetCode, {
      rawScore: dimension.rawScore,
      scoredQuestionCount: dimension.scoredQuestionCount,
      averageScore: getAverageScore(dimension.rawScore, dimension.scoredQuestionCount),
      domainCode,
    });
  }

  const domains: IpipNeo120HrPromptDomain[] = IPIP_NEO_120_DOMAIN_ORDER.map((domainCode) => {
    const facetCodes = IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode];
    const missingFacetCodes = facetCodes.filter((facetCode) => !facetScores.has(facetCode));

    if (missingFacetCodes.length > 0) {
      throw new Error(
        `missing complete facet set for domain ${domainCode}: missing expected IPIP-NEO-120 HR facet score for ${missingFacetCodes.join(", ")}`,
      );
    }

    const facets: IpipNeo120HrPromptFacet[] = facetCodes.map((facetCode) => {
      const score = facetScores.get(facetCode);

      if (!score) {
        throw new Error(`missing expected IPIP-NEO-120 HR facet score for ${facetCode}`);
      }

      return {
        facet_code: facetCode,
        label: requireIpipNeo120FacetLabel(facetCode),
        score: score.averageScore,
        score_band: getIpipNeo120HrScoreBand(score.averageScore),
      };
    });

    if (facets.length !== 6) {
      throw new Error(
        `missing complete facet set for domain ${domainCode}: expected 6 valid facets, received ${facets.length}`,
      );
    }

    const totalRawScore = facetCodes.reduce(
      (sum, facetCode) => {
        const facetScore = facetScores.get(facetCode);

        if (!facetScore) {
          throw new Error(`missing expected IPIP-NEO-120 HR facet score for ${facetCode}`);
        }

        return sum + facetScore.rawScore;
      },
      0,
    );
    const totalQuestionCount = facetCodes.reduce(
      (sum, facetCode) => {
        const facetScore = facetScores.get(facetCode);

        if (!facetScore) {
          throw new Error(`missing expected IPIP-NEO-120 HR facet score for ${facetCode}`);
        }

        return sum + facetScore.scoredQuestionCount;
      },
      0,
    );
    const averageScore = getAverageScore(totalRawScore, totalQuestionCount);

    return {
      domain_code: domainCode,
      label: requireIpipNeo120DomainLabel(domainCode),
      score: averageScore,
      score_band: getIpipNeo120HrScoreBand(averageScore),
      facets,
    };
  });

  const rankedDomains = [...domains]
    .sort((left, right) => right.score - left.score || left.domain_code.localeCompare(right.domain_code))
    .map((domain) => domain.domain_code);
  const topFacets = [...facetScores.entries()]
    .sort((left, right) => right[1].averageScore - left[1].averageScore || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([facetCode]) => facetCode);

  return {
    attempt_id: input.attemptId,
    test_id: input.testId,
    test_slug: "ipip-neo-120-v1",
    test_name: input.testName ?? input.testSlug,
    test_family: IPIP_NEO_120_TEST_FAMILY,
    audience: "hr",
    locale: input.locale,
    scoring_method: input.scoringMethod,
    prompt_version: input.promptVersion,
    scored_response_count: input.results.scoredResponseCount,
    scale_hint: {
      min: 1,
      max: 5,
      display_mode: "visual_with_discreet_numeric_support",
    },
    domains,
    deterministic_summary: {
      highest_domain: rankedDomains[0] ?? null,
      lowest_domain: rankedDomains[rankedDomains.length - 1] ?? null,
      ranked_domains: rankedDomains,
      top_facets: topFacets,
    },
  };
}

export function buildReportPromptInput(
  input: CompletedAssessmentReportRequest,
): ReportPromptInput {
  if (isIpipNeo120TestSlug(input.testSlug)) {
    return input.audience === "participant"
      ? buildIpipNeo120ParticipantPromptInput(input)
      : buildIpipNeo120HrPromptInput(input);
  }

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
