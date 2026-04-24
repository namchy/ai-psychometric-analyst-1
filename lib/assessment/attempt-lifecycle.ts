export type AssessmentAttemptLifecycle =
  | "in_progress"
  | "not_started"
  | "completed"
  | "abandoned";

export type AssessmentAttemptStatus = "in_progress" | "completed" | "abandoned";

type AssessmentAttemptLifecycleInput = {
  status: AssessmentAttemptStatus;
  responseCount: number;
  testSlug?: string | null;
  scoredStartedAt?: string | null;
};

export function isSafranAssessmentSlug(slug: string | null | undefined): boolean {
  return slug === "safran_v1";
}

export function isSafranScoredStartedAttempt(input: {
  testSlug?: string | null;
  scoredStartedAt?: string | null;
}): boolean {
  return isSafranAssessmentSlug(input.testSlug) && Boolean(input.scoredStartedAt);
}

export function getAssessmentAttemptLifecycle(
  input: AssessmentAttemptLifecycleInput,
): AssessmentAttemptLifecycle {
  if (input.status === "completed") {
    return "completed";
  }

  if (input.status === "abandoned") {
    return "abandoned";
  }

  if (input.responseCount > 0) {
    return "in_progress";
  }

  if (isSafranScoredStartedAttempt(input)) {
    return "in_progress";
  }

  return "not_started";
}

export function getAssessmentAttemptLifecyclePriority(
  lifecycle: AssessmentAttemptLifecycle,
): number {
  switch (lifecycle) {
    case "in_progress":
      return 0;
    case "not_started":
      return 1;
    case "completed":
      return 2;
    default:
      return 3;
  }
}

type SelectPrimaryAttemptForTestInput<TAttempt extends {
  test_id: string;
  status: AssessmentAttemptStatus;
  responseCount: number;
  scored_started_at?: string | null;
  created_at: string;
}> = {
  attempts: TAttempt[];
  testId: string;
  testSlug?: string | null;
};

export function selectPrimaryAttemptForTest<TAttempt extends {
  test_id: string;
  status: AssessmentAttemptStatus;
  responseCount: number;
  scored_started_at?: string | null;
  created_at: string;
}>(
  input: SelectPrimaryAttemptForTestInput<TAttempt>,
): TAttempt | null {
  const matchingAttempts = input.attempts.filter((attempt) => attempt.test_id === input.testId);

  if (matchingAttempts.length === 0) {
    return null;
  }

  return [...matchingAttempts].sort((left, right) => {
    const priorityDifference =
      getAssessmentAttemptLifecyclePriority(
        getAssessmentAttemptLifecycle({
          status: left.status,
          responseCount: left.responseCount,
          testSlug: input.testSlug,
          scoredStartedAt: left.scored_started_at,
        }),
      ) -
      getAssessmentAttemptLifecyclePriority(
        getAssessmentAttemptLifecycle({
          status: right.status,
          responseCount: right.responseCount,
          testSlug: input.testSlug,
          scoredStartedAt: right.scored_started_at,
        }),
      );

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return Date.parse(right.created_at) - Date.parse(left.created_at);
  })[0] ?? null;
}

export function getSafranScoredRunHref(attemptId: string): string {
  return `/app/attempts/${attemptId}/run?mode=scored`;
}
