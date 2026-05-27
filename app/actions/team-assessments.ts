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
  persistTeamAssessmentMinimalScoreForContext,
  TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
  type TeamAssessmentMinimalScorePersistenceFailureCode,
  type TeamAssessmentMinimalScorePersistenceResult,
} from "@/lib/assessment/team-assessment-score-persistence";
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
import {
  persistValidatedTeamDynamicsMixedAnswer,
  type TeamDynamicsMixedAnswerPersistenceResult,
} from "@/lib/assessment/team-dynamics-mixed-answer-persistence";
import type { TeamDynamicsMixedAnswerPayload } from "@/lib/assessment/team-dynamics-mixed-answer-payload-validator";
import {
  loadTeamDynamicsMixedCompletionReadinessForContext,
  type TeamDynamicsMixedCompletionReadiness,
} from "@/lib/assessment/team-dynamics-mixed-completion-readiness";
import { loadTeamDynamicsMixedRuntimeHandoff } from "@/lib/assessment/team-dynamics-mixed-runtime";
import { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG } from "@/lib/assessment/team-dynamics";
import {
  AuthenticationRequiredError,
  requireAuthenticatedUserForAction,
} from "@/lib/auth/session";

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

export type SaveTeamDynamicsMixedAnswerActionInput =
  | {
      teamAssessmentParticipantId: string;
      questionId: string;
      responseFormat: "single_select_likert";
      optionId: string;
      locale?: string;
      clientTimestamp?: string;
    }
  | {
      teamAssessmentParticipantId: string;
      questionId: string;
      responseFormat: "best_worst";
      bestOptionId: string;
      worstOptionId: string;
      locale?: string;
      clientTimestamp?: string;
    };

export type SaveTeamDynamicsMixedAnswerActionResult =
  | {
      ok: true;
      status: "saved" | "overwritten" | "unchanged";
      teamAssessmentParticipantId: string;
      questionId: string;
      responseFormat: "single_select_likert" | "best_worst";
    }
  | {
      ok: false;
      status:
        | "invalid"
        | "not_runnable"
        | "unsupported"
        | "unsupported_storage_shape"
        | "error";
      reason: string;
      teamAssessmentParticipantId: string | null;
      questionId: string | null;
      responseFormat: string | null;
    };

type SaveTeamDynamicsMixedAnswerActionDependencies = {
  requireUser?: typeof requireAuthenticatedUserForAction;
  persistMixedAnswer?: (
    input: {
      userId: string;
      payload: TeamDynamicsMixedAnswerPayload;
    },
  ) => Promise<TeamDynamicsMixedAnswerPersistenceResult>;
};

export type CompleteTeamDynamicsMixedAssessmentActionInput = {
  teamAssessmentParticipantId: string;
};

export type CompleteTeamDynamicsMixedAssessmentActionResult =
  | {
      ok: true;
      status: "completed" | "already_completed";
      teamAssessmentParticipantId: string;
      readinessStatus: TeamDynamicsMixedCompletionReadiness["readinessStatus"];
      supportedItemCount: number;
      savedValidAnswerCount: number;
      missingQuestionIds: string[];
    }
  | {
      ok: false;
      status: "not_ready" | "not_runnable" | "invalid" | "error";
      reason: string;
      teamAssessmentParticipantId: string | null;
      readinessStatus?: TeamDynamicsMixedCompletionReadiness["readinessStatus"];
      supportedItemCount?: number;
      savedValidAnswerCount?: number;
      missingQuestionIds?: string[];
    };

type CompleteTeamDynamicsMixedAssessmentActionDependencies = {
  requireUser?: typeof requireAuthenticatedUserForAction;
  loadExecutionContext?: typeof loadTeamAssessmentExecutionContext;
  loadMixedRuntimeHandoff?: typeof loadTeamDynamicsMixedRuntimeHandoff;
  loadMixedCompletionReadiness?: typeof loadTeamDynamicsMixedCompletionReadinessForContext;
  transitionCompletion?: (
    input: {
      context: Extract<TeamAssessmentExecutionContextResult, { ok: true }>["context"];
      completedAt?: string;
    },
  ) => Promise<TeamAssessmentExecutionCompletionTransitionResult>;
};

export type CompleteTeamAssessmentActionInput = {
  teamAssessmentParticipantId: string;
};

type CompleteTeamAssessmentPostCompletionScoringStatus =
  | {
      ok: true;
      mode: "inserted" | "updated";
      scoringVersion: string;
    }
  | {
      ok: false;
      code: TeamAssessmentMinimalScorePersistenceFailureCode;
      reason: string;
      scoringVersion: string;
    };

