import "server-only";

import {
  getAssessmentLocaleFallbacks,
  getPreferredAssessmentLocaleRecord,
  normalizeAssessmentLocale,
  type AssessmentLocale,
} from "@/lib/assessment/locale";
import { TEAM_DYNAMICS_TEST_SLUG } from "@/lib/assessment/team-dynamics";
import type {
  TeamAssessmentAssignmentStatus,
  TeamAssessmentParticipantStatus,
} from "@/lib/assessment/team-assessments";
import type { AttemptStatus, QuestionType, TestStatus } from "@/lib/assessment/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamAssessmentExecutionRelation<T> = T | T[] | null;
const LOCALIZATION_QUERY_CHUNK_SIZE = 50;

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

export type TeamAssessmentRunHandoffState =
  | "ready_placeholder"
  | "warning_placeholder"
  | "safe_completed"
  | "safe_expired"
  | "safe_unavailable";

export type TeamAssessmentRunHandoffWarningCode = "unexpected_question_count";

export type TeamAssessmentQuestionOutlineEntry = {
  id: string;
  order: number;
  localizedTitle: string;
  localizedStem: string;
  locale: AssessmentLocale;
};

export type TeamAssessmentQuestionOutline = {
  orderedQuestionIds: string[];
  questions: TeamAssessmentQuestionOutlineEntry[];
  locale: AssessmentLocale;
  count: number;
};

export type TeamAssessmentBlockOutlineEntry = {
  id: string;
  order: number;
  title: string;
  questionCount: number;
  questionIds: string[];
};

export type TeamAssessmentUiOnlyItemOption = {
  id: string;
  label: string;
  order: number;
};

export type TeamAssessmentUiOnlyItem = {
  mode: "ui_only_ready";
  questionId: string;
  order: number;
  localizedTitle: string;
  localizedStem: string;
  optionIds: string[];
  options: TeamAssessmentUiOnlyItemOption[];
  locale: AssessmentLocale;
  isUiOnlySkeleton: true;
};

export type TeamAssessmentUiOnlySkeletonMode =
  | "ready"
  | "no_questions"
  | "no_options"
  | "unsupported_format";

