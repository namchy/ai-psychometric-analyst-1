import "server-only";

import type { AssessmentLocale } from "@/lib/assessment/locale";
import { TEAM_DYNAMICS_TEST_SLUG } from "@/lib/assessment/team-dynamics";
import type {
  TeamAssessmentAssignmentStatus,
  TeamAssessmentParticipantStatus,
} from "@/lib/assessment/team-assessments";
import type { AttemptStatus, TestStatus } from "@/lib/assessment/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamAssessmentExecutionRelation<T> = T | T[] | null;

export type TeamAssessmentExecutionParticipantRecord = {
  id: string;
  user_id: string | null;
  organization_id: string;
  status: string;
};

export type TeamAssessmentExecutionMembershipRecord = {
  id: string;
  team_id: string;
  participant_id: string;
  is_active: boolean;
  left_at: string | null;
};

export type TeamAssessmentExecutionAssignmentRecord = {
  id: string;
  team_id: string;
  package_slug: string;
  status: TeamAssessmentAssignmentStatus;
};

export type TeamAssessmentExecutionWrapperRecord = {
  id: string;
  team_assessment_assignment_id: string;
  team_membership_id: string;
  participant_id: string;
  attempt_id: string | null;
  status: TeamAssessmentParticipantStatus;
  started_at?: string | null;
};

export type TeamAssessmentExecutionTeamRecord = {
  id: string;
  organization_id: string;
  archived_at: string | null;
};

export type TeamAssessmentExecutionTestRecord = {
  id: string;
  slug: string;
  name: string;
  status: TestStatus;
  is_active: boolean;
};

export type TeamAssessmentExecutionAttemptRecord = {
  id: string;
  test_id: string;
  organization_id: string | null;
  participant_id: string | null;
  locale: AssessmentLocale;
  status: AttemptStatus;
  tests: TeamAssessmentExecutionRelation<TeamAssessmentExecutionTestRecord>;
};

export type TeamAssessmentExecutionContext = {
  teamAssessmentParticipantId: string;
  teamAssessmentAssignmentId: string;
  teamMembershipId: string;
  participantId: string;
  attemptId: string;
  teamId: string;
  organizationId: string;
  packageSlug: string;
  wrapperStatus: TeamAssessmentParticipantStatus;
  attemptStatus: AttemptStatus;
  locale: AssessmentLocale;
  test: {
    id: string;
    slug: string;
    name: string;
    status: TestStatus;
    isActive: boolean;
  };
};

export const TEAM_ASSESSMENT_EXECUTION_CONTEXT_FAILURE_CODES = [
  "wrapper_not_found",
  "wrapper_missing_attempt",
  "wrapper_access_denied",
  "membership_inactive",
  "assignment_not_found",
  "assignment_inactive",
  "assignment_wrong_package",
  "team_not_found",
  "organization_unresolved",
  "attempt_not_found",
  "attempt_participant_mismatch",
  "attempt_organization_mismatch",
  "attempt_wrong_test",
  "test_inactive",
] as const;

export type TeamAssessmentExecutionContextFailureCode =
  (typeof TEAM_ASSESSMENT_EXECUTION_CONTEXT_FAILURE_CODES)[number];

export type TeamAssessmentExecutionContextResult =
  | {
      ok: true;
      context: TeamAssessmentExecutionContext;
    }
  | {
      ok: false;
      code: TeamAssessmentExecutionContextFailureCode;
      message: string;
    };

export type TeamAssessmentExecutionStartTransitionResult = {
  status: TeamAssessmentParticipantStatus;
  startedAt: string | null;
  transitioned: boolean;
};

export type TeamAssessmentExecutionShellRoute = "intro" | "run";

