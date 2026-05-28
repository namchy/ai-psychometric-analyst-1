import "server-only";

import {
  TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION,
  type TeamDynamicsFinalAggregatedScoreEntry,
  type TeamDynamicsFinalAggregationResult,
} from "@/lib/assessment/team-dynamics-final-aggregation";
import { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG } from "@/lib/assessment/team-dynamics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamAssessmentAssignmentRow = {
  id: string;
  team_id: string | null;
  package_slug: string;
};

type TeamAssessmentAggregationSnapshotRow = {
  id: string;
  team_assessment_assignment_id: string;
  team_id: string | null;
  aggregation_version: string;
  aggregation_status: string;
  source_scoring_version: string;
  source_score_snapshot_ids: string[] | null;
  participant_count: number | null;
  completed_participant_count: number | null;
  included_score_count: number | null;
  excluded_score_count: number | null;
  aggregation_snapshot: unknown;
  created_at: string | null;
  updated_at: string | null;
  calculated_at: string | null;
};

export type TeamDynamicsFinalAggregationReadStatus =
  | "not_found"
  | "ready"
  | "invalid";

export type TeamDynamicsFinalAggregationReadResult = {
  status: TeamDynamicsFinalAggregationReadStatus;
  teamAssessmentAssignmentId: string;
  testSlug: string | null;
  aggregationVersion: string;
  aggregationSnapshotId: string | null;
  aggregationSnapshot: TeamDynamicsFinalAggregationResult | Record<string, unknown> | null;
  scoreEntryAggregations: TeamDynamicsFinalAggregatedScoreEntry[];
  hasUnifiedOverallTeamScore: boolean;
  hasTdmBlockAggregation: boolean;
  hasTdmDomainAggregations: boolean;
  hasPsychologicalSafetyAggregation: boolean;
  hasSjtAggregation: boolean;
  hasOutcomePulseAggregation: boolean;
  includedMemberCount: number | null;
  completedMemberCount: number | null;
  readyScoredMemberCount: number | null;
  incompleteMemberCount: number | null;
  missingScoreCount: number | null;
  invalidScoreCount: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  calculatedAt: string | null;
  reason: string | null;
};

type TeamDynamicsFinalAggregationReadDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

type TeamDynamicsFinalAggregationContractFlags = {
  scoreEntryAggregations: TeamDynamicsFinalAggregatedScoreEntry[];
  hasUnifiedOverallTeamScore: boolean;
  hasTdmBlockAggregation: boolean;
  hasTdmDomainAggregations: boolean;
  hasPsychologicalSafetyAggregation: boolean;
  hasSjtAggregation: boolean;
  hasOutcomePulseAggregation: boolean;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isValidAggregatedScoreEntry(value: unknown): value is TeamDynamicsFinalAggregatedScoreEntry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.scoreKey) &&
    isNonEmptyString(value.label) &&
    isNonEmptyString(value.blockKey) &&
    (value.scoreModel === "simple_linear_v1" ||
      value.scoreModel === "expert_key_partial_credit_v1") &&
    (value.entryType === "block_overall" ||
      value.entryType === "domain" ||
      value.entryType === "construct" ||
      value.entryType === "situational_judgment" ||
      value.entryType === "outcome_signal" ||
      value.entryType === "other") &&
    isNonNegativeInteger(value.memberCount) &&
    isNullableFiniteNumber(value.meanScore0To100) &&
    isNullableFiniteNumber(value.minScore0To100) &&
    isNullableFiniteNumber(value.maxScore0To100) &&
    isNullableFiniteNumber(value.standardDeviationScore0To100)
  );
}

function isValidAggregatedScoreEntryArray(
  value: unknown,
): value is TeamDynamicsFinalAggregatedScoreEntry[] {
  return Array.isArray(value) && value.every((entry) => isValidAggregatedScoreEntry(entry));
}

