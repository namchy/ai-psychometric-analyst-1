"use server";

import { getActiveOrganizationForUser } from "@/lib/b2b/organizations";
import { createTeamDynamicsAssessmentForTeam } from "@/lib/assessment/team-assessments";
import {
  INITIAL_CREATE_TEAM_DYNAMICS_ASSESSMENT_ACTION_STATE,
  type CreateTeamDynamicsAssessmentActionResult,
  mapCreateTeamDynamicsAssessmentActionError,
  TEAM_DYNAMICS_ACTION_NO_ACTIVE_ORGANIZATION,
  TEAM_DYNAMICS_ACTION_TEAM_ID_REQUIRED,
} from "@/lib/assessment/team-dynamics-action-contract";
import { requireAuthenticatedUserForAction } from "@/lib/auth/session";

function getFormDataString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createTeamDynamicsAssessmentAction(
  previousStateOrFormData:
    | CreateTeamDynamicsAssessmentActionResult
    | FormData,
  maybeFormData?: FormData,
): Promise<CreateTeamDynamicsAssessmentActionResult> {
  const formData =
    previousStateOrFormData instanceof FormData
      ? previousStateOrFormData
      : maybeFormData;

  if (!formData) {
    return INITIAL_CREATE_TEAM_DYNAMICS_ASSESSMENT_ACTION_STATE;
  }

  const user = await requireAuthenticatedUserForAction();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    return {
      ok: false,
      code: TEAM_DYNAMICS_ACTION_NO_ACTIVE_ORGANIZATION,
      message: "Active organization is not available for this user.",
      teamId: null,
    };
  }

  const teamId = getFormDataString(formData, "teamId");
  const locale = getFormDataString(formData, "locale");

  if (!teamId) {
    return {
      ok: false,
      code: TEAM_DYNAMICS_ACTION_TEAM_ID_REQUIRED,
      message: "Team id is required.",
      teamId: null,
    };
  }

  try {
    const result = await createTeamDynamicsAssessmentForTeam({
      organizationId: organization.id,
      teamId,
      createdByUserId: user.id,
      locale: locale || null,
      requireLinkedUsers: true,
    });

    return {
      ok: true,
      teamId,
      assignmentId: result.assignmentId,
      assignmentAction: result.assignmentAction,
      participantsCreated: result.participantsCreated,
      attemptsCreated: result.attemptsCreated,
      attemptMappingsCreated: result.attemptMappingsCreated,
    };
  } catch (error) {
    return mapCreateTeamDynamicsAssessmentActionError(error, teamId);
  }
}
