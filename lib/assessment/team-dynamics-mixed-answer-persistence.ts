import "server-only";

import {
  validateTeamDynamicsMixedAnswerPayload,
  type TeamDynamicsMixedAnswerPayload,
  type TeamDynamicsMixedAnswerPayloadValidationResult,
  type ValidatedTeamDynamicsMixedAnswerPayload,
} from "@/lib/assessment/team-dynamics-mixed-answer-payload-validator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamDynamicsMixedPersistedAnswerValueBase = {
  teamAssessmentParticipantId: string;
  questionId: string;
  responseFormat: "single_select_likert" | "best_worst";
  uniquenessKey: {
    teamAssessmentParticipantId: string;
    questionId: string;
  };
};

export type TeamDynamicsMixedPersistedLikertAnswerValue =
  TeamDynamicsMixedPersistedAnswerValueBase & {
    responseFormat: "single_select_likert";
    optionId: string;
    responseId: string | null;
  };

export type TeamDynamicsMixedPersistedSjtAnswerValue =
  TeamDynamicsMixedPersistedAnswerValueBase & {
    responseFormat: "best_worst";
    bestOptionId: string;
    worstOptionId: string;
    responseId: string | null;
  };

export type TeamDynamicsMixedPersistedAnswerValue =
  | TeamDynamicsMixedPersistedLikertAnswerValue
  | TeamDynamicsMixedPersistedSjtAnswerValue;

export type TeamDynamicsMixedAnswerPersistenceStatus =
  | "saved"
  | "overwritten"
  | "unchanged"
  | "invalid"
  | "not_runnable"
  | "unsupported"
  | "unsupported_storage_shape";

export type TeamDynamicsMixedAnswerPersistenceResult =
  | {
      ok: true;
      status: "saved" | "overwritten" | "unchanged";
      value: TeamDynamicsMixedPersistedAnswerValue;
    }
  | {
      ok: false;
      status: "invalid" | "not_runnable" | "unsupported" | "unsupported_storage_shape";
      reason: string;
      teamAssessmentParticipantId: string | null;
      questionId: string | null;
      responseFormat: string | null;
      uniquenessKey: {
        teamAssessmentParticipantId: string;
        questionId: string;
      } | null;
    };

type ExistingResponseRecord = {
  id: string;
  question_id: string;
  response_kind: string;
  answer_option_id: string | null;
};

type ExistingResponseSelectionRecord = {
  response_id: string;
  question_id: string;
  answer_option_id: string;
  selection_role: string | null;
};

