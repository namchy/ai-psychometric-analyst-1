import "server-only";

import { getAssessmentDisplayName } from "@/lib/assessment/display";
import {
  getAnswerOptionsForQuestions,
  getAssessmentResumeState,
  getCompletedAssessmentReportSnapshot,
  getCompletedAssessmentResults,
  getQuestionsForTest,
} from "@/lib/assessment/tests";

type ProtectedAttemptLike = {
  id: string;
  test_id: string;
  status: "in_progress" | "completed" | "abandoned";
  completed_at: string | null;
  tests: {
    name: string;
    slug: string;
  } | null;
  participants: {
    full_name: string;
  } | null;
};

export async function loadProtectedAttemptRunPageData(attempt: ProtectedAttemptLike) {
  const questions = await getQuestionsForTest(attempt.test_id);

  if (questions.length === 0) {
    return {
      questions,
      answerOptionsByQuestionId: {},
      resumeState: {
        attemptId: attempt.id,
        attemptStatus: attempt.status ?? null,
        completedAt: attempt.completed_at ?? null,
        selections: {},
      },
      results: null,
      report: null,
      assessmentName: getAssessmentDisplayName({
        name: attempt.tests?.name,
        slug: attempt.tests?.slug,
      }),
      participantName: attempt.participants?.full_name ?? null,
    };
  }

  const [answerOptionsByQuestionId, resumeState, results, report] = await Promise.all([
    getAnswerOptionsForQuestions(questions.map((question) => question.id)),
    getAssessmentResumeState(attempt.test_id, attempt.id),
    getCompletedAssessmentResults(attempt.test_id, attempt.id),
    getCompletedAssessmentReportSnapshot(attempt.test_id, attempt.id),
  ]);

  return {
    questions,
    answerOptionsByQuestionId,
    resumeState,
    results,
    report,
    assessmentName: getAssessmentDisplayName({
      name: attempt.tests?.name,
      slug: attempt.tests?.slug,
    }),
    participantName: attempt.participants?.full_name ?? null,
  };
}

export async function loadProtectedAttemptReportPageData(
  attempt: Pick<ProtectedAttemptLike, "id" | "test_id">,
) {
  const [results, report] = await Promise.all([
    getCompletedAssessmentResults(attempt.test_id, attempt.id),
    getCompletedAssessmentReportSnapshot(attempt.test_id, attempt.id),
  ]);

  return {
    results,
    report,
  };
}
