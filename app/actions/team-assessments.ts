"use server";

import { getActiveOrganizationForUser } from "@/lib/b2b/organizations";
import { createTeamDynamicsAssessmentForTeam } from "@/lib/assessment/team-assessments";
import {
  loadTeamAssessmentExecutionContext,
  loadTeamAssessmentQuestionOutline,
  loadTeamAssessmentUiOnlyItems,
  resolveTeamAssessmentExecutionShellState,
  transitionTeamAssessmentExecutionToCompleted,
  type TeamAssessmentExecutionCompletionTransitionResult,
  type TeamAssessmentExecutionContextResult,
  type TeamAssessmentQuestionOutline,
} from "@/lib/assessment/team-assessment-execution";
import {
  loadTeamAssessmentCompletionReadinessForContext,
  persistValidatedTeamAssessmentAnswer,
  type TeamAssessmentAnswerPayload,
  type TeamAssessmentAnswerPersistenceResult,
  type TeamAssessmentCompletionReadiness,
} from "@/lib/assessment/team-assessment-responses";
import {
  normalizeAssessmentLocale,
  type AssessmentLocale,
} from "@/lib/assessment/locale";
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

export type SaveTeamAssessmentAnswerActionInput = {
  teamAssessmentParticipantId: string;
  questionId: string;
  optionId: string;
  locale: AssessmentLocale;
  clientTimestamp?: string;
};

export type SaveTeamAssessmentAnswerActionResult =
  | {
      ok: true;
      mode: "saved" | "overwritten" | "unchanged";
    }
  | {
      ok: false;
      code: string;
      reason: string;
    };

type SaveTeamAssessmentAnswerActionDependencies = {
  requireUser?: typeof requireAuthenticatedUserForAction;
  loadExecutionContext?: typeof loadTeamAssessmentExecutionContext;
  persistAnswer?: (
    input: {
      userId: string;
      payload: TeamAssessmentAnswerPayload;
    },
  ) => Promise<TeamAssessmentAnswerPersistenceResult>;
};

export type CompleteTeamAssessmentActionInput = {
  teamAssessmentParticipantId: string;
};

export type CompleteTeamAssessmentActionResult =
  | {
      ok: true;
      mode: "completed" | "already_completed";
      completionReadiness: TeamAssessmentCompletionReadiness;
    }
  | {
      ok: false;
      code: string;
      reason: string;
      completionReadiness?: TeamAssessmentCompletionReadiness;
    };

type CompleteTeamAssessmentActionDependencies = {
  requireUser?: typeof requireAuthenticatedUserForAction;
  loadExecutionContext?: typeof loadTeamAssessmentExecutionContext;
  loadQuestionOutline?: (input: {
    testId: string;
    locale?: AssessmentLocale | null;
  }) => Promise<TeamAssessmentQuestionOutline>;
  loadUiOnlyItems?: typeof loadTeamAssessmentUiOnlyItems;
  resolveShellState?: typeof resolveTeamAssessmentExecutionShellState;
  loadCompletionReadiness?: typeof loadTeamAssessmentCompletionReadinessForContext;
  transitionCompletion?: (
    input: {
      context: Extract<TeamAssessmentExecutionContextResult, { ok: true }>["context"];
      completedAt?: string;
    },
  ) => Promise<TeamAssessmentExecutionCompletionTransitionResult>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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

export async function saveTeamAssessmentAnswerAction(
  input: SaveTeamAssessmentAnswerActionInput,
  deps: SaveTeamAssessmentAnswerActionDependencies = {},
): Promise<SaveTeamAssessmentAnswerActionResult> {
  if (
    !isNonEmptyString(input.teamAssessmentParticipantId) ||
    !isNonEmptyString(input.questionId) ||
    !isNonEmptyString(input.optionId)
  ) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: "teamAssessmentParticipantId, questionId and optionId are required.",
    };
  }

  const requireUser = deps.requireUser ?? requireAuthenticatedUserForAction;
  const loadExecutionContext =
    deps.loadExecutionContext ?? loadTeamAssessmentExecutionContext;
  const persistAnswer = deps.persistAnswer ?? persistValidatedTeamAssessmentAnswer;
  const user = await requireUser();
  const contextResult = await loadExecutionContext({
    teamAssessmentParticipantId: input.teamAssessmentParticipantId,
    userId: user.id,
  });

  if (!contextResult.ok) {
    return {
      ok: false,
      code: contextResult.code,
      reason: contextResult.message,
    };
  }

  const result = await persistAnswer({
    userId: user.id,
    payload: {
      teamAssessmentParticipantId: input.teamAssessmentParticipantId,
      attemptId: contextResult.context.attemptId,
      questionId: input.questionId,
      optionId: input.optionId,
      responseFormat: "single_select_likert",
      locale: normalizeAssessmentLocale(input.locale),
      ...(input.clientTimestamp
        ? {
            clientTimestamp: input.clientTimestamp,
          }
        : {}),
    },
  });

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      reason: result.reason,
    };
  }

  return {
    ok: true,
    mode: result.mode,
  };
}

