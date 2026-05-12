import "server-only";

import {
  buildCompositeReadinessFromLinkedAttempts,
  type CompositeReadinessState,
} from "@/lib/assessment/assessment-reports";
import {
  getIpipNeo120BandMeaningV2,
  getIpipNeo120DomainDefinitionV2,
  getIpipNeo120ParticipantDisplayBandForDomainV2,
  getIpipNeo120ParticipantDisplayBandLabelForDomainV2,
  getIpipNeo120ParticipantDisplayScoreForDomainV2,
  type IpipNeo120ParticipantBandV2,
} from "@/lib/assessment/ipip-neo-120-participant-ai-input-v2";
import {
  getIpipNeo120DomainLabel,
  getIpipNeo120FacetDomainCode,
  getIpipNeo120FacetLabel,
  IPIP_NEO_120_DOMAIN_ORDER,
  IPIP_NEO_120_FACETS_BY_DOMAIN,
  IPIP_NEO_120_TEST_SLUG,
  type IpipNeo120DomainCode,
  type IpipNeo120FacetCode,
} from "@/lib/assessment/ipip-neo-120-labels";
import { resolveReportLocale, type ReportLocale } from "@/lib/assessment/locale";
import { buildMwmsHrReportInput } from "@/lib/assessment/mwms-hr-report-v1";
import { MWMS_V1_TEST_SLUG, type MwmsDimensionCode } from "@/lib/assessment/mwms-scoring";
import { getAverageScore } from "@/lib/assessment/report-provider-helpers";
import {
  buildSafranHrReportInput,
  SAFRAN_HR_V1_TEST_SLUG,
  type SafranHrScoreSnapshot,
} from "@/lib/assessment/safran-hr-report-v1";
import {
  calculateCompletedAssessmentResults,
  type CompletedAssessmentResults,
} from "@/lib/assessment/scoring";
import { STANDARD_ASSESSMENT_BATTERY_SLUGS } from "@/lib/assessment/standard-battery";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const COMPOSITE_HR_INPUT_CONTRACT_VERSION = "composite_hr_input_v1" as const;
export const COMPOSITE_HR_REPORT_CONTRACT_VERSION = "composite_hr_v1" as const;
export const COMPOSITE_HR_SOURCE_TYPE = "assessment" as const;
export const COMPOSITE_HR_AUDIENCE = "hr" as const;
export const COMPOSITE_HR_REPORT_TYPE = "composite" as const;
export const COMPOSITE_HR_BUILDER_VERSION = "v1" as const;

type CompositeInputAssignmentType = "standard_battery";
type CompositeInputAssignmentStatus = "active" | "completed" | "cancelled";
type CompositeInputAttemptStatus = "in_progress" | "completed" | "abandoned";

export type CompositeHrInputAssessmentAssignment = {
  id: string;
  assignmentType: CompositeInputAssignmentType;
  status: CompositeInputAssignmentStatus;
  locale: ReportLocale;
  createdAt: string;
};

export type CompositeHrInputSourceAttempt = {
  attemptId: string;
  testId: string;
  testSlug: string;
  status: CompositeInputAttemptStatus;
  completedAt: string;
  requiredForComposite: boolean;
  requiredForTeamFit: boolean;
  position: number | null;
};

export type CompositeHrInputCoverage = {
  requiredCount: number;
  completedCount: number;
  requiredTestSlugs: string[];
  completedTestSlugs: string[];
  missingTestSlugs: string[];
};

export type CompositeHrIpipFacetInput = {
  facetCode: IpipNeo120FacetCode;
  label: string;
  domainCode: IpipNeo120DomainCode;
  rawScore: number;
  scoredQuestionCount: number;
  averageScore: number;
  band: IpipNeo120ParticipantBandV2;
  bandLabel: string;
};

