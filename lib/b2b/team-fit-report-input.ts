import "server-only";

import {
  buildCompositeHrInputSnapshot,
  type CompositeHrInputSnapshot,
} from "@/lib/assessment/composite-input";
import {
  loadTeamDynamicsFinalAggregationVerification,
  type TeamDynamicsFinalAggregationReadResult,
} from "@/lib/assessment/team-dynamics-final-aggregation-read";
import {
  TEAM_FIT_CANDIDATE_SOURCE_TYPE,
  TEAM_FIT_REPORT_TYPE,
  TEAM_FIT_REPORT_VERSION,
  TEAM_FIT_TEAM_SOURCE_TYPE,
  type TeamFitReportStatus,
} from "@/lib/b2b/team-fit-report-lifecycle";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamFitReportInputDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
  buildCompositeInputSnapshot?: typeof buildCompositeHrInputSnapshot;
  loadTeamAggregationVerification?: typeof loadTeamDynamicsFinalAggregationVerification;
};

type TeamFitReportRow = {
  id: string;
  organization_id: string;
  team_id: string;
  participant_id: string;
  candidate_source_type: string;
  candidate_source_id: string | null;
  team_source_type: string;
  team_source_id: string | null;
  optional_context: Record<string, unknown> | null;
  report_type: string;
  report_version: string;
  report_status: TeamFitReportStatus;
  input_snapshot: Record<string, unknown> | null;
  report_snapshot: Record<string, unknown> | null;
  created_at: string;
};

type OrganizationRow = {
  id: string;
  name: string;
};

type TeamRow = {
  id: string;
  organization_id: string;
  name: string;
  archived_at: string | null;
};

type ParticipantRow = {
  id: string;
  organization_id: string;
  full_name: string;
};

type TeamAggregationSnapshotReferenceRow = {
  id: string;
  team_assessment_assignment_id: string;
  team_id: string | null;
  aggregation_version: string;
};

type TeamAssessmentAssignmentReferenceRow = {
  id: string;
  team_id: string | null;
  package_slug: string;
};

export const TEAM_FIT_REPORT_INPUT_TYPE = "team_fit_report_input_v1" as const;
export const TEAM_FIT_REPORT_INPUT_LEGACY_VERSION = "team_fit_report_input_v1" as const;
export const TEAM_FIT_REPORT_INPUT_VERSION = "team_fit_report_input_v2_enriched" as const;

const TEAM_FIT_ALLOWED_RELATIONSHIP_PATTERNS = [
  "alignment_signal",
  "complementarity_signal",
  "mixed_signal",
  "needs_validation",
] as const;

type TeamFitReportInputVersion =
  | typeof TEAM_FIT_REPORT_INPUT_LEGACY_VERSION
  | typeof TEAM_FIT_REPORT_INPUT_VERSION;

type TeamFitSignalStatus =
  | "placeholder_pending_composite_input"
  | "placeholder_pending_team_aggregation_input"
  | "available"
  | "partial"
  | "source_unavailable"
  | "source_invalid";

type TeamFitSummarySignal = {
  code: string;
  label: string;
  signal: string;
};

type TeamFitCandidateEvidence = {
  sourceTestSlug: string;
  dimensionCode: string;
  dimensionLabel: string;
  rawScore?: number;
  averageScore?: number;
  maxScore?: number;
  scoreLabel?: string;
  scaleMin?: number;
  scaleMax?: number;
  band?: string;
  bandLabel?: string;
};

type TeamFitSourceMetadata = {
  sourceId: string | null;
  contractVersion?: string;
  builderVersion?: string;
  sourceVersion?: string;
  assessmentAssignmentId?: string;
  teamAssessmentAssignmentId?: string;
  aggregationSnapshotId?: string | null;
  sourceTestSlugs?: string[];
};

export type TeamFitReportInputSnapshot = {
  inputType: typeof TEAM_FIT_REPORT_INPUT_TYPE;
  inputVersion: TeamFitReportInputVersion;
  reportType: typeof TEAM_FIT_REPORT_TYPE;
  reportVersion: typeof TEAM_FIT_REPORT_VERSION;
  locale: string;
  generatedAt: string;
  organizationContext: {
    organizationId: string;
    organizationName: string | null;
  };
  teamContext: {
    teamId: string;
    teamName: string | null;
    teamSourceType: typeof TEAM_FIT_TEAM_SOURCE_TYPE;
    teamSourceId: string | null;
  };
  candidateContext: {
    participantId: string;
    displayName: string | null;
    candidateSourceType: typeof TEAM_FIT_CANDIDATE_SOURCE_TYPE;
    candidateSourceId: string | null;
  };
  sourceReferences: {
    teamFitReportId: string;
    candidateSourceType: typeof TEAM_FIT_CANDIDATE_SOURCE_TYPE;
    candidateSourceId: string | null;
    teamSourceType: typeof TEAM_FIT_TEAM_SOURCE_TYPE;
    teamSourceId: string | null;
    executiveOverviewContextIncluded: false;
    roleContextIncluded: false;
  };
  candidateSignals: {
    sourceStatus: TeamFitSignalStatus;
    summary: Record<string, unknown> | null;
    candidateEvidence?: TeamFitCandidateEvidence[];
    motivationSignals?: {
      dominantDrivers: Array<{ code: string; label: string }>;
      lowerDrivers: Array<{ code: string; label: string }>;
      cautionFlags: {
        elevatedAmotivation: boolean;
        highControlledRelativeToAutonomous: boolean;
        mixedProfile: boolean;
      };
    } | null;
    problemSolvingSignals?: {
      strongestDomain: { code: string; label: string } | null;
      lowestDomain: { code: string; label: string } | null;
    } | null;
    interpretationLimits?: string[];
    sourceMetadata?: TeamFitSourceMetadata | null;
  };
  teamSignals: {
    sourceStatus: TeamFitSignalStatus;
    summary: Record<string, unknown> | null;
    coreSignals?: TeamFitSummarySignal[];
    communicationAndCoordinationSignals?: TeamFitSummarySignal[];
    psychologicalSafetySignal?: TeamFitSummarySignal | null;
    situationalJudgmentSignal?: TeamFitSummarySignal | null;
    outcomePulseSignal?: TeamFitSummarySignal | null;
    varianceAndConfidence?: {
      coverageLevel: "thin" | "usable" | "strong";
      varianceLevel: "unknown" | "mixed" | "stable";
      includedMemberCount: number | null;
      completedMemberCount: number | null;
      readyScoredMemberCount: number | null;
    } | null;
    interpretationLimits?: string[];
    sourceMetadata?: TeamFitSourceMetadata | null;
  };
  interpretationGuardrails: {
    noNumericFitScore: true;
    noHireNoHire: true;
    noRawTeamMemberAnswers: true;
    noIndividualTeamMemberScoreDisplay: true;
    noCandidateFacingOutput: true;
  };
  relationshipReasoningGuardrails?: {
    allowedPatterns: readonly [
      "alignment_signal",
      "complementarity_signal",
      "mixed_signal",
      "needs_validation",
    ];
    patternIsNotScore: true;
    patternIsNotRanking: true;
    patternIsNotDecision: true;
    patternIsNotRecommendation: true;
    patternIsNotHireNoHireSignal: true;
  };
};