export type TeamAssessmentExecutionShellState =
  | {
      kind: "intro_invited";
      route: "intro";
      wrapperStatus: "invited";
      isRunnable: true;
      shouldTransitionToStarted: false;
      title: string;
      message: string;
    }
  | {
      kind: "intro_started";
      route: "intro";
      wrapperStatus: "started";
      isRunnable: true;
      shouldTransitionToStarted: false;
      title: string;
      message: string;
    }
  | {
      kind: "intro_completed";
      route: "intro";
      wrapperStatus: "completed";
      isRunnable: false;
      shouldTransitionToStarted: false;
      title: string;
      message: string;
    }
  | {
      kind: "intro_expired";
      route: "intro";
      wrapperStatus: "expired";
      isRunnable: false;
      shouldTransitionToStarted: false;
      title: string;
      message: string;
    }
  | {
      kind: "run_invited";
      route: "run";
      wrapperStatus: "invited";
      isRunnable: true;
      shouldTransitionToStarted: true;
      title: string;
      message: string;
    }
  | {
      kind: "run_started";
      route: "run";
      wrapperStatus: "started";
      isRunnable: true;
      shouldTransitionToStarted: false;
      title: string;
      message: string;
    }
  | {
      kind: "run_completed";
      route: "run";
      wrapperStatus: "completed";
      isRunnable: false;
      shouldTransitionToStarted: false;
      title: string;
      message: string;
    }
  | {
      kind: "run_expired";
      route: "run";
      wrapperStatus: "expired";
      isRunnable: false;
      shouldTransitionToStarted: false;
      title: string;
      message: string;
    }
  | {
      kind: "unavailable";
      route: TeamAssessmentExecutionShellRoute;
      wrapperStatus: string;
      isRunnable: false;
      shouldTransitionToStarted: false;
      title: string;
      message: string;
    };

function normalizeRelation<T>(value: TeamAssessmentExecutionRelation<T>): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function fail(
  code: TeamAssessmentExecutionContextFailureCode,
  message: string,
): TeamAssessmentExecutionContextResult {
  return {
    ok: false,
    code,
    message,
  };
}

export function buildTeamAssessmentExecutionStartedPatch(input: {
  wrapperStatus: TeamAssessmentParticipantStatus;
  startedAt: string | null | undefined;
  transitionAt: string;
}): Pick<TeamAssessmentExecutionWrapperRecord, "status" | "started_at"> | null {
  if (input.wrapperStatus !== "invited") {
    return null;
  }

  return {
    status: "started",
    started_at: input.startedAt ?? input.transitionAt,
  };
}

export function getTeamAssessmentExecutionStatusLabel(status: string): string {
  switch (status) {
    case "started":
      return "Započeto";
    case "completed":
      return "Završeno";
    case "expired":
      return "Isteklo";
    case "invited":
      return "Pozvano";
    default:
      return "Nedostupno";
  }
}