type TeamDynamicsMixedAnswerPersistenceDependencies = {
  validatePayload?: typeof validateTeamDynamicsMixedAnswerPayload;
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildFailureContext(payload: Partial<TeamDynamicsMixedAnswerPayload>) {
  const uniquenessKey =
    isNonEmptyString(payload.teamAssessmentParticipantId) && isNonEmptyString(payload.questionId)
      ? {
          teamAssessmentParticipantId: payload.teamAssessmentParticipantId,
          questionId: payload.questionId,
        }
      : null;

  return {
    teamAssessmentParticipantId: isNonEmptyString(payload.teamAssessmentParticipantId)
      ? payload.teamAssessmentParticipantId
      : null,
    questionId: isNonEmptyString(payload.questionId) ? payload.questionId : null,
    responseFormat:
      typeof payload.responseFormat === "string" ? payload.responseFormat : null,
    uniquenessKey,
  };
}

function mapValidationFailure(
  payload: TeamDynamicsMixedAnswerPayload,
  validationResult: Exclude<TeamDynamicsMixedAnswerPayloadValidationResult, { ok: true }>,
): TeamDynamicsMixedAnswerPersistenceResult {
  return {
    ok: false,
    status: validationResult.status,
    reason: validationResult.reason,
    ...buildFailureContext(payload),
  };
}

function fail(
  status: "invalid" | "not_runnable" | "unsupported" | "unsupported_storage_shape",
  reason: string,
  payload: Partial<TeamDynamicsMixedAnswerPayload>,
): TeamDynamicsMixedAnswerPersistenceResult {
  return {
    ok: false,
    status,
    reason,
    ...buildFailureContext(payload),
  };
}

function buildSuccessValue(
  value: ValidatedTeamDynamicsMixedAnswerPayload,
  responseId: string | null,
): TeamDynamicsMixedPersistedAnswerValue {
  if (value.responseFormat === "single_select_likert") {
    return {
      teamAssessmentParticipantId: value.teamAssessmentParticipantId,
      questionId: value.questionId,
      responseFormat: "single_select_likert",
      optionId: value.optionId,
      uniquenessKey: value.uniquenessKey,
      responseId,
    };
  }

  return {
    teamAssessmentParticipantId: value.teamAssessmentParticipantId,
    questionId: value.questionId,
    responseFormat: "best_worst",
    bestOptionId: value.bestOptionId,
    worstOptionId: value.worstOptionId,
    uniquenessKey: value.uniquenessKey,
    responseId,
  };
}

function getBestWorstSelectionState(selections: ExistingResponseSelectionRecord[]): {
  bestOptionId: string | null;
  worstOptionId: string | null;
  isCanonicalPair: boolean;
} {
  const bestSelections = selections.filter(
    (selection) => selection.selection_role === "best",
  );
  const worstSelections = selections.filter(
    (selection) => selection.selection_role === "worst",
  );

  return {
    bestOptionId: bestSelections.length === 1 ? bestSelections[0]?.answer_option_id ?? null : null,
    worstOptionId:
      worstSelections.length === 1 ? worstSelections[0]?.answer_option_id ?? null : null,
    isCanonicalPair:
      selections.length === 2 && bestSelections.length === 1 && worstSelections.length === 1,
  };
}

async function loadExistingResponses(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: {
    attemptId: string;
    questionId: string;
  },
) {
  const { data, error } = await supabase
    .from("responses")
    .select("id, question_id, response_kind, answer_option_id")
    .eq("attempt_id", input.attemptId)
    .eq("question_id", input.questionId);

  if (error) {
    throw new Error(
      `Failed to inspect existing Team Dynamics mixed responses: ${error.message}`,
    );
  }

  return (data ?? []) as ExistingResponseRecord[];
}

async function deleteResponseSelectionsForResponse(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  responseId: string,
) {
  const { error } = await supabase
    .from("response_selections")
    .delete()
    .eq("response_id", responseId);

  if (error) {
    throw new Error(
      `Failed to replace existing Team Dynamics mixed response selections: ${error.message}`,
    );
  }
}

async function deleteResponseForQuestion(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: {
    attemptId: string;
    questionId: string;
  },
) {
  const { error } = await supabase
    .from("responses")
    .delete()
    .eq("attempt_id", input.attemptId)
    .eq("question_id", input.questionId);

  if (error) {
    throw new Error(
      `Failed to replace existing Team Dynamics mixed response: ${error.message}`,
    );
  }
}

async function insertLikertResponse(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  value: Extract<ValidatedTeamDynamicsMixedAnswerPayload, { responseFormat: "single_select_likert" }>,
) {
  const { data, error } = await supabase
    .from("responses")
    .insert({
      attempt_id: value.attemptId,
      question_id: value.questionId,
      response_kind: "single_choice",
      answer_option_id: value.optionId,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to persist Team Dynamics mixed Likert response: ${error?.message ?? "Unknown error"}`,
    );
  }

  return (data as { id: string }).id;
}

async function insertBestWorstResponse(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  value: Extract<ValidatedTeamDynamicsMixedAnswerPayload, { responseFormat: "best_worst" }>,
) {
  const { data, error } = await supabase
    .from("responses")
    .insert({
      attempt_id: value.attemptId,
      question_id: value.questionId,
      response_kind: "best_worst",
      answer_option_id: null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to persist Team Dynamics mixed best_worst response: ${error?.message ?? "Unknown error"}`,
    );
  }

  const responseId = (data as { id: string }).id;
  const { error: selectionInsertError } = await supabase
    .from("response_selections")
    .insert([
      {
        response_id: responseId,
        question_id: value.questionId,
        answer_option_id: value.bestOptionId,
        selection_role: "best",
      },
      {
        response_id: responseId,
        question_id: value.questionId,
        answer_option_id: value.worstOptionId,
        selection_role: "worst",
      },
    ]);

  if (selectionInsertError) {
    throw new Error(
      `Failed to persist Team Dynamics mixed best_worst response selections: ${selectionInsertError.message}`,
    );
  }

  return responseId;
}

async function persistLikertResponse(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  value: Extract<ValidatedTeamDynamicsMixedAnswerPayload, { responseFormat: "single_select_likert" }>,
  payload: TeamDynamicsMixedAnswerPayload,
): Promise<TeamDynamicsMixedAnswerPersistenceResult> {
  const existingResponses = await loadExistingResponses(supabase, {
    attemptId: value.attemptId,
    questionId: value.questionId,
  });

  if (existingResponses.length > 1) {
    return fail(
      "invalid",
      "Multiple stored responses exist for the same Team Dynamics question.",
      payload,
    );
  }

  const existingResponse = existingResponses[0] ?? null;

  if (
    existingResponse &&
    existingResponse.response_kind === "single_choice" &&
    existingResponse.answer_option_id === value.optionId
  ) {
    return {
      ok: true,
      status: "unchanged",
      value: buildSuccessValue(value, existingResponse.id),
    };
  }

  if (existingResponse && existingResponse.response_kind !== "single_choice") {
    return fail(
      "invalid",
      "Existing stored response kind conflicts with final mixed-format Likert persistence.",
      payload,
    );
  }

  if (existingResponse) {
    await deleteResponseForQuestion(supabase, {
      attemptId: value.attemptId,
      questionId: value.questionId,
    });
  }

  const responseId = await insertLikertResponse(supabase, value);

  return {
    ok: true,
    status: existingResponse ? "overwritten" : "saved",
    value: buildSuccessValue(value, responseId),
  };
}

async function persistBestWorstResponse(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  value: Extract<ValidatedTeamDynamicsMixedAnswerPayload, { responseFormat: "best_worst" }>,
  payload: TeamDynamicsMixedAnswerPayload,
): Promise<TeamDynamicsMixedAnswerPersistenceResult> {
  if (value.bestOptionId === value.worstOptionId) {
    return fail(
      "invalid",
      "bestOptionId and worstOptionId must be different for best_worst persistence.",
      payload,
    );
  }

  const existingResponses = await loadExistingResponses(supabase, {
    attemptId: value.attemptId,
    questionId: value.questionId,
  });

  if (existingResponses.length > 1) {
    return fail(
      "invalid",
      "Multiple stored responses exist for the same Team Dynamics question.",
      payload,
    );
  }

  const existingResponse = existingResponses[0] ?? null;

  if (existingResponse && existingResponse.response_kind !== "best_worst") {
    return fail(
      "invalid",
      "Existing stored response kind conflicts with final mixed-format best_worst persistence.",
      payload,
    );
  }

  if (!existingResponse) {
    const responseId = await insertBestWorstResponse(supabase, value);

    return {
      ok: true,
      status: "saved",
      value: buildSuccessValue(value, responseId),
    };
  }

  const { data: selectionData, error: selectionError } = await supabase
    .from("response_selections")
    .select("response_id, question_id, answer_option_id, selection_role")
    .eq("response_id", existingResponse.id);

  if (selectionError) {
    throw new Error(
      `Failed to inspect existing Team Dynamics mixed response selections: ${selectionError.message}`,
    );
  }

  const existingSelections = (selectionData ?? []) as ExistingResponseSelectionRecord[];
  const selectionState = getBestWorstSelectionState(existingSelections);

  if (
    selectionState.isCanonicalPair &&
    selectionState.bestOptionId === value.bestOptionId &&
    selectionState.worstOptionId === value.worstOptionId &&
    existingResponse.answer_option_id === null
  ) {
    return {
      ok: true,
      status: "unchanged",
      value: buildSuccessValue(value, existingResponse.id),
    };
  }

  await deleteResponseSelectionsForResponse(supabase, existingResponse.id);
  await deleteResponseForQuestion(supabase, {
    attemptId: value.attemptId,
    questionId: value.questionId,
  });
  const responseId = await insertBestWorstResponse(supabase, value);

  return {
    ok: true,
    status: "overwritten",
    value: buildSuccessValue(value, responseId),
  };
}

export async function persistValidatedTeamDynamicsMixedAnswer(
  input: {
    userId: string;
    payload: TeamDynamicsMixedAnswerPayload;
  },
  deps: TeamDynamicsMixedAnswerPersistenceDependencies = {},
): Promise<TeamDynamicsMixedAnswerPersistenceResult> {
  const validatePayload =
    deps.validatePayload ?? validateTeamDynamicsMixedAnswerPayload;
  const validationResult = await validatePayload({
    userId: input.userId,
    payload: input.payload,
  });

  if (!validationResult.ok) {
    return mapValidationFailure(input.payload, validationResult);
  }

  if (validationResult.status !== "validated_only") {
    return fail(
      "unsupported",
      "Team Dynamics payload did not reach a writable validated_only state.",
      input.payload,
    );
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();

  if (validationResult.value.responseFormat === "single_select_likert") {
    return persistLikertResponse(supabase, validationResult.value, input.payload);
  }

  return persistBestWorstResponse(supabase, validationResult.value, input.payload);
}