export type CompositeHrIpipDomainInput = {
  domainCode: IpipNeo120DomainCode;
  label: string;
  rawScore: number;
  scoredQuestionCount: number;
  averageScore: number;
  band: IpipNeo120ParticipantBandV2;
  bandLabel: string;
  displayScore: number;
  displayBand: IpipNeo120ParticipantBandV2;
  displayBandLabel: string;
  facets: CompositeHrIpipFacetInput[];
};

export type CompositeHrIpipSummarySignals = {
  rankedDomains: IpipNeo120DomainCode[];
  highestDomains: IpipNeo120DomainCode[];
  lowestDomains: IpipNeo120DomainCode[];
  balancedDomains: IpipNeo120DomainCode[];
  topFacets: IpipNeo120FacetCode[];
  lowestFacets: IpipNeo120FacetCode[];
};

export type CompositeHrIpipInput = {
  attemptId: string;
  testId: string;
  testSlug: typeof IPIP_NEO_120_TEST_SLUG;
  scale: {
    min: 1;
    max: 5;
  };
  domains: CompositeHrIpipDomainInput[];
  summarySignals: CompositeHrIpipSummarySignals;
};

export type CompositeHrSafranInput = {
  attemptId: string;
  testId: string;
  testSlug: typeof SAFRAN_HR_V1_TEST_SLUG;
  overall: SafranHrScoreSnapshot;
  verbal: SafranHrScoreSnapshot;
  figural: SafranHrScoreSnapshot;
  numeric: SafranHrScoreSnapshot;
  summarySignals: {
    strongestDomain: "verbal" | "figural" | "numeric" | null;
    lowestDomain: "verbal" | "figural" | "numeric" | null;
  };
};

export type CompositeHrMwmsDimensionInput = {
  code: MwmsDimensionCode;
  label: string;
  rawScore: number;
  band: "lower" | "moderate" | "higher";
  bandLabel: string;
};

export type CompositeHrMwmsInput = {
  attemptId: string;
  testId: string;
  testSlug: typeof MWMS_V1_TEST_SLUG;
  scale: {
    min: 1;
    max: 7;
  };
  dimensions: CompositeHrMwmsDimensionInput[];
  motivationStructure: {
    autonomousMotivationScore: number;
    controlledMotivationScore: number;
    amotivationScore: number;
  };
  summarySignals: {
    dominantDrivers: MwmsDimensionCode[];
    lowerDrivers: MwmsDimensionCode[];
    cautionFlags: {
      elevatedAmotivation: boolean;
      highControlledRelativeToAutonomous: boolean;
      mixedProfile: boolean;
    };
  };
};

export type CompositeHrDeterministicInputs = {
  ipip: CompositeHrIpipInput;
  safran: CompositeHrSafranInput;
  mwms: CompositeHrMwmsInput;
};

export type CompositeHrInputSummarySignals = {
  personalityHighestDomains: IpipNeo120DomainCode[];
  personalityLowestDomains: IpipNeo120DomainCode[];
  cognitiveStrongestDomain: "verbal" | "figural" | "numeric" | null;
  cognitiveLowestDomain: "verbal" | "figural" | "numeric" | null;
  motivationHighestDrivers: MwmsDimensionCode[];
  motivationLowestDrivers: MwmsDimensionCode[];
  crossInstrumentFlags: string[];
};

export type CompositeHrInputSnapshot = {
  contractVersion: typeof COMPOSITE_HR_INPUT_CONTRACT_VERSION;
  targetReportContractVersion: typeof COMPOSITE_HR_REPORT_CONTRACT_VERSION;
  sourceType: typeof COMPOSITE_HR_SOURCE_TYPE;
  reportType: typeof COMPOSITE_HR_REPORT_TYPE;
  audience: typeof COMPOSITE_HR_AUDIENCE;
  locale: ReportLocale;
  generatedFor: {
    organizationId: string;
    participantId: string;
    assessmentAssignmentId: string;
  };
  assessmentAssignment: CompositeHrInputAssessmentAssignment;
  sourceAttempts: [
    CompositeHrInputSourceAttempt,
    CompositeHrInputSourceAttempt,
    CompositeHrInputSourceAttempt,
  ];
  coverage: CompositeHrInputCoverage;
  deterministicInputs: CompositeHrDeterministicInputs;
  summarySignals: CompositeHrInputSummarySignals;
  guardrails: {
    usesOnlyLinkedAssignmentAttempts: true;
    usesHistoricalAttemptFallback: false;
    usesSingleTestAiReportsAsPrimaryInput: false;
    aiMayNotChangeScores: true;
  };
  metadata: {
    builtAt: string;
    builderVersion: typeof COMPOSITE_HR_BUILDER_VERSION;
  };
};

