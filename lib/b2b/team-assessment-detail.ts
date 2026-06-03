import "server-only";

import {
  TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
  TEAM_DYNAMICS_TEST_SLUG,
} from "@/lib/assessment/team-dynamics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamRow = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type TeamMembershipRow = {
  id: string;
  team_id: string;
  participant_id: string;
  role: "member" | "lead" | "observer";
  is_active: boolean;
  joined_at: string;
  left_at: string | null;
};

type ParticipantRow = {
  id: string;
  organization_id: string;
  full_name: string | null;
  email: string | null;
  status: string;
};

type ActiveMembershipDetailRow = TeamMembershipRow & {
  participant: ParticipantRow;
};

type TeamAssessmentAssignmentRow = {
  id: string;
  team_id: string;
  package_slug: string;
  status: "draft" | "active" | "closed" | "ready_for_report" | "reported" | "cancelled";
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
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

type TeamAssessmentParticipantDetailRow = TeamAssessmentParticipantRow & {
  participant: ParticipantRow;
  membership: TeamMembershipRow;
};

export type TeamAssessmentDetailParticipant = {
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
};

export type TeamAssessmentDetailAssignment = {
  assignmentId: string;
  packageSlug: string;
  status: "draft" | "active" | "closed" | "ready_for_report" | "reported" | "cancelled";
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  invitedCount: number;
  completedCount: number;
  participants: TeamAssessmentDetailParticipant[];
};

export type TeamAssessmentDetail = {
  teamId: string;
  name: string;
  description: string | null;
  activeMemberCount: number;
  createdAt: string;
  updatedAt: string;
  latestAssignment: TeamAssessmentDetailAssignment | null;
  latestFinalAssignment: TeamAssessmentDetailAssignment | null;
};

export function buildTeamAssessmentDetail(input: {
  organizationId: string;
  team: TeamRow;
  activeMemberships: ActiveMembershipDetailRow[];
  latestAssignment: TeamAssessmentAssignmentRow | null;
  latestFinalAssignment?: TeamAssessmentAssignmentRow | null;
  assignmentParticipants?: TeamAssessmentParticipantDetailRow[];
}): TeamAssessmentDetail {
  if (input.team.organization_id !== input.organizationId) {
    throw new Error("Team does not belong to the active organization.");
  }

  if (input.team.archived_at) {
    throw new Error("Archived teams cannot be opened in Team Dynamics admin detail.");
  }

  for (const membership of input.activeMemberships) {
    if (!membership.is_active || membership.left_at) {
      throw new Error(`Membership ${membership.id} is not active.`);
    }

    const participant = membership.participant;

    if (participant.organization_id !== input.organizationId) {
      throw new Error(
        `Participant ${participant.id} does not belong to organization ${input.organizationId}.`,
      );
    }
  }

  const assignmentParticipants = (input.assignmentParticipants ?? []).map((row) => {
    const membership = row.membership;
    const participant = row.participant;

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
    };
  });

  assignmentParticipants.sort((left, right) => {
    const leftJoinedAt = left.joinedAt ? Date.parse(left.joinedAt) : 0;
    const rightJoinedAt = right.joinedAt ? Date.parse(right.joinedAt) : 0;

    if (leftJoinedAt !== rightJoinedAt) {
      return leftJoinedAt - rightJoinedAt;
    }

    return (left.fullName ?? "").localeCompare(right.fullName ?? "", "bs");
  });

  return {
    teamId: input.team.id,
    name: input.team.name,
    description: input.team.description,
    activeMemberCount: input.activeMemberships.length,
    createdAt: input.team.created_at,
    updatedAt: input.team.updated_at,
    latestAssignment: input.latestAssignment
      ? {
          assignmentId: input.latestAssignment.id,
          packageSlug: input.latestAssignment.package_slug,
          status: input.latestAssignment.status,
          openedAt: input.latestAssignment.opened_at,
          closedAt: input.latestAssignment.closed_at,
          createdAt: input.latestAssignment.created_at,
          updatedAt: input.latestAssignment.updated_at,
          invitedCount: assignmentParticipants.length,
          completedCount: assignmentParticipants.filter(
            (participant) => participant.status === "completed",
          ).length,
          participants: assignmentParticipants,
        }
      : null,
    latestFinalAssignment: input.latestFinalAssignment
      ? {
          assignmentId: input.latestFinalAssignment.id,
          packageSlug: input.latestFinalAssignment.package_slug,
          status: input.latestFinalAssignment.status,
          openedAt: input.latestFinalAssignment.opened_at,
          closedAt: input.latestFinalAssignment.closed_at,
          createdAt: input.latestFinalAssignment.created_at,
          updatedAt: input.latestFinalAssignment.updated_at,
          invitedCount:
            input.latestAssignment?.id === input.latestFinalAssignment.id
              ? assignmentParticipants.length
              : 0,
          completedCount:
            input.latestAssignment?.id === input.latestFinalAssignment.id
              ? assignmentParticipants.filter(
                  (participant) => participant.status === "completed",
                ).length
              : 0,
          participants:
            input.latestAssignment?.id === input.latestFinalAssignment.id
              ? assignmentParticipants
              : [],
        }
      : null,
  };
}