export function resolveTeamAssessmentExecutionShellState(input: {
  route: TeamAssessmentExecutionShellRoute;
  wrapperStatus: string;
}): TeamAssessmentExecutionShellState {
  if (input.route === "intro") {
    switch (input.wrapperStatus) {
      case "invited":
        return {
          kind: "intro_invited",
          route: "intro",
          wrapperStatus: "invited",
          isRunnable: true,
          shouldTransitionToStarted: false,
          title: "Rješavanje još nije omogućeno u ovoj verziji.",
          message: "Uskoro ćeš ovdje moći započeti procjenu timske dinamike.",
        };
      case "started":
        return {
          kind: "intro_started",
          route: "intro",
          wrapperStatus: "started",
          isRunnable: true,
          shouldTransitionToStarted: false,
          title: "Nastavak procjene još nije omogućen u ovoj verziji.",
          message: "Ova procjena je već otvorena kroz execution prostor, ali pitanja još nisu omogućena.",
        };
      case "completed":
        return {
          kind: "intro_completed",
          route: "intro",
          wrapperStatus: "completed",
          isRunnable: false,
          shouldTransitionToStarted: false,
          title: "Ova procjena je već završena.",
          message: "Ovdje će kasnije biti dostupan siguran pregled narednih koraka za timsku procjenu.",
        };
      case "expired":
        return {
          kind: "intro_expired",
          route: "intro",
          wrapperStatus: "expired",
          isRunnable: false,
          shouldTransitionToStarted: false,
          title: "Ova procjena više nije dostupna.",
          message: "Vrijeme ili dostupnost za ovu timsku procjenu je istekla u ovoj verziji.",
        };
      default:
        return {
          kind: "unavailable",
          route: "intro",
          wrapperStatus: input.wrapperStatus,
          isRunnable: false,
          shouldTransitionToStarted: false,
          title: "Ova procjena trenutno nije dostupna.",
          message: "Status wrappera nije podržan za siguran pristup ovoj timskoj procjeni.",
        };
    }
  }

  switch (input.wrapperStatus) {
    case "invited":
      return {
        kind: "run_invited",
        route: "run",
        wrapperStatus: "invited",
        isRunnable: true,
        shouldTransitionToStarted: true,
        title: "Rješavanje procjene još nije omogućeno u ovoj verziji.",
        message:
          "Ulaz u ovaj prostor označava početak execution konteksta, ali pitanja i rješavanje još nisu omogućeni u ovoj verziji.",
      };
    case "started":
      return {
        kind: "run_started",
        route: "run",
        wrapperStatus: "started",
        isRunnable: true,
        shouldTransitionToStarted: false,
        title: "Rješavanje procjene još nije omogućeno u ovoj verziji.",
        message:
          "Execution prostor je otvoren, ali pitanja i rješavanje još nisu omogućeni u ovoj verziji.",
      };
    case "completed":
      return {
        kind: "run_completed",
        route: "run",
        wrapperStatus: "completed",
        isRunnable: false,
        shouldTransitionToStarted: false,
        title: "Ova procjena je već završena.",
        message: "Ovdje će kasnije biti dostupan siguran pregled narednih koraka za timsku procjenu.",
      };
    case "expired":
      return {
        kind: "run_expired",
        route: "run",
        wrapperStatus: "expired",
        isRunnable: false,
        shouldTransitionToStarted: false,
        title: "Ova procjena više nije dostupna.",
        message: "Execution prostor za ovu timsku procjenu je istekao u ovoj verziji.",
      };
    default:
      return {
        kind: "unavailable",
        route: "run",
        wrapperStatus: input.wrapperStatus,
        isRunnable: false,
        shouldTransitionToStarted: false,
        title: "Ova procjena trenutno nije dostupna.",
        message: "Status wrappera nije podržan za siguran pristup execution prostoru.",
      };
  }
}

