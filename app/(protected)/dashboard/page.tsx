import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { createParticipant, createStandardAssessmentBattery } from "@/app/actions/participants";
import {
  AuthenticatedAppFooterShell,
  AuthenticatedAppHeaderShell,
  AuthenticatedAppMainContent,
  AuthenticatedAppPageShell,
} from "@/components/app/authenticated-app-chrome";
import {
  DashboardActionRow,
  DashboardCompactMetaItem,
  DashboardCompactMetaRow,
  DashboardInfoCardShell,
  DashboardSectionHeader,
  DashboardSectionShell,
  DashboardStatusBadge,
} from "@/components/dashboard/primitives";
import { SingleOpenPanelGroup } from "@/components/dashboard/single-open-panel-group";
import {
  DEFAULT_ASSESSMENT_LOCALE,
  SUPPORTED_ASSESSMENT_LOCALES,
  getAssessmentLocaleLabel,
  toLegacyAssessmentLocale,
} from "@/lib/assessment/locale";
import {
  getActiveOrganizationForUser,
  getAttemptsForOrganization,
  getMembershipsForUser,
  getParticipantsForOrganization,
  type MembershipSummary,
} from "@/lib/b2b/organizations";
import { requireAuthenticatedUser } from "@/lib/auth/session";

type DashboardPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function HrDashboardHeader() {
  return (
    <AuthenticatedAppHeaderShell>
      <div className="flex min-w-0 items-center gap-4">
        <Link
          href="/dashboard"
          className="shrink-0 font-headline text-lg font-bold tracking-[-0.04em] text-slate-900 transition-opacity hover:opacity-90 sm:text-xl"
        >
          Deep Profile
        </Link>
        <span className="hidden rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] lg:inline-flex">
          HR Workspace
        </span>
      </div>

      <form action={logout} className="shrink-0">
        <button
          className="min-h-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-label font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-all duration-200 hover:border-teal-200 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          type="submit"
        >
          Sign out
        </button>
      </form>
    </AuthenticatedAppHeaderShell>
  );
}

function HrDashboardFooter() {
  return (
    <AuthenticatedAppFooterShell>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
        <p className="font-label text-[11px] uppercase tracking-[0.16em] text-slate-600">
          © 2026 <strong>RE:SELEKCIJA</strong>. All rights reserved.
        </p>
      </div>

      <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <a
          className="font-label text-[11px] uppercase tracking-[0.16em] text-slate-600 transition-colors duration-200 hover:text-teal-700"
          href="/"
        >
          Privacy Policy
        </a>
        <a
          className="font-label text-[11px] uppercase tracking-[0.16em] text-slate-600 transition-colors duration-200 hover:text-teal-700"
          href="/"
        >
          Terms of Service
        </a>
        <a
          className="font-label text-[11px] uppercase tracking-[0.16em] text-slate-600 transition-colors duration-200 hover:text-teal-700"
          href="/"
        >
          Security
        </a>
      </nav>
    </AuthenticatedAppFooterShell>
  );
}

function getStatusBadgeClassName(status: string): string {
  switch (status) {
    case "completed":
    case "active":
      return "border-teal-300 bg-teal-50 text-teal-800";
    case "in_progress":
      return "border-sky-300 bg-sky-50 text-sky-800";
    case "inactive":
    case "abandoned":
      return "border-amber-300 bg-amber-50 text-amber-800";
    default:
      return "border-slate-300 bg-slate-100 text-slate-600";
  }
}

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
    case "battery-no-runnable-tests":
      return "Trenutno nema aktivnih testova spremnih za standardnu procjenu.";
    case "battery-create-failed":
      return "Nije moguće kreirati standardnu procjenu. Provjeri podatke i pokušaj ponovo.";
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
  if (success === "battery-created") {
    return "Standardna procjena je kreirana.";
  }

  if (success === "battery-already-exists") {
    return "Standardna procjena je već kreirana za ovog kandidata.";
  }

  if (success === "attempt-created") {
    return "Assessment was created successfully.";
  }

  if (success === "participant-created") {
    return "Participant was created successfully.";
  }

  return null;
}

