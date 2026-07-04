import {
  buildSelectionsFromResponses,
  getAssessmentCompletionState,
  type AssessmentCompletionState,
  type CompletionQuestion,
} from "@/lib/assessment/completion";
import { getAssessmentQuestionRendererType } from "@/lib/assessment/test-render-types";
import type { ResponseKind } from "@/lib/assessment/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CompletionResponseRecord = {
  question_id: string;
  response_kind: ResponseKind;
  answer_option_id: string | null;
  text_value: string | null;
  response_selections: Array<{
    answer_option_id: string;
  }> | null;
};

export async function loadAssessmentCompletionState(
  testId: string,
  attemptId: string,
): Promise<AssessmentCompletionState> {
  const supabase = createSupabaseAdminClient();
  const { data: questionsData, error: questionsError } = await supabase
    .from("questions")
    .select("id, code, text, question_type, is_required")
    .eq("test_id", testId)
    .eq("is_active", true)
    .order("question_order", { ascending: true });

  if (questionsError) {
    throw new Error(
      `Failed to load questions for completion validation: ${questionsError.message}`,
    );
  }

  const { data: responsesData, error: responsesError } = await supabase
    .from("responses")
    .select(
      "question_id, response_kind, answer_option_id, text_value, response_selections(answer_option_id)",
    )
    .eq("attempt_id", attemptId);

  if (responsesError) {
    throw new Error(
      `Failed to load responses for completion validation: ${responsesError.message}`,
    );
  }

  return getAssessmentCompletionState(
    ((questionsData ?? []) as Array<CompletionQuestion & { code: string }>).map((question) => ({
      ...question,
      renderer_type: getAssessmentQuestionRendererType(question),
    })),
    buildSelectionsFromResponses((responsesData ?? []) as CompletionResponseRecord[]),
  );
}
