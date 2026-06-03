import "server-only";

import {
  loadTeamAssessmentExecutionContext,
  type TeamAssessmentExecutionContext,
  type TeamAssessmentExecutionContextFailureCode,
} from "@/lib/assessment/team-assessment-execution";
import {
  loadTeamDynamicsMixedScoreForContext,
  type TeamDynamicsMixedScoreResult,
} from "@/lib/assessment/team-dynamics-mixed-scoring";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION =
  "team_dynamics_assessment_v1_mixed_v1";

export const TEAM_DYNAMICS_MIXED_SCORE_PERSISTENCE_FAILURE_CODES = [
  "invalid_payload",
  "score_not_persistable",
  "load_attempt_failed",
  "load_existing_failed",
  "update_failed",
  "insert_failed",
  ...[
    "wrapper_not_found",
    "wrapper_missing_attempt",
    "wrapper_access_denied",
    "membership_inactive",
    "assignment_not_found",
    "assignment_inactive",
    "assignment_wrong_package",
    "team_not_found",
    "organization_unresolved",
    "attempt_not_found",
    "attempt_participant_mismatch",
    "attempt_organization_mismatch",
    "attempt_wrong_test",
    "test_inactive",
  ],
] as const;

export type TeamDynamicsMixedScorePersistenceFailureCode =
  | (typeof TEAM_DYNAMICS_MIXED_SCORE_PERSISTENCE_FAILURE_CODES)[number]
  | TeamAssessmentExecutionContextFailureCode;

type TeamAssessmentParticipantScoreRow = {
  id: string;
  team_assessment_participant_id: string;
  attempt_id: string;
  scoring_version: string;
  scoring_status: string;
  score_snapshot: TeamDynamicsMixedScoreResult;
  source_completed_at: string | null;
  calculated_at: string;
};

export type TeamDynamicsMixedScorePersistenceResult =
  | {
      ok: true;
      mode: "inserted" | "updated";
      value: {
        id: string;
        teamAssessmentParticipantId: string;
        attemptId: string;
        scoringVersion: string;
        scoringStatus: TeamDynamicsMixedScoreResult["status"];
        calculatedAt: string;
        sourceCompletedAt: string | null;
        score: TeamDynamicsMixedScoreResult;
      };
    }
  | {
      ok: false;
      code: TeamDynamicsMixedScorePersistenceFailureCode;
      reason: string;
      score?: TeamDynamicsMixedScoreResult;
    };

