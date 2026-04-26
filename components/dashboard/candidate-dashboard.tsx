"use client";

import { useEffect, useState } from "react";
import { FileText, Play, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { createAssessmentAttempt } from "@/app/(protected)/app/actions";
import {
  getCandidateAssessmentAvailability,
  getCandidateAssessmentCatalogKey,
  type CandidateAssessmentCatalogKey,
} from "@/lib/assessment/availability";
import {
  getAssessmentAttemptLifecycle,
  getSafranScoredRunHref,
  selectPrimaryAttemptForTest,
} from "@/lib/assessment/attempt-lifecycle";
import {
  AuthenticatedAppFooterShell,
  AuthenticatedAppHeaderShell,
  AuthenticatedAppMainContent,
  AuthenticatedAppPageShell,
} from "@/components/app/authenticated-app-chrome";
import {
  DASHBOARD_CONTENT_GRID_CLASS_NAME,
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
import { getAssessmentDisplayName } from "@/lib/assessment/display";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

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
  testSlug?: string;
  attemptId?: string;
  answeredQuestions?: number;
  totalQuestions?: number;
  startedAt?: string | null;
  completedAt?: string | null;
  lastAnsweredAt?: string | null;
  title: string;
  description: string;
  status: "Nije započet" | "U toku" | "Završeno" | "U pripremi";
  accessState: "paid" | "roadmap";
  ctaKind: "start" | "resume" | "report" | "roadmap";
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

type CandidateAssessmentCtaState = Pick<
  CandidateAssessmentCard,
  "attemptId" | "ctaKind" | "ctaLabel" | "disabled" | "href" | "status"
>;

type CandidateAssessmentAvailabilityState = Pick<
  CandidateAssessmentCard,
  "accessState" | "disabled" | "status"
> & {
  canStart: boolean;
};

export type CandidateDashboardInitialAttempt = {
  id: string;
  test_id: string;
  status: DashboardAttemptStatus;
  responseCount: number;
  started_at?: string | null;
  scored_started_at: string | null;
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
type DashboardAttemptLifecycle = "in_progress" | "not_started" | "completed" | "abandoned";

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
  started_at?: string | null;
  scored_started_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  last_answered_at?: string | null;
  total_time_seconds: number | null;
  tests: DashboardRelation<DashboardTestRow>;
};

type DashboardDimensionScoreRow = {
  attempt_id: string;
  normalized_score: number | string | null;
};

type DashboardResponseRow = {
  attempt_id: string;
  answered_at: string | null;
};

type DashboardQuestionRow = {
  test_id: string;
};

type DashboardOrganizationTestAccessRow = {
  organization_id: string;
  test_id: string;
};

type CompositeReportState = "locked" | "pending" | "ready";

type CuratedBatteryTitle = "IPIP-NEO-120" | "SAFRAN" | "MWMS";
type CuratedBatteryConfig = {
  key: CandidateAssessmentCatalogKey;
  title: CuratedBatteryTitle;
  description: string;
  category: DashboardTestCategory;
  metaLabel: string;
};

function isCuratedBatteryTitle(value: string): value is CuratedBatteryTitle {
  return value === "IPIP-NEO-120" || value === "SAFRAN" || value === "MWMS";
}

const CURATED_BATTERY_TESTS: readonly CuratedBatteryConfig[] = [
  {
    key: "ipip-neo-120",
    title: "IPIP-NEO-120",
    description: "Tvoj pristup radu, saradnji i situacijama.",
    category: "personality",
    metaLabel: "Ličnost",
  },
  {
    key: "safran",
    title: "SAFRAN",
    description: "Kognitivni zadaci za verbalno, figuralno i numeričko zaključivanje.",
    category: "cognitive",
    metaLabel: "Kognitivni",
  },
  {
    key: "mwms",
    title: "MWMS",
    description: "Procjena radne motivacije",
    category: "behavioral",
    metaLabel: "Motivacija",
  },
] as const;

const CURATED_BATTERY_UI_FALLBACKS: Record<CandidateAssessmentCatalogKey, { totalQuestions: number }> = {
  "ipip-neo-120": { totalQuestions: 120 },
  safran: { totalQuestions: 45 },
  mwms: { totalQuestions: 19 },
  riasec: { totalQuestions: 48 },
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

function getDashboardAttemptLifecycle(
  attempt: Pick<DashboardAttemptRow, "status" | "responseCount" | "scored_started_at" | "tests">,
): DashboardAttemptLifecycle {
  return getAssessmentAttemptLifecycle({
    status: attempt.status,
    responseCount: attempt.responseCount,
    testSlug: Array.isArray(attempt.tests) ? attempt.tests[0]?.slug : attempt.tests?.slug,
    scoredStartedAt: attempt.scored_started_at,
  });
}

function getPrimaryAttemptForTest(
  testId: string,
  testSlug: string | null | undefined,
  attempts: DashboardAttemptRow[],
): DashboardAttemptRow | null {
  return selectPrimaryAttemptForTest({
    attempts,
    testId,
    testSlug,
  });
}

function formatAttemptTimestamp(timestamp?: string | null): string | null {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}.${month}.${year}. u ${hours}:${minutes}`;
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

function getAssessmentCardAvailabilityState({
  accessibleTestIds,
  test,
  totalQuestions,
}: {
  accessibleTestIds: Set<string>;
  test: DashboardTestRow;
  totalQuestions: number;
}): CandidateAssessmentAvailabilityState {
  const availability = getCandidateAssessmentAvailability({
    slug: test.slug,
    name: test.name,
    status: test.status,
    isActive: test.is_active,
    hasOrganizationAccess: accessibleTestIds.has(test.id),
    activeQuestionCount: totalQuestions,
  });
  const isDisabledCandidateCard = availability.kind === "disabled" || !availability.canStart;

  return {
    accessState: isDisabledCandidateCard ? "roadmap" : "paid",
    canStart: availability.canStart,
    disabled: !availability.canStart,
    status: "Nije započet",
  };
}

function getAssessmentCardCtaState({
  availability,
  primaryAttempt,
  primaryAttemptLifecycle,
  testSlug,
}: {
  availability: CandidateAssessmentAvailabilityState;
  primaryAttempt: DashboardAttemptRow | null;
  primaryAttemptLifecycle: DashboardAttemptLifecycle | null;
  testSlug?: string | null;
}): CandidateAssessmentCtaState {
  const isSafran = testSlug === "safran_v1";

  if (!availability.canStart) {
    return {
      ctaKind: "roadmap",
      ctaLabel: "Započni procjenu",
      disabled: true,
      status: availability.status,
    };
  }

  if (primaryAttempt && primaryAttemptLifecycle === "completed") {
    return {
      attemptId: primaryAttempt.id,
      ctaKind: "report",
      ctaLabel: "Pogledaj rezultate",
      disabled: false,
      href: `/app/attempts/${primaryAttempt.id}/report`,
      status: "Završeno",
    };
  }

  if (primaryAttempt && primaryAttemptLifecycle === "in_progress") {
    return {
      attemptId: primaryAttempt.id,
      ctaKind: "resume",
      ctaLabel: "Nastavi procjenu",
      disabled: false,
      href: isSafran ? getSafranScoredRunHref(primaryAttempt.id) : `/app/attempts/${primaryAttempt.id}/run`,
      status: "U toku",
    };
  }

  if (primaryAttempt && primaryAttemptLifecycle === "not_started") {
    return {
      attemptId: primaryAttempt.id,
      ctaKind: "start",
      ctaLabel: "Započni procjenu",
      disabled: false,
      href: isSafran ? `/app/attempts/${primaryAttempt.id}` : `/app/attempts/${primaryAttempt.id}/run`,
      status: "Nije započet",
    };
  }

  return {
    ctaKind: "start",
    ctaLabel: "Započni procjenu",
    disabled: false,
    status: "Nije započet",
  };
}

function buildAssessmentCardsFromTests(
  tests: DashboardTestRow[],
  attempts: DashboardAttemptRow[],
  accessRows: DashboardOrganizationTestAccessRow[],
  questionCountsByTestId: Map<string, number>,
): CandidateAssessmentCard[] {
  const visibleTests = tests.filter((test) => getCandidateAssessmentCatalogKey(test) !== "riasec");
  const accessibleTestIds = new Set(accessRows.map((row) => row.test_id));
  const databaseCards: CandidateAssessmentCard[] = visibleTests.map((test) => {
    const primaryAttempt = getPrimaryAttemptForTest(test.id, test.slug, attempts);
    const primaryAttemptLifecycle = primaryAttempt
      ? getAssessmentAttemptLifecycle({
          status: primaryAttempt.status,
          responseCount: primaryAttempt.responseCount,
          testSlug: test.slug,
          scoredStartedAt: primaryAttempt.scored_started_at,
        })
      : null;
    const curatedBatteryKey = getCandidateAssessmentCatalogKey(test);
    const curatedBatteryConfig = curatedBatteryKey
      ? CURATED_BATTERY_TESTS.find((entry) => entry.key === curatedBatteryKey) ?? null
      : null;
    const curatedBatteryFallback = curatedBatteryKey
      ? CURATED_BATTERY_UI_FALLBACKS[curatedBatteryKey]
      : null;
    const visuals = getCategoryVisuals(test.category);
    const totalQuestions =
      questionCountsByTestId.get(test.id) ?? curatedBatteryFallback?.totalQuestions ?? 0;
    const availabilityState = getAssessmentCardAvailabilityState({
      accessibleTestIds,
      test,
      totalQuestions,
    });
    const ctaState = getAssessmentCardCtaState({
      availability: availabilityState,
      primaryAttempt,
      primaryAttemptLifecycle,
      testSlug: test.slug,
    });
    let availabilityNote: string | undefined;

    return {
      testId: test.id,
      testSlug: test.slug,
      attemptId: ctaState.attemptId,
      answeredQuestions: primaryAttempt?.responseCount,
      totalQuestions,
      startedAt: primaryAttempt?.started_at ?? primaryAttempt?.created_at ?? null,
      completedAt: primaryAttempt?.completed_at ?? null,
      lastAnsweredAt: primaryAttempt?.last_answered_at ?? null,
      title: curatedBatteryConfig?.title ?? getAssessmentDisplayName(test),
      description:
        curatedBatteryConfig?.description ??
        test.description?.trim() ??
        "Opis testa će biti dostupan uskoro.",
      accessState: availabilityState.accessState,
      ctaKind: ctaState.ctaKind,
      status: ctaState.status,
      duration: formatDurationLabel(test.duration_minutes),
      secondaryMeta: curatedBatteryConfig?.metaLabel ?? getCategoryLabel(test.category),
      href: ctaState.href,
      ctaLabel: ctaState.ctaLabel,
      disabled: ctaState.disabled || availabilityState.disabled,
      availabilityNote,
      ...visuals,
    };
  });
  const curatedOrder = new Map<CuratedBatteryTitle, number>(
    CURATED_BATTERY_TESTS.map((entry, index) => [entry.title, index]),
  );
  const sortedDatabaseCards = [...databaseCards].sort((left, right) => {
    const leftOrder = isCuratedBatteryTitle(left.title)
      ? curatedOrder.get(left.title) ?? Number.POSITIVE_INFINITY
      : Number.POSITIVE_INFINITY;
    const rightOrder = isCuratedBatteryTitle(right.title)
      ? curatedOrder.get(right.title) ?? Number.POSITIVE_INFINITY
      : Number.POSITIVE_INFINITY;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return 0;
  });

  const roadmapCards: CandidateAssessmentCard[] = ROADMAP_TESTS.map((test) => ({
    title: test.title,
    description: test.description,
    accessState: "roadmap",
    ctaKind: "roadmap",
    status: "Nije započet",
    duration: formatDurationLabel(test.durationMinutes),
    secondaryMeta: "U planu",
    ctaLabel: "Započni procjenu",
    disabled: true,
    ...getCategoryVisuals(test.category),
  }));

  const curatedTitles = new Set<CuratedBatteryTitle>(CURATED_BATTERY_TESTS.map((entry) => entry.title));
  const missingCuratedCards: CandidateAssessmentCard[] = CURATED_BATTERY_TESTS
    .filter((entry) => !sortedDatabaseCards.some((card) => card.title === entry.title))
    .map((entry) => {
      const availability = getCandidateAssessmentAvailability({
        slug: entry.key,
        name: entry.title,
        status: null,
        isActive: false,
        hasOrganizationAccess: false,
        activeQuestionCount: 0,
      });
      const isAvailable = availability.canStart;

      return {
        title: entry.title,
        description: entry.description,
        testSlug: undefined,
        accessState: isAvailable ? "paid" : "roadmap",
        ctaKind: isAvailable ? "start" : "roadmap",
        status: "Nije započet",
        duration: "Vrijeme uskoro",
        totalQuestions: CURATED_BATTERY_UI_FALLBACKS[entry.key].totalQuestions,
        answeredQuestions: 0,
        secondaryMeta: entry.metaLabel,
        ctaLabel: "Započni procjenu",
        disabled: !isAvailable,
        ...getCategoryVisuals(entry.category),
      };
    });
  const batteryCards = [
    ...sortedDatabaseCards.filter(
      (card) => isCuratedBatteryTitle(card.title) && curatedTitles.has(card.title),
    ),
    ...missingCuratedCards,
  ]
    .sort((left, right) => {
      const leftOrder = isCuratedBatteryTitle(left.title)
        ? curatedOrder.get(left.title) ?? Number.POSITIVE_INFINITY
        : Number.POSITIVE_INFINITY;
      const rightOrder = isCuratedBatteryTitle(right.title)
        ? curatedOrder.get(right.title) ?? Number.POSITIVE_INFINITY
        : Number.POSITIVE_INFINITY;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return 0;
    });

  const additionalDatabaseCards = sortedDatabaseCards.filter(
    (card) => !isCuratedBatteryTitle(card.title),
  );

  return [...batteryCards, ...additionalDatabaseCards, ...roadmapCards];
}

function mapInitialAttemptsToDashboardAttempts(
  attempts: CandidateDashboardInitialAttempt[],
): DashboardAttemptRow[] {
  return attempts.map((attempt) => ({
    ...attempt,
    started_at: attempt.started_at ?? attempt.created_at,
    scored_started_at: attempt.scored_started_at,
    last_answered_at: null,
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
    <AuthenticatedAppHeaderShell>
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
    </AuthenticatedAppHeaderShell>
  );
}

function DashboardHeader() {
  return (
    <DashboardSectionShell className="w-full border-white/60 bg-[#F5F8FB] shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_12px_28px_rgba(148,163,184,0.16),0_3px_8px_rgba(148,163,184,0.08)]">
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
      <div className="relative max-w-[36rem]">
        <DashboardSectionHeader
          className="gap-0.5"
          eyebrow="Pregled"
          eyebrowClassName="text-teal-800/90"
          title="Integrisana procjena"
          titleClassName="mt-1.5 text-[1.7rem] font-extrabold tracking-[-0.05em] leading-tight sm:text-[2.05rem]"
          description="Tri komplementarna testa"
          descriptionClassName="mt-0.5 max-w-xl"
        />
        <p className="mt-1 max-w-xl font-body text-[14px] leading-6 text-slate-700">
          Završi sva tri testa kako bi dobio cjelovit profil, dublju analizu i jasniji uvid u svoje obrasce ponašanja, način razmišljanja i radni stil.
        </p>
      </div>
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
    <DashboardSectionShell className="border-white/60 bg-[#F3F7FA] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_24px_rgba(148,163,184,0.16),0_2px_6px_rgba(148,163,184,0.08)]">
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
        eyebrow="PREGLED"
        eyebrowClassName="text-teal-800/90"
        title="Tvoj napredak"
        titleClassName="mt-2 text-[1.65rem] leading-tight tracking-[-0.045em]"
      />
      <p className="relative mt-3 text-[13px] font-semibold text-slate-900">
        Završeno: {completedCount} {formatProcjenaCount(completedCount)}
      </p>
      <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-slate-200/90">
        <div
          aria-hidden="true"
          className="h-full rounded-full bg-teal-600 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="relative mt-3 text-[13px] font-semibold text-slate-700">
        Preostalo: {remainingCount} {formatProcjenaCount(remainingCount)}
      </p>
    </DashboardSectionShell>
  );
}

function QuickActionCard({
  completedCount,
  state,
  title,
}: {
  completedCount: number;
  state: CompositeReportState;
  title?: string;
}) {
  const isLocked = state === "locked";
  const isPending = state === "pending";
  const isReady = state === "ready";
  const remainingTests = Math.max(3 - completedCount, 0);
  const helperText = isLocked
    ? remainingTests === 1
      ? "Završi preostali test da otključaš izvještaj."
      : "Završi preostale testove da otključaš izvještaj."
    : isPending
      ? "Kompozitni izvještaj će uskoro biti dostupan."
      : undefined;
  const cardClassName = isReady
    ? "mx-auto w-full max-w-[800px] border-teal-600/80 bg-teal-700 p-6 shadow-[0_24px_48px_rgba(13,148,136,0.18)] transition-colors duration-200 sm:p-7 md:p-8"
    : isPending
      ? "mx-auto w-full max-w-[800px] border-teal-300/80 bg-teal-100 p-6 shadow-[0_24px_48px_rgba(15,23,42,0.08)] transition-colors duration-200 sm:p-7 md:p-8"
      : "mx-auto w-full max-w-[800px] border-teal-400/90 bg-[#DDEFEA] p-6 shadow-[0_24px_48px_rgba(15,23,42,0.08)] transition-colors duration-200 sm:p-7 md:p-8";
  const eyebrowClassName = isReady ? "text-white/80" : "text-violet-700";
  const titleClassName = `mt-2 text-[1.375rem] leading-tight tracking-[-0.03em] ${
    isReady ? "text-white" : "text-slate-950"
  }`;
  const descriptionClassName = isReady ? "mt-2 max-w-none text-white/80" : "mt-2 max-w-none";
  const pillClassName = isReady
    ? "border-white/15 bg-white/12 text-white"
    : isPending
      ? "border-teal-300 bg-teal-100/80 text-teal-900"
      : "border-slate-300 bg-slate-100 text-slate-600";
  const ctaClassName = isReady
    ? "border-white/90 bg-white text-teal-800 shadow-[0_18px_36px_rgba(8,47,73,0.16)] hover:-translate-y-0.5 hover:bg-teal-50"
    : isPending
      ? "border-teal-200 bg-white/70 text-teal-800 opacity-90"
      : "border-slate-300 bg-slate-100 text-slate-400 opacity-85";
  const pillText = isReady ? "Dostupno" : isPending ? "U obradi" : `${completedCount}/3 završeno`;
  const ctaText = isReady
    ? "Otvori kompozitni izvještaj"
    : isPending
      ? "Izvještaj se priprema"
      : "Dostupno nakon 3 testa";

  return (
    <DashboardSectionShell className={cardClassName}>
      <div className="relative grid gap-6 md:grid-cols-[minmax(0,1fr)_272px] md:items-start">
        <div className="min-w-0">
          <DashboardSectionHeader
            className="gap-2"
            eyebrow="KOMPOZITNI IZVJEŠTAJ"
            eyebrowClassName={eyebrowClassName}
            title="Objedinjena analiza"
            titleClassName={titleClassName}
            description={
              <>
                Objedinjuje rezultate sva tri testa u jedinstven,
                <br className="hidden md:block" />
                <span className="md:hidden"> </span>
                dublji pregled tvog profila.
              </>
            }
            descriptionClassName={descriptionClassName}
          />
          {helperText ? (
            <p className={`mt-4 text-sm leading-6 ${isReady ? "text-white/80" : "text-slate-700"}`}>
              {helperText}
            </p>
          ) : null}
        </div>

        <DashboardActionRow className="flex flex-col items-stretch gap-4 md:w-[272px] md:justify-self-end md:items-stretch md:self-stretch md:justify-between">
          <span
            className={`inline-flex items-center justify-center self-start rounded-full border px-3 py-1 text-[11px] font-label font-semibold uppercase tracking-[0.16em] md:self-end ${pillClassName}`}
          >
            {pillText}
          </span>
          <button
            className={`flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3.5 text-xs font-bold uppercase tracking-[0.16em] transition-all ${ctaClassName}`}
            disabled={!isReady}
            title={title}
            type="button"
          >
            <span>{ctaText}</span>
            <DashboardIcon className="h-4 w-4" name="arrow_right" />
          </button>
        </DashboardActionRow>
      </div>
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
    <section className={muted ? "mt-8" : "mt-4"}>
      {!hideSectionHeader ? (
        <DashboardSectionHeader className="mb-4" title={title} description={description} />
      ) : null}
      <div className="grid grid-cols-1 items-stretch gap-3.5 md:grid-cols-2 xl:grid-cols-3 xl:gap-4">
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
  const isRoadmap = assessment.accessState === "roadmap";
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
    isRoadmap
      ? "border-violet-200/90 bg-violet-50 text-violet-900"
      : isPaid && !muted
      ? "border-teal-300 bg-teal-50 text-teal-800"
      : "border-slate-300 bg-slate-100 text-slate-600";
  const cardClassName = muted
    ? "border-slate-200/80 bg-white shadow-[0_12px_24px_rgba(15,23,42,0.08)] hover:border-slate-300/80 hover:shadow-[0_16px_28px_rgba(15,23,42,0.1)]"
    : assessment.accessState === "roadmap"
        ? "border-violet-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,243,255,0.98))] shadow-[0_18px_31px_rgba(76,29,149,0.06)]"
        : primary
          ? "border-teal-300/80 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(240,249,248,0.98))] shadow-[0_30px_61px_rgba(15,23,42,0.14)] hover:border-teal-400 hover:shadow-[0_34px_65px_rgba(20,184,166,0.16)]"
          : "border-slate-200/80 bg-white shadow-[0_12px_24px_rgba(15,23,42,0.08)] hover:border-teal-200/90 hover:shadow-[0_16px_28px_rgba(15,23,42,0.1)]";
  const descriptionClassName = muted
    ? "text-slate-600"
    : isRoadmap
      ? "text-slate-700/95"
      : "text-slate-700";
  const metaClassName = muted ? "text-slate-700" : isRoadmap ? "text-slate-700" : "text-slate-800";
  const answeredQuestions = assessment.answeredQuestions ?? 0;
  const totalQuestions = assessment.totalQuestions ?? 0;
  const progressPercent =
    totalQuestions > 0 ? Math.min(100, Math.round((answeredQuestions / totalQuestions) * 100)) : 0;
  const startedAtLabel = formatAttemptTimestamp(assessment.startedAt);
  const completedAtLabel = formatAttemptTimestamp(assessment.completedAt);
  const showsProgressScaffold =
    assessment.ctaKind === "start" || assessment.ctaKind === "resume" || assessment.ctaKind === "report";

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
      router.push(
        assessment.testSlug === "safran_v1"
          ? `/app/attempts/${attemptId}`
          : `/app/attempts/${attemptId}/run`,
      );
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
      className={`group flex h-full flex-col rounded-[1.5rem] border p-3 transition-all duration-300 hover:-translate-y-0.5 sm:p-3.5 ${primary ? "md:p-4" : ""} ${cardClassName}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div
          className={`rounded-[1.25rem] border border-slate-200/70 bg-white p-2.5 shadow-[0_6px_14px_rgba(15,23,42,0.06)] ${primary ? "ring-1 ring-teal-200/80" : isRoadmap ? "ring-1 ring-violet-100/90" : ""} ${iconTileClassName} ${muted ? "opacity-75" : isRoadmap ? "opacity-95" : ""}`}
        >
          <DashboardIcon className={`h-[1.375rem] w-[1.375rem] ${iconColorClassName} sm:h-6 sm:w-6`} name={assessment.icon} />
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
        <h3 className={`font-headline font-bold leading-tight tracking-[-0.04em] ${primary ? "text-[1.32rem]" : "text-[1.18rem]"} ${muted ? "text-slate-900" : isRoadmap ? "text-slate-900" : "text-slate-950"}`}>
          {assessment.title}
        </h3>
        <p className={`mt-1.5 font-body ${primary ? "text-[14px] leading-6" : isRoadmap ? "text-[13px] leading-[1.35rem]" : "text-[13px] leading-[1.35rem]"} ${muted ? "text-slate-600" : descriptionClassName}`}>
          {assessment.description}
        </p>

        <DashboardCompactMetaRow
          className={primary ? "mt-3 border-slate-300" : muted ? "mt-3 border-slate-300" : isRoadmap ? "mb-2 mt-3 gap-y-1.5 border-slate-200/90 pt-2" : "mt-3 border-slate-200"}
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

        {showsProgressScaffold ? (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] text-slate-600">
              {answeredQuestions} / {totalQuestions} pitanja
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-teal-600 transition-all duration-500"
                style={{ width: `${assessment.ctaKind === "report" ? 100 : progressPercent}%` }}
              />
            </div>
            {assessment.ctaKind === "start" ? (
              <p className="mt-1.5 text-[10px] italic text-slate-600">Još nije započeto</p>
            ) : assessment.ctaKind === "resume" ? (
              <>
                {startedAtLabel ? (
                  <p className="mt-1.5 text-[10px] italic text-slate-600">
                    Započeto: {startedAtLabel}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                {startedAtLabel ? (
                  <p className="mt-1.5 text-[10px] italic text-slate-600">
                    Započeto: {startedAtLabel}
                  </p>
                ) : null}
                {completedAtLabel ? (
                  <p className="mt-0.5 text-[10px] italic text-slate-600">
                    Završeno: {completedAtLabel}
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>

      {canCreateAttempt ? (
        <DashboardActionRow className="mt-auto pt-3">
          <button
            className={`flex w-full items-center justify-center gap-2 rounded-full border border-teal-700 bg-teal-600 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-white shadow-[0_18px_36px_rgba(13,148,136,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-700 hover:shadow-[0_22px_40px_rgba(13,148,136,0.3)] focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:ring-offset-0 disabled:cursor-wait disabled:opacity-80 ${primary ? "sm:text-[12px]" : ""}`}
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
        <DashboardActionRow className={isRoadmap ? "mt-auto pt-3" : "mt-auto pt-3 stack-xs"}>
          <button
            className={isRoadmap
              ? "flex w-full items-center justify-center gap-2 rounded-full border border-violet-200/90 bg-violet-50/70 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] opacity-100"
              : "flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-slate-100 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-slate-500 opacity-90"}
            disabled
            type="button"
          >
            <span>{assessment.ctaLabel}</span>
            <DashboardIcon className={`h-4 w-4 ${isRoadmap ? "text-violet-500/80" : ""}`} name="arrow_right" />
          </button>
          {assessment.availabilityNote ? (
            <p className="text-xs text-slate-600">{assessment.availabilityNote}</p>
          ) : null}
        </DashboardActionRow>
      ) : (
        <DashboardActionRow className="mt-auto pt-3">
          <button
            className={`flex w-full items-center justify-center gap-2 rounded-full border border-teal-700 bg-teal-600 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-white shadow-[0_18px_36px_rgba(13,148,136,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-700 hover:shadow-[0_22px_40px_rgba(13,148,136,0.3)] focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:ring-offset-0 ${primary ? "sm:text-[12px]" : ""}`}
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
    <DashboardInfoCardShell className="border-white/60 bg-[#F3F7FA] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_24px_rgba(148,163,184,0.16),0_2px_6px_rgba(148,163,184,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <p className="font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500/85">
          {label}
        </p>
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-[#EDF3F7] shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_6px_14px_rgba(148,163,184,0.14)] ${iconBgClassName}`}
        >
          <DashboardIcon className={`h-[1.125rem] w-[1.125rem] ${iconClassName}`} name={icon} />
        </span>
      </div>
      {loading && !status ? (
        <div className="mt-4 flex min-h-[2.5rem] items-center">
          <LoaderCircle className="h-7 w-7 animate-spin text-slate-500" />
        </div>
      ) : status ? (
        <p className="mt-3 inline-flex min-h-[2.35rem] items-center gap-2 text-[1.2rem] font-bold tracking-[-0.035em] text-slate-950 sm:text-[1.35rem]">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_0_4px_rgba(34,197,94,0.14)]" />
          {value}
        </p>
      ) : (
        <p
          className={`mt-3 min-h-[2.35rem] text-center text-[1.72rem] font-extrabold tracking-[-0.055em] leading-none sm:text-[1.9rem] ${accent ? "text-teal-700" : "text-slate-950"}`}
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
    <AuthenticatedAppFooterShell>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
        <p className="font-label text-[11px] uppercase tracking-[0.16em] text-slate-600">
          © 2026 <strong>RE:SELEKCIJA</strong>. All rights reserved.
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
    </AuthenticatedAppFooterShell>
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
        let responseRows: DashboardResponseRow[] = [];

        const testIds = ((testsData ?? []) as DashboardTestRow[]).map((test) => test.id);
        let questionRows: DashboardQuestionRow[] = [];

        if (testIds.length > 0) {
          const { data: questionsData, error: questionsError } = await supabase
            .from("questions")
            .select("test_id")
            .in("test_id", testIds)
            .eq("is_active", true);

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

          const { data: responsesData, error: responsesError } = await supabase
            .from("responses")
            .select("attempt_id, answered_at")
            .in("attempt_id", attemptIds);

          if (responsesError) {
            throw new Error(responsesError.message);
          }

          responseRows = (responsesData ?? []) as DashboardResponseRow[];
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
        const lastAnsweredAtByAttemptId = responseRows.reduce((timestamps, response) => {
          if (!response.answered_at) {
            return timestamps;
          }

          const previousTimestamp = timestamps.get(response.attempt_id);

          if (!previousTimestamp || Date.parse(response.answered_at) > Date.parse(previousTimestamp)) {
            timestamps.set(response.attempt_id, response.answered_at);
          }

          return timestamps;
        }, new Map<string, string>());
        const attemptsWithActivity = mappedAttempts.map((attempt) => ({
          ...attempt,
          last_answered_at: lastAnsweredAtByAttemptId.get(attempt.id) ?? null,
        }));

        if (isCancelled) {
          return;
        }

        setLiveAssessments(
          buildAssessmentCardsFromTests(
            (testsData ?? []) as DashboardTestRow[],
            attemptsWithActivity,
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

  const curatedBatteryTitles = new Set<CuratedBatteryTitle>(
    CURATED_BATTERY_TESTS.map((entry) => entry.title),
  );
  const availableAssessments = liveAssessments.filter(
    (assessment) =>
      isCuratedBatteryTitle(assessment.title) && curatedBatteryTitles.has(assessment.title),
  );
  const totalBatteryTestsCount = CURATED_BATTERY_TESTS.length;
  const completedBatteryCount = Math.min(
    availableAssessments.filter((assessment) => Boolean(assessment.completedAt)).length,
    totalBatteryTestsCount,
  );
  const compositeReportReady = false;
  const compositeReportState: CompositeReportState =
    completedBatteryCount < totalBatteryTestsCount ? "locked" : compositeReportReady ? "ready" : "pending";
  const aiAnalystTitle =
    totalBatteryTestsCount === 1
      ? "Kompozitna analiza zahtijeva bateriju od minimalno 2 testa."
      : completedBatteryCount < totalBatteryTestsCount
        ? `Završite sve dodijeljene testove (${completedBatteryCount} / ${totalBatteryTestsCount}) za dubinsku analizu.`
        : undefined;
  const kpiValues: Record<string, string> = {
    "Završeni testovi": loadError ? "N/A" : String(completedBatteryCount),
    "Ukupno vrijeme": loadError ? "N/A" : totalHours,
  };
  return (
    <AuthenticatedAppPageShell>
      <TopNav userEmail={userEmail} userName={userName} />

      <AuthenticatedAppMainContent className="pt-20">
        {hasLinkedParticipant ? (
          isLoading && !loadError ? (
            <DashboardSkeleton />
          ) : (
            <div className={DASHBOARD_CONTENT_GRID_CLASS_NAME}>
              <div className={DASHBOARD_SIDEBAR_CLASS_NAME}>
                <aside className={DASHBOARD_SIDEBAR_STACK_CLASS_NAME}>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
                    Korisnički profil
                  </p>
                  <WelcomeOverviewCard
                    completedCount={completedBatteryCount}
                    totalAssigned={totalBatteryTestsCount}
                  />

                  <section aria-label="Dashboard overview" className="grid grid-cols-2 gap-3">
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

                  <DashboardInfoCardShell className="border-white/60 bg-[#F3F7FA] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_24px_rgba(148,163,184,0.16),0_2px_6px_rgba(148,163,184,0.08)]">
                    <p className="font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500/85">
                      TVOJI KORACI
                    </p>
                    <h3 className="mt-2.5 font-headline text-[1.2rem] font-bold tracking-[-0.04em] text-slate-950">
                      Kako nastaje tvoj profil
                    </h3>
                    <p className="mt-3 w-full max-w-none text-[13px] leading-6 text-slate-600">
                      Svaki rezultat dodaje jedan dio slike. Objedinjeni pregled otkriva širi
                      obrazac tvog rada, razmišljanja i interesa.
                    </p>
                  </DashboardInfoCardShell>
                </aside>
              </div>

              <section aria-label="Assessments" className={DASHBOARD_PRIMARY_COLUMN_CLASS_NAME}>
                <div className={DASHBOARD_PRIMARY_COLUMN_STACK_CLASS_NAME}>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-800/80">
                    TVOJA BATERIJA TESTOVA
                  </p>
                  <div className="!mt-3">
                    <DashboardHeader />
                  </div>
                  {availableAssessments.length > 0 ? (
                    <AssessmentSection
                      title="Tvoja baterija testova"
                      description="Aktivne procjene koje možeš odmah otvoriti i završiti."
                      assessments={availableAssessments}
                      linkedOrganizationId={linkedOrganizationId}
                      hideSectionHeader
                    />
                  ) : null}
                  <div className="mt-3">
                    <QuickActionCard
                      completedCount={completedBatteryCount}
                      state={compositeReportState}
                      title={aiAnalystTitle}
                    />
                  </div>
                </div>
              </section>
            </div>
          )
        ) : (
          <EmptyState />
        )}
      </AuthenticatedAppMainContent>

      <DashboardFooter showHrLink={showHrLink} />
    </AuthenticatedAppPageShell>
  );
}
