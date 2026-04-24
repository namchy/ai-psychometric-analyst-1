"use server";

import { redirect } from "next/navigation";
import { requireAuthenticatedUserForAction } from "@/lib/auth/session";
import { normalizeAssessmentLocale } from "@/lib/assessment/locale";
import {
  planStandardAssessmentBatteryCreation,
  STANDARD_ASSESSMENT_BATTERY_SLUGS,
  type StandardBatteryExistingAttemptRow,
  type StandardBatteryTestRow,
} from "@/lib/assessment/standard-battery";
import { getActiveOrganizationForUser, getParticipantForOrganization } from "@/lib/b2b/organizations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ParticipantType = "employee" | "candidate";
type ParticipantStatus = "active" | "inactive";

function getFieldValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function withOpenAttemptFor(path: string, participantId: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}openAttemptFor=${encodeURIComponent(participantId)}`;
}

function isParticipantType(value: string): value is ParticipantType {
  return value === "employee" || value === "candidate";
}

function isParticipantStatus(value: string): value is ParticipantStatus {
  return value === "active" || value === "inactive";
}

export async function createParticipant(formData: FormData) {
  const user = await requireAuthenticatedUserForAction();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    redirect("/dashboard?error=no-active-organization");
  }

  const fullName = getFieldValue(formData, "fullName");
  const email = getFieldValue(formData, "email").toLowerCase();
  const participantType = getFieldValue(formData, "participantType");
  const status = getFieldValue(formData, "status") || "active";

  if (!fullName) {
    redirect("/dashboard?error=participant-full-name-required");
  }

  if (!email) {
    redirect("/dashboard?error=participant-email-required");
  }

  if (!isParticipantType(participantType)) {
    redirect("/dashboard?error=participant-type-invalid");
  }

  if (!isParticipantStatus(status)) {
    redirect("/dashboard?error=participant-status-invalid");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("participants").insert({
    organization_id: organization.id,
    user_id: null,
    full_name: fullName,
    email,
    participant_type: participantType,
    status,
  });

  if (error) {
    redirect(`/dashboard?error=create-participant-failed&detail=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard?success=participant-created");
}

export async function createAssessmentAttempt(formData: FormData) {
  const user = await requireAuthenticatedUserForAction();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    redirect("/dashboard?error=no-active-organization");
  }

  const participantId = getFieldValue(formData, "participantId");
  const testId = getFieldValue(formData, "testId");
  const locale = normalizeAssessmentLocale(getFieldValue(formData, "locale"));

  if (!participantId) {
    redirect("/dashboard?error=attempt-participant-required");
  }

  if (!testId) {
    redirect(`/dashboard?error=attempt-test-required&openAttemptFor=${encodeURIComponent(participantId)}`);
  }

  const participant = await getParticipantForOrganization(organization.id, participantId);

  if (!participant) {
    redirect(`/dashboard?error=participant-not-found&openAttemptFor=${encodeURIComponent(participantId)}`);
  }

  const supabase = createSupabaseAdminClient();
  const { data: testAccess, error: testAccessError } = await supabase
    .from("organization_test_access")
    .select("test_id")
    .eq("organization_id", organization.id)
    .eq("test_id", testId)
    .maybeSingle();

  if (testAccessError) {
    redirect(
      `/dashboard?error=attempt-test-access-check-failed&openAttemptFor=${encodeURIComponent(participantId)}`,
    );
  }

  if (!testAccess) {
    redirect(`/dashboard?error=attempt-test-not-available&openAttemptFor=${encodeURIComponent(participantId)}`);
  }

  const { error } = await supabase.from("attempts").insert({
    organization_id: organization.id,
    participant_id: participant.id,
    test_id: testId,
    locale,
    user_id: participant.user_id,
    status: "in_progress",
    started_at: new Date().toISOString(),
  });

  if (error) {
    redirect(
      `/dashboard?error=create-attempt-failed&openAttemptFor=${encodeURIComponent(participantId)}&detail=${encodeURIComponent(error.message)}`,
    );
  }

  redirect("/dashboard?success=attempt-created");
}