export type CompositeInputAssignmentRecord = {
  id: string;
  organization_id: string;
  participant_id: string;
  assignment_type: CompositeInputAssignmentType;
  status: CompositeInputAssignmentStatus;
  locale: string | null;
  created_at: string;
};

export type CompositeInputLinkedAttemptRecord = {
  assessment_assignment_id: string;
  attempt_id: string;
  test_id: string;
  test_slug: string;
  required_for_composite: boolean;
  required_for_team_fit: boolean;
  position: number | null;
  attempts:
    | {
        status: CompositeInputAttemptStatus;
        completed_at: string | null;
      }
    | Array<{
        status: CompositeInputAttemptStatus;
        completed_at: string | null;
      }>
    | null;
};

export type CompositeInputPreparedAttempt = {
  assessmentAssignmentId: string;
  attemptId: string;
  testId: string;
  testSlug: string;
  status: CompositeInputAttemptStatus;
  completedAt: string | null;
  requiredForComposite: boolean;
  requiredForTeamFit: boolean;
  position: number | null;
  results: CompletedAssessmentResults;
};

export type CompositeHrInputBuilderData = {
  assignment: CompositeInputAssignmentRecord;
  linkedAttempts: CompositeInputPreparedAttempt[];
  locale?: string | null;
  builtAt?: string;
};

function normalizeAttemptRelation(
  value: CompositeInputLinkedAttemptRecord["attempts"],
): { status: CompositeInputAttemptStatus; completed_at: string | null } | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function getExpectedRequiredTestSlugs(assignmentType: CompositeInputAssignmentType): readonly string[] {
  if (assignmentType === "standard_battery") {
    return STANDARD_ASSESSMENT_BATTERY_SLUGS;
  }

  return [];
}

function getIpipScoreBand(averageScore: number): IpipNeo120ParticipantBandV2 {
  if (averageScore >= 3.67) {
    return "higher";
  }

  if (averageScore >= 2.34) {
    return "balanced";
  }

  return "lower";
}