export async function getTeamAssessmentDetailForOrganization(input: {
  organizationId: string;
  teamId: string;
}): Promise<TeamAssessmentDetail | null> {
  const supabase = createSupabaseAdminClient();
  const { data: teamData, error: teamError } = await supabase
    .from("teams")
    .select("id, organization_id, name, description, created_at, updated_at, archived_at")
    .eq("id", input.teamId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (teamError) {
    throw new Error(`Failed to load team for Team Dynamics admin detail: ${teamError.message}`);
  }

  const team = (teamData as TeamRow | null) ?? null;

  if (!team || team.archived_at) {
    return null;
  }

  const { data: membershipData, error: membershipError } = await supabase
    .from("team_memberships")
    .select("id, team_id, participant_id, role, is_active, joined_at, left_at")
    .eq("team_id", input.teamId)
    .eq("is_active", true)
    .is("left_at", null)
    .order("joined_at", { ascending: true })
    .order("id", { ascending: true });

  if (membershipError) {
    throw new Error(
      `Failed to load active team memberships for Team Dynamics admin detail: ${membershipError.message}`,
    );
  }

  const activeMemberships = (membershipData ?? []) as TeamMembershipRow[];
  const membershipParticipantIds = [...new Set(activeMemberships.map((membership) => membership.participant_id))];
  let activeMembershipDetails: ActiveMembershipDetailRow[] = [];

  if (membershipParticipantIds.length > 0) {
    const { data: participantData, error: participantError } = await supabase
      .from("participants")
      .select("id, organization_id, full_name, email, status")
      .in("id", membershipParticipantIds);

    if (participantError) {
      throw new Error(
        `Failed to load participants for Team Dynamics admin detail: ${participantError.message}`,
      );
    }

    const participantById = new Map(
      ((participantData ?? []) as ParticipantRow[]).map((participant) => [participant.id, participant]),
    );

    activeMembershipDetails = activeMemberships.map((membership) => {
      const participant = participantById.get(membership.participant_id);

      if (!participant) {
        throw new Error(`Membership ${membership.id} is missing a linked participant.`);
      }

      return {
        ...membership,
        participant,
      };
    });
  }

  const { data: assignmentData, error: assignmentError } = await supabase
    .from("team_assessment_assignments")
    .select("id, team_id, package_slug, status, opened_at, closed_at, created_at, updated_at")
    .eq("team_id", input.teamId)
    .in("package_slug", [
      TEAM_DYNAMICS_TEST_SLUG,
      TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
    ])
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (assignmentError) {
    throw new Error(
      `Failed to load Team Dynamics assignment for team admin detail: ${assignmentError.message}`,
    );
  }

  const assignments = (assignmentData ?? []) as TeamAssessmentAssignmentRow[];
  const latestAssignment = assignments[0] ?? null;
  const latestFinalAssignment =
    assignments.find(
      (assignment) => assignment.package_slug === TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
    ) ?? null;
  let assignmentParticipants: TeamAssessmentParticipantDetailRow[] = [];

  if (latestAssignment?.id) {
    const { data: participantData, error: participantError } = await supabase
      .from("team_assessment_participants")
      .select("id, team_assessment_assignment_id, team_membership_id, participant_id, status, invited_at, started_at, completed_at")
      .eq("team_assessment_assignment_id", latestAssignment.id)
      .order("invited_at", { ascending: true })
      .order("id", { ascending: true });

    if (participantError) {
      throw new Error(
        `Failed to load Team Dynamics assignment participants: ${participantError.message}`,
      );
    }

    const assignmentParticipantRows = (participantData ?? []) as TeamAssessmentParticipantRow[];
    const membershipById = new Map(activeMembershipDetails.map((membership) => [membership.id, membership]));

    assignmentParticipants = assignmentParticipantRows.map((row) => {
      const membership = membershipById.get(row.team_membership_id);

      if (!membership) {
        throw new Error(`Team assessment participant ${row.id} is missing a linked membership.`);
      }

      if (membership.participant.id !== row.participant_id) {
        throw new Error(
          `Team assessment participant ${row.id} is not linked to the expected participant.`,
        );
      }

      return {
        ...row,
        membership,
        participant: membership.participant,
      };
    });
  }

  return buildTeamAssessmentDetail({
    organizationId: input.organizationId,
    team,
    activeMemberships: activeMembershipDetails,
    latestAssignment,
    latestFinalAssignment,
    assignmentParticipants,
  });
}
