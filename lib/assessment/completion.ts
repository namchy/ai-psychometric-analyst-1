import type {
  AssessmentSelectionsInput,
  AssessmentSelectionValue,
  QuestionType,
} from "@/lib/assessment/types";

type CompletionResponseRecord = {
  question_id: string;
  response_kind: QuestionType;
  answer_option_id: string | null;
  text_value: string | null;
  response_selections: Array<{
    answer_option_id: string;
  }> | null;
};

export type CompletionQuestion = {
  id: string;
  text: string;
  question_type: QuestionType;
  is_required: boolean;
};

export type AssessmentCompletionState = {
  requiredQuestionCount: number;
  answeredRequiredQuestionCount: number;
  missingRequiredQuestionIds: string[];
  missingRequiredQuestionTexts: string[];
  isComplete: boolean;
};

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

export function isQuestionAnswered(
  questionType: QuestionType,
  selection: AssessmentSelectionValue | undefined,
): boolean {
  if (questionType === "text") {
    return typeof selection === "string" && isNonEmptyString(selection);
  }

  if (questionType === "single_choice") {
    return typeof selection === "string" && selection.length > 0;
  }

  return Array.isArray(selection) && selection.some((optionId) => optionId.length > 0);
}

export function getAssessmentCompletionState(
  questions: CompletionQuestion[],
  selections: AssessmentSelectionsInput,
): AssessmentCompletionState {
  const requiredQuestions = questions.filter((question) => question.is_required);
  const missingRequiredQuestions = requiredQuestions.filter(
    (question) => !isQuestionAnswered(question.question_type, selections[question.id]),
  );

  return {
    requiredQuestionCount: requiredQuestions.length,
    answeredRequiredQuestionCount: requiredQuestions.length - missingRequiredQuestions.length,
    missingRequiredQuestionIds: missingRequiredQuestions.map((question) => question.id),
    missingRequiredQuestionTexts: missingRequiredQuestions.map((question) => question.text),
    isComplete: missingRequiredQuestions.length === 0,
  };
}

export function buildSelectionsFromResponses(
  responses: CompletionResponseRecord[],
): AssessmentSelectionsInput {
  return responses.reduce<AssessmentSelectionsInput>((state, response) => {
    if (response.response_kind === "text") {
      if (response.text_value && isNonEmptyString(response.text_value)) {
        state[response.question_id] = response.text_value;
      }

      return state;
    }

    if (response.response_kind === "single_choice") {
      if (response.answer_option_id) {
        state[response.question_id] = response.answer_option_id;
      }

      return state;
    }

    const selectedOptionIds = (response.response_selections ?? []).map(
      (selection) => selection.answer_option_id,
    );

    if (selectedOptionIds.length > 0) {
      state[response.question_id] = selectedOptionIds;
    }

    return state;
  }, {});
}
