import "server-only";

import {
  isValidTeamDynamicsMixedScoreResult,
  deriveTeamDynamicsMixedScoreContractFlags,
} from "@/lib/assessment/team-dynamics-mixed-score-read";
import { TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION } from "@/lib/assessment/team-dynamics-mixed-score-persistence";
import type { TeamDynamicsMixedScoreResult } from "@/lib/assessment/team-dynamics-mixed-scoring";
import { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG } from "@/lib/assessment/team-dynamics";
import { loadTeamDynamicsReportSelectionInclusionState } from "@/lib/b2b/team-dynamics-report-selection-inclusion";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamRow = {
  id: string;
  organization_id: string;
  archived_at: string | null;
};

type TeamAssessmentAssignmentRow = {
  id: string;
  team_id: string;
  package_slug: string;
};

type TeamMembershipRow = {
  id: string;
  team_id: string;
  participant_id: string;
  role: "member" | "lead" | "observer";
  joined_at: string;
};

type ParticipantRow = {
  id: string;
  organization_id: string;
  full_name: string | null;
  email: string | null;
};

type TeamAssessmentParticipantRow = {
  id: string;
  team_assessment_assignment_id: string;
  team_membership_id: string;
  participant_id: string;
  status: "invited" | "started" | "completed" | "expired";
  invited_at: string;
  started_at: string | null;
  completed_at: string | null;
};

type TeamAssessmentParticipantScoreRow = {
  id: string;
  team_assessment_participant_id: string;
  scoring_version: string;
  scoring_status: string;
  raw_total: number | null;
  mean_raw: number | null;
  score_0_100: number | null;
  score_snapshot: unknown;
  calculated_at: string | null;
};

type TeamDynamicsSelectionBuildMemberInput = {
  teamAssessmentParticipantId: string;
  teamMembershipId: string;
  participantId: string;
  fullName: string | null;
  email: string | null;
  role: "member" | "lead" | "observer";
  status: "invited" | "started" | "completed" | "expired";
  invitedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  joinedAt: string | null;
  scoreRow: TeamAssessmentParticipantScoreRow | null;
};

export type TeamDynamicsReportSelectionScoreReadinessStatus =
  | "not_found"
  | "ready"
  | "invalid";

export type TeamDynamicsReportSelectionMember = {
  teamAssessmentParticipantId: string;
  teamMembershipId: string;
  participantId: string;
  fullName: string | null;
  email: string | null;
  role: "member" | "lead" | "observer";
  status: "invited" | "started" | "completed" | "expired";
  invitedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  joinedAt: string | null;
  scoreReadinessStatus: TeamDynamicsReportSelectionScoreReadinessStatus;
  eligibleForReport: boolean;
  blockingReason: string | null;
};

export type TeamDynamicsReportSelectionTeamSizeStatus =
  | "too_few"
  | "ideal"
  | "warning"
  | "too_many";

export type TeamDynamicsReportSelectionReadModel = {
  teamId: string;
  teamAssessmentAssignmentId: string;
  hasPersistedSelectionDraft: boolean;
  selectionDraftId: string | null;
  availableMembers: TeamDynamicsReportSelectionMember[];
  includedMembers: TeamDynamicsReportSelectionMember[];
  selectedCount: number;
  minRequiredMembers: 4;
  recommendedMaxMembers: 10;
  warningMaxMembers: 15;
  hardMaxMembers: 15;
  teamSizeStatus: TeamDynamicsReportSelectionTeamSizeStatus;
  canCreateTeamReport: boolean;
  disabledReasons: string[];
};

type TeamDynamicsReportSelectionDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

const MIN_REQUIRED_MEMBERS = 4 as const;
const RECOMMENDED_MAX_MEMBERS = 10 as const;
const WARNING_MAX_MEMBERS = 15 as const;
const HARD_MAX_MEMBERS = 15 as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function dedupeReasons(reasons: string[]): string[] {
  return Array.from(new Set(reasons.filter((reason) => isNonEmptyString(reason))));
}

function getTeamSizeStatus(selectedCount: number): TeamDynamicsReportSelectionTeamSizeStatus {
  if (selectedCount < MIN_REQUIRED_MEMBERS) {
    return "too_few";
  }

  if (selectedCount <= RECOMMENDED_MAX_MEMBERS) {
    return "ideal";
  }

  if (selectedCount <= WARNING_MAX_MEMBERS) {
    return "warning";
  }

  return "too_many";
}

