"use server";

import type { QuestionType } from "@/lib/assessment/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SaveAssessmentSelectionsInput = {
  attemptId: string | null;
  testId: string;
  selections: Record<string, string>;
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
  answer_option_id?: string | null;
  text_value?: string | null;
};

function isSelectionMap(value: SaveAssessmentSelectionsInput["selections"]): boolean {
  return Object.entries(value).every(
    ([questionId, selection]) => !!questionId && typeof selection === "string",
  );
}

function isSupportedQuestionType(questionType: QuestionType): boolean {
  return questionType === "single_choice" || questionType === "text";
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
      questionsById = new Map(
        questions.map((question) => [question.id, question]),
      );

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

    const singleChoiceOptionIds = selectionEntries.flatMap(([questionId, value]) => {
      const question = questionsById.get(questionId);

      if (!question || question.question_type !== "single_choice" || !value) {
        return [];
      }

      return [value];
    });

    let answerOptionsById = new Map<string, AnswerOptionRecord>();

    if (singleChoiceOptionIds.length > 0) {
      const { data: answerOptionsData, error: answerOptionsError } = await supabase
        .from("answer_options")
        .select("id, question_id")
        .in("id", singleChoiceOptionIds);

      if (answerOptionsError) {
        return { ok: false, message: "Unable to validate answer options." };
      }

      const answerOptions = (answerOptionsData ?? []) as AnswerOptionRecord[];
      answerOptionsById = new Map(
        answerOptions.map((option) => [option.id, option]),
      );
    }

    for (const [questionId, value] of selectionEntries) {
      const question = questionsById.get(questionId);

      if (!question) {
        return { ok: false, message: "Question validation failed." };
      }

      if (question.question_type === "text") {
        continue;
      }

      if (!value) {
        continue;
      }

      const option = answerOptionsById.get(value);

      if (!option || option.question_id !== questionId) {
        return { ok: false, message: "One or more answer options are invalid." };
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

    for (const [questionId, value] of selectionEntries) {
      const question = questionsById.get(questionId);

      if (!question || value.length === 0) {
        continue;
      }

      if (question.question_type === "text") {
        responseRows.push({
          attempt_id: nextAttemptId,
          question_id: questionId,
          text_value: value,
        });
        continue;
      }

      responseRows.push({
        attempt_id: nextAttemptId,
        question_id: questionId,
        answer_option_id: value,
      });
    }

    if (responseRows.length > 0) {
      const { error: insertResponsesError } = await supabase
        .from("responses")
        .insert(responseRows);

      if (insertResponsesError) {
        return { ok: false, message: "Unable to save responses." };
      }
    }

    return {
      ok: true,
      attemptId: nextAttemptId,
      message: "Progress saved.",
    };
  } catch {
    return {
      ok: false,
      message: "Unable to save progress right now. Please try again.",
    };
  }
}
