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
    <main className="stack-md">
      <section className="card stack-sm">
        <div className="stack-xs">
          <h1>
            {attempt.status === "completed" ? "Završena procjena" : "Pokušaj je kreiran"}
          </h1>
          <p>
            {attempt.status === "completed"
              ? "Ovaj završeni B2B pokušaj ostaje u zaštićenom dashboardu i ovdje ga možete ponovo otvoriti kasnije."
              : "B2B pokušaj je uspješno kreiran i vezan je za aktivnu organizaciju."}
          </p>
        </div>

        <dl>
          <dt>ID pokušaja</dt>
          <dd>{attempt.id}</dd>
          <dt>Status</dt>
          <dd>{attempt.status}</dd>
          <dt>Organizacija</dt>
          <dd>{attempt.organizations?.name ?? organization.name}</dd>
          <dt>Učesnik</dt>
          <dd>{attempt.participants?.full_name ?? attempt.participant_id}</dd>
          <dt>Email učesnika</dt>
          <dd>{attempt.participants?.email ?? "Nije dostupno"}</dd>
          <dt>Test</dt>
          <dd>{attempt.tests?.name ?? attempt.tests?.slug ?? "Nepoznat test"}</dd>
          <dt>Vlasnički korisnik</dt>
          <dd>{attempt.user_id ?? "Nije dostupno"}</dd>
          <dt>Završeno</dt>
          <dd>
            {attempt.completed_at ? new Date(attempt.completed_at).toLocaleString() : "Nije dostupno"}
          </dd>
        </dl>

        {attempt.status === "completed" ? (
          <p>Rezultati i AI izvještaj za ovaj završeni pokušaj prikazani su ispod.</p>
        ) : (
          <p>
            <Link href={`/dashboard/attempts/${attempt.id}/run`}>Nastavi procjenu</Link>
          </p>
        )}

        <p>
          <Link href="/dashboard">Nazad na dashboard</Link>
        </p>
      </section>

      {attempt.status === "completed" ? (
        <section className="card stack-sm">
          <CompletedAssessmentSummary
            completedAt={attempt.completed_at}
            results={results}
            reportState={report}
          />
        </section>
      ) : null}
    </main>
  );
}
