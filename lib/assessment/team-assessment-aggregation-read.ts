import "server-only";

import {
  TEAM_ASSESSMENT_AGGREGATION_ALLOWED_STATUSES,
  TEAM_ASSESSMENT_AGGREGATION_VERSION,
  type TeamAssessmentAggregationPersistenceStatus,
} from "@/lib/assessment/team-assessment-aggregation-persistence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamAssessmentAggregationSnapshotRow = {
  id: string;
  team_assessment_assignment_id: string;
  team_id: string | null;
  aggregation_version: string;
  aggregation_status: string;
  source_scoring_version: string;
  source_score_snapshot_ids: string[] | null;
  participant_count: number;
  completed_participant_count: number;
  included_score_count: number;
  excluded_score_count: number;
  missing_completed_score_participant_ids: string[] | null;
  mean_score_0_100: number | null;
  min_score_0_100: number | null;
  max_score_0_100: number | null;
  range_score_0_100: number | null;
  aggregation_snapshot: Record<string, unknown> | null;
  calculated_at: string;
  updated_at: string;
};

type TeamAssessmentAggregationReadDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

export type TeamAssessmentAggregationVerificationStatus =
  | "verified"
  | "missing"
  | "invalid";

export type TeamAssessmentAggregationReadVerificationResult = {
  teamAssessmentAssignmentId: string;
  aggregationVersion: string;
  exists: boolean;
  aggregationSnapshotId: string | null;
  teamId: string | null;
  aggregationStatus: TeamAssessmentAggregationPersistenceStatus | null;
  sourceScoringVersion: string | null;
  participantCount: number | null;
  completedParticipantCount: number | null;
  includedScoreCount: number | null;
  excludedScoreCount: number | null;
  missingCompletedScoreParticipantIds: string[];
  sourceScoreSnapshotIds: string[];
  meanScore0To100: number | null;
  minScore0To100: number | null;
  maxScore0To100: number | null;
  rangeScore0To100: number | null;
  calculatedAt: string | null;
  updatedAt: string | null;
  verificationStatus: TeamAssessmentAggregationVerificationStatus;
  reasons: string[];
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isValidScore0To100(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function validateRow(input: {
  row: TeamAssessmentAggregationSnapshotRow;
  teamAssessmentAssignmentId: string;
  aggregationVersion: string;
}): string[] {
  const reasons: string[] = [];
  const { row } = input;

  if (row.team_assessment_assignment_id !== input.teamAssessmentAssignmentId) {
    reasons.push("assignment_mismatch");
  }

  if (row.aggregation_version !== input.aggregationVersion) {
    reasons.push("aggregation_version_mismatch");
  }

  if (!isNonEmptyString(row.team_id)) {
    reasons.push("team_id_missing");
  }

  if (
    TEAM_ASSESSMENT_AGGREGATION_ALLOWED_STATUSES.includes(
      row.aggregation_status as TeamAssessmentAggregationPersistenceStatus,
    ) === false
  ) {
    reasons.push("aggregation_status_invalid");
  }

  if (!isNonNegativeInteger(row.participant_count)) {
    reasons.push("participant_count_invalid");
  }

  if (!isNonNegativeInteger(row.completed_participant_count)) {
    reasons.push("completed_participant_count_invalid");
  }

  if (!isNonNegativeInteger(row.included_score_count)) {
    reasons.push("included_score_count_invalid");
  }

  if (!isNonNegativeInteger(row.excluded_score_count)) {
    reasons.push("excluded_score_count_invalid");
  }

  if (
    typeof row.included_score_count === "number" &&
    typeof row.completed_participant_count === "number" &&
    row.included_score_count > row.completed_participant_count
  ) {
    reasons.push("included_score_count_exceeds_completed_participant_count");
  }

  if (row.mean_score_0_100 !== null && !isValidScore0To100(row.mean_score_0_100)) {
    reasons.push("mean_score_0_100_invalid");
  }

  if (row.min_score_0_100 !== null && !isValidScore0To100(row.min_score_0_100)) {
    reasons.push("min_score_0_100_invalid");
  }

  if (row.max_score_0_100 !== null && !isValidScore0To100(row.max_score_0_100)) {
    reasons.push("max_score_0_100_invalid");
  }

  if (row.range_score_0_100 !== null && !isValidScore0To100(row.range_score_0_100)) {
    reasons.push("range_score_0_100_invalid");
  }

  if (row.aggregation_snapshot == null) {
    reasons.push("aggregation_snapshot_missing");
  }

  return reasons;
}

export async function loadTeamAssessmentAggregationVerification(input: {
  teamAssessmentAssignmentId: string;
  aggregationVersion?: string;
}, deps: TeamAssessmentAggregationReadDependencies = {}): Promise<TeamAssessmentAggregationReadVerificationResult> {
  if (!isNonEmptyString(input.teamAssessmentAssignmentId)) {
    throw new Error("teamAssessmentAssignmentId is required.");
  }

  const aggregationVersion =
    input.aggregationVersion ?? TEAM_ASSESSMENT_AGGREGATION_VERSION;

  if (!isNonEmptyString(aggregationVersion)) {
    throw new Error("aggregationVersion is required.");
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_assessment_aggregation_snapshots")
    .select(
      "id, team_assessment_assignment_id, team_id, aggregation_version, aggregation_status, source_scoring_version, source_score_snapshot_ids, participant_count, completed_participant_count, included_score_count, excluded_score_count, missing_completed_score_participant_ids, mean_score_0_100, min_score_0_100, max_score_0_100, range_score_0_100, aggregation_snapshot, calculated_at, updated_at",
    )
    .eq("team_assessment_assignment_id", input.teamAssessmentAssignmentId)
    .eq("aggregation_version", aggregationVersion)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load persisted Team Dynamics aggregation snapshot: ${error.message}`,
    );
  }

  const row = (data as TeamAssessmentAggregationSnapshotRow | null) ?? null;

  if (!row) {
    return {
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion,
      exists: false,
      aggregationSnapshotId: null,
      teamId: null,
      aggregationStatus: null,
      sourceScoringVersion: null,
      participantCount: null,
      completedParticipantCount: null,
      includedScoreCount: null,
      excludedScoreCount: null,
      missingCompletedScoreParticipantIds: [],
      sourceScoreSnapshotIds: [],
      meanScore0To100: null,
      minScore0To100: null,
      maxScore0To100: null,
      rangeScore0To100: null,
      calculatedAt: null,
      updatedAt: null,
      verificationStatus: "missing",
      reasons: ["aggregation_snapshot_not_found"],
    };
  }

  const reasons = validateRow({
    row,
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    aggregationVersion,
  });

  return {
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    aggregationVersion,
    exists: true,
    aggregationSnapshotId: row.id,
    teamId: row.team_id,
    aggregationStatus:
      TEAM_ASSESSMENT_AGGREGATION_ALLOWED_STATUSES.includes(
        row.aggregation_status as TeamAssessmentAggregationPersistenceStatus,
      )
        ? (row.aggregation_status as TeamAssessmentAggregationPersistenceStatus)
        : null,
    sourceScoringVersion: row.source_scoring_version,
    participantCount: row.participant_count,
    completedParticipantCount: row.completed_participant_count,
    includedScoreCount: row.included_score_count,
    excludedScoreCount: row.excluded_score_count,
    missingCompletedScoreParticipantIds:
      row.missing_completed_score_participant_ids ?? [],
    sourceScoreSnapshotIds: row.source_score_snapshot_ids ?? [],
    meanScore0To100: row.mean_score_0_100,
    minScore0To100: row.min_score_0_100,
    maxScore0To100: row.max_score_0_100,
    rangeScore0To100: row.range_score_0_100,
    calculatedAt: row.calculated_at,
    updatedAt: row.updated_at,
    verificationStatus: reasons.length === 0 ? "verified" : "invalid",
    reasons,
  };
}
