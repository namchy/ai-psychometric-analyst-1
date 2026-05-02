import { cookies } from "next/headers";
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
  DashboardInfoCardShell,
  DashboardSectionHeader,
  DashboardStatusBadge,
  DashboardSectionShell,
} from "@/components/dashboard/primitives";
import { HrAssessmentsTable } from "@/components/dashboard/hr-assessments-table";
import { SingleOpenPanelGroup } from "@/components/dashboard/single-open-panel-group";
import {
  DEFAULT_ASSESSMENT_LOCALE,
  SUPPORTED_ASSESSMENT_LOCALES,
  getAssessmentLocaleLabel,
  toLegacyAssessmentLocale,
} from "@/lib/assessment/locale";
import {
  getActiveOrganizationForUser,
  getMembershipsForUser,
  getParticipantsForOrganization,
  getRunnableStandardBatteryTestsForOrganization,
  getAttemptsForOrganization,
  type MembershipSummary,
  type OrganizationRunnableStandardBatteryTestSummary,
  type OrganizationScopedAttemptSummary,
  type ParticipantSummary,
} from "@/lib/b2b/organizations";
import { requireAuthenticatedUser } from "@/lib/auth/session";

type DashboardPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

type ParticipantProvisioningFlash = {
  success: boolean;
  message: string;
  credentials?: {
    email: string;
    temporaryPassword: string;
  };
};

type AssessmentAggregateStatus =
  | "Čeka kandidata"
  | "U toku"
  | "Djelimično završeno"
  | "Spremno za pregled"
  | "Traži pažnju";

type AssessmentFilterKey = "all" | "in-progress" | "review-ready" | "attention";

type HrFriendlyTestStatus =
  | "Završeno"
  | "U toku"
  | "Čeka"
  | "Nije dodijeljeno"
  | "Arhivirano"
  | "Greška";

type ParticipantAssessmentRow = {
  participant: ParticipantSummary;
  totalTests: number;
  completedTests: number;
  hasOpenAssessment: boolean;
  aggregateStatus: AssessmentAggregateStatus;
  primaryAction:
    | {
        kind: "create";
        label: "Dodijeli procjenu";
      }
    | {
        kind: "info";
        label: "Čeka kandidata" | "Traži pažnju";
        note: string;
      }
    | {
        kind: "link";
        label: "Pogledaj procjenu";
        href: string;
      };
  testItems: Array<{
    key: string;
    shortLabel: string;
    status: HrFriendlyTestStatus;
  }>;
};

type StandardBatteryDisplayTest = {
  slug: "ipip-neo-120-v1" | "safran_v1" | "mwms_v1";
  shortLabel: "IPIP-NEO-120" | "SAFRAN" | "MWMS";
};

const STANDARD_BATTERY_DISPLAY_TESTS: readonly StandardBatteryDisplayTest[] = [
  { slug: "ipip-neo-120-v1", shortLabel: "IPIP-NEO-120" },
  { slug: "safran_v1", shortLabel: "SAFRAN" },
  { slug: "mwms_v1", shortLabel: "MWMS" },
] as const;

const PARTICIPANT_CREDENTIALS_COOKIE = "participant-provisioning-flash";

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

function getOrganizationName(membership: MembershipSummary): string {
  return membership.organization?.name ?? "Unknown organization";
}

const HERO_KPI_CARD_CONFIG = {
  activeAssessments: {
    accentColor: "#118ab2",
    background:
      "linear-gradient(135deg, rgba(17, 138, 178, 0.10), rgba(255, 255, 255, 0.92))",
  },
  waitingCandidates: {
    accentColor: "#ffd166",
    background:
      "linear-gradient(135deg, rgba(255, 209, 102, 0.14), rgba(255, 255, 255, 0.92))",
  },
  reviewReady: {
    accentColor: "#06d6a0",
    background:
      "linear-gradient(135deg, rgba(6, 214, 160, 0.12), rgba(255, 255, 255, 0.92))",
  },
  reportsAvailable: {
    accentColor: "#ef476f",
    background:
      "linear-gradient(135deg, rgba(239, 71, 111, 0.10), rgba(255, 255, 255, 0.92))",
  },
} as const;

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