function requireIpipBandLabel(band: IpipNeo120ParticipantBandV2): string {
  const label = getIpipNeo120BandMeaningV2(band)?.label;

  if (!label) {
    throw new Error(`Unsupported IPIP band ${band}.`);
  }

  return label;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildCoverage(readiness: CompositeReadinessState): CompositeHrInputCoverage {
  const requiredComponents = readiness.components.filter((component) => component.required_for_composite);
  const completedComponents = requiredComponents.filter(
    (component) => component.attempt_status === "completed" && typeof component.completed_at === "string",
  );
  const missingComponents = requiredComponents.filter(
    (component) => component.attempt_status !== "completed" || typeof component.completed_at !== "string",
  );

  return {
    requiredCount: readiness.requiredCount,
    completedCount: readiness.completedCount,
    requiredTestSlugs: requiredComponents.map((component) => component.test_slug),
    completedTestSlugs: completedComponents.map((component) => component.test_slug),
    missingTestSlugs: missingComponents.map((component) => component.test_slug),
  };
}

function buildIpipCompositeInput(
  attempt: CompositeInputPreparedAttempt,
): CompositeHrIpipInput {
  if (attempt.testSlug !== IPIP_NEO_120_TEST_SLUG) {
    throw new Error(`IPIP composite input requires ${IPIP_NEO_120_TEST_SLUG}.`);
  }

  const facetByCode = new Map(
    attempt.results.dimensions.map((dimension) => [dimension.dimension.toUpperCase(), dimension]),
  );
  const facetInputs: CompositeHrIpipFacetInput[] = [];
  const domainInputs = IPIP_NEO_120_DOMAIN_ORDER.map((domainCode) => {
    const domainDefinition = getIpipNeo120DomainDefinitionV2(domainCode);

    if (!domainDefinition) {
      throw new Error(`Missing IPIP domain definition for ${domainCode}.`);
    }

    const facets = IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].map((facetCode) => {
      const facet = facetByCode.get(facetCode);

      if (!facet) {
        throw new Error(`Missing IPIP facet score for ${facetCode} in attempt ${attempt.attemptId}.`);
      }

      const averageScore = getAverageScore(facet.rawScore, facet.scoredQuestionCount);
      const band = getIpipScoreBand(averageScore);
      const input = {
        facetCode,
        label: getIpipNeo120FacetLabel(facetCode) ?? facetCode,
        domainCode,
        rawScore: facet.rawScore,
        scoredQuestionCount: facet.scoredQuestionCount,
        averageScore,
        band,
        bandLabel: requireIpipBandLabel(band),
      } satisfies CompositeHrIpipFacetInput;

      facetInputs.push(input);
      return input;
    });
    const domainRawScore = facets.reduce((sum, facet) => sum + facet.rawScore, 0);
    const domainQuestionCount = facets.reduce((sum, facet) => sum + facet.scoredQuestionCount, 0);
    const averageScore = getAverageScore(domainRawScore, domainQuestionCount);
    const band = getIpipScoreBand(averageScore);
    const displayScore = getIpipNeo120ParticipantDisplayScoreForDomainV2(domainCode, averageScore);
    const displayBand = getIpipNeo120ParticipantDisplayBandForDomainV2(domainCode, band);
    const displayBandLabel = getIpipNeo120ParticipantDisplayBandLabelForDomainV2(domainCode, band);

    if (
      displayScore === null ||
      displayBand === null ||
      displayBandLabel === null
    ) {
      throw new Error(`Missing IPIP participant display mapping for ${domainCode}.`);
    }

    return {
      domainCode,
      label: getIpipNeo120DomainLabel(domainCode) ?? domainDefinition.label,
      rawScore: domainRawScore,
      scoredQuestionCount: domainQuestionCount,
      averageScore,
      band,
      bandLabel: requireIpipBandLabel(band),
      displayScore: roundScore(displayScore),
      displayBand,
      displayBandLabel,
      facets,
    } satisfies CompositeHrIpipDomainInput;
  });
  const rankedDomains = [...domainInputs]
    .sort((left, right) => right.averageScore - left.averageScore || left.domainCode.localeCompare(right.domainCode))
    .map((domain) => domain.domainCode);
  const highestDomainScore = domainInputs[0]
    ? Math.max(...domainInputs.map((domain) => domain.averageScore))
    : null;
  const lowestDomainScore = domainInputs[0]
    ? Math.min(...domainInputs.map((domain) => domain.averageScore))
    : null;
  const sortedFacets = [...facetInputs].sort(
    (left, right) => right.averageScore - left.averageScore || left.facetCode.localeCompare(right.facetCode),
  );

  return {
    attemptId: attempt.attemptId,
    testId: attempt.testId,
    testSlug: IPIP_NEO_120_TEST_SLUG,
    scale: {
      min: 1,
      max: 5,
    },
    domains: domainInputs,
    summarySignals: {
      rankedDomains,
      highestDomains:
        highestDomainScore === null
          ? []
          : domainInputs
              .filter((domain) => domain.averageScore === highestDomainScore)
              .map((domain) => domain.domainCode),
      lowestDomains:
        lowestDomainScore === null
          ? []
          : domainInputs
              .filter((domain) => domain.averageScore === lowestDomainScore)
              .map((domain) => domain.domainCode),
      balancedDomains: domainInputs
        .filter((domain) => domain.band === "balanced")
        .map((domain) => domain.domainCode),
      topFacets: sortedFacets.slice(0, 3).map((facet) => facet.facetCode),
      lowestFacets: sortedFacets.slice(-3).reverse().map((facet) => facet.facetCode),
    },
  };
}