export function buildTeamAssessmentExecutionContext(input: {
  teamAssessmentParticipantId: string;
  userId: string;
  wrapper: TeamAssessmentExecutionWrapperRecord | null;
  participant: TeamAssessmentExecutionParticipantRecord | null;
  membership: TeamAssessmentExecutionMembershipRecord | null;
  assignment: TeamAssessmentExecutionAssignmentRecord | null;
  team: TeamAssessmentExecutionTeamRecord | null;
  attempt: TeamAssessmentExecutionAttemptRecord | null;
}): TeamAssessmentExecutionContextResult {
  const wrapper = input.wrapper;

  if (!wrapper || wrapper.id !== input.teamAssessmentParticipantId) {
    return fail("wrapper_not_found", "Team assessment participant wrapper was not found.");
  }

  if (!wrapper.attempt_id) {
    return fail("wrapper_missing_attempt", "Team assessment participant wrapper is missing an attempt.");
  }

  const participant = input.participant;

  if (
    !participant ||
    participant.id !== wrapper.participant_id ||
    participant.user_id !== input.userId
  ) {
    return fail("wrapper_access_denied", "Team assessment participant wrapper is not owned by this user.");
  }

  const membership = input.membership;

  if (
    !membership ||
    membership.id !== wrapper.team_membership_id ||
    membership.participant_id !== wrapper.participant_id ||
    !membership.is_active ||
    membership.left_at
  ) {
    return fail("membership_inactive", "Team membership is not active for this Team Dynamics wrapper.");
  }

  const assignment = input.assignment;

  if (
    !assignment ||
    assignment.id !== wrapper.team_assessment_assignment_id ||
    assignment.team_id !== membership.team_id
  ) {
    return fail("assignment_not_found", "Team assessment assignment was not found for this wrapper.");
  }

  if (assignment.status !== "active") {
    return fail("assignment_inactive", "Team assessment assignment is not active.");
  }

  if (assignment.package_slug !== TEAM_DYNAMICS_TEST_SLUG) {
    return fail("assignment_wrong_package", "Team assessment assignment is not a Team Dynamics package.");
  }

  const team = input.team;

  if (!team || team.id !== assignment.team_id || team.archived_at) {
    return fail("team_not_found", "Team was not found for this Team Dynamics wrapper.");
  }

  if (!team.organization_id) {
    return fail("organization_unresolved", "Organization scope could not be resolved from the team.");
  }

  const attempt = input.attempt;

  if (!attempt || attempt.id !== wrapper.attempt_id) {
    return fail("attempt_not_found", "Linked Team Dynamics attempt was not found.");
  }

  if (attempt.participant_id !== wrapper.participant_id) {
    return fail("attempt_participant_mismatch", "Linked attempt does not belong to the wrapper participant.");
  }

  if (attempt.organization_id !== team.organization_id) {
    return fail(
      "attempt_organization_mismatch",
      "Linked attempt does not belong to the same organization as the team.",
    );
  }

  const test = normalizeRelation(attempt.tests);

  if (!test || test.id !== attempt.test_id || test.slug !== TEAM_DYNAMICS_TEST_SLUG) {
    return fail("attempt_wrong_test", "Linked attempt is not a Team Dynamics attempt.");
  }

  if (test.status !== "active" || test.is_active !== true) {
    return fail("test_inactive", "Linked Team Dynamics test is not active.");
  }

  return {
    ok: true,
    context: {
      teamAssessmentParticipantId: wrapper.id,
      teamAssessmentAssignmentId: wrapper.team_assessment_assignment_id,
      teamMembershipId: wrapper.team_membership_id,
      participantId: wrapper.participant_id,
      attemptId: wrapper.attempt_id,
      teamId: team.id,
      organizationId: team.organization_id,
      packageSlug: assignment.package_slug,
      wrapperStatus: wrapper.status,
      attemptStatus: attempt.status,
      locale: attempt.locale,
      test: {
        id: test.id,
        slug: test.slug,
        name: test.name,
        status: test.status,
        isActive: test.is_active,
      },
    },
  };
}

