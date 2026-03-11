import type { AnswerOption, Question, Test } from "@/lib/assessment/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActiveTest = Pick<Test, "id" | "slug" | "name" | "description">;
export type TestQuestion = Pick<Question, "id" | "code" | "text" | "question_order" | "question_type">;
export type TestAnswerOption = Pick<AnswerOption, "id" | "question_id" | "label" | "option_order">;

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

export async function getAnswerOptionsForQuestions(questionIds: string[]): Promise<Record<string, TestAnswerOption[]>> {
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

  return ((data ?? []) as TestAnswerOption[]).reduce<Record<string, TestAnswerOption[]>>((groupedOptions, option) => {
    const questionOptions = groupedOptions[option.question_id] ?? [];
    questionOptions.push(option);
    groupedOptions[option.question_id] = questionOptions;
    return groupedOptions;
  }, {});
}
