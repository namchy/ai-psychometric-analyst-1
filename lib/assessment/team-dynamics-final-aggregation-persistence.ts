import "server-only";

import {
  loadTeamDynamicsFinalAggregation,
  TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION,
  type TeamDynamicsFinalAggregationResult,
} from "@/lib/assessment/team-dynamics-final-aggregation";
import {
  TEAM_ASSESSMENT_AGGREGATION_ALLOWED_STATUSES,
  type TeamAssessmentAggregationPersistenceStatus,
} from "@/lib/assessment/team-assessment-aggregation-persistence";
import {
  TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION,
} from "@/lib/assessment/team-dynamics-mixed-score-persistence";
import { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG } from "@/lib/assessment/team-dynamics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const TEAM_DYNAMICS_FINAL_AGGREGATION_PERSISTENCE_FAILURE_CODES = [
  "invalid_payload",
  "load_assignment_failed",
  "assignment_not_found",
  "unsupported_assessment",
  "load_existing_failed",
  "insert_failed",
  "update_failed",
] as const;

type TeamDynamicsFinalAggregationPersistenceFailureCode =
  (typeof TEAM_DYNAMICS_FINAL_AGGREGATION_PERSISTENCE_FAILURE_CODES)[number];

type TeamAssessmentAssignmentRow = {
  id: string;
  team_id: string;
  package_slug: string;
};

type TeamAssessmentAggregationSnapshotRow = {
  id: string;
  team_assessment_assignment_id: string;
  team_id: string;
  aggregation_version: string;
  aggregation_status: TeamAssessmentAggregationPersistenceStatus;
  source_scoring_version: string;
  source_score_snapshot_ids: string[];
  calculated_at: string;
};

