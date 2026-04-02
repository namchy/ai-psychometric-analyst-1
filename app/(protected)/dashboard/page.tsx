import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { createAssessmentAttempt, createParticipant } from "@/app/actions/participants";
import { SingleOpenPanelGroup } from "@/components/dashboard/single-open-panel-group";
import {
  DEFAULT_ASSESSMENT_LOCALE,
  SUPPORTED_ASSESSMENT_LOCALES,
  getAssessmentLocaleLabel,
} from "@/lib/assessment/locale";
import {
  getActiveOrganizationForUser,
  getAvailableTestsForOrganization,
  getAttemptsForOrganization,
  getMembershipsForUser,
  getParticipantsForOrganization,
  type MembershipSummary,
} from "@/lib/b2b/organizations";
import { requireAuthenticatedUser } from "@/lib/auth/session";

type DashboardPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function getOrganizationName(membership: MembershipSummary): string {
  return membership.organization?.name ?? "Unknown organization";
}

function getDashboardMessage(rawError: string | string[] | undefined): string | null {
  const error = Array.isArray(rawError) ? rawError[0] : rawError;

  switch (error) {
    case "no-active-organization":
      return "No active organization is available for this user.";
    case "participant-full-name-required":
      return "Full name is required.";
    case "participant-email-required":
      return "Email is required.";
    case "participant-type-invalid":
      return "Participant type is invalid.";
    case "participant-status-invalid":
      return "Participant status is invalid.";
    case "create-participant-failed":
      return "Unable to create the participant right now. Please review the submitted data and try again.";
    case "attempt-participant-required":
      return "Participant is required for attempt creation.";
    case "attempt-test-required":
      return "Test is required.";
    case "participant-not-found":
      return "The selected participant was not found in the active organization.";
    case "attempt-test-access-check-failed":
      return "Unable to verify test access right now. Please try again.";
    case "attempt-test-not-available":
      return "The selected test is not available to the active organization.";
    case "create-attempt-failed":
      return "Unable to create the assessment attempt right now. Please review the submitted data and try again.";
    default:
      return null;
  }
}

