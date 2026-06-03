import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CompletedAssessmentSummary } from "@/components/assessment/completed-assessment-summary";
import { ProtectedReportAutoRefresh } from "@/components/assessment/protected-report-auto-refresh";
import { getAssessmentDisplayName } from "@/lib/assessment/display";
import { loadProtectedAttemptReportPageData } from "@/lib/assessment/protected-attempts";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getGenericCandidateAttemptForUser } from "@/lib/candidate/attempts";

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
  const attempt = await getGenericCandidateAttemptForUser(user.id, params.attemptId);

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
      <section className="attempt-results-page__content">
        <div className="mb-3">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-slate-700 transition-colors duration-200 hover:text-slate-900"
          >
            <span aria-hidden="true">←</span>
            <span>Nazad na dashboard</span>
          </Link>
        </div>
        <ProtectedReportAutoRefresh status={reportPageData.reportState.status} />
        <CompletedAssessmentSummary
          completedAt={attempt.completed_at}
          locale={attempt.locale}
          organizationName={attempt.organizations?.name ?? null}
          participantName={attempt.participants?.full_name ?? null}
          testSlug={attempt.tests?.slug ?? null}
          testName={getAssessmentDisplayName(attempt.tests)}
          results={reportPageData.results}
          reportState={reportPageData.report}
        />
      </section>
    </main>
  );
}
