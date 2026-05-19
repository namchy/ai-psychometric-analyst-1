import "server-only";

import { TEAM_DYNAMICS_TEST_SLUG } from "@/lib/assessment/team-dynamics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type TeamSummaryActiveAssessment = {
  assignmentId: string;
  status: "active";
  openedAt: string | null;
  updatedAt: string;
  invitedCount: number;
  completedCount: number;
};

export type TeamSummary = {
  teamId: string;
  name: string;
  description: string | null;
  activeMemberCount: number;
  createdAt: string;
  updatedAt: string;
  activeAssessment: TeamSummaryActiveAssessment | null;
};

type TeamRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type TeamMembershipCountRow = {
  team_id: string;
};

type TeamAssignmentRow = {
  id: string;
  team_id: string;
  status: "active";
  opened_at: string | null;
  created_at: string;
  updated_at: string;
};

type TeamAssessmentParticipantStatusRow = {
  team_assessment_assignment_id: string;
  status: "invited" | "started" | "completed" | "expired";
};

export function buildTeamSummaries(input: {
  teams: TeamRow[];
  activeMemberships: TeamMembershipCountRow[];
  activeAssignments: TeamAssignmentRow[];
  activeAssignmentParticipants: TeamAssessmentParticipantStatusRow[];
}): TeamSummary[] {
  const activeMemberCountByTeamId = input.activeMemberships.reduce((counts, membership) => {
    counts.set(membership.team_id, (counts.get(membership.team_id) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  const latestAssignmentByTeamId = new Map<string, TeamAssignmentRow>();

  for (const assignment of input.activeAssignments) {
    const existingAssignment = latestAssignmentByTeamId.get(assignment.team_id);

    if (!existingAssignment || Date.parse(assignment.created_at) > Date.parse(existingAssignment.created_at)) {
      latestAssignmentByTeamId.set(assignment.team_id, assignment);
    }
  }

  const participantRowsByAssignmentId = input.activeAssignmentParticipants.reduce((rowsByAssignmentId, row) => {
    const rows = rowsByAssignmentId.get(row.team_assessment_assignment_id) ?? [];
    rows.push(row);
    rowsByAssignmentId.set(row.team_assessment_assignment_id, rows);
    return rowsByAssignmentId;
  }, new Map<string, TeamAssessmentParticipantStatusRow[]>());

  return input.teams.map((team) => {
    const activeAssignment = latestAssignmentByTeamId.get(team.id) ?? null;
    const assignmentParticipants = activeAssignment
      ? participantRowsByAssignmentId.get(activeAssignment.id) ?? []
      : [];

    return {
      teamId: team.id,
      name: team.name,
      description: team.description,
      activeMemberCount: activeMemberCountByTeamId.get(team.id) ?? 0,
      createdAt: team.created_at,
      updatedAt: team.updated_at,
      activeAssessment: activeAssignment
        ? {
            assignmentId: activeAssignment.id,
            status: activeAssignment.status,
            openedAt: activeAssignment.opened_at,
            updatedAt: activeAssignment.updated_at,
            invitedCount: assignmentParticipants.length,
            completedCount: assignmentParticipants.filter(
              (participant) => participant.status === "completed",
            ).length,
          }
        : null,
    };
  });
}

export async function getTeamsForOrganization(
  organizationId: string,
): Promise<TeamSummary[]> {
  const supabase = createSupabaseAdminClient();
  const { data: teamData, error: teamError } = await supabase
    .from("teams")
    .select("id, name, description, created_at, updated_at")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (teamError) {
    throw new Error(`Failed to load teams for organization: ${teamError.message}`);
  }

  const teams = (teamData ?? []) as TeamRow[];

  if (teams.length === 0) {
    return [];
  }

  const teamIds = teams.map((team) => team.id);
  const { data: membershipData, error: membershipError } = await supabase
    .from("team_memberships")
    .select("team_id")
    .in("team_id", teamIds)
    .eq("is_active", true)
    .is("left_at", null);

  if (membershipError) {
    throw new Error(`Failed to load active team memberships: ${membershipError.message}`);
  }

  const { data: assignmentData, error: assignmentError } = await supabase
    .from("team_assessment_assignments")
    .select("id, team_id, status, opened_at, created_at, updated_at")
    .in("team_id", teamIds)
    .eq("package_slug", TEAM_DYNAMICS_TEST_SLUG)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (assignmentError) {
    throw new Error(`Failed to load active Team Dynamics assignments: ${assignmentError.message}`);
  }

  const activeAssignments = (assignmentData ?? []) as TeamAssignmentRow[];
  const assignmentIds = activeAssignments.map((assignment) => assignment.id);
  let assignmentParticipants: TeamAssessmentParticipantStatusRow[] = [];

  if (assignmentIds.length > 0) {
    const { data: participantData, error: participantError } = await supabase
      .from("team_assessment_participants")
      .select("team_assessment_assignment_id, status")
      .in("team_assessment_assignment_id", assignmentIds);

    if (participantError) {
      throw new Error(
        `Failed to load Team Dynamics participant aggregates: ${participantError.message}`,
      );
    }

    assignmentParticipants = (participantData ?? []) as TeamAssessmentParticipantStatusRow[];
  }

  return buildTeamSummaries({
    teams,
    activeMemberships: (membershipData ?? []) as TeamMembershipCountRow[],
    activeAssignments,
    activeAssignmentParticipants: assignmentParticipants,
  });
}
