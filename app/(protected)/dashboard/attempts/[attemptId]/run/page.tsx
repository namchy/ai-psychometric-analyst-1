import { notFound, redirect } from "next/navigation";
import { AssessmentForm } from "@/components/assessment/assessment-form";
import {
  getActiveOrganizationForUser,
  getAttemptForOrganization,
} from "@/lib/b2b/organizations";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import {
  getAnswerOptionsForQuestions,
  getAssessmentResumeState,
  getCompletedAssessmentReportSnapshot,
  getCompletedAssessmentResults,
  getQuestionsForTest,
} from "@/lib/assessment/tests";
import { getAssessmentDisplayName } from "@/lib/assessment/display";

type ProtectedAttemptRunPageProps = {
  params: {
    attemptId: string;
  };
};

export const dynamic = "force-dynamic";

export default async function ProtectedAttemptRunPage({
  params,
}: ProtectedAttemptRunPageProps) {
  const user = await requireAuthenticatedUser();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    notFound();
  }

  const attempt = await getAttemptForOrganization(organization.id, params.attemptId);

  if (!attempt) {
    notFound();
  }

  if (attempt.status === "completed") {
    redirect(`/dashboard/attempts/${attempt.id}`);
  }

  const questions = await getQuestionsForTest(attempt.test_id);

  if (questions.length === 0) {
    return (
      <main className="stack-md">
        <section className="card stack-sm">
          <h1>{attempt.tests?.name ?? attempt.tests?.slug ?? "Assessment"}</h1>
          <p>No questions are available for this test yet.</p>
        </section>
      </main>
    );
  }

  const answerOptionsByQuestionId = await getAnswerOptionsForQuestions(
    questions.map((question) => question.id),
  );
  const resumeState = await getAssessmentResumeState(attempt.test_id, attempt.id);
  const results = await getCompletedAssessmentResults(attempt.test_id, attempt.id);
  const report = await getCompletedAssessmentReportSnapshot(attempt.test_id, attempt.id);
  const assessmentName = getAssessmentDisplayName({
    name: attempt.tests?.name,
    slug: attempt.tests?.slug,
  });
  const participantName = attempt.participants?.full_name ?? null;

  return (
    <main className="assessment-run-page stack-md">
      <section className="assessment-run-shell">
        <AssessmentForm
          executionMode="protected"
          layoutMode="step"
          completionRedirectPath={`/dashboard/attempts/${attempt.id}`}
          assessmentDisplayName={assessmentName}
          participantDisplayName={participantName}
          testId={attempt.test_id}
          questions={questions}
          answerOptionsByQuestionId={answerOptionsByQuestionId}
          initialAttemptId={resumeState.attemptId}
          initialAttemptStatus={resumeState.attemptStatus}
          initialCompletedAt={resumeState.completedAt}
          initialSelections={resumeState.selections}
          initialResults={results}
          initialReport={report}
        />
      </section>
    </main>
  );
}
