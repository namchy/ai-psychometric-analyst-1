import "server-only";

import {
  normalizeAssessmentLocale,
  type AssessmentLocale,
} from "@/lib/assessment/locale";
import {
  loadTeamAssessmentExecutionContext,
  resolveTeamAssessmentExecutionShellState,
  type TeamAssessmentExecutionContext,
  type TeamAssessmentExecutionContextResult,
  type TeamAssessmentExecutionContextFailureCode,
  type TeamAssessmentExecutionShellState,
  type TeamAssessmentUiOnlyItem,
} from "@/lib/assessment/team-assessment-execution";
import type { QuestionType } from "@/lib/assessment/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type TeamAssessmentAnswerPayload = {
  teamAssessmentParticipantId: string;
  attemptId: string;
  questionId: string;
  optionId: string;
  responseFormat: "single_select_likert";
  locale: AssessmentLocale;
  clientTimestamp?: string;
};

export type ValidatedTeamAssessmentAnswerPayload = {
  teamAssessmentParticipantId: string;
  attemptId: string;
  questionId: string;
  optionId: string;
  responseFormat: "single_select_likert";
  locale: AssessmentLocale;
  clientTimestamp?: string;
  uniquenessKey: {
    teamAssessmentParticipantId: string;
    questionId: string;
  };
};

export const TEAM_ASSESSMENT_ANSWER_VALIDATION_FAILURE_CODES = [
  "invalid_payload",
  "invalid_response_format",
  "attempt_mismatch",
  "attempt_not_writable",
  "wrapper_not_writable",
  "question_not_in_handoff",
  "unsupported_question_format",
  "question_missing_options",
  "option_not_found",
  "option_question_mismatch",
  ...[
    "wrapper_not_found",
    "wrapper_missing_attempt",
    "wrapper_access_denied",
    "membership_inactive",
    "assignment_not_found",
    "assignment_inactive",
    "assignment_wrong_package",
    "team_not_found",
    "organization_unresolved",
    "attempt_not_found",
    "attempt_participant_mismatch",
    "attempt_organization_mismatch",
    "attempt_wrong_test",
    "test_inactive",
  ],
] as const;

export type TeamAssessmentAnswerValidationFailureCode =
  | (typeof TEAM_ASSESSMENT_ANSWER_VALIDATION_FAILURE_CODES)[number]
  | TeamAssessmentExecutionContextFailureCode;

export type TeamAssessmentAnswerValidationResult =
  | {
      ok: true;
      value: ValidatedTeamAssessmentAnswerPayload;
      mode: "validated_only";
    }
  | {
      ok: false;
      code: TeamAssessmentAnswerValidationFailureCode;
      reason: string;
    };

export const TEAM_ASSESSMENT_ANSWER_PERSISTENCE_FAILURE_CODES = [
  ...TEAM_ASSESSMENT_ANSWER_VALIDATION_FAILURE_CODES,
  "load_existing_failed",
  "replace_existing_failed",
  "insert_failed",
] as const;

export type TeamAssessmentAnswerPersistenceFailureCode =
  (typeof TEAM_ASSESSMENT_ANSWER_PERSISTENCE_FAILURE_CODES)[number];

export type TeamAssessmentAnswerPersistenceResult =
  | {
      ok: true;
      mode: "saved" | "overwritten" | "unchanged";
      value: ValidatedTeamAssessmentAnswerPayload & {
        responseId: string | null;
      };
    }
  | {
      ok: false;
      code: TeamAssessmentAnswerPersistenceFailureCode;
      reason: string;
    };

export type TeamAssessmentSavedAnswerState = {
  selectedOptionIdsByQuestionId: Record<string, string>;
  loadedQuestionIds: string[];
  loadedCount: number;
};

export type TeamAssessmentCompletionReadiness = {
  supportedQuestionCount: number;
  savedValidAnswerCount: number;
  missingQuestionIds: string[];
  invalidSavedAnswerCount: number;
  isReadyForCompletion: boolean;
  readinessStatus: "not_ready" | "ready" | "no_supported_items";
};

type TeamAssessmentAnswerQuestionRecord = {
  id: string;
  test_id: string;
  question_type: QuestionType | string;
};

type TeamAssessmentAnswerOptionRecord = {
  id: string;
  question_id: string;
};

type TeamAssessmentPersistedResponseRecord = {
  id: string;
  question_id: string;
  response_kind: QuestionType | string;
  answer_option_id: string | null;
};

