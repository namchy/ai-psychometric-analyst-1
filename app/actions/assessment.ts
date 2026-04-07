"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  loadAssessmentCompletionState,
} from "@/lib/assessment/completion-server";
import {
  getActiveOrganizationForUser,
  getAttemptForOrganization,
  getParticipantForOrganization,
} from "@/lib/b2b/organizations";
import { getCandidateAttemptForUser } from "@/lib/candidate/attempts";
import {
  enqueueCompletedAssessmentReports,
  persistCompletedAssessmentReport,
  type CompletedAssessmentReportState,
} from "@/lib/assessment/reports";
import {
  normalizeAssessmentLocale,
  type AssessmentLocale,
} from "@/lib/assessment/locale";
import {
  persistCompletedAssessmentResults,
  type CompletedAssessmentResults,
} from "@/lib/assessment/scoring";
import { ASSESSMENT_ATTEMPT_COOKIE_NAME } from "@/lib/assessment/tests";
import type {
  AssessmentSelectionsInput,
  AssessmentSelectionValue,
  AttemptOwnershipContext,
  AttemptStatus,
  QuestionType,
} from "@/lib/assessment/types";
import {
  AuthenticationRequiredError,
  requireAuthenticatedUser,
  requireAuthenticatedUserForAction,
} from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SaveAssessmentSelectionsInput = {
  attemptId: string | null;
  testId: string;
  selections: AssessmentSelectionsInput;
  locale?: AssessmentLocale | null;
  ownershipContext?: AttemptOwnershipContext;
};

