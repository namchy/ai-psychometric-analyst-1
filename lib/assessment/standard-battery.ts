import { normalizeAssessmentLocale, type AssessmentLocale } from "./locale";

export const STANDARD_ASSESSMENT_BATTERY_SLUGS = [
  "ipip-neo-120-v1",
  "safran_v1",
  "mwms_v1",
] as const;

export type StandardBatteryTestRow = {
  id: string;
  slug: string;
  status: string;
  is_active: boolean;
};

export type StandardBatteryExistingAttemptRow = {
  id: string;
  test_id: string;
  status: "in_progress" | "completed" | "abandoned";
};

export type StandardBatteryAttemptInsert = {
  organization_id: string;
  participant_id: string;
  test_id: string;
  locale: AssessmentLocale;
  user_id: string | null;
  status: "in_progress";
  started_at: string;
};

export type StandardBatteryPlanResult = {
  locale: AssessmentLocale;
  runnableTests: StandardBatteryTestRow[];
  attemptIdsToAbandon: string[];
  attemptsToInsert: StandardBatteryAttemptInsert[];
  outcome: "battery-created" | "battery-no-runnable-tests";
};

type PlanStandardAssessmentBatteryCreationInput = {
  availableTests: StandardBatteryTestRow[];
  activeQuestionTestIds: Iterable<string>;
  existingAttempts: StandardBatteryExistingAttemptRow[];
  organizationId: string;
  participantId: string;
  participantUserId: string | null;
  locale: string | null | undefined;
  startedAt: string;
};

export function planStandardAssessmentBatteryCreation(
  input: PlanStandardAssessmentBatteryCreationInput,
): StandardBatteryPlanResult {
  const locale = normalizeAssessmentLocale(input.locale);
  const activeQuestionTestIds = new Set(input.activeQuestionTestIds);
  const runnableTests = input.availableTests.filter(
    (test) =>
      STANDARD_ASSESSMENT_BATTERY_SLUGS.includes(
        test.slug as (typeof STANDARD_ASSESSMENT_BATTERY_SLUGS)[number],
      ) &&
      test.status === "active" &&
      test.is_active === true &&
      activeQuestionTestIds.has(test.id),
  );

  if (runnableTests.length === 0) {
    return {
      locale,
      runnableTests,
      attemptIdsToAbandon: [],
      attemptsToInsert: [],
      outcome: "battery-no-runnable-tests",
    };
  }

  const runnableTestIds = new Set(runnableTests.map((test) => test.id));
  const attemptIdsToAbandon = input.existingAttempts
    .filter(
      (attempt) =>
        attempt.status === "in_progress" &&
        runnableTestIds.has(attempt.test_id),
    )
    .map((attempt) => attempt.id);
  const attemptsToInsert = runnableTests.map((test) => ({
      organization_id: input.organizationId,
      participant_id: input.participantId,
      test_id: test.id,
      locale,
      user_id: input.participantUserId,
      status: "in_progress" as const,
      started_at: input.startedAt,
    }));

  return {
    locale,
    runnableTests,
    attemptIdsToAbandon,
    attemptsToInsert,
    outcome: "battery-created",
  };
}
