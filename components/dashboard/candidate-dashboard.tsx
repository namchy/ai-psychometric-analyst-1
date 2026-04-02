"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { FileText, Play, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { createAssessmentAttempt } from "@/app/(protected)/app/actions";
import {
  DASHBOARD_CONTENT_GRID_CLASS_NAME,
  DASHBOARD_MAIN_CLASS_NAME,
  DASHBOARD_PAGE_SHELL_CLASS_NAME,
  DASHBOARD_PRIMARY_COLUMN_CLASS_NAME,
  DASHBOARD_PRIMARY_COLUMN_STACK_CLASS_NAME,
  DASHBOARD_SIDEBAR_CLASS_NAME,
  DASHBOARD_SIDEBAR_STACK_CLASS_NAME,
  DashboardActionRow,
  DashboardCompactMetaItem,
  DashboardCompactMetaRow,
  DashboardInfoCardShell,
  DashboardSectionHeader,
  DashboardSectionShell,
  DashboardStatusBadge,
} from "@/components/dashboard/primitives";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

type DashboardIconName =
  | "psychology"
  | "work_history"
  | "insights"
  | "groups"
  | "grid_view"
  | "schedule"
  | "task_alt"
  | "trending_up"
  | "biotech"
  | "account_balance"
  | "hub"
  | "search"
  | "notifications"
  | "settings"
  | "arrow_right";

export type CandidateAssessmentCard = {
  testId?: string;
  attemptId?: string;
  answeredQuestions?: number;
  totalQuestions?: number;
  updatedAt?: string;
  title: string;
  description: string;
  status: "Dostupan" | "Nije započet";
  accessState: "paid" | "upgrade" | "roadmap";
  ctaKind: "start" | "resume" | "report" | "upgrade" | "roadmap";
  duration: string;
  secondaryMeta: string;
  icon: DashboardIconName;
  secondaryIcon: DashboardIconName;
  iconBgClassName: string;
  iconColorClassName: string;
  href?: string;
  ctaLabel: string;
  disabled?: boolean;
  availabilityNote?: string;
};

export type CandidateDashboardInitialAttempt = {
  id: string;
  test_id: string;
  status: DashboardAttemptStatus;
  responseCount: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  total_time_seconds: number | null;
};

type CandidateDashboardViewProps = {
  userEmail: string;
  userName?: string | null;
  showHrLink: boolean;
  hasLinkedParticipant: boolean;
  linkedOrganizationId?: string | null;
  initialAttempts: CandidateDashboardInitialAttempt[];
};

type DashboardAttemptStatus = "in_progress" | "completed" | "abandoned";

type DashboardTestCategory = "personality" | "behavioral" | "cognitive";

type DashboardTestStatus = "draft" | "active" | "archived";

type DashboardRelation<T> = T | T[] | null;

type DashboardTestRow = {
  id: string;
  slug: string;
  name: string;
  category: DashboardTestCategory;
  description: string | null;
  status: DashboardTestStatus;
  scoring_method: string;
  duration_minutes: number | null;
  is_active: boolean;
};

type DashboardAttemptRow = {
  id: string;
  test_id: string;
  status: DashboardAttemptStatus;
  responseCount: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  total_time_seconds: number | null;
  tests: DashboardRelation<DashboardTestRow>;
};

type DashboardDimensionScoreRow = {
  attempt_id: string;
  normalized_score: number | string | null;
};

type DashboardQuestionRow = {
  test_id: string;
};

type DashboardOrganizationTestAccessRow = {
  organization_id: string;
  test_id: string;
};

const KPI_CARDS: Array<{
  label: string;
  icon: DashboardIconName;
  iconClassName: string;
  iconBgClassName: string;
  accent?: boolean;
  status?: boolean;
}> = [
  {
    label: "Završeni testovi",
    icon: "task_alt",
    iconClassName: "text-blue-400",
    iconBgClassName: "bg-blue-400/10",
  },
  {
    label: "Ukupno vrijeme",
    icon: "schedule",
    iconClassName: "text-purple-400",
    iconBgClassName: "bg-purple-400/10",
  },
  {
    label: "Prosječni rezultat",
    icon: "trending_up",
    iconClassName: "text-teal-400",
    iconBgClassName: "bg-teal-400/10",
    accent: true,
  },
  {
    label: "Status profila",
    icon: "psychology",
    iconClassName: "text-orange-400",
    iconBgClassName: "bg-orange-400/10",
    status: true,
  },
];

const PRIMARY_NAV_ITEMS = ["Testovi", "Reports"] as const;

const ROADMAP_TESTS = [
  {
    title: "Leadership 360",
    description: "Višeslojna procjena liderskog uticaja i razvojnih obrazaca za naprednije timove.",
    durationMinutes: 35,
    category: "behavioral" as const,
  },
  {
    title: "Culture Fit",
    description: "Procjena usklađenosti radnih preferencija sa timskom i organizacijskom kulturom.",
    durationMinutes: 20,
    category: "personality" as const,
  },
] as const;

function getLatestAttemptForTestByStatus(
  testId: string,
  status: DashboardAttemptStatus,
  attempts: DashboardAttemptRow[],
): DashboardAttemptRow | null {
  const matchingAttempts = attempts.filter(
    (attempt) => attempt.test_id === testId && attempt.status === status,
  );

  if (matchingAttempts.length === 0) {
    return null;
  }

  return [...matchingAttempts].sort(
    (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
  )[0] ?? null;
}

function formatRelativeActivity(timestamp: string): string {
  const target = new Date(timestamp).getTime();

  if (Number.isNaN(target)) {
    return "upravo sada";
  }

  const diffMs = target - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const rtf = new Intl.RelativeTimeFormat("bs", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, "day");
}

function formatTotalHours(totalSeconds: number): string {
  return `${(totalSeconds / 3600).toFixed(1)}h`;
}

function formatAverageScore(value: number): string {
  return `${Math.round(value)}%`;
}

function formatProcjenaCount(count: number): string {
  const absoluteCount = Math.abs(count);
  const lastTwoDigits = absoluteCount % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "procjena";
  }

  const lastDigit = absoluteCount % 10;

  if (lastDigit === 1) {
    return "procjena";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "procjene";
  }

  return "procjena";
}