export async function completeTeamAssessmentAction(
  input: CompleteTeamAssessmentActionInput,
  deps: CompleteTeamAssessmentActionDependencies = {},
): Promise<CompleteTeamAssessmentActionResult> {
  if (!isNonEmptyString(input.teamAssessmentParticipantId)) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: "teamAssessmentParticipantId is required.",
    };
  }

  const requireUser = deps.requireUser ?? requireAuthenticatedUserForAction;
  const loadExecutionContext = deps.loadExecutionContext ?? loadTeamAssessmentExecutionContext;
  const loadQuestionOutline = deps.loadQuestionOutline ?? loadTeamAssessmentQuestionOutline;
  const loadUiOnlyItems = deps.loadUiOnlyItems ?? loadTeamAssessmentUiOnlyItems;
  const resolveShellState = deps.resolveShellState ?? resolveTeamAssessmentExecutionShellState;
  const loadCompletionReadiness =
    deps.loadCompletionReadiness ?? loadTeamAssessmentCompletionReadinessForContext;
  const transitionCompletion =
    deps.transitionCompletion ?? transitionTeamAssessmentExecutionToCompleted;
  const user = await requireUser();
  const contextResult = await loadExecutionContext({
    teamAssessmentParticipantId: input.teamAssessmentParticipantId,
    userId: user.id,
  });

  if (!contextResult.ok) {
    return {
      ok: false,
      code: contextResult.code,
      reason: contextResult.message,
    };
  }

  if (
    contextResult.context.wrapperStatus === "completed" &&
    contextResult.context.attemptStatus === "completed"
  ) {
    return {
      ok: true,
      mode: "already_completed",
      completionReadiness: {
        supportedQuestionCount: 0,
        savedValidAnswerCount: 0,
        missingQuestionIds: [],
        invalidSavedAnswerCount: 0,
        isReadyForCompletion: false,
        readinessStatus: "no_supported_items",
      },
    };
  }

  if (contextResult.context.wrapperStatus !== "started") {
    return {
      ok: false,
      code: "wrapper_not_completable",
      reason: "Team Dynamics wrapper must be started before completion is allowed.",
    };
  }

  if (contextResult.context.attemptStatus !== "in_progress") {
    return {
      ok: false,
      code: "attempt_not_completable",
      reason: "Linked Team Dynamics attempt must be in_progress before completion is allowed.",
    };
  }

  const questionOutline = await loadQuestionOutline({
    testId: contextResult.context.test.id,
    locale: contextResult.context.locale,
  });
  const uiOnlyItems = await loadUiOnlyItems({
    testId: contextResult.context.test.id,
    questionOutline,
    locale: contextResult.context.locale,
  });
  const completionReadiness = await loadCompletionReadiness({
    context: contextResult.context,
    shellState: resolveShellState({
      route: "run",
      wrapperStatus: contextResult.context.wrapperStatus,
    }),
    uiOnlyItems: uiOnlyItems.items,
  });

  if (
    completionReadiness.isReadyForCompletion === false ||
    completionReadiness.readinessStatus !== "ready"
  ) {
    return {
      ok: false,
      code: "not_ready",
      reason: "Team Dynamics completion readiness is not satisfied.",
      completionReadiness,
    };
  }

  const completionResult = await transitionCompletion({
    context: contextResult.context,
  });

  if (!completionResult.ok) {
    return {
      ok: false,
      code: completionResult.code,
      reason: completionResult.reason,
      completionReadiness,
    };
  }

  return {
    ok: true,
    mode: completionResult.mode,
    completionReadiness,
  };
}
