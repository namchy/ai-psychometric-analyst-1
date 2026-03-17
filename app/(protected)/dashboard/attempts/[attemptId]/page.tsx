import { notFound, redirect } from "next/navigation";
import { CompletedAssessmentSummary } from "@/components/assessment/completed-assessment-summary";
import {
  getCompletedAssessmentReportSnapshot,
  getCompletedAssessmentResults,
} from "@/lib/assessment/tests";
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

  const [results, report] = await Promise.all([
    getCompletedAssessmentResults(attempt.test_id, attempt.id),
    getCompletedAssessmentReportSnapshot(attempt.test_id, attempt.id),
  ]);

  return (
    <main className="attempt-results-page stack-md">
      <section className="attempt-results-page__content">
        <CompletedAssessmentSummary
          completedAt={attempt.completed_at}
          organizationName={attempt.organizations?.name ?? organization.name}
          participantName={attempt.participants?.full_name ?? null}
          testName={attempt.tests?.name ?? attempt.tests?.slug ?? null}
          results={results}
          reportState={report}
        />
      </section>
    </main>
  );
}
