import "server-only";

import {
  loadTeamAssessmentAggregationDraft,
  type TeamAssessmentAggregationDraftReadinessStatus,
  type TeamAssessmentAggregationDraftResult,
} from "@/lib/assessment/team-assessment-aggregation-draft";
import {
  loadTeamAssessmentScoreVerification,
} from "@/lib/assessment/team-assessment-score-read";
import { TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION } from "@/lib/assessment/team-assessment-score-persistence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const TEAM_ASSESSMENT_AGGREGATION_VERSION =
  "team_dynamics_minimal_aggregation_v1";

export const TEAM_ASSESSMENT_AGGREGATION_PERSISTENCE_FAILURE_CODES = [
  "invalid_payload",
  "load_assignment_failed",
  "assignment_not_found",
  "load_existing_failed",
  "insert_failed",
  "update_failed",
] as const;

export type TeamAssessmentAggregationPersistenceFailureCode =
  (typeof TEAM_ASSESSMENT_AGGREGATION_PERSISTENCE_FAILURE_CODES)[number];

export type TeamAssessmentAggregationPersistenceStatus =
  | "ready"
  | "not_ready"
  | "stale"
  | "failed";

type TeamAssessmentAssignmentRow = {
  id: string;
  team_id: string;
};

type TeamAssessmentParticipantStatusRow = {
  id: string;
  status: "invited" | "started" | "completed" | "expired";
};

type TeamAssessmentAggregationSnapshotRow = {
  id: string;
  team_assessment_assignment_id: string;
  team_id: string;
  aggregation_version: string;
  aggregation_status: TeamAssessmentAggregationPersistenceStatus;
  source_scoring_version: string;
  source_score_snapshot_ids: string[];
  participant_count: number;
  completed_participant_count: number;
  included_score_count: number;
  excluded_score_count: number;
  missing_completed_score_participant_ids: string[];
  mean_score_0_100: number | null;
  min_score_0_100: number | null;
  max_score_0_100: number | null;
  range_score_0_100: number | null;
  aggregation_snapshot: Record<string, unknown>;
  calculated_at: string;
};

type TeamAssessmentAggregationPersistenceDependencies = {
  loadAggregationDraft?: typeof loadTeamAssessmentAggregationDraft;
  loadScoreVerification?: typeof loadTeamAssessmentScoreVerification;
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

export type TeamAssessmentAggregationPersistenceResult =
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
        draft: TeamAssessmentAggregationDraftResult;
      };
    }
  | {
      ok: false;
      code: TeamAssessmentAggregationPersistenceFailureCode;
      reason: string;
    };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function persistFail(
  code: TeamAssessmentAggregationPersistenceFailureCode,
  reason: string,
): TeamAssessmentAggregationPersistenceResult {
  return {
    ok: false,
    code,
    reason,
  };
}

function mapDraftStatusToAggregationStatus(
  draftStatus: TeamAssessmentAggregationDraftReadinessStatus,
): TeamAssessmentAggregationPersistenceStatus {
  return draftStatus === "ready" ? "ready" : "not_ready";
}

function buildAggregationSnapshotPayload(input: {
  aggregationVersion: string;
  sourceScoringVersion: string;
  sourceScoreSnapshotIds: string[];
  draft: TeamAssessmentAggregationDraftResult;
}): Record<string, unknown> {
  return {
    teamAssessmentAssignmentId: input.draft.teamAssessmentAssignmentId,
    aggregationVersion: input.aggregationVersion,
    sourceScoringVersion: input.sourceScoringVersion,
    sourceScoreSnapshotIds: input.sourceScoreSnapshotIds,
    participantCount: input.draft.participantCount,
    completedParticipantCount: input.draft.completedParticipantCount,
    scoreSnapshotCount: input.draft.scoreSnapshotCount,
    missingCompletedScoreParticipantIds:
      input.draft.missingCompletedScoreParticipantIds,
    includedScoreCount: input.draft.includedScoreCount,
    excludedScoreCount: input.draft.excludedScoreCount,
    meanScore0To100: input.draft.meanScore0To100,
    minScore0To100: input.draft.minScore0To100,
    maxScore0To100: input.draft.maxScore0To100,
    rangeScore0To100: input.draft.rangeScore0To100,
    aggregationReadinessStatus: input.draft.aggregationReadinessStatus,
    reasons: input.draft.reasons,
  };
}

function buildAggregationSnapshotPatch(input: {
  teamAssessmentAssignmentId: string;
  teamId: string;
  aggregationVersion: string;
  sourceScoringVersion: string;
  sourceScoreSnapshotIds: string[];
  aggregationStatus: TeamAssessmentAggregationPersistenceStatus;
  draft: TeamAssessmentAggregationDraftResult;
  calculatedAt: string;
}) {
  return {
    team_assessment_assignment_id: input.teamAssessmentAssignmentId,
    team_id: input.teamId,
    aggregation_version: input.aggregationVersion,
    aggregation_status: input.aggregationStatus,
    source_scoring_version: input.sourceScoringVersion,
    source_score_snapshot_ids: input.sourceScoreSnapshotIds,
    participant_count: input.draft.participantCount,
    completed_participant_count: input.draft.completedParticipantCount,
    included_score_count: input.draft.includedScoreCount,
    excluded_score_count: input.draft.excludedScoreCount,
    missing_completed_score_participant_ids:
      input.draft.missingCompletedScoreParticipantIds,
    mean_score_0_100: input.draft.meanScore0To100,
    min_score_0_100: input.draft.minScore0To100,
    max_score_0_100: input.draft.maxScore0To100,
    range_score_0_100: input.draft.rangeScore0To100,
    aggregation_snapshot: buildAggregationSnapshotPayload({
      aggregationVersion: input.aggregationVersion,
      sourceScoringVersion: input.sourceScoringVersion,
      sourceScoreSnapshotIds: input.sourceScoreSnapshotIds,
      draft: input.draft,
    }),
    calculated_at: input.calculatedAt,
  };
}

