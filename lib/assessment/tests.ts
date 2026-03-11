import type { Question, Test } from "@/lib/assessment/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActiveTest = Pick<Test, "id" | "slug" | "name" | "description">;
export type TestQuestion = Pick<Question, "id" | "code" | "text" | "question_order">;

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
    .select("id, code, text, question_order")
    .eq("test_id", testId)
    .order("question_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load questions: ${error.message}`);
  }

  return (data ?? []) as TestQuestion[];
}