function getScoreReadiness(input: {
  scoreRow: TeamAssessmentParticipantScoreRow | null;
}): {
  status: TeamDynamicsReportSelectionScoreReadinessStatus;
  blockingReason: string | null;
} {
  const scoreRow = input.scoreRow;

  if (!scoreRow) {
    return {
      status: "not_found",
      blockingReason: "member_score_snapshot_not_found",
    };
  }

  if (scoreRow.scoring_version !== TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION) {
    return {
      status: "invalid",
      blockingReason: "score_row_version_mismatch",
    };
  }

  if (scoreRow.scoring_status !== "scored") {
    return {
      status: "invalid",
      blockingReason: "score_row_not_scored",
    };
  }

  if (!isValidTeamDynamicsMixedScoreResult(scoreRow.score_snapshot)) {
    return {
      status: "invalid",
      blockingReason: "invalid_score_snapshot_shape",
    };
  }

  const scoreSnapshot = scoreRow.score_snapshot as TeamDynamicsMixedScoreResult;

  if (scoreSnapshot.status !== "scored") {
    return {
      status: "invalid",
      blockingReason: "score_snapshot_not_scored",
    };
  }

  const flags = deriveTeamDynamicsMixedScoreContractFlags({
    scoreSnapshot,
    rawTotal: scoreRow.raw_total,
    meanRaw: scoreRow.mean_raw,
    score0To100: scoreRow.score_0_100,
  });

  if (
    flags.hasTopLevelOverallScore ||
    !flags.hasTdmBlockScore ||
    !flags.hasTdmDomainScores ||
    !flags.hasPsychologicalSafetyScore ||
    !flags.hasSjtScore ||
    !flags.hasOutcomePulseScore
  ) {
    return {
      status: "invalid",
      blockingReason: "score_snapshot_contract_mismatch",
    };
  }

  return {
    status: "ready",
    blockingReason: null,
  };
}

export function buildTeamDynamicsReportSelectionReadModel(input: {
  teamId: string;
  teamAssessmentAssignmentId: string;
  members: TeamDynamicsSelectionBuildMemberInput[];
  includedTeamAssessmentParticipantIds?: string[];
  hasPersistedSelectionDraft?: boolean;
  selectionDraftId?: string | null;
}): TeamDynamicsReportSelectionReadModel {
  const members = [...input.members]
    .map((member): TeamDynamicsReportSelectionMember => {
      const scoreReadiness = getScoreReadiness({
        scoreRow: member.scoreRow,
      });
      const completionBlockingReason =
        member.status === "completed" ? null : `member_not_completed:${member.status}`;
      const blockingReason = completionBlockingReason ?? scoreReadiness.blockingReason;

      return {
        teamAssessmentParticipantId: member.teamAssessmentParticipantId,
        teamMembershipId: member.teamMembershipId,
        participantId: member.participantId,
        fullName: member.fullName,
        email: member.email,
        role: member.role,
        status: member.status,
        invitedAt: member.invitedAt,
        startedAt: member.startedAt,
        completedAt: member.completedAt,
        joinedAt: member.joinedAt,
        scoreReadinessStatus: scoreReadiness.status,
        eligibleForReport: blockingReason === null,
        blockingReason,
      };
    })
    .sort((left, right) => {
      const leftJoinedAt = left.joinedAt ? Date.parse(left.joinedAt) : 0;
      const rightJoinedAt = right.joinedAt ? Date.parse(right.joinedAt) : 0;

      if (leftJoinedAt !== rightJoinedAt) {
        return leftJoinedAt - rightJoinedAt;
      }

      return (left.fullName ?? "").localeCompare(right.fullName ?? "", "bs");
    });

  const includedIdSet =
    input.includedTeamAssessmentParticipantIds &&
    input.includedTeamAssessmentParticipantIds.length > 0
      ? new Set(input.includedTeamAssessmentParticipantIds)
      : new Set<string>();
  const includedMembers = members.filter((member) =>
    includedIdSet.has(member.teamAssessmentParticipantId),
  );
  const availableMembers = members.filter(
    (member) => includedIdSet.has(member.teamAssessmentParticipantId) === false,
  );
  const selectedCount = includedMembers.length;
  const teamSizeStatus = getTeamSizeStatus(selectedCount);
  const hasIncompleteMembers = includedMembers.some(
    (member) => member.status !== "completed",
  );
  const hasMissingScores = includedMembers.some(
    (member) => member.scoreReadinessStatus === "not_found",
  );
  const hasInvalidScores = includedMembers.some(
    (member) => member.scoreReadinessStatus === "invalid",
  );
  const disabledReasons = dedupeReasons([
    ...(selectedCount < MIN_REQUIRED_MEMBERS ? ["minimum_selected_members_not_met"] : []),
    ...(selectedCount > HARD_MAX_MEMBERS ? ["maximum_selected_members_exceeded"] : []),
    ...(hasIncompleteMembers ? ["included_members_not_completed"] : []),
    ...(hasMissingScores ? ["included_members_missing_score_snapshots"] : []),
    ...(hasInvalidScores ? ["included_members_invalid_score_snapshots"] : []),
  ]);

  return {
    teamId: input.teamId,
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    hasPersistedSelectionDraft: input.hasPersistedSelectionDraft ?? false,
    selectionDraftId: input.selectionDraftId ?? null,
    availableMembers,
    includedMembers,
    selectedCount,
    minRequiredMembers: MIN_REQUIRED_MEMBERS,
    recommendedMaxMembers: RECOMMENDED_MAX_MEMBERS,
    warningMaxMembers: WARNING_MAX_MEMBERS,
    hardMaxMembers: HARD_MAX_MEMBERS,
    teamSizeStatus,
    canCreateTeamReport: disabledReasons.length === 0,
    disabledReasons,
  };
}

