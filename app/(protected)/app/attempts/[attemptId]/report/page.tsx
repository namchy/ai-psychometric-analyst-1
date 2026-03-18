import { notFound, redirect } from "next/navigation";
import { CompletedAssessmentSummary } from "@/components/assessment/completed-assessment-summary";
import { loadProtectedAttemptReportPageData } from "@/lib/assessment/protected-attempts";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getCandidateAttemptForUser } from "@/lib/candidate/attempts";

type CandidateAttemptReportPageProps = {
  params: {
    attemptId: string;
  };
};

export const dynamic = "force-dynamic";

export default async function CandidateAttemptReportPage({
  params,
}: CandidateAttemptReportPageProps) {
  const user = await requireAuthenticatedUser();
  const attempt = await getCandidateAttemptForUser(user.id, params.attemptId);

  if (!attempt) {
    notFound();
  }

  if (attempt.status !== "completed") {
    redirect(
      attempt.lifecycle === "in_progress"
        ? `/app/attempts/${attempt.id}/run`
        : `/app/attempts/${attempt.id}`,
    );
  }

  const reportPageData = await loadProtectedAttemptReportPageData(attempt);

  return (
    <main className="attempt-results-page stack-md">
      <section className="attempt-results-page__content">
        <CompletedAssessmentSummary
          completedAt={attempt.completed_at}
          organizationName={attempt.organizations?.name ?? null}
          participantName={attempt.participants?.full_name ?? null}
          testName={attempt.tests?.name ?? attempt.tests?.slug ?? null}
          results={reportPageData.results}
          reportState={reportPageData.report}
        />
      </section>
    </main>
  );
}