type SaveAssessmentSelectionsResult =
  | {
      ok: true;
      attemptId: string;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

type CompleteAssessmentAttemptResult =
  | {
      ok: true;
      attemptId: string;
      completedAt: string;
      message: string;
      results: CompletedAssessmentResults | null;
      report: CompletedAssessmentReportState | null;
    }
  | {
      ok: false;
      message: string;
    };

type QuestionRecord = {
  id: string;
  question_type: QuestionType;
};

type AnswerOptionRecord = {
  id: string;
  question_id: string;
};

type AttemptRecord = {
  id: string;
  locale?: AssessmentLocale;
  status: AttemptStatus;
  completed_at: string | null;
};

type ResponseInsert = {
  attempt_id: string;
  question_id: string;
  response_kind: QuestionType;
  answer_option_id?: string | null;
  text_value?: string | null;
};

type InsertedResponseRecord = {
  id: string;
  question_id: string;
  response_kind: QuestionType;
};

type ResponseSelectionInsert = {
  response_id: string;
  question_id: string;
  answer_option_id: string;
};

type PersistSelectionsResult =
  | {
      ok: true;
      attemptId: string;
    }
  | {
      ok: false;
      message: string;
    };

type PersistAssessmentSelectionsOptions = {
  persistAttemptCookie?: boolean;
  requireProtectedOwnership?: boolean;
};

const DEFAULT_B2B_TEST_SLUG = "ipip50-hr-v1";

function revalidateAttemptRunPaths(attemptId: string) {
  revalidatePath(`/app/attempts/${attemptId}/run`);
  revalidatePath(`/dashboard/attempts/${attemptId}/run`);
}

function revalidateAttemptAllPaths(attemptId: string) {
  revalidatePath("/app");
  revalidatePath(`/app/attempts/${attemptId}`);
  revalidatePath(`/app/attempts/${attemptId}/run`);
  revalidatePath(`/app/attempts/${attemptId}/report`);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/attempts/${attemptId}`);
  revalidatePath(`/dashboard/attempts/${attemptId}/run`);
}

function isStringArray(value: AssessmentSelectionValue): value is string[] {
  return Array.isArray(value);
}

function isSelectionValue(value: unknown): value is AssessmentSelectionValue {
  if (typeof value === "string") {
    return true;
  }

  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isSelectionMap(value: SaveAssessmentSelectionsInput["selections"]): boolean {
  return Object.entries(value).every(
    ([questionId, selection]) => !!questionId && isSelectionValue(selection),
  );
}

function getDistinctOptionIds(optionIds: string[]): string[] {
  return [...new Set(optionIds.filter((optionId) => optionId.length > 0))];
}

function isSupportedQuestionType(questionType: QuestionType): boolean {
  return (
    questionType === "single_choice" ||
    questionType === "multiple_choice" ||
    questionType === "text"
  );
}

function getSaveFailureMessage(error: unknown): string {
  if (error instanceof AuthenticationRequiredError) {
    return "Your session has expired. Sign in again to continue.";
  }

  if (
    error instanceof Error &&
    error.message === "Missing required env var: SUPABASE_SERVICE_ROLE_KEY"
  ) {
    return "Saving is not configured on the server.";
  }

  return "Unable to save progress right now. Please try again.";
}

function getCompletionFailureMessage(error: unknown): string {
  if (error instanceof AuthenticationRequiredError) {
    return "Your session has expired. Sign in again to continue.";
  }

  if (
    error instanceof Error &&
    error.message === "Missing required env var: SUPABASE_SERVICE_ROLE_KEY"
  ) {
    return "Completion is not configured on the server.";
  }

  return "Unable to complete the assessment right now. Please try again.";
}

function getIncompleteRequiredAnswersMessage(missingRequiredQuestionCount: number): string {
  return missingRequiredQuestionCount === 1
    ? "Answer the remaining required question before completing the assessment."
    : `Answer all required questions before completing the assessment. ${missingRequiredQuestionCount} required questions are still unanswered.`;
}

function isNextRedirectError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const digest = Reflect.get(error, "digest");
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

async function getProtectedAttemptForUser(userId: string, attemptId: string) {
  const candidateAttempt = await getCandidateAttemptForUser(userId, attemptId);

  if (candidateAttempt) {
    return candidateAttempt;
  }

  const organization = await getActiveOrganizationForUser(userId);

  if (!organization) {
    return null;
  }

  return getAttemptForOrganization(organization.id, attemptId);
}

async function persistAssessmentSelections(
  input: SaveAssessmentSelectionsInput,
  options: PersistAssessmentSelectionsOptions = {},
): Promise<PersistSelectionsResult> {
  if (!input.testId) {
    return { ok: false, message: "Missing test id." };
  }

  if (!isSelectionMap(input.selections)) {
    return { ok: false, message: "Invalid save payload." };
  }

  const supabase = createSupabaseAdminClient();

  const selectionEntries = Object.entries(input.selections);
  const questionIds = selectionEntries.map(([questionId]) => questionId);
  let questionsById = new Map<string, QuestionRecord>();

  if (questionIds.length > 0) {
    const { data: questionsData, error: questionsError } = await supabase
      .from("questions")
      .select("id, question_type")
      .eq("test_id", input.testId)
      .in("id", questionIds);

    if (questionsError) {
      return { ok: false, message: "Unable to validate questions." };
    }

    const questions = (questionsData ?? []) as QuestionRecord[];
    questionsById = new Map(questions.map((question) => [question.id, question]));

    if (questionIds.some((questionId) => !questionsById.has(questionId))) {
      return {
        ok: false,
        message: "One or more questions are invalid for this test.",
      };
    }
  }

  const unsupportedQuestion = questionIds.find((questionId) => {
    const question = questionsById.get(questionId);
    return question ? !isSupportedQuestionType(question.question_type) : false;
  });

  if (unsupportedQuestion) {
    return {
      ok: false,
      message:
        "This assessment contains question types that are not supported for saving yet.",
    };
  }

  const optionIdsToValidate = getDistinctOptionIds(
    selectionEntries.flatMap(([questionId, value]) => {
      const question = questionsById.get(questionId);

      if (!question || question.question_type === "text") {
        return [];
      }

      if (question.question_type === "single_choice") {
        return typeof value === "string" ? [value] : [];
      }

      return isStringArray(value) ? value : [];
    }),
  );

  let answerOptionsById = new Map<string, AnswerOptionRecord>();

  if (optionIdsToValidate.length > 0) {
    const { data: answerOptionsData, error: answerOptionsError } = await supabase
      .from("answer_options")
      .select("id, question_id")
      .in("id", optionIdsToValidate);

    if (answerOptionsError) {
      return { ok: false, message: "Unable to validate answer options." };
    }

    const answerOptions = (answerOptionsData ?? []) as AnswerOptionRecord[];
    answerOptionsById = new Map(answerOptions.map((option) => [option.id, option]));
  }

  for (const [questionId, value] of selectionEntries) {
    const question = questionsById.get(questionId);

    if (!question) {
      return { ok: false, message: "Question validation failed." };
    }

    if (question.question_type === "text") {
      if (typeof value !== "string") {
        return { ok: false, message: "Text responses must be saved as text." };
      }

      continue;
    }

    if (question.question_type === "single_choice") {
      if (typeof value !== "string") {
        return {
          ok: false,
          message: "Single choice responses must contain exactly one option.",
        };
      }

      if (!value) {
        continue;
      }

      const option = answerOptionsById.get(value);

      if (!option || option.question_id !== questionId) {
        return { ok: false, message: "One or more answer options are invalid." };
      }

      continue;
    }

    if (!isStringArray(value)) {
      return {
        ok: false,
        message: "Multiple choice responses must be saved as an option list.",
      };
    }

    for (const optionId of getDistinctOptionIds(value)) {
      const option = answerOptionsById.get(optionId);

      if (!option || option.question_id !== questionId) {
        return { ok: false, message: "One or more answer options are invalid." };
      }
    }
  }

  let nextAttemptId = input.attemptId;
  let protectedAttempt: AttemptRecord & { test_id: string } | null = null;

  if (options.requireProtectedOwnership && !nextAttemptId) {
    return {
      ok: false,
      message: "Protected assessment execution requires an existing attempt.",
    };
  }

  if (nextAttemptId) {
    if (options.requireProtectedOwnership) {
      const user = await requireAuthenticatedUserForAction();
      const ownedAttempt = await getProtectedAttemptForUser(user.id, nextAttemptId);

      if (!ownedAttempt || ownedAttempt.test_id !== input.testId) {
        return {
          ok: false,
          message: "This assessment attempt is not available for the current user.",
        };
      }

       protectedAttempt = ownedAttempt as AttemptRecord & { test_id: string };
    }

    let existingAttemptData: AttemptRecord | null = protectedAttempt;
    let existingAttemptError: { message: string } | null = null;

    if (!existingAttemptData) {
      const attemptLookup = await supabase
        .from("attempts")
        .select("id, status, completed_at")
        .eq("id", nextAttemptId)
        .eq("test_id", input.testId)
        .maybeSingle();

      existingAttemptData = attemptLookup.data as AttemptRecord | null;
      existingAttemptError = attemptLookup.error;
    }

    if (existingAttemptError) {
      return { ok: false, message: "Unable to validate attempt." };
    }

    if (!existingAttemptData) {
      nextAttemptId = null;
    } else {
      const attempt = existingAttemptData;

      if (attempt.status === "completed") {
        return {
          ok: false,
          message: "This assessment attempt is already completed and cannot be edited.",
        };
      }

      if (attempt.status !== "in_progress") {
        return {
          ok: false,
          message: "This assessment attempt is no longer available for editing.",
        };
      }
    }
  }

  if (!nextAttemptId) {
    if (options.requireProtectedOwnership) {
      return {
        ok: false,
        message: "Protected assessment execution requires an existing attempt.",
      };
    }

    const { data: createdAttemptData, error: createAttemptError } = await supabase
      .from("attempts")
      .insert({
        test_id: input.testId,
        locale: normalizeAssessmentLocale(input.locale),
        user_id: input.ownershipContext?.userId ?? null,
        organization_id: input.ownershipContext?.organizationId ?? null,
        participant_id: input.ownershipContext?.participantId ?? null,
      })
      .select("id")
      .single();

    if (createAttemptError || !createdAttemptData) {
      return { ok: false, message: "Unable to create attempt." };
    }

    nextAttemptId = (createdAttemptData as Pick<AttemptRecord, "id">).id;
  }

  if (!nextAttemptId) {
    return { ok: false, message: "Unable to determine attempt id." };
  }

  if (questionIds.length > 0) {
    const { error: deleteResponsesError } = await supabase
      .from("responses")
      .delete()
      .eq("attempt_id", nextAttemptId)
      .in("question_id", questionIds);

    if (deleteResponsesError) {
      return { ok: false, message: "Unable to replace saved responses." };
    }
  }

  const responseRows: ResponseInsert[] = [];
  const multipleChoiceSelectionsByQuestionId = new Map<string, string[]>();

  for (const [questionId, value] of selectionEntries) {
    const question = questionsById.get(questionId);

    if (!question) {
      continue;
    }

    if (question.question_type === "text") {
      if (typeof value !== "string" || value.length === 0) {
        continue;
      }

      responseRows.push({
        attempt_id: nextAttemptId,
        question_id: questionId,
        response_kind: "text",
        text_value: value,
      });
      continue;
    }

    if (question.question_type === "single_choice") {
      if (typeof value !== "string" || value.length === 0) {
        continue;
      }

      responseRows.push({
        attempt_id: nextAttemptId,
        question_id: questionId,
        response_kind: "single_choice",
        answer_option_id: value,
      });
      continue;
    }

    if (!isStringArray(value)) {
      continue;
    }

    const selectedOptionIds = getDistinctOptionIds(value);

    if (selectedOptionIds.length === 0) {
      continue;
    }

    responseRows.push({
      attempt_id: nextAttemptId,
      question_id: questionId,
      response_kind: "multiple_choice",
    });
    multipleChoiceSelectionsByQuestionId.set(questionId, selectedOptionIds);
  }

  if (responseRows.length > 0) {
    const { data: insertedResponsesData, error: insertResponsesError } = await supabase
      .from("responses")
      .insert(responseRows)
      .select("id, question_id, response_kind");

    if (insertResponsesError) {
      return { ok: false, message: "Unable to save responses." };
    }

    const insertedResponses = (insertedResponsesData ?? []) as InsertedResponseRecord[];
    const responseSelections: ResponseSelectionInsert[] = insertedResponses.flatMap((response) => {
      if (response.response_kind !== "multiple_choice") {
        return [];
      }

      const selectedOptionIds = multipleChoiceSelectionsByQuestionId.get(response.question_id) ?? [];

      return selectedOptionIds.map((answerOptionId) => ({
        response_id: response.id,
        question_id: response.question_id,
        answer_option_id: answerOptionId,
      }));
    });

    if (responseSelections.length > 0) {
      const { error: insertSelectionsError } = await supabase
        .from("response_selections")
        .insert(responseSelections);

      if (insertSelectionsError) {
        return { ok: false, message: "Unable to save multiple choice selections." };
      }
    }
  }

  if (options.persistAttemptCookie !== false) {
    cookies().set(ASSESSMENT_ATTEMPT_COOKIE_NAME, nextAttemptId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  return {
    ok: true,
    attemptId: nextAttemptId,
  };
}

async function getTestIdBySlug(testSlug: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tests")
    .select("id")
    .eq("slug", testSlug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve test: ${error.message}`);
  }

  return data?.id ?? null;
}