function deriveFinalAggregationFlags(input: {
  aggregationSnapshot: TeamDynamicsFinalAggregationResult;
}): TeamDynamicsFinalAggregationContractFlags {
  const scoreEntryAggregations = input.aggregationSnapshot.scoreEntryAggregations;

  return {
    scoreEntryAggregations,
    hasUnifiedOverallTeamScore:
      isFiniteNumber(input.aggregationSnapshot.teamOverallScore0To100) ||
      isFiniteNumber(input.aggregationSnapshot.meanScore0To100) ||
      isFiniteNumber(input.aggregationSnapshot.minScore0To100) ||
      isFiniteNumber(input.aggregationSnapshot.maxScore0To100) ||
      isFiniteNumber(input.aggregationSnapshot.standardDeviationScore0To100),
    hasTdmBlockAggregation: scoreEntryAggregations.some(
      (entry) => entry.scoreKey === "tdm-31-V1_overall",
    ),
    hasTdmDomainAggregations: scoreEntryAggregations.some((entry) =>
      entry.scoreKey.startsWith("tdm_domain_"),
    ),
    hasPsychologicalSafetyAggregation: scoreEntryAggregations.some(
      (entry) => entry.scoreKey === "psychological_safety_overall",
    ),
    hasSjtAggregation: scoreEntryAggregations.some(
      (entry) => entry.scoreKey === "situational_judgment_overall",
    ),
    hasOutcomePulseAggregation: scoreEntryAggregations.some(
      (entry) => entry.scoreKey === "outcome_pulse_overall",
    ),
  };
}

function buildResult(
  input: Partial<TeamDynamicsFinalAggregationReadResult> & {
    status: TeamDynamicsFinalAggregationReadStatus;
    teamAssessmentAssignmentId: string;
    aggregationVersion: string;
  },
): TeamDynamicsFinalAggregationReadResult {
  const scoreEntryAggregations = input.scoreEntryAggregations ?? [];

  return {
    status: input.status,
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    testSlug: input.testSlug ?? null,
    aggregationVersion: input.aggregationVersion,
    aggregationSnapshotId: input.aggregationSnapshotId ?? null,
    aggregationSnapshot: input.aggregationSnapshot ?? null,
    scoreEntryAggregations,
    hasUnifiedOverallTeamScore: input.hasUnifiedOverallTeamScore ?? false,
    hasTdmBlockAggregation:
      input.hasTdmBlockAggregation ??
      scoreEntryAggregations.some((entry) => entry.scoreKey === "tdm-31-V1_overall"),
    hasTdmDomainAggregations:
      input.hasTdmDomainAggregations ??
      scoreEntryAggregations.some((entry) => entry.scoreKey.startsWith("tdm_domain_")),
    hasPsychologicalSafetyAggregation:
      input.hasPsychologicalSafetyAggregation ??
      scoreEntryAggregations.some(
        (entry) => entry.scoreKey === "psychological_safety_overall",
      ),
    hasSjtAggregation:
      input.hasSjtAggregation ??
      scoreEntryAggregations.some(
        (entry) => entry.scoreKey === "situational_judgment_overall",
      ),
    hasOutcomePulseAggregation:
      input.hasOutcomePulseAggregation ??
      scoreEntryAggregations.some((entry) => entry.scoreKey === "outcome_pulse_overall"),
    includedMemberCount: input.includedMemberCount ?? null,
    completedMemberCount: input.completedMemberCount ?? null,
    readyScoredMemberCount: input.readyScoredMemberCount ?? null,
    incompleteMemberCount: input.incompleteMemberCount ?? null,
    missingScoreCount: input.missingScoreCount ?? null,
    invalidScoreCount: input.invalidScoreCount ?? null,
    createdAt: input.createdAt ?? null,
    updatedAt: input.updatedAt ?? null,
    calculatedAt: input.calculatedAt ?? null,
    reason: input.reason ?? null,
  };
}

