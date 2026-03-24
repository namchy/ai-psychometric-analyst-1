import { notFound, redirect } from "next/navigation";
import { CompletedAssessmentSummary } from "@/components/assessment/completed-assessment-summary";
import { loadProtectedAttemptReportPageData } from "@/lib/assessment/protected-attempts";
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

  const reportPageData = await loadProtectedAttemptReportPageData(attempt);

  return (
    <main className="attempt-results-page stack-md mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
      <section className="attempt-results-page__content">
        <CompletedAssessmentSummary
          completedAt={attempt.completed_at}
          organizationName={attempt.organizations?.name ?? organization.name}
          participantName={attempt.participants?.full_name ?? null}
          testName={attempt.tests?.name ?? attempt.tests?.slug ?? null}
          results={reportPageData.results}
          reportState={reportPageData.report}
        />
      </section>
    </main>
  );
}
