import "server-only";

import { STANDARD_ASSESSMENT_BATTERY_SLUGS } from "@/lib/assessment/standard-battery";
import type { AssessmentLocale } from "@/lib/assessment/locale";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const ASSESSMENT_ASSIGNMENT_TYPES = ["standard_battery"] as const;
export const ASSESSMENT_ASSIGNMENT_STATUSES = [
  "active",
  "completed",
  "abandoned",
  "cancelled",
] as const;
export const ASSESSMENT_ASSIGNMENT_ATTEMPT_ROLES = [
  "standard_component",
  "team_fit_component",
  "optional_component",
] as const;

export type AssessmentAssignmentType = (typeof ASSESSMENT_ASSIGNMENT_TYPES)[number];
export type AssessmentAssignmentStatus = (typeof ASSESSMENT_ASSIGNMENT_STATUSES)[number];
export type AssessmentAssignmentAttemptRole = (typeof ASSESSMENT_ASSIGNMENT_ATTEMPT_ROLES)[number];

export type AssessmentAssignmentRecord = {
  id: string;
  organization_id: string;
  participant_id: string;
  assignment_type: AssessmentAssignmentType;
  status: AssessmentAssignmentStatus;
  locale: AssessmentLocale;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
};

export type StandardAssessmentAssignmentInsert = {
  organization_id: string;
  participant_id: string;
  assignment_type: "standard_battery";
  status: "active";
  locale: AssessmentLocale;
  created_by_user_id: string | null;
  metadata: Record<string, unknown>;
};

export type StandardAssignmentAttemptLinkInput = {
  assignmentId: string;
  attempts: Array<{
    id: string;
    test_id: string;
    test_slug: string;
  }>;
};

export type StandardAssessmentAssignmentAttemptInsert = {
  assessment_assignment_id: string;
  attempt_id: string;
  test_id: string;
  test_slug: string;
  role_in_assignment: "standard_component";
  required_for_composite: true;
  required_for_team_fit: false;
  position: number | null;
  metadata: Record<string, unknown>;
};

function getStandardBatteryPosition(testSlug: string): number | null {
  const index = STANDARD_ASSESSMENT_BATTERY_SLUGS.findIndex((slug) => slug === testSlug);
  return index >= 0 ? index : null;
}

export function buildStandardAssessmentAssignmentInsert(input: {
  organizationId: string;
  participantId: string;
  locale: AssessmentLocale;
  createdByUserId: string | null;
  metadata?: Record<string, unknown>;
}): StandardAssessmentAssignmentInsert {
  return {
    organization_id: input.organizationId,
    participant_id: input.participantId,
    assignment_type: "standard_battery",
    status: "active",
    locale: input.locale,
    created_by_user_id: input.createdByUserId,
    metadata: input.metadata ?? {},
  };
}

export function buildAssignmentAttemptLinks(
  input: StandardAssignmentAttemptLinkInput,
): StandardAssessmentAssignmentAttemptInsert[] {
  return input.attempts.map((attempt) => ({
    assessment_assignment_id: input.assignmentId,
    attempt_id: attempt.id,
    test_id: attempt.test_id,
    test_slug: attempt.test_slug,
    role_in_assignment: "standard_component",
    required_for_composite: true,
    required_for_team_fit: false,
    position: getStandardBatteryPosition(attempt.test_slug),
    metadata: {},
  }));
}

export async function abandonActiveStandardAssessmentAssignments(input: {
  organizationId: string;
  participantId: string;
}): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const { data: activeAssignments, error: activeAssignmentsError } = await supabase
    .from("assessment_assignments")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("participant_id", input.participantId)
    .eq("assignment_type", "standard_battery")
    .eq("status", "active");

  if (activeAssignmentsError) {
    throw new Error(`Failed to load active assessment assignments: ${activeAssignmentsError.message}`);
  }

  const assignmentIds = (activeAssignments ?? []).map((row) => String(row.id));

  if (assignmentIds.length === 0) {
    return [];
  }

  const { error: abandonError } = await supabase
    .from("assessment_assignments")
    .update({
      status: "abandoned",
      completed_at: new Date().toISOString(),
    })
    .in("id", assignmentIds)
    .eq("status", "active");

  if (abandonError) {
    throw new Error(`Failed to abandon active assessment assignments: ${abandonError.message}`);
  }

  return assignmentIds;
}

export async function createStandardAssessmentAssignment(input: {
  organizationId: string;
  participantId: string;
  locale: AssessmentLocale;
  createdByUserId: string | null;
  metadata?: Record<string, unknown>;
}): Promise<AssessmentAssignmentRecord> {
  const supabase = createSupabaseAdminClient();
  const insertPayload = buildStandardAssessmentAssignmentInsert(input);
  const { data, error } = await supabase
    .from("assessment_assignments")
    .insert(insertPayload)
    .select(
      "id, organization_id, participant_id, assignment_type, status, locale, created_by_user_id, created_at, updated_at, completed_at, metadata",
    )
    .single();

  if (error || !data) {
    throw new Error(`Failed to create assessment assignment: ${error?.message ?? "unknown error"}`);
  }

  return data as AssessmentAssignmentRecord;
}

export async function createAssignmentAttemptLinks(
  links: StandardAssessmentAssignmentAttemptInsert[],
): Promise<void> {
  if (links.length === 0) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("assessment_assignment_attempts")
    .insert(links);

  if (error) {
    throw new Error(`Failed to create assessment assignment attempt links: ${error.message}`);
  }
}
