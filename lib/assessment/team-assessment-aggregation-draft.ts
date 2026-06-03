import "server-only";

import {
  loadTeamAssessmentScoreVerification,
  type TeamAssessmentScoreVerificationResult,
} from "@/lib/assessment/team-assessment-score-read";
import { TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION } from "@/lib/assessment/team-assessment-score-persistence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamAssessmentParticipantStatusRow = {
  id: string;
  status: "invited" | "started" | "completed" | "expired";
};

type TeamAssessmentParticipantScoreValueRow = {
  id: string;
  team_assessment_participant_id: string;
  score_0_100: number | null;
};

export type TeamAssessmentAggregationDraftReadinessStatus = "ready" | "not_ready";

export type TeamAssessmentAggregationDraftResult = {
  teamAssessmentAssignmentId: string;
  participantCount: number;
  completedParticipantCount: number;
  scoreSnapshotCount: number;
  missingCompletedScoreParticipantIds: string[];
  includedScoreCount: number;
  excludedScoreCount: number;
  score0To100Values: number[];
  meanScore0To100: number | null;
  minScore0To100: number | null;
  maxScore0To100: number | null;
  rangeScore0To100: number | null;
  aggregationReadinessStatus: TeamAssessmentAggregationDraftReadinessStatus;
  reasons: string[];
};

type TeamAssessmentAggregationDraftDependencies = {
  loadScoreVerification?: typeof loadTeamAssessmentScoreVerification;
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildReasons(input: {
  completedParticipantCount: number;
  scoreSnapshotCount: number;
  missingCompletedScoreParticipantIds: string[];
  includedScoreCount: number;
  completedScoreRowsMissingValueCount: number;
}): string[] {
  const reasons: string[] = [];

  if (input.completedParticipantCount === 0) {
    reasons.push("no_completed_participants");
  }

  if (input.completedParticipantCount > 0 && input.scoreSnapshotCount === 0) {
    reasons.push("no_completed_score_snapshots");
  }

  if (input.missingCompletedScoreParticipantIds.length > 0) {
    reasons.push("missing_completed_score_snapshots");
  }

  if (input.completedScoreRowsMissingValueCount > 0) {
    reasons.push("completed_score_snapshot_missing_score_value");
  }

  if (input.includedScoreCount === 0) {
    reasons.push("no_included_completed_scores");
  }

  return reasons;
}

export async function loadTeamAssessmentAggregationDraft(input: {
  teamAssessmentAssignmentId: string;
  scoringVersion?: string;
}, deps: TeamAssessmentAggregationDraftDependencies = {}): Promise<TeamAssessmentAggregationDraftResult> {
  if (!isNonEmptyString(input.teamAssessmentAssignmentId)) {
    throw new Error("teamAssessmentAssignmentId is required.");
  }

  const scoringVersion =
    input.scoringVersion ?? TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION;

  if (!isNonEmptyString(scoringVersion)) {
    throw new Error("scoringVersion is required.");
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const loadScoreVerification =
    deps.loadScoreVerification ?? loadTeamAssessmentScoreVerification;
  const verification = await loadScoreVerification(
    {
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
      scoringVersion,
    },
    {
      supabase,
    },
  );

  const { data: participantStatusRowsData, error: participantStatusRowsError } = await supabase
    .from("team_assessment_participants")
    .select("id, status")
    .eq("team_assessment_assignment_id", input.teamAssessmentAssignmentId);

  if (participantStatusRowsError) {
    throw new Error(
      `Failed to load Team Dynamics assignment participant statuses for aggregation draft: ${participantStatusRowsError.message}`,
    );
  }

  const participantStatusRows =
    ((participantStatusRowsData ?? []) as TeamAssessmentParticipantStatusRow[]) ?? [];
  const completedParticipantIds = new Set(
    participantStatusRows
      .filter((participantRow) => participantRow.status === "completed")
      .map((participantRow) => participantRow.id),
  );
  const verificationScoreRowIds = verification.scoreRows.map((scoreRow) => scoreRow.scoreRowId);

  let scoreValueRows: TeamAssessmentParticipantScoreValueRow[] = [];

  if (verificationScoreRowIds.length > 0) {
    const { data: scoreValueRowsData, error: scoreValueRowsError } = await supabase
      .from("team_assessment_participant_scores")
      .select("id, team_assessment_participant_id, score_0_100")
      .in("id", verificationScoreRowIds)
      .eq("scoring_version", scoringVersion);

    if (scoreValueRowsError) {
      throw new Error(
        `Failed to load Team Dynamics score values for aggregation draft: ${scoreValueRowsError.message}`,
      );
    }

    scoreValueRows =
      ((scoreValueRowsData ?? []) as TeamAssessmentParticipantScoreValueRow[]) ?? [];
  }

  const scoreValueByRowId = new Map(
    scoreValueRows.map((scoreValueRow) => [scoreValueRow.id, scoreValueRow]),
  );
  const score0To100Values: number[] = [];
  let completedScoreRowsMissingValueCount = 0;
  let excludedScoreCount = 0;

  for (const scoreRow of verification.scoreRows) {
    if (!completedParticipantIds.has(scoreRow.teamAssessmentParticipantId)) {
      excludedScoreCount += 1;
      continue;
    }

    const scoreValueRow = scoreValueByRowId.get(scoreRow.scoreRowId);

    if (scoreValueRow && isFiniteNumber(scoreValueRow.score_0_100)) {
      score0To100Values.push(scoreValueRow.score_0_100);
      continue;
    }

    excludedScoreCount += 1;
    completedScoreRowsMissingValueCount += 1;
  }

  score0To100Values.sort((left, right) => left - right);

  const includedScoreCount = score0To100Values.length;
  const reasons = buildReasons({
    completedParticipantCount: verification.completedParticipantCount,
    scoreSnapshotCount: verification.scoreSnapshotCount,
    missingCompletedScoreParticipantIds: verification.missingCompletedScoreParticipantIds,
    includedScoreCount,
    completedScoreRowsMissingValueCount,
  });
  const minScore0To100 =
    includedScoreCount > 0 ? score0To100Values[0] : null;
  const maxScore0To100 =
    includedScoreCount > 0 ? score0To100Values[includedScoreCount - 1] : null;
  const meanScore0To100 =
    includedScoreCount > 0
      ? roundTo2(
          score0To100Values.reduce((sum, value) => sum + value, 0) / includedScoreCount,
        )
      : null;
  const rangeScore0To100 =
    minScore0To100 !== null && maxScore0To100 !== null
      ? roundTo2(maxScore0To100 - minScore0To100)
      : null;

  return {
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    participantCount: verification.participantCount,
    completedParticipantCount: verification.completedParticipantCount,
    scoreSnapshotCount: verification.scoreSnapshotCount,
    missingCompletedScoreParticipantIds: verification.missingCompletedScoreParticipantIds,
    includedScoreCount,
    excludedScoreCount,
    score0To100Values,
    meanScore0To100,
    minScore0To100,
    maxScore0To100,
    rangeScore0To100,
    aggregationReadinessStatus: reasons.length === 0 ? "ready" : "not_ready",
    reasons,
  };
}
