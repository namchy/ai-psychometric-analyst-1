import "server-only";

import {
  buildCompositeHrInputSnapshotFromLoadedData,
  COMPOSITE_HR_BUILDER_VERSION,
  COMPOSITE_HR_INPUT_CONTRACT_VERSION,
  type CompositeInputAssignmentRecord,
  type CompositeInputLinkedAttemptRecord,
  type CompositeInputPreparedAttempt,
} from "@/lib/assessment/composite-input";
import {
  getIpipNeo120HrDomainLabel,
  getIpipNeo120FacetDomainCode,
  IPIP_NEO_120_DOMAIN_ORDER,
  IPIP_NEO_120_TEST_SLUG,
  type IpipNeo120DomainCode,
} from "@/lib/assessment/ipip-neo-120-labels";
import { resolveReportLocale } from "@/lib/assessment/locale";
import { buildMwmsHrReportInput } from "@/lib/assessment/mwms-hr-report-v1";
import { MWMS_V1_TEST_SLUG } from "@/lib/assessment/mwms-scoring";
import { buildSafranHrReportInput, SAFRAN_HR_V1_TEST_SLUG } from "@/lib/assessment/safran-hr-report-v1";
import {
  calculateCompletedAssessmentResults,
  type CompletedAssessmentResults,
} from "@/lib/assessment/scoring";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_TYPE =
  "individual_development_profile_input_v1" as const;
export const INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION =
  "individual_development_profile_input_v1" as const;

export type IndividualDevelopmentProfileInputSourceStatus =
  | "available"
  | "unavailable"
  | "partial"
  | "invalid";

export type IndividualDevelopmentProfileInputSignal = {
  code: string;
  label: string;
  signal: string;
};

export type IndividualDevelopmentProfileInputCompositeSignal = {
  code: string;
  label: string;
  signal: string;
};

export type IndividualDevelopmentProfileInputSourceBlock = {
  sourceStatus: IndividualDevelopmentProfileInputSourceStatus;
  summary: string | null;
  relevantSignals?: IndividualDevelopmentProfileInputSignal[];
  integratedSignals?: IndividualDevelopmentProfileInputCompositeSignal[];
  sourceMetadata?: Record<string, unknown>;
};

export type IndividualDevelopmentProfileInputSnapshot = {
  inputType: typeof INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_TYPE;
  inputVersion: typeof INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION;
  locale: string;
  participant: {
    participantId: string;
    displayName: string | null;
  };
  sourceSignals: {
    personality: IndividualDevelopmentProfileInputSourceBlock;
    motivation: IndividualDevelopmentProfileInputSourceBlock;
    problemSolving: IndividualDevelopmentProfileInputSourceBlock;
    composite: IndividualDevelopmentProfileInputSourceBlock;
  };
  interpretationLimits: string[];
  sourceMetadata: {
    assessmentAssignmentId: string | null;
    sourceVersions: Array<Record<string, unknown>>;
  };
};

export type IndividualDevelopmentProfileInputBuilderFailureReason =
  | "invalid_payload"
  | "assignment_not_found"
  | "participant_not_found"
  | "assignment_organization_mismatch"
  | "assignment_participant_mismatch"
  | "assignment_load_failed"
  | "participant_load_failed"
  | "linked_attempt_load_failed";

export type IndividualDevelopmentProfileInputBuilderResult =
  | { ok: true; inputSnapshot: IndividualDevelopmentProfileInputSnapshot }
  | {
      ok: false;
      reason: IndividualDevelopmentProfileInputBuilderFailureReason;
      details: string;
    };

type ParticipantRecord = {
  id: string;
  organization_id: string;
  full_name: string | null;
};

type AttemptStatus = "in_progress" | "completed" | "abandoned";

type AttemptRelationRecord = {
  status: AttemptStatus;
  completed_at: string | null;
  addressing_form_snapshot: unknown;
} | null;

type LoadedAttemptSource = {
  assessmentAssignmentId: string;
  attemptId: string;
  testId: string;
  testSlug: string;
  attemptStatus: AttemptStatus | null;
  completedAt: string | null;
  addressingFormSnapshot: unknown;
  requiredForComposite: boolean;
  requiredForTeamFit: boolean;
  position: number | null;
  results: CompletedAssessmentResults | null;
  resultsError: string | null;
};

