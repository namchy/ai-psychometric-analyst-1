import "server-only";

import { resolveAddressingForm, type AddressingForm } from "@/lib/auth/addressing-form";
import { normalizeAssessmentLocale, type AssessmentLocale } from "@/lib/assessment/locale";
import { TEAM_DYNAMICS_TEST_SLUG } from "@/lib/assessment/team-dynamics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const TEAM_DYNAMICS_TEST_NOT_READY = "TEAM_DYNAMICS_TEST_NOT_READY" as const;
export const TEAM_DYNAMICS_MEMBER_MISSING_LINKED_USER =
  "TEAM_DYNAMICS_MEMBER_MISSING_LINKED_USER" as const;

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

export type TeamAssessmentTeamRecord = {
  id: string;
  organization_id: string;
  archived_at: string | null;
};

export type TeamMembershipWithParticipantRecord = {
  id: string;
  team_id: string;
  participant_id: string;
  is_active: boolean;
  left_at: string | null;
  participants:
    | {
        id: string;
        organization_id: string;
        user_id: string | null;
        addressing_form: unknown;
        status: string;
      }
    | Array<{
        id: string;
        organization_id: string;
        user_id: string | null;
        addressing_form: unknown;
        status: string;
      }>
    | null;
};

export type TeamAssessmentAssignmentRecord = {
  id: string;
  team_id: string;
  package_slug: string;
  status: TeamAssessmentAssignmentStatus;
};