type TeamDynamicsFinalAggregationPersistenceDependencies = {
  loadFinalAggregation?: typeof loadTeamDynamicsFinalAggregation;
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

export type TeamDynamicsFinalAggregationPersistenceResult =
  | {
      ok: true;
      mode: "inserted" | "updated";
      value: {
        id: string;
        teamAssessmentAssignmentId: string;
        teamId: string;
        aggregationVersion: string;
        aggregationStatus: TeamAssessmentAggregationPersistenceStatus;
        sourceScoringVersion: string;
        sourceScoreSnapshotIds: string[];
        calculatedAt: string;
        aggregation: TeamDynamicsFinalAggregationResult;
      };
    }
  | {
      ok: false;
      code: TeamDynamicsFinalAggregationPersistenceFailureCode;
      reason: string;
      aggregation?: TeamDynamicsFinalAggregationResult;
    };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function persistFail(
  code: TeamDynamicsFinalAggregationPersistenceFailureCode,
  reason: string,
  aggregation?: TeamDynamicsFinalAggregationResult,
): TeamDynamicsFinalAggregationPersistenceResult {
  return {
    ok: false,
    code,
    reason,
    ...(aggregation ? { aggregation } : {}),
  };
}

function mapAggregationStatus(
  status: TeamDynamicsFinalAggregationResult["status"],
): TeamAssessmentAggregationPersistenceStatus {
  return status === "ready" ? "ready" : "not_ready";
}

function buildAggregationSnapshotPatch(input: {
  teamAssessmentAssignmentId: string;
  teamId: string;
  aggregationVersion: string;
  sourceScoringVersion: string;
  aggregationStatus: TeamAssessmentAggregationPersistenceStatus;
  aggregation: TeamDynamicsFinalAggregationResult;
  calculatedAt: string;
}): Record<string, unknown> {
  return {
    team_assessment_assignment_id: input.teamAssessmentAssignmentId,
    team_id: input.teamId,
    aggregation_version: input.aggregationVersion,
    aggregation_status: input.aggregationStatus,
    source_scoring_version: input.sourceScoringVersion,
    source_score_snapshot_ids: input.aggregation.sourceScoreSnapshotIds,
    participant_count: input.aggregation.participantCount,
    completed_participant_count: input.aggregation.completedParticipantCount,
    included_score_count: input.aggregation.readyScoredMemberCount,
    excluded_score_count:
      input.aggregation.incompleteMemberCount +
      input.aggregation.missingScoreCount +
      input.aggregation.invalidScoreCount,
    missing_completed_score_participant_ids:
      input.aggregation.missingScoreParticipantIds,
    mean_score_0_100: null,
    min_score_0_100: null,
    max_score_0_100: null,
    range_score_0_100: null,
    aggregation_snapshot: input.aggregation,
    calculated_at: input.calculatedAt,
  };
}

async function loadAssignment(input: {
  teamAssessmentAssignmentId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<
  | { ok: true; assignment: TeamAssessmentAssignmentRow }
  | {
      ok: false;
      code: TeamDynamicsFinalAggregationPersistenceFailureCode;
      reason: string;
    }
> {
  const { data, error } = await input.supabase
    .from("team_assessment_assignments")
    .select("id, team_id, package_slug")
    .eq("id", input.teamAssessmentAssignmentId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: "load_assignment_failed",
      reason: `Unable to load Team Dynamics final aggregation assignment context: ${error.message}`,
    };
  }

  const assignment = (data as TeamAssessmentAssignmentRow | null) ?? null;

  if (!assignment) {
    return {
      ok: false,
      code: "assignment_not_found",
      reason: "Team Dynamics final aggregation assignment was not found.",
    };
  }

  if (assignment.package_slug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG) {
    return {
      ok: false,
      code: "unsupported_assessment",
      reason: `This aggregation helper only supports ${TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG}.`,
    };
  }

  return {
    ok: true,
    assignment,
  };
}

export async function persistTeamDynamicsFinalAggregationSnapshot(input: {
  teamAssessmentAssignmentId: string;
  aggregationVersion?: string;
  scoringVersion?: string;
}, deps: TeamDynamicsFinalAggregationPersistenceDependencies = {}): Promise<TeamDynamicsFinalAggregationPersistenceResult> {
  if (!isNonEmptyString(input.teamAssessmentAssignmentId)) {
    return persistFail(
      "invalid_payload",
      "teamAssessmentAssignmentId is required.",
    );
  }

  const aggregationVersion =
    input.aggregationVersion ?? TEAM_DYNAMICS_FINAL_AGGREGATION_VERSION;
  const scoringVersion =
    input.scoringVersion ?? TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION;

  if (!isNonEmptyString(aggregationVersion)) {
    return persistFail("invalid_payload", "aggregationVersion is required.");
  }

  if (!isNonEmptyString(scoringVersion)) {
    return persistFail("invalid_payload", "scoringVersion is required.");
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const loadFinalAggregation =
    deps.loadFinalAggregation ?? loadTeamDynamicsFinalAggregation;

  const assignmentResult = await loadAssignment({
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    supabase,
  });

  if (!assignmentResult.ok) {
    return persistFail(assignmentResult.code, assignmentResult.reason);
  }

  const aggregation = await loadFinalAggregation(
    {
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      aggregationVersion,
      scoringVersion,
    },
    {
      supabase,
    },
  );

  const aggregationStatus = mapAggregationStatus(aggregation.status);

  if (
    TEAM_ASSESSMENT_AGGREGATION_ALLOWED_STATUSES.includes(aggregationStatus) === false
  ) {
    return persistFail(
      "invalid_payload",
      "Unsupported Team Dynamics final aggregation status.",
      aggregation,
    );
  }

  const calculatedAt = new Date().toISOString();
  const patch = buildAggregationSnapshotPatch({
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    teamId: assignmentResult.assignment.team_id,
    aggregationVersion,
    sourceScoringVersion: scoringVersion,
    aggregationStatus,
    aggregation,
    calculatedAt,
  });

  const { data: existingRowData, error: existingRowError } = await supabase
    .from("team_assessment_aggregation_snapshots")
    .select("id")
    .eq("team_assessment_assignment_id", input.teamAssessmentAssignmentId)
    .eq("aggregation_version", aggregationVersion)
    .maybeSingle();

  if (existingRowError) {
    return persistFail(
      "load_existing_failed",
      `Unable to inspect existing Team Dynamics final aggregation snapshot: ${existingRowError.message}`,
      aggregation,
    );
  }

  const existingRow = (existingRowData as { id: string } | null) ?? null;
  const selectClause =
    "id, team_assessment_assignment_id, team_id, aggregation_version, aggregation_status, source_scoring_version, source_score_snapshot_ids, calculated_at";

  if (existingRow) {
    const { data: updatedRowData, error: updatedRowError } = await supabase
      .from("team_assessment_aggregation_snapshots")
      .update(patch)
      .eq("id", existingRow.id)
      .select(selectClause)
      .single();

    if (updatedRowError || !updatedRowData) {
      return persistFail(
        "update_failed",
        `Unable to update Team Dynamics final aggregation snapshot: ${updatedRowError?.message ?? "Unknown error"}`,
        aggregation,
      );
    }

    const updatedRow = updatedRowData as TeamAssessmentAggregationSnapshotRow;
    return {
      ok: true,
      mode: "updated",
      value: {
        id: updatedRow.id,
        teamAssessmentAssignmentId: updatedRow.team_assessment_assignment_id,
        teamId: updatedRow.team_id,
        aggregationVersion: updatedRow.aggregation_version,
        aggregationStatus: updatedRow.aggregation_status,
        sourceScoringVersion: updatedRow.source_scoring_version,
        sourceScoreSnapshotIds: updatedRow.source_score_snapshot_ids,
        calculatedAt: updatedRow.calculated_at,
        aggregation,
      },
    };
  }

  const { data: insertedRowData, error: insertedRowError } = await supabase
    .from("team_assessment_aggregation_snapshots")
    .insert(patch)
    .select(selectClause)
    .single();

  if (insertedRowError || !insertedRowData) {
    return persistFail(
      "insert_failed",
      `Unable to persist Team Dynamics final aggregation snapshot: ${insertedRowError?.message ?? "Unknown error"}`,
      aggregation,
    );
  }

  const insertedRow = insertedRowData as TeamAssessmentAggregationSnapshotRow;
  return {
    ok: true,
    mode: "inserted",
    value: {
      id: insertedRow.id,
      teamAssessmentAssignmentId: insertedRow.team_assessment_assignment_id,
      teamId: insertedRow.team_id,
      aggregationVersion: insertedRow.aggregation_version,
      aggregationStatus: insertedRow.aggregation_status,
      sourceScoringVersion: insertedRow.source_scoring_version,
      sourceScoreSnapshotIds: insertedRow.source_score_snapshot_ids,
      calculatedAt: insertedRow.calculated_at,
      aggregation,
    },
  };
}
