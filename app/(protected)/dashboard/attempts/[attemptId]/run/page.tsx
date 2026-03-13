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

  return (
    <main className="stack-md">
      <section className="card stack-sm">
        <div className="stack-xs">
          <h1>{attempt.tests?.name ?? "Assessment"}</h1>
          <p>
            Attempt for {attempt.participants?.full_name ?? attempt.participant_id} in{" "}
            {attempt.organizations?.name ?? organization.name}.
          </p>
          <p>Attempt ID: {attempt.id}</p>
        </div>
      </section>

      <section className="card">
        <AssessmentForm
          executionMode="protected"
          completionRedirectPath={`/dashboard/attempts/${attempt.id}`}
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
