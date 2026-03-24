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
    <main className="stack-lg mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <section className="dashboard-hero card stack-md">
        <div className="stack-md">
          <div className="stack-xs">
            <p className="eyebrow">HR Dashboard</p>
            <h1>Assessment operations</h1>
            <p className="page-lead">
              Create attempts, monitor participant activity, and keep the current assessment workflow moving.
            </p>
          </div>

          <div className="dashboard-hero__meta">
            <div className="dashboard-meta-card">
              <span className="dashboard-meta-card__label">Signed in as</span>
              <p>{user.email ?? user.id}</p>
            </div>
            <div className="dashboard-meta-card">
              <span className="dashboard-meta-card__label">Active organization</span>
              <p>{activeOrganization ? activeOrganization.name : "No active organization"}</p>
            </div>
            {activeOrganization ? (
              <div className="dashboard-meta-card">
                <span className="dashboard-meta-card__label">Current B2B test</span>
                <p>
                  <code>{DEFAULT_B2B_TEST_SLUG}</code>
                </p>
              </div>
            ) : null}
          </div>

          {memberships.length > 1 ? (
            <p className="dashboard-note">
              TODO: add an explicit organization switcher when multi-org selection becomes necessary.
            </p>
          ) : null}
          {message ? <p className="status-message status-message--danger">{message}</p> : null}
          {successMessage ? <p className="status-message status-message--success">{successMessage}</p> : null}
        </div>

        <form action={logout}>
          <button className="button-secondary" type="submit">
            Sign out
          </button>
        </form>
      </section>

      <section className="card stack-md">
        <div className="section-heading">
          <div>
            <h2>Memberships</h2>
            <p>Organization access and role context for the signed-in account.</p>
          </div>
        </div>

        {memberships.length === 0 ? (
          <div className="empty-state">
            <p>No organization memberships found for this user yet.</p>
          </div>
        ) : (
          <ul className="data-list">
            {memberships.map((membership) => (
              <li key={membership.id} className="data-list__item">
                <div className="data-list__row">
                  <div className="stack-xs">
                    <h3>{getOrganizationName(membership)}</h3>
                    <p>
                      {membership.role} · {membership.status}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack-md">
        <div className="section-heading">
          <div>
            <h2>Participants</h2>
            <p>Launch the active IPIP-50 assessment for participants in the current organization.</p>
          </div>
        </div>

        {!activeOrganization ? (
          <div className="empty-state">
            <p>This user does not have an active organization yet, so no B2B attempts can be created.</p>
          </div>
        ) : participants.length === 0 ? (
          <div className="empty-state">
            <p>No active participants found for {activeOrganization.name}.</p>
          </div>
        ) : (
          <ul className="data-list">
            {participants.map((participant) => (
              <li key={participant.id} className="data-list__item">
                <div className="data-list__row data-list__row--split">
                  <div className="stack-xs">
                    <h3>{participant.full_name}</h3>
                    <p>{participant.email}</p>
                    <p>
                      {participant.participant_type} {participant.user_id ? "· linked user" : "· no linked user"}
                    </p>
                  </div>
                  <form action={createB2BAttempt}>
                    <input type="hidden" name="participantId" value={participant.id} />
                    <input type="hidden" name="testSlug" value={DEFAULT_B2B_TEST_SLUG} />
                    <button className="button-primary" type="submit">
                      Create IPIP-50 attempt
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack-md">
        <div className="section-heading">
          <div>
            <h2>Attempts</h2>
            <p>Recent assessment activity across the active organization.</p>
          </div>
        </div>

        {!activeOrganization ? (
          <div className="empty-state">
            <p>
              This user does not have an active organization yet, so no organization-scoped attempts are available.
            </p>
          </div>
        ) : attempts.length === 0 ? (
          <div className="empty-state stack-xs">
            <p>No attempts exist for {activeOrganization.name} yet.</p>
            <p>Create the first attempt for a participant above to start the protected assessment flow.</p>
          </div>
        ) : (
          <ul className="data-list">
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
                <li key={attempt.id} className="data-list__item">
                  <div className="data-list__row">
                    <div className="stack-xs">
                      <h3>{participantName}</h3>
                      <p>{participantEmail}</p>
                    </div>
                    <p className="data-list__meta">{attempt.status}</p>
                  </div>
                  <div className="stack-xs">
                    <p>
                      Attempt {getAttemptLabel(attempt.id)} · {testLabel}
                    </p>
                    <p>{activityLabel}</p>
                    {attempt.user_id ? <p>Owner: {attempt.user_id}</p> : null}
                    <p className="dashboard-links">
                      <Link href={detailHref}>Open attempt</Link>
                      <span aria-hidden="true">·</span>
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
