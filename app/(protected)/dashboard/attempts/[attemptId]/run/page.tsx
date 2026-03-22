import { notFound, redirect } from "next/navigation";
import { AssessmentForm } from "@/components/assessment/assessment-form";
import { loadProtectedAttemptRunPageData } from "@/lib/assessment/protected-attempts";
import {
  getActiveOrganizationForUser,
  getAttemptForOrganization,
} from "@/lib/b2b/organizations";
import { requireAuthenticatedUser } from "@/lib/auth/session";

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

  const runPageData = await loadProtectedAttemptRunPageData(attempt);

  if (runPageData.questions.length === 0) {
    return (
      <main className="stack-md">
        <section className="card stack-sm">
          <h1>{attempt.tests?.name ?? attempt.tests?.slug ?? "Assessment"}</h1>
          <p>No questions are available for this test yet.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="assessment-run-page stack-md">
      <section className="assessment-run-shell">
        <AssessmentForm
          executionMode="protected"
          layoutMode="step"
          completionRedirectPath={`/dashboard/attempts/${attempt.id}`}
          assessmentDisplayName={runPageData.assessmentName}
          participantDisplayName={runPageData.participantName}
          testId={attempt.test_id}
          locale={attempt.locale}
          questions={runPageData.questions}
          answerOptionsByQuestionId={runPageData.answerOptionsByQuestionId}
          initialAttemptId={runPageData.resumeState.attemptId}
          initialAttemptStatus={runPageData.resumeState.attemptStatus}
          initialCompletedAt={runPageData.resumeState.completedAt}
          initialSelections={runPageData.resumeState.selections}
          initialResults={runPageData.results}
          initialReport={runPageData.report}
        />
      </section>
    </main>
  );
}