export type TeamAssessmentParticipantRecord = {
  id: string;
  team_assessment_assignment_id: string;
  team_membership_id: string;
  participant_id: string;
  attempt_id: string | null;
  status: TeamAssessmentParticipantStatus;
  invited_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type TeamDynamicsRunnableTestRecord = {
  id: string;
  slug: string;
  status: string;
  is_active: boolean;
};

export type TeamDynamicsCreatePlan = {
  assignment: {
    mode: "create" | "reuse";
    insert: TeamAssessmentAssignmentInsert | null;
    existingAssignmentId: string | null;
  };
  participantInserts: TeamAssessmentParticipantInsert[];
  attemptInserts: TeamDynamicsAttemptInsert[];
  attemptTargets: Array<{
    team_membership_id: string;
    participant_id: string;
  }>;
  locale: AssessmentLocale;
};

export type CreateTeamDynamicsAssessmentForTeamResult = {
  assignmentId: string;
  assignmentAction: "created" | "reused";
  participantsCreated: number;
  attemptsCreated: number;
  attemptMappingsCreated: number;
};

export type TeamDynamicsRunReadinessReason =
  | "test_missing"
  | "test_inactive"
  | "missing_active_questions"
  | "missing_question_options";

export type TeamDynamicsRunReadiness = {
  isReady: boolean;
  testId: string | null;
  activeQuestionIds: string[];
  questionIdsWithOptions: string[];
  questionIdsMissingOptions: string[];
  failureCode: typeof TEAM_DYNAMICS_TEST_NOT_READY | null;
  reason: TeamDynamicsRunReadinessReason | null;
};

export class TeamDynamicsTestNotReadyError extends Error {
  readonly code = TEAM_DYNAMICS_TEST_NOT_READY;

  constructor(message = "Team Dynamics test is not runtime-ready.") {
    super(message);
    this.name = "TeamDynamicsTestNotReadyError";
  }
}

export class TeamDynamicsMemberMissingLinkedUserError extends Error {
  readonly code = TEAM_DYNAMICS_MEMBER_MISSING_LINKED_USER;
  readonly membershipId: string;
  readonly participantId: string;

  constructor(input: { membershipId: string; participantId: string }) {
    super(
      `Team membership ${input.membershipId} is missing a linked user for participant ${input.participantId}.`,
    );
    this.name = "TeamDynamicsMemberMissingLinkedUserError";
    this.membershipId = input.membershipId;
    this.participantId = input.participantId;
  }
}

function normalizeParticipantRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

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

export function buildTeamDynamicsRunReadiness(input: {
  test: TeamDynamicsRunnableTestRecord | null;
  activeQuestionIds: Iterable<string>;
  questionIdsWithOptions?: Iterable<string>;
}): TeamDynamicsRunReadiness {
  const activeQuestionIds = [...input.activeQuestionIds];
  const questionIdsWithOptions = [...(input.questionIdsWithOptions ?? [])];
  const questionIdsWithOptionsSet = new Set(questionIdsWithOptions);
  const questionIdsMissingOptions = activeQuestionIds.filter(
    (questionId) => !questionIdsWithOptionsSet.has(questionId),
  );

  if (!input.test) {
    return {
      isReady: false,
      testId: null,
      activeQuestionIds,
      questionIdsWithOptions,
      questionIdsMissingOptions,
      failureCode: TEAM_DYNAMICS_TEST_NOT_READY,
      reason: "test_missing",
    };
  }

  if (input.test.slug !== TEAM_DYNAMICS_TEST_SLUG) {
    throw new Error(`Unexpected Team Dynamics test slug: ${input.test.slug}`);
  }

  if (input.test.status !== "active" || input.test.is_active !== true) {
    return {
      isReady: false,
      testId: input.test.id,
      activeQuestionIds,
      questionIdsWithOptions,
      questionIdsMissingOptions,
      failureCode: TEAM_DYNAMICS_TEST_NOT_READY,
      reason: "test_inactive",
    };
  }

  if (activeQuestionIds.length === 0) {
    return {
      isReady: false,
      testId: input.test.id,
      activeQuestionIds,
      questionIdsWithOptions,
      questionIdsMissingOptions,
      failureCode: TEAM_DYNAMICS_TEST_NOT_READY,
      reason: "missing_active_questions",
    };
  }

  if (questionIdsMissingOptions.length > 0) {
    return {
      isReady: false,
      testId: input.test.id,
      activeQuestionIds,
      questionIdsWithOptions,
      questionIdsMissingOptions,
      failureCode: TEAM_DYNAMICS_TEST_NOT_READY,
      reason: "missing_question_options",
    };
  }

  return {
    isReady: true,
    testId: input.test.id,
    activeQuestionIds,
    questionIdsWithOptions,
    questionIdsMissingOptions: [],
    failureCode: null,
    reason: null,
  };
}

export function assertTeamDynamicsRunReadiness(
  readiness: TeamDynamicsRunReadiness,
): asserts readiness is TeamDynamicsRunReadiness & { isReady: true; testId: string } {
  if (readiness.isReady) {
    return;
  }

  throw new TeamDynamicsTestNotReadyError(
    `Team Dynamics create flow requires an active imported test with active questions and answer options. Reason: ${readiness.reason ?? "unknown"}.`,
  );
}

export function assertValidTeamDynamicsAssessmentCreateContext(input: {
  organizationId: string;
  team: TeamAssessmentTeamRecord | null;
  memberships: TeamMembershipWithParticipantRecord[];
}): TeamMembershipWithParticipantRecord[] {
  if (!input.team) {
    throw new Error("Team was not found.");
  }

  if (input.team.organization_id !== input.organizationId) {
    throw new Error("Team does not belong to the active organization.");
  }

  if (input.team.archived_at) {
    throw new Error("Archived teams cannot start Team Dynamics assessments.");
  }

  const validatedMemberships = input.memberships.map((membership) => {
    const participant = normalizeParticipantRelation(membership.participants);

    if (membership.team_id !== input.team!.id) {
      throw new Error(`Membership ${membership.id} does not belong to the requested team.`);
    }

    if (!membership.is_active || membership.left_at) {
      throw new Error(`Membership ${membership.id} is not active.`);
    }

    if (!participant) {
      throw new Error(`Membership ${membership.id} is missing a linked participant.`);
    }

    if (participant.organization_id !== input.organizationId) {
      throw new Error(
        `Participant ${participant.id} does not belong to organization ${input.organizationId}.`,
      );
    }

    return {
      ...membership,
      participants: participant,
    };
  });

  if (validatedMemberships.length === 0) {
    throw new Error("At least one active team membership is required.");
  }

  return validatedMemberships;
}

export function assertTeamDynamicsMembershipsHaveLinkedUsers(
  memberships: TeamMembershipWithParticipantRecord[],
): TeamMembershipWithParticipantRecord[] {
  for (const membership of memberships) {
    const participant = normalizeParticipantRelation(membership.participants);

    if (!participant) {
      continue;
    }

    if (!participant.user_id) {
      throw new TeamDynamicsMemberMissingLinkedUserError({
        membershipId: membership.id,
        participantId: membership.participant_id,
      });
    }
  }

  return memberships;
}

export function buildTeamDynamicsCreatePlan(input: {
  organizationId: string;
  team: TeamAssessmentTeamRecord | null;
  memberships: TeamMembershipWithParticipantRecord[];
  createdByUserId: string | null;
  testId: string;
  locale: string | null | undefined;
  createdAt: string;
  existingActiveAssignment?: TeamAssessmentAssignmentRecord | null;
  existingParticipants?: TeamAssessmentParticipantRecord[];
}): TeamDynamicsCreatePlan {
  const memberships = assertValidTeamDynamicsAssessmentCreateContext({
    organizationId: input.organizationId,
    team: input.team,
    memberships: input.memberships,
  });
  const locale = normalizeAssessmentLocale(input.locale);
  const existingAssignment = input.existingActiveAssignment ?? null;
  const existingParticipants = input.existingParticipants ?? [];
  const assignmentId = existingAssignment?.id ?? "__PENDING_ASSIGNMENT_ID__";
  const existingParticipantsByMembershipId = new Map(
    existingParticipants.map((participant) => [participant.team_membership_id, participant]),
  );

  const membershipsMissingParticipants = memberships.filter(
    (membership) => !existingParticipantsByMembershipId.has(membership.id),
  );
  const participantInserts = buildTeamAssessmentParticipantInserts({
    teamAssessmentAssignmentId: assignmentId,
    memberships: membershipsMissingParticipants.map((membership) => {
      const participant = normalizeParticipantRelation(membership.participants);

      return {
        id: membership.id,
        participant_id: membership.participant_id,
        participant_user_id: participant?.user_id ?? null,
        participant_addressing_form: participant?.addressing_form ?? null,
      };
    }),
    invitedAt: input.createdAt,
  });

  const participantSeedsNeedingAttempts = memberships
    .filter((membership) => !existingParticipantsByMembershipId.get(membership.id)?.attempt_id)
    .map((membership) => {
      const participant = normalizeParticipantRelation(membership.participants);

      return {
        id: existingParticipantsByMembershipId.get(membership.id)?.id ?? `pending:${membership.id}`,
        participant_id: membership.participant_id,
        participant_user_id: participant?.user_id ?? null,
        participant_addressing_form: participant?.addressing_form ?? null,
        team_membership_id: membership.id,
      };
    });

  return {
    assignment: existingAssignment
      ? {
          mode: "reuse",
          insert: null,
          existingAssignmentId: existingAssignment.id,
        }
      : {
          mode: "create",
          insert: buildTeamAssessmentAssignmentInsert({
            teamId: input.team!.id,
            createdByUserId: input.createdByUserId,
            packageSlug: TEAM_DYNAMICS_TEST_SLUG,
            status: "active",
            openedAt: input.createdAt,
          }),
          existingAssignmentId: null,
        },
    participantInserts,
    attemptInserts: buildTeamDynamicsAttemptInserts({
      testId: input.testId,
      organizationId: input.organizationId,
      teamAssessmentParticipants: participantSeedsNeedingAttempts,
      locale,
      startedAt: input.createdAt,
    }),
    attemptTargets: participantSeedsNeedingAttempts.map((participant) => ({
      team_membership_id: participant.team_membership_id,
      participant_id: participant.participant_id,
    })),
    locale,
  };
}

async function cancelTeamAssessmentAssignment(input: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  assignmentId: string | null;
}): Promise<void> {
  if (!input.assignmentId) {
    return;
  }

  await input.supabase
    .from("team_assessment_assignments")
    .update({
      status: "cancelled",
      closed_at: new Date().toISOString(),
    })
    .eq("id", input.assignmentId)
    .in("status", ["draft", "active"]);
}

