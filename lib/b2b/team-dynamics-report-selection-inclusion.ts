import "server-only";

import { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG } from "@/lib/assessment/team-dynamics";
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

type TeamAssessmentParticipantRow = {
  id: string;
  team_assessment_assignment_id: string;
};

type TeamAssessmentReportSelectionDraftRow = {
  id: string;
  team_assessment_assignment_id: string;
  team_id: string;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type TeamAssessmentReportSelectionMemberRow = {
  id: string;
  selection_draft_id: string;
  team_assessment_participant_id: string;
  created_at: string;
  updated_at: string;
};

type TeamDynamicsReportSelectionInclusionDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

export type TeamDynamicsReportSelectionInclusionState = {
  hasPersistedSelectionDraft: boolean;
  selectionDraftId: string | null;
  includedTeamAssessmentParticipantIds: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type TeamDynamicsReportSelectionReplaceInclusionResult = {
  selectionDraftId: string;
  teamAssessmentAssignmentId: string;
  includedTeamAssessmentParticipantIds: string[];
  createdAt: string;
  updatedAt: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => isNonEmptyString(value)))).sort();
}

async function loadTeamAndAssignment(input: {
  organizationId: string;
  teamId: string;
  teamAssessmentAssignmentId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<{
  team: TeamRow;
  assignment: TeamAssessmentAssignmentRow;
}> {
  const { data: teamData, error: teamError } = await input.supabase
    .from("teams")
    .select("id, organization_id, archived_at")
    .eq("id", input.teamId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (teamError) {
    throw new Error(
      `Failed to load team for Team Dynamics report selection inclusion state: ${teamError.message}`,
    );
  }

  const team = (teamData as TeamRow | null) ?? null;

  if (!team || team.archived_at) {
    throw new Error("Team Dynamics report selection team was not found.");
  }

  const { data: assignmentData, error: assignmentError } = await input.supabase
    .from("team_assessment_assignments")
    .select("id, team_id, package_slug")
    .eq("id", input.teamAssessmentAssignmentId)
    .eq("team_id", input.teamId)
    .eq("package_slug", TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG)
    .maybeSingle();

  if (assignmentError) {
    throw new Error(
      `Failed to load Team Dynamics report selection assignment context: ${assignmentError.message}`,
    );
  }

  const assignment = (assignmentData as TeamAssessmentAssignmentRow | null) ?? null;

  if (!assignment) {
    throw new Error("Team Dynamics report selection assignment was not found.");
  }

  return {
    team,
    assignment,
  };
}

export async function loadTeamDynamicsReportSelectionInclusionState(input: {
  organizationId: string;
  teamId: string;
  teamAssessmentAssignmentId: string;
}, deps: TeamDynamicsReportSelectionInclusionDependencies = {}): Promise<TeamDynamicsReportSelectionInclusionState> {
  if (!isNonEmptyString(input.organizationId)) {
    throw new Error("organizationId is required.");
  }

  if (!isNonEmptyString(input.teamId)) {
    throw new Error("teamId is required.");
  }

  if (!isNonEmptyString(input.teamAssessmentAssignmentId)) {
    throw new Error("teamAssessmentAssignmentId is required.");
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  await loadTeamAndAssignment({
    organizationId: input.organizationId,
    teamId: input.teamId,
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    supabase,
  });

  const { data: draftData, error: draftError } = await supabase
    .from("team_assessment_report_selection_drafts")
    .select("id, team_assessment_assignment_id, team_id, created_by_user_id, updated_by_user_id, created_at, updated_at")
    .eq("team_assessment_assignment_id", input.teamAssessmentAssignmentId)
    .maybeSingle();

  if (draftError) {
    throw new Error(
      `Failed to load Team Dynamics report selection draft: ${draftError.message}`,
    );
  }

  const draft = (draftData as TeamAssessmentReportSelectionDraftRow | null) ?? null;

  if (!draft) {
    return {
      hasPersistedSelectionDraft: false,
      selectionDraftId: null,
      includedTeamAssessmentParticipantIds: [],
      createdAt: null,
      updatedAt: null,
    };
  }

  const { data: memberData, error: memberError } = await supabase
    .from("team_assessment_report_selection_members")
    .select("id, selection_draft_id, team_assessment_participant_id, created_at, updated_at")
    .eq("selection_draft_id", draft.id);

  if (memberError) {
    throw new Error(
      `Failed to load Team Dynamics report selection included members: ${memberError.message}`,
    );
  }

  const members = (memberData ?? []) as TeamAssessmentReportSelectionMemberRow[];

  return {
    hasPersistedSelectionDraft: true,
    selectionDraftId: draft.id,
    includedTeamAssessmentParticipantIds: uniqueStrings(
      members.map((member) => member.team_assessment_participant_id),
    ),
    createdAt: draft.created_at,
    updatedAt: draft.updated_at,
  };
}

export async function replaceTeamDynamicsReportSelectionInclusionSet(input: {
  organizationId: string;
  teamId: string;
  teamAssessmentAssignmentId: string;
  includedTeamAssessmentParticipantIds: string[];
  actorUserId?: string | null;
}, deps: TeamDynamicsReportSelectionInclusionDependencies = {}): Promise<TeamDynamicsReportSelectionReplaceInclusionResult> {
  if (!isNonEmptyString(input.organizationId)) {
    throw new Error("organizationId is required.");
  }

  if (!isNonEmptyString(input.teamId)) {
    throw new Error("teamId is required.");
  }

  if (!isNonEmptyString(input.teamAssessmentAssignmentId)) {
    throw new Error("teamAssessmentAssignmentId is required.");
  }

  const includedTeamAssessmentParticipantIds = uniqueStrings(
    input.includedTeamAssessmentParticipantIds,
  );
  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const { assignment } = await loadTeamAndAssignment({
    organizationId: input.organizationId,
    teamId: input.teamId,
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    supabase,
  });

  const { data: assignmentParticipantData, error: assignmentParticipantError } = await supabase
    .from("team_assessment_participants")
    .select("id, team_assessment_assignment_id")
    .eq("team_assessment_assignment_id", input.teamAssessmentAssignmentId);

  if (assignmentParticipantError) {
    throw new Error(
      `Failed to load Team Dynamics report selection assignment participants: ${assignmentParticipantError.message}`,
    );
  }

  const assignmentParticipants =
    (assignmentParticipantData ?? []) as TeamAssessmentParticipantRow[];
  const assignmentParticipantIdSet = new Set(
    assignmentParticipants.map((participant) => participant.id),
  );

  for (const participantId of includedTeamAssessmentParticipantIds) {
    if (assignmentParticipantIdSet.has(participantId) === false) {
      throw new Error(
        `Team Dynamics report selection member ${participantId} does not belong to assignment ${input.teamAssessmentAssignmentId}.`,
      );
    }
  }

  const { data: draftData, error: draftError } = await supabase
    .from("team_assessment_report_selection_drafts")
    .select("id, team_assessment_assignment_id, team_id, created_by_user_id, updated_by_user_id, created_at, updated_at")
    .eq("team_assessment_assignment_id", input.teamAssessmentAssignmentId)
    .maybeSingle();

  if (draftError) {
    throw new Error(
      `Failed to load existing Team Dynamics report selection draft: ${draftError.message}`,
    );
  }

  const existingDraft = (draftData as TeamAssessmentReportSelectionDraftRow | null) ?? null;
  let draft: TeamAssessmentReportSelectionDraftRow;

  if (existingDraft) {
    const { data: updatedDraftData, error: updateDraftError } = await supabase
      .from("team_assessment_report_selection_drafts")
      .update({
        updated_by_user_id: input.actorUserId ?? null,
      })
      .eq("id", existingDraft.id)
      .select("id, team_assessment_assignment_id, team_id, created_by_user_id, updated_by_user_id, created_at, updated_at")
      .single();

    if (updateDraftError) {
      throw new Error(
        `Failed to update Team Dynamics report selection draft metadata: ${updateDraftError.message}`,
      );
    }

    draft = updatedDraftData as TeamAssessmentReportSelectionDraftRow;
  } else {
    const { data: insertedDraftData, error: insertDraftError } = await supabase
      .from("team_assessment_report_selection_drafts")
      .insert({
        team_assessment_assignment_id: assignment.id,
        team_id: assignment.team_id,
        created_by_user_id: input.actorUserId ?? null,
        updated_by_user_id: input.actorUserId ?? null,
      })
      .select("id, team_assessment_assignment_id, team_id, created_by_user_id, updated_by_user_id, created_at, updated_at")
      .single();

    if (insertDraftError) {
      throw new Error(
        `Failed to create Team Dynamics report selection draft: ${insertDraftError.message}`,
      );
    }

    draft = insertedDraftData as TeamAssessmentReportSelectionDraftRow;
  }

  const { error: deleteMembersError } = await supabase
    .from("team_assessment_report_selection_members")
    .delete()
    .eq("selection_draft_id", draft.id);

  if (deleteMembersError) {
    throw new Error(
      `Failed to clear Team Dynamics report selection members: ${deleteMembersError.message}`,
    );
  }

  if (includedTeamAssessmentParticipantIds.length > 0) {
    const { error: insertMembersError } = await supabase
      .from("team_assessment_report_selection_members")
      .insert(
        includedTeamAssessmentParticipantIds.map((teamAssessmentParticipantId) => ({
          selection_draft_id: draft.id,
          team_assessment_participant_id: teamAssessmentParticipantId,
        })),
      );

    if (insertMembersError) {
      throw new Error(
        `Failed to persist Team Dynamics report selection members: ${insertMembersError.message}`,
      );
    }
  }

  const { data: refreshedDraftData, error: refreshedDraftError } = await supabase
    .from("team_assessment_report_selection_drafts")
    .select("id, team_assessment_assignment_id, team_id, created_by_user_id, updated_by_user_id, created_at, updated_at")
    .eq("id", draft.id)
    .single();

  if (refreshedDraftError) {
    throw new Error(
      `Failed to reload Team Dynamics report selection draft after save: ${refreshedDraftError.message}`,
    );
  }

  const refreshedDraft = refreshedDraftData as TeamAssessmentReportSelectionDraftRow;

  return {
    selectionDraftId: refreshedDraft.id,
    teamAssessmentAssignmentId: refreshedDraft.team_assessment_assignment_id,
    includedTeamAssessmentParticipantIds,
    createdAt: refreshedDraft.created_at,
    updatedAt: refreshedDraft.updated_at,
  };
}