function formatDurationLabel(durationMinutes: number | null): string {
  if (!durationMinutes || durationMinutes <= 0) {
    return "Vrijeme uskoro";
  }

  return `${durationMinutes} min`;
}

function getCategoryLabel(category: DashboardTestCategory): string {
  switch (category) {
    case "behavioral":
      return "Ponašanje";
    case "cognitive":
      return "Kognitivni";
    default:
      return "Ličnost";
  }
}

function getCategoryVisuals(category: DashboardTestCategory): Pick<
  CandidateAssessmentCard,
  "icon" | "secondaryIcon" | "iconBgClassName" | "iconColorClassName"
> {
  switch (category) {
    case "behavioral":
      return {
        icon: "groups",
        secondaryIcon: "hub",
        iconBgClassName: "assessment-card__icon-tile--secondary",
        iconColorClassName: "assessment-card__icon-color--aqua",
      };
    case "cognitive":
      return {
        icon: "insights",
        secondaryIcon: "trending_up",
        iconBgClassName: "assessment-card__icon-tile--cyan",
        iconColorClassName: "assessment-card__icon-color--cyan",
      };
    default:
      return {
        icon: "psychology",
        secondaryIcon: "task_alt",
        iconBgClassName: "assessment-card__icon-tile--primary",
        iconColorClassName: "assessment-card__icon-color--teal",
      };
  }
}

function buildAssessmentCardsFromTests(
  tests: DashboardTestRow[],
  attempts: DashboardAttemptRow[],
  accessRows: DashboardOrganizationTestAccessRow[],
  questionCountsByTestId: Map<string, number>,
): CandidateAssessmentCard[] {
  const accessibleTestIds = new Set(accessRows.map((row) => row.test_id));
  const databaseCards: CandidateAssessmentCard[] = tests.map((test) => {
    const inProgressAttempt = getLatestAttemptForTestByStatus(test.id, "in_progress", attempts);
    const completedAttempt = getLatestAttemptForTestByStatus(test.id, "completed", attempts);
    const visuals = getCategoryVisuals(test.category);
    const totalQuestions = questionCountsByTestId.get(test.id) ?? 0;
    const isReadyForRun = totalQuestions > 0;
    const hasPaidAccess =
      test.is_active && test.status === "active" && accessibleTestIds.has(test.id);

    let href: string | undefined;
    let attemptId: string | undefined;
    let ctaKind: CandidateAssessmentCard["ctaKind"] = hasPaidAccess ? "start" : "upgrade";
    let ctaLabel = hasPaidAccess ? "Započni procjenu" : "Upgrade to Access";
    let disabled = !hasPaidAccess;
    let availabilityNote: string | undefined;

    if (inProgressAttempt) {
      attemptId = inProgressAttempt.id;
      href = `/app/attempts/${inProgressAttempt.id}/run`;
      ctaKind = "resume";
      ctaLabel = "Nastavi procjenu";
      disabled = false;
    } else if (completedAttempt) {
      attemptId = completedAttempt.id;
      href = `/app/attempts/${completedAttempt.id}/report`;
      ctaKind = "report";
      ctaLabel = "Vidi rezultate";
      disabled = false;
    } else if (hasPaidAccess) {
      if (isReadyForRun) {
        ctaKind = "start";
        ctaLabel = "Započni procjenu";
        disabled = false;
      } else {
        ctaKind = "start";
        ctaLabel = "Trenutno nije dostupno";
        disabled = true;
        availabilityNote = "Test još nije spreman za pokretanje.";
      }
    }

    return {
      testId: test.id,
      attemptId,
      answeredQuestions:
        inProgressAttempt?.responseCount ?? completedAttempt?.responseCount ?? undefined,
      totalQuestions,
      updatedAt: inProgressAttempt?.updated_at ?? completedAttempt?.updated_at,
      title: test.name,
      description: test.description?.trim() || "Opis testa će biti dostupan uskoro.",
      accessState: hasPaidAccess ? "paid" : "upgrade",
      ctaKind,
      status: hasPaidAccess ? "Dostupan" : "Nije započet",
      duration: formatDurationLabel(test.duration_minutes),
      secondaryMeta: getCategoryLabel(test.category),
      href,
      ctaLabel,
      disabled,
      availabilityNote,
      ...visuals,
    };
  });

  const roadmapCards: CandidateAssessmentCard[] = ROADMAP_TESTS.map((test) => ({
    title: test.title,
    description: test.description,
    accessState: "roadmap",
    ctaKind: "roadmap",
    status: "Nije započet",
    duration: formatDurationLabel(test.durationMinutes),
    secondaryMeta: "U planu",
    ctaLabel: "Uskoro",
    disabled: true,
    ...getCategoryVisuals(test.category),
  }));

  return [...databaseCards, ...roadmapCards];
}

function mapInitialAttemptsToDashboardAttempts(
  attempts: CandidateDashboardInitialAttempt[],
): DashboardAttemptRow[] {
  return attempts.map((attempt) => ({
    ...attempt,
    tests: null,
  }));
}