function getDashboardSuccessMessage(rawSuccess: string | string[] | undefined): string | null {
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
    return "Kandidat je uspješno kreiran.";
  }

  return null;
}

function getParticipantProvisioningFlash(): ParticipantProvisioningFlash | null {
  const rawValue = cookies().get(PARTICIPANT_CREDENTIALS_COOKIE)?.value;

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as ParticipantProvisioningFlash;
  } catch {
    return null;
  }
}

function getInlineBatterySuccessMessage(rawSuccess: string | string[] | undefined): string | null {
  const success = Array.isArray(rawSuccess) ? rawSuccess[0] : rawSuccess;

  if (success === "battery-created") {
    return "Standardna procjena je kreirana.";
  }

  if (success === "battery-already-exists") {
    return "Standardna procjena je već kreirana za ovog kandidata.";
  }

  return null;
}

function getStringParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return null;
}

function getTestStatusLabel(attempt: OrganizationScopedAttemptSummary | null): HrFriendlyTestStatus {
  if (!attempt) {
    return "Nije dodijeljeno";
  }

  if (attempt.lifecycle === "completed") {
    return "Završeno";
  }

  if (attempt.lifecycle === "in_progress") {
    return "U toku";
  }

  if (attempt.lifecycle === "not_started") {
    return "Čeka";
  }

  if (attempt.lifecycle === "abandoned") {
    return "Arhivirano";
  }

  return "Greška";
}

function selectRelevantAttempt(attempts: OrganizationScopedAttemptSummary[]): OrganizationScopedAttemptSummary | null {
  if (attempts.length === 0) {
    return null;
  }

  const priority = (attempt: OrganizationScopedAttemptSummary) => {
    switch (attempt.lifecycle) {
      case "completed":
        return 0;
      case "in_progress":
        return 1;
      case "not_started":
        return 2;
      case "abandoned":
        return 3;
      default:
        return 4;
    }
  };

  return [...attempts].sort((left, right) => {
    const priorityDifference = priority(left) - priority(right);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const leftTimestamp = Date.parse(left.completed_at ?? left.started_at);
    const rightTimestamp = Date.parse(right.completed_at ?? right.started_at);
    return rightTimestamp - leftTimestamp;
  })[0] ?? null;
}

