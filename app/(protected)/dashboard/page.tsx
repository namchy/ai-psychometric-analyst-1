import { createB2BAttempt } from "@/app/actions/assessment";
import { logout } from "@/app/actions/auth";
import {
  getActiveOrganizationForUser,
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

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await requireAuthenticatedUser();
  const [memberships, activeOrganization] = await Promise.all([
    getMembershipsForUser(user.id),
    getActiveOrganizationForUser(user.id),
  ]);
  const participants = activeOrganization
    ? await getParticipantsForOrganization(activeOrganization.id)
    : [];
  const message = getDashboardMessage(searchParams?.error);

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
    </main>
  );
}
