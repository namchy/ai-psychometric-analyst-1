import { notFound, redirect } from "next/navigation";
import { CompletedAssessmentSummary } from "@/components/assessment/completed-assessment-summary";
import { getAssessmentDisplayName } from "@/lib/assessment/display";
import { loadProtectedHrAttemptReportPageData } from "@/lib/assessment/protected-attempts";
import {
  getActiveOrganizationForUser,
  getAttemptForOrganization,
} from "@/lib/b2b/organizations";
import { requireAuthenticatedUser } from "@/lib/auth/session";

type AttemptDetailPageProps = {
  params: {
    attemptId: string;
  };
};

export const dynamic = "force-dynamic";

export default async function AttemptDetailPage({ params }: AttemptDetailPageProps) {
  const user = await requireAuthenticatedUser();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    notFound();
  }

  const attempt = await getAttemptForOrganization(organization.id, params.attemptId);

  if (!attempt) {
    notFound();
  }

  if (attempt.status !== "completed") {
    redirect(`/dashboard/attempts/${attempt.id}/run`);
  }

  const reportPageData = await loadProtectedHrAttemptReportPageData(attempt);

  return (
    <main className="attempt-results-page stack-md mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
      <section className="attempt-results-page__content">
        {reportPageData.report?.status === "ready" ? (
          <CompletedAssessmentSummary
            completedAt={attempt.completed_at}
            locale={attempt.locale}
            organizationName={attempt.organizations?.name ?? organization.name}
            participantName={attempt.participants?.full_name ?? null}
            testName={getAssessmentDisplayName(attempt.tests)}
            results={reportPageData.results}
            reportState={reportPageData.report}
          />
        ) : (
          <section className="results-report__section results-report__status results-report__panel card stack-sm">
            <div className="results-report__section-heading">
              <h3>HR izvještaj još nije dostupan</h3>
            </div>
            <p className="results-report__section-body">
              Rezultati procjene su sačuvani, ali HR izvještaj za ovaj test još nije generisan ili
              nije podržan za ovaj instrument.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