export async function saveAssessmentProgress(
  input: SaveAssessmentSelectionsInput,
): Promise<SaveAssessmentSelectionsResult> {
  try {
    const result = await persistAssessmentSelections(input);

    if (!result.ok) {
      return result;
    }

    revalidateAttemptRunPaths(result.attemptId);

    return {
      ok: true,
      attemptId: result.attemptId,
      message: "Progress saved.",
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    console.error("saveAssessmentProgress failed", error);

    return {
      ok: false,
      message: getSaveFailureMessage(error),
    };
  }
}

export async function saveProtectedAssessmentProgress(
  input: SaveAssessmentSelectionsInput,
): Promise<SaveAssessmentSelectionsResult> {
  try {
    const result = await persistAssessmentSelections(input, {
      persistAttemptCookie: false,
      requireProtectedOwnership: true,
    });

    if (!result.ok) {
      return result;
    }

    revalidateAttemptRunPaths(result.attemptId);

    return {
      ok: true,
      attemptId: result.attemptId,
      message: "Progress saved.",
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    console.error("saveProtectedAssessmentProgress failed", error);

    return {
      ok: false,
      message: getSaveFailureMessage(error),
    };
  }
}

export async function createB2BAttempt(formData: FormData) {
  const participantId = String(formData.get("participantId") ?? "").trim();
  const testSlug = String(formData.get("testSlug") ?? DEFAULT_B2B_TEST_SLUG).trim();
  const user = await requireAuthenticatedUser();

  if (!participantId) {
    redirect("/dashboard?error=missing-participant");
  }

  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    redirect("/dashboard?error=no-active-organization");
  }

  const participant = await getParticipantForOrganization(organization.id, participantId);

  if (!participant) {
    redirect("/dashboard?error=participant-not-found");
  }

  const testId = await getTestIdBySlug(testSlug);

  if (!testId) {
    redirect("/dashboard?error=test-not-found");
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attempts")
    .insert({
      test_id: testId,
      user_id: user.id,
      organization_id: organization.id,
      participant_id: participant.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createB2BAttempt failed", error);
    redirect("/dashboard?error=create-attempt-failed");
  }

  redirect(`/dashboard?success=attempt-created&attemptId=${data.id}`);
}

export async function setProtectedAttemptLocale(formData: FormData) {
  const attemptId = String(formData.get("attemptId") ?? "").trim();
  const locale = normalizeAssessmentLocale(String(formData.get("locale") ?? ""));
  const returnPath = String(formData.get("returnPath") ?? "").trim();
  const user = await requireAuthenticatedUser();

  if (!attemptId) {
    redirect("/app?error=missing-attempt");
  }

  const ownedAttempt = await getProtectedAttemptForUser(user.id, attemptId);

  if (!ownedAttempt) {
    redirect("/app?error=attempt-not-found");
  }

  if (ownedAttempt.status !== "in_progress") {
    redirect(returnPath || `/app/attempts/${attemptId}`);
  }

  const supabase = createSupabaseAdminClient();
  const { count, error: responseCountError } = await supabase
    .from("responses")
    .select("id", { count: "exact", head: true })
    .eq("attempt_id", attemptId);

  if (responseCountError) {
    console.error("setProtectedAttemptLocale response count failed", responseCountError);
    redirect(`${returnPath || `/app/attempts/${attemptId}/run`}?error=locale-update-failed`);
  }

  if ((count ?? 0) > 0) {
    redirect(`${returnPath || `/app/attempts/${attemptId}/run`}?error=locale-locked`);
  }

  const { error: updateError } = await supabase
    .from("attempts")
    .update({ locale })
    .eq("id", attemptId)
    .eq("status", "in_progress");

  if (updateError) {
    console.error("setProtectedAttemptLocale update failed", updateError);
    redirect(`${returnPath || `/app/attempts/${attemptId}/run`}?error=locale-update-failed`);
  }

  revalidateAttemptRunPaths(attemptId);

  redirect(returnPath || `/app/attempts/${attemptId}/run`);
}

export async function completeAssessmentAttempt(
  input: SaveAssessmentSelectionsInput,
): Promise<CompleteAssessmentAttemptResult> {
  try {
    const persistResult = await persistAssessmentSelections(input);

    if (!persistResult.ok) {
      return persistResult;
    }

    const completionState = await loadAssessmentCompletionState(input.testId, persistResult.attemptId);

    if (!completionState.isComplete) {
      return {
        ok: false,
        message: getIncompleteRequiredAnswersMessage(
          completionState.missingRequiredQuestionIds.length,
        ),
      };
    }

    const supabase = createSupabaseAdminClient();
    const completedAt = new Date().toISOString();
    const { data: completedAttemptData, error: completeAttemptError } = await supabase
      .from("attempts")
      .update({
        status: "completed",
        completed_at: completedAt,
      })
      .eq("id", persistResult.attemptId)
      .eq("test_id", input.testId)
      .eq("status", "in_progress")
      .select("id, status, completed_at")
      .maybeSingle();

    if (completeAttemptError) {
      return { ok: false, message: "Unable to complete attempt." };
    }

    let completedAttempt: AttemptRecord | null = completedAttemptData as AttemptRecord | null;

    if (!completedAttempt) {
      const { data: existingAttemptData, error: existingAttemptError } = await supabase
        .from("attempts")
        .select("id, status, completed_at")
        .eq("id", persistResult.attemptId)
        .eq("test_id", input.testId)
        .maybeSingle();

      if (existingAttemptError) {
        return { ok: false, message: "Unable to confirm attempt completion." };
      }

      if ((existingAttemptData as AttemptRecord | null)?.status !== "completed") {
        return { ok: false, message: "Unable to complete attempt." };
      }

      completedAttempt = existingAttemptData as AttemptRecord;
    }

    const results = await persistCompletedAssessmentResults(input.testId, persistResult.attemptId);
    const report = await persistCompletedAssessmentReport(input.testId, persistResult.attemptId);

    cookies().set(ASSESSMENT_ATTEMPT_COOKIE_NAME, persistResult.attemptId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    revalidateAttemptAllPaths(persistResult.attemptId);

    return {
      ok: true,
      attemptId: persistResult.attemptId,
      completedAt: completedAttempt.completed_at ?? completedAt,
      message: "Procjena je završena. Vaši odgovori su zaključani.",
      results,
      report,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    console.error("completeAssessmentAttempt failed", error);

    return {
      ok: false,
      message: getCompletionFailureMessage(error),
    };
  }
}

export async function completeProtectedAssessmentAttempt(
  input: SaveAssessmentSelectionsInput,
): Promise<CompleteAssessmentAttemptResult> {
  try {
    const persistResult = await persistAssessmentSelections(input, {
      persistAttemptCookie: false,
      requireProtectedOwnership: true,
    });

    if (!persistResult.ok) {
      return persistResult;
    }

    const completionState = await loadAssessmentCompletionState(input.testId, persistResult.attemptId);

    if (!completionState.isComplete) {
      return {
        ok: false,
        message: getIncompleteRequiredAnswersMessage(
          completionState.missingRequiredQuestionIds.length,
        ),
      };
    }

    const supabase = createSupabaseAdminClient();
    const completedAt = new Date().toISOString();
    const { data: completedAttemptData, error: completeAttemptError } = await supabase
      .from("attempts")
      .update({
        status: "completed",
        completed_at: completedAt,
      })
      .eq("id", persistResult.attemptId)
      .eq("test_id", input.testId)
      .eq("status", "in_progress")
      .select("id, status, completed_at")
      .maybeSingle();

    if (completeAttemptError) {
      return { ok: false, message: "Unable to complete attempt." };
    }

    let completedAttempt: AttemptRecord | null = completedAttemptData as AttemptRecord | null;

    if (!completedAttempt) {
      const { data: existingAttemptData, error: existingAttemptError } = await supabase
        .from("attempts")
        .select("id, status, completed_at")
        .eq("id", persistResult.attemptId)
        .eq("test_id", input.testId)
        .maybeSingle();

      if (existingAttemptError) {
        return { ok: false, message: "Unable to confirm attempt completion." };
      }

      if ((existingAttemptData as AttemptRecord | null)?.status !== "completed") {
        return { ok: false, message: "Unable to complete attempt." };
      }

      completedAttempt = existingAttemptData as AttemptRecord;
    }

    const results = await persistCompletedAssessmentResults(input.testId, persistResult.attemptId);
    await enqueueCompletedAssessmentReports(persistResult.attemptId);
    const report: CompletedAssessmentReportState = {
      status: "queued",
      generatorType: null,
      generatedAt: new Date().toISOString(),
      completedAt: null,
    };

    revalidateAttemptAllPaths(persistResult.attemptId);

    return {
      ok: true,
      attemptId: persistResult.attemptId,
      completedAt: completedAttempt.completed_at ?? completedAt,
      message: "Procjena je završena. Vaši odgovori su zaključani.",
      results,
      report,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    console.error("completeProtectedAssessmentAttempt failed", error);

    return {
      ok: false,
      message: getCompletionFailureMessage(error),
    };
  }
}
