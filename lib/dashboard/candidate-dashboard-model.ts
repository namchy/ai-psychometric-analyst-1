import {
  getCandidateAssessmentAvailability,
  getCandidateAssessmentCatalogKey,
  shouldHideAssessmentFromCandidateDashboard,
  type CandidateAssessmentCatalogKey,
} from "@/lib/assessment/availability";
import {
  getAssessmentAttemptLifecycle,
  getSafranScoredRunHref,
  selectPrimaryAttemptForTest,
} from "@/lib/assessment/attempt-lifecycle";
import { getAssessmentDisplayInfo } from "@/lib/assessment/display";

export type DashboardIconName =
  | "psychology"
  | "user_focus"
  | "sigma"
  | "equalizer"
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
  subtitle?: string;
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

export type DashboardAttemptStatus = "in_progress" | "completed" | "abandoned";
export type DashboardAttemptLifecycle = "in_progress" | "not_started" | "completed" | "abandoned";

export type DashboardTestCategory = "personality" | "behavioral" | "cognitive";
export type DashboardTestStatus = "draft" | "active" | "archived";
export type DashboardRelation<T> = T | T[] | null;

export type DashboardTestRow = {
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

export type DashboardAttemptRow = {
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

export type DashboardOrganizationTestAccessRow = {
  organization_id: string;
  test_id: string;
};

type CuratedBatteryKey = "ipip-neo-120" | "safran" | "mwms";
type CuratedBatteryConfig = {
  key: CuratedBatteryKey;
  slug: "ipip-neo-120-v1" | "safran_v1" | "mwms_v1";
  title: string;
  subtitle: string;
  description: string;
  category: DashboardTestCategory;
  metaLabel: string;
  durationLabel: string;
};

export const CURATED_BATTERY_TESTS: readonly CuratedBatteryConfig[] = [
  {
    key: "ipip-neo-120",
    slug: "ipip-neo-120-v1",
    title: "Procjena obrazaca ponašanja",
    subtitle: "IPIP-NEO-120",
    description: "Tvoj pristup radu, saradnji i situacijama.",
    category: "personality",
    metaLabel: "Ličnost",
    durationLabel: "Oko 20 min",
  },
  {
    key: "safran",
    slug: "safran_v1",
    title: "Procjena kognitivnog rezonovanja",
    subtitle: "SAFRAN",
    description: "Kognitivni zadaci za verbalno, figuralno i numeričko zaključivanje.",
    category: "cognitive",
    metaLabel: "Kognitivni",
    durationLabel: "15 min",
  },
  {
    key: "mwms",
    slug: "mwms_v1",
    title: "Procjena izvora radne motivacije",
    subtitle: "MWMS",
    description: "Procjena radne motivacije",
    category: "behavioral",
    metaLabel: "Motivacija",
    durationLabel: "Oko 5 min",
  },
] as const;

export const CURATED_BATTERY_TEST_SLUGS = CURATED_BATTERY_TESTS.map((entry) => entry.slug);

const CURATED_BATTERY_UI_FALLBACKS: Record<CandidateAssessmentCatalogKey, { totalQuestions: number }> = {
  "ipip-neo-120": { totalQuestions: 120 },
  safran: { totalQuestions: 45 },
  mwms: { totalQuestions: 19 },
  riasec: { totalQuestions: 48 },
};

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

function getCuratedBatteryOrder(
  testSlug: string | null | undefined,
  curatedKeyBySlug: Map<string, CuratedBatteryKey>,
  curatedOrder: Map<CuratedBatteryKey, number>,
): number {
  if (!testSlug) {
    return Number.POSITIVE_INFINITY;
  }

  const curatedKey = curatedKeyBySlug.get(testSlug);

  if (!curatedKey) {
    return Number.POSITIVE_INFINITY;
  }

  return curatedOrder.get(curatedKey) ?? Number.POSITIVE_INFINITY;
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
        icon: "equalizer",
        secondaryIcon: "hub",
        iconBgClassName: "assessment-card__icon-tile--complete",
        iconColorClassName: "assessment-card__icon-color--complete",
      };
    case "cognitive":
      return {
        icon: "sigma",
        secondaryIcon: "trending_up",
        iconBgClassName: "assessment-card__icon-tile--active",
        iconColorClassName: "assessment-card__icon-color--active",
      };
    default:
      return {
        icon: "user_focus",
        secondaryIcon: "task_alt",
        iconBgClassName: "assessment-card__icon-tile--start",
        iconColorClassName: "assessment-card__icon-color--start",
      };
  }
}

