import type {
  AnswerOption,
  AssessmentSelectionsInput,
  AttemptStatus,
  Question,
  QuestionType,
  Test,
} from "@/lib/assessment/types";
import {
  buildSelectionsFromResponses,
  type AssessmentCompletionState,
} from "@/lib/assessment/completion";
import {
  calculateCompletedAssessmentResults,
  type CompletedAssessmentResults,
} from "@/lib/assessment/scoring";
import {
  getCompletedAssessmentReport,
  getPersistedParticipantCompletedAssessmentReportState,
  type CompletedAssessmentReportState,
} from "@/lib/assessment/reports";
import {
  normalizeAssessmentLocale,
  type AssessmentLocale,
} from "@/lib/assessment/locale";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActiveTest = Pick<Test, "id" | "slug" | "name" | "description">;
export type TestQuestion = Pick<
  Question,
  "id" | "code" | "text" | "question_order" | "question_type" | "is_required"
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
  locale: AssessmentLocale;
  status: AttemptStatus;
  completed_at: string | null;
};

type QuestionLocalizationRow = {
  question_id: string;
  text: string;
};

type AnswerOptionLocalizationRow = {
  answer_option_id: string;
  label: string;
};

const LOCALIZATION_QUERY_CHUNK_SIZE = 50;

function chunkValues<T>(values: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

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
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load active test: ${error.message}`);
  }

  return data as ActiveTest | null;
}

export async function getQuestionsForTest(
  testId: string,
  locale?: AssessmentLocale | null,
): Promise<TestQuestion[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("questions")
    .select("id, code, text, question_order, question_type, is_required")
    .eq("test_id", testId)
    .eq("is_active", true)
    .order("question_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load questions: ${error.message}`);
  }

  const questions = (data ?? []) as TestQuestion[];

  if (questions.length === 0 || !locale) {
    return questions;
  }

  const localizationChunks = await Promise.all(
    chunkValues(
      questions.map((question) => question.id),
      LOCALIZATION_QUERY_CHUNK_SIZE,
    ).map(async (questionIdsChunk) => {
      const { data: localizationData, error: localizationError } = await supabase
        .from("question_localizations")
        .select("question_id, text")
        .eq("locale", normalizeAssessmentLocale(locale))
        .in("question_id", questionIdsChunk);

      if (localizationError) {
        throw new Error(`Failed to load question localizations: ${localizationError.message}`);
      }

      return (localizationData ?? []) as QuestionLocalizationRow[];
    }),
  );

  const localizationData = localizationChunks.flat();

  if (localizationData.length === 0) {
    return questions;
  }

  const localizedTextByQuestionId = new Map(
    localizationData.map((entry) => [entry.question_id, entry.text]),
  );

  return questions.map((question) => ({
    ...question,
    text: localizedTextByQuestionId.get(question.id) ?? question.text,
  }));
}

export async function getAnswerOptionsForQuestions(
  questionIds: string[],
  locale?: AssessmentLocale | null,
): Promise<Record<string, TestAnswerOption[]>> {
  if (questionIds.length === 0) {
    return {};
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("answer_options")
    .select("id, question_id, label, option_order")
    .in("question_id", questionIds)
    .order("option_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load answer options: ${error.message}`);
  }

  const options = (data ?? []) as TestAnswerOption[];

  if (options.length > 0 && locale) {
    const localizationChunks = await Promise.all(
      chunkValues(
        options.map((option) => option.id),
        LOCALIZATION_QUERY_CHUNK_SIZE,
      ).map(async (optionIdsChunk) => {
        const { data: localizationData, error: localizationError } = await supabase
          .from("answer_option_localizations")
          .select("answer_option_id, label")
          .eq("locale", normalizeAssessmentLocale(locale))
          .in("answer_option_id", optionIdsChunk);

        if (localizationError) {
          throw new Error(
            `Failed to load answer option localizations: ${localizationError.message}`,
          );
        }

        return (localizationData ?? []) as AnswerOptionLocalizationRow[];
      }),
    );

    const localizedLabelByOptionId = new Map(
      localizationChunks.flat().map((entry) => [entry.answer_option_id, entry.label]),
    );

    for (const option of options) {
      option.label = localizedLabelByOptionId.get(option.id) ?? option.label;
    }
  }

  return options.reduce<Record<string, TestAnswerOption[]>>(
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
    .select("id, locale, status, completed_at")
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

  const resumeAttempt = attempt as ResumeAttemptRecord;

  return {
    attemptId: resumeAttempt.id,
    attemptStatus: resumeAttempt.status,
    completedAt: resumeAttempt.completed_at,
    selections: buildSelectionsFromResponses((responsesData ?? []) as ResumeResponseRecord[]),
  };
}

export async function getCompletedAssessmentResults(
  testId: string,
  attemptId: string | null,
): Promise<CompletedAssessmentResults | null> {
  if (!attemptId) {
    return null;
  }

  return calculateCompletedAssessmentResults(testId, attemptId);
}

export async function getCompletedAssessmentReportSnapshot(
  testId: string,
  attemptId: string | null,
): Promise<CompletedAssessmentReportState | null> {
  return getCompletedAssessmentReport(testId, attemptId);
}

export async function getCompletedAssessmentReportState(
  testId: string,
  attemptId: string | null,
): Promise<CompletedAssessmentReportState | null> {
  void testId;
  return getPersistedParticipantCompletedAssessmentReportState(attemptId);
}
