import "server-only";

import { resolveAddressingForm, type AddressingForm } from "@/lib/auth/addressing-form";
import { normalizeAssessmentLocale, type AssessmentLocale } from "@/lib/assessment/locale";
import { TEAM_DYNAMICS_TEST_SLUG } from "@/lib/assessment/team-dynamics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const TEAM_ASSESSMENT_ASSIGNMENT_STATUSES = [
  "draft",
  "active",
  "closed",
  "ready_for_report",
  "reported",
  "cancelled",
] as const;
export const TEAM_ASSESSMENT_PARTICIPANT_STATUSES = [
  "invited",
  "started",
  "completed",
  "expired",
] as const;

export type TeamAssessmentAssignmentStatus =
  (typeof TEAM_ASSESSMENT_ASSIGNMENT_STATUSES)[number];
export type TeamAssessmentParticipantStatus =
  (typeof TEAM_ASSESSMENT_PARTICIPANT_STATUSES)[number];

export type TeamAssessmentAssignmentInsert = {
  team_id: string;
  package_slug: string;
  status: TeamAssessmentAssignmentStatus;
  created_by_user_id: string | null;
  opened_at: string | null;
  closed_at: string | null;
};

export type TeamMembershipParticipantSeed = {
  id: string;
  participant_id: string;
  participant_user_id: string | null;
  participant_addressing_form: unknown;
};

export type TeamAssessmentParticipantInsert = {
  team_assessment_assignment_id: string;
  team_membership_id: string;
  participant_id: string;
  status: "invited";
  invited_at: string;
};

export type TeamAssessmentParticipantAttemptSeed = {
  id: string;
  participant_id: string;
  participant_user_id: string | null;
  participant_addressing_form: unknown;
};

export type TeamDynamicsAttemptInsert = {
  test_id: string;
  user_id: string | null;
  organization_id: string;
  participant_id: string;
  locale: AssessmentLocale;
  addressing_form_snapshot: AddressingForm;
  status: "in_progress";
  started_at: string;
};

export type TeamAssessmentParticipantAttemptUpdate = {
  id: string;
  attempt_id: string;
};

export type TeamAssessmentParticipantCompletionRecord = {
  id: string;
  attempt_id: string | null;
  status: TeamAssessmentParticipantStatus;
  started_at: string | null;
  completed_at: string | null;
};

export function buildTeamAssessmentAssignmentInsert(input: {
  teamId: string;
  createdByUserId: string | null;
  packageSlug?: string;
  status?: TeamAssessmentAssignmentStatus;
  openedAt?: string | null;
  closedAt?: string | null;
}): TeamAssessmentAssignmentInsert {
  return {
    team_id: input.teamId,
    package_slug: input.packageSlug ?? TEAM_DYNAMICS_TEST_SLUG,
    status: input.status ?? "draft",
    created_by_user_id: input.createdByUserId,
    opened_at: input.openedAt ?? null,
    closed_at: input.closedAt ?? null,
  };
}

export function buildTeamAssessmentParticipantInserts(input: {
  teamAssessmentAssignmentId: string;
  memberships: TeamMembershipParticipantSeed[];
  invitedAt: string;
}): TeamAssessmentParticipantInsert[] {
  return input.memberships.map((membership) => ({
    team_assessment_assignment_id: input.teamAssessmentAssignmentId,
    team_membership_id: membership.id,
    participant_id: membership.participant_id,
    status: "invited",
    invited_at: input.invitedAt,
  }));
}

export function buildTeamDynamicsAttemptInserts(input: {
  testId: string;
  organizationId: string;
  teamAssessmentParticipants: TeamAssessmentParticipantAttemptSeed[];
  locale: string | null | undefined;
  startedAt: string;
}): TeamDynamicsAttemptInsert[] {
  const locale = normalizeAssessmentLocale(input.locale);

  return input.teamAssessmentParticipants.map((participant) => ({
    test_id: input.testId,
    user_id: participant.participant_user_id,
    organization_id: input.organizationId,
    participant_id: participant.participant_id,
    locale,
    addressing_form_snapshot: resolveAddressingForm(participant.participant_addressing_form),
    status: "in_progress",
    started_at: input.startedAt,
  }));
}

export function mapAttemptIdsToTeamAssessmentParticipants(input: {
  teamAssessmentParticipants: Array<{
    id: string;
    participant_id: string;
  }>;
  createdAttempts: Array<{
    id: string;
    participant_id: string;
  }>;
}): TeamAssessmentParticipantAttemptUpdate[] {
  const attemptIdByParticipantId = new Map(
    input.createdAttempts.map((attempt) => [attempt.participant_id, attempt.id]),
  );

  return input.teamAssessmentParticipants.map((participant) => {
    const attemptId = attemptIdByParticipantId.get(participant.participant_id);

    if (!attemptId) {
      throw new Error(
        `Missing Team Dynamics attempt for participant ${participant.participant_id}.`,
      );
    }

    return {
      id: participant.id,
      attempt_id: attemptId,
    };
  });
}

export function buildTeamAssessmentParticipantCompletionPatch(input: {
  completedAt: string;
  startedAt?: string | null;
}): Pick<
  TeamAssessmentParticipantCompletionRecord,
  "status" | "started_at" | "completed_at"
> {
  return {
    status: "completed",
    started_at: input.startedAt ?? input.completedAt,
    completed_at: input.completedAt,
  };
}

export async function syncTeamAssessmentParticipantCompletionByAttemptId(input: {
  attemptId: string;
  completedAt: string;
}): Promise<TeamAssessmentParticipantCompletionRecord | null> {
  const supabase = createSupabaseAdminClient();
  const { data: existingRow, error: loadError } = await supabase
    .from("team_assessment_participants")
    .select("id, attempt_id, status, started_at, completed_at")
    .eq("attempt_id", input.attemptId)
    .maybeSingle();

  if (loadError) {
    throw new Error(`Failed to load team assessment participant completion target: ${loadError.message}`);
  }

  const existing = (existingRow as TeamAssessmentParticipantCompletionRecord | null) ?? null;

  if (!existing) {
    return null;
  }

  const patch = buildTeamAssessmentParticipantCompletionPatch({
    completedAt: input.completedAt,
    startedAt: existing.started_at,
  });
  const { data: updatedRow, error: updateError } = await supabase
    .from("team_assessment_participants")
    .update(patch)
    .eq("id", existing.id)
    .select("id, attempt_id, status, started_at, completed_at")
    .single();

  if (updateError) {
    throw new Error(`Failed to sync team assessment participant completion: ${updateError.message}`);
  }

  return updatedRow as TeamAssessmentParticipantCompletionRecord;
}
