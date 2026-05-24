import "server-only";

import { TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION } from "@/lib/assessment/team-assessment-score-persistence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamAssessmentParticipantAssignmentRow = {
  id: string;
  participant_id: string;
  attempt_id: string | null;
  status: "invited" | "started" | "completed" | "expired";
  completed_at: string | null;
};

type TeamAssessmentParticipantScoreVerificationRow = {
  id: string;
  team_assessment_participant_id: string;
  attempt_id: string;
  scoring_version: string;
  scoring_status: string;
  source_completed_at: string | null;
  calculated_at: string;
};

export type TeamAssessmentScoreVerificationRow = {
  scoreRowId: string;
  teamAssessmentParticipantId: string;
  participantId: string;
  attemptId: string;
  scoringVersion: string;
  scoringStatus: string;
  sourceCompletedAt: string | null;
  calculatedAt: string;
};

export type TeamAssessmentScoreVerificationResult = {
  teamAssessmentAssignmentId: string;
  participantCount: number;
  completedParticipantCount: number;
  scoreSnapshotCount: number;
  missingCompletedScoreParticipantIds: string[];
  scoreRows: TeamAssessmentScoreVerificationRow[];
};

type TeamAssessmentScoreVerificationDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function loadTeamAssessmentScoreVerification(input: {
  teamAssessmentAssignmentId: string;
  scoringVersion?: string;
}, deps: TeamAssessmentScoreVerificationDependencies = {}): Promise<TeamAssessmentScoreVerificationResult> {
  if (!isNonEmptyString(input.teamAssessmentAssignmentId)) {
    throw new Error("teamAssessmentAssignmentId is required.");
  }

  const scoringVersion =
    input.scoringVersion ?? TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION;

  if (!isNonEmptyString(scoringVersion)) {
    throw new Error("scoringVersion is required.");
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const { data: participantRowsData, error: participantRowsError } = await supabase
    .from("team_assessment_participants")
    .select("id, participant_id, attempt_id, status, completed_at")
    .eq("team_assessment_assignment_id", input.teamAssessmentAssignmentId)
    .order("invited_at", { ascending: true })
    .order("id", { ascending: true });

  if (participantRowsError) {
    throw new Error(
      `Failed to load Team Dynamics assignment participants for score verification: ${participantRowsError.message}`,
    );
  }

  const participantRows =
    ((participantRowsData ?? []) as TeamAssessmentParticipantAssignmentRow[]) ?? [];
  const teamAssessmentParticipantIds = participantRows.map((row) => row.id);

  let scoreRows: TeamAssessmentScoreVerificationRow[] = [];

  if (teamAssessmentParticipantIds.length > 0) {
    const { data: scoreRowsData, error: scoreRowsError } = await supabase
      .from("team_assessment_participant_scores")
      .select(
        "id, team_assessment_participant_id, attempt_id, scoring_version, scoring_status, source_completed_at, calculated_at",
      )
      .in("team_assessment_participant_id", teamAssessmentParticipantIds)
      .eq("scoring_version", scoringVersion)
      .order("calculated_at", { ascending: false })
      .order("id", { ascending: false });

    if (scoreRowsError) {
      throw new Error(
        `Failed to load Team Dynamics member score snapshots for verification: ${scoreRowsError.message}`,
      );
    }

    const participantById = new Map(
      participantRows.map((participantRow) => [participantRow.id, participantRow]),
    );

    scoreRows = ((scoreRowsData ?? []) as TeamAssessmentParticipantScoreVerificationRow[])
      .filter((row) => participantById.has(row.team_assessment_participant_id))
      .map((row) => {
        const participantRow = participantById.get(row.team_assessment_participant_id);

        if (!participantRow) {
          throw new Error(
            `Score row ${row.id} is not linked to the requested Team Dynamics assignment.`,
          );
        }

        return {
          scoreRowId: row.id,
          teamAssessmentParticipantId: row.team_assessment_participant_id,
          participantId: participantRow.participant_id,
          attemptId: row.attempt_id,
          scoringVersion: row.scoring_version,
          scoringStatus: row.scoring_status,
          sourceCompletedAt: row.source_completed_at,
          calculatedAt: row.calculated_at,
        };
      });
  }

  const completedParticipantIds = participantRows
    .filter((participantRow) => participantRow.status === "completed")
    .map((participantRow) => participantRow.id);
  const scoreRowIdsByParticipantId = new Set(
    scoreRows.map((scoreRow) => scoreRow.teamAssessmentParticipantId),
  );
  const missingCompletedScoreParticipantIds = completedParticipantIds.filter(
    (teamAssessmentParticipantId) => scoreRowIdsByParticipantId.has(teamAssessmentParticipantId) === false,
  );

  return {
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    participantCount: participantRows.length,
    completedParticipantCount: completedParticipantIds.length,
    scoreSnapshotCount: scoreRows.length,
    missingCompletedScoreParticipantIds,
    scoreRows,
  };
}