function isValidFinalAggregationSnapshot(
  value: unknown,
): value is TeamDynamicsFinalAggregationResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.status === "ready" || value.status === "not_ready" || value.status === "invalid") &&
    isNonEmptyString(value.teamAssessmentAssignmentId) &&
    isNonEmptyString(value.aggregationVersion) &&
    isNonEmptyString(value.scoringVersion) &&
    isNonNegativeInteger(value.participantCount) &&
    isNonNegativeInteger(value.completedParticipantCount) &&
    isNonNegativeInteger(value.incompleteMemberCount) &&
    isNonNegativeInteger(value.readyScoredMemberCount) &&
    isNonNegativeInteger(value.missingScoreCount) &&
    isNonNegativeInteger(value.invalidScoreCount) &&
    Array.isArray(value.sourceScoreSnapshotIds) &&
    Array.isArray(value.incompleteMemberParticipantIds) &&
    Array.isArray(value.missingScoreParticipantIds) &&
    Array.isArray(value.invalidScoreParticipantIds) &&
    Array.isArray(value.issues) &&
    isValidAggregatedScoreEntryArray(value.scoreEntryAggregations) &&
    isValidAggregatedScoreEntryArray(value.tdmDomainAggregations) &&
    (value.psychologicalSafetyAggregationEntry === null ||
      isValidAggregatedScoreEntry(value.psychologicalSafetyAggregationEntry)) &&
    (value.sjtAggregationEntry === null ||
      isValidAggregatedScoreEntry(value.sjtAggregationEntry)) &&
    (value.outcomePulseAggregationEntry === null ||
      isValidAggregatedScoreEntry(value.outcomePulseAggregationEntry)) &&
    value.teamOverallScore0To100 === null &&
    value.meanScore0To100 === null &&
    value.minScore0To100 === null &&
    value.maxScore0To100 === null &&
    value.standardDeviationScore0To100 === null &&
    Array.isArray(value.reasons)
  );
}

function validateReadySnapshot(input: {
  row: TeamAssessmentAggregationSnapshotRow;
  assignment: TeamAssessmentAssignmentRow;
  aggregationVersion: string;
  aggregationSnapshot: TeamDynamicsFinalAggregationResult;
}): string[] {
  const reasons: string[] = [];
  const { row, aggregationSnapshot } = input;

  if (row.team_assessment_assignment_id !== input.assignment.id) {
    reasons.push("assignment_mismatch");
  }

  if (row.team_id !== input.assignment.team_id) {
    reasons.push("team_id_mismatch");
  }

  if (row.aggregation_version !== input.aggregationVersion) {
    reasons.push("aggregation_version_mismatch");
  }

  if (row.aggregation_status !== "ready") {
    reasons.push("aggregation_status_not_ready");
  }

  if (aggregationSnapshot.status !== "ready") {
    reasons.push("aggregation_snapshot_not_ready");
  }

  if (aggregationSnapshot.teamAssessmentAssignmentId !== input.assignment.id) {
    reasons.push("snapshot_assignment_mismatch");
  }

  if (aggregationSnapshot.testSlug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG) {
    reasons.push("snapshot_test_slug_invalid");
  }

  if (aggregationSnapshot.aggregationVersion !== input.aggregationVersion) {
    reasons.push("snapshot_aggregation_version_mismatch");
  }

  if (aggregationSnapshot.participantCount !== row.participant_count) {
    reasons.push("participant_count_mismatch");
  }

  if (aggregationSnapshot.completedParticipantCount !== row.completed_participant_count) {
    reasons.push("completed_participant_count_mismatch");
  }

  if (aggregationSnapshot.readyScoredMemberCount !== row.included_score_count) {
    reasons.push("ready_scored_member_count_mismatch");
  }

  if (
    aggregationSnapshot.incompleteMemberCount +
      aggregationSnapshot.missingScoreCount +
      aggregationSnapshot.invalidScoreCount !==
    row.excluded_score_count
  ) {
    reasons.push("excluded_score_count_mismatch");
  }

  if (aggregationSnapshot.hasTopLevelOverallScore) {
    reasons.push("unified_overall_team_score_present");
  }

  if (aggregationSnapshot.teamOverallScore0To100 !== null) {
    reasons.push("team_overall_score_present");
  }

  if (aggregationSnapshot.participantCount !== aggregationSnapshot.completedParticipantCount) {
    reasons.push("partial_aggregation_detected_completed_coverage");
  }

  if (aggregationSnapshot.participantCount !== aggregationSnapshot.readyScoredMemberCount) {
    reasons.push("partial_aggregation_detected_ready_coverage");
  }

  if (aggregationSnapshot.incompleteMemberCount !== 0) {
    reasons.push("partial_aggregation_detected_incomplete_members");
  }

  if (aggregationSnapshot.missingScoreCount !== 0) {
    reasons.push("partial_aggregation_detected_missing_scores");
  }

  if (aggregationSnapshot.invalidScoreCount !== 0) {
    reasons.push("partial_aggregation_detected_invalid_scores");
  }

  const flags = deriveFinalAggregationFlags({
    aggregationSnapshot,
  });

  if (flags.hasUnifiedOverallTeamScore) {
    reasons.push("unified_overall_team_score_present");
  }

  if (!flags.hasTdmBlockAggregation) {
    reasons.push("tdm_block_aggregation_missing");
  }

  if (!flags.hasTdmDomainAggregations) {
    reasons.push("tdm_domain_aggregations_missing");
  }

  if (!flags.hasPsychologicalSafetyAggregation) {
    reasons.push("psychological_safety_aggregation_missing");
  }

  if (!flags.hasSjtAggregation) {
    reasons.push("sjt_aggregation_missing");
  }

  if (!flags.hasOutcomePulseAggregation) {
    reasons.push("outcome_pulse_aggregation_missing");
  }

  return Array.from(new Set(reasons));
}

