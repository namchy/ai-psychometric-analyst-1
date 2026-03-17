import Link from "next/link";
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
      <section className="card attempt-results-page__shell stack-sm">
        <div className="attempt-results-page__topbar">
          <Link href="/dashboard">Nazad na dashboard</Link>
        </div>

        <div className="attempt-results-page__summary">
          <div className="stack-xs">
            <p className="assessment-eyebrow">Zaštićeni izvještaj</p>
            <h1>Rezultati završene procjene</h1>
            <p className="attempt-results-page__lede">
              Završeni pokušaj ostaje dostupan unutar zaštićenog dashboarda kao pregled
              izvještaja i rezultata.
            </p>
          </div>

          <dl className="attempt-results-page__meta">
            <div>
              <dt>Organizacija</dt>
              <dd>{attempt.organizations?.name ?? organization.name}</dd>
            </div>
            <div>
              <dt>Učesnik</dt>
              <dd>{attempt.participants?.full_name ?? attempt.participant_id}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{attempt.participants?.email ?? "Nije dostupno"}</dd>
            </div>
            <div>
              <dt>Test</dt>
              <dd>{attempt.tests?.name ?? attempt.tests?.slug ?? "Nepoznat test"}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="attempt-results-page__content">
        <CompletedAssessmentSummary
          completedAt={attempt.completed_at}
          participantName={attempt.participants?.full_name ?? null}
          testName={attempt.tests?.name ?? attempt.tests?.slug ?? null}
          results={results}
          reportState={report}
        />
      </section>
    </main>
  );
}