function buildSafranCompositeInput(
  attempt: CompositeInputPreparedAttempt,
  locale: ReportLocale,
): CompositeHrSafranInput {
  if (attempt.testSlug !== SAFRAN_HR_V1_TEST_SLUG) {
    throw new Error(`SAFRAN composite input requires ${SAFRAN_HR_V1_TEST_SLUG}.`);
  }

  const input = buildSafranHrReportInput({
    testSlug: attempt.testSlug,
    locale,
    results: attempt.results,
  });
  const domainScores = [
    { key: "verbal", score: input.scores.verbal.rawScore },
    { key: "figural", score: input.scores.figural.rawScore },
    { key: "numeric", score: input.scores.numeric.rawScore },
  ] as const;
  const strongestScore = Math.max(...domainScores.map((entry) => entry.score));
  const lowestScore = Math.min(...domainScores.map((entry) => entry.score));

  return {
    attemptId: attempt.attemptId,
    testId: attempt.testId,
    testSlug: SAFRAN_HR_V1_TEST_SLUG,
    overall: input.scores.overall,
    verbal: input.scores.verbal,
    figural: input.scores.figural,
    numeric: input.scores.numeric,
    summarySignals: {
      strongestDomain:
        domainScores.find((entry) => entry.score === strongestScore)?.key ?? null,
      lowestDomain:
        domainScores.find((entry) => entry.score === lowestScore)?.key ?? null,
    },
  };
}

function buildMwmsCompositeInput(
  attempt: CompositeInputPreparedAttempt,
  locale: ReportLocale,
): CompositeHrMwmsInput {
  if (attempt.testSlug !== MWMS_V1_TEST_SLUG) {
    throw new Error(`MWMS composite input requires ${MWMS_V1_TEST_SLUG}.`);
  }

  const input = buildMwmsHrReportInput({
    attemptId: attempt.attemptId,
    testId: attempt.testId,
    testSlug: attempt.testSlug,
    audience: "hr",
    locale,
    scoringMethod: attempt.results.scoringMethod,
    promptVersion: COMPOSITE_HR_INPUT_CONTRACT_VERSION,
    results: attempt.results,
  });

  return {
    attemptId: attempt.attemptId,
    testId: attempt.testId,
    testSlug: MWMS_V1_TEST_SLUG,
    scale: input.scale,
    dimensions: input.dimensions.map((dimension) => ({
      code: dimension.code,
      label: dimension.label,
      rawScore: dimension.rawScore,
      band: dimension.band,
      bandLabel: dimension.bandLabel,
    })),
    motivationStructure: {
      autonomousMotivationScore: input.derivedProfile.autonomousMotivationScore,
      controlledMotivationScore: input.derivedProfile.controlledMotivationScore,
      amotivationScore: input.derivedProfile.amotivationScore,
    },
    summarySignals: {
      dominantDrivers: [...input.derivedProfile.dominantDimensions],
      lowerDrivers: [...input.derivedProfile.lowerDimensions],
      cautionFlags: input.derivedProfile.cautionFlags,
    },
  };
}

function sortPreparedAttempts(
  left: CompositeInputPreparedAttempt,
  right: CompositeInputPreparedAttempt,
): number {
  const leftPosition = left.position ?? Number.MAX_SAFE_INTEGER;
  const rightPosition = right.position ?? Number.MAX_SAFE_INTEGER;

  if (leftPosition !== rightPosition) {
    return leftPosition - rightPosition;
  }

  return left.testSlug.localeCompare(right.testSlug);
}

