export const TEAM_DYNAMICS_TEST_NOT_READY = "TEAM_DYNAMICS_TEST_NOT_READY" as const;
export const TEAM_DYNAMICS_MEMBER_MISSING_LINKED_USER =
  "TEAM_DYNAMICS_MEMBER_MISSING_LINKED_USER" as const;

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
      ok: false;
      code: null;
      message: null;
      teamId: null;
    }
  | {
      ok: true;
      teamId: string;
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
      teamId: string | null;
    };

export const INITIAL_CREATE_TEAM_DYNAMICS_ASSESSMENT_ACTION_STATE: CreateTeamDynamicsAssessmentActionResult =
  {
    ok: false,
    code: null,
    message: null,
    teamId: null,
  };

export function mapCreateTeamDynamicsAssessmentActionError(
  error: unknown,
  teamId: string | null = null,
): Extract<CreateTeamDynamicsAssessmentActionResult, { ok: false }> {
  const errorCode =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : null;

  if (
    error instanceof Error &&
    (error.name === "TeamDynamicsTestNotReadyError" ||
      errorCode === TEAM_DYNAMICS_TEST_NOT_READY)
  ) {
    return {
      ok: false,
      code: TEAM_DYNAMICS_TEST_NOT_READY,
      message: error.message,
      teamId,
    };
  }

  if (
    error instanceof Error &&
    (error.name === "TeamDynamicsMemberMissingLinkedUserError" ||
      errorCode === TEAM_DYNAMICS_MEMBER_MISSING_LINKED_USER)
  ) {
    return {
      ok: false,
      code: TEAM_DYNAMICS_MEMBER_MISSING_LINKED_USER,
      message: error.message,
      teamId,
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
      teamId,
    };
  }

  if (message === "At least one active team membership is required.") {
    return {
      ok: false,
      code: TEAM_DYNAMICS_ACTION_NO_ACTIVE_MEMBERS,
      message,
      teamId,
    };
  }

  if (message.includes("is missing a linked participant.")) {
    return {
      ok: false,
      code: TEAM_DYNAMICS_ACTION_MEMBER_MISSING_PARTICIPANT,
      message,
      teamId,
    };
  }

  return {
    ok: false,
    code: TEAM_DYNAMICS_ACTION_CREATE_FAILED,
    message,
    teamId,
  };
}
