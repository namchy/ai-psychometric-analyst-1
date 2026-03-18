import { notFound, redirect } from "next/navigation";
import { AssessmentForm } from "@/components/assessment/assessment-form";
import { loadProtectedAttemptRunPageData } from "@/lib/assessment/protected-attempts";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getCandidateAttemptForUser } from "@/lib/candidate/attempts";

type CandidateAttemptRunPageProps = {
  params: {
    attemptId: string;
  };
};

export const dynamic = "force-dynamic";

export default async function CandidateAttemptRunPage({
  params,
}: CandidateAttemptRunPageProps) {
  const user = await requireAuthenticatedUser();
  const attempt = await getCandidateAttemptForUser(user.id, params.attemptId);

  if (!attempt) {
    notFound();
  }

  if (attempt.status === "completed") {
    redirect(`/app/attempts/${attempt.id}/report`);
  }

  if (attempt.status === "abandoned") {
    redirect(`/app/attempts/${attempt.id}`);
  }

  const runPageData = await loadProtectedAttemptRunPageData(attempt);

  if (runPageData.questions.length === 0) {
    return (
      <main className="stack-md">
        <section className="card stack-sm">
          <h1>{attempt.tests?.name ?? attempt.tests?.slug ?? "Procjena"}</h1>
          <p>Pitanja za ovu procjenu trenutno nisu dostupna.</p>
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
          completionRedirectPath={`/app/attempts/${attempt.id}/report`}
          assessmentDisplayName={runPageData.assessmentName}
          participantDisplayName={runPageData.participantName}
          testId={attempt.test_id}
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
