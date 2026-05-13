import { normalizeAssessmentLocale, type AssessmentLocale } from "./locale";
import { resolveAddressingForm, type AddressingForm } from "@/lib/auth/addressing-form";

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
  addressing_form_snapshot: AddressingForm;
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
  participantAddressingForm: unknown;
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
  const completedAttemptTestIds = new Set(
    input.existingAttempts
      .filter((attempt) => attempt.status === "completed" && runnableTestIds.has(attempt.test_id))
      .map((attempt) => attempt.test_id),
  );
  const attemptIdsToAbandon = input.existingAttempts
    .filter(
      (attempt) =>
        attempt.status === "in_progress" &&
        runnableTestIds.has(attempt.test_id),
    )
    .map((attempt) => attempt.id);
  // Temporary fallback until every candidate entry path is guaranteed to collect the preference first.
  const addressingFormSnapshot = resolveAddressingForm(input.participantAddressingForm);
  const attemptsToInsert = runnableTests
    .filter((test) => !completedAttemptTestIds.has(test.id))
    .map((test) => ({
      organization_id: input.organizationId,
      participant_id: input.participantId,
      test_id: test.id,
      locale,
      addressing_form_snapshot: addressingFormSnapshot,
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