export type TeamAssessmentRunHandoff = {
  teamAssessmentParticipantId: string;
  teamAssessmentAssignmentId: string;
  attemptId: string;
  packageSlug: string;
  wrapperStatus: TeamAssessmentParticipantStatus;
  attemptStatus: AttemptStatus;
  testSlug: string;
  testName: string;
  activeQuestionCount: number;
  questionOutlineCount: number;
  questionCountMatchesActive: boolean;
  questionOutline: TeamAssessmentQuestionOutline;
  blockOutlineCount: number;
  questionCountMatchesBlockOutline: boolean;
  blockOutline: TeamAssessmentBlockOutlineEntry[];
  uiOnlyItems: TeamAssessmentUiOnlyItem[];
  uiOnlyItemCount: number;
  uiOnlyUnsupportedCount: number;
  uiOnlySkeletonMode: TeamAssessmentUiOnlySkeletonMode;
  savedSelectedOptionIdsByQuestionId: Record<string, string>;
  savedAnswerQuestionIds: string[];
  savedAnswerCount: number;
  isRunnableShellState: boolean;
  handoffState: TeamAssessmentRunHandoffState;
  warningCode: TeamAssessmentRunHandoffWarningCode | null;
  statusLabel: string;
  placeholderTitle: string;
  placeholderMessage: string;
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

type TeamAssessmentQuestionRow = {
  id: string;
  text: string;
  question_order: number;
  question_type?: QuestionType | string;
};

type TeamAssessmentQuestionLocalizationRow = {
  question_id: string;
  locale: string;
  text: string;
};

type TeamAssessmentAnswerOptionRow = {
  id: string;
  question_id: string;
  label: string;
  option_order: number;
};

type TeamAssessmentAnswerOptionLocalizationRow = {
  answer_option_id: string;
  locale: string;
  label: string;
};

function chunkValues<T>(values: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
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

export function buildTeamAssessmentQuestionOutline(input: {
  questions: TeamAssessmentQuestionRow[];
  localizations?: TeamAssessmentQuestionLocalizationRow[];
  locale?: AssessmentLocale | null;
}): TeamAssessmentQuestionOutline {
  const locale = normalizeAssessmentLocale(input.locale);
  const localizedRowsByQuestionId = new Map<string, TeamAssessmentQuestionLocalizationRow[]>();

  for (const entry of input.localizations ?? []) {
    const rows = localizedRowsByQuestionId.get(entry.question_id) ?? [];
    rows.push(entry);
    localizedRowsByQuestionId.set(entry.question_id, rows);
  }

  const questions = [...input.questions]
    .sort((left, right) =>
      left.question_order === right.question_order
        ? left.id.localeCompare(right.id)
        : left.question_order - right.question_order,
    )
    .map((question) => {
      const localizedStem =
        getPreferredAssessmentLocaleRecord(
          localizedRowsByQuestionId.get(question.id) ?? [],
          locale,
        )?.text ?? question.text;

      return {
        id: question.id,
        order: question.question_order,
        localizedTitle: localizedStem,
        localizedStem,
        locale,
      };
    });

  return {
    orderedQuestionIds: questions.map((question) => question.id),
    questions,
    locale,
    count: questions.length,
  };
}

export function buildTeamAssessmentBlockOutline(input: {
  testName: string;
  questionOutline: TeamAssessmentQuestionOutline;
}): TeamAssessmentBlockOutlineEntry[] {
  return [
    {
      id: "default",
      order: 1,
      title: input.testName,
      questionCount: input.questionOutline.count,
      questionIds: [...input.questionOutline.orderedQuestionIds],
    },
  ];
}

export function buildTeamAssessmentUiOnlyItems(input: {
  questionOutline: TeamAssessmentQuestionOutline;
  locale?: AssessmentLocale | null;
  questions?: TeamAssessmentQuestionRow[];
  options?: TeamAssessmentAnswerOptionRow[];
  optionLocalizations?: TeamAssessmentAnswerOptionLocalizationRow[];
}): {
  items: TeamAssessmentUiOnlyItem[];
  itemCount: number;
  unsupportedCount: number;
  mode: TeamAssessmentUiOnlySkeletonMode;
} {
  const locale = normalizeAssessmentLocale(input.locale ?? input.questionOutline.locale);
  if (input.questionOutline.questions.length === 0) {
    return {
      items: [],
      itemCount: 0,
      unsupportedCount: 0,
      mode: "no_questions",
    };
  }

  const questionsById = new Map((input.questions ?? []).map((question) => [question.id, question]));
  const optionsByQuestionId = new Map<string, TeamAssessmentAnswerOptionRow[]>();
  const localizedRowsByOptionId = new Map<string, TeamAssessmentAnswerOptionLocalizationRow[]>();
  let sawMissingOptions = false;
  let sawUnsupportedFormat = false;

  for (const option of input.options ?? []) {
    const rows = optionsByQuestionId.get(option.question_id) ?? [];
    rows.push(option);
    optionsByQuestionId.set(option.question_id, rows);
  }

  for (const entry of input.optionLocalizations ?? []) {
    const rows = localizedRowsByOptionId.get(entry.answer_option_id) ?? [];
    rows.push(entry);
    localizedRowsByOptionId.set(entry.answer_option_id, rows);
  }

  const items: TeamAssessmentUiOnlyItem[] = [];

  for (const outlinedQuestion of input.questionOutline.questions) {
    const question = questionsById.get(outlinedQuestion.id) ?? null;
    const questionType = question?.question_type ?? "single_choice";

    if (questionType !== "single_choice") {
      sawUnsupportedFormat = true;
      continue;
    }

    const options = [...(optionsByQuestionId.get(outlinedQuestion.id) ?? [])].sort((left, right) =>
      left.option_order === right.option_order
        ? left.id.localeCompare(right.id)
        : left.option_order - right.option_order,
    );

    if (options.length === 0) {
      sawMissingOptions = true;
      continue;
    }

    const localizedOptions = options.map((option) => ({
      id: option.id,
      label:
        getPreferredAssessmentLocaleRecord(
          localizedRowsByOptionId.get(option.id) ?? [],
          locale,
        )?.label ?? option.label,
      order: option.option_order,
    }));

    items.push({
      mode: "ui_only_ready",
      questionId: outlinedQuestion.id,
      order: outlinedQuestion.order,
      localizedTitle: outlinedQuestion.localizedTitle,
      localizedStem: outlinedQuestion.localizedStem,
      optionIds: localizedOptions.map((option) => option.id),
      options: localizedOptions,
      locale,
      isUiOnlySkeleton: true,
    });
  }

  let mode: TeamAssessmentUiOnlySkeletonMode = "ready";

  if (items.length === 0) {
    if (sawMissingOptions) {
      mode = "no_options";
    } else if (sawUnsupportedFormat) {
      mode = "unsupported_format";
    } else {
      mode = "no_questions";
    }
  }

  return {
    items,
    itemCount: items.length,
    unsupportedCount: input.questionOutline.count - items.length,
    mode,
  };
}

export function buildTeamAssessmentRunHandoff(input: {
  context: TeamAssessmentExecutionContext;
  shellState: TeamAssessmentExecutionShellState;
  activeQuestionCount: number;
  questionOutline: TeamAssessmentQuestionOutline;
  blockOutline: TeamAssessmentBlockOutlineEntry[];
  uiOnlyItems: TeamAssessmentUiOnlyItem[];
  uiOnlyItemCount: number;
  uiOnlyUnsupportedCount: number;
  uiOnlySkeletonMode: TeamAssessmentUiOnlySkeletonMode;
  savedSelectedOptionIdsByQuestionId: Record<string, string>;
  savedAnswerQuestionIds: string[];
  savedAnswerCount: number;
}): TeamAssessmentRunHandoff {
  const questionCountMatchesActive = input.activeQuestionCount === input.questionOutline.count;
  const orderedQuestionIdsFromBlocks = input.blockOutline.flatMap((block) => block.questionIds);
  const questionCountMatchesBlockOutline =
    orderedQuestionIdsFromBlocks.length === input.questionOutline.count &&
    orderedQuestionIdsFromBlocks.every(
      (questionId, index) => questionId === input.questionOutline.orderedQuestionIds[index],
    );
  const isUnexpectedQuestionCount =
    input.activeQuestionCount !== 36 ||
    questionCountMatchesActive === false ||
    questionCountMatchesBlockOutline === false;
  let handoffState: TeamAssessmentRunHandoffState = "ready_placeholder";

  if (input.shellState.wrapperStatus === "completed") {
    handoffState = "safe_completed";
  } else if (input.shellState.wrapperStatus === "expired") {
    handoffState = "safe_expired";
  } else if (!input.shellState.isRunnable) {
    handoffState = "safe_unavailable";
  } else if (isUnexpectedQuestionCount) {
    handoffState = "warning_placeholder";
  }

  return {
    teamAssessmentParticipantId: input.context.teamAssessmentParticipantId,
    teamAssessmentAssignmentId: input.context.teamAssessmentAssignmentId,
    attemptId: input.context.attemptId,
    packageSlug: input.context.packageSlug,
    wrapperStatus: input.context.wrapperStatus,
    attemptStatus: input.context.attemptStatus,
    testSlug: input.context.test.slug,
    testName: input.context.test.name,
    activeQuestionCount: input.activeQuestionCount,
    questionOutlineCount: input.questionOutline.count,
    questionCountMatchesActive,
    questionOutline: input.questionOutline,
    blockOutlineCount: input.blockOutline.length,
    questionCountMatchesBlockOutline,
    blockOutline: input.blockOutline,
    uiOnlyItems: input.uiOnlyItems,
    uiOnlyItemCount: input.uiOnlyItemCount,
    uiOnlyUnsupportedCount: input.uiOnlyUnsupportedCount,
    uiOnlySkeletonMode: input.uiOnlySkeletonMode,
    savedSelectedOptionIdsByQuestionId: input.savedSelectedOptionIdsByQuestionId,
    savedAnswerQuestionIds: input.savedAnswerQuestionIds,
    savedAnswerCount: input.savedAnswerCount,
    isRunnableShellState: input.shellState.isRunnable,
    handoffState,
    warningCode: isUnexpectedQuestionCount ? "unexpected_question_count" : null,
    statusLabel: getTeamAssessmentExecutionStatusLabel(input.context.wrapperStatus),
    placeholderTitle: input.shellState.title,
    placeholderMessage: input.shellState.message,
  };
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

export async function loadTeamAssessmentQuestionOutline(input: {
  testId: string;
  locale?: AssessmentLocale | null;
}): Promise<TeamAssessmentQuestionOutline> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("questions")
    .select("id, text, question_order")
    .eq("test_id", input.testId)
    .eq("is_active", true)
    .order("question_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Failed to load Team Dynamics questions: ${error.message}`);
  }

  const questions = (data ?? []) as TeamAssessmentQuestionRow[];

  if (questions.length === 0) {
    return buildTeamAssessmentQuestionOutline({
      questions,
      locale: input.locale,
    });
  }

  const localeFallbacks = getAssessmentLocaleFallbacks(input.locale);
  const localizationChunks = await Promise.all(
    chunkValues(
      questions.map((question) => question.id),
      LOCALIZATION_QUERY_CHUNK_SIZE,
    ).map(async (questionIdsChunk) => {
      const { data: localizationData, error: localizationError } = await supabase
        .from("question_localizations")
        .select("question_id, locale, text")
        .in("locale", localeFallbacks)
        .in("question_id", questionIdsChunk);

      if (localizationError) {
        throw new Error(
          `Failed to load Team Dynamics question localizations: ${localizationError.message}`,
        );
      }

      return (localizationData ?? []) as TeamAssessmentQuestionLocalizationRow[];
    }),
  );

  return buildTeamAssessmentQuestionOutline({
    questions,
    localizations: localizationChunks.flat(),
    locale: input.locale,
  });
}

export async function loadTeamAssessmentUiOnlyItems(input: {
  testId: string;
  questionOutline: TeamAssessmentQuestionOutline;
  locale?: AssessmentLocale | null;
}): Promise<{
  items: TeamAssessmentUiOnlyItem[];
  itemCount: number;
  unsupportedCount: number;
  mode: TeamAssessmentUiOnlySkeletonMode;
}> {
  const locale = normalizeAssessmentLocale(input.locale ?? input.questionOutline.locale);
  const orderedQuestionIds = input.questionOutline.orderedQuestionIds;

  if (orderedQuestionIds.length === 0) {
    return buildTeamAssessmentUiOnlyItems({
      questionOutline: input.questionOutline,
      locale,
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data: questionData, error: questionError } = await supabase
    .from("questions")
    .select("id, text, question_order, question_type")
    .in("id", orderedQuestionIds)
    .eq("test_id", input.testId)
    .eq("is_active", true)
    .order("question_order", { ascending: true })
    .order("id", { ascending: true });

  if (questionError) {
    throw new Error(`Failed to load Team Dynamics UI-only questions: ${questionError.message}`);
  }

  const questions = (questionData ?? []) as TeamAssessmentQuestionRow[];

  if (questions.length === 0) {
    return buildTeamAssessmentUiOnlyItems({
      questionOutline: input.questionOutline,
      locale,
    });
  }

  const { data: optionData, error: optionError } = await supabase
    .from("answer_options")
    .select("id, question_id, label, option_order")
    .in("question_id", orderedQuestionIds)
    .order("option_order", { ascending: true })
    .order("id", { ascending: true });

  if (optionError) {
    throw new Error(`Failed to load Team Dynamics UI-only question options: ${optionError.message}`);
  }

  const options = (optionData ?? []) as TeamAssessmentAnswerOptionRow[];

  if (options.length === 0) {
    return buildTeamAssessmentUiOnlyItems({
      questionOutline: input.questionOutline,
      locale,
      options: [],
      questions,
    });
  }

  const localeFallbacks = getAssessmentLocaleFallbacks(locale);
  const localizationChunks = await Promise.all(
    chunkValues(
      options.map((option) => option.id),
      LOCALIZATION_QUERY_CHUNK_SIZE,
    ).map(async (optionIdsChunk) => {
      const { data: localizationData, error: localizationError } = await supabase
        .from("answer_option_localizations")
        .select("answer_option_id, locale, label")
        .in("locale", localeFallbacks)
        .in("answer_option_id", optionIdsChunk);

      if (localizationError) {
        throw new Error(
          `Failed to load Team Dynamics UI-only option localizations: ${localizationError.message}`,
        );
      }

      return (localizationData ?? []) as TeamAssessmentAnswerOptionLocalizationRow[];
    }),
  );

  return buildTeamAssessmentUiOnlyItems({
    questionOutline: input.questionOutline,
    locale,
    questions,
    options,
    optionLocalizations: localizationChunks.flat(),
  });
}

export async function loadTeamAssessmentRunHandoff(input: {
  context: TeamAssessmentExecutionContext;
  shellState: TeamAssessmentExecutionShellState;
}): Promise<TeamAssessmentRunHandoff> {
  if (
    input.context.test.slug !== TEAM_DYNAMICS_TEST_SLUG ||
    input.context.test.status !== "active" ||
    input.context.test.isActive !== true
  ) {
    throw new Error("Team Dynamics run handoff requires an active Team Dynamics test context.");
  }

  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("test_id", input.context.test.id)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to load Team Dynamics active question count: ${error.message}`);
  }

  const questionOutline = await loadTeamAssessmentQuestionOutline({
    testId: input.context.test.id,
    locale: input.context.locale,
  });
  const blockOutline = buildTeamAssessmentBlockOutline({
    testName: input.context.test.name,
    questionOutline,
  });
  const uiOnlySkeleton = await loadTeamAssessmentUiOnlyItems({
    testId: input.context.test.id,
    questionOutline,
    locale: input.context.locale,
  });
  const { loadTeamAssessmentSavedAnswerStateForContext } = await import(
    "@/lib/assessment/team-assessment-responses"
  );
  const savedAnswerState = await loadTeamAssessmentSavedAnswerStateForContext({
    context: input.context,
    shellState: input.shellState,
    uiOnlyItems: uiOnlySkeleton.items,
  });

  return buildTeamAssessmentRunHandoff({
    context: input.context,
    shellState: input.shellState,
    activeQuestionCount: count ?? 0,
    questionOutline,
    blockOutline,
    uiOnlyItems: uiOnlySkeleton.items,
    uiOnlyItemCount: uiOnlySkeleton.itemCount,
    uiOnlyUnsupportedCount: uiOnlySkeleton.unsupportedCount,
    uiOnlySkeletonMode: uiOnlySkeleton.mode,
    savedSelectedOptionIdsByQuestionId: savedAnswerState.selectedOptionIdsByQuestionId,
    savedAnswerQuestionIds: savedAnswerState.loadedQuestionIds,
    savedAnswerCount: savedAnswerState.loadedCount,
  });
}