export async function loadTeamAssessmentExecutionContext(input: {
  teamAssessmentParticipantId: string;
  userId: string;
}): Promise<TeamAssessmentExecutionContextResult> {
  const supabase = createSupabaseAdminClient();
  const { data: wrapperData, error: wrapperError } = await supabase
    .from("team_assessment_participants")
    .select("id, team_assessment_assignment_id, team_membership_id, participant_id, attempt_id, status, started_at")
    .eq("id", input.teamAssessmentParticipantId)
    .maybeSingle();

  if (wrapperError) {
    throw new Error(
      `Failed to load Team Dynamics execution wrapper ${input.teamAssessmentParticipantId}: ${wrapperError.message}`,
    );
  }

  const wrapper = (wrapperData as TeamAssessmentExecutionWrapperRecord | null) ?? null;

  if (!wrapper) {
    return buildTeamAssessmentExecutionContext({
      teamAssessmentParticipantId: input.teamAssessmentParticipantId,
      userId: input.userId,
      wrapper: null,
      participant: null,
      membership: null,
      assignment: null,
      team: null,
      attempt: null,
    });
  }

  const [
    { data: participantData, error: participantError },
    { data: membershipData, error: membershipError },
    { data: assignmentData, error: assignmentError },
    { data: attemptData, error: attemptError },
  ] = await Promise.all([
    supabase
      .from("participants")
      .select("id, user_id, organization_id, status")
      .eq("id", wrapper.participant_id)
      .maybeSingle(),
    supabase
      .from("team_memberships")
      .select("id, team_id, participant_id, is_active, left_at")
      .eq("id", wrapper.team_membership_id)
      .maybeSingle(),
    supabase
      .from("team_assessment_assignments")
      .select("id, team_id, package_slug, status")
      .eq("id", wrapper.team_assessment_assignment_id)
      .maybeSingle(),
    wrapper.attempt_id
      ? supabase
          .from("attempts")
          .select("id, test_id, organization_id, participant_id, locale, status, tests(id, slug, name, status, is_active)")
          .eq("id", wrapper.attempt_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (participantError) {
    throw new Error(`Failed to load Team Dynamics participant ownership: ${participantError.message}`);
  }

  if (membershipError) {
    throw new Error(`Failed to load Team Dynamics membership context: ${membershipError.message}`);
  }

  if (assignmentError) {
    throw new Error(`Failed to load Team Dynamics assignment context: ${assignmentError.message}`);
  }

  if (attemptError) {
    throw new Error(`Failed to load Team Dynamics linked attempt: ${attemptError.message}`);
  }

  const assignment = (assignmentData as TeamAssessmentExecutionAssignmentRecord | null) ?? null;
  let team: TeamAssessmentExecutionTeamRecord | null = null;

  if (assignment?.team_id) {
    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("id, organization_id, archived_at")
      .eq("id", assignment.team_id)
      .maybeSingle();

    if (teamError) {
      throw new Error(`Failed to load Team Dynamics team scope: ${teamError.message}`);
    }

    team = (teamData as TeamAssessmentExecutionTeamRecord | null) ?? null;
  }

  return buildTeamAssessmentExecutionContext({
    teamAssessmentParticipantId: input.teamAssessmentParticipantId,
    userId: input.userId,
    wrapper,
    participant: (participantData as TeamAssessmentExecutionParticipantRecord | null) ?? null,
    membership: (membershipData as TeamAssessmentExecutionMembershipRecord | null) ?? null,
    assignment,
    team,
    attempt: (attemptData as TeamAssessmentExecutionAttemptRecord | null) ?? null,
  });
}

export async function markTeamAssessmentExecutionStartedIfInvited(input: {
  teamAssessmentParticipantId: string;
  transitionAt?: string;
}): Promise<TeamAssessmentExecutionStartTransitionResult> {
  const supabase = createSupabaseAdminClient();
  const { data: existingData, error: existingError } = await supabase
    .from("team_assessment_participants")
    .select("id, status, started_at")
    .eq("id", input.teamAssessmentParticipantId)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `Failed to load Team Dynamics execution transition wrapper ${input.teamAssessmentParticipantId}: ${existingError.message}`,
    );
  }

  const existing = (existingData as {
    id: string;
    status: TeamAssessmentParticipantStatus;
    started_at: string | null;
  } | null) ?? null;

  if (!existing) {
    throw new Error(
      `Team Dynamics execution transition wrapper ${input.teamAssessmentParticipantId} was not found.`,
    );
  }

  const patch = buildTeamAssessmentExecutionStartedPatch({
    wrapperStatus: existing.status,
    startedAt: existing.started_at,
    transitionAt: input.transitionAt ?? new Date().toISOString(),
  });

  if (!patch) {
    return {
      status: existing.status,
      startedAt: existing.started_at,
      transitioned: false,
    };
  }

  const { data: updatedData, error: updateError } = await supabase
    .from("team_assessment_participants")
    .update(patch)
    .eq("id", input.teamAssessmentParticipantId)
    .eq("status", "invited")
    .select("status, started_at")
    .maybeSingle();

  if (updateError) {
    throw new Error(
      `Failed to mark Team Dynamics execution wrapper ${input.teamAssessmentParticipantId} as started: ${updateError.message}`,
    );
  }

  if (updatedData) {
    return {
      status: updatedData.status as TeamAssessmentParticipantStatus,
      startedAt: updatedData.started_at ?? null,
      transitioned: true,
    };
  }

  const { data: currentData, error: currentError } = await supabase
    .from("team_assessment_participants")
    .select("status, started_at")
    .eq("id", input.teamAssessmentParticipantId)
    .maybeSingle();

  if (currentError) {
    throw new Error(
      `Failed to reload Team Dynamics execution wrapper ${input.teamAssessmentParticipantId}: ${currentError.message}`,
    );
  }

  return {
    status: (currentData?.status as TeamAssessmentParticipantStatus | undefined) ?? "started",
    startedAt: currentData?.started_at ?? patch.started_at ?? null,
    transitioned: currentData?.status === "started",
  };
}