function getInlineBatterySuccessMessage(
  rawSuccess: string | string[] | undefined,
): string | null {
  const success = Array.isArray(rawSuccess) ? rawSuccess[0] : rawSuccess;

  if (success === "battery-created") {
    return "Standardna procjena je kreirana.";
  }

  if (success === "battery-already-exists") {
    return "Standardna procjena je već kreirana za ovog kandidata.";
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
  const [participants, attempts] = activeOrganization
    ? await Promise.all([
        getParticipantsForOrganization(activeOrganization.id),
        getAttemptsForOrganization(activeOrganization.id),
      ])
    : [[], []];
  const message = getDashboardMessage(searchParams?.error);
  const successMessage = getDashboardSuccessMessage(searchParams?.success);
  const inlineBatterySuccessMessage = getInlineBatterySuccessMessage(searchParams?.success);
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
      searchParams?.error === "attempt-test-access-check-failed" ||
      searchParams?.error === "battery-create-failed")
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
    <AuthenticatedAppPageShell>
      <HrDashboardHeader />

      <AuthenticatedAppMainContent className="mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-10">
        <div className="space-y-16">
        <DashboardSectionShell className="shadow-[0_24px_54px_rgba(15,23,42,0.1)] lg:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 top-0 h-32 w-32 rounded-full bg-teal-100/55 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-violet-100/65 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/80 to-transparent"
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-6">
            <DashboardSectionHeader
              eyebrow="HR control plane"
              eyebrowClassName="text-teal-800/90"
              title="Participant operations"
              titleClassName="text-3xl font-extrabold tracking-[-0.05em] sm:text-4xl"
              description="Review participant records, monitor assessment activity, and keep the organization workspace grounded in people rather than a single assessment."
              descriptionClassName="max-w-3xl"
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <DashboardInfoCardShell className="rounded-[1.25rem] border-slate-200/90 bg-white/72 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Signed in as
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-900">{user.email ?? user.id}</p>
              </DashboardInfoCardShell>
              <DashboardInfoCardShell className="rounded-[1.25rem] border-slate-200/90 bg-white/72 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Active organization
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {activeOrganization ? activeOrganization.name : "No active organization"}
                </p>
              </DashboardInfoCardShell>
              <DashboardInfoCardShell className="rounded-[1.25rem] border-slate-200/90 bg-white/72 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Participants
                </span>
                <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-slate-950">
                  {activeOrganization ? participants.length : 0}
                </p>
              </DashboardInfoCardShell>
              <DashboardInfoCardShell className="rounded-[1.25rem] border-slate-200/90 bg-white/72 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Recent attempts
                </span>
                <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-slate-950">
                  {activeOrganization ? attempts.length : 0}
                </p>
              </DashboardInfoCardShell>
            </div>

            {memberships.length > 1 ? (
              <div className="rounded-[1.15rem] border border-slate-200 bg-white/70 px-4 py-3 text-sm leading-6 text-slate-600">
                TODO: add an explicit organization switcher when multi-org selection becomes necessary.
              </div>
            ) : null}
            {message ? (
              <p className="rounded-[1.15rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                {message}
              </p>
            ) : null}
            {successMessage ? (
              <p className="rounded-[1.15rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                {successMessage}
              </p>
            ) : null}
          </div>

        </div>
        </DashboardSectionShell>

        <div className="space-y-6">
        <DashboardInfoCardShell className="shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
        <section aria-labelledby="participants-section-heading" className="space-y-5" data-participants-section-shell>
          <div data-participants-section-header>
            <DashboardSectionHeader
              eyebrow="Participant workspace"
              eyebrowClassName="text-teal-800/80"
              title={<span id="participants-section-heading">Participants</span>}
              description="Participant records and their latest assessment state in the active organization."
              className="gap-2"
              descriptionClassName="mt-2 max-w-3xl"
            />
          </div>

          <div
            className="px-4 pt-8"
            data-participants-section-body
          >
              <SingleOpenPanelGroup className="space-y-5">
                {activeOrganization ? (
                  <div data-participants-create-panel-area>
                    <details
                      className="group rounded-[1.35rem] border border-slate-200/90 bg-white/80 shadow-[0_14px_30px_rgba(15,23,42,0.05)]"
                      data-single-open-panel
                      open={shouldOpenCreateParticipantPanel}
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[1.35rem] px-5 py-4 text-left text-sm font-semibold text-slate-900 transition-colors duration-200 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                        <span className="inline-flex items-center gap-3">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-teal-200 bg-teal-50 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">
                            New
                          </span>
                          <span>
                            <span className="block text-[15px] font-semibold leading-6">Create participant</span>
                            <span className="block text-xs font-medium text-slate-500">
                              Add a participant record to the active organization.
                            </span>
                          </span>
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                          Expand
                        </span>
                      </summary>
                      <form action={createParticipant} className="space-y-4 border-t border-slate-200/90 px-5 py-5">
                        <div className="space-y-2">
                          <label htmlFor="participant-full-name">Full name</label>
                          <input id="participant-full-name" name="fullName" type="text" required />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="participant-email">Email</label>
                          <input id="participant-email" name="email" type="email" required />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="participant-type">Participant type</label>
                          <select id="participant-type" name="participantType" defaultValue="candidate" required>
                            <option value="candidate">candidate</option>
                            <option value="employee">employee</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="participant-status">Status</label>
                          <select id="participant-status" name="status" defaultValue="active" required>
                            <option value="active">active</option>
                            <option value="inactive">inactive</option>
                          </select>
                        </div>
                        {searchParams?.error === "create-participant-failed" && createParticipantDetails ? (
                          <p className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                            {createParticipantDetails}
                          </p>
                        ) : null}
                        <DashboardActionRow className="flex items-center justify-end pt-1">
                          <button
                            className="min-h-0 rounded-full border border-teal-700 bg-teal-600 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_18px_36px_rgba(13,148,136,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-700 hover:shadow-[0_22px_40px_rgba(13,148,136,0.3)] focus:outline-none focus:ring-2 focus:ring-teal-500/25"
                            type="submit"
                          >
                            Create participant
                          </button>
                        </DashboardActionRow>
                      </form>
                    </details>
                  </div>
                ) : null}

                {!activeOrganization ? (
                  <div className="rounded-[1.35rem] border border-slate-200 bg-white/72 px-5 py-5 text-sm leading-6 text-slate-600">
                    <p>
                      This user does not have an active organization yet, so no participant records are available.
                    </p>
                  </div>
                ) : participants.length === 0 ? (
                  <div className="rounded-[1.35rem] border border-slate-200 bg-white/72 px-5 py-5 text-sm leading-6 text-slate-600">
                    <p>No active participants found for {activeOrganization.name}.</p>
                  </div>
                ) : (
                  <div data-participants-cards-list>
                    <ul className="grid list-none gap-4 p-0">
                      {participants.map((participant) => {
                        const latestAttempt = latestAttemptByParticipantId.get(participant.id);

                        return (
                          <li
                            key={participant.id}
                            className="list-none"
                          >
                            <DashboardInfoCardShell className="h-full rounded-[1.35rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,250,251,0.97))] shadow-[0_18px_34px_rgba(15,23,42,0.06)]">
                              <div className="space-y-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="space-y-2">
                                    <h3 className="font-headline text-[1.35rem] font-bold tracking-[-0.04em] text-slate-950">
                                      {participant.full_name}
                                    </h3>
                                    <p className="text-sm leading-6 text-slate-600">{participant.email}</p>
                                  </div>
                                  <DashboardStatusBadge className={getStatusBadgeClassName(participant.status)}>
                                    {participant.status}
                                  </DashboardStatusBadge>
                                </div>

                                <DashboardCompactMetaRow>
                                  <DashboardCompactMetaItem className="text-slate-700">
                                    {participant.participant_type} ·{" "}
                                    {participant.user_id ? "Linked user" : "No linked user"}
                                  </DashboardCompactMetaItem>
                                  <DashboardCompactMetaItem className="text-slate-700">
                                    {latestAttempt ? `Last attempt: ${latestAttempt.status}` : "No attempts"}
                                  </DashboardCompactMetaItem>
                                </DashboardCompactMetaRow>

                                <details
                                  className="group rounded-[1.2rem] border border-slate-200/90 bg-white/80 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
                                  data-single-open-panel
                                  open={openAttemptFor === participant.id}
                                >
                                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[1.2rem] px-4 py-4 text-left [&::-webkit-details-marker]:hidden">
                                      <span>
                                      <span className="block text-sm font-semibold text-slate-900">
                                        Kreiraj standardnu procjenu
                                      </span>
                                      <span className="block text-xs font-medium text-slate-500">
                                        Dodijeli kandidatu standardnu bateriju procjena.
                                      </span>
                                    </span>
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                                      Expand
                                    </span>
                                  </summary>
                                  <form
                                    action={createStandardAssessmentBattery}
                                    className="space-y-4 border-t border-slate-200/90 px-4 py-4"
                                  >
                                    <input type="hidden" name="participantId" value={participant.id} />
                                    <div className="rounded-[1rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
                                      <p className="text-sm font-semibold text-slate-900">Standardna baterija</p>
                                      <ul className="mt-3 space-y-3 text-sm text-slate-600">
                                        <li className="flex items-start justify-between gap-4">
                                          <div>
                                            <p className="font-medium text-slate-900">IPIP-NEO-120</p>
                                          </div>
                                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                                            Dostupno
                                          </span>
                                        </li>
                                        <li className="flex items-start justify-between gap-4">
                                          <div>
                                            <p className="font-medium text-slate-900">SAFRAN</p>
                                          </div>
                                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                                            Dostupno
                                          </span>
                                        </li>
                                        <li className="flex items-start justify-between gap-4">
                                          <div>
                                            <p className="font-medium text-slate-900">RIASEC</p>
                                            <p>Interesovanja i profesionalne preferencije.</p>
                                          </div>
                                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">
                                            Uskoro
                                          </span>
                                        </li>
                                      </ul>
                                    </div>
                                    <div className="space-y-2">
                                      <label htmlFor={`attempt-locale-${participant.id}`}>Jezik</label>
                                        <select
                                          id={`attempt-locale-${participant.id}`}
                                          name="locale"
                                          defaultValue={toLegacyAssessmentLocale(
                                            DEFAULT_ASSESSMENT_LOCALE,
                                          )}
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
                                      <p className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                                        {createAttemptDetails ?? message}
                                      </p>
                                    ) : null}
                                    {openAttemptFor === participant.id && inlineBatterySuccessMessage ? (
                                      <p className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                                        {inlineBatterySuccessMessage}
                                      </p>
                                    ) : null}
                                    <DashboardActionRow className="flex items-center justify-end">
                                      <button
                                        className="min-h-0 rounded-full border border-teal-700 bg-teal-600 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_18px_36px_rgba(13,148,136,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-700 hover:shadow-[0_22px_40px_rgba(13,148,136,0.3)] focus:outline-none focus:ring-2 focus:ring-teal-500/25 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                                        type="submit"
                                      >
                                        Kreiraj standardnu procjenu
                                      </button>
                                    </DashboardActionRow>
                                  </form>
                                </details>
                              </div>
                            </DashboardInfoCardShell>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </SingleOpenPanelGroup>
          </div>
        </section>
        </DashboardInfoCardShell>

        <DashboardInfoCardShell className="space-y-5 shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
        <DashboardSectionHeader
          eyebrow="Activity stream"
          eyebrowClassName="text-teal-800/80"
          title="Recent attempts"
          description="Recent assessment activity across the active organization."
          className="gap-2"
          descriptionClassName="mt-2 max-w-3xl"
        />

        {!activeOrganization ? (
          <div className="rounded-[1.35rem] border border-slate-200 bg-white/72 px-5 py-5 text-sm leading-6 text-slate-600">
            <p>
              This user does not have an active organization yet, so no organization-scoped attempts are available.
            </p>
          </div>
        ) : attempts.length === 0 ? (
          <div className="rounded-[1.35rem] border border-slate-200 bg-white/72 px-5 py-5 text-sm leading-6 text-slate-600">
            <p>No attempts exist for {activeOrganization.name} yet.</p>
          </div>
        ) : (
          <ul className="grid list-none gap-4 p-0">
            {attempts.map((attempt) => {
              const detailHref = `/dashboard/attempts/${attempt.id}`;
              const participantName = attempt.participants?.full_name ?? attempt.participant_id ?? "Unknown participant";
              const testLabel = attempt.tests?.name ?? attempt.tests?.slug ?? "Unknown test";
              const activityLabel =
                attempt.status === "completed"
                  ? `Completed ${formatTimestamp(attempt.completed_at)}`
                  : `Started ${formatTimestamp(attempt.started_at)}`;

              return (
                <li
                  key={attempt.id}
                  className="list-none"
                >
                  <DashboardInfoCardShell className="h-full rounded-[1.35rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,250,251,0.97))] shadow-[0_18px_34px_rgba(15,23,42,0.06)]">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <h3 className="font-headline text-[1.25rem] font-bold tracking-[-0.035em] text-slate-950">
                          {participantName}
                        </h3>
                        <p className="text-sm leading-6 text-slate-600">{testLabel}</p>
                      </div>
                      <DashboardStatusBadge className={getStatusBadgeClassName(attempt.status)}>
                        {attempt.status}
                      </DashboardStatusBadge>
                    </div>

                    <div className="space-y-2 border-t border-slate-200 pt-3 text-sm leading-6 text-slate-700">
                      <p>Attempt {getAttemptLabel(attempt.id)}</p>
                      <p>{activityLabel}</p>
                      {attempt.user_id ? <p>Owner: {attempt.user_id}</p> : null}
                    </div>

                    {attempt.status === "completed" ? (
                      <DashboardActionRow className="pt-1">
                        <Link
                          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-all duration-200 hover:border-teal-200 hover:text-teal-700"
                          href={detailHref}
                        >
                          View results
                        </Link>
                      </DashboardActionRow>
                    ) : null}
                  </div>
                  </DashboardInfoCardShell>
                </li>
              );
            })}
          </ul>
        )}
        </DashboardInfoCardShell>

        <DashboardInfoCardShell className="space-y-5 shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
        <DashboardSectionHeader
          eyebrow="Access context"
          eyebrowClassName="text-teal-800/80"
          title="Memberships"
          description="Organization access and role context for the signed-in account."
          className="gap-2"
          descriptionClassName="mt-2 max-w-3xl"
        />

        {memberships.length === 0 ? (
          <div className="rounded-[1.35rem] border border-slate-200 bg-white/72 px-5 py-5 text-sm leading-6 text-slate-600">
            <p>No organization memberships found for this user yet.</p>
          </div>
        ) : (
          <ul className="grid list-none gap-4 p-0">
            {memberships.map((membership) => (
              <li
                key={membership.id}
                className="list-none"
              >
                <DashboardInfoCardShell className="h-full rounded-[1.35rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,250,251,0.97))] shadow-[0_18px_34px_rgba(15,23,42,0.06)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <h3 className="font-headline text-[1.25rem] font-bold tracking-[-0.035em] text-slate-950">
                      {getOrganizationName(membership)}
                    </h3>
                    <p className="text-sm leading-6 text-slate-700">
                      {membership.role} · {membership.status}
                    </p>
                  </div>
                  <DashboardStatusBadge className={getStatusBadgeClassName(membership.status)}>
                    {membership.status}
                  </DashboardStatusBadge>
                </div>
                </DashboardInfoCardShell>
              </li>
            ))}
          </ul>
        )}
        </DashboardInfoCardShell>
        </div>
        </div>
      </AuthenticatedAppMainContent>

      <HrDashboardFooter />
    </AuthenticatedAppPageShell>
  );
}
