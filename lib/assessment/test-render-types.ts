import type { AnswerOption, Question } from "@/lib/assessment/types";

export type AssessmentQuestionRendererType =
  | "text_choice"
  | "image_choice"
  | "numeric_input"
  | "text_input";

export type TestQuestion = Pick<
  Question,
  | "id"
  | "code"
  | "text"
  | "question_order"
  | "question_type"
  | "is_required"
  | "stimulus_image_path"
  | "stimulus_secondary_image_path"
> & {
  renderer_type: AssessmentQuestionRendererType;
};

export type TestAnswerOption = Pick<
  AnswerOption,
  "id" | "question_id" | "label" | "value" | "option_order" | "image_path"
>;

export function getAssessmentQuestionRendererType(
  question: Pick<Question, "code" | "question_type"> &
    Partial<Pick<Question, "stimulus_image_path" | "stimulus_secondary_image_path">>,
): AssessmentQuestionRendererType {
  if (question.question_type === "text") {
    return question.code.startsWith("NZ") ? "numeric_input" : "text_input";
  }

  if (question.stimulus_image_path || question.stimulus_secondary_image_path) {
    return "image_choice";
  }

  return "text_choice";
}