export type IndividualDevelopmentProfileInputLoadedData = {
  assignment: CompositeInputAssignmentRecord;
  participant: ParticipantRecord;
  locale?: string | null;
  linkedAttempts: LoadedAttemptSource[];
};

type IndividualDevelopmentProfileInputDependencies = {
  calculateCompletedResults?: typeof calculateCompletedAssessmentResults;
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeAttemptRelation(
  value: CompositeInputLinkedAttemptRecord["attempts"],
): AttemptRelationRecord {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function buildFailure(
  reason: IndividualDevelopmentProfileInputBuilderFailureReason,
  details: string,
): IndividualDevelopmentProfileInputBuilderResult {
  return { ok: false, reason, details };
}

function buildUnavailableSourceBlock(input: {
  testSlug: string;
  sourceStatus: "unavailable" | "partial" | "invalid";
  reason: string;
  attemptId?: string | null;
}): IndividualDevelopmentProfileInputSourceBlock {
  return {
    sourceStatus: input.sourceStatus,
    summary: null,
    relevantSignals: [],
    sourceMetadata: {
      testSlug: input.testSlug,
      attemptId: input.attemptId ?? null,
      reason: input.reason,
    },
  };
}

function getIpipDomainScores(results: CompletedAssessmentResults) {
  const facetScores = new Map(
    results.dimensions.map((dimension) => [dimension.dimension.toUpperCase(), dimension]),
  );

  return IPIP_NEO_120_DOMAIN_ORDER.map((domainCode) => {
    const facetCodes = Object.keys(
      facetScores
        ? Object.fromEntries(
            [...facetScores.keys()]
              .filter((facetCode) => getIpipNeo120FacetDomainCode(facetCode as never) === domainCode)
              .map((facetCode) => [facetCode, true]),
          )
        : {},
    ) as string[];
    const domainRawScore = facetCodes.reduce(
      (sum, facetCode) => sum + (facetScores.get(facetCode)?.rawScore ?? 0),
      0,
    );

    return {
      code: domainCode,
      label: getIpipNeo120HrDomainLabel(domainCode) ?? domainCode,
      rawScore: domainRawScore,
    };
  }).sort((left, right) => right.rawScore - left.rawScore);
}

function buildPersonalitySourceBlock(input: {
  source: LoadedAttemptSource | null;
}): IndividualDevelopmentProfileInputSourceBlock {
  const source = input.source;

  if (!source) {
    return buildUnavailableSourceBlock({
      testSlug: IPIP_NEO_120_TEST_SLUG,
      sourceStatus: "unavailable",
      reason: "linked_attempt_missing",
    });
  }

  if (source.attemptStatus === null) {
    return buildUnavailableSourceBlock({
      testSlug: source.testSlug,
      sourceStatus: "invalid",
      reason: "attempt_row_missing",
      attemptId: source.attemptId,
    });
  }

  if (source.attemptStatus !== "completed" || !isNonEmptyString(source.completedAt)) {
    return buildUnavailableSourceBlock({
      testSlug: source.testSlug,
      sourceStatus: source.attemptStatus === "in_progress" ? "partial" : "unavailable",
      reason: `attempt_status_${source.attemptStatus}`,
      attemptId: source.attemptId,
    });
  }

  if (source.resultsError) {
    return buildUnavailableSourceBlock({
      testSlug: source.testSlug,
      sourceStatus: "invalid",
      reason: source.resultsError,
      attemptId: source.attemptId,
    });
  }

  if (!source.results) {
    return buildUnavailableSourceBlock({
      testSlug: source.testSlug,
      sourceStatus: "invalid",
      reason: "deterministic_results_missing",
      attemptId: source.attemptId,
    });
  }

  const domainScores = getIpipDomainScores(source.results);
  const highest = domainScores.slice(0, 2);
  const lowest = domainScores.slice(-2).reverse();

  return {
    sourceStatus: "available",
    summary: `Najizraženiji signali djeluju u domenama ${highest
      .map((entry) => entry.label.toLowerCase())
      .join(" i ")}, dok više provjere vrijedi uložiti oko domena ${lowest
      .map((entry) => entry.label.toLowerCase())
      .join(" i ")}.`,
    relevantSignals: [
      ...highest.map((entry) => ({
        code: entry.code,
        label: entry.label,
        signal: `Povišen signal u domeni ${entry.label.toLowerCase()} vrijedi čitati kao razvojnu hipotezu za način rada i saradnje.`,
      })),
      ...lowest.map((entry) => ({
        code: entry.code,
        label: entry.label,
        signal: `Niži relativni signal u domeni ${entry.label.toLowerCase()} vrijedi provjeriti kroz razvojni razgovor, ne kao konačan zaključak.`,
      })),
    ],
    sourceMetadata: {
      testSlug: source.testSlug,
      attemptId: source.attemptId,
      scoredResponseCount: source.results.scoredResponseCount,
      scoringMethod: source.results.scoringMethod,
    },
  };
}

function buildMotivationSourceBlock(input: {
  source: LoadedAttemptSource | null;
  locale: string;
}): IndividualDevelopmentProfileInputSourceBlock {
  const source = input.source;

  if (!source) {
    return buildUnavailableSourceBlock({
      testSlug: MWMS_V1_TEST_SLUG,
      sourceStatus: "unavailable",
      reason: "linked_attempt_missing",
    });
  }

  if (source.attemptStatus === null) {
    return buildUnavailableSourceBlock({
      testSlug: source.testSlug,
      sourceStatus: "invalid",
      reason: "attempt_row_missing",
      attemptId: source.attemptId,
    });
  }

  if (source.attemptStatus !== "completed" || !isNonEmptyString(source.completedAt)) {
    return buildUnavailableSourceBlock({
      testSlug: source.testSlug,
      sourceStatus: source.attemptStatus === "in_progress" ? "partial" : "unavailable",
      reason: `attempt_status_${source.attemptStatus}`,
      attemptId: source.attemptId,
    });
  }

  if (source.resultsError) {
    return buildUnavailableSourceBlock({
      testSlug: source.testSlug,
      sourceStatus: "invalid",
      reason: source.resultsError,
      attemptId: source.attemptId,
    });
  }

  if (!source.results) {
    return buildUnavailableSourceBlock({
      testSlug: source.testSlug,
      sourceStatus: "invalid",
      reason: "deterministic_results_missing",
      attemptId: source.attemptId,
    });
  }

  const mwmsInput = buildMwmsHrReportInput({
    attemptId: source.attemptId,
    testId: source.testId,
    testSlug: source.testSlug,
    audience: "hr",
    locale: input.locale as never,
    scoringMethod: source.results.scoringMethod,
    promptVersion: INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION,
    results: source.results,
  });

  const dominantLabels = mwmsInput.derivedProfile.dominantDimensions.map(
    (code) => mwmsInput.dimensions.find((dimension) => dimension.code === code)?.label ?? code,
  );
  const lowerLabels = mwmsInput.derivedProfile.lowerDimensions.map(
    (code) => mwmsInput.dimensions.find((dimension) => dimension.code === code)?.label ?? code,
  );
  const cautionFlags = mwmsInput.derivedProfile.cautionFlags;

  return {
    sourceStatus: "available",
    summary: `Dominantni motivacijski signali djeluju oko ${dominantLabels
      .map((label) => label.toLowerCase())
      .join(" i ")}, dok više provjere vrijedi uložiti oko ${lowerLabels
      .map((label) => label.toLowerCase())
      .join(" i ")}.`,
    relevantSignals: [
      ...dominantLabels.map((label, index) => ({
        code: mwmsInput.derivedProfile.dominantDimensions[index],
        label,
        signal: `Ovaj signal može pomagati angažmanu kada je rad povezan sa ${label.toLowerCase()}.`,
      })),
      ...[
        cautionFlags.elevatedAmotivation
          ? {
              code: "elevated_amotivation",
              label: "Povišen signal amotivacije",
              signal:
                "Vrijedi provjeriti da li osoba trenutno vidi dovoljno smisla, energije ili kontrole u radu.",
            }
          : null,
        cautionFlags.highControlledRelativeToAutonomous
          ? {
              code: "high_controlled_relative_to_autonomous",
              label: "Veća osjetljivost na vanjsku strukturu",
              signal:
                "Vrijedi provjeriti koliko priznanje, očekivanja i vanjski okvir utiču na održavanje angažmana.",
            }
          : null,
        cautionFlags.mixedProfile
          ? {
              code: "mixed_profile",
              label: "Mješovit motivacijski obrazac",
              signal:
                "Signal traži dodatni razgovor jer kombinacija motivacijskih izvora može zavisiti od konteksta rada.",
            }
          : null,
      ].filter((entry): entry is IndividualDevelopmentProfileInputSignal => Boolean(entry)),
    ],
    sourceMetadata: {
      testSlug: source.testSlug,
      attemptId: source.attemptId,
      promptVersion: mwmsInput.promptVersion,
      scoringMethod: mwmsInput.scoringMethod,
    },
  };
}

function buildProblemSolvingSourceBlock(input: {
  source: LoadedAttemptSource | null;
  locale: string;
}): IndividualDevelopmentProfileInputSourceBlock {
  const source = input.source;

  if (!source) {
    return buildUnavailableSourceBlock({
      testSlug: SAFRAN_HR_V1_TEST_SLUG,
      sourceStatus: "unavailable",
      reason: "linked_attempt_missing",
    });
  }

  if (source.attemptStatus === null) {
    return buildUnavailableSourceBlock({
      testSlug: source.testSlug,
      sourceStatus: "invalid",
      reason: "attempt_row_missing",
      attemptId: source.attemptId,
    });
  }

  if (source.attemptStatus !== "completed" || !isNonEmptyString(source.completedAt)) {
    return buildUnavailableSourceBlock({
      testSlug: source.testSlug,
      sourceStatus: source.attemptStatus === "in_progress" ? "partial" : "unavailable",
      reason: `attempt_status_${source.attemptStatus}`,
      attemptId: source.attemptId,
    });
  }

  if (source.resultsError) {
    return buildUnavailableSourceBlock({
      testSlug: source.testSlug,
      sourceStatus: "invalid",
      reason: source.resultsError,
      attemptId: source.attemptId,
    });
  }

  if (!source.results) {
    return buildUnavailableSourceBlock({
      testSlug: source.testSlug,
      sourceStatus: "invalid",
      reason: "deterministic_results_missing",
      attemptId: source.attemptId,
    });
  }

  const safranInput = buildSafranHrReportInput({
    testSlug: source.testSlug,
    locale: input.locale as never,
    results: source.results,
  });

  const domainEntries = [
    {
      code: "verbal",
      label: "Verbalno rezonovanje",
      rawScore: safranInput.scores.verbal.rawScore,
      bandLabel: safranInput.scores.verbal.bandLabel,
    },
    {
      code: "figural",
      label: "Figuralno rezonovanje",
      rawScore: safranInput.scores.figural.rawScore,
      bandLabel: safranInput.scores.figural.bandLabel,
    },
    {
      code: "numeric",
      label: "Numeričko rezonovanje",
      rawScore: safranInput.scores.numeric.rawScore,
      bandLabel: safranInput.scores.numeric.bandLabel,
    },
  ].sort((left, right) => right.rawScore - left.rawScore);

  const strongest = domainEntries[0];
  const lowest = domainEntries[domainEntries.length - 1];

  return {
    sourceStatus: "available",
    summary: `Najizraženiji problem-solving signal djeluje u domeni ${strongest.label.toLowerCase()}, dok dodatnu provjeru vrijedi usmjeriti ka domeni ${lowest.label.toLowerCase()}.`,
    relevantSignals: [
      {
        code: strongest.code,
        label: strongest.label,
        signal: `U ovom setu zadataka signal u domeni ${strongest.label.toLowerCase()} djeluje ${strongest.bandLabel.toLowerCase()}.`,
      },
      {
        code: lowest.code,
        label: lowest.label,
        signal: `Signal u domeni ${lowest.label.toLowerCase()} vrijedi provjeriti kroz radni kontekst i razvojni razgovor.`,
      },
    ],
    sourceMetadata: {
      testSlug: source.testSlug,
      attemptId: source.attemptId,
      scoreLabelOverall: safranInput.scores.overall.scoreLabel,
    },
  };
}

function toPreparedAttempt(source: LoadedAttemptSource): CompositeInputPreparedAttempt | null {
  if (
    source.attemptStatus !== "completed" ||
    !source.results ||
    !isNonEmptyString(source.completedAt)
  ) {
    return null;
  }

  return {
    assessmentAssignmentId: source.assessmentAssignmentId,
    attemptId: source.attemptId,
    testId: source.testId,
    testSlug: source.testSlug,
    status: source.attemptStatus,
    completedAt: source.completedAt,
    addressingFormSnapshot: source.addressingFormSnapshot as never,
    requiredForComposite: source.requiredForComposite,
    requiredForTeamFit: source.requiredForTeamFit,
    position: source.position,
    results: source.results,
  };
}

function buildCompositeSourceBlock(input: {
  assignment: CompositeInputAssignmentRecord;
  participant: ParticipantRecord;
  locale: string;
  linkedAttempts: LoadedAttemptSource[];
  personality: IndividualDevelopmentProfileInputSourceBlock;
  motivation: IndividualDevelopmentProfileInputSourceBlock;
  problemSolving: IndividualDevelopmentProfileInputSourceBlock;
}): IndividualDevelopmentProfileInputSourceBlock {
  const componentStatuses = [
    input.personality.sourceStatus,
    input.motivation.sourceStatus,
    input.problemSolving.sourceStatus,
  ];

  if (componentStatuses.includes("invalid")) {
    return {
      sourceStatus: "invalid",
      summary: null,
      integratedSignals: [],
      sourceMetadata: {
        reason: "component_invalid",
        componentStatuses,
      },
    };
  }

  if (componentStatuses.every((status) => status === "unavailable")) {
    return {
      sourceStatus: "unavailable",
      summary: null,
      integratedSignals: [],
      sourceMetadata: {
        reason: "no_deterministic_components_available",
        componentStatuses,
      },
    };
  }

  if (componentStatuses.some((status) => status !== "available")) {
    return {
      sourceStatus: "partial",
      summary: null,
      integratedSignals: [],
      sourceMetadata: {
        reason: "deterministic_components_not_fully_ready",
        componentStatuses,
      },
    };
  }

  const preparedAttempts = input.linkedAttempts
    .map(toPreparedAttempt)
    .filter((attempt): attempt is CompositeInputPreparedAttempt => Boolean(attempt));

  try {
    const compositeSnapshot = buildCompositeHrInputSnapshotFromLoadedData({
      assignment: input.assignment,
      linkedAttempts: preparedAttempts,
      locale: input.locale,
    });
    const highestDomains = compositeSnapshot.summarySignals.personalityHighestDomains
      .map((code) => getIpipNeo120HrDomainLabel(code as IpipNeo120DomainCode) ?? code)
      .slice(0, 2);
    const strongestDomain = compositeSnapshot.summarySignals.cognitiveStrongestDomain;
    const highestDrivers = compositeSnapshot.summarySignals.motivationHighestDrivers.slice(0, 2);

    return {
      sourceStatus: "available",
      summary: `Reduced deterministic composite sažetak je dostupan i spaja signale ličnosti, motivacije i problem-solving obrasca bez AI narativa.`,
      integratedSignals: [
        {
          code: "personality_highest_domains",
          label: "Najizraženiji domeni ličnosti",
          signal: `Najviše se izdvajaju domeni ${highestDomains
            .map((entry) => entry.toLowerCase())
            .join(" i ")}.`,
        },
        {
          code: "cognitive_strongest_domain",
          label: "Najizraženiji problem-solving signal",
          signal: strongestDomain
            ? `Najizraženiji signal djeluje u domeni ${strongestDomain}.`
            : "Problem-solving signal nije dovoljno jasan za sigurnu rang-listu domena.",
        },
        {
          code: "motivation_highest_drivers",
          label: "Dominantni motivacijski driveri",
          signal: `U deterministic summary-ju najviše se izdvajaju driveri ${highestDrivers.join(" i ")}.`,
        },
      ],
      sourceMetadata: {
        sourceType: "deterministic_composite_input",
        contractVersion: compositeSnapshot.contractVersion,
        builderVersion: compositeSnapshot.metadata.builderVersion,
        assessmentAssignmentId: compositeSnapshot.generatedFor.assessmentAssignmentId,
        usesSingleTestAiReportsAsPrimaryInput:
          compositeSnapshot.guardrails.usesSingleTestAiReportsAsPrimaryInput,
      },
    };
  } catch (error) {
    return {
      sourceStatus: "invalid",
      summary: null,
      integratedSignals: [],
      sourceMetadata: {
        reason: error instanceof Error ? error.message : "composite_builder_failed",
      },
    };
  }
}

export function buildIndividualDevelopmentProfileInputSnapshotFromLoadedData(
  input: IndividualDevelopmentProfileInputLoadedData,
): IndividualDevelopmentProfileInputBuilderResult {
  const locale = resolveReportLocale(input.locale ?? input.assignment.locale);
  const personalitySource = input.linkedAttempts.find(
    (attempt) => attempt.testSlug === IPIP_NEO_120_TEST_SLUG,
  ) ?? null;
  const motivationSource = input.linkedAttempts.find(
    (attempt) => attempt.testSlug === MWMS_V1_TEST_SLUG,
  ) ?? null;
  const problemSolvingSource = input.linkedAttempts.find(
    (attempt) => attempt.testSlug === SAFRAN_HR_V1_TEST_SLUG,
  ) ?? null;

  const personality = buildPersonalitySourceBlock({
    source: personalitySource,
  });
  const motivation = buildMotivationSourceBlock({
    source: motivationSource,
    locale,
  });
  const problemSolving = buildProblemSolvingSourceBlock({
    source: problemSolvingSource,
    locale,
  });
  const composite = buildCompositeSourceBlock({
    assignment: input.assignment,
    participant: input.participant,
    locale,
    linkedAttempts: input.linkedAttempts,
    personality,
    motivation,
    problemSolving,
  });

  const interpretationLimits = [
    "Input snapshot sadrži reduced HR-safe deterministic signale, ne raw answers i ne full upstream snapshotove.",
    "Signal blokovi služe kao razvojne hipoteze za HR/menadžerski rad, ne kao konačni sud o osobi.",
  ];

  const sourceVersions: Array<Record<string, unknown>> = [
    {
      source: "personality",
      testSlug: IPIP_NEO_120_TEST_SLUG,
      mode: "deterministic_score_read",
    },
    {
      source: "motivation",
      testSlug: MWMS_V1_TEST_SLUG,
      mode: "deterministic_score_read",
    },
    {
      source: "problemSolving",
      testSlug: SAFRAN_HR_V1_TEST_SLUG,
      mode: "deterministic_score_read",
    },
    {
      source: "composite",
      contractVersion: COMPOSITE_HR_INPUT_CONTRACT_VERSION,
      builderVersion: COMPOSITE_HR_BUILDER_VERSION,
      mode: "deterministic_composite_summary",
    },
  ];

  if (personality.sourceStatus !== "available") {
    interpretationLimits.push("Personality source nije potpuno dostupan i treba ga čitati kao nepotpun razvojni signal.");
  }

  if (motivation.sourceStatus !== "available") {
    interpretationLimits.push("Motivation source nije potpuno dostupan i traži dodatnu provjeru kroz razgovor.");
  }

  if (problemSolving.sourceStatus !== "available") {
    interpretationLimits.push("Problem-solving source nije potpuno dostupan i ne treba ga tretirati kao konačan razvojni zaključak.");
  }

  if (composite.sourceStatus !== "available") {
    interpretationLimits.push("Reduced composite deterministic summary nije potpuno dostupan; AI-generated composite narrative se ne koristi kao zamjena primarnog source-a.");
  }

  return {
    ok: true,
    inputSnapshot: {
      inputType: INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_TYPE,
      inputVersion: INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION,
      locale,
      participant: {
        participantId: input.participant.id,
        displayName: input.participant.full_name,
      },
      sourceSignals: {
        personality,
        motivation,
        problemSolving,
        composite,
      },
      interpretationLimits,
      sourceMetadata: {
        assessmentAssignmentId: input.assignment.id,
        sourceVersions,
      },
    },
  };
}

export async function buildIndividualDevelopmentProfileInputSnapshot(
  input: {
    assessmentAssignmentId: string;
    organizationId?: string;
    participantId?: string;
    locale?: string | null;
  },
  deps: IndividualDevelopmentProfileInputDependencies = {},
): Promise<IndividualDevelopmentProfileInputBuilderResult> {
  if (!isNonEmptyString(input.assessmentAssignmentId)) {
    return buildFailure("invalid_payload", "assessmentAssignmentId is required.");
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const calculateResults = deps.calculateCompletedResults ?? calculateCompletedAssessmentResults;

  const { data: assignmentData, error: assignmentError } = await supabase
    .from("assessment_assignments")
    .select("id, organization_id, participant_id, assignment_type, status, locale, created_at")
    .eq("id", input.assessmentAssignmentId)
    .maybeSingle();

  if (assignmentError) {
    return buildFailure(
      "assignment_load_failed",
      `Failed to load assessment assignment: ${assignmentError.message}`,
    );
  }

  const assignment = (assignmentData as CompositeInputAssignmentRecord | null) ?? null;

  if (!assignment) {
    return buildFailure("assignment_not_found", "Assessment assignment was not found.");
  }

  if (isNonEmptyString(input.organizationId) && assignment.organization_id !== input.organizationId) {
    return buildFailure(
      "assignment_organization_mismatch",
      "Assessment assignment does not belong to the provided organization.",
    );
  }

  if (isNonEmptyString(input.participantId) && assignment.participant_id !== input.participantId) {
    return buildFailure(
      "assignment_participant_mismatch",
      "Assessment assignment does not belong to the provided participant.",
    );
  }

  const { data: participantData, error: participantError } = await supabase
    .from("participants")
    .select("id, organization_id, full_name")
    .eq("id", assignment.participant_id)
    .maybeSingle();

  if (participantError) {
    return buildFailure(
      "participant_load_failed",
      `Failed to load participant context: ${participantError.message}`,
    );
  }

  const participant = (participantData as ParticipantRecord | null) ?? null;

  if (!participant || participant.organization_id !== assignment.organization_id) {
    return buildFailure("participant_not_found", "Participant context was not found.");
  }

  const { data: linkedAttemptData, error: linkedAttemptError } = await supabase
    .from("assessment_assignment_attempts")
    .select(
      "assessment_assignment_id, attempt_id, test_id, test_slug, required_for_composite, required_for_team_fit, position, attempts(status, completed_at, addressing_form_snapshot)",
    )
    .eq("assessment_assignment_id", input.assessmentAssignmentId);

  if (linkedAttemptError) {
    return buildFailure(
      "linked_attempt_load_failed",
      `Failed to load linked attempts: ${linkedAttemptError.message}`,
    );
  }

  const linkedAttempts = await Promise.all(
    ((linkedAttemptData ?? []) as CompositeInputLinkedAttemptRecord[]).map(async (row) => {
      const attempt = normalizeAttemptRelation(row.attempts);
      const base = {
        assessmentAssignmentId: row.assessment_assignment_id,
        attemptId: row.attempt_id,
        testId: row.test_id,
        testSlug: row.test_slug,
        attemptStatus: attempt?.status ?? null,
        completedAt: attempt?.completed_at ?? null,
        addressingFormSnapshot: attempt?.addressing_form_snapshot ?? null,
        requiredForComposite: row.required_for_composite,
        requiredForTeamFit: row.required_for_team_fit,
        position: row.position,
      } satisfies Omit<LoadedAttemptSource, "results" | "resultsError">;

      if (
        attempt?.status !== "completed" ||
        !isNonEmptyString(attempt.completed_at)
      ) {
        return {
          ...base,
          results: null,
          resultsError: null,
        } satisfies LoadedAttemptSource;
      }

      try {
        const results = await calculateResults(row.test_id, row.attempt_id);

        return {
          ...base,
          results,
          resultsError: results ? null : "deterministic_results_missing",
        } satisfies LoadedAttemptSource;
      } catch (error) {
        return {
          ...base,
          results: null,
          resultsError: error instanceof Error ? error.message : "deterministic_results_failed",
        } satisfies LoadedAttemptSource;
      }
    }),
  );

  return buildIndividualDevelopmentProfileInputSnapshotFromLoadedData({
    assignment,
    participant,
    locale: input.locale,
    linkedAttempts,
  });
}
