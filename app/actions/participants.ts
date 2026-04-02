"use server";

import { redirect } from "next/navigation";
import { requireAuthenticatedUserForAction } from "@/lib/auth/session";
import { normalizeAssessmentLocale } from "@/lib/assessment/locale";
import { getActiveOrganizationForUser, getParticipantForOrganization } from "@/lib/b2b/organizations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ParticipantType = "employee" | "candidate";
type ParticipantStatus = "active" | "inactive";

function getFieldValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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
