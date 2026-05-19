"use server";

import { getAppLocaleCookieValue } from "@/lib/auth/app-locale";
import { resolveAddressingForm } from "@/lib/auth/addressing-form";
import { requireAuthenticatedUserForAction } from "@/lib/auth/session";
import { getCandidateAssessmentAvailability } from "@/lib/assessment/availability";
import { canUseGenericCandidateAttemptCreation } from "@/lib/assessment/team-dynamics";
import { getTestRunReadiness } from "@/lib/assessment/tests";
import { getActiveOrganizationForUser } from "@/lib/b2b/organizations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type OrganizationTestAccessRow = {
  test_id: string;
};

type AssessmentAccessTestRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  is_active: boolean;
};

type CreatedAttemptRow = {
  id: string;
};

type ParticipantRow = {
  id: string;
  addressing_form: unknown;
};

export async function createAssessmentAttempt(
  testId: string,
  orgId?: string,
): Promise<string> {
  const normalizedTestId = testId.trim();
  const normalizedOrgId = orgId?.trim();

  if (!normalizedTestId) {
    throw new Error("Test id is required.");
  }

  const user = await requireAuthenticatedUserForAction();
  const organization = normalizedOrgId
    ? { id: normalizedOrgId }
    : await getActiveOrganizationForUser(user.id);

  if (!organization) {
    throw new Error("Active organization is required.");
  }

  const supabase = createSupabaseAdminClient();
  const [
    { data: testRow, error: testError },
    { data: accessRow, error: accessError },
    readiness,
  ] = await Promise.all([
    supabase
      .from("tests")
      .select("id, slug, name, status, is_active")
      .eq("id", normalizedTestId)
      .maybeSingle(),
    supabase
      .from("organization_test_access")
      .select("test_id")
      .eq("organization_id", organization.id)
      .eq("test_id", normalizedTestId)
      .maybeSingle(),
    getTestRunReadiness(normalizedTestId),
  ]);

  if (testError) {
    throw new Error(`Failed to load assessment: ${testError.message}`);
  }

  if (!(testRow as AssessmentAccessTestRow | null)) {
    throw new Error("Assessment was not found.");
  }

  if (accessError) {
    throw new Error(`Failed to validate assessment access: ${accessError.message}`);
  }

  const test = testRow as AssessmentAccessTestRow;

  if (!canUseGenericCandidateAttemptCreation(test.slug)) {
    throw new Error("Team Dynamics assessments must be assigned through a team workflow.");
  }

  const availability = getCandidateAssessmentAvailability({
    slug: test.slug,
    name: test.name,
    status: test.status,
    isActive: test.is_active,
    hasOrganizationAccess: Boolean(accessRow as OrganizationTestAccessRow | null),
    activeQuestionCount: readiness.activeQuestionCount,
  });

  const { data: participantRow, error: participantError } = await supabase
    .from("participants")
    .select("id, addressing_form")
    .eq("user_id", user.id)
    .maybeSingle();

  if (participantError) {
    throw new Error(`Failed to resolve participant: ${participantError.message}`);
  }

  if (!(participantRow as ParticipantRow | null)) {
    throw new Error("Active participant is required.");
  }

  if (!availability.canStart) {
    throw new Error("Assessment is not available for candidates yet.");
  }

  const participantId = (participantRow as ParticipantRow).id;
  // Temporary fallback until every attempt entry path is gated by the addressing-form modal.
  const addressingFormSnapshot = resolveAddressingForm(
    (participantRow as ParticipantRow).addressing_form,
  );
  const { data: existingAttemptRow, error: existingAttemptError } = await supabase
    .from("attempts")
    .select("id")
    .eq("test_id", normalizedTestId)
    .eq("user_id", user.id)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingAttemptError) {
    throw new Error(`Failed to resolve existing assessment attempt: ${existingAttemptError.message}`);
  }

  if ((existingAttemptRow as CreatedAttemptRow | null)?.id) {
    return (existingAttemptRow as CreatedAttemptRow).id;
  }

  const attemptLocale = getAppLocaleCookieValue();
  const { data: attemptRow, error: attemptError } = await supabase
    .from("attempts")
    .insert({
      test_id: normalizedTestId,
      user_id: user.id,
      organization_id: organization.id,
      participant_id: participantId,
      locale: attemptLocale,
      addressing_form_snapshot: addressingFormSnapshot,
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (attemptError || !(attemptRow as CreatedAttemptRow | null)) {
    throw new Error(`Failed to create assessment attempt: ${attemptError?.message ?? "unknown error"}`);
  }

  return (attemptRow as CreatedAttemptRow).id;
}