export async function loadTeamDynamicsFinalAggregationVerification(input: {
  teamAssessmentAssignmentId: string;
  aggregationVersion?: string;
}, deps: TeamDynamicsFinalAggregationReadDependencies = {}): Promise<TeamDynamicsFinalAggregationReadResult> {
  const aggregationVersion =
    input.aggregationVersion ?? TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION;

  if (!isNonEmptyString(input.teamAssessmentAssignmentId)) {
    return buildResult({
      status: "invalid",
      teamAssessmentAssignmentId: "",
      aggregationVersion,
      reason: "teamAssessmentAssignmentId is required.",
    });
  }

  if (!isNonEmptyString(aggregationVersion)) {
    return buildResult({
      status: "invalid",
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion: "",
      reason: "aggregationVersion is required.",
    });
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const { data: assignmentData, error: assignmentError } = await supabase
    .from("team_assessment_assignments")
    .select("id, team_id, package_slug")
    .eq("id", input.teamAssessmentAssignmentId)
    .maybeSingle();

  if (assignmentError) {
    return buildResult({
      status: "invalid",
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion,
      reason: `Failed to load Team Dynamics final aggregation assignment context: ${assignmentError.message}`,
    });
  }

  const assignment = (assignmentData as TeamAssessmentAssignmentRow | null) ?? null;

  if (!assignment) {
    return buildResult({
      status: "invalid",
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion,
      reason: "team_assessment_assignment_not_found",
    });
  }

  if (assignment.package_slug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG) {
    return buildResult({
      status: "invalid",
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      testSlug: assignment.package_slug,
      aggregationVersion,
      reason: `unsupported_assessment:${TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG}`,
    });
  }

  const { data: rowData, error: rowError } = await supabase
    .from("team_assessment_aggregation_snapshots")
    .select(
      "id, team_assessment_assignment_id, team_id, aggregation_version, aggregation_status, source_scoring_version, source_score_snapshot_ids, participant_count, completed_participant_count, included_score_count, excluded_score_count, aggregation_snapshot, created_at, updated_at, calculated_at",
    )
    .eq("team_assessment_assignment_id", input.teamAssessmentAssignmentId)
    .eq("aggregation_version", aggregationVersion)
    .maybeSingle();

  if (rowError) {
    return buildResult({
      status: "invalid",
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      testSlug: TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
      aggregationVersion,
      reason: `aggregation_snapshot_load_failed:${rowError.message}`,
    });
  }

  const row = (rowData as TeamAssessmentAggregationSnapshotRow | null) ?? null;

  if (!row) {
    return buildResult({
      status: "not_found",
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      testSlug: TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
      aggregationVersion,
    });
  }

  if (!isValidFinalAggregationSnapshot(row.aggregation_snapshot)) {
    return buildResult({
      status: "invalid",
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      testSlug: TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
      aggregationVersion,
      aggregationSnapshotId: row.id,
      aggregationSnapshot: isRecord(row.aggregation_snapshot) ? row.aggregation_snapshot : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      calculatedAt: row.calculated_at,
      reason: "invalid_aggregation_snapshot_shape",
    });
  }

  const aggregationSnapshot = row.aggregation_snapshot;
  const reasons = validateReadySnapshot({
    row,
    assignment,
    aggregationVersion,
    aggregationSnapshot,
  });
  const flags = deriveFinalAggregationFlags({
    aggregationSnapshot,
  });

  if (reasons.length > 0) {
    return buildResult({
      status: "invalid",
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      testSlug: TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
      aggregationVersion,
      aggregationSnapshotId: row.id,
      aggregationSnapshot,
      scoreEntryAggregations: flags.scoreEntryAggregations,
      hasUnifiedOverallTeamScore: flags.hasUnifiedOverallTeamScore,
      hasTdmBlockAggregation: flags.hasTdmBlockAggregation,
      hasTdmDomainAggregations: flags.hasTdmDomainAggregations,
      hasPsychologicalSafetyAggregation: flags.hasPsychologicalSafetyAggregation,
      hasSjtAggregation: flags.hasSjtAggregation,
      hasOutcomePulseAggregation: flags.hasOutcomePulseAggregation,
      includedMemberCount: aggregationSnapshot.participantCount,
      completedMemberCount: aggregationSnapshot.completedParticipantCount,
      readyScoredMemberCount: aggregationSnapshot.readyScoredMemberCount,
      incompleteMemberCount: aggregationSnapshot.incompleteMemberCount,
      missingScoreCount: aggregationSnapshot.missingScoreCount,
      invalidScoreCount: aggregationSnapshot.invalidScoreCount,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      calculatedAt: row.calculated_at,
      reason: reasons.join(","),
    });
  }

  return buildResult({
    status: "ready",
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    testSlug: TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
    aggregationVersion,
    aggregationSnapshotId: row.id,
    aggregationSnapshot,
    scoreEntryAggregations: flags.scoreEntryAggregations,
    hasUnifiedOverallTeamScore: flags.hasUnifiedOverallTeamScore,
    hasTdmBlockAggregation: flags.hasTdmBlockAggregation,
    hasTdmDomainAggregations: flags.hasTdmDomainAggregations,
    hasPsychologicalSafetyAggregation: flags.hasPsychologicalSafetyAggregation,
    hasSjtAggregation: flags.hasSjtAggregation,
    hasOutcomePulseAggregation: flags.hasOutcomePulseAggregation,
    includedMemberCount: aggregationSnapshot.participantCount,
    completedMemberCount: aggregationSnapshot.completedParticipantCount,
    readyScoredMemberCount: aggregationSnapshot.readyScoredMemberCount,
    incompleteMemberCount: aggregationSnapshot.incompleteMemberCount,
    missingScoreCount: aggregationSnapshot.missingScoreCount,
    invalidScoreCount: aggregationSnapshot.invalidScoreCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    calculatedAt: row.calculated_at,
  });
}
