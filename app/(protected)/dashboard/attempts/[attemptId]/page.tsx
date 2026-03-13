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
            {attempt.status === "completed" ? "Completed assessment" : "Attempt created"}
          </h1>
          <p>
            {attempt.status === "completed"
              ? "This completed B2B attempt stays in the protected dashboard and can be reopened here later."
              : "The B2B attempt was created successfully and is scoped to the active organization."}
          </p>
        </div>

        <dl>
          <dt>Attempt ID</dt>
          <dd>{attempt.id}</dd>
          <dt>Status</dt>
          <dd>{attempt.status}</dd>
          <dt>Organization</dt>
          <dd>{attempt.organizations?.name ?? organization.name}</dd>
          <dt>Participant</dt>
          <dd>{attempt.participants?.full_name ?? attempt.participant_id}</dd>
          <dt>Participant email</dt>
          <dd>{attempt.participants?.email ?? "N/A"}</dd>
          <dt>Test</dt>
          <dd>{attempt.tests?.name ?? attempt.tests?.slug ?? "Unknown test"}</dd>
          <dt>Ownership user</dt>
          <dd>{attempt.user_id ?? "N/A"}</dd>
          <dt>Completed at</dt>
          <dd>{attempt.completed_at ? new Date(attempt.completed_at).toLocaleString() : "N/A"}</dd>
        </dl>

        {attempt.status === "completed" ? (
          <p>Results and report for this completed attempt are shown below.</p>
        ) : (
          <p>
            <Link href={`/dashboard/attempts/${attempt.id}/run`}>Continue assessment</Link>
          </p>
        )}

        <p>
          <Link href="/dashboard">Back to dashboard</Link>
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
