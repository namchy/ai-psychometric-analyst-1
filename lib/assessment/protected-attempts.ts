import "server-only";

import { getAssessmentDisplayName } from "@/lib/assessment/display";
import type { AssessmentLocale } from "@/lib/assessment/locale";
import type {
  CompletedAssessmentReportSnapshot,
  CompletedAssessmentReportState,
} from "@/lib/assessment/reports";
import {
  getAnswerOptionsForQuestions,
  getAssessmentResumeState,
  getCompletedAssessmentReportState,
  getCompletedAssessmentResults,
  getQuestionsForTest,
} from "@/lib/assessment/tests";

type ProtectedAttemptLike = {
  id: string;
  test_id: string;
  locale: AssessmentLocale;
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

export type ProtectedAttemptReportState =
  | { status: "queued" }
  | { status: "processing"; startedAt?: string | null }
  | { status: "failed"; failureCode?: string | null; failureReason?: string | null }
  | { status: "ready"; report: CompletedAssessmentReportSnapshot };

function normalizeProtectedAttemptReportState(
  reportState: CompletedAssessmentReportState | null,
): ProtectedAttemptReportState {
  if (!reportState) {
    return { status: "queued" };
  }

  if (reportState.status === "ready") {
    return {
      status: "ready",
      report: reportState.report,
    };
  }

  if (reportState.status === "processing") {
    return {
      status: "processing",
      startedAt: reportState.generatedAt,
    };
  }

  if (reportState.status === "queued") {
    return { status: "queued" };
  }

  if (reportState.status === "failed" || reportState.status === "unavailable") {
    return {
      status: "failed",
      failureCode: reportState.failureCode,
      failureReason: reportState.failureReason,
    };
  }

  return {
    status: "failed",
    failureCode: null,
    failureReason: null,
  };
}

export async function loadProtectedAttemptRunPageData(attempt: ProtectedAttemptLike) {
  const questions = await getQuestionsForTest(attempt.test_id, attempt.locale);

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
      reportState: { status: "queued" } satisfies ProtectedAttemptReportState,
      assessmentName: getAssessmentDisplayName({
        name: attempt.tests?.name,
        slug: attempt.tests?.slug,
      }),
      participantName: attempt.participants?.full_name ?? null,
    };
  }

  const [answerOptionsByQuestionId, resumeState, results, reportState] = await Promise.all([
    getAnswerOptionsForQuestions(
      questions.map((question) => question.id),
      attempt.locale,
    ),
    getAssessmentResumeState(attempt.test_id, attempt.id),
    getCompletedAssessmentResults(attempt.test_id, attempt.id),
    getCompletedAssessmentReportState(attempt.test_id, attempt.id),
  ]);

  return {
    questions,
    answerOptionsByQuestionId,
    resumeState,
    results,
    report: reportState,
    reportState: normalizeProtectedAttemptReportState(reportState),
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
  const [results, reportState] = await Promise.all([
    getCompletedAssessmentResults(attempt.test_id, attempt.id),
    getCompletedAssessmentReportState(attempt.test_id, attempt.id),
  ]);

  return {
    results,
    report: reportState,
    reportState: normalizeProtectedAttemptReportState(reportState),
  };
}
