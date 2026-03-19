import Link from "next/link";
import { createB2BAttempt } from "@/app/actions/assessment";
import { logout } from "@/app/actions/auth";
import {
  getActiveOrganizationForUser,
  getAttemptsForOrganization,
  getMembershipsForUser,
  getParticipantsForOrganization,
  type MembershipSummary,
} from "@/lib/b2b/organizations";
import { requireAuthenticatedUser } from "@/lib/auth/session";

const DEFAULT_B2B_TEST_SLUG = "ipip50-hr-v1";

type DashboardPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function getOrganizationName(membership: MembershipSummary): string {
  return membership.organization?.name ?? "Unknown organization";
}

function getDashboardMessage(rawError: string | string[] | undefined): string | null {
  const error = Array.isArray(rawError) ? rawError[0] : rawError;

  switch (error) {
    case "missing-participant":
      return "Select a participant before creating an attempt.";
    case "no-active-organization":
      return "No active organization is available for this user.";
    case "participant-not-found":
      return "The selected participant was not found in the active organization.";
    case "test-not-found":
      return "The configured test slug could not be resolved.";
    case "create-attempt-failed":
      return "Unable to create the attempt right now. Please try again.";
    default:
      return null;
  }
}

function getDashboardSuccessMessage(
  rawSuccess: string | string[] | undefined,
  rawAttemptId: string | string[] | undefined,
): string | null {
  const success = Array.isArray(rawSuccess) ? rawSuccess[0] : rawSuccess;
  const attemptId = Array.isArray(rawAttemptId) ? rawAttemptId[0] : rawAttemptId;

  switch (success) {
    case "attempt-created":
      return attemptId
        ? `Assessment ${getAttemptLabel(attemptId)} was created successfully. The candidate can now access it from their app workspace.`
        : "Assessment was created successfully. The candidate can now access it from their app workspace.";
    default:
      return null;
  }
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "N/A";
  }

  return new Date(value).toLocaleString();
}

function getAttemptLabel(attemptId: string): string {
  return attemptId.length > 8 ? `${attemptId.slice(0, 8)}...` : attemptId;
}

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await requireAuthenticatedUser();
  const [memberships, activeOrganization] = await Promise.all([
    getMembershipsForUser(user.id),
    getActiveOrganizationForUser(user.id),
  ]);
  const [participants, attempts] = activeOrganization
    ? await Promise.all([
        getParticipantsForOrganization(activeOrganization.id),
        getAttemptsForOrganization(activeOrganization.id),
      ])
    : [[], []];
  const message = getDashboardMessage(searchParams?.error);
  const successMessage = getDashboardSuccessMessage(searchParams?.success, searchParams?.attemptId);

  return (
    <main className="stack-md">
      <section className="card stack-sm">
        <div className="stack-xs">
          <h1>Dashboard</h1>
          <p>Signed in as {user.email ?? user.id}</p>
          <p>
            Active organization: {activeOrganization ? activeOrganization.name : "No active organization"}
          </p>
          {activeOrganization ? (
            <p>
              Current B2B test: <code>{DEFAULT_B2B_TEST_SLUG}</code>
            </p>
          ) : null}
          {memberships.length > 1 ? (
            <p>TODO: add an explicit organization switcher when multi-org selection becomes necessary.</p>
          ) : null}
          {message ? <p>{message}</p> : null}
          {successMessage ? <p>{successMessage}</p> : null}
        </div>

        <form action={logout}>
          <button type="submit">Sign out</button>
        </form>
      </section>

      <section className="card stack-sm">
        <h2>Memberships</h2>

        {memberships.length === 0 ? (
          <p>No organization memberships found for this user yet.</p>
        ) : (
          <ul>
            {memberships.map((membership) => (
              <li key={membership.id}>
                {getOrganizationName(membership)} ({membership.role}, {membership.status})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack-sm">
        <h2>Participants</h2>

        {!activeOrganization ? (
          <p>This user does not have an active organization yet, so no B2B attempts can be created.</p>
        ) : participants.length === 0 ? (
          <p>No active participants found for {activeOrganization.name}.</p>
        ) : (
          <ul>
            {participants.map((participant) => (
              <li key={participant.id}>
                <div className="stack-xs">
                  <p>
                    <strong>{participant.full_name}</strong> ({participant.email})
                  </p>
                  <p>
                    {participant.participant_type} {participant.user_id ? "· linked user" : "· no linked user"}
                  </p>
                  <form action={createB2BAttempt}>
                    <input type="hidden" name="participantId" value={participant.id} />
                    <input type="hidden" name="testSlug" value={DEFAULT_B2B_TEST_SLUG} />
                    <button type="submit">Create IPIP-50 attempt</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack-sm">
        <h2>Attempts</h2>

        {!activeOrganization ? (
          <p>This user does not have an active organization yet, so no organization-scoped attempts are available.</p>
        ) : attempts.length === 0 ? (
          <div className="stack-xs">
            <p>No attempts exist for {activeOrganization.name} yet.</p>
            <p>Create the first attempt for a participant above to start the protected assessment flow.</p>
          </div>
        ) : (
          <ul>
            {attempts.map((attempt) => {
              const detailHref = `/dashboard/attempts/${attempt.id}`;
              const continueHref = `${detailHref}/run`;
              const participantName = attempt.participants?.full_name ?? attempt.participant_id ?? "Unknown participant";
              const participantEmail = attempt.participants?.email ?? "N/A";
              const testLabel = attempt.tests?.name ?? attempt.tests?.slug ?? "Unknown test";
              const activityLabel =
                attempt.status === "completed"
                  ? `Completed ${formatTimestamp(attempt.completed_at)}`
                  : `Started ${formatTimestamp(attempt.started_at)}`;

              return (
                <li key={attempt.id}>
                  <div className="stack-xs">
                    <p>
                      <strong>{participantName}</strong> ({participantEmail})
                    </p>
                    <p>
                      Attempt {getAttemptLabel(attempt.id)} · {testLabel} · {attempt.status}
                    </p>
                    <p>{activityLabel}</p>
                    {attempt.user_id ? <p>Owner: {attempt.user_id}</p> : null}
                    <p>
                      <Link href={detailHref}>Open attempt</Link>
                      {" · "}
                      {attempt.status === "completed" ? (
                        <Link href={detailHref}>View results</Link>
                      ) : (
                        <Link href={continueHref}>Continue assessment</Link>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