export async function createStandardAssessmentBattery(formData: FormData) {
  const user = await requireAuthenticatedUserForAction();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    redirect("/dashboard?error=no-active-organization");
  }

  const participantId = getFieldValue(formData, "participantId");
  const rawLocale = getFieldValue(formData, "locale");

  if (!participantId) {
    redirect("/dashboard?error=attempt-participant-required");
  }

  const participant = await getParticipantForOrganization(organization.id, participantId);

  if (!participant) {
    redirect(withOpenAttemptFor("/dashboard?error=participant-not-found", participantId));
  }

  const supabase = createSupabaseAdminClient();
  const { data: batteryTestsData, error: batteryTestsError } = await supabase
    .from("tests")
    .select("id, slug, status, is_active")
    .in("slug", [...STANDARD_ASSESSMENT_BATTERY_SLUGS]);

  if (batteryTestsError) {
    redirect(
      withOpenAttemptFor(
        `/dashboard?error=battery-create-failed&detail=${encodeURIComponent(batteryTestsError.message)}`,
        participantId,
      ),
    );
  }

  const batteryTests = (batteryTestsData ?? []) as StandardBatteryTestRow[];
  const candidateTests = batteryTests.filter(
    (test) => test.status === "active" && test.is_active === true,
  );

  let activeQuestionTestIds = new Set<string>();

  if (candidateTests.length > 0) {
    const { data: questionRows, error: questionError } = await supabase
      .from("questions")
      .select("test_id")
      .in(
        "test_id",
        candidateTests.map((test) => test.id),
      )
      .eq("is_active", true);

    if (questionError) {
      redirect(
        withOpenAttemptFor(
          `/dashboard?error=battery-create-failed&detail=${encodeURIComponent(questionError.message)}`,
          participantId,
        ),
      );
    }

    activeQuestionTestIds = new Set((questionRows ?? []).map((row) => String(row.test_id)));
  }

  let existingAttemptsData: StandardBatteryExistingAttemptRow[] = [];

  if (candidateTests.length > 0) {
    const { data, error: existingAttemptsError } = await supabase
      .from("attempts")
      .select("id, test_id, status")
      .eq("organization_id", organization.id)
      .eq("participant_id", participant.id)
      .in(
        "test_id",
        candidateTests.map((test) => test.id),
      )
      .in("status", ["in_progress", "completed"]);

    if (existingAttemptsError) {
      redirect(
        withOpenAttemptFor(
          `/dashboard?error=battery-create-failed&detail=${encodeURIComponent(existingAttemptsError.message)}`,
          participantId,
        ),
      );
    }

    existingAttemptsData = (data ?? []) as StandardBatteryExistingAttemptRow[];
  }

  const batteryPlan = planStandardAssessmentBatteryCreation({
    availableTests: batteryTests,
    activeQuestionTestIds,
    existingAttempts: existingAttemptsData,
    organizationId: organization.id,
    participantId: participant.id,
    participantUserId: participant.user_id,
    locale: rawLocale,
    startedAt: new Date().toISOString(),
  });

  if (batteryPlan.outcome === "battery-no-runnable-tests") {
    redirect(withOpenAttemptFor("/dashboard?error=battery-no-runnable-tests", participantId));
  }

  if (batteryPlan.attemptIdsToAbandon.length > 0) {
    const { error: abandonError } = await supabase
      .from("attempts")
      .update({ status: "abandoned" })
      .in("id", batteryPlan.attemptIdsToAbandon)
      .eq("organization_id", organization.id)
      .eq("participant_id", participant.id)
      .eq("status", "in_progress");

    if (abandonError) {
      redirect(
        withOpenAttemptFor(
          `/dashboard?error=battery-create-failed&detail=${encodeURIComponent(abandonError.message)}`,
          participantId,
        ),
      );
    }
  }

  const { error: insertError } = await supabase.from("attempts").insert(batteryPlan.attemptsToInsert);

  if (insertError) {
    redirect(
      withOpenAttemptFor(
        `/dashboard?error=battery-create-failed&detail=${encodeURIComponent(insertError.message)}`,
        participantId,
      ),
    );
  }

  redirect(withOpenAttemptFor("/dashboard?success=battery-created", participantId));
}
