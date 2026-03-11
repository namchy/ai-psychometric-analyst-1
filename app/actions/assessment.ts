"use server";

import type {
  AssessmentSelectionsInput,
  AssessmentSelectionValue,
  QuestionType,
} from "@/lib/assessment/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SaveAssessmentSelectionsInput = {
  attemptId: string | null;
  testId: string;
  selections: AssessmentSelectionsInput;
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
  if (
    error instanceof Error &&
    error.message === "Missing required env var: SUPABASE_SERVICE_ROLE_KEY"
  ) {
    return "Saving is not configured on the server.";
  }

  return "Unable to save progress right now. Please try again.";
}

export async function saveAssessmentProgress(
  input: SaveAssessmentSelectionsInput,
): Promise<SaveAssessmentSelectionsResult> {
  try {
    if (!input.testId) {
      return { ok: false, message: "Missing test id." };
    }

    if (!isSelectionMap(input.selections)) {
      return { ok: false, message: "Invalid save payload." };
    }

    const supabase = createSupabaseAdminClient();

    const { data: existingTest, error: testError } = await supabase
      .from("tests")
      .select("id")
      .eq("id", input.testId)
      .maybeSingle();

    if (testError) {
      return { ok: false, message: "Unable to validate test." };
    }

    if (!existingTest) {
      return { ok: false, message: "Test not found." };
    }

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

    if (nextAttemptId) {
      const { data: existingAttemptData, error: existingAttemptError } = await supabase
        .from("attempts")
        .select("id")
        .eq("id", nextAttemptId)
        .eq("test_id", input.testId)
        .maybeSingle();

      if (existingAttemptError) {
        return { ok: false, message: "Unable to validate attempt." };
      }

      if (!existingAttemptData) {
        nextAttemptId = null;
      }
    }

    if (!nextAttemptId) {
      const { data: createdAttemptData, error: createAttemptError } = await supabase
        .from("attempts")
        .insert({ test_id: input.testId })
        .select("id")
        .single();

      if (createAttemptError || !createdAttemptData) {
        return { ok: false, message: "Unable to create attempt." };
      }

      nextAttemptId = (createdAttemptData as AttemptRecord).id;
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
      const responseSelections: ResponseSelectionInsert[] = insertedResponses.flatMap(
        (response) => {
          if (response.response_kind !== "multiple_choice") {
            return [];
          }

          const selectedOptionIds =
            multipleChoiceSelectionsByQuestionId.get(response.question_id) ?? [];

          return selectedOptionIds.map((answerOptionId) => ({
            response_id: response.id,
            question_id: response.question_id,
            answer_option_id: answerOptionId,
          }));
        },
      );

      if (responseSelections.length > 0) {
        const { error: insertSelectionsError } = await supabase
          .from("response_selections")
          .insert(responseSelections);

        if (insertSelectionsError) {
          return { ok: false, message: "Unable to save multiple choice selections." };
        }
      }
    }

    return {
      ok: true,
      attemptId: nextAttemptId,
      message: "Progress saved.",
    };
  } catch (error) {
    console.error("saveAssessmentProgress failed", error);

    return {
      ok: false,
      message: getSaveFailureMessage(error),
    };
  }
}