export async function getTeamDynamicsReportSelectionReadModelForOrganization(input: {
  organizationId: string;
  teamId: string;
  teamAssessmentAssignmentId?: string;
}, deps: TeamDynamicsReportSelectionDependencies = {}): Promise<TeamDynamicsReportSelectionReadModel | null> {
  const supabase = deps.supabase ?? createSupabaseAdminClient();

  const { data: teamData, error: teamError } = await supabase
    .from("teams")
    .select("id, organization_id, archived_at")
    .eq("id", input.teamId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (teamError) {
    throw new Error(
      `Failed to load team for Team Dynamics report selection read model: ${teamError.message}`,
    );
  }

  const team = (teamData as TeamRow | null) ?? null;

  if (!team || team.archived_at) {
    return null;
  }

  let assignmentQuery = supabase
    .from("team_assessment_assignments")
    .select("id, team_id, package_slug")
    .eq("team_id", input.teamId)
    .eq("package_slug", TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG);

  if (isNonEmptyString(input.teamAssessmentAssignmentId)) {
    assignmentQuery = assignmentQuery.eq("id", input.teamAssessmentAssignmentId);
  } else {
    assignmentQuery = assignmentQuery
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1);
  }

  const { data: assignmentData, error: assignmentError } = await assignmentQuery.maybeSingle();

  if (assignmentError) {
    throw new Error(
      `Failed to load Team Dynamics report selection assignment: ${assignmentError.message}`,
    );
  }

  const assignment = (assignmentData as TeamAssessmentAssignmentRow | null) ?? null;

  if (!assignment) {
    return null;
  }

  const inclusionState = await loadTeamDynamicsReportSelectionInclusionState(
    {
      organizationId: input.organizationId,
      teamId: input.teamId,
      teamAssessmentAssignmentId: assignment.id,
    },
    {
      supabase,
    },
  );

  const { data: assignmentParticipantData, error: assignmentParticipantError } = await supabase
    .from("team_assessment_participants")
    .select(
      "id, team_assessment_assignment_id, team_membership_id, participant_id, status, invited_at, started_at, completed_at",
    )
    .eq("team_assessment_assignment_id", assignment.id)
    .order("invited_at", { ascending: true })
    .order("id", { ascending: true });

  if (assignmentParticipantError) {
    throw new Error(
      `Failed to load Team Dynamics report selection participants: ${assignmentParticipantError.message}`,
    );
  }

  const assignmentParticipants =
    (assignmentParticipantData ?? []) as TeamAssessmentParticipantRow[];
  const membershipIds = [...new Set(assignmentParticipants.map((row) => row.team_membership_id))];
  const participantIds = [...new Set(assignmentParticipants.map((row) => row.participant_id))];

  let memberships: TeamMembershipRow[] = [];
  if (membershipIds.length > 0) {
    const { data: membershipData, error: membershipError } = await supabase
      .from("team_memberships")
      .select("id, team_id, participant_id, role, joined_at")
      .in("id", membershipIds);

    if (membershipError) {
      throw new Error(
        `Failed to load Team Dynamics report selection memberships: ${membershipError.message}`,
      );
    }

    memberships = (membershipData ?? []) as TeamMembershipRow[];
  }

  let participants: ParticipantRow[] = [];
  if (participantIds.length > 0) {
    const { data: participantData, error: participantError } = await supabase
      .from("participants")
      .select("id, organization_id, full_name, email")
      .in("id", participantIds);

    if (participantError) {
      throw new Error(
        `Failed to load Team Dynamics report selection participant details: ${participantError.message}`,
      );
    }

    participants = (participantData ?? []) as ParticipantRow[];
  }

  let scoreRows: TeamAssessmentParticipantScoreRow[] = [];
  const teamAssessmentParticipantIds = assignmentParticipants.map((row) => row.id);

  if (teamAssessmentParticipantIds.length > 0) {
    const { data: scoreRowData, error: scoreRowError } = await supabase
      .from("team_assessment_participant_scores")
      .select(
        "id, team_assessment_participant_id, scoring_version, scoring_status, raw_total, mean_raw, score_0_100, score_snapshot, calculated_at",
      )
      .in("team_assessment_participant_id", teamAssessmentParticipantIds)
      .eq("scoring_version", TEAM_DYNAMICS_MIXED_SCORE_SCORING_VERSION);

    if (scoreRowError) {
      throw new Error(
        `Failed to load Team Dynamics report selection member score snapshots: ${scoreRowError.message}`,
      );
    }

    scoreRows = (scoreRowData ?? []) as TeamAssessmentParticipantScoreRow[];
  }

  const membershipById = new Map(memberships.map((membership) => [membership.id, membership]));
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const scoreRowByParticipantWrapperId = new Map<string, TeamAssessmentParticipantScoreRow>();

  for (const scoreRow of scoreRows) {
    if (!scoreRowByParticipantWrapperId.has(scoreRow.team_assessment_participant_id)) {
      scoreRowByParticipantWrapperId.set(scoreRow.team_assessment_participant_id, scoreRow);
    }
  }

  const members: TeamDynamicsSelectionBuildMemberInput[] = assignmentParticipants.map((row) => {
    const membership = membershipById.get(row.team_membership_id);
    const participant = participantById.get(row.participant_id);

    if (!membership) {
      throw new Error(
        `Team Dynamics report selection participant ${row.id} is missing a linked membership.`,
      );
    }

    if (membership.team_id !== input.teamId) {
      throw new Error(
        `Team Dynamics report selection participant ${row.id} does not belong to team ${input.teamId}.`,
      );
    }

    if (!participant) {
      throw new Error(
        `Team Dynamics report selection participant ${row.id} is missing a linked participant.`,
      );
    }

    if (participant.organization_id !== input.organizationId) {
      throw new Error(
        `Participant ${participant.id} does not belong to organization ${input.organizationId}.`,
      );
    }

    return {
      teamAssessmentParticipantId: row.id,
      teamMembershipId: row.team_membership_id,
      participantId: row.participant_id,
      fullName: participant.full_name,
      email: participant.email,
      role: membership.role,
      status: row.status,
      invitedAt: row.invited_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      joinedAt: membership.joined_at,
      scoreRow: scoreRowByParticipantWrapperId.get(row.id) ?? null,
    };
  });

  return buildTeamDynamicsReportSelectionReadModel({
    teamId: input.teamId,
    teamAssessmentAssignmentId: assignment.id,
    members,
    includedTeamAssessmentParticipantIds:
      inclusionState.includedTeamAssessmentParticipantIds,
    hasPersistedSelectionDraft: inclusionState.hasPersistedSelectionDraft,
    selectionDraftId: inclusionState.selectionDraftId,
  });
}