function normalizePreparedAttemptForReadiness(
  attempt: CompositeInputPreparedAttempt,
): CompositeInputLinkedAttemptRecord {
  return {
    assessment_assignment_id: attempt.assessmentAssignmentId,
    attempt_id: attempt.attemptId,
    test_id: attempt.testId,
    test_slug: attempt.testSlug,
    required_for_composite: attempt.requiredForComposite,
    required_for_team_fit: attempt.requiredForTeamFit,
    position: attempt.position,
    attempts: {
      status: attempt.status,
      completed_at: attempt.completedAt,
    },
  };
}

export function buildCompositeHrInputSnapshotFromLoadedData(
  input: CompositeHrInputBuilderData,
): CompositeHrInputSnapshot {
  if (input.assignment.assignment_type !== "standard_battery") {
    throw new Error(
      `Composite HR input snapshot supports only standard_battery assignments, received ${input.assignment.assignment_type}.`,
    );
  }

  const locale = resolveReportLocale(input.locale ?? input.assignment.locale);
  const readiness = buildCompositeReadinessFromLinkedAttempts(
    input.linkedAttempts.map(normalizePreparedAttemptForReadiness),
    {
      expectedRequiredTestSlugs: getExpectedRequiredTestSlugs(input.assignment.assignment_type),
    },
  );

  if (readiness.status !== "ready") {
    throw new Error(
      `Composite HR input snapshot requires ready linked attempts for assignment ${input.assignment.id}.`,
    );
  }

  const requiredAttempts = input.linkedAttempts
    .filter((attempt) => attempt.requiredForComposite)
    .sort(sortPreparedAttempts);
  const ipipAttempt = requiredAttempts.find((attempt) => attempt.testSlug === IPIP_NEO_120_TEST_SLUG);
  const safranAttempt = requiredAttempts.find((attempt) => attempt.testSlug === SAFRAN_HR_V1_TEST_SLUG);
  const mwmsAttempt = requiredAttempts.find((attempt) => attempt.testSlug === MWMS_V1_TEST_SLUG);

  if (!ipipAttempt || !safranAttempt || !mwmsAttempt) {
    throw new Error(
      `Composite HR input snapshot requires linked completed IPIP, SAFRAN and MWMS attempts for assignment ${input.assignment.id}.`,
    );
  }

  const deterministicInputs = {
    ipip: buildIpipCompositeInput(ipipAttempt),
    safran: buildSafranCompositeInput(safranAttempt, locale),
    mwms: buildMwmsCompositeInput(mwmsAttempt, locale),
  } satisfies CompositeHrDeterministicInputs;

  return {
    contractVersion: COMPOSITE_HR_INPUT_CONTRACT_VERSION,
    targetReportContractVersion: COMPOSITE_HR_REPORT_CONTRACT_VERSION,
    sourceType: COMPOSITE_HR_SOURCE_TYPE,
    reportType: COMPOSITE_HR_REPORT_TYPE,
    audience: COMPOSITE_HR_AUDIENCE,
    locale,
    generatedFor: {
      organizationId: input.assignment.organization_id,
      participantId: input.assignment.participant_id,
      assessmentAssignmentId: input.assignment.id,
    },
    assessmentAssignment: {
      id: input.assignment.id,
      assignmentType: input.assignment.assignment_type,
      status: input.assignment.status,
      locale,
      createdAt: input.assignment.created_at,
    },
    sourceAttempts: requiredAttempts.map((attempt) => ({
      attemptId: attempt.attemptId,
      testId: attempt.testId,
      testSlug: attempt.testSlug,
      status: attempt.status,
      completedAt: attempt.completedAt ?? "",
      requiredForComposite: attempt.requiredForComposite,
      requiredForTeamFit: attempt.requiredForTeamFit,
      position: attempt.position,
    })) as CompositeHrInputSnapshot["sourceAttempts"],
    coverage: buildCoverage(readiness),
    deterministicInputs,
    summarySignals: {
      personalityHighestDomains: deterministicInputs.ipip.summarySignals.highestDomains,
      personalityLowestDomains: deterministicInputs.ipip.summarySignals.lowestDomains,
      cognitiveStrongestDomain: deterministicInputs.safran.summarySignals.strongestDomain,
      cognitiveLowestDomain: deterministicInputs.safran.summarySignals.lowestDomain,
      motivationHighestDrivers: deterministicInputs.mwms.summarySignals.dominantDrivers,
      motivationLowestDrivers: deterministicInputs.mwms.summarySignals.lowerDrivers,
      crossInstrumentFlags: [],
    },
    guardrails: {
      usesOnlyLinkedAssignmentAttempts: true,
      usesHistoricalAttemptFallback: false,
      usesSingleTestAiReportsAsPrimaryInput: false,
      aiMayNotChangeScores: true,
    },
    metadata: {
      builtAt: input.builtAt ?? new Date().toISOString(),
      builderVersion: COMPOSITE_HR_BUILDER_VERSION,
    },
  };
}