function getDashboardSuccessMessage(
  rawSuccess: string | string[] | undefined,
): string | null {
  const success = Array.isArray(rawSuccess) ? rawSuccess[0] : rawSuccess;
  if (success === "attempt-created") {
    return "Assessment was created successfully.";
  }

  if (success === "participant-created") {
    return "Participant was created successfully.";
  }

  return null;
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
  const [participants, attempts, availableTests] = activeOrganization
    ? await Promise.all([
        getParticipantsForOrganization(activeOrganization.id),
        getAttemptsForOrganization(activeOrganization.id),
        getAvailableTestsForOrganization(activeOrganization.id),
      ])
    : [[], [], []];
  const message = getDashboardMessage(searchParams?.error);
  const successMessage = getDashboardSuccessMessage(searchParams?.success);
  const createParticipantDetails =
    typeof searchParams?.detail === "string" ? decodeURIComponent(searchParams.detail) : null;
  const shouldOpenCreateParticipantPanel =
    searchParams?.error === "participant-full-name-required" ||
    searchParams?.error === "participant-email-required" ||
    searchParams?.error === "participant-type-invalid" ||
    searchParams?.error === "participant-status-invalid" ||
    searchParams?.error === "create-participant-failed";
  const createAttemptDetails =
    typeof searchParams?.detail === "string" &&
    (searchParams?.error === "create-attempt-failed" ||
      searchParams?.error === "attempt-test-access-check-failed")
      ? decodeURIComponent(searchParams.detail)
      : null;
  const openAttemptFor =
    typeof searchParams?.openAttemptFor === "string" ? searchParams.openAttemptFor : null;
  const latestAttemptByParticipantId = new Map(
    attempts
      .filter((attempt) => attempt.participant_id)
      .map((attempt) => [attempt.participant_id as string, attempt]),
  );

  return (
    <main className="stack-lg mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <section className="dashboard-hero card stack-md">
        <div className="stack-md">
          <div className="stack-xs">
            <p className="eyebrow">HR Dashboard</p>
            <h1>Participant operations</h1>
            <p className="page-lead">
              Review participant records, monitor assessment activity, and keep the organization workspace grounded in people rather than a single assessment.
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
            <div className="dashboard-meta-card">
              <span className="dashboard-meta-card__label">Participants</span>
              <p>{activeOrganization ? participants.length : 0}</p>
            </div>
            <div className="dashboard-meta-card">
              <span className="dashboard-meta-card__label">Recent attempts</span>
              <p>{activeOrganization ? attempts.length : 0}</p>
            </div>
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
        <SingleOpenPanelGroup>
          <div className="section-heading">
            <div>
              <h2>Participants</h2>
              <p>Participant records and their latest assessment state in the active organization.</p>
            </div>
          </div>

          {activeOrganization ? (
            <details
              className="stack-md"
              data-single-open-panel
              open={shouldOpenCreateParticipantPanel}
            >
              <summary className="button-secondary">Create participant</summary>
              <form action={createParticipant} className="stack-md">
                <div className="stack-xs">
                  <label htmlFor="participant-full-name">Full name</label>
                  <input id="participant-full-name" name="fullName" type="text" required />
                </div>
                <div className="stack-xs">
                  <label htmlFor="participant-email">Email</label>
                  <input id="participant-email" name="email" type="email" required />
                </div>
                <div className="stack-xs">
                  <label htmlFor="participant-type">Participant type</label>
                  <select id="participant-type" name="participantType" defaultValue="candidate" required>
                    <option value="candidate">candidate</option>
                    <option value="employee">employee</option>
                  </select>
                </div>
                <div className="stack-xs">
                  <label htmlFor="participant-status">Status</label>
                  <select id="participant-status" name="status" defaultValue="active" required>
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </div>
                {searchParams?.error === "create-participant-failed" && createParticipantDetails ? (
                  <p className="status-message status-message--danger">{createParticipantDetails}</p>
                ) : null}
                <div>
                  <button className="button-primary" type="submit">
                    Create participant
                  </button>
                </div>
              </form>
            </details>
          ) : null}

          {!activeOrganization ? (
            <div className="empty-state">
              <p>This user does not have an active organization yet, so no participant records are available.</p>
            </div>
          ) : participants.length === 0 ? (
            <div className="empty-state">
              <p>No active participants found for {activeOrganization.name}.</p>
            </div>
          ) : (
            <ul className="data-list">
              {participants.map((participant) => {
                const latestAttempt = latestAttemptByParticipantId.get(participant.id);

                return (
                  <li key={participant.id} className="data-list__item">
                    <div className="stack-xs">
                      <div className="data-list__row data-list__row--split">
                        <div className="stack-xs">
                          <h3>{participant.full_name}</h3>
                          <p>{participant.email}</p>
                        </div>
                        <p className="data-list__meta">{participant.status}</p>
                      </div>
                      <p>
                        {participant.participant_type} · {participant.user_id ? "Linked user" : "No linked user"}
                      </p>
                      <p>{latestAttempt ? `Last attempt: ${latestAttempt.status}` : "No attempts"}</p>
                      <details
                        className="stack-md"
                        data-single-open-panel
                        open={openAttemptFor === participant.id}
                      >
                        <summary className="button-secondary">Create assessment attempt</summary>
                        <form action={createAssessmentAttempt} className="stack-md">
                          <input type="hidden" name="participantId" value={participant.id} />
                          <div className="stack-xs">
                            <label htmlFor={`attempt-test-${participant.id}`}>Test</label>
                            <select id={`attempt-test-${participant.id}`} name="testId" required>
                              <option value="">Select a test</option>
                              {availableTests.map((test) => (
                                <option key={test.id} value={test.id}>
                                  {test.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="stack-xs">
                            <label htmlFor={`attempt-locale-${participant.id}`}>Locale</label>
                            <select
                              id={`attempt-locale-${participant.id}`}
                              name="locale"
                              defaultValue={DEFAULT_ASSESSMENT_LOCALE}
                              required
                            >
                              {SUPPORTED_ASSESSMENT_LOCALES.map((locale) => (
                                <option key={locale} value={locale}>
                                  {getAssessmentLocaleLabel(locale)}
                                </option>
                              ))}
                            </select>
                          </div>
                          {openAttemptFor === participant.id && message ? (
                            <p className="status-message status-message--danger">
                              {createAttemptDetails ?? message}
                            </p>
                          ) : null}
                          <div>
                            <button
                              className="button-primary"
                              type="submit"
                              disabled={availableTests.length === 0}
                            >
                              Create assessment attempt
                            </button>
                          </div>
                          {availableTests.length === 0 ? (
                            <p>No available tests are assigned to the active organization.</p>
                          ) : null}
                        </form>
                      </details>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SingleOpenPanelGroup>
      </section>

      <section className="card stack-md">
        <div className="section-heading">
          <div>
            <h2>Recent attempts</h2>
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
          <div className="empty-state">
            <p>No attempts exist for {activeOrganization.name} yet.</p>
          </div>
        ) : (
          <ul className="data-list">
            {attempts.map((attempt) => {
              const detailHref = `/dashboard/attempts/${attempt.id}`;
              const participantName = attempt.participants?.full_name ?? attempt.participant_id ?? "Unknown participant";
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
                      <p>{testLabel}</p>
                    </div>
                    <p className="data-list__meta">{attempt.status}</p>
                  </div>
                  <div className="stack-xs">
                    <p>Attempt {getAttemptLabel(attempt.id)}</p>
                    <p>{activityLabel}</p>
                    {attempt.user_id ? <p>Owner: {attempt.user_id}</p> : null}
                    {attempt.status === "completed" ? (
                      <p className="dashboard-links">
                        <Link href={detailHref}>View results</Link>
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
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
    </main>
  );
}