export type BuildTeamFitReportInputSnapshotResult =
  | {
      ok: true;
      reportId: string;
      inputSnapshot: TeamFitReportInputSnapshot;
    }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "report_not_found"
        | "report_contract_mismatch"
        | "report_not_queued"
        | "organization_not_found"
        | "team_not_found"
        | "participant_not_found"
        | "unsupported_candidate_source_type"
        | "unsupported_team_source_type"
        | "invalid_existing_input_snapshot";
      message: string;
    };

export type BuildTeamFitReportInputSnapshotFromSourcesInput = {
  ephemeralReportReferenceId: string;
  organizationId: string;
  teamId: string;
  participantId: string;
  candidateAssessmentAssignmentId: string;
  teamAggregationSourceId: string;
  locale: string;
  generatedAt: string;
};

export type BuildTeamFitReportInputSnapshotFromSourcesResult =
  | {
      ok: true;
      ephemeralReportReferenceId: string;
      inputSnapshot: TeamFitReportInputSnapshot;
      candidateSourceStatus: "available";
      candidateCoverage: {
        requiredCount: number;
        completedCount: number;
        missingTestSlugs: string[];
      };
      teamSourceStatus: "available";
      teamFullCoverage: true;
    }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "organization_not_found"
        | "organization_mismatch"
        | "team_not_found"
        | "team_organization_mismatch"
        | "participant_not_found"
        | "participant_organization_mismatch"
        | "candidate_source_unavailable"
        | "candidate_source_invalid"
        | "candidate_source_lineage_mismatch"
        | "team_source_unavailable"
        | "team_source_invalid"
        | "team_source_lineage_mismatch";
      message: string;
      candidateSourceStatus: TeamFitSignalStatus | null;
      teamSourceStatus: TeamFitSignalStatus | null;
      teamFullCoverage: boolean;
    };

export type PersistTeamFitReportInputSnapshotResult =
  | {
      ok: true;
      reportId: string;
      inputSnapshot: TeamFitReportInputSnapshot;
    }
  | (BuildTeamFitReportInputSnapshotResult & { ok: false })
  | {
      ok: false;
      reason: "update_failed";
      message: string;
    };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function buildFailure(
  reason: Extract<BuildTeamFitReportInputSnapshotResult, { ok: false }>["reason"],
  message: string,
): BuildTeamFitReportInputSnapshotResult {
  return { ok: false, reason, message };
}

function resolveLocale(value: unknown): string {
  if (isRecord(value) && isNonEmptyString(value.locale)) {
    return value.locale.trim();
  }

  return "bs";
}

function isValidSignalStatus(value: unknown): value is TeamFitSignalStatus {
  return (
    value === "placeholder_pending_composite_input" ||
    value === "placeholder_pending_team_aggregation_input" ||
    value === "available" ||
    value === "partial" ||
    value === "source_unavailable" ||
    value === "source_invalid"
  );
}

function buildRelationshipReasoningGuardrails() {
  return {
    allowedPatterns: [...TEAM_FIT_ALLOWED_RELATIONSHIP_PATTERNS],
    patternIsNotScore: true,
    patternIsNotRanking: true,
    patternIsNotDecision: true,
    patternIsNotRecommendation: true,
    patternIsNotHireNoHireSignal: true,
  } as const;
}

function isValidRelationshipReasoningGuardrails(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.allowedPatterns)) {
    return false;
  }

  const allowedPatterns = value.allowedPatterns;

  return (
    allowedPatterns.length === TEAM_FIT_ALLOWED_RELATIONSHIP_PATTERNS.length &&
    TEAM_FIT_ALLOWED_RELATIONSHIP_PATTERNS.every((pattern) =>
      allowedPatterns.includes(pattern),
    ) &&
    value.patternIsNotScore === true &&
    value.patternIsNotRanking === true &&
    value.patternIsNotDecision === true &&
    value.patternIsNotRecommendation === true &&
    value.patternIsNotHireNoHireSignal === true
  );
}

function isTeamFitReportInputSnapshot(value: unknown): value is TeamFitReportInputSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  const isLegacyVersion = value.inputVersion === TEAM_FIT_REPORT_INPUT_LEGACY_VERSION;
  const isCurrentVersion = value.inputVersion === TEAM_FIT_REPORT_INPUT_VERSION;

  return (
    value.inputType === TEAM_FIT_REPORT_INPUT_TYPE &&
    (isLegacyVersion || isCurrentVersion) &&
    value.reportType === TEAM_FIT_REPORT_TYPE &&
    value.reportVersion === TEAM_FIT_REPORT_VERSION &&
    isNonEmptyString(value.locale) &&
    isNonEmptyString(value.generatedAt) &&
    isRecord(value.organizationContext) &&
    isNonEmptyString(value.organizationContext.organizationId) &&
    isRecord(value.teamContext) &&
    isNonEmptyString(value.teamContext.teamId) &&
    value.teamContext.teamSourceType === TEAM_FIT_TEAM_SOURCE_TYPE &&
    isRecord(value.candidateContext) &&
    isNonEmptyString(value.candidateContext.participantId) &&
    value.candidateContext.candidateSourceType === TEAM_FIT_CANDIDATE_SOURCE_TYPE &&
    isRecord(value.sourceReferences) &&
    value.sourceReferences.teamFitReportId !== undefined &&
    value.sourceReferences.executiveOverviewContextIncluded === false &&
    value.sourceReferences.roleContextIncluded === false &&
    isRecord(value.candidateSignals) &&
    isValidSignalStatus(value.candidateSignals.sourceStatus) &&
    isRecord(value.teamSignals) &&
    isValidSignalStatus(value.teamSignals.sourceStatus) &&
    isRecord(value.interpretationGuardrails) &&
    value.interpretationGuardrails.noNumericFitScore === true &&
    value.interpretationGuardrails.noHireNoHire === true &&
    value.interpretationGuardrails.noRawTeamMemberAnswers === true &&
    value.interpretationGuardrails.noIndividualTeamMemberScoreDisplay === true &&
    value.interpretationGuardrails.noCandidateFacingOutput === true &&
    (isLegacyVersion ||
      (value.relationshipReasoningGuardrails !== undefined &&
        isValidRelationshipReasoningGuardrails(value.relationshipReasoningGuardrails)))
  );
}