function DashboardIcon({ name, className }: { name: DashboardIconName; className?: string }) {
  const props = {
    "aria-hidden": true,
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  switch (name) {
    case "psychology":
      return (
        <svg {...props}>
          <path d="M12 3a6 6 0 0 0-6 6c0 2.5 1.2 3.8 2.5 5.1 1.1 1.1 1.5 2 1.5 3.9" />
          <path d="M12 3a6 6 0 0 1 6 6c0 2.5-1.2 3.8-2.5 5.1-1.1 1.1-1.5 2-1.5 3.9" />
          <path d="M9 21h6" />
          <path d="M10 17h4" />
          <path d="M10.5 8.5c.6-1 2.2-1.2 3-.3.8.8.6 2.3-.3 3l-1.2 1" />
        </svg>
      );
    case "work_history":
      return (
        <svg {...props}>
          <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
          <rect x="4" y="7" width="16" height="12" rx="2" />
          <path d="M4 12h16" />
          <path d="M10 15h4" />
        </svg>
      );
    case "insights":
      return (
        <svg {...props}>
          <path d="M5 19V10" />
          <path d="M12 19V5" />
          <path d="M19 19v-8" />
        </svg>
      );
    case "groups":
      return (
        <svg {...props}>
          <path d="M16.5 20a3.5 3.5 0 0 0-7 0" />
          <circle cx="13" cy="11" r="3" />
          <path d="M3.5 20a3 3 0 0 1 4-2.82" />
          <circle cx="7" cy="12" r="2.5" />
        </svg>
      );
    case "grid_view":
      return (
        <svg {...props}>
          <rect x="4" y="4" width="6" height="6" rx="1.2" />
          <rect x="14" y="4" width="6" height="6" rx="1.2" />
          <rect x="4" y="14" width="6" height="6" rx="1.2" />
          <rect x="14" y="14" width="6" height="6" rx="1.2" />
        </svg>
      );
    case "schedule":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 2.5" />
        </svg>
      );
    case "task_alt":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="m8.5 12 2.2 2.2 4.8-4.8" />
        </svg>
      );
    case "trending_up":
      return (
        <svg {...props}>
          <path d="M5 16 10 11l3 3 6-6" />
          <path d="M14 8h5v5" />
        </svg>
      );
    case "biotech":
      return (
        <svg {...props}>
          <path d="M9 3v6" />
          <path d="M15 3v6" />
          <path d="M8 9h8" />
          <path d="M8 9v4a4 4 0 0 0 8 0V9" />
          <path d="M10 17h4" />
          <path d="M9 21h6" />
        </svg>
      );
    case "account_balance":
      return (
        <svg {...props}>
          <path d="M4 9h16" />
          <path d="M6 9v7" />
          <path d="M12 9v7" />
          <path d="M18 9v7" />
          <path d="M3 20h18" />
          <path d="m12 4 8 4H4l8-4Z" />
        </svg>
      );
    case "hub":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="2.2" />
          <circle cx="6" cy="7" r="2" />
          <circle cx="18" cy="7" r="2" />
          <circle cx="18" cy="17" r="2" />
          <path d="M8 8.2 10.4 10" />
          <path d="M14 10 16 8.2" />
          <path d="M14 14l2 1.8" />
        </svg>
      );
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      );
    case "notifications":
      return (
        <svg {...props}>
          <path d="M6 15h12" />
          <path d="M8 15V11a4 4 0 1 1 8 0v4" />
          <path d="M10 18a2 2 0 0 0 4 0" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="2.8" />
          <path d="M12 4.5v1.3" />
          <path d="M12 18.2v1.3" />
          <path d="m6.7 6.7.9.9" />
          <path d="m16.4 16.4.9.9" />
          <path d="M4.5 12h1.3" />
          <path d="M18.2 12h1.3" />
          <path d="m6.7 17.3.9-.9" />
          <path d="m16.4 7.6.9-.9" />
        </svg>
      );
    case "arrow_right":
      return (
        <svg {...props}>
          <path d="M5 12h14" />
          <path d="m13 7 5 5-5 5" />
        </svg>
      );
    default:
      return null;
  }
}

function getIconTileClassName(iconBgClassName: string): string {
  switch (iconBgClassName) {
    case "assessment-card__icon-tile--primary":
      return "bg-primary/10";
    case "assessment-card__icon-tile--tertiary":
      return "bg-tertiary/10";
    case "assessment-card__icon-tile--cyan":
      return "bg-primary-container/10";
    case "assessment-card__icon-tile--secondary":
      return "bg-secondary/10";
    case "assessment-card__icon-tile--coral":
      return "bg-tertiary-fixed/10";
    default:
      return "bg-white/5";
  }
}

function getIconColorClassName(iconColorClassName: string): string {
  switch (iconColorClassName) {
    case "assessment-card__icon-color--teal":
      return "text-primary-fixed";
    case "assessment-card__icon-color--coral-muted":
      return "text-tertiary-fixed-dim";
    case "assessment-card__icon-color--cyan":
      return "text-secondary-fixed";
    case "assessment-card__icon-color--aqua":
      return "text-secondary-fixed-dim";
    case "assessment-card__icon-color--coral":
      return "text-tertiary-fixed";
    default:
      return "text-white";
  }
}

