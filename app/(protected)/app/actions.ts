"use server";

import { requireAuthenticatedUserForAction } from "@/lib/auth/session";
import { getActiveOrganizationForUser } from "@/lib/b2b/organizations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type OrganizationTestAccessRow = {
  test_id: string;
};

type CreatedAttemptRow = {
  id: string;
};

type ParticipantRow = {
  id: string;
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
  const { data: accessRow, error: accessError } = await supabase
    .from("organization_test_access")
    .select("test_id")
    .eq("organization_id", organization.id)
    .eq("test_id", normalizedTestId)
    .maybeSingle();

  if (accessError) {
    throw new Error(`Failed to validate assessment access: ${accessError.message}`);
  }

  if (!(accessRow as OrganizationTestAccessRow | null)) {
    throw new Error("Assessment access not granted.");
  }

  const { data: participantRow, error: participantError } = await supabase
    .from("participants")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (participantError) {
    throw new Error(`Failed to resolve participant: ${participantError.message}`);
  }

  if (!(participantRow as ParticipantRow | null)) {
    throw new Error("Active participant is required.");
  }

  const participantId = (participantRow as ParticipantRow).id;
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

  const { data: attemptRow, error: attemptError } = await supabase
    .from("attempts")
    .insert({
      test_id: normalizedTestId,
      user_id: user.id,
      organization_id: organization.id,
      participant_id: participantId,
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
