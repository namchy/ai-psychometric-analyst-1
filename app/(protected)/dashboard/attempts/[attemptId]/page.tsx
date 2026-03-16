import Link from "next/link";
import { notFound } from "next/navigation";
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

  const [results, report] =
    attempt.status === "completed"
      ? await Promise.all([
          getCompletedAssessmentResults(attempt.test_id, attempt.id),
          getCompletedAssessmentReportSnapshot(attempt.test_id, attempt.id),
        ])
      : [null, null];

  return (
    <main className="attempt-results-page stack-md">
      <section className="card attempt-results-page__shell stack-sm">
        <div className="attempt-results-page__topbar">
          <Link href="/dashboard">Nazad na dashboard</Link>
        </div>

        <div className="attempt-results-page__summary">
          <div className="stack-xs">
            <p className="assessment-eyebrow">Zaštićeni izvještaj</p>
            <h1>
              {attempt.status === "completed" ? "Rezultati završene procjene" : "Pokušaj je kreiran"}
            </h1>
            <p className="attempt-results-page__lede">
              {attempt.status === "completed"
                ? "Završeni pokušaj ostaje dostupan unutar zaštićenog dashboarda kao pregled izvještaja i rezultata."
                : "Pokušaj je kreiran i spreman za nastavak procjene unutar zaštićenog toka."}
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

        {attempt.status !== "completed" ? (
          <p>
            <Link href={`/dashboard/attempts/${attempt.id}/run`}>Nastavi procjenu</Link>
          </p>
        ) : null}
      </section>

      {attempt.status === "completed" ? (
        <section className="attempt-results-page__content">
          <CompletedAssessmentSummary
            completedAt={attempt.completed_at}
            participantName={attempt.participants?.full_name ?? null}
            testName={attempt.tests?.name ?? attempt.tests?.slug ?? null}
            results={results}
            reportState={report}
          />
        </section>
      ) : null}
    </main>
  );
}
