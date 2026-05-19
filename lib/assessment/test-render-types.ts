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
