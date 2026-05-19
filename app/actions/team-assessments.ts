"use server";

import { getActiveOrganizationForUser } from "@/lib/b2b/organizations";
import {
  createTeamDynamicsAssessmentForTeam,
  TEAM_DYNAMICS_MEMBER_MISSING_LINKED_USER,
  TEAM_DYNAMICS_TEST_NOT_READY,
  TeamDynamicsMemberMissingLinkedUserError,
  TeamDynamicsTestNotReadyError,
} from "@/lib/assessment/team-assessments";
import { requireAuthenticatedUserForAction } from "@/lib/auth/session";

export const TEAM_DYNAMICS_ACTION_TEAM_ID_REQUIRED =
  "TEAM_DYNAMICS_ACTION_TEAM_ID_REQUIRED" as const;
export const TEAM_DYNAMICS_ACTION_NO_ACTIVE_ORGANIZATION =
  "TEAM_DYNAMICS_ACTION_NO_ACTIVE_ORGANIZATION" as const;
export const TEAM_DYNAMICS_ACTION_TEAM_ACCESS_DENIED =
  "TEAM_DYNAMICS_ACTION_TEAM_ACCESS_DENIED" as const;
export const TEAM_DYNAMICS_ACTION_NO_ACTIVE_MEMBERS =
  "TEAM_DYNAMICS_ACTION_NO_ACTIVE_MEMBERS" as const;
export const TEAM_DYNAMICS_ACTION_MEMBER_MISSING_PARTICIPANT =
  "TEAM_DYNAMICS_ACTION_MEMBER_MISSING_PARTICIPANT" as const;
export const TEAM_DYNAMICS_ACTION_CREATE_FAILED =
  "TEAM_DYNAMICS_ACTION_CREATE_FAILED" as const;

export type CreateTeamDynamicsAssessmentActionErrorCode =
  | typeof TEAM_DYNAMICS_ACTION_TEAM_ID_REQUIRED
  | typeof TEAM_DYNAMICS_ACTION_NO_ACTIVE_ORGANIZATION
  | typeof TEAM_DYNAMICS_ACTION_TEAM_ACCESS_DENIED
  | typeof TEAM_DYNAMICS_ACTION_NO_ACTIVE_MEMBERS
  | typeof TEAM_DYNAMICS_ACTION_MEMBER_MISSING_PARTICIPANT
  | typeof TEAM_DYNAMICS_MEMBER_MISSING_LINKED_USER
  | typeof TEAM_DYNAMICS_TEST_NOT_READY
  | typeof TEAM_DYNAMICS_ACTION_CREATE_FAILED;

export type CreateTeamDynamicsAssessmentActionResult =
  | {
      ok: true;
      assignmentId: string;
      assignmentAction: "created" | "reused";
      participantsCreated: number;
      attemptsCreated: number;
      attemptMappingsCreated: number;
    }
  | {
      ok: false;
      code: CreateTeamDynamicsAssessmentActionErrorCode;
      message: string;
    };

function getFormDataString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function mapCreateTeamDynamicsAssessmentActionError(
  error: unknown,
): Extract<CreateTeamDynamicsAssessmentActionResult, { ok: false }> {
  if (error instanceof TeamDynamicsTestNotReadyError) {
    return {
      ok: false,
      code: TEAM_DYNAMICS_TEST_NOT_READY,
      message: error.message,
    };
  }

  if (error instanceof TeamDynamicsMemberMissingLinkedUserError) {
    return {
      ok: false,
      code: TEAM_DYNAMICS_MEMBER_MISSING_LINKED_USER,
      message: error.message,
    };
  }

  const message = error instanceof Error ? error.message : "Unable to create Team Dynamics assessment.";

  if (
    message === "Team was not found." ||
    message === "Team does not belong to the active organization." ||
    message === "Archived teams cannot start Team Dynamics assessments."
  ) {
    return {
      ok: false,
      code: TEAM_DYNAMICS_ACTION_TEAM_ACCESS_DENIED,
      message,
    };
  }

  if (message === "At least one active team membership is required.") {
    return {
      ok: false,
      code: TEAM_DYNAMICS_ACTION_NO_ACTIVE_MEMBERS,
      message,
    };
  }

  if (message.includes("is missing a linked participant.")) {
    return {
      ok: false,
      code: TEAM_DYNAMICS_ACTION_MEMBER_MISSING_PARTICIPANT,
      message,
    };
  }

  return {
    ok: false,
    code: TEAM_DYNAMICS_ACTION_CREATE_FAILED,
    message,
  };
}

export async function createTeamDynamicsAssessmentAction(
  formData: FormData,
): Promise<CreateTeamDynamicsAssessmentActionResult> {
  const user = await requireAuthenticatedUserForAction();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    return {
      ok: false,
      code: TEAM_DYNAMICS_ACTION_NO_ACTIVE_ORGANIZATION,
      message: "Active organization is not available for this user.",
    };
  }

  const teamId = getFormDataString(formData, "teamId");
  const locale = getFormDataString(formData, "locale");

  if (!teamId) {
    return {
      ok: false,
      code: TEAM_DYNAMICS_ACTION_TEAM_ID_REQUIRED,
      message: "Team id is required.",
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
      assignmentId: result.assignmentId,
      assignmentAction: result.assignmentAction,
      participantsCreated: result.participantsCreated,
      attemptsCreated: result.attemptsCreated,
      attemptMappingsCreated: result.attemptMappingsCreated,
    };
  } catch (error) {
    return mapCreateTeamDynamicsAssessmentActionError(error);
  }
}