export async function buildCompositeHrInputSnapshot(input: {
  assessmentAssignmentId: string;
  organizationId?: string;
  participantId?: string;
  locale?: string | null;
}): Promise<CompositeHrInputSnapshot> {
  const supabase = createSupabaseAdminClient();
  const { data: assignmentData, error: assignmentError } = await supabase
    .from("assessment_assignments")
    .select("id, organization_id, participant_id, assignment_type, status, locale, created_at")
    .eq("id", input.assessmentAssignmentId)
    .maybeSingle();

  if (assignmentError) {
    throw new Error(`Failed to load assessment assignment for composite HR input: ${assignmentError.message}`);
  }

  const assignment = assignmentData as CompositeInputAssignmentRecord | null;

  if (!assignment) {
    throw new Error(`Assessment assignment ${input.assessmentAssignmentId} was not found.`);
  }

  if (input.organizationId && assignment.organization_id !== input.organizationId) {
    throw new Error(
      `Assessment assignment ${input.assessmentAssignmentId} does not belong to organization ${input.organizationId}.`,
    );
  }

  if (input.participantId && assignment.participant_id !== input.participantId) {
    throw new Error(
      `Assessment assignment ${input.assessmentAssignmentId} does not belong to participant ${input.participantId}.`,
    );
  }

  const { data: linkedAttemptData, error: linkedAttemptError } = await supabase
    .from("assessment_assignment_attempts")
    .select(
      "assessment_assignment_id, attempt_id, test_id, test_slug, required_for_composite, required_for_team_fit, position, attempts(status, completed_at)",
    )
    .eq("assessment_assignment_id", input.assessmentAssignmentId);

  if (linkedAttemptError) {
    throw new Error(`Failed to load linked attempts for composite HR input: ${linkedAttemptError.message}`);
  }

  const linkedAttempts = await Promise.all(
    ((linkedAttemptData ?? []) as CompositeInputLinkedAttemptRecord[]).map(async (row) => {
      const attempt = normalizeAttemptRelation(row.attempts);

      if (!attempt) {
        throw new Error(`Assessment assignment attempt ${row.attempt_id} is missing its attempt row.`);
      }

      const results = await calculateCompletedAssessmentResults(row.test_id, row.attempt_id);

      if (!results) {
        throw new Error(
          `Composite HR input snapshot requires deterministic score results for attempt ${row.attempt_id}.`,
        );
      }

      return {
        assessmentAssignmentId: row.assessment_assignment_id,
        attemptId: row.attempt_id,
        testId: row.test_id,
        testSlug: row.test_slug,
        status: attempt.status,
        completedAt: attempt.completed_at,
        requiredForComposite: row.required_for_composite,
        requiredForTeamFit: row.required_for_team_fit,
        position: row.position,
        results,
      } satisfies CompositeInputPreparedAttempt;
    }),
  );

  return buildCompositeHrInputSnapshotFromLoadedData({
    assignment,
    linkedAttempts,
    locale: input.locale,
  });
}
