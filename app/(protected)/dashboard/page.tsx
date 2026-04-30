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
  reportLabel: string;
  reportNote: string | null;
  primaryAction:
    | {
        kind: "create";
        label: "Kreiraj procjenu";
      }
    | {
        kind: "disabled";
        label: "Prati procjenu" | "Pregledaj problem";
      }
    | {
        kind: "link";
        label: "Pogledaj rezultate" | "Otvori rezultate";
        href: string;
      };
  testItems: Array<{
    key: string;
    shortLabel: string;
    status: HrFriendlyTestStatus;
    resultHref: string | null;
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

function getStandardBatteryShortLabel(slug: string): string {
  return STANDARD_BATTERY_DISPLAY_TESTS.find((test) => test.slug === slug)?.shortLabel ?? slug;
}

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

function formatCountLabel(count: number, singular: string, paucal: string, plural: string): string {
  const absoluteCount = Math.abs(count);
  const lastTwoDigits = absoluteCount % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return plural;
  }

  const lastDigit = absoluteCount % 10;

  if (lastDigit === 1) {
    return singular;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return paucal;
  }

  return plural;
}

function buildDashboardHref(
  searchTerm: string,
  filter: AssessmentFilterKey,
): string {
  const params = new URLSearchParams();

  if (searchTerm) {
    params.set("q", searchTerm);
  }

  if (filter !== "all") {
    params.set("filter", filter);
  }

  const query = params.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
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

function getTestStatusClassName(status: HrFriendlyTestStatus): string {
  switch (status) {
    case "Završeno":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "U toku":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "Čeka":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Nije dodijeljeno":
      return "border-slate-200 bg-slate-50 text-slate-500";
    case "Arhivirano":
      return "border-slate-200 bg-slate-100 text-slate-600";
    case "Greška":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function getAggregateStatusClassName(status: AssessmentAggregateStatus): string {
  switch (status) {
    case "Spremno za pregled":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Djelimično završeno":
    case "U toku":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "Traži pažnju":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
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
        resultHref: relevantAttempt?.lifecycle === "completed" ? `/dashboard/attempts/${relevantAttempt.id}` : null,
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

    let reportLabel = "Rezultati nakon završenog testa";
    let reportNote: string | null = "Kompozit nakon 3 testa";

    if (completedCount === 1) {
      reportLabel = "1 rezultat dostupan";
    } else if (completedCount === 2) {
      reportLabel = "2 rezultata dostupna";
    } else if (completedCount === 3) {
      reportLabel = "3 rezultata dostupna";
      reportNote = "Kompozit u pripremi";
    }

    let primaryAction: ParticipantAssessmentRow["primaryAction"] = {
      kind: "create",
      label: "Kreiraj procjenu",
    };

    if (hasInvalidState) {
      primaryAction = {
        kind: "disabled",
        label: "Pregledaj problem",
      };
    } else if (totalTests > 0 && completedCount === totalTests && completedAttempts[0]) {
      primaryAction = {
        kind: "link",
        label: "Otvori rezultate",
        href: `/dashboard/attempts/${completedAttempts[0].id}`,
      };
    } else if (completedCount > 0 && completedAttempts[0]) {
      primaryAction = {
        kind: "link",
        label: "Pogledaj rezultate",
        href: `/dashboard/attempts/${completedAttempts[0].id}`,
      };
    } else if (openAttempt || archivedOnlyAttempt) {
      primaryAction = {
        kind: "disabled",
        label: "Prati procjenu",
      };
    }

    return {
      participant,
      totalTests,
      completedTests: completedCount,
      hasOpenAssessment,
      aggregateStatus,
      reportLabel,
      reportNote,
      primaryAction,
      testItems,
    };
  });
}

function matchesFilter(row: ParticipantAssessmentRow, filter: AssessmentFilterKey): boolean {
  switch (filter) {
    case "in-progress":
      return row.aggregateStatus === "U toku" || row.aggregateStatus === "Djelimično završeno";
    case "review-ready":
      return row.aggregateStatus === "Spremno za pregled";
    case "attention":
      return row.aggregateStatus === "Traži pažnju";
    default:
      return true;
  }
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
  const visibleRows = assessmentRows.filter((row) => {
    const normalizedSearch = searchTerm.toLocaleLowerCase("hr");
    const matchesSearch =
      normalizedSearch.length === 0 ||
      row.participant.full_name.toLocaleLowerCase("hr").includes(normalizedSearch) ||
      row.participant.email.toLocaleLowerCase("hr").includes(normalizedSearch);

    return matchesSearch && matchesFilter(row, activeFilter);
  });
  const firstCreateCandidate = visibleRows.find((row) => row.primaryAction.kind === "create");
  const createActionHref = firstCreateCandidate
    ? `#row-action-${firstCreateCandidate.participant.id}`
    : "#candidate-assessments-table";
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
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <DashboardSectionHeader
                  eyebrow="HR control plane"
                  eyebrowClassName="text-teal-800/90"
                  title="HR pregled procjena"
                  titleClassName="text-3xl font-extrabold tracking-[-0.05em] sm:text-4xl"
                  description="Prati status testova, dostupne rezultate i sljedeću HR akciju za svakog kandidata."
                  descriptionClassName="max-w-3xl"
                />

                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span className="rounded-full border border-white/70 bg-white/70 px-4 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                    {activeOrganization ? activeOrganization.name : "No active organization"}
                  </span>
                  <span className="rounded-full border border-white/70 bg-white/70 px-4 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                    {user.email ?? user.id}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DashboardInfoCardShell className="rounded-[1.35rem] border-slate-200/90 bg-white/78 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Aktivne procjene
                  </span>
                  <p className="mt-3 text-3xl font-bold tracking-[-0.05em] text-slate-950">{activeAssessmentCount}</p>
                </DashboardInfoCardShell>
                <DashboardInfoCardShell className="rounded-[1.35rem] border-slate-200/90 bg-white/78 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Čekaju kandidata
                  </span>
                  <p className="mt-3 text-3xl font-bold tracking-[-0.05em] text-slate-950">{waitingCount}</p>
                </DashboardInfoCardShell>
                <DashboardInfoCardShell className="rounded-[1.35rem] border-slate-200/90 bg-white/78 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Spremno za pregled
                  </span>
                  <p className="mt-3 text-3xl font-bold tracking-[-0.05em] text-slate-950">{reviewReadyCount}</p>
                </DashboardInfoCardShell>
                <DashboardInfoCardShell className="rounded-[1.35rem] border-slate-200/90 bg-white/78 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Izvještaji dostupni
                  </span>
                  <p className="mt-3 text-3xl font-bold tracking-[-0.05em] text-slate-950">{reportsAvailableCount}</p>
                </DashboardInfoCardShell>
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

          <DashboardSectionShell className="overflow-hidden rounded-[2rem] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,247,250,0.95))] px-0 py-0 shadow-[0_30px_70px_rgba(15,23,42,0.1)]">
            <div className="border-b border-slate-200/80 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-3.5">
                <div className="min-w-0">
                  <h2 className="font-headline text-[1.8rem] font-bold tracking-[-0.04em] text-slate-950">
                    Procjene kandidata
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                    Prati status testova, dostupne rezultate i sljedeću HR akciju za svakog kandidata.
                  </p>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <form action="/dashboard" className="flex min-w-0 flex-1 flex-col gap-2.5">
                    <div className="relative min-w-0 max-w-[24rem]">
                      <input
                        aria-label="Pretraži kandidata"
                        className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-500/15"
                        defaultValue={searchTerm}
                        name="q"
                        placeholder="Pretraži kandidata"
                        type="search"
                      />
                      {activeFilter !== "all" ? <input name="filter" type="hidden" value={activeFilter} /> : null}
                    </div>
                  </form>

                  <Link
                    className="min-h-0 w-fit rounded-full border border-teal-700 bg-teal-600 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_18px_36px_rgba(13,148,136,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-700 hover:shadow-[0_22px_40px_rgba(13,148,136,0.3)]"
                    href={createActionHref}
                  >
                    Kreiraj procjenu
                  </Link>
                </div>

                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
                  <span className="shrink-0 pr-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Filteri
                  </span>
                  {(
                    [
                      { key: "all", label: "Svi" },
                      { key: "in-progress", label: "U toku" },
                      { key: "review-ready", label: "Spremno za pregled" },
                      { key: "attention", label: "Traži pažnju" },
                    ] satisfies Array<{ key: AssessmentFilterKey; label: string }>
                  ).map((filterOption) => {
                    const isActive = activeFilter === filterOption.key;

                    return (
                      <Link
                        key={filterOption.key}
                        className={`shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition ${
                          isActive
                            ? "border border-teal-200 bg-teal-50 text-teal-700 shadow-[0_12px_24px_rgba(13,148,136,0.12)]"
                            : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                        }`}
                        href={buildDashboardHref(searchTerm, filterOption.key)}
                      >
                        {filterOption.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {!activeOrganization ? (
              <div className="px-6 py-8 text-sm leading-6 text-slate-600">
                Ovaj korisnik još nema aktivnu organizaciju, pa HR dashboard trenutno nema dostupne procjene.
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="px-6 py-8 text-sm leading-6 text-slate-600">
                Nema kandidata koji odgovaraju trenutnoj pretrazi ili filteru.
              </div>
            ) : (
              <div className="overflow-x-auto" id="candidate-assessments-table">
                <table className="min-w-[1080px] w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-left">
                      {["Kandidat", "Napredak", "Testovi", "Izvještaji", "Status", "Akcija"].map((header) => (
                        <th
                          key={header}
                          className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                          scope="col"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const progressRatio = row.totalTests > 0 ? row.completedTests / row.totalTests : 0;

                      return (
                        <tr
                          key={row.participant.id}
                          className="border-b border-slate-200/70 align-top last:border-b-0"
                        >
                          <td className="px-6 py-4.5">
                            <div className="space-y-1.5">
                              <div>
                                <p className="text-[15px] font-semibold leading-6 text-slate-950">
                                  {row.participant.full_name}
                                </p>
                                <p className="text-sm text-slate-600">{row.participant.email}</p>
                              </div>
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                  row.participant.user_id
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {row.participant.user_id ? "Povezan nalog" : "Nalog nije povezan"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4.5">
                            <div className="max-w-[12rem] space-y-2.5">
                              <p className="text-[15px] font-semibold leading-6 text-slate-900">
                                {row.completedTests}/{row.totalTests} završeno
                              </p>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-sky-500"
                                  style={{ width: `${Math.max(progressRatio * 100, row.totalTests > 0 ? 6 : 0)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4.5">
                            <div className="space-y-2">
                              {row.testItems.map((testItem) => (
                                <div
                                  key={testItem.key}
                                  className="grid max-w-[16rem] grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2.5 gap-y-0.5"
                                >
                                  <div className="min-w-0">
                                    <p className="text-[14px] font-semibold leading-5 text-slate-900">
                                      {testItem.shortLabel}
                                    </p>
                                    {testItem.resultHref ? (
                                      <Link
                                        className="text-[12px] font-medium leading-4 text-slate-500 transition hover:text-teal-700"
                                        href={testItem.resultHref}
                                      >
                                        Rezultati
                                      </Link>
                                    ) : (
                                      <span className="block h-4" aria-hidden="true" />
                                    )}
                                  </div>
                                  <span
                                    className={`mt-0.5 shrink-0 self-start whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${getTestStatusClassName(testItem.status)}`}
                                  >
                                    {testItem.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4.5">
                            <div className="max-w-[12rem] space-y-1">
                              <p className="text-[14px] font-semibold leading-5 text-slate-800">
                                {row.reportLabel}
                              </p>
                              {row.reportNote ? (
                                <p className="text-xs leading-5 text-slate-500">{row.reportNote}</p>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-6 py-4.5">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] ${getAggregateStatusClassName(row.aggregateStatus)}`}
                            >
                              {row.aggregateStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4.5">
                            {row.primaryAction.kind === "link" ? (
                              <div className="space-y-3">
                                <Link
                                  className="inline-flex min-h-0 rounded-full border border-teal-700 bg-teal-600 px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_16px_30px_rgba(13,148,136,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-700"
                                  href={row.primaryAction.href}
                                >
                                  {row.primaryAction.label}
                                </Link>
                              </div>
                            ) : row.primaryAction.kind === "disabled" ? (
                              <div className="max-w-[14rem] space-y-1.5">
                                <button
                                  className="inline-flex min-h-0 cursor-not-allowed rounded-full border border-slate-200 bg-slate-100 px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400 opacity-90"
                                  disabled
                                  type="button"
                                >
                                  {row.primaryAction.label}
                                </button>
                                <p className="text-[11px] leading-4 text-slate-400">
                                  HR pregled za ovu procjenu još nije dostupan.
                                </p>
                              </div>
                            ) : (
                              <details
                                className="group w-[16rem] rounded-[1.2rem] border border-slate-200 bg-white/85 shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
                                id={`row-action-${row.participant.id}`}
                                open={openAttemptFor === row.participant.id}
                              >
                                <summary className="cursor-pointer list-none rounded-[1.2rem] px-4 py-3 [&::-webkit-details-marker]:hidden">
                                  <span className="inline-flex min-h-0 rounded-full border border-teal-700 bg-teal-600 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white shadow-[0_16px_30px_rgba(13,148,136,0.22)] transition-all duration-200 group-open:bg-teal-700">
                                    {row.primaryAction.label}
                                  </span>
                                </summary>
                                <form
                                  action={createStandardAssessmentBattery}
                                  className="space-y-4 border-t border-slate-200/90 px-4 py-4"
                                >
                                  <input name="participantId" type="hidden" value={row.participant.id} />
                                  <div className="rounded-[1rem] border border-slate-200 bg-slate-50/80 px-4 py-3">
                                    <p className="text-sm font-semibold text-slate-900">Standardna baterija</p>
                                    <ul className="mt-2 space-y-2 text-sm text-slate-600">
                                      {standardBatteryTests.map((test) => (
                                        <li key={test.id} className="flex items-center justify-between gap-3">
                                          <span>{getStandardBatteryShortLabel(test.slug)}</span>
                                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                                            Dostupno
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700" htmlFor={`attempt-locale-${row.participant.id}`}>
                                      Jezik
                                    </label>
                                    <select
                                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-500/15"
                                      defaultValue={toLegacyAssessmentLocale(DEFAULT_ASSESSMENT_LOCALE)}
                                      id={`attempt-locale-${row.participant.id}`}
                                      name="locale"
                                      required
                                    >
                                      {SUPPORTED_ASSESSMENT_LOCALES.map((locale) => (
                                        <option key={locale} value={locale}>
                                          {getAssessmentLocaleLabel(locale)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  {openAttemptFor === row.participant.id && message ? (
                                    <p className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                                      {createParticipantDetails ?? message}
                                    </p>
                                  ) : null}
                                  {openAttemptFor === row.participant.id && inlineBatterySuccessMessage ? (
                                    <p className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                                      {inlineBatterySuccessMessage}
                                    </p>
                                  ) : null}
                                  <DashboardActionRow>
                                    <button
                                      className="w-full min-h-0 rounded-full border border-teal-700 bg-teal-600 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_18px_36px_rgba(13,148,136,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-700 hover:shadow-[0_22px_40px_rgba(13,148,136,0.3)]"
                                      type="submit"
                                    >
                                      Kreiraj procjenu
                                    </button>
                                  </DashboardActionRow>
                                </form>
                              </details>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardSectionShell>

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
