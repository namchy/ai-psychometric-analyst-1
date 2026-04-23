import { notFound, redirect } from "next/navigation";
import { CompletedAssessmentSummary } from "@/components/assessment/completed-assessment-summary";
import { ProtectedReportAutoRefresh } from "@/components/assessment/protected-report-auto-refresh";
import { ReportBackButton } from "./report-back-button";
import { getAssessmentDisplayName } from "@/lib/assessment/display";
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
    <main className="attempt-results-page stack-md mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <ReportBackButton />
      </div>
      <section className="attempt-results-page__content">
        <ProtectedReportAutoRefresh status={reportPageData.reportState.status} />
        <CompletedAssessmentSummary
          completedAt={attempt.completed_at}
          locale={attempt.locale}
          organizationName={attempt.organizations?.name ?? null}
          participantName={attempt.participants?.full_name ?? null}
          testName={getAssessmentDisplayName(attempt.tests)}
          results={reportPageData.results}
          reportState={reportPageData.report}
        />
      </section>
    </main>
  );
}