function TopNav({
  userEmail,
  userName,
}: {
  userEmail: string;
  userName?: string | null;
}) {
  const initialsSource = userName?.trim() || userEmail;
  const initials = initialsSource
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="fixed top-0 z-50 w-full border-b border-slate-300/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.94),rgba(243,247,251,0.9))] shadow-[0_16px_40px_rgba(15,23,42,0.07)] backdrop-blur-xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-200/70 to-transparent"
      />
      <div className="mx-auto flex h-16 w-full max-w-full items-center justify-between px-4 sm:px-6 lg:px-12">
        <div className="flex min-w-0 items-center gap-6 lg:gap-10">
          <Link
            href="/app"
            className="shrink-0 font-headline text-lg font-bold tracking-[-0.04em] text-slate-900 transition-opacity hover:opacity-90 sm:text-xl"
          >
            Deep Profile
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-2 lg:flex">
            {PRIMARY_NAV_ITEMS.map((item) => (
              <span
                key={item}
                className={
                  item === "Testovi"
                    ? "rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                    : "rounded-full px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:bg-white hover:text-slate-900"
                }
              >
                {item}
              </span>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
          <button
            aria-label="Settings"
            className="min-h-0 rounded-xl border border-transparent bg-transparent p-2 text-slate-500 shadow-none transition-all duration-200 hover:border-slate-200 hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            type="button"
          >
            <DashboardIcon className="h-5 w-5" name="settings" />
          </button>

          <div className="ml-1 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/80 bg-gradient-to-br from-teal-500 to-violet-400 text-xs font-bold text-white shadow-[0_10px_24px_rgba(20,184,166,0.22)]">
            <span>{initials || "LU"}</span>
          </div>

          <form action={logout} className="hidden md:block">
            <button
              className="min-h-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-label font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-all duration-200 hover:border-teal-200 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              type="submit"
            >
              Odjava
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function DashboardHeader() {
  return (
    <DashboardSectionShell className="w-full">
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
      <DashboardSectionHeader
        className="relative"
        eyebrow="Assessment workspace"
        eyebrowClassName="text-teal-800/90"
        title="Dostupni testovi"
        titleClassName="mt-3 text-3xl font-extrabold tracking-[-0.05em] sm:text-4xl"
        description="Pokrenite aktivne procjene i odvojeno pregledajte testove koji još nisu dostupni."
        descriptionClassName="mt-2 max-w-2xl"
      />
    </DashboardSectionShell>
  );
}

function WelcomeOverviewCard({
  totalAssigned,
  completedCount,
}: {
  totalAssigned: number;
  completedCount: number;
}) {
  const remainingCount = Math.max(totalAssigned - completedCount, 0);
  const progressPercent = totalAssigned > 0 ? Math.min((completedCount / totalAssigned) * 100, 100) : 0;

  return (
    <DashboardSectionShell className="border-slate-300/90 bg-[linear-gradient(160deg,rgba(255,255,255,1),rgba(243,248,249,0.99)_62%,rgba(246,242,255,0.97))] shadow-[0_30px_58px_rgba(15,23,42,0.12)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 bottom-0 h-28 w-28 rounded-full bg-teal-100/50 blur-3xl"
      />
      <DashboardSectionHeader
        className="relative"
        eyebrow="Overview"
        eyebrowClassName="text-teal-800/90"
        title="Tvoj napredak"
        titleClassName="mt-3 text-[1.9rem] tracking-[-0.045em]"
      />
      <p className="relative mt-4 text-sm font-semibold text-slate-900">
        Završeno: {completedCount} {formatProcjenaCount(completedCount)}
      </p>
      <div className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200/90">
        <div
          aria-hidden="true"
          className="h-full rounded-full bg-teal-600 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="relative mt-4 text-sm font-semibold text-slate-700">
        Preostalo: {remainingCount} {formatProcjenaCount(remainingCount)}
      </p>
    </DashboardSectionShell>
  );
}

function QuickActionCard({
  disabled,
  title,
}: {
  disabled: boolean;
  title?: string;
}) {
  return (
    <DashboardSectionShell className="border-slate-300/90 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,244,255,0.97))] shadow-[0_24px_48px_rgba(15,23,42,0.1)] sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-violet-50/70 to-transparent"
      />
      <DashboardSectionHeader
        className="relative"
        eyebrow="Quick action"
        eyebrowClassName="text-violet-700"
        title="Initialize AI Analyst"
        titleClassName="mt-3 text-xl"
      />
      <p className="relative mt-2 font-body text-sm leading-6 text-slate-700">
        CTA ostaje pripremljen za izvještaje, bez nove backend logike u ovoj iteraciji.
      </p>
      <div className="relative mt-4 rounded-2xl border border-violet-100 bg-white/70 px-4 py-3">
        <p className="text-[11px] font-medium leading-5 text-slate-600">
          Izvještaj će biti dostupan kada završiš kompletnu bateriju testova.
        </p>
      </div>
      <DashboardActionRow className="relative mt-5">
        <button
          className={`flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] transition-all ${disabled ? "border-slate-300 bg-slate-100 text-slate-400 opacity-85" : "border-violet-300 bg-white text-violet-800 shadow-[0_12px_24px_rgba(76,29,149,0.08)] hover:border-violet-400 hover:bg-violet-50"}`}
          disabled={disabled}
          title={title}
          type="button"
        >
          <span>Initialize AI Analyst</span>
          <DashboardIcon className="h-4 w-4" name="arrow_right" />
        </button>
      </DashboardActionRow>
    </DashboardSectionShell>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
      <div className="lg:h-full lg:border-r lg:border-slate-200 lg:pr-12">
        <aside className="w-full space-y-5 lg:top-24">
          <div className="mb-4 h-3 w-28 animate-pulse rounded-full bg-slate-200" />
          <div className="rounded-[1.75rem] border border-white/80 bg-white/80 p-6 sm:p-7">
            <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-4 h-10 w-2/3 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-slate-200" />
            <div className="mt-2 h-4 w-5/6 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
              <div className="h-3 w-16 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-3 h-4 w-3/4 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-2 h-4 w-1/2 animate-pulse rounded-full bg-slate-200" />
            </div>
          </div>

          <section aria-label="Dashboard overview" className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                className="rounded-[1.75rem] border border-white/80 bg-white/80 p-5 shadow-[0_16px_27px_rgba(15,23,42,0.05)] sm:p-6"
                key={`kpi-skeleton-${index}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200" />
                  <div className="h-11 w-11 animate-pulse rounded-2xl bg-slate-200" />
                </div>
                <div className="mt-4 h-9 w-16 animate-pulse rounded-full bg-slate-200" />
              </div>
            ))}
          </section>

          <div className="rounded-[1.75rem] border border-white/80 bg-white/80 p-6">
            <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-4 h-7 w-2/3 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-slate-200" />
            <div className="mt-2 h-4 w-5/6 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-5 h-11 w-full animate-pulse rounded-full bg-slate-200" />
          </div>
        </aside>
      </div>

      <section aria-label="Assessments" className="min-w-0 w-full">
        <div className="space-y-6">
          <div className="mb-4 h-3 w-32 animate-pulse rounded-full bg-slate-200" />
          <div className="w-full rounded-[1.75rem] border border-white/80 bg-white/80 p-6 sm:p-7">
            <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-4 h-10 w-1/2 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-slate-200" />
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded-full bg-slate-200" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:gap-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                className="rounded-[1.75rem] border border-white/80 bg-white/80 p-5"
                key={`assessment-skeleton-${index}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="h-14 w-14 animate-pulse rounded-[1.25rem] bg-slate-200" />
                  <div className="h-8 w-24 animate-pulse rounded-full bg-slate-200" />
                </div>
                <div className="mt-5 h-7 w-2/3 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-slate-200" />
                <div className="mt-2 h-4 w-5/6 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-5 border-t border-slate-200 pt-4">
                  <div className="h-4 w-1/3 animate-pulse rounded-full bg-slate-200" />
                </div>
                <div className="mt-6 h-11 w-full animate-pulse rounded-full bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function AssessmentSection({
  title,
  description,
  assessments,
  linkedOrganizationId,
  muted = false,
  hideSectionHeader = false,
}: {
  title: string;
  description: string;
  assessments: CandidateAssessmentCard[];
  linkedOrganizationId?: string | null;
  muted?: boolean;
  hideSectionHeader?: boolean;
}) {
  if (assessments.length === 0) {
    return null;
  }

  return (
    <section className={muted ? "mt-10" : "mt-6"}>
      {!hideSectionHeader ? (
        <DashboardSectionHeader className="mb-5" title={title} description={description} />
      ) : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:gap-5">
        {assessments.map((assessment) => (
          <AssessmentCard
            assessment={assessment}
            key={assessment.title}
            linkedOrganizationId={linkedOrganizationId}
            muted={muted}
          />
        ))}
      </div>
    </section>
  );
}

function AssessmentCard({
  assessment,
  linkedOrganizationId,
  muted = false,
  primary = false,
}: {
  assessment: CandidateAssessmentCard;
  linkedOrganizationId?: string | null;
  muted?: boolean;
  primary?: boolean;
}) {
  const router = useRouter();
  const [isCreatingAttempt, setIsCreatingAttempt] = useState(false);
  const iconTileClassName = getIconTileClassName(assessment.iconBgClassName);
  const iconColorClassName = getIconColorClassName(assessment.iconColorClassName);
  const isPaid = assessment.accessState === "paid";
  const isInteractive =
    isPaid &&
    !assessment.disabled &&
    (assessment.ctaKind === "start" ? Boolean(assessment.testId) : Boolean(assessment.href));
  const canCreateAttempt =
    isPaid &&
    !assessment.disabled &&
    assessment.ctaKind === "start" &&
    Boolean(assessment.testId);
  const badgeClassName =
    isPaid && !muted
      ? "border-teal-300 bg-teal-50 text-teal-800"
      : "border-slate-300 bg-slate-100 text-slate-600";
  const cardClassName = muted
    ? "border-slate-300/80 bg-white/82 shadow-[0_16px_27px_rgba(15,23,42,0.06)] hover:border-slate-400/70 hover:shadow-[0_20px_31px_rgba(15,23,42,0.08)]"
    : assessment.accessState === "upgrade"
      ? "border-slate-300/90 bg-slate-50"
      : assessment.accessState === "roadmap"
        ? "border-violet-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,243,255,0.98))] shadow-[0_18px_31px_rgba(76,29,149,0.06)]"
        : primary
          ? "border-teal-300/80 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(240,249,248,0.98))] shadow-[0_30px_61px_rgba(15,23,42,0.14)] hover:border-teal-400 hover:shadow-[0_34px_65px_rgba(20,184,166,0.16)]"
          : "border-slate-300/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,250,251,0.98))] shadow-[0_20px_37px_rgba(15,23,42,0.09)] hover:border-teal-300 hover:shadow-[0_24px_42px_rgba(20,184,166,0.12)]";
  const descriptionClassName = muted ? "text-slate-600" : "text-slate-700";
  const metaClassName = muted ? "text-slate-700" : "text-slate-800";
  const answeredQuestions = assessment.answeredQuestions ?? 0;
  const totalQuestions = assessment.totalQuestions ?? 0;
  const progressPercent =
    totalQuestions > 0 ? Math.min(100, Math.round((answeredQuestions / totalQuestions) * 100)) : 0;
  const relativeActivity = assessment.updatedAt ? formatRelativeActivity(assessment.updatedAt) : null;

  async function handleCreateAttempt() {
    if (!assessment.testId || isCreatingAttempt) {
      return;
    }

    setIsCreatingAttempt(true);

    try {
      const attemptId = await createAssessmentAttempt(
        assessment.testId,
        linkedOrganizationId ?? undefined,
      );
      router.push(`/app/attempts/${attemptId}/run`);
    } catch {
      alert("Greška pri kreiranju pokušaja. Molimo pokušajte ponovo.");
      setIsCreatingAttempt(false);
    }
  }

  function handleNavigate() {
    if (!assessment.href) {
      return;
    }

    router.push(assessment.href);
  }

  function renderActionIcon() {
    if (isCreatingAttempt) {
      return <LoaderCircle className="h-4 w-4 animate-spin" />;
    }

    switch (assessment.ctaKind) {
      case "resume":
        return <RotateCcw className="h-4 w-4" />;
      case "report":
        return <FileText className="h-4 w-4" />;
      case "start":
        return <Play className="h-4 w-4" />;
      default:
        return <DashboardIcon className="h-4 w-4" name="arrow_right" />;
    }
  }

  return (
    <article
      className={`group flex h-full flex-col rounded-[1.5rem] border p-4 transition-all duration-300 hover:-translate-y-0.5 sm:p-5 ${primary ? "md:p-6" : ""} ${cardClassName}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div
          className={`rounded-[1.25rem] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${primary ? "ring-1 ring-teal-200/80" : ""} ${iconTileClassName} ${muted ? "opacity-75" : ""}`}
        >
          <DashboardIcon className={`h-6 w-6 ${iconColorClassName} sm:h-7 sm:w-7`} name={assessment.icon} />
        </div>
        <DashboardStatusBadge
          className={badgeClassName}
          emphasized={primary}
          tone="neutral"
        >
          {assessment.status}
        </DashboardStatusBadge>
      </div>

      <div className="flex flex-1 flex-col">
        <h3 className={`font-headline font-bold tracking-[-0.04em] ${primary ? "text-[1.6rem]" : "text-[1.38rem]"} ${muted ? "text-slate-900" : "text-slate-950"}`}>
          {assessment.title}
        </h3>
        <p className={`mt-2 min-h-0 font-body ${primary ? "text-[15px] leading-7" : "text-sm leading-6"} ${muted ? "text-slate-600" : descriptionClassName}`}>
          {assessment.description}
        </p>

        <DashboardCompactMetaRow
          className={primary ? "border-slate-300" : muted ? "border-slate-300" : "border-slate-200"}
        >
          <DashboardCompactMetaItem className={muted ? "text-slate-700" : metaClassName}>
            <DashboardIcon className={`h-4 w-4 ${primary || muted ? "text-slate-500" : "text-slate-400"}`} name="schedule" />
            {assessment.duration}
          </DashboardCompactMetaItem>
          <DashboardCompactMetaItem className={muted ? "text-slate-700" : metaClassName}>
            <DashboardIcon className={`h-4 w-4 ${primary || muted ? "text-slate-500" : "text-slate-400"}`} name={assessment.secondaryIcon} />
            {assessment.secondaryMeta}
          </DashboardCompactMetaItem>
        </DashboardCompactMetaRow>

        {assessment.ctaKind === "resume" ? (
          <div className="mb-4">
            <p className="mb-2 text-xs text-slate-600">
              {answeredQuestions} / {totalQuestions} pitanja
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-teal-600 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {relativeActivity ? (
              <p className="mt-2 text-[10px] italic text-slate-600">
                Zadnja aktivnost: {relativeActivity}
              </p>
            ) : null}
          </div>
        ) : assessment.ctaKind === "report" ? (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">Završeno</p>
            {relativeActivity ? (
              <p className="mt-2 text-[10px] italic text-slate-600">Završeno: {relativeActivity}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {canCreateAttempt ? (
        <DashboardActionRow>
          <button
            className={`flex w-full items-center justify-center gap-2 rounded-full border border-teal-700 bg-teal-600 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white shadow-[0_18px_36px_rgba(13,148,136,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-700 hover:shadow-[0_22px_40px_rgba(13,148,136,0.3)] focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:ring-offset-0 disabled:cursor-wait disabled:opacity-80 ${primary ? "sm:text-[13px]" : ""}`}
            disabled={isCreatingAttempt}
            onClick={() => {
              void handleCreateAttempt();
            }}
            type="button"
          >
            <span>{isCreatingAttempt ? "Učitavam..." : assessment.ctaLabel}</span>
            {renderActionIcon()}
          </button>
        </DashboardActionRow>
      ) : !isInteractive ? (
        <DashboardActionRow className="stack-xs">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-slate-100 py-3 text-sm font-bold uppercase tracking-[0.16em] text-slate-500 opacity-90"
            disabled
            type="button"
          >
            <span>{assessment.ctaLabel}</span>
            <DashboardIcon className="h-4 w-4" name="arrow_right" />
          </button>
          {assessment.availabilityNote ? (
            <p className="text-xs text-slate-600">{assessment.availabilityNote}</p>
          ) : null}
        </DashboardActionRow>
      ) : (
        <DashboardActionRow>
          <button
            className={`flex w-full items-center justify-center gap-2 rounded-full border border-teal-700 bg-teal-600 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white shadow-[0_18px_36px_rgba(13,148,136,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-700 hover:shadow-[0_22px_40px_rgba(13,148,136,0.3)] focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:ring-offset-0 ${primary ? "sm:text-[13px]" : ""}`}
            onClick={handleNavigate}
            type="button"
          >
            <span>{assessment.ctaLabel}</span>
            {renderActionIcon()}
          </button>
        </DashboardActionRow>
      )}
    </article>
  );
}

function LoaderCircle({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M21 12a9 9 0 1 1-6.22-8.56" />
    </svg>
  );
}

function DashboardStatCard({
  label,
  value,
  icon,
  iconClassName,
  iconBgClassName,
  loading = false,
  accent,
  status,
}: {
  label: string;
  value: string;
  icon: DashboardIconName;
  iconClassName: string;
  iconBgClassName: string;
  loading?: boolean;
  accent?: boolean;
  status?: boolean;
}) {
  return (
    <DashboardInfoCardShell>
      <div className="flex items-start justify-between gap-4">
        <p className="font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500/85">
          {label}
        </p>
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconBgClassName}`}
        >
          <DashboardIcon className={`h-5 w-5 ${iconClassName}`} name={icon} />
        </span>
      </div>
      {loading && !status ? (
        <div className="mt-5 flex min-h-[3.1rem] items-center">
          <LoaderCircle className="h-7 w-7 animate-spin text-slate-500" />
        </div>
      ) : status ? (
        <p className="mt-5 inline-flex min-h-[3.1rem] items-center gap-2.5 text-[1.5rem] font-bold tracking-[-0.035em] text-slate-950 sm:text-[1.7rem]">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_0_4px_rgba(34,197,94,0.14)]" />
          {value}
        </p>
      ) : (
        <p
          className={`mt-5 min-h-[3.1rem] text-[2.25rem] font-extrabold tracking-[-0.055em] leading-none sm:text-[2.45rem] ${accent ? "text-teal-700" : "text-slate-950"}`}
        >
          {value}
        </p>
      )}
    </DashboardInfoCardShell>
  );
}

function DashboardFooter({
  showHrLink,
}: {
  showHrLink: boolean;
}) {
  return (
    <footer className="border-t border-slate-200/80 bg-transparent">
      <div className="flex w-full flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-12">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
          <p className="font-label text-[11px] uppercase tracking-[0.16em] text-slate-600">
            © 2024 Luminescent. All rights reserved.
          </p>
          {showHrLink ? (
            <Link
              className="font-label text-[11px] uppercase tracking-[0.16em] text-slate-600 transition-colors duration-200 hover:text-teal-700"
              href="/hr"
            >
              HR Workspace
            </Link>
          ) : null}
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
      </div>
    </footer>
  );
}

function EmptyState() {
  return (
    <section className="rounded-[1.75rem] border border-white/80 bg-white/85 p-8 shadow-[0_24px_48px_rgba(15,23,42,0.07)] md:p-10">
      <h2 className="font-headline text-2xl font-bold tracking-tight text-slate-900">
        Kandidat profil još nije povezan
      </h2>
      <p className="mt-4 max-w-2xl font-body text-sm leading-7 text-slate-600">
        Ovaj nalog trenutno nema povezan kandidat profil, pa procjene još nisu dostupne.
      </p>
      <p className="mt-2 max-w-2xl font-body text-sm leading-7 text-slate-600">
        Dok se povezivanje ne završi, ovdje se neće prikazati dostupni testovi ni izvještaji.
      </p>
    </section>
  );
}

export function CandidateDashboardView({
  userEmail,
  userName,
  showHrLink,
  hasLinkedParticipant,
  linkedOrganizationId,
  initialAttempts,
}: CandidateDashboardViewProps) {
  const [isLoading, setIsLoading] = useState(hasLinkedParticipant);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [liveAssessments, setLiveAssessments] = useState<CandidateAssessmentCard[]>([]);
  const [completedAttempts, setCompletedAttempts] = useState(0);
  const [totalPaidTestsCount, setTotalPaidTestsCount] = useState(0);
  const [completedTestsCount, setCompletedTestsCount] = useState<string>("0");
  const [totalHours, setTotalHours] = useState<string>("0.0h");
  const [averageScore, setAverageScore] = useState<string>("0%");

  useEffect(() => {
    if (!hasLinkedParticipant) {
      setIsLoading(false);
      return;
    }

    if (!linkedOrganizationId) {
      setIsLoading(false);
      setLoadError("Linked organization is required to load test access.");
      return;
    }

    const organizationId = linkedOrganizationId;

    let isCancelled = false;

    async function loadDashboardData() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const supabase = getSupabaseBrowserClient();
        const mappedAttempts = mapInitialAttemptsToDashboardAttempts(initialAttempts);
        const attemptIds = mappedAttempts.map((attempt) => attempt.id);

        const [
          { data: testsData, error: testsError },
          { data: accessData, error: accessError },
        ] = await Promise.all([
          supabase
            .from("tests")
            .select(
              "id, slug, name, category, description, status, scoring_method, duration_minutes, is_active",
            )
            .order("created_at", { ascending: true }),
          supabase
            .from("organization_test_access")
            .select("organization_id, test_id")
            .eq("organization_id", organizationId),
        ]);
        if (testsError) {
          throw new Error(testsError.message);
        }

        if (accessError) {
          throw new Error(accessError.message);
        }

        let dimensionScoreRows: DashboardDimensionScoreRow[] = [];

        const testIds = ((testsData ?? []) as DashboardTestRow[]).map((test) => test.id);
        let questionRows: DashboardQuestionRow[] = [];

        if (testIds.length > 0) {
          const { data: questionsData, error: questionsError } = await supabase
            .from("questions")
            .select("test_id")
            .in("test_id", testIds);

          if (questionsError) {
            throw new Error(questionsError.message);
          }

          questionRows = (questionsData ?? []) as DashboardQuestionRow[];
        }

        if (attemptIds.length > 0) {
          const { data: dimensionScoresData, error: dimensionScoresError } = await supabase
            .from("dimension_scores")
            .select("attempt_id, normalized_score")
            .in("attempt_id", attemptIds);

          if (dimensionScoresError) {
            throw new Error(dimensionScoresError.message);
          }

          dimensionScoreRows = (dimensionScoresData ?? []) as DashboardDimensionScoreRow[];
        }

        const completedCount = mappedAttempts.filter((attempt) => attempt.status === "completed").length;
        const totalTimeSeconds = mappedAttempts.reduce(
          (sum, attempt) => sum + (attempt.total_time_seconds ?? 0),
          0,
        );
        const normalizedScores = dimensionScoreRows
          .map((score) =>
            score.normalized_score === null ? null : Number(score.normalized_score),
          )
          .filter((score): score is number => Number.isFinite(score));
        const normalizedAverage =
          normalizedScores.length > 0
            ? normalizedScores.reduce((sum, score) => sum + score, 0) / normalizedScores.length
            : 0;
        const questionCountsByTestId = questionRows.reduce((counts, question) => {
          counts.set(question.test_id, (counts.get(question.test_id) ?? 0) + 1);
          return counts;
        }, new Map<string, number>());

        if (isCancelled) {
          return;
        }

        setLiveAssessments(
          buildAssessmentCardsFromTests(
            (testsData ?? []) as DashboardTestRow[],
            mappedAttempts,
            (accessData ?? []) as DashboardOrganizationTestAccessRow[],
            questionCountsByTestId,
          ),
        );
        setTotalPaidTestsCount((accessData ?? []).length);
        setCompletedAttempts(completedCount);
        setCompletedTestsCount(String(completedCount));
        setTotalHours(formatTotalHours(totalTimeSeconds));
        setAverageScore(formatAverageScore(normalizedAverage));
      } catch (error) {
        console.error("--- DASHBOARD FATAL ERROR ---", error);
        if (isCancelled) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : "Failed to load dashboard data.");
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboardData();

    return () => {
      isCancelled = true;
    };
  }, [hasLinkedParticipant, initialAttempts, linkedOrganizationId]);

  const availableAssessments = liveAssessments.filter(
    (assessment) => assessment.accessState === "paid",
  );
  const unavailableAssessments = liveAssessments.filter(
    (assessment) => assessment.accessState !== "paid",
  );
  const isAiAnalystDisabled =
    !(completedAttempts === totalPaidTestsCount && totalPaidTestsCount > 1);
  const aiAnalystTitle =
    totalPaidTestsCount === 1
      ? "Kompozitna analiza zahtijeva bateriju od minimalno 2 testa."
      : completedAttempts < totalPaidTestsCount
        ? `Završite sve dodijeljene testove (${completedAttempts} / ${totalPaidTestsCount}) za dubinsku analizu.`
        : undefined;
  const kpiValues: Record<string, string> = {
    "Završeni testovi": loadError ? "N/A" : completedTestsCount,
    "Ukupno vrijeme": loadError ? "N/A" : totalHours,
    "Prosječni rezultat": loadError ? "N/A" : averageScore,
    "Status profila": "Aktivan",
  };

  return (
    <div
      className={`${plusJakartaSans.className} ${plusJakartaSans.variable} ${DASHBOARD_PAGE_SHELL_CLASS_NAME}`}
      style={
        {
          "--font-manrope": "var(--font-plus-jakarta-sans)",
          "--font-sans":
            "var(--font-plus-jakarta-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
        } as CSSProperties
      }
    >
      <TopNav userEmail={userEmail} userName={userName} />

      <main className={DASHBOARD_MAIN_CLASS_NAME}>
        {hasLinkedParticipant ? (
          isLoading && !loadError ? (
            <DashboardSkeleton />
          ) : (
          <div className={DASHBOARD_CONTENT_GRID_CLASS_NAME}>
            <div className={DASHBOARD_SIDEBAR_CLASS_NAME}>
              <aside className={DASHBOARD_SIDEBAR_STACK_CLASS_NAME}>
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-600">
                  Korisnički profil
                </p>
                <WelcomeOverviewCard
                  completedCount={completedAttempts}
                  totalAssigned={totalPaidTestsCount}
                />

                <section aria-label="Dashboard overview" className="grid grid-cols-2 gap-4">
                  {KPI_CARDS.map((card) => (
                    <DashboardStatCard
                      accent={card.accent}
                      icon={card.icon}
                      iconBgClassName={card.iconBgClassName}
                      iconClassName={card.iconClassName}
                      key={card.label}
                      label={card.label}
                      loading={isLoading && !loadError}
                      status={card.status}
                      value={kpiValues[card.label] ?? "N/A"}
                    />
                  ))}
                </section>

                <QuickActionCard disabled={isAiAnalystDisabled} title={aiAnalystTitle} />
              </aside>
            </div>

            <section aria-label="Assessments" className={DASHBOARD_PRIMARY_COLUMN_CLASS_NAME}>
              <div className={DASHBOARD_PRIMARY_COLUMN_STACK_CLASS_NAME}>
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.22em] text-teal-800/80">
                  Dostupne procjene
                </p>
                <DashboardHeader />
                {availableAssessments.length > 0 ? (
                  <AssessmentSection
                    title="Dostupni testovi"
                    description="Aktivne procjene koje možeš odmah otvoriti i završiti."
                    assessments={availableAssessments}
                    linkedOrganizationId={linkedOrganizationId}
                    hideSectionHeader
                  />
                ) : null}
              </div>

              {!isLoading || Boolean(loadError) ? (
                <AssessmentSection
                  title="Ostali testovi"
                  description="Ove procjene još nisu otključane za tvoj profil."
                  assessments={unavailableAssessments}
                  linkedOrganizationId={linkedOrganizationId}
                  muted
                />
              ) : null}
            </section>
          </div>
          )
        ) : (
          <EmptyState />
        )}
      </main>

      <DashboardFooter showHrLink={showHrLink} />
    </div>
  );
}