function toSafeSignalText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toTitleCaseLabel(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function buildCandidateSummary(
  snapshot: CompositeHrInputSnapshot,
): TeamFitReportInputSnapshot["candidateSignals"]["summary"] {
  const ipipDomains = snapshot.deterministicInputs.ipip.domains;
  const mwmsDimensions = snapshot.deterministicInputs.mwms.dimensions;
  const resolveDomain = (domainCode: string) =>
    ipipDomains.find((domain) => domain.domainCode === domainCode);
  const resolveDriver = (code: string) => mwmsDimensions.find((dimension) => dimension.code === code);

  return {
    personalityHighestDomains: snapshot.summarySignals.personalityHighestDomains.map((code) => {
      const domain = resolveDomain(code);
      return { code, label: domain?.label ?? code };
    }),
    personalityLowestDomains: snapshot.summarySignals.personalityLowestDomains.map((code) => {
      const domain = resolveDomain(code);
      return { code, label: domain?.label ?? code };
    }),
    cognitiveStrongestDomain: snapshot.summarySignals.cognitiveStrongestDomain
      ? {
          code: snapshot.summarySignals.cognitiveStrongestDomain,
          label: toTitleCaseLabel(snapshot.summarySignals.cognitiveStrongestDomain),
        }
      : null,
    cognitiveLowestDomain: snapshot.summarySignals.cognitiveLowestDomain
      ? {
          code: snapshot.summarySignals.cognitiveLowestDomain,
          label: toTitleCaseLabel(snapshot.summarySignals.cognitiveLowestDomain),
        }
      : null,
    motivationHighestDrivers: snapshot.summarySignals.motivationHighestDrivers.map((code) => {
      const dimension = resolveDriver(code);
      return { code, label: dimension?.label ?? code };
    }),
    motivationLowestDrivers: snapshot.summarySignals.motivationLowestDrivers.map((code) => {
      const dimension = resolveDriver(code);
      return { code, label: dimension?.label ?? code };
    }),
    crossInstrumentFlags: [...snapshot.summarySignals.crossInstrumentFlags],
  };
}

function buildCandidateEvidence(snapshot: CompositeHrInputSnapshot): TeamFitCandidateEvidence[] {
  const collaborationCodes = new Set([
    ...snapshot.summarySignals.personalityHighestDomains.slice(0, 2),
    ...snapshot.summarySignals.personalityLowestDomains.slice(0, 2),
  ]);

  const personalityEvidence = Array.from(collaborationCodes)
    .map((domainCode) =>
      snapshot.deterministicInputs.ipip.domains.find((domain) => domain.domainCode === domainCode),
    )
    .filter(
      (
        domain,
      ): domain is CompositeHrInputSnapshot["deterministicInputs"]["ipip"]["domains"][number] =>
        Boolean(domain),
    )
    .slice(0, 4)
    .map((domain) => ({
      sourceTestSlug: snapshot.deterministicInputs.ipip.testSlug,
      dimensionCode: domain.domainCode,
      dimensionLabel: domain.label,
      rawScore: domain.rawScore,
      averageScore: domain.averageScore,
      scaleMin: snapshot.deterministicInputs.ipip.scale.min,
      scaleMax: snapshot.deterministicInputs.ipip.scale.max,
      band: domain.band,
      bandLabel: domain.bandLabel,
    }));

  const safran = snapshot.deterministicInputs.safran;
  const cognitiveEvidence = (["verbal", "figural", "numeric"] as const).map((code) => {
    const score = safran[code];
    return {
      sourceTestSlug: safran.testSlug,
      dimensionCode: code,
      dimensionLabel: toTitleCaseLabel(code),
      rawScore: score.rawScore,
      maxScore: score.maxScore,
      scoreLabel: score.scoreLabel,
      band: score.band,
      bandLabel: score.bandLabel,
    };
  });

  const mwms = snapshot.deterministicInputs.mwms;
  const motivationEvidence = mwms.dimensions.map((dimension) => ({
    sourceTestSlug: mwms.testSlug,
    dimensionCode: dimension.code,
    dimensionLabel: dimension.label,
    rawScore: dimension.rawScore,
    scaleMin: mwms.scale.min,
    scaleMax: mwms.scale.max,
    band: dimension.band,
    bandLabel: dimension.bandLabel,
  }));

  return [...personalityEvidence, ...cognitiveEvidence, ...motivationEvidence];
}

function buildCandidateMotivationSignals(
  snapshot: CompositeHrInputSnapshot,
): NonNullable<TeamFitReportInputSnapshot["candidateSignals"]["motivationSignals"]> {
  const dimensions = snapshot.deterministicInputs.mwms.dimensions;
  const resolveDimension = (code: string) =>
    dimensions.find((dimension) => dimension.code === code);
  const cautionFlags = snapshot.deterministicInputs.mwms.summarySignals.cautionFlags;

  return {
    dominantDrivers: snapshot.summarySignals.motivationHighestDrivers.map((code) => {
      const dimension = resolveDimension(code);
      return { code, label: dimension?.label ?? code };
    }),
    lowerDrivers: snapshot.summarySignals.motivationLowestDrivers.map((code) => {
      const dimension = resolveDimension(code);
      return { code, label: dimension?.label ?? code };
    }),
    cautionFlags: { ...cautionFlags },
  };
}

function buildCandidateProblemSolvingSignals(
  snapshot: CompositeHrInputSnapshot,
): NonNullable<TeamFitReportInputSnapshot["candidateSignals"]["problemSolvingSignals"]> {
  const strongestCode = snapshot.summarySignals.cognitiveStrongestDomain;
  const lowestCode = snapshot.summarySignals.cognitiveLowestDomain;

  return {
    strongestDomain: strongestCode
      ? {
          code: strongestCode,
          label: toTitleCaseLabel(strongestCode),
        }
      : null,
    lowestDomain: lowestCode
      ? {
          code: lowestCode,
          label: toTitleCaseLabel(lowestCode),
        }
      : null,
  };
}

function buildCandidateInterpretationLimits(snapshot: CompositeHrInputSnapshot): string[] {
  const missingTeamFitAttempts = snapshot.sourceAttempts
    .filter((attempt) => attempt.requiredForTeamFit && attempt.status !== "completed")
    .map((attempt) => attempt.testSlug);
  const limits = [
    "Candidate payload is a reduced HR-safe summary, not the full composite snapshot.",
  ];

  if (snapshot.coverage.missingTestSlugs.length > 0) {
    limits.push(
      `Missing deterministic candidate sources: ${snapshot.coverage.missingTestSlugs.join(", ")}.`,
    );
  }

  if (missingTeamFitAttempts.length > 0) {
    limits.push(
      `Some Team Fit-linked attempts are incomplete or unavailable: ${missingTeamFitAttempts.join(", ")}.`,
    );
  }

  return limits;
}

async function loadCandidateSignals(input: {
  reportRow: TeamFitReportRow;
  locale: string;
  buildCompositeInputSnapshot: typeof buildCompositeHrInputSnapshot;
}): Promise<TeamFitReportInputSnapshot["candidateSignals"]> {
  if (!isNonEmptyString(input.reportRow.candidate_source_id)) {
    return {
      sourceStatus: "placeholder_pending_composite_input",
      summary: null,
      interpretationLimits: ["Candidate composite source reference is not attached yet."],
      sourceMetadata: {
        sourceId: null,
      },
    };
  }

  try {
    const compositeSnapshot = await input.buildCompositeInputSnapshot({
      assessmentAssignmentId: input.reportRow.candidate_source_id,
      organizationId: input.reportRow.organization_id,
      participantId: input.reportRow.participant_id,
      locale: input.locale,
    });

    return buildCandidateSignalsFromSnapshot({
      snapshot: compositeSnapshot,
      sourceId: input.reportRow.candidate_source_id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_candidate_source_error";

    return {
      sourceStatus: /not found|does not belong/i.test(message)
        ? "source_unavailable"
        : "source_invalid",
      summary: null,
      interpretationLimits: [
        "Candidate composite source could not be reduced into Team Fit input.",
        message,
      ],
      sourceMetadata: {
        sourceId: input.reportRow.candidate_source_id,
      },
    };
  }
}

function buildCandidateSignalsFromSnapshot(input: {
  snapshot: CompositeHrInputSnapshot;
  sourceId: string;
}): TeamFitReportInputSnapshot["candidateSignals"] {
  return {
    sourceStatus: "available",
    summary: buildCandidateSummary(input.snapshot),
    candidateEvidence: buildCandidateEvidence(input.snapshot),
    motivationSignals: buildCandidateMotivationSignals(input.snapshot),
    problemSolvingSignals: buildCandidateProblemSolvingSignals(input.snapshot),
    interpretationLimits: buildCandidateInterpretationLimits(input.snapshot),
    sourceMetadata: {
      sourceId: input.sourceId,
      contractVersion: input.snapshot.contractVersion,
      builderVersion: input.snapshot.metadata.builderVersion,
      assessmentAssignmentId: input.snapshot.generatedFor.assessmentAssignmentId,
      sourceTestSlugs: [
        input.snapshot.deterministicInputs.ipip.testSlug,
        input.snapshot.deterministicInputs.safran.testSlug,
        input.snapshot.deterministicInputs.mwms.testSlug,
      ],
    },
  };
}

function deriveSignalLevel(label: string): "higher" | "moderate" | "lower" {
  const normalized = label.toLowerCase();

  if (normalized.includes("high") || normalized.includes("viša") || normalized.includes("više")) {
    return "higher";
  }

  if (normalized.includes("low") || normalized.includes("niža") || normalized.includes("niže")) {
    return "lower";
  }

  return "moderate";
}

function deriveVarianceLevel(entry: {
  standardDeviationScore0To100: number | null;
  memberCount: number;
}): "unknown" | "mixed" | "stable" {
  if (entry.standardDeviationScore0To100 === null || entry.memberCount < 3) {
    return "unknown";
  }

  return entry.standardDeviationScore0To100 >= 18 ? "mixed" : "stable";
}

function buildTeamSignalEntry(input: {
  entry: TeamDynamicsFinalAggregationReadResult["scoreEntryAggregations"][number];
  signalPrefix: string;
}): TeamFitSummarySignal {
  const signalLevel = deriveSignalLevel(input.entry.label);
  const varianceLevel = deriveVarianceLevel(input.entry);

  return {
    code: input.entry.scoreKey,
    label: input.entry.label,
    signal: toSafeSignalText(
      `${input.signalPrefix} signal appears ${signalLevel} with ${varianceLevel} team-level consistency.`,
    ),
  };
}

async function resolveTeamAggregationSource(input: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  teamSourceId: string;
  loadTeamAggregationVerification: typeof loadTeamDynamicsFinalAggregationVerification;
}): Promise<
  | {
      result: TeamDynamicsFinalAggregationReadResult;
      sourceMetadata: TeamFitSourceMetadata;
    }
  | null
> {
  const directResult = await input.loadTeamAggregationVerification({
    teamAssessmentAssignmentId: input.teamSourceId,
  });

  if (directResult.status === "ready") {
    return {
      result: directResult,
      sourceMetadata: {
        sourceId: input.teamSourceId,
        sourceVersion: directResult.aggregationVersion,
        teamAssessmentAssignmentId: directResult.teamAssessmentAssignmentId,
        aggregationSnapshotId: directResult.aggregationSnapshotId,
      },
    };
  }

  const shouldAttemptSnapshotReferenceLookup =
    directResult.status === "not_found" ||
    (directResult.status === "invalid" &&
      directResult.reason === "team_assessment_assignment_not_found");

  if (!shouldAttemptSnapshotReferenceLookup) {
    return {
      result: directResult,
      sourceMetadata: {
        sourceId: input.teamSourceId,
        sourceVersion: directResult.aggregationVersion,
        teamAssessmentAssignmentId: directResult.teamAssessmentAssignmentId,
        aggregationSnapshotId: directResult.aggregationSnapshotId,
      },
    };
  }

  const { data, error } = await input.supabase
    .from("team_assessment_aggregation_snapshots")
    .select("id, team_assessment_assignment_id, team_id, aggregation_version")
    .eq("id", input.teamSourceId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as TeamAggregationSnapshotReferenceRow;
  const snapshotResult = await input.loadTeamAggregationVerification({
    teamAssessmentAssignmentId: row.team_assessment_assignment_id,
    aggregationVersion: row.aggregation_version,
  });

  return {
    result: snapshotResult,
    sourceMetadata: {
      sourceId: input.teamSourceId,
      sourceVersion: row.aggregation_version,
      teamAssessmentAssignmentId: row.team_assessment_assignment_id,
      aggregationSnapshotId: row.id,
    },
  };
}

function buildTeamSummary(
  verification: TeamDynamicsFinalAggregationReadResult,
): TeamFitReportInputSnapshot["teamSignals"]["summary"] {
  return {
    aggregationStatus: verification.status,
    includedMemberCount: verification.includedMemberCount,
    completedMemberCount: verification.completedMemberCount,
    readyScoredMemberCount: verification.readyScoredMemberCount,
    incompleteMemberCount: verification.incompleteMemberCount,
    missingScoreCount: verification.missingScoreCount,
    invalidScoreCount: verification.invalidScoreCount,
    tdmDomainAggregationsPresent: verification.hasTdmDomainAggregations,
    psychologicalSafetyAggregationPresent: verification.hasPsychologicalSafetyAggregation,
    situationalJudgmentAggregationPresent: verification.hasSjtAggregation,
    outcomePulseAggregationPresent: verification.hasOutcomePulseAggregation,
  };
}

function buildTeamCoreSignals(
  verification: TeamDynamicsFinalAggregationReadResult,
): TeamFitSummarySignal[] {
  return verification.scoreEntryAggregations
    .filter(
      (entry) => entry.scoreKey === "tdm-31-V1_overall" || entry.scoreKey.startsWith("tdm_domain_"),
    )
    .slice(0, 4)
    .map((entry) =>
      buildTeamSignalEntry({
        entry,
        signalPrefix: "Team pattern",
      }),
    );
}

function buildTeamCommunicationSignals(
  verification: TeamDynamicsFinalAggregationReadResult,
): TeamFitSummarySignal[] {
  return verification.scoreEntryAggregations
    .filter((entry) => entry.scoreKey.startsWith("tdm_domain_"))
    .slice(0, 3)
    .map((entry) =>
      buildTeamSignalEntry({
        entry,
        signalPrefix: "Communication or coordination",
      }),
    );
}

function buildOptionalTeamSignal(
  verification: TeamDynamicsFinalAggregationReadResult,
  scoreKey: string,
  signalPrefix: string,
): TeamFitSummarySignal | null {
  const entry = verification.scoreEntryAggregations.find((candidate) => candidate.scoreKey === scoreKey);

  if (!entry) {
    return null;
  }

  return buildTeamSignalEntry({
    entry,
    signalPrefix,
  });
}

function buildTeamInterpretationLimits(
  verification: TeamDynamicsFinalAggregationReadResult,
): string[] {
  const limits = [
    "Team payload is a reduced verified aggregation summary, not a full Team Dynamics snapshot.",
  ];

  if (verification.reason) {
    limits.push(`Aggregation verification warning: ${verification.reason}.`);
  }

  if ((verification.incompleteMemberCount ?? 0) > 0) {
    limits.push(
      "Some team members are incomplete, so relationship hypotheses should be validated in interview context.",
    );
  }

  if ((verification.invalidScoreCount ?? 0) > 0 || (verification.missingScoreCount ?? 0) > 0) {
    limits.push("Team aggregation coverage has missing or invalid score inputs.");
  }

  return limits;
}

function buildTeamVarianceAndConfidence(
  verification: TeamDynamicsFinalAggregationReadResult,
): NonNullable<TeamFitReportInputSnapshot["teamSignals"]["varianceAndConfidence"]> {
  const readyScoredMemberCount = verification.readyScoredMemberCount ?? null;
  const coverageLevel =
    readyScoredMemberCount === null || readyScoredMemberCount < 3
      ? "thin"
      : readyScoredMemberCount < 5
        ? "usable"
        : "strong";
  const firstVarianceEntry = verification.scoreEntryAggregations.find(
    (entry) => entry.standardDeviationScore0To100 !== null,
  );

  return {
    coverageLevel,
    varianceLevel: firstVarianceEntry ? deriveVarianceLevel(firstVarianceEntry) : "unknown",
    includedMemberCount: verification.includedMemberCount,
    completedMemberCount: verification.completedMemberCount,
    readyScoredMemberCount: verification.readyScoredMemberCount,
  };
}

async function loadTeamSignals(input: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  reportRow: TeamFitReportRow;
  loadTeamAggregationVerification: typeof loadTeamDynamicsFinalAggregationVerification;
}): Promise<TeamFitReportInputSnapshot["teamSignals"]> {
  if (!isNonEmptyString(input.reportRow.team_source_id)) {
    return {
      sourceStatus: "placeholder_pending_team_aggregation_input",
      summary: null,
      interpretationLimits: ["Verified Team Dynamics aggregation source reference is not attached yet."],
      sourceMetadata: {
        sourceId: null,
      },
    };
  }

  try {
    const resolved = await resolveTeamAggregationSource({
      supabase: input.supabase,
      teamSourceId: input.reportRow.team_source_id,
      loadTeamAggregationVerification: input.loadTeamAggregationVerification,
    });

    if (!resolved || resolved.result.status === "not_found") {
      return {
        sourceStatus: "source_unavailable",
        summary: null,
        interpretationLimits: ["Verified Team Dynamics aggregation source is not available yet."],
        sourceMetadata: {
          sourceId: input.reportRow.team_source_id,
        },
      };
    }

    return buildTeamSignalsFromResolved(resolved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_team_source_error";

    return {
      sourceStatus: "source_invalid",
      summary: null,
      interpretationLimits: [
        "Verified Team Dynamics aggregation source could not be reduced into Team Fit input.",
        message,
      ],
      sourceMetadata: {
        sourceId: input.reportRow.team_source_id,
      },
    };
  }
}

function buildTeamSignalsFromResolved(input: {
  result: TeamDynamicsFinalAggregationReadResult;
  sourceMetadata: TeamFitSourceMetadata;
}): TeamFitReportInputSnapshot["teamSignals"] {
  return {
    sourceStatus: input.result.status === "ready" ? "available" : "source_invalid",
    summary: buildTeamSummary(input.result),
    coreSignals: buildTeamCoreSignals(input.result),
    communicationAndCoordinationSignals: buildTeamCommunicationSignals(input.result),
    psychologicalSafetySignal: buildOptionalTeamSignal(
      input.result,
      "psychological_safety_overall",
      "Psychological safety",
    ),
    situationalJudgmentSignal: buildOptionalTeamSignal(
      input.result,
      "situational_judgment_overall",
      "Situational judgment",
    ),
    outcomePulseSignal: buildOptionalTeamSignal(
      input.result,
      "outcome_pulse_overall",
      "Outcome pulse",
    ),
    varianceAndConfidence: buildTeamVarianceAndConfidence(input.result),
    interpretationLimits: buildTeamInterpretationLimits(input.result),
    sourceMetadata: {
      ...input.sourceMetadata,
      sourceVersion: input.result.aggregationVersion,
    },
  };
}

async function loadReportRow(input: {
  teamFitReportId: string;
  organizationId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<TeamFitReportRow | null> {
  const { data, error } = await input.supabase
    .from("team_fit_reports")
    .select(
      "id, organization_id, team_id, participant_id, candidate_source_type, candidate_source_id, team_source_type, team_source_id, optional_context, report_type, report_version, report_status, input_snapshot, report_snapshot, created_at",
    )
    .eq("id", input.teamFitReportId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Team Fit report row: ${error.message}`);
  }

  return (data as TeamFitReportRow | null) ?? null;
}

async function loadOrganizationContext(input: {
  organizationId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<{ ok: true; organization: OrganizationRow } | { ok: false; message: string }> {
  const { data, error } = await input.supabase
    .from("organizations")
    .select("id, name")
    .eq("id", input.organizationId)
    .maybeSingle();

  if (error) {
    return { ok: false, message: `Failed to load Team Fit organization context: ${error.message}` };
  }

  if (!data) {
    return { ok: false, message: "Team Fit organization context was not found." };
  }

  return { ok: true, organization: data as OrganizationRow };
}

async function loadTeamContext(input: {
  organizationId: string;
  teamId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<{ ok: true; team: TeamRow } | { ok: false; message: string }> {
  const { data, error } = await input.supabase
    .from("teams")
    .select("id, organization_id, name, archived_at")
    .eq("id", input.teamId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (error) {
    return { ok: false, message: `Failed to load Team Fit team context: ${error.message}` };
  }

  const team = (data as TeamRow | null) ?? null;

  if (!team || team.archived_at) {
    return { ok: false, message: "Team Fit team context was not found." };
  }

  return { ok: true, team };
}

async function loadParticipantContext(input: {
  organizationId: string;
  participantId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<{ ok: true; participant: ParticipantRow } | { ok: false; message: string }> {
  const { data, error } = await input.supabase
    .from("participants")
    .select("id, organization_id, full_name")
    .eq("id", input.participantId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (error) {
    return { ok: false, message: `Failed to load Team Fit participant context: ${error.message}` };
  }

  if (!data) {
    return { ok: false, message: "Team Fit participant context was not found." };
  }

  return { ok: true, participant: data as ParticipantRow };
}

function buildTeamFitReportInputSnapshotFromValidatedSources(input: {
  reportReferenceId: string;
  organization: OrganizationRow;
  team: TeamRow;
  participant: ParticipantRow;
  candidateSourceId: string | null;
  teamSourceId: string | null;
  candidateSignals: TeamFitReportInputSnapshot["candidateSignals"];
  teamSignals: TeamFitReportInputSnapshot["teamSignals"];
  locale: string;
  generatedAt: string;
}): TeamFitReportInputSnapshot {
  return {
    inputType: TEAM_FIT_REPORT_INPUT_TYPE,
    inputVersion: TEAM_FIT_REPORT_INPUT_VERSION,
    reportType: TEAM_FIT_REPORT_TYPE,
    reportVersion: TEAM_FIT_REPORT_VERSION,
    locale: input.locale,
    generatedAt: input.generatedAt,
    organizationContext: {
      organizationId: input.organization.id,
      organizationName: input.organization.name ?? null,
    },
    teamContext: {
      teamId: input.team.id,
      teamName: input.team.name ?? null,
      teamSourceType: TEAM_FIT_TEAM_SOURCE_TYPE,
      teamSourceId: input.teamSourceId,
    },
    candidateContext: {
      participantId: input.participant.id,
      displayName: input.participant.full_name ?? null,
      candidateSourceType: TEAM_FIT_CANDIDATE_SOURCE_TYPE,
      candidateSourceId: input.candidateSourceId,
    },
    sourceReferences: {
      teamFitReportId: input.reportReferenceId,
      candidateSourceType: TEAM_FIT_CANDIDATE_SOURCE_TYPE,
      candidateSourceId: input.candidateSourceId,
      teamSourceType: TEAM_FIT_TEAM_SOURCE_TYPE,
      teamSourceId: input.teamSourceId,
      executiveOverviewContextIncluded: false,
      roleContextIncluded: false,
    },
    candidateSignals: input.candidateSignals,
    teamSignals: input.teamSignals,
    interpretationGuardrails: {
      noNumericFitScore: true,
      noHireNoHire: true,
      noRawTeamMemberAnswers: true,
      noIndividualTeamMemberScoreDisplay: true,
      noCandidateFacingOutput: true,
    },
    relationshipReasoningGuardrails: buildRelationshipReasoningGuardrails(),
  };
}

export async function buildTeamFitReportInputSnapshot(
  input: {
    teamFitReportId: string;
    organizationId: string;
  },
  deps: TeamFitReportInputDependencies = {},
): Promise<BuildTeamFitReportInputSnapshotResult> {
  if (!isNonEmptyString(input.teamFitReportId)) {
    return buildFailure("invalid_payload", "teamFitReportId is required.");
  }

  if (!isNonEmptyString(input.organizationId)) {
    return buildFailure("invalid_payload", "organizationId is required.");
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const reportRow = await loadReportRow({
    teamFitReportId: input.teamFitReportId,
    organizationId: input.organizationId,
    supabase,
  });

  if (!reportRow) {
    return buildFailure("report_not_found", "Team Fit report row was not found.");
  }

  if (
    reportRow.report_type !== TEAM_FIT_REPORT_TYPE ||
    reportRow.report_version !== TEAM_FIT_REPORT_VERSION
  ) {
    return buildFailure(
      "report_contract_mismatch",
      "Team Fit report row does not match the expected report type/version contract.",
    );
  }

  if (reportRow.candidate_source_type !== TEAM_FIT_CANDIDATE_SOURCE_TYPE) {
    return buildFailure(
      "unsupported_candidate_source_type",
      `Team Fit candidate source type must be ${TEAM_FIT_CANDIDATE_SOURCE_TYPE}.`,
    );
  }

  if (reportRow.team_source_type !== TEAM_FIT_TEAM_SOURCE_TYPE) {
    return buildFailure(
      "unsupported_team_source_type",
      `Team Fit team source type must be ${TEAM_FIT_TEAM_SOURCE_TYPE}.`,
    );
  }

  if (reportRow.input_snapshot !== null) {
    if (isTeamFitReportInputSnapshot(reportRow.input_snapshot)) {
      return {
        ok: true,
        reportId: reportRow.id,
        inputSnapshot: reportRow.input_snapshot,
      };
    }

    return buildFailure(
      "invalid_existing_input_snapshot",
      "Team Fit report row contains an invalid persisted input snapshot.",
    );
  }

  if (reportRow.report_status !== "queued" && reportRow.report_status !== "processing") {
    return buildFailure(
      "report_not_queued",
      "Team Fit report input snapshot can only be built for queued or processing report rows when no persisted snapshot exists.",
    );
  }

  const organizationContext = await loadOrganizationContext({
    organizationId: reportRow.organization_id,
    supabase,
  });

  if (!organizationContext.ok) {
    return buildFailure("organization_not_found", organizationContext.message);
  }

  const teamContext = await loadTeamContext({
    organizationId: reportRow.organization_id,
    teamId: reportRow.team_id,
    supabase,
  });

  if (!teamContext.ok) {
    return buildFailure("team_not_found", teamContext.message);
  }

  const participantContext = await loadParticipantContext({
    organizationId: reportRow.organization_id,
    participantId: reportRow.participant_id,
    supabase,
  });

  if (!participantContext.ok) {
    return buildFailure("participant_not_found", participantContext.message);
  }

  const locale = resolveLocale(reportRow.optional_context);
  const buildCompositeInputSnapshot =
    deps.buildCompositeInputSnapshot ?? buildCompositeHrInputSnapshot;
  const loadTeamAggregationVerification =
    deps.loadTeamAggregationVerification ?? loadTeamDynamicsFinalAggregationVerification;
  const [candidateSignals, teamSignals] = await Promise.all([
    loadCandidateSignals({
      reportRow,
      locale,
      buildCompositeInputSnapshot,
    }),
    loadTeamSignals({
      supabase,
      reportRow,
      loadTeamAggregationVerification,
    }),
  ]);

  const snapshot = buildTeamFitReportInputSnapshotFromValidatedSources({
    reportReferenceId: reportRow.id,
    organization: organizationContext.organization,
    team: teamContext.team,
    participant: participantContext.participant,
    candidateSourceId: reportRow.candidate_source_id,
    teamSourceId: reportRow.team_source_id,
    candidateSignals,
    teamSignals,
    locale,
    generatedAt: reportRow.created_at,
  });

  return {
    ok: true,
    reportId: reportRow.id,
    inputSnapshot: snapshot,
  };
}

function buildSourceDirectFailure(
  reason: Extract<
    BuildTeamFitReportInputSnapshotFromSourcesResult,
    { ok: false }
  >["reason"],
  message: string,
  candidateSourceStatus: TeamFitSignalStatus | null = null,
  teamSourceStatus: TeamFitSignalStatus | null = null,
  teamFullCoverage = false,
): BuildTeamFitReportInputSnapshotFromSourcesResult {
  return {
    ok: false,
    reason,
    message,
    candidateSourceStatus,
    teamSourceStatus,
    teamFullCoverage,
  };
}

function hasExactTeamFitCandidateCoverage(snapshot: CompositeHrInputSnapshot): boolean {
  const expectedTestSlugs = new Set(["ipip-neo-120-v1", "safran_v1", "mwms_v1"]);
  const sourceAttempts = snapshot.sourceAttempts ?? [];

  return (
    snapshot.coverage.requiredCount === 3 &&
    snapshot.coverage.completedCount === 3 &&
    snapshot.coverage.missingTestSlugs.length === 0 &&
    sourceAttempts.length === 3 &&
    sourceAttempts.every(
      (attempt) =>
        attempt.requiredForComposite &&
        attempt.status === "completed" &&
        expectedTestSlugs.has(attempt.testSlug),
    ) &&
    new Set(sourceAttempts.map((attempt) => attempt.testSlug)).size === expectedTestSlugs.size
  );
}

export async function buildTeamFitReportInputSnapshotFromSources(
  input: BuildTeamFitReportInputSnapshotFromSourcesInput,
  deps: TeamFitReportInputDependencies = {},
): Promise<BuildTeamFitReportInputSnapshotFromSourcesResult> {
  const requiredFields: Array<keyof BuildTeamFitReportInputSnapshotFromSourcesInput> = [
    "ephemeralReportReferenceId",
    "organizationId",
    "teamId",
    "participantId",
    "candidateAssessmentAssignmentId",
    "teamAggregationSourceId",
    "locale",
    "generatedAt",
  ];

  if (requiredFields.some((field) => !isNonEmptyString(input[field]))) {
    return buildSourceDirectFailure(
      "invalid_payload",
      "All source-direct Team Fit input fields are required.",
    );
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const organizationContext = await loadOrganizationContext({
    organizationId: input.organizationId,
    supabase,
  });

  if (!organizationContext.ok) {
    return buildSourceDirectFailure("organization_not_found", organizationContext.message);
  }

  const { data: teamData, error: teamError } = await supabase
    .from("teams")
    .select("id, organization_id, name, archived_at")
    .eq("id", input.teamId)
    .maybeSingle();

  if (teamError || !teamData) {
    return buildSourceDirectFailure(
      "team_not_found",
      teamError ? `Failed to load Team Fit team context: ${teamError.message}` : "Team Fit team context was not found.",
    );
  }

  const team = teamData as TeamRow;

  if (team.organization_id !== input.organizationId) {
    return buildSourceDirectFailure(
      "team_organization_mismatch",
      "Team Fit team does not belong to the requested organization.",
    );
  }

  if (team.archived_at) {
    return buildSourceDirectFailure("team_not_found", "Team Fit team context is archived.");
  }

  const { data: participantData, error: participantError } = await supabase
    .from("participants")
    .select("id, organization_id, full_name")
    .eq("id", input.participantId)
    .maybeSingle();

  if (participantError || !participantData) {
    return buildSourceDirectFailure(
      "participant_not_found",
      participantError
        ? `Failed to load Team Fit participant context: ${participantError.message}`
        : "Team Fit participant context was not found.",
    );
  }

  const participant = participantData as ParticipantRow;

  if (participant.organization_id !== input.organizationId) {
    return buildSourceDirectFailure(
      "participant_organization_mismatch",
      "Team Fit participant does not belong to the requested organization.",
    );
  }

  const { data: assignmentData, error: assignmentError } = await supabase
    .from("assessment_assignments")
    .select("id, organization_id, participant_id, assignment_type, status, locale, created_at")
    .eq("id", input.candidateAssessmentAssignmentId)
    .maybeSingle();

  if (assignmentError || !assignmentData) {
    return buildSourceDirectFailure(
      "candidate_source_unavailable",
      assignmentError
        ? `Failed to load candidate assessment assignment: ${assignmentError.message}`
        : "Candidate assessment assignment was not found.",
      "source_unavailable",
    );
  }

  const candidateAssignment = assignmentData as {
    id: string;
    organization_id: string;
    participant_id: string;
    assignment_type: string;
    locale: string | null;
    created_at: string;
  };

  if (
    candidateAssignment.organization_id !== input.organizationId ||
    candidateAssignment.participant_id !== input.participantId
  ) {
    return buildSourceDirectFailure(
      "candidate_source_lineage_mismatch",
      "Candidate assessment assignment does not belong to the requested organization and participant.",
      "source_invalid",
    );
  }

  if (candidateAssignment.assignment_type !== "standard_battery") {
    return buildSourceDirectFailure(
      "candidate_source_invalid",
      "Candidate assessment assignment is not a standard_battery source.",
      "source_invalid",
    );
  }

  const buildCompositeInputSnapshot =
    deps.buildCompositeInputSnapshot ?? buildCompositeHrInputSnapshot;
  let compositeSnapshot: CompositeHrInputSnapshot;

  try {
    compositeSnapshot = await buildCompositeInputSnapshot({
      assessmentAssignmentId: candidateAssignment.id,
      organizationId: input.organizationId,
      participantId: input.participantId,
      locale: input.locale,
    });
  } catch (error) {
    return buildSourceDirectFailure(
      "candidate_source_invalid",
      error instanceof Error ? error.message : "Candidate composite source could not be built.",
      "source_invalid",
    );
  }

  if (!hasExactTeamFitCandidateCoverage(compositeSnapshot)) {
    return buildSourceDirectFailure(
      "candidate_source_invalid",
      "Candidate composite source does not have exact 3/3 Team Fit coverage with completed deterministic sources.",
      "source_invalid",
    );
  }

  const candidateSignals = buildCandidateSignalsFromSnapshot({
    snapshot: compositeSnapshot,
    sourceId: candidateAssignment.id,
  });

  const { data: aggregationReferenceData, error: aggregationReferenceError } = await supabase
    .from("team_assessment_aggregation_snapshots")
    .select("id, team_assessment_assignment_id, team_id, aggregation_version")
    .eq("id", input.teamAggregationSourceId)
    .maybeSingle();

  if (aggregationReferenceError || !aggregationReferenceData) {
    return buildSourceDirectFailure(
      "team_source_unavailable",
      aggregationReferenceError
        ? `Failed to load Team Dynamics aggregation source: ${aggregationReferenceError.message}`
        : "Team Dynamics aggregation source was not found.",
      "available",
      "source_unavailable",
    );
  }

  const aggregationReference = aggregationReferenceData as TeamAggregationSnapshotReferenceRow;

  if (aggregationReference.team_id && aggregationReference.team_id !== input.teamId) {
    return buildSourceDirectFailure(
      "team_source_lineage_mismatch",
      "Team Dynamics aggregation snapshot does not belong to the requested team.",
      "available",
      "source_invalid",
    );
  }

  const { data: teamAssignmentData, error: teamAssignmentError } = await supabase
    .from("team_assessment_assignments")
    .select("id, team_id, package_slug")
    .eq("id", aggregationReference.team_assessment_assignment_id)
    .maybeSingle();

  if (teamAssignmentError || !teamAssignmentData) {
    return buildSourceDirectFailure(
      "team_source_invalid",
      teamAssignmentError
        ? `Failed to load Team Dynamics assignment lineage: ${teamAssignmentError.message}`
        : "Team Dynamics assignment lineage was not found.",
      "available",
      "source_invalid",
    );
  }

  const teamAssignment = teamAssignmentData as TeamAssessmentAssignmentReferenceRow;

  if (teamAssignment.team_id !== input.teamId) {
    return buildSourceDirectFailure(
      "team_source_lineage_mismatch",
      "Team Dynamics aggregation assignment does not belong to the requested team.",
      "available",
      "source_invalid",
    );
  }

  const loadTeamAggregationVerification =
    deps.loadTeamAggregationVerification ?? loadTeamDynamicsFinalAggregationVerification;
  const verification = await loadTeamAggregationVerification(
    {
      teamAssessmentAssignmentId: teamAssignment.id,
      aggregationVersion: aggregationReference.aggregation_version,
    },
    { supabase },
  );
  const teamFullCoverage =
    verification.status === "ready" &&
    verification.aggregationSnapshotId === aggregationReference.id &&
    verification.incompleteMemberCount === 0 &&
    verification.missingScoreCount === 0 &&
    verification.invalidScoreCount === 0;

  if (verification.status !== "ready") {
    return buildSourceDirectFailure(
      "team_source_invalid",
      `Team Dynamics aggregation verification is ${verification.status}: ${verification.reason ?? "no reason provided"}.`,
      "available",
      "source_invalid",
      false,
    );
  }

  if (!teamFullCoverage) {
    return buildSourceDirectFailure(
      "team_source_invalid",
      "Team Dynamics aggregation source is not the requested snapshot or does not have full coverage.",
      "available",
      "source_invalid",
      false,
    );
  }

  const teamSignals = buildTeamSignalsFromResolved({
    result: verification,
    sourceMetadata: {
      sourceId: aggregationReference.id,
      sourceVersion: verification.aggregationVersion,
      teamAssessmentAssignmentId: teamAssignment.id,
      aggregationSnapshotId: verification.aggregationSnapshotId,
    },
  });

  if (candidateSignals.sourceStatus !== "available" || teamSignals.sourceStatus !== "available") {
    return buildSourceDirectFailure(
      "team_source_invalid",
      "Team Fit source-direct input requires available candidate and team signals.",
      candidateSignals.sourceStatus,
      teamSignals.sourceStatus,
      false,
    );
  }

  return {
    ok: true,
    ephemeralReportReferenceId: input.ephemeralReportReferenceId,
    inputSnapshot: buildTeamFitReportInputSnapshotFromValidatedSources({
      reportReferenceId: input.ephemeralReportReferenceId,
      organization: organizationContext.organization,
      team,
      participant,
      candidateSourceId: candidateAssignment.id,
      teamSourceId: aggregationReference.id,
      candidateSignals,
      teamSignals,
      locale: input.locale,
      generatedAt: input.generatedAt,
    }),
    candidateSourceStatus: "available",
    candidateCoverage: {
      requiredCount: compositeSnapshot.coverage.requiredCount,
      completedCount: compositeSnapshot.coverage.completedCount,
      missingTestSlugs: [...compositeSnapshot.coverage.missingTestSlugs],
    },
    teamSourceStatus: "available",
    teamFullCoverage: true,
  };
}

export async function persistTeamFitReportInputSnapshot(
  input: {
    teamFitReportId: string;
    organizationId: string;
  },
  deps: TeamFitReportInputDependencies = {},
): Promise<PersistTeamFitReportInputSnapshotResult> {
  const buildResult = await buildTeamFitReportInputSnapshot(input, deps);

  if (!buildResult.ok) {
    return buildResult;
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const reportRow = await loadReportRow({
    teamFitReportId: input.teamFitReportId,
    organizationId: input.organizationId,
    supabase,
  });

  if (!reportRow) {
    return {
      ok: false,
      reason: "update_failed",
      message: "Team Fit report row was not found during input snapshot persistence.",
    };
  }

  if (isTeamFitReportInputSnapshot(reportRow.input_snapshot)) {
    return buildResult;
  }

  const { data, error } = await supabase
    .from("team_fit_reports")
    .update({
      input_snapshot: buildResult.inputSnapshot,
    })
    .eq("id", input.teamFitReportId)
    .eq("organization_id", input.organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      reason: "update_failed",
      message: `Failed to persist Team Fit report input snapshot: ${error.message}`,
    };
  }

  if (!data) {
    return {
      ok: false,
      reason: "update_failed",
      message: "Team Fit report input snapshot update did not match a report row.",
    };
  }

  return buildResult;
}