async function loadAssignment(input: {
  teamAssessmentAssignmentId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<
  | { ok: true; assignment: TeamAssessmentAssignmentRow }
  | { ok: false; code: TeamAssessmentAggregationPersistenceFailureCode; reason: string }
> {
  const { data, error } = await input.supabase
    .from("team_assessment_assignments")
    .select("id, team_id")
    .eq("id", input.teamAssessmentAssignmentId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: "load_assignment_failed",
      reason: `Unable to load Team Dynamics aggregation assignment context: ${error.message}`,
    };
  }

  const assignment = (data as TeamAssessmentAssignmentRow | null) ?? null;

  if (!assignment) {
    return {
      ok: false,
      code: "assignment_not_found",
      reason: "Team Dynamics aggregation assignment was not found.",
    };
  }

  return {
    ok: true,
    assignment,
  };
}

async function loadCompletedParticipantIds(input: {
  teamAssessmentAssignmentId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<string[]> {
  const { data, error } = await input.supabase
    .from("team_assessment_participants")
    .select("id, status")
    .eq("team_assessment_assignment_id", input.teamAssessmentAssignmentId);

  if (error) {
    throw new Error(
      `Unable to load Team Dynamics aggregation participant completion state: ${error.message}`,
    );
  }

  const participantRows =
    ((data ?? []) as TeamAssessmentParticipantStatusRow[]) ?? [];

  return participantRows
    .filter((participantRow) => participantRow.status === "completed")
    .map((participantRow) => participantRow.id);
}

export async function persistTeamAssessmentAggregationSnapshot(input: {
  teamAssessmentAssignmentId: string;
  aggregationVersion?: string;
  scoringVersion?: string;
}, deps: TeamAssessmentAggregationPersistenceDependencies = {}): Promise<TeamAssessmentAggregationPersistenceResult> {
  if (!isNonEmptyString(input.teamAssessmentAssignmentId)) {
    return persistFail(
      "invalid_payload",
      "teamAssessmentAssignmentId is required.",
    );
  }

  const aggregationVersion =
    input.aggregationVersion ?? TEAM_ASSESSMENT_AGGREGATION_VERSION;
  const scoringVersion =
    input.scoringVersion ?? TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION;

  if (!isNonEmptyString(aggregationVersion)) {
    return persistFail("invalid_payload", "aggregationVersion is required.");
  }

  if (!isNonEmptyString(scoringVersion)) {
    return persistFail("invalid_payload", "scoringVersion is required.");
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const loadAggregationDraft =
    deps.loadAggregationDraft ?? loadTeamAssessmentAggregationDraft;
  const loadScoreVerification =
    deps.loadScoreVerification ?? loadTeamAssessmentScoreVerification;

  const assignmentResult = await loadAssignment({
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    supabase,
  });

  if (!assignmentResult.ok) {
    return persistFail(assignmentResult.code, assignmentResult.reason);
  }

  const draft = await loadAggregationDraft(
    {
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      scoringVersion,
    },
    {
      supabase,
    },
  );

  const verification = await loadScoreVerification(
    {
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      scoringVersion,
    },
    {
      supabase,
    },
  );
  const completedParticipantIds = new Set(
    await loadCompletedParticipantIds({
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      supabase,
    }),
  );

  const scoreRowIds = verification.scoreRows
    .filter((scoreRow) =>
      completedParticipantIds.has(scoreRow.teamAssessmentParticipantId) &&
      draft.missingCompletedScoreParticipantIds.includes(scoreRow.teamAssessmentParticipantId) === false
    )
    .map((scoreRow) => scoreRow.scoreRowId)
    .sort();
  const aggregationStatus = mapDraftStatusToAggregationStatus(
    draft.aggregationReadinessStatus,
  );
  const calculatedAt = new Date().toISOString();
  const patch = buildAggregationSnapshotPatch({
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    teamId: assignmentResult.assignment.team_id,
    aggregationVersion,
    sourceScoringVersion: scoringVersion,
    sourceScoreSnapshotIds: scoreRowIds,
    aggregationStatus,
    draft,
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
      `Unable to inspect existing Team Dynamics aggregation snapshot: ${existingRowError.message}`,
    );
  }

  const existingRow = (existingRowData as { id: string } | null) ?? null;
  const selectClause =
    "id, team_assessment_assignment_id, team_id, aggregation_version, aggregation_status, source_scoring_version, source_score_snapshot_ids, participant_count, completed_participant_count, included_score_count, excluded_score_count, missing_completed_score_participant_ids, mean_score_0_100, min_score_0_100, max_score_0_100, range_score_0_100, aggregation_snapshot, calculated_at";

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
        `Unable to update Team Dynamics aggregation snapshot: ${updatedRowError?.message ?? "Unknown error"}`,
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
        draft,
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
      `Unable to persist Team Dynamics aggregation snapshot: ${insertedRowError?.message ?? "Unknown error"}`,
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
      draft,
    },
  };
}
