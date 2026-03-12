import type {
  AnswerOption,
  AssessmentSelectionsInput,
  AttemptStatus,
  Question,
  QuestionType,
  Test,
} from "@/lib/assessment/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActiveTest = Pick<Test, "id" | "slug" | "name" | "description">;
export type TestQuestion = Pick<
  Question,
  "id" | "code" | "text" | "question_order" | "question_type"
>;
export type TestAnswerOption = Pick<
  AnswerOption,
  "id" | "question_id" | "label" | "option_order"
>;
export const ASSESSMENT_ATTEMPT_COOKIE_NAME = "assessment_attempt_id";

type ResumeResponseRecord = {
  question_id: string;
  response_kind: QuestionType;
  answer_option_id: string | null;
  text_value: string | null;
  response_selections: Array<{
    answer_option_id: string;
  }> | null;
};

type ResumeAttemptRecord = {
  id: string;
  status: AttemptStatus;
  completed_at: string | null;
};

export type AssessmentResumeState = {
  attemptId: string | null;
  attemptStatus: AttemptStatus | null;
  completedAt: string | null;
  selections: AssessmentSelectionsInput;
};

export async function getActiveTest(): Promise<ActiveTest | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tests")
    .select("id, slug, name, description")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load active test: ${error.message}`);
  }

  return data as ActiveTest | null;
}

export async function getQuestionsForTest(testId: string): Promise<TestQuestion[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("questions")
    .select("id, code, text, question_order, question_type")
    .eq("test_id", testId)
    .order("question_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load questions: ${error.message}`);
  }

  return (data ?? []) as TestQuestion[];
}

export async function getAnswerOptionsForQuestions(
  questionIds: string[],
): Promise<Record<string, TestAnswerOption[]>> {
  if (questionIds.length === 0) {
    return {};
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("answer_options")
    .select("id, question_id, label, option_order")
    .in("question_id", questionIds)
    .order("option_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load answer options: ${error.message}`);
  }

  return ((data ?? []) as TestAnswerOption[]).reduce<Record<string, TestAnswerOption[]>>(
    (groupedOptions, option) => {
      const questionOptions = groupedOptions[option.question_id] ?? [];
      questionOptions.push(option);
      groupedOptions[option.question_id] = questionOptions;
      return groupedOptions;
    },
    {},
  );
}

export async function getAssessmentResumeState(
  testId: string,
  attemptId: string | undefined,
): Promise<AssessmentResumeState> {
  if (!attemptId) {
    return {
      attemptId: null,
      attemptStatus: null,
      completedAt: null,
      selections: {},
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: attempt, error: attemptError } = await supabase
    .from("attempts")
    .select("id, status, completed_at")
    .eq("id", attemptId)
    .eq("test_id", testId)
    .maybeSingle();

  if (attemptError) {
    throw new Error(`Failed to load attempt: ${attemptError.message}`);
  }

  if (!attempt) {
    return {
      attemptId: null,
      attemptStatus: null,
      completedAt: null,
      selections: {},
    };
  }

  const { data: responsesData, error: responsesError } = await supabase
    .from("responses")
    .select(
      "question_id, response_kind, answer_option_id, text_value, response_selections(answer_option_id)",
    )
    .eq("attempt_id", attemptId);

  if (responsesError) {
    throw new Error(`Failed to load responses: ${responsesError.message}`);
  }

  const responses = (responsesData ?? []) as ResumeResponseRecord[];
  const selections = responses.reduce<AssessmentSelectionsInput>((state, response) => {
    if (response.response_kind === "text") {
      if (response.text_value) {
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

  const resumeAttempt = attempt as ResumeAttemptRecord;

  return {
    attemptId: resumeAttempt.id,
    attemptStatus: resumeAttempt.status,
    completedAt: resumeAttempt.completed_at,
    selections,
  };
}