function buildParticipantAssessmentRows(input: {
  participants: ParticipantSummary[];
  attempts: OrganizationScopedAttemptSummary[];
  standardBatteryTests: OrganizationRunnableStandardBatteryTestSummary[];
}): ParticipantAssessmentRow[] {
  const attemptsByParticipantId = new Map<string, OrganizationScopedAttemptSummary[]>();

  for (const attempt of input.attempts) {
    if (!attempt.participant_id) {
      continue;
    }

    const participantAttempts = attemptsByParticipantId.get(attempt.participant_id) ?? [];
    participantAttempts.push(attempt);
    attemptsByParticipantId.set(attempt.participant_id, participantAttempts);
  }

  return input.participants.map((participant) => {
    const participantAttempts = attemptsByParticipantId.get(participant.id) ?? [];
    const attemptsBySlug = new Map<string, OrganizationScopedAttemptSummary[]>();

    for (const attempt of participantAttempts) {
      const slug = attempt.tests?.slug;

      if (!slug) {
        continue;
      }

      const testAttempts = attemptsBySlug.get(slug) ?? [];
      testAttempts.push(attempt);
      attemptsBySlug.set(slug, testAttempts);
    }

    const testItems = STANDARD_BATTERY_DISPLAY_TESTS.map((test) => {
      const relevantAttempt = selectRelevantAttempt(attemptsBySlug.get(test.slug) ?? []);
      const status = getTestStatusLabel(relevantAttempt);

      return {
        key: test.slug,
        shortLabel: test.shortLabel,
        status,
      };
    });

    const relevantAttempts = STANDARD_BATTERY_DISPLAY_TESTS
      .map((test) => selectRelevantAttempt(attemptsBySlug.get(test.slug) ?? []))
      .filter((attempt): attempt is OrganizationScopedAttemptSummary => Boolean(attempt));
    const completedAttempts = relevantAttempts.filter((attempt) => attempt.lifecycle === "completed");
    const openAttempt =
      relevantAttempts.find((attempt) => attempt.lifecycle === "in_progress") ??
      relevantAttempts.find((attempt) => attempt.lifecycle === "not_started") ??
      null;
    const archivedOnlyAttempt =
      !openAttempt && completedAttempts.length === 0
        ? relevantAttempts.find((attempt) => attempt.lifecycle === "abandoned") ?? null
        : null;
    const completedCount = completedAttempts.length;
    const totalTests = STANDARD_BATTERY_DISPLAY_TESTS.length;
    const hasInvalidState = relevantAttempts.some(
      (attempt) =>
        attempt.lifecycle !== "completed" &&
        attempt.lifecycle !== "in_progress" &&
        attempt.lifecycle !== "not_started" &&
        attempt.lifecycle !== "abandoned",
    );
    const hasInProgressAttempt = relevantAttempts.some((attempt) => attempt.lifecycle === "in_progress");
    const hasNotStartedAttempt = relevantAttempts.some((attempt) => attempt.lifecycle === "not_started");
    const hasOpenAssessment = hasInProgressAttempt || hasNotStartedAttempt;

    let aggregateStatus: AssessmentAggregateStatus = "Čeka kandidata";

    if (hasInvalidState) {
      aggregateStatus = "Traži pažnju";
    } else if (completedCount === totalTests) {
      aggregateStatus = "Spremno za pregled";
    } else if (completedCount > 0) {
      aggregateStatus = "Djelimično završeno";
    } else if (hasInProgressAttempt) {
      aggregateStatus = "U toku";
    } else if (hasNotStartedAttempt || completedCount === 0) {
      aggregateStatus = "Čeka kandidata";
    }

    let primaryAction: ParticipantAssessmentRow["primaryAction"] = {
      kind: "create",
      label: "Dodijeli procjenu",
    };

    if (hasInvalidState) {
      primaryAction = {
        kind: "info",
        label: "Traži pažnju",
        note: "Provjeri status procjene.",
      };
    } else if (totalTests > 0 && completedCount === totalTests && completedAttempts[0]) {
      primaryAction = {
        kind: "link",
        label: "Pogledaj procjenu",
        href: `/dashboard/attempts/${completedAttempts[0].id}`,
      };
    } else if (completedCount > 0 && completedAttempts[0]) {
      primaryAction = {
        kind: "link",
        label: "Pogledaj procjenu",
        href: `/dashboard/attempts/${completedAttempts[0].id}`,
      };
    } else if (openAttempt || archivedOnlyAttempt) {
      primaryAction = {
        kind: "info",
        label: "Čeka kandidata",
        note: "Rezultati će biti dostupni nakon završenog testa.",
      };
    }

    return {
      participant,
      totalTests,
      completedTests: completedCount,
      hasOpenAssessment,
      aggregateStatus,
      primaryAction,
      testItems,
    };
  });
}

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await requireAuthenticatedUser();
  const [memberships, activeOrganization] = await Promise.all([
    getMembershipsForUser(user.id),
    getActiveOrganizationForUser(user.id),
  ]);
  const [participants, attempts, standardBatteryTests] = activeOrganization
    ? await Promise.all([
        getParticipantsForOrganization(activeOrganization.id),
        getAttemptsForOrganization(activeOrganization.id),
        getRunnableStandardBatteryTestsForOrganization(activeOrganization.id),
      ])
    : [[], [], []];
  const message = getDashboardMessage(searchParams?.error);
  const successMessage = getDashboardSuccessMessage(searchParams?.success);
  const inlineBatterySuccessMessage = getInlineBatterySuccessMessage(searchParams?.success);
  const participantProvisioningFlash = getParticipantProvisioningFlash();
  const createParticipantDetails =
    typeof searchParams?.detail === "string" ? decodeURIComponent(searchParams.detail) : null;
  const createParticipantCredentials =
    searchParams?.success === "participant-created" && participantProvisioningFlash?.success
      ? participantProvisioningFlash.credentials ?? null
      : null;
  const shouldOpenCreateParticipantPanel =
    searchParams?.error === "participant-full-name-required" ||
    searchParams?.error === "participant-email-required" ||
    searchParams?.error === "participant-type-invalid" ||
    searchParams?.error === "participant-status-invalid" ||
    Boolean(createParticipantCredentials);
  const openAttemptFor = getStringParam(searchParams?.openAttemptFor);
  const requestedFilter = getStringParam(searchParams?.filter);
  const activeFilter: AssessmentFilterKey =
    requestedFilter === "in-progress" ||
    requestedFilter === "review-ready" ||
    requestedFilter === "attention"
      ? requestedFilter
      : "all";
  const searchTerm = (getStringParam(searchParams?.q) ?? "").trim();
  const assessmentRows = buildParticipantAssessmentRows({
    participants,
    attempts,
    standardBatteryTests,
  });
  const activeAssessmentCount = assessmentRows.filter((row) => row.hasOpenAssessment).length;
  const waitingCount = assessmentRows.filter(
    (row) => row.aggregateStatus === "Čeka kandidata" && row.completedTests === 0,
  ).length;
  const reviewReadyCount = assessmentRows.filter((row) => row.aggregateStatus === "Spremno za pregled").length;
  const reportsAvailableCount = assessmentRows.filter((row) => row.completedTests > 0).length;

  return (
    <AuthenticatedAppPageShell>
      <HrDashboardHeader />

      <AuthenticatedAppMainContent className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10">
        <div className="space-y-10 pb-12">
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

            <div className="relative space-y-6">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1 space-y-5">
                  <DashboardSectionHeader
                    eyebrow="HR control panel"
                    eyebrowClassName="text-teal-800/90"
                    title="HR pregled procjena"
                    titleClassName="text-3xl font-extrabold tracking-[-0.05em] sm:text-4xl"
                    description="Prati status testova, dostupne rezultate i sljedeću HR akciju za svakog kandidata."
                    descriptionClassName="max-w-3xl"
                  />

                  <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 xl:max-w-[810px] xl:grid-cols-4">
                    <DashboardInfoCardShell
                      className="flex h-[72px] w-[195px] items-center justify-between rounded-[1.35rem] border-slate-200/80 px-4 py-3 shadow-none"
                      style={{
                        background: HERO_KPI_CARD_CONFIG.activeAssessments.background,
                        borderLeftColor: HERO_KPI_CARD_CONFIG.activeAssessments.accentColor,
                        borderLeftWidth: "4px",
                      }}
                    >
                      <span className="block max-w-[125px] text-[10px] font-semibold uppercase leading-[1.15] tracking-[0.18em] text-slate-500 whitespace-nowrap">
                        Aktivne procjene
                      </span>
                      <p className="shrink-0 text-3xl font-bold leading-none tracking-[-0.05em] text-slate-950">{activeAssessmentCount}</p>
                    </DashboardInfoCardShell>
                    <DashboardInfoCardShell
                      className="flex h-[72px] w-[195px] items-center justify-between rounded-[1.35rem] border-slate-200/80 px-4 py-3 shadow-none"
                      style={{
                        background: HERO_KPI_CARD_CONFIG.waitingCandidates.background,
                        borderLeftColor: HERO_KPI_CARD_CONFIG.waitingCandidates.accentColor,
                        borderLeftWidth: "4px",
                      }}
                    >
                      <span className="block max-w-[125px] text-[10px] font-semibold uppercase leading-[1.15] tracking-[0.18em] text-slate-500 whitespace-nowrap">
                        Čekaju kandidata
                      </span>
                      <p className="shrink-0 text-3xl font-bold leading-none tracking-[-0.05em] text-slate-950">{waitingCount}</p>
                    </DashboardInfoCardShell>
                    <DashboardInfoCardShell
                      className="flex h-[72px] w-[195px] items-center justify-between rounded-[1.35rem] border-slate-200/80 px-4 py-3 shadow-none"
                      style={{
                        background: HERO_KPI_CARD_CONFIG.reviewReady.background,
                        borderLeftColor: HERO_KPI_CARD_CONFIG.reviewReady.accentColor,
                        borderLeftWidth: "4px",
                      }}
                    >
                      <span className="block max-w-[125px] text-[10px] font-semibold uppercase leading-[1.15] tracking-[0.18em] text-slate-500">
                        Spremno za pregled
                      </span>
                      <p className="shrink-0 text-3xl font-bold leading-none tracking-[-0.05em] text-slate-950">{reviewReadyCount}</p>
                    </DashboardInfoCardShell>
                    <DashboardInfoCardShell
                      className="flex h-[72px] w-[195px] items-center justify-between rounded-[1.35rem] border-slate-200/80 px-4 py-3 shadow-none"
                      style={{
                        background: HERO_KPI_CARD_CONFIG.reportsAvailable.background,
                        borderLeftColor: HERO_KPI_CARD_CONFIG.reportsAvailable.accentColor,
                        borderLeftWidth: "4px",
                      }}
                    >
                      <span className="block max-w-[125px] text-[10px] font-semibold uppercase leading-[1.15] tracking-[0.18em] text-slate-500 whitespace-nowrap">
                        Izvještaji dostupni
                      </span>
                      <p className="shrink-0 text-3xl font-bold leading-none tracking-[-0.05em] text-slate-950">{reportsAvailableCount}</p>
                    </DashboardInfoCardShell>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 xl:ml-6 xl:max-w-[18rem] xl:justify-end">
                  <span className="rounded-full border border-white/70 bg-white/70 px-4 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                    {activeOrganization ? activeOrganization.name : "No active organization"}
                  </span>
                  <span className="rounded-full border border-white/70 bg-white/70 px-4 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                    {user.email ?? user.id}
                  </span>
                </div>
              </div>

              {memberships.length > 1 ? (
                <div className="rounded-[1.15rem] border border-slate-200 bg-white/70 px-4 py-3 text-sm leading-6 text-slate-600">
                  Aktivno je više organizacijskih članstava. Trenutno se prikazuje prva aktivna organizacija:{" "}
                  {activeOrganization?.name ?? getOrganizationName(memberships[0])}.
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
          </DashboardSectionShell>

          {activeOrganization ? (
            <HrAssessmentsTable
              createActionMessage={message}
              createAttemptDetails={createParticipantDetails}
              initialFilter={activeFilter}
              initialSearchTerm={searchTerm}
              inlineBatterySuccessMessage={inlineBatterySuccessMessage}
              openAttemptFor={openAttemptFor}
              rows={assessmentRows}
              standardBatteryTests={standardBatteryTests}
            />
          ) : (
            <DashboardSectionShell className="overflow-hidden rounded-[2rem] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,247,250,0.95))] px-0 py-0 shadow-[0_30px_70px_rgba(15,23,42,0.1)]">
              <div className="px-6 py-8 text-sm leading-6 text-slate-600">
                Ovaj korisnik još nema aktivnu organizaciju, pa HR dashboard trenutno nema dostupne procjene.
              </div>
            </DashboardSectionShell>
          )}

          <DashboardInfoCardShell className="rounded-[1.25rem] border-slate-200/70 bg-white/75 p-4 shadow-[0_10px_20px_rgba(15,23,42,0.04)] sm:p-4.5">
            <section aria-labelledby="participants-section-heading" className="space-y-5">
              <DashboardSectionHeader
                eyebrow="Participant workspace"
                eyebrowClassName="text-teal-800/80"
                title={<span id="participants-section-heading">Dodaj kandidata</span>}
                description="Kreiraj novi kandidat zapis u aktivnoj organizaciji. Ovaj panel zadržava postojeći provisioning flow."
                className="gap-2"
                titleClassName="text-[1.25rem]"
                descriptionClassName="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500"
              />

              <SingleOpenPanelGroup className="space-y-5">
                {activeOrganization ? (
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
                        <label className="text-sm font-medium text-slate-700" htmlFor="participant-full-name">
                          Full name
                        </label>
                        <input
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-500/15"
                          id="participant-full-name"
                          name="fullName"
                          required
                          type="text"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700" htmlFor="participant-email">
                          Email
                        </label>
                        <input
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-500/15"
                          id="participant-email"
                          name="email"
                          required
                          type="email"
                        />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700" htmlFor="participant-type">
                            Participant type
                          </label>
                          <select
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-500/15"
                            defaultValue="candidate"
                            id="participant-type"
                            name="participantType"
                            required
                          >
                            <option value="candidate">candidate</option>
                            <option value="employee">employee</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700" htmlFor="participant-status">
                            Status
                          </label>
                          <select
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-500/15"
                            defaultValue="active"
                            id="participant-status"
                            name="status"
                            required
                          >
                            <option value="active">active</option>
                            <option value="inactive">inactive</option>
                          </select>
                        </div>
                      </div>
                      {searchParams?.error === "create-participant-failed" && createParticipantDetails ? (
                        <p className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                          {createParticipantDetails}
                        </p>
                      ) : null}
                      {createParticipantCredentials ? (
                        <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-800">
                          <p className="font-semibold text-emerald-900">Kandidat je kreiran.</p>
                          <p className="mt-2">
                            <strong>Email:</strong> {createParticipantCredentials.email}
                          </p>
                          <p>
                            <strong>Privremena lozinka:</strong> {createParticipantCredentials.temporaryPassword}
                          </p>
                        </div>
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
                ) : (
                  <div className="rounded-[1.35rem] border border-slate-200 bg-white/72 px-5 py-5 text-sm leading-6 text-slate-600">
                    This user does not have an active organization yet, so no participant records are available.
                  </div>
                )}
              </SingleOpenPanelGroup>
            </section>
          </DashboardInfoCardShell>

          {memberships.length > 0 ? (
            <DashboardInfoCardShell className="rounded-[1.2rem] border-slate-200/60 bg-white/65 p-3.5 shadow-[0_8px_18px_rgba(15,23,42,0.035)] sm:p-4">
              <DashboardSectionHeader
                eyebrow="Access context"
                eyebrowClassName="text-slate-500"
                title="Memberships"
                description="Organization access and role context for the signed-in account."
                className="gap-2"
                titleClassName="text-[1.15rem] text-slate-800"
                descriptionClassName="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500"
              />
              <div className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                {memberships.map((membership) => (
                  <DashboardInfoCardShell
                    key={membership.id}
                    className="rounded-[1rem] border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.94))] p-3 shadow-[0_8px_16px_rgba(15,23,42,0.035)]"
                  >
                    <div className="space-y-2.5">
                      <div>
                        <h3 className="font-headline text-[0.98rem] font-bold tracking-[-0.02em] text-slate-900">
                          {getOrganizationName(membership)}
                        </h3>
                        <p className="mt-1 text-[13px] leading-5 text-slate-600">
                          {membership.role} · {membership.status}
                        </p>
                      </div>
                      <DashboardStatusBadge className="w-fit border-slate-200 bg-slate-100 text-slate-600">
                        {membership.status}
                      </DashboardStatusBadge>
                    </div>
                  </DashboardInfoCardShell>
                ))}
              </div>
            </DashboardInfoCardShell>
          ) : null}
        </div>
      </AuthenticatedAppMainContent>

      <HrDashboardFooter />
    </AuthenticatedAppPageShell>
  );
}