export function mapInitialAttemptsToDashboardAttempts(
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

export function getAssessmentCardProgressState(
  assessment: Pick<CandidateAssessmentCard, "answeredQuestions" | "totalQuestions" | "ctaKind">,
): {
  answeredQuestions: number;
  totalQuestions: number;
  progressPercent: number;
} {
  const answeredQuestions = assessment.answeredQuestions ?? 0;
  const totalQuestions = assessment.totalQuestions ?? 0;
  const progressPercent =
    totalQuestions > 0 ? Math.min(100, Math.round((answeredQuestions / totalQuestions) * 100)) : 0;

  return {
    answeredQuestions,
    totalQuestions,
    progressPercent: assessment.ctaKind === "report" ? 100 : progressPercent,
  };
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

export function buildAssessmentCardsFromTests(
  tests: DashboardTestRow[],
  attempts: DashboardAttemptRow[],
  accessRows: DashboardOrganizationTestAccessRow[],
  questionCountsByTestId: Map<string, number>,
): CandidateAssessmentCard[] {
  const visibleTests = tests.filter(
    (test) =>
      getCandidateAssessmentCatalogKey(test) !== "riasec" &&
      !shouldHideAssessmentFromCandidateDashboard({ slug: test.slug }),
  );
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
    const displayInfo = getAssessmentDisplayInfo(test);
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
      title: curatedBatteryConfig?.title ?? displayInfo.title,
      subtitle: curatedBatteryConfig?.subtitle ?? displayInfo.subtitle,
      description:
        curatedBatteryConfig?.description ??
        test.description?.trim() ??
        "Opis testa će biti dostupan uskoro.",
      accessState: availabilityState.accessState,
      ctaKind: ctaState.ctaKind,
      status: ctaState.status,
      duration: curatedBatteryConfig?.durationLabel ?? formatDurationLabel(test.duration_minutes),
      secondaryMeta: curatedBatteryConfig?.metaLabel ?? getCategoryLabel(test.category),
      href: ctaState.href,
      ctaLabel: ctaState.ctaLabel,
      disabled: ctaState.disabled || availabilityState.disabled,
      availabilityNote,
      ...visuals,
    };
  });
  const curatedOrder = new Map<CuratedBatteryKey, number>(
    CURATED_BATTERY_TESTS.map((entry, index) => [entry.key, index]),
  );
  const curatedKeyBySlug = new Map(CURATED_BATTERY_TESTS.map((entry) => [entry.slug, entry.key]));
  const sortedDatabaseCards = [...databaseCards].sort((left, right) => {
    const leftOrder = getCuratedBatteryOrder(left.testSlug, curatedKeyBySlug, curatedOrder);
    const rightOrder = getCuratedBatteryOrder(right.testSlug, curatedKeyBySlug, curatedOrder);

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

  const curatedSlugs = new Set<string>(CURATED_BATTERY_TESTS.map((entry) => entry.slug));
  const missingCuratedCards: CandidateAssessmentCard[] = CURATED_BATTERY_TESTS
    .filter((entry) => !sortedDatabaseCards.some((card) => card.testSlug === entry.slug))
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
        subtitle: entry.subtitle,
        description: entry.description,
        testSlug: entry.slug,
        accessState: isAvailable ? "paid" : "roadmap",
        ctaKind: isAvailable ? "start" : "roadmap",
        status: "Nije započet",
        duration: entry.durationLabel,
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
      (card) => Boolean(card.testSlug && curatedSlugs.has(card.testSlug)),
    ),
    ...missingCuratedCards,
  ].sort((left, right) => {
    const leftOrder = getCuratedBatteryOrder(left.testSlug, curatedKeyBySlug, curatedOrder);
    const rightOrder = getCuratedBatteryOrder(right.testSlug, curatedKeyBySlug, curatedOrder);

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return 0;
  });

  const additionalDatabaseCards = sortedDatabaseCards.filter(
    (card) => !card.testSlug || !curatedSlugs.has(card.testSlug),
  );

  return [...batteryCards, ...additionalDatabaseCards, ...roadmapCards];
}