async function getTeamDynamicsTestId(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<string> {
  const { data, error } = await supabase
    .from("tests")
    .select("id, slug, status, is_active")
    .eq("slug", TEAM_DYNAMICS_TEST_SLUG)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve Team Dynamics test: ${error.message}`);
  }

  const test = (data as TeamDynamicsRunnableTestRecord | null) ?? null;

  if (!test?.id) {
    throw new TeamDynamicsTestNotReadyError("Team Dynamics test is not imported.");
  }

  const { data: questionData, error: questionError } = await supabase
    .from("questions")
    .select("id")
    .eq("test_id", test.id)
    .eq("is_active", true)
    .order("question_order", { ascending: true });

  if (questionError) {
    throw new Error(`Failed to resolve Team Dynamics active questions: ${questionError.message}`);
  }

  const activeQuestionIds = ((questionData ?? []) as Array<{ id: string }>).map((question) => question.id);
  let questionIdsWithOptions: string[] = [];

  if (activeQuestionIds.length > 0) {
    const { data: optionData, error: optionError } = await supabase
      .from("answer_options")
      .select("question_id")
      .in("question_id", activeQuestionIds);

    if (optionError) {
      throw new Error(`Failed to resolve Team Dynamics answer options: ${optionError.message}`);
    }

    questionIdsWithOptions = [
      ...new Set(
        ((optionData ?? []) as Array<{ question_id: string | null }>).flatMap((option) =>
          option.question_id ? [option.question_id] : [],
        ),
      ),
    ];
  }

  const readiness = buildTeamDynamicsRunReadiness({
    test,
    activeQuestionIds,
    questionIdsWithOptions,
  });
  assertTeamDynamicsRunReadiness(readiness);
  return readiness.testId;
}

export async function createTeamDynamicsAssessmentForTeam(input: {
  organizationId: string;
  teamId: string;
  createdByUserId: string | null;
  locale?: string | null;
  requireLinkedUsers?: boolean;
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<CreateTeamDynamicsAssessmentForTeamResult> {
  const supabase = input.supabase ?? createSupabaseAdminClient();
  const createdAt = new Date().toISOString();
  const testId = await getTeamDynamicsTestId(supabase);
  const { data: teamData, error: teamError } = await supabase
    .from("teams")
    .select("id, organization_id, archived_at")
    .eq("id", input.teamId)
    .maybeSingle();

  if (teamError) {
    throw new Error(`Failed to load team: ${teamError.message}`);
  }

  const { data: membershipData, error: membershipError } = await supabase
    .from("team_memberships")
    .select(
      "id, team_id, participant_id, is_active, left_at, participants(id, organization_id, user_id, addressing_form, status)",
    )
    .eq("team_id", input.teamId)
    .eq("is_active", true)
    .is("left_at", null)
    .order("joined_at", { ascending: true })
    .order("id", { ascending: true });

  if (membershipError) {
    throw new Error(`Failed to load active team memberships: ${membershipError.message}`);
  }

  const { data: existingAssignmentData, error: existingAssignmentError } = await supabase
    .from("team_assessment_assignments")
    .select("id, team_id, package_slug, status")
    .eq("team_id", input.teamId)
    .eq("package_slug", TEAM_DYNAMICS_TEST_SLUG)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingAssignmentError) {
    throw new Error(`Failed to load active Team Dynamics assignment: ${existingAssignmentError.message}`);
  }

  const existingAssignment = (existingAssignmentData as TeamAssessmentAssignmentRecord | null) ?? null;
  let existingParticipants: TeamAssessmentParticipantRecord[] = [];

  if (existingAssignment?.id) {
    const { data: existingParticipantData, error: existingParticipantsError } = await supabase
      .from("team_assessment_participants")
      .select(
        "id, team_assessment_assignment_id, team_membership_id, participant_id, attempt_id, status, invited_at, started_at, completed_at",
      )
      .eq("team_assessment_assignment_id", existingAssignment.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (existingParticipantsError) {
      throw new Error(
        `Failed to load existing Team Dynamics participants: ${existingParticipantsError.message}`,
      );
    }

    existingParticipants = (existingParticipantData ?? []) as TeamAssessmentParticipantRecord[];
  }

  const validatedMemberships = input.requireLinkedUsers
    ? assertTeamDynamicsMembershipsHaveLinkedUsers(
        assertValidTeamDynamicsAssessmentCreateContext({
          organizationId: input.organizationId,
          team: (teamData as TeamAssessmentTeamRecord | null) ?? null,
          memberships: (membershipData ?? []) as TeamMembershipWithParticipantRecord[],
        }),
      )
    : ((membershipData ?? []) as TeamMembershipWithParticipantRecord[]);

  const plan = buildTeamDynamicsCreatePlan({
    organizationId: input.organizationId,
    team: (teamData as TeamAssessmentTeamRecord | null) ?? null,
    memberships: validatedMemberships,
    createdByUserId: input.createdByUserId,
    testId,
    locale: input.locale,
    createdAt,
    existingActiveAssignment: existingAssignment,
    existingParticipants,
  });

  let assignmentId = existingAssignment?.id ?? null;
  let createdAssignment = false;
  let createdParticipantIds: string[] = [];
  let createdAttemptIds: string[] = [];
  let createdParticipantRows: TeamAssessmentParticipantRecord[] = [];

  try {
    if (plan.assignment.mode === "create") {
      const { data: insertedAssignmentData, error: insertAssignmentError } = await supabase
        .from("team_assessment_assignments")
        .insert(plan.assignment.insert)
        .select("id")
        .single();

      if (insertAssignmentError || !insertedAssignmentData?.id) {
        throw new Error(
          `Failed to create Team Dynamics assignment: ${insertAssignmentError?.message ?? "unknown error"}`,
        );
      }

      assignmentId = insertedAssignmentData.id;
      createdAssignment = true;
    }

    if (!assignmentId) {
      throw new Error("Team Dynamics assignment id is missing.");
    }

    if (plan.participantInserts.length > 0) {
      const participantInserts = plan.participantInserts.map((participant) => ({
        ...participant,
        team_assessment_assignment_id: assignmentId,
      }));
      const { data: insertedParticipantData, error: insertParticipantsError } = await supabase
        .from("team_assessment_participants")
        .insert(participantInserts)
        .select(
          "id, team_assessment_assignment_id, team_membership_id, participant_id, attempt_id, status, invited_at, started_at, completed_at",
        );

      if (insertParticipantsError) {
        throw new Error(`Failed to create Team Dynamics participants: ${insertParticipantsError.message}`);
      }

      createdParticipantRows = (insertedParticipantData ?? []) as TeamAssessmentParticipantRecord[];
      createdParticipantIds = createdParticipantRows.map((participant) => participant.id);
    }

    const allParticipants = [...existingParticipants, ...createdParticipantRows];
    const participantByMembershipId = new Map(
      allParticipants.map((participant) => [participant.team_membership_id, participant]),
    );
    const attemptTargetParticipants = plan.attemptTargets.map((target) => {
      const participant = participantByMembershipId.get(target.team_membership_id);

      if (!participant) {
        throw new Error(
          `Missing Team Dynamics participant wrapper for membership ${target.team_membership_id}.`,
        );
      }

      return participant;
    });

    if (plan.attemptInserts.length > 0) {
      const { data: insertedAttemptData, error: insertAttemptsError } = await supabase
        .from("attempts")
        .insert(plan.attemptInserts)
        .select("id, participant_id");

      if (insertAttemptsError) {
        throw new Error(`Failed to create Team Dynamics attempts: ${insertAttemptsError.message}`);
      }

      const createdAttempts = (insertedAttemptData ?? []) as Array<{ id: string; participant_id: string }>;
      createdAttemptIds = createdAttempts.map((attempt) => attempt.id);
      const attemptUpdates = mapAttemptIdsToTeamAssessmentParticipants({
        teamAssessmentParticipants: attemptTargetParticipants.map((participant) => ({
          id: participant.id,
          participant_id: participant.participant_id,
        })),
        createdAttempts,
      });

      for (const attemptUpdate of attemptUpdates) {
        const { error: updateAttemptLinkError } = await supabase
          .from("team_assessment_participants")
          .update({ attempt_id: attemptUpdate.attempt_id })
          .eq("id", attemptUpdate.id)
          .is("attempt_id", null);

        if (updateAttemptLinkError) {
          throw new Error(
            `Failed to link Team Dynamics attempt ${attemptUpdate.attempt_id}: ${updateAttemptLinkError.message}`,
          );
        }
      }
    }

    return {
      assignmentId,
      assignmentAction: createdAssignment ? "created" : "reused",
      participantsCreated: createdParticipantIds.length,
      attemptsCreated: createdAttemptIds.length,
      attemptMappingsCreated: createdAttemptIds.length,
    };
  } catch (error) {
    if (createdAttemptIds.length > 0) {
      await supabase.from("attempts").delete().in("id", createdAttemptIds);
    }

    if (createdParticipantIds.length > 0) {
      await supabase.from("team_assessment_participants").delete().in("id", createdParticipantIds);
    }

    if (createdAssignment) {
      await cancelTeamAssessmentAssignment({
        supabase,
        assignmentId,
      });
    }

    throw error;
  }
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
