import type { AssessmentLocale } from "@/lib/assessment/locale";

export type TestCategory = "personality" | "behavioral" | "cognitive";
export type TestStatus = "draft" | "active" | "archived";
export type ScoringMethod = "likert_sum" | "correct_answers" | "weighted_correct";

export type QuestionType = "single_choice" | "multiple_choice" | "text";
export type Difficulty = "easy" | "medium" | "hard";
export type AttemptStatus = "in_progress" | "completed" | "abandoned";

export type JsonObject = Record<string, unknown>;

export type Test = {
  id: string;
  slug: string;
  name: string;
  category: TestCategory;
  description: string | null;
  status: TestStatus;
  scoring_method: ScoringMethod;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Question = {
  id: string;
  test_id: string;
  code: string;
  text: string;
  help_text: string | null;
  dimension: string;
  question_type: QuestionType;
  question_order: number;
  reverse_scored: boolean;
  difficulty: Difficulty | null;
  weight: number;
  is_required: boolean;
  is_active: boolean;
  stimulus_image_path: string | null;
  stimulus_secondary_image_path: string | null;
  created_at: string;
  updated_at: string;
};

export type AnswerOption = {
  id: string;
  question_id: string;
  code: string | null;
  label: string;
  value: number | null;
  option_order: number;
  is_correct: boolean | null;
  image_path: string | null;
  created_at: string;
};

export type Attempt = {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  participant_id: string | null;
  test_id: string;
  locale: AssessmentLocale;
  status: AttemptStatus;
  started_at: string;
  scored_started_at: string | null;
  completed_at: string | null;
  total_time_seconds: number | null;
  metadata: JsonObject;
};

export type Response = {
  id: string;
  attempt_id: string;
  question_id: string;
  response_kind: QuestionType;
  answer_option_id: string | null;
  raw_value: number | null;
  scored_value: number | null;
  text_value: string | null;
  answered_at: string;
};

export type ResponseSelection = {
  response_id: string;
  question_id: string;
  answer_option_id: string;
  created_at: string;
};

export type AssessmentSelectionValue = string | string[];
export type AssessmentSelectionsInput = Record<string, AssessmentSelectionValue>;

export type AttemptOwnershipContext = {
  userId?: string | null;
  organizationId?: string | null;
  participantId?: string | null;
};