export type CompleteTeamAssessmentActionResult =
  | {
      ok: true;
      mode: "completed" | "already_completed";
      completionReadiness: TeamAssessmentCompletionReadiness;
      postCompletionScoring?: CompleteTeamAssessmentPostCompletionScoringStatus;
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
  persistMinimalScore?: (
    input: {
      context: Extract<TeamAssessmentExecutionContextResult, { ok: true }>["context"];
      scoringVersion?: string;
      uiOnlyItems?: Awaited<ReturnType<typeof loadTeamAssessmentUiOnlyItems>>["items"];
    },
  ) => Promise<TeamAssessmentMinimalScorePersistenceResult>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildMixedAnswerActionFailure(
  input: Partial<SaveTeamDynamicsMixedAnswerActionInput>,
  status:
    | "invalid"
    | "not_runnable"
    | "unsupported"
    | "unsupported_storage_shape"
    | "error",
  reason: string,
): SaveTeamDynamicsMixedAnswerActionResult {
  return {
    ok: false,
    status,
    reason,
    teamAssessmentParticipantId: isNonEmptyString(input.teamAssessmentParticipantId)
      ? input.teamAssessmentParticipantId
      : null,
    questionId: isNonEmptyString(input.questionId) ? input.questionId : null,
    responseFormat:
      typeof input.responseFormat === "string" ? input.responseFormat : null,
  };
}

function buildMixedCompletionActionFailure(
  input: Partial<CompleteTeamDynamicsMixedAssessmentActionInput>,
  status: "not_ready" | "not_runnable" | "invalid" | "error",
  reason: string,
  readiness?: TeamDynamicsMixedCompletionReadiness,
): CompleteTeamDynamicsMixedAssessmentActionResult {
  return {
    ok: false,
    status,
    reason,
    teamAssessmentParticipantId: isNonEmptyString(input.teamAssessmentParticipantId)
      ? input.teamAssessmentParticipantId
      : null,
    ...(readiness
      ? {
          readinessStatus: readiness.readinessStatus,
          supportedItemCount: readiness.supportedItemCount,
          savedValidAnswerCount: readiness.savedValidAnswerCount,
          missingQuestionIds: readiness.missingQuestionIds,
        }
      : {}),
  };
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

export async function saveTeamDynamicsMixedAnswerAction(
  input: SaveTeamDynamicsMixedAnswerActionInput,
  deps: SaveTeamDynamicsMixedAnswerActionDependencies = {},
): Promise<SaveTeamDynamicsMixedAnswerActionResult> {
  if (
    !isNonEmptyString(input.teamAssessmentParticipantId) ||
    !isNonEmptyString(input.questionId)
  ) {
    return buildMixedAnswerActionFailure(
      input,
      "invalid",
      "teamAssessmentParticipantId and questionId are required.",
    );
  }

  if (input.responseFormat === "single_select_likert") {
    if (!isNonEmptyString(input.optionId)) {
      return buildMixedAnswerActionFailure(
        input,
        "invalid",
        "optionId is required for single_select_likert answers.",
      );
    }
  }

  if (input.responseFormat === "best_worst") {
    if (
      !isNonEmptyString(input.bestOptionId) ||
      !isNonEmptyString(input.worstOptionId)
    ) {
      return buildMixedAnswerActionFailure(
        input,
        "invalid",
        "bestOptionId and worstOptionId are required for best_worst answers.",
      );
    }
  }

  const requireUser = deps.requireUser ?? requireAuthenticatedUserForAction;
  const persistMixedAnswer =
    deps.persistMixedAnswer ?? persistValidatedTeamDynamicsMixedAnswer;

  try {
    const user = await requireUser();
    const result = await persistMixedAnswer({
      userId: user.id,
      payload: input,
    });

    if (!result.ok) {
      return {
        ok: false,
        status: result.status,
        reason: result.reason,
        teamAssessmentParticipantId: result.teamAssessmentParticipantId,
        questionId: result.questionId,
        responseFormat: result.responseFormat,
      };
    }

    return {
      ok: true,
      status: result.status,
      teamAssessmentParticipantId: result.value.teamAssessmentParticipantId,
      questionId: result.value.questionId,
      responseFormat: result.value.responseFormat,
    };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return buildMixedAnswerActionFailure(
        input,
        "error",
        "Authentication required.",
      );
    }

    return buildMixedAnswerActionFailure(
      input,
      "error",
      "Unable to save the Team Dynamics answer right now.",
    );
  }
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
  const persistMinimalScore =
    deps.persistMinimalScore ?? persistTeamAssessmentMinimalScoreForContext;
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

  let postCompletionScoring: CompleteTeamAssessmentPostCompletionScoringStatus | undefined;

  if (completionResult.mode === "completed") {
    const completedScoringContext = {
      ...contextResult.context,
      wrapperStatus: completionResult.wrapperStatus,
      attemptStatus: completionResult.attemptStatus,
    };
    const scorePersistenceResult = await persistMinimalScore({
      context: completedScoringContext,
      scoringVersion: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
      uiOnlyItems: uiOnlyItems.items,
    });

    if (scorePersistenceResult.ok) {
      postCompletionScoring = {
        ok: true,
        mode: scorePersistenceResult.mode,
        scoringVersion: scorePersistenceResult.value.scoringVersion,
      };
    } else {
      postCompletionScoring = {
        ok: false,
        code: scorePersistenceResult.code,
        reason: scorePersistenceResult.reason,
        scoringVersion: TEAM_ASSESSMENT_MINIMAL_SCORE_SCORING_VERSION,
      };
    }
  }

  return {
    ok: true,
    mode: completionResult.mode,
    completionReadiness,
    ...(postCompletionScoring ? { postCompletionScoring } : {}),
  };
}

export async function completeTeamDynamicsMixedAssessmentAction(
  input: CompleteTeamDynamicsMixedAssessmentActionInput,
  deps: CompleteTeamDynamicsMixedAssessmentActionDependencies = {},
): Promise<CompleteTeamDynamicsMixedAssessmentActionResult> {
  if (!isNonEmptyString(input.teamAssessmentParticipantId)) {
    return buildMixedCompletionActionFailure(
      input,
      "invalid",
      "teamAssessmentParticipantId is required.",
    );
  }

  const requireUser = deps.requireUser ?? requireAuthenticatedUserForAction;
  const loadExecutionContext =
    deps.loadExecutionContext ?? loadTeamAssessmentExecutionContext;
  const loadMixedRuntimeHandoff =
    deps.loadMixedRuntimeHandoff ?? loadTeamDynamicsMixedRuntimeHandoff;
  const loadMixedCompletionReadiness =
    deps.loadMixedCompletionReadiness ??
    loadTeamDynamicsMixedCompletionReadinessForContext;
  const transitionCompletion =
    deps.transitionCompletion ?? transitionTeamAssessmentExecutionToCompleted;

  try {
    const user = await requireUser();
    const contextResult = await loadExecutionContext({
      teamAssessmentParticipantId: input.teamAssessmentParticipantId,
      userId: user.id,
    });

    if (!contextResult.ok) {
      return buildMixedCompletionActionFailure(
        input,
        "invalid",
        contextResult.message,
      );
    }

    const context = contextResult.context;

    if (
      context.packageSlug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG ||
      context.test.slug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG
    ) {
      return buildMixedCompletionActionFailure(
        input,
        "invalid",
        `This completion action only supports ${TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG}.`,
      );
    }

    const runtimeHandoff = await loadMixedRuntimeHandoff({
      locale: context.locale,
    });
    const completionReadiness = await loadMixedCompletionReadiness({
      context,
      runtimeHandoff,
    });

    if (
      context.wrapperStatus === "completed" &&
      context.attemptStatus === "completed"
    ) {
      return {
        ok: true,
        status: "already_completed",
        teamAssessmentParticipantId: context.teamAssessmentParticipantId,
        readinessStatus: completionReadiness.readinessStatus,
        supportedItemCount: completionReadiness.supportedItemCount,
        savedValidAnswerCount: completionReadiness.savedValidAnswerCount,
        missingQuestionIds: completionReadiness.missingQuestionIds,
      };
    }

    if (
      context.wrapperStatus !== "started" ||
      context.attemptStatus !== "in_progress"
    ) {
      return buildMixedCompletionActionFailure(
        input,
        "not_runnable",
        "Team Dynamics mixed-format assessment is not in a completable state.",
        completionReadiness,
      );
    }

    if (
      completionReadiness.readinessStatus !== "ready" ||
      completionReadiness.isReadyForCompletion === false
    ) {
      return buildMixedCompletionActionFailure(
        input,
        "not_ready",
        "Team Dynamics mixed-format completion readiness is not satisfied.",
        completionReadiness,
      );
    }

    const completionResult = await transitionCompletion({ context });

    if (!completionResult.ok) {
      return buildMixedCompletionActionFailure(
        input,
        "not_runnable",
        completionResult.reason,
        completionReadiness,
      );
    }

    return {
      ok: true,
      status: completionResult.mode,
      teamAssessmentParticipantId: context.teamAssessmentParticipantId,
      readinessStatus: completionReadiness.readinessStatus,
      supportedItemCount: completionReadiness.supportedItemCount,
      savedValidAnswerCount: completionReadiness.savedValidAnswerCount,
      missingQuestionIds: completionReadiness.missingQuestionIds,
    };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return buildMixedCompletionActionFailure(
        input,
        "error",
        "Authentication required.",
      );
    }

    return buildMixedCompletionActionFailure(
      input,
      "error",
      "Unable to complete the Team Dynamics assessment right now.",
    );
  }
}