type TeamDynamicsMixedScorePersistenceDependencies = {
  loadExecutionContext?: typeof loadTeamAssessmentExecutionContext;
  loadScoreForContext?: typeof loadTeamDynamicsMixedScoreForContext;
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function persistFail(
  code: TeamDynamicsMixedScorePersistenceFailureCode,
  reason: string,
  score?: TeamDynamicsMixedScoreResult,
): TeamDynamicsMixedScorePersistenceResult {
  return {
    ok: false,
    code,
    reason,
    ...(score ? { score } : {}),
  };
}

function canPersistScoreStatus(
  status: TeamDynamicsMixedScoreResult["status"],
): boolean {
  return status === "scored";
}

function buildScoreSnapshotPatch(input: {
  context: TeamAssessmentExecutionContext;
  scoringVersion: string;
  score: TeamDynamicsMixedScoreResult;
  sourceCompletedAt: string | null;
  calculatedAt: string;
}) {
  return {
    team_assessment_participant_id: input.context.teamAssessmentParticipantId,
    attempt_id: input.context.attemptId,
    scoring_version: input.scoringVersion,
    scoring_status: input.score.status,
    raw_total: input.score.rawTotal,
    mean_raw: input.score.meanRaw,
    score_0_100: input.score.score0To100,
    supported_question_count: input.score.supportedQuestionCount,
    scored_question_count: input.score.scoredQuestionCount,
    ignored_invalid_answer_count: input.score.ignoredInvalidAnswerCount,
    scale_min: input.score.scaleMin,
    scale_max: input.score.scaleMax,
    score_value_source: input.score.scoreValueSource,
    missing_question_ids: input.score.missingQuestionIds,
    score_snapshot: input.score,
    source_response_count:
      input.score.scoredQuestionCount + input.score.ignoredInvalidAnswerCount,
    source_completed_at: input.sourceCompletedAt,
    calculated_at: input.calculatedAt,
  };
}

async function loadSourceCompletedAt(input: {
  attemptId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<{ ok: true; completedAt: string | null } | { ok: false; reason: string }> {
  const { data, error } = await input.supabase
    .from("attempts")
    .select("completed_at")
    .eq("id", input.attemptId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      reason: `Unable to load Team Dynamics mixed score source completion timestamp: ${error.message}`,
    };
  }

  return {
    ok: true,
    completedAt: ((data as { completed_at?: string | null } | null)?.completed_at ?? null),
  };
}

export async function persistTeamDynamicsMixedScoreForContext(input: {
  context: TeamAssessmentExecutionContext;
  scoringVersion?: string;
}, deps: TeamDynamicsMixedScorePersistenceDependencies = {}): Promise<TeamDynamicsMixedScorePersistenceResult> {
  const scoringVersion =
    input.scoringVersion ?? TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION;

  if (!isNonEmptyString(scoringVersion)) {
    return persistFail("invalid_payload", "scoringVersion is required.");
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const loadScoreForContext =
    deps.loadScoreForContext ?? loadTeamDynamicsMixedScoreForContext;
  const score = await loadScoreForContext({
    context: input.context,
  });

  if (!canPersistScoreStatus(score.status)) {
    return persistFail(
      "score_not_persistable",
      "Team Dynamics mixed-format score is not in a persistable completed-state status.",
      score,
    );
  }

  const sourceCompletedAtResult = await loadSourceCompletedAt({
    attemptId: input.context.attemptId,
    supabase,
  });

  if (!sourceCompletedAtResult.ok) {
    return persistFail("load_attempt_failed", sourceCompletedAtResult.reason, score);
  }

  const calculatedAt = new Date().toISOString();
  const patch = buildScoreSnapshotPatch({
    context: input.context,
    scoringVersion,
    score,
    sourceCompletedAt: sourceCompletedAtResult.completedAt,
    calculatedAt,
  });

  const { data: existingRowData, error: existingRowError } = await supabase
    .from("team_assessment_participant_scores")
    .select("id")
    .eq("team_assessment_participant_id", input.context.teamAssessmentParticipantId)
    .eq("scoring_version", scoringVersion)
    .maybeSingle();

  if (existingRowError) {
    return persistFail(
      "load_existing_failed",
      `Unable to inspect existing Team Dynamics mixed member score snapshot: ${existingRowError.message}`,
      score,
    );
  }

  const existingRow = (existingRowData as { id: string } | null) ?? null;

  if (existingRow) {
    const { data: updatedRowData, error: updatedRowError } = await supabase
      .from("team_assessment_participant_scores")
      .update(patch)
      .eq("id", existingRow.id)
      .select(
        "id, team_assessment_participant_id, attempt_id, scoring_version, scoring_status, score_snapshot, source_completed_at, calculated_at",
      )
      .single();

    if (updatedRowError || !updatedRowData) {
      return persistFail(
        "update_failed",
        `Unable to update Team Dynamics mixed member score snapshot: ${updatedRowError?.message ?? "Unknown error"}`,
        score,
      );
    }

    const updatedRow = updatedRowData as TeamAssessmentParticipantScoreRow;
    return {
      ok: true,
      mode: "updated",
      value: {
        id: updatedRow.id,
        teamAssessmentParticipantId: updatedRow.team_assessment_participant_id,
        attemptId: updatedRow.attempt_id,
        scoringVersion: updatedRow.scoring_version,
        scoringStatus: updatedRow.scoring_status as TeamDynamicsMixedScoreResult["status"],
        calculatedAt: updatedRow.calculated_at,
        sourceCompletedAt: updatedRow.source_completed_at,
        score: updatedRow.score_snapshot,
      },
    };
  }

  const { data: insertedRowData, error: insertedRowError } = await supabase
    .from("team_assessment_participant_scores")
    .insert(patch)
    .select(
      "id, team_assessment_participant_id, attempt_id, scoring_version, scoring_status, score_snapshot, source_completed_at, calculated_at",
    )
    .single();

  if (insertedRowError || !insertedRowData) {
    return persistFail(
      "insert_failed",
      `Unable to persist Team Dynamics mixed member score snapshot: ${insertedRowError?.message ?? "Unknown error"}`,
      score,
    );
  }

  const insertedRow = insertedRowData as TeamAssessmentParticipantScoreRow;
  return {
    ok: true,
    mode: "inserted",
    value: {
      id: insertedRow.id,
      teamAssessmentParticipantId: insertedRow.team_assessment_participant_id,
      attemptId: insertedRow.attempt_id,
      scoringVersion: insertedRow.scoring_version,
      scoringStatus: insertedRow.scoring_status as TeamDynamicsMixedScoreResult["status"],
      calculatedAt: insertedRow.calculated_at,
      sourceCompletedAt: insertedRow.source_completed_at,
      score: insertedRow.score_snapshot,
    },
  };
}

export async function persistTeamDynamicsMixedScore(input: {
  userId: string;
  teamAssessmentParticipantId: string;
  scoringVersion?: string;
}, deps: TeamDynamicsMixedScorePersistenceDependencies = {}): Promise<TeamDynamicsMixedScorePersistenceResult> {
  if (!isNonEmptyString(input.teamAssessmentParticipantId)) {
    return persistFail(
      "invalid_payload",
      "teamAssessmentParticipantId is required.",
    );
  }

  const loadExecutionContext =
    deps.loadExecutionContext ?? loadTeamAssessmentExecutionContext;
  const contextResult = await loadExecutionContext({
    teamAssessmentParticipantId: input.teamAssessmentParticipantId,
    userId: input.userId,
  });

  if (!contextResult.ok) {
    return persistFail(contextResult.code, contextResult.message);
  }

  return persistTeamDynamicsMixedScoreForContext(
    {
      context: contextResult.context,
      scoringVersion: input.scoringVersion,
    },
    deps,
  );
}