type TeamAssessmentSavedResponseRecord = {
  question_id: string;
  answer_option_id: string | null;
  response_kind: QuestionType | string;
};

type TeamAssessmentCompletionReadinessResponseRecord = {
  question_id: string;
  answer_option_id: string | null;
  response_kind: QuestionType | string;
};

type TeamAssessmentAnswerValidationDependencies = {
  loadExecutionContext?: typeof loadTeamAssessmentExecutionContext;
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

function fail(
  code: TeamAssessmentAnswerValidationFailureCode,
  reason: string,
): TeamAssessmentAnswerValidationResult {
  return {
    ok: false,
    code,
    reason,
  };
}

function persistFail(
  code: TeamAssessmentAnswerPersistenceFailureCode,
  reason: string,
): TeamAssessmentAnswerPersistenceResult {
  return {
    ok: false,
    code,
    reason,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildEmptySavedAnswerState(): TeamAssessmentSavedAnswerState {
  return {
    selectedOptionIdsByQuestionId: {},
    loadedQuestionIds: [],
    loadedCount: 0,
  };
}

function buildEmptyCompletionReadiness(): TeamAssessmentCompletionReadiness {
  return {
    supportedQuestionCount: 0,
    savedValidAnswerCount: 0,
    missingQuestionIds: [],
    invalidSavedAnswerCount: 0,
    isReadyForCompletion: false,
    readinessStatus: "no_supported_items",
  };
}

export function buildTeamAssessmentAnswerValidationResult(input: {
  payload: TeamAssessmentAnswerPayload;
  contextResult: TeamAssessmentExecutionContextResult;
  question: TeamAssessmentAnswerQuestionRecord | null;
  option: TeamAssessmentAnswerOptionRecord | null;
  questionHasOptions: boolean;
}): TeamAssessmentAnswerValidationResult {
  if (!isNonEmptyString(input.payload.teamAssessmentParticipantId)) {
    return fail("invalid_payload", "teamAssessmentParticipantId is required.");
  }

  if (!isNonEmptyString(input.payload.attemptId)) {
    return fail("invalid_payload", "attemptId is required.");
  }

  if (!isNonEmptyString(input.payload.questionId)) {
    return fail("invalid_payload", "questionId is required.");
  }

  if (!isNonEmptyString(input.payload.optionId)) {
    return fail("invalid_payload", "optionId is required.");
  }

  if (input.payload.responseFormat !== "single_select_likert") {
    return fail(
      "invalid_response_format",
      'Only responseFormat "single_select_likert" is supported in this validator.',
    );
  }

  if (!input.contextResult.ok) {
    return fail(input.contextResult.code, input.contextResult.message);
  }

  const shellState = resolveTeamAssessmentExecutionShellState({
    route: "run",
    wrapperStatus: input.contextResult.context.wrapperStatus,
  });

  if (!shellState.isRunnable) {
    return fail(
      "wrapper_not_writable",
      "Team Dynamics wrapper is not in a writable validation state.",
    );
  }

  if (input.contextResult.context.attemptStatus !== "in_progress") {
    return fail(
      "attempt_not_writable",
      "Team Dynamics linked attempt is not in an in_progress state.",
    );
  }

  if (input.payload.attemptId !== input.contextResult.context.attemptId) {
    return fail(
      "attempt_mismatch",
      "Provided attemptId does not match the wrapper-linked Team Dynamics attempt.",
    );
  }

  if (
    !input.question ||
    input.question.id !== input.payload.questionId ||
    input.question.test_id !== input.contextResult.context.test.id
  ) {
    return fail(
      "question_not_in_handoff",
      "Provided questionId does not belong to the active Team Dynamics handoff.",
    );
  }

  if (input.question.question_type !== "single_choice") {
    return fail(
      "unsupported_question_format",
      "Only Likert-style single-select Team Dynamics items are supported.",
    );
  }

  if (!input.questionHasOptions) {
    return fail(
      "question_missing_options",
      "Team Dynamics question does not have selectable options for this validator.",
    );
  }

  if (!input.option || input.option.id !== input.payload.optionId) {
    return fail("option_not_found", "Provided optionId was not found.");
  }

  if (input.option.question_id !== input.payload.questionId) {
    return fail(
      "option_question_mismatch",
      "Provided optionId does not belong to the provided questionId.",
    );
  }

  return {
    ok: true,
    mode: "validated_only",
    value: {
      teamAssessmentParticipantId: input.payload.teamAssessmentParticipantId,
      attemptId: input.payload.attemptId,
      questionId: input.payload.questionId,
      optionId: input.payload.optionId,
      responseFormat: "single_select_likert",
      locale: normalizeAssessmentLocale(input.payload.locale),
      ...(input.payload.clientTimestamp
        ? {
            clientTimestamp: input.payload.clientTimestamp,
          }
        : {}),
      uniquenessKey: {
        teamAssessmentParticipantId: input.payload.teamAssessmentParticipantId,
        questionId: input.payload.questionId,
      },
    },
  };
}

export async function validateTeamAssessmentAnswerPayload(
  input: {
    userId: string;
    payload: TeamAssessmentAnswerPayload;
  },
  deps: TeamAssessmentAnswerValidationDependencies = {},
): Promise<TeamAssessmentAnswerValidationResult> {
  const loadExecutionContext =
    deps.loadExecutionContext ?? loadTeamAssessmentExecutionContext;
  const contextResult = await loadExecutionContext({
    teamAssessmentParticipantId: input.payload.teamAssessmentParticipantId,
    userId: input.userId,
  });

  if (!contextResult.ok) {
    return buildTeamAssessmentAnswerValidationResult({
      payload: input.payload,
      contextResult,
      question: null,
      option: null,
      questionHasOptions: false,
    });
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const [questionResult, optionResult, optionCountResult] = await Promise.all([
    supabase
      .from("questions")
      .select("id, test_id, question_type")
      .eq("id", input.payload.questionId)
      .eq("test_id", contextResult.context.test.id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("answer_options")
      .select("id, question_id")
      .eq("id", input.payload.optionId)
      .maybeSingle(),
    supabase
      .from("answer_options")
      .select("id", { count: "exact", head: true })
      .eq("question_id", input.payload.questionId),
  ]);

  if (questionResult.error) {
    throw new Error(
      `Failed to validate Team Dynamics question payload boundary: ${questionResult.error.message}`,
    );
  }

  if (optionResult.error) {
    throw new Error(
      `Failed to validate Team Dynamics option payload boundary: ${optionResult.error.message}`,
    );
  }

  if (optionCountResult.error) {
    throw new Error(
      `Failed to validate Team Dynamics option availability: ${optionCountResult.error.message}`,
    );
  }

  return buildTeamAssessmentAnswerValidationResult({
    payload: input.payload,
    contextResult,
    question: (questionResult.data as TeamAssessmentAnswerQuestionRecord | null) ?? null,
    option: (optionResult.data as TeamAssessmentAnswerOptionRecord | null) ?? null,
    questionHasOptions: (optionCountResult.count ?? 0) > 0,
  });
}

export async function persistValidatedTeamAssessmentAnswer(
  input: {
    userId: string;
    payload: TeamAssessmentAnswerPayload;
  },
  deps: TeamAssessmentAnswerValidationDependencies = {},
): Promise<TeamAssessmentAnswerPersistenceResult> {
  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const validated = await validateTeamAssessmentAnswerPayload(input, {
    ...deps,
    supabase,
  });

  if (!validated.ok) {
    return persistFail(validated.code, validated.reason);
  }

  const { data: existingResponsesData, error: existingResponsesError } = await supabase
    .from("responses")
    .select("id, question_id, response_kind, answer_option_id")
    .eq("attempt_id", validated.value.attemptId)
    .eq("question_id", validated.value.questionId);

  if (existingResponsesError) {
    return persistFail(
      "load_existing_failed",
      `Unable to inspect existing Team Dynamics responses: ${existingResponsesError.message}`,
    );
  }

  const existingResponses = (existingResponsesData ?? []) as TeamAssessmentPersistedResponseRecord[];
  const existingSingleChoiceResponse =
    existingResponses.length === 1 &&
    existingResponses[0]?.response_kind === "single_choice" &&
    existingResponses[0]?.answer_option_id === validated.value.optionId
      ? existingResponses[0]
      : null;

  if (existingSingleChoiceResponse) {
    return {
      ok: true,
      mode: "unchanged",
      value: {
        ...validated.value,
        responseId: existingSingleChoiceResponse.id,
      },
    };
  }

  if (existingResponses.length > 0) {
    const { error: deleteExistingError } = await supabase
      .from("responses")
      .delete()
      .eq("attempt_id", validated.value.attemptId)
      .eq("question_id", validated.value.questionId);

    if (deleteExistingError) {
      return persistFail(
        "replace_existing_failed",
        `Unable to replace existing Team Dynamics response: ${deleteExistingError.message}`,
      );
    }
  }

  const { data: insertedResponseData, error: insertedResponseError } = await supabase
    .from("responses")
    .insert({
      attempt_id: validated.value.attemptId,
      question_id: validated.value.questionId,
      response_kind: "single_choice",
      answer_option_id: validated.value.optionId,
    })
    .select("id")
    .single();

  if (insertedResponseError || !insertedResponseData) {
    return persistFail(
      "insert_failed",
      `Unable to persist Team Dynamics response skeleton: ${insertedResponseError?.message ?? "Unknown error"}`,
    );
  }

  return {
    ok: true,
    mode: existingResponses.length > 0 ? "overwritten" : "saved",
    value: {
      ...validated.value,
      responseId: (insertedResponseData as { id: string }).id,
    },
  };
}

export function buildTeamAssessmentSavedAnswerState(input: {
  shellState: TeamAssessmentExecutionShellState;
  context: TeamAssessmentExecutionContext;
  uiOnlyItems: TeamAssessmentUiOnlyItem[];
  savedResponses: TeamAssessmentSavedResponseRecord[];
}): TeamAssessmentSavedAnswerState {
  if (!input.shellState.isRunnable || input.context.attemptStatus !== "in_progress") {
    return buildEmptySavedAnswerState();
  }

  const validOptionIdsByQuestionId = new Map<string, Set<string>>();

  for (const item of input.uiOnlyItems) {
    validOptionIdsByQuestionId.set(item.questionId, new Set(item.optionIds));
  }

  const selectedOptionIdsByQuestionId: Record<string, string> = {};

  for (const savedResponse of input.savedResponses) {
    const validOptionIds = validOptionIdsByQuestionId.get(savedResponse.question_id);

    if (!validOptionIds || savedResponse.response_kind !== "single_choice") {
      continue;
    }

    if (
      !savedResponse.answer_option_id ||
      validOptionIds.has(savedResponse.answer_option_id) === false
    ) {
      continue;
    }

    selectedOptionIdsByQuestionId[savedResponse.question_id] = savedResponse.answer_option_id;
  }

  const loadedQuestionIds = Object.keys(selectedOptionIdsByQuestionId);

  return {
    selectedOptionIdsByQuestionId,
    loadedQuestionIds,
    loadedCount: loadedQuestionIds.length,
  };
}

export async function loadTeamAssessmentSavedAnswerStateForContext(input: {
  context: TeamAssessmentExecutionContext;
  shellState: TeamAssessmentExecutionShellState;
  uiOnlyItems: TeamAssessmentUiOnlyItem[];
}, deps: {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
} = {}): Promise<TeamAssessmentSavedAnswerState> {
  if (
    input.shellState.isRunnable === false ||
    input.context.attemptStatus !== "in_progress" ||
    input.uiOnlyItems.length === 0
  ) {
    return buildEmptySavedAnswerState();
  }

  const questionIds = input.uiOnlyItems.map((item) => item.questionId);
  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("responses")
    .select("question_id, answer_option_id, response_kind")
    .eq("attempt_id", input.context.attemptId)
    .in("question_id", questionIds)
    .eq("response_kind", "single_choice");

  if (error) {
    throw new Error(`Failed to load Team Dynamics saved answer state: ${error.message}`);
  }

  return buildTeamAssessmentSavedAnswerState({
    shellState: input.shellState,
    context: input.context,
    uiOnlyItems: input.uiOnlyItems,
    savedResponses: (data ?? []) as TeamAssessmentSavedResponseRecord[],
  });
}

export async function loadSavedTeamAssessmentAnswers(input: {
  userId: string;
  teamAssessmentParticipantId: string;
  uiOnlyItems: TeamAssessmentUiOnlyItem[];
}, deps: TeamAssessmentAnswerValidationDependencies = {}): Promise<TeamAssessmentSavedAnswerState> {
  const loadExecutionContext =
    deps.loadExecutionContext ?? loadTeamAssessmentExecutionContext;
  const contextResult = await loadExecutionContext({
    teamAssessmentParticipantId: input.teamAssessmentParticipantId,
    userId: input.userId,
  });

  if (!contextResult.ok) {
    return buildEmptySavedAnswerState();
  }

  const shellState = resolveTeamAssessmentExecutionShellState({
    route: "run",
    wrapperStatus: contextResult.context.wrapperStatus,
  });

  return loadTeamAssessmentSavedAnswerStateForContext(
    {
      context: contextResult.context,
      shellState,
      uiOnlyItems: input.uiOnlyItems,
    },
    {
      supabase: deps.supabase,
    },
  );
}

export function buildTeamAssessmentCompletionReadiness(input: {
  shellState: TeamAssessmentExecutionShellState;
  context: TeamAssessmentExecutionContext;
  uiOnlyItems: TeamAssessmentUiOnlyItem[];
  savedResponses: TeamAssessmentCompletionReadinessResponseRecord[];
}): TeamAssessmentCompletionReadiness {
  if (!input.shellState.isRunnable || input.context.attemptStatus !== "in_progress") {
    return buildEmptyCompletionReadiness();
  }

  if (input.uiOnlyItems.length === 0) {
    return buildEmptyCompletionReadiness();
  }

  const validOptionIdsByQuestionId = new Map<string, Set<string>>();

  for (const item of input.uiOnlyItems) {
    validOptionIdsByQuestionId.set(item.questionId, new Set(item.optionIds));
  }

  const selectedOptionIdsByQuestionId = new Map<string, string>();
  let invalidSavedAnswerCount = 0;

  for (const savedResponse of input.savedResponses) {
    const validOptionIds = validOptionIdsByQuestionId.get(savedResponse.question_id);

    if (!validOptionIds) {
      continue;
    }

    if (
      savedResponse.response_kind !== "single_choice" ||
      !savedResponse.answer_option_id ||
      validOptionIds.has(savedResponse.answer_option_id) === false
    ) {
      invalidSavedAnswerCount += 1;
      continue;
    }

    selectedOptionIdsByQuestionId.set(savedResponse.question_id, savedResponse.answer_option_id);
  }

  const missingQuestionIds = input.uiOnlyItems
    .map((item) => item.questionId)
    .filter((questionId) => !selectedOptionIdsByQuestionId.has(questionId));
  const supportedQuestionCount = input.uiOnlyItems.length;
  const savedValidAnswerCount = supportedQuestionCount - missingQuestionIds.length;
  const isReadyForCompletion = supportedQuestionCount > 0 && missingQuestionIds.length === 0;

  return {
    supportedQuestionCount,
    savedValidAnswerCount,
    missingQuestionIds,
    invalidSavedAnswerCount,
    isReadyForCompletion,
    readinessStatus: isReadyForCompletion ? "ready" : "not_ready",
  };
}

export async function loadTeamAssessmentCompletionReadinessForContext(input: {
  context: TeamAssessmentExecutionContext;
  shellState: TeamAssessmentExecutionShellState;
  uiOnlyItems: TeamAssessmentUiOnlyItem[];
}, deps: {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
} = {}): Promise<TeamAssessmentCompletionReadiness> {
  if (
    input.shellState.isRunnable === false ||
    input.context.attemptStatus !== "in_progress" ||
    input.uiOnlyItems.length === 0
  ) {
    return buildEmptyCompletionReadiness();
  }

  const questionIds = input.uiOnlyItems.map((item) => item.questionId);
  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("responses")
    .select("question_id, answer_option_id, response_kind")
    .eq("attempt_id", input.context.attemptId)
    .in("question_id", questionIds)
    .eq("response_kind", "single_choice");

  if (error) {
    throw new Error(`Failed to load Team Dynamics completion readiness: ${error.message}`);
  }

  return buildTeamAssessmentCompletionReadiness({
    shellState: input.shellState,
    context: input.context,
    uiOnlyItems: input.uiOnlyItems,
    savedResponses: (data ?? []) as TeamAssessmentCompletionReadinessResponseRecord[],
  });
}

export async function loadTeamAssessmentCompletionReadiness(input: {
  userId: string;
  teamAssessmentParticipantId: string;
  uiOnlyItems: TeamAssessmentUiOnlyItem[];
}, deps: TeamAssessmentAnswerValidationDependencies = {}): Promise<TeamAssessmentCompletionReadiness> {
  const loadExecutionContext = deps.loadExecutionContext ?? loadTeamAssessmentExecutionContext;
  const contextResult = await loadExecutionContext({
    teamAssessmentParticipantId: input.teamAssessmentParticipantId,
    userId: input.userId,
  });

  if (!contextResult.ok) {
    return buildEmptyCompletionReadiness();
  }

  const shellState = resolveTeamAssessmentExecutionShellState({
    route: "run",
    wrapperStatus: contextResult.context.wrapperStatus,
  });

  return loadTeamAssessmentCompletionReadinessForContext(
    {
      context: contextResult.context,
      shellState,
      uiOnlyItems: input.uiOnlyItems,
    },
    {
      supabase: deps.supabase,
    },
  );
}
