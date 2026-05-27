import "server-only";

import {
  isAssessmentLocaleAlias,
  normalizeAssessmentLocale,
  type AssessmentLocale,
} from "@/lib/assessment/locale";
import {
  loadTeamAssessmentExecutionContext,
  resolveTeamAssessmentExecutionShellState,
  type TeamAssessmentExecutionContextResult,
} from "@/lib/assessment/team-assessment-execution";
import {
  buildTeamDynamicsMixedRuntimeHandoff,
  loadTeamDynamicsMixedRuntimeDbSnapshot,
  type TeamDynamicsMixedRuntimeDbSnapshot,
  type TeamDynamicsMixedRuntimeHandoff,
  type TeamDynamicsMixedRuntimeHandoffBlockType,
  type TeamDynamicsMixedRuntimeHandoffItem,
} from "@/lib/assessment/team-dynamics-mixed-runtime";
import { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG } from "@/lib/assessment/team-dynamics";

export type TeamDynamicsMixedLikertAnswerPayload = {
  teamAssessmentParticipantId: string;
  questionId: string;
  responseFormat: "single_select_likert";
  optionId: string;
  locale?: string;
  clientTimestamp?: string;
};

export type TeamDynamicsMixedSjtAnswerPayload = {
  teamAssessmentParticipantId: string;
  questionId: string;
  responseFormat: "best_worst";
  bestOptionId: string;
  worstOptionId: string;
  locale?: string;
  clientTimestamp?: string;
};

export type TeamDynamicsMixedAnswerPayload =
  | TeamDynamicsMixedLikertAnswerPayload
  | TeamDynamicsMixedSjtAnswerPayload;

type TeamDynamicsMixedValidatedAnswerPayloadBase = {
  teamAssessmentParticipantId: string;
  attemptId: string;
  questionId: string;
  responseFormat: "single_select_likert" | "best_worst";
  locale: AssessmentLocale;
  clientTimestamp?: string;
  uniquenessKey: {
    teamAssessmentParticipantId: string;
    questionId: string;
  };
  testSlug: typeof TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG;
  blockKey: string;
  itemKind: TeamDynamicsMixedRuntimeHandoffBlockType;
};

export type ValidatedTeamDynamicsMixedLikertAnswerPayload =
  TeamDynamicsMixedValidatedAnswerPayloadBase & {
    responseFormat: "single_select_likert";
    optionId: string;
  };

export type ValidatedTeamDynamicsMixedSjtAnswerPayload =
  TeamDynamicsMixedValidatedAnswerPayloadBase & {
    responseFormat: "best_worst";
    bestOptionId: string;
    worstOptionId: string;
  };

export type ValidatedTeamDynamicsMixedAnswerPayload =
  | ValidatedTeamDynamicsMixedLikertAnswerPayload
  | ValidatedTeamDynamicsMixedSjtAnswerPayload;

export type TeamDynamicsMixedAnswerPayloadValidationStatus =
  | "validated_only"
  | "invalid"
  | "not_runnable"
  | "unsupported";

export type TeamDynamicsMixedAnswerPayloadValidationResult =
  | {
      ok: true;
      status: "validated_only";
      value: ValidatedTeamDynamicsMixedAnswerPayload;
    }
  | {
      ok: false;
      status: "invalid" | "not_runnable" | "unsupported";
      reason: string;
      teamAssessmentParticipantId: string | null;
      questionId: string | null;
      responseFormat: string | null;
      testSlug: string | null;
    };

type TeamDynamicsMixedAnswerPayloadValidationDependencies = {
  loadExecutionContext?: typeof loadTeamAssessmentExecutionContext;
  loadMixedRuntimeDbSnapshot?: typeof loadTeamDynamicsMixedRuntimeDbSnapshot;
  buildMixedRuntimeHandoff?: typeof buildTeamDynamicsMixedRuntimeHandoff;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function fail(
  status: Exclude<TeamDynamicsMixedAnswerPayloadValidationStatus, "validated_only">,
  reason: string,
  payload: Partial<TeamDynamicsMixedAnswerPayload>,
  testSlug: string | null = null,
): TeamDynamicsMixedAnswerPayloadValidationResult {
  return {
    ok: false,
    status,
    reason,
    teamAssessmentParticipantId: isNonEmptyString(payload.teamAssessmentParticipantId)
      ? payload.teamAssessmentParticipantId
      : null,
    questionId: isNonEmptyString(payload.questionId) ? payload.questionId : null,
    responseFormat:
      typeof payload.responseFormat === "string" ? payload.responseFormat : null,
    testSlug,
  };
}

function getItemKind(input: {
  handoff: TeamDynamicsMixedRuntimeHandoff;
  item: TeamDynamicsMixedRuntimeHandoffItem;
}): TeamDynamicsMixedRuntimeHandoffBlockType {
  return (
    input.handoff.blocks.find((block) => block.blockKey === input.item.blockKey)?.blockType ??
    "unsupported"
  );
}

function buildValidatedValue(input: {
  payload: TeamDynamicsMixedAnswerPayload;
  attemptId: string;
  item: TeamDynamicsMixedRuntimeHandoffItem;
  itemKind: TeamDynamicsMixedRuntimeHandoffBlockType;
  locale: AssessmentLocale;
}): TeamDynamicsMixedAnswerPayloadValidationResult {
  const base = {
    teamAssessmentParticipantId: input.payload.teamAssessmentParticipantId,
    attemptId: input.attemptId,
    questionId: input.payload.questionId,
    responseFormat: input.payload.responseFormat,
    locale: input.locale,
    ...(isNonEmptyString(input.payload.clientTimestamp)
      ? { clientTimestamp: input.payload.clientTimestamp }
      : {}),
    uniquenessKey: {
      teamAssessmentParticipantId: input.payload.teamAssessmentParticipantId,
      questionId: input.payload.questionId,
    },
    testSlug: TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
    blockKey: input.item.blockKey,
    itemKind: input.itemKind,
  } as const;

  if (input.payload.responseFormat === "single_select_likert") {
    return {
      ok: true,
      status: "validated_only",
      value: {
        ...base,
        responseFormat: "single_select_likert",
        optionId: input.payload.optionId,
      },
    };
  }

  return {
    ok: true,
    status: "validated_only",
    value: {
      ...base,
      responseFormat: "best_worst",
      bestOptionId: input.payload.bestOptionId,
      worstOptionId: input.payload.worstOptionId,
    },
  };
}

export function buildTeamDynamicsMixedAnswerPayloadValidationResult(input: {
  payload: TeamDynamicsMixedAnswerPayload;
  contextResult: TeamAssessmentExecutionContextResult;
  runtimeSnapshot: TeamDynamicsMixedRuntimeDbSnapshot | null;
  mixedRuntimeHandoff: TeamDynamicsMixedRuntimeHandoff | null;
}): TeamDynamicsMixedAnswerPayloadValidationResult {
  if (!isNonEmptyString(input.payload.teamAssessmentParticipantId)) {
    return fail("invalid", "teamAssessmentParticipantId is required.", input.payload);
  }

  if (!isNonEmptyString(input.payload.questionId)) {
    return fail("invalid", "questionId is required.", input.payload);
  }

  if (
    input.payload.responseFormat !== "single_select_likert" &&
    input.payload.responseFormat !== "best_worst"
  ) {
    return fail(
      "invalid",
      'responseFormat must be "single_select_likert" or "best_worst".',
      input.payload,
    );
  }

  if (
    typeof input.payload.locale !== "undefined" &&
    !isAssessmentLocaleAlias(input.payload.locale)
  ) {
    return fail(
      "invalid",
      "locale must be a supported AssessmentLocale value when provided.",
      input.payload,
    );
  }

  if (
    typeof input.payload.clientTimestamp !== "undefined" &&
    !isNonEmptyString(input.payload.clientTimestamp)
  ) {
    return fail("invalid", "clientTimestamp must be a non-empty string when provided.", input.payload);
  }

  if (input.payload.responseFormat === "single_select_likert") {
    if (!isNonEmptyString(input.payload.optionId)) {
      return fail("invalid", "optionId is required for single_select_likert items.", input.payload);
    }

    if ("bestOptionId" in input.payload || "worstOptionId" in input.payload) {
      return fail(
        "invalid",
        "single_select_likert payload must not include bestOptionId or worstOptionId.",
        input.payload,
      );
    }
  }

  if (input.payload.responseFormat === "best_worst") {
    if (!isNonEmptyString(input.payload.bestOptionId)) {
      return fail("invalid", "bestOptionId is required for best_worst items.", input.payload);
    }

    if (!isNonEmptyString(input.payload.worstOptionId)) {
      return fail("invalid", "worstOptionId is required for best_worst items.", input.payload);
    }

    if (input.payload.bestOptionId === input.payload.worstOptionId) {
      return fail(
        "invalid",
        "bestOptionId and worstOptionId must be different for best_worst items.",
        input.payload,
      );
    }

    if ("optionId" in input.payload) {
      return fail(
        "invalid",
        "best_worst payload must not include optionId.",
        input.payload,
      );
    }
  }

  if (!input.contextResult.ok) {
    return fail("invalid", input.contextResult.message, input.payload);
  }

  const shellState = resolveTeamAssessmentExecutionShellState({
    route: "run",
    wrapperStatus: input.contextResult.context.wrapperStatus,
  });

  if (!shellState.isRunnable || input.contextResult.context.attemptStatus !== "in_progress") {
    return fail(
      "not_runnable",
      "Team Dynamics wrapper is not in a runnable response-validation state.",
      input.payload,
      input.contextResult.context.test.slug,
    );
  }

  if (
    input.contextResult.context.packageSlug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG ||
    input.contextResult.context.test.slug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG
  ) {
    return fail(
      "unsupported",
      `This validator only supports ${TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG}.`,
      input.payload,
      input.contextResult.context.test.slug,
    );
  }

  if (!input.runtimeSnapshot || !input.mixedRuntimeHandoff) {
    return fail(
      "unsupported",
      "Final Team Dynamics mixed-format runtime is not available.",
      input.payload,
      input.contextResult.context.test.slug,
    );
  }

  if (
    input.runtimeSnapshot.testRow.id !== input.contextResult.context.test.id ||
    input.runtimeSnapshot.testRow.slug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG ||
    input.mixedRuntimeHandoff.testSlug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG
  ) {
    return fail(
      "unsupported",
      "Wrapper-linked attempt is not attached to the final Team Dynamics assessment runtime.",
      input.payload,
      input.contextResult.context.test.slug,
    );
  }

  if (
    input.runtimeSnapshot.testRow.scoring_method !== "mixed_v1" ||
    input.mixedRuntimeHandoff.scoringMethod !== "mixed_v1"
  ) {
    return fail(
      "unsupported",
      'Final Team Dynamics runtime must use scoring_method "mixed_v1".',
      input.payload,
      input.contextResult.context.test.slug,
    );
  }

  const item =
    input.mixedRuntimeHandoff.items.find(
      (candidate) => candidate.questionId === input.payload.questionId,
    ) ?? null;

  if (!item) {
    return fail(
      "invalid",
      "Provided questionId was not found in the final Team Dynamics mixed runtime handoff.",
      input.payload,
      input.mixedRuntimeHandoff.testSlug,
    );
  }

  if (
    item.responseFormat !== "single_select_likert" &&
    item.responseFormat !== "best_worst"
  ) {
    return fail(
      "unsupported",
      "Runtime item response_format is not supported by this validator.",
      input.payload,
      input.mixedRuntimeHandoff.testSlug,
    );
  }

  if (item.responseFormat !== input.payload.responseFormat) {
    return fail(
      "invalid",
      "payload responseFormat does not match the runtime item response_format.",
      input.payload,
      input.mixedRuntimeHandoff.testSlug,
    );
  }

  const itemKind = getItemKind({
    handoff: input.mixedRuntimeHandoff,
    item,
  });

  if (itemKind === "unsupported") {
    return fail(
      "unsupported",
      "Runtime item belongs to an unsupported Team Dynamics block type.",
      input.payload,
      input.mixedRuntimeHandoff.testSlug,
    );
  }

  const validOptionIds = new Set(item.options.map((option) => option.optionId));

  if (input.payload.responseFormat === "single_select_likert") {
    if (!validOptionIds.has(input.payload.optionId)) {
      return fail(
        "invalid",
        "Provided optionId does not belong to the provided questionId.",
        input.payload,
        input.mixedRuntimeHandoff.testSlug,
      );
    }
  }

  if (input.payload.responseFormat === "best_worst") {
    if (!validOptionIds.has(input.payload.bestOptionId)) {
      return fail(
        "invalid",
        "Provided bestOptionId does not belong to the provided questionId.",
        input.payload,
        input.mixedRuntimeHandoff.testSlug,
      );
    }

    if (!validOptionIds.has(input.payload.worstOptionId)) {
      return fail(
        "invalid",
        "Provided worstOptionId does not belong to the provided questionId.",
        input.payload,
        input.mixedRuntimeHandoff.testSlug,
      );
    }
  }

  return buildValidatedValue({
    payload: input.payload,
    attemptId: input.contextResult.context.attemptId,
    item,
    itemKind,
    locale: normalizeAssessmentLocale(
      input.payload.locale ?? input.contextResult.context.locale,
    ),
  });
}

export async function validateTeamDynamicsMixedAnswerPayload(
  input: {
    userId: string;
    payload: TeamDynamicsMixedAnswerPayload;
  },
  deps: TeamDynamicsMixedAnswerPayloadValidationDependencies = {},
): Promise<TeamDynamicsMixedAnswerPayloadValidationResult> {
  if (!isNonEmptyString(input.payload.teamAssessmentParticipantId)) {
    return fail("invalid", "teamAssessmentParticipantId is required.", input.payload);
  }

  const loadExecutionContext =
    deps.loadExecutionContext ?? loadTeamAssessmentExecutionContext;
  const loadMixedRuntimeDbSnapshot =
    deps.loadMixedRuntimeDbSnapshot ?? loadTeamDynamicsMixedRuntimeDbSnapshot;
  const buildMixedRuntimeHandoff =
    deps.buildMixedRuntimeHandoff ?? buildTeamDynamicsMixedRuntimeHandoff;
  const contextResult = await loadExecutionContext({
    teamAssessmentParticipantId: input.payload.teamAssessmentParticipantId,
    userId: input.userId,
  });

  if (!contextResult.ok) {
    return buildTeamDynamicsMixedAnswerPayloadValidationResult({
      payload: input.payload,
      contextResult,
      runtimeSnapshot: null,
      mixedRuntimeHandoff: null,
    });
  }

  if (
    contextResult.context.packageSlug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG ||
    contextResult.context.test.slug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG
  ) {
    return buildTeamDynamicsMixedAnswerPayloadValidationResult({
      payload: input.payload,
      contextResult,
      runtimeSnapshot: null,
      mixedRuntimeHandoff: null,
    });
  }

  const runtimeSnapshot = await loadMixedRuntimeDbSnapshot({
    locale: input.payload.locale ?? contextResult.context.locale,
  });
  const mixedRuntimeHandoff = buildMixedRuntimeHandoff(runtimeSnapshot);

  return buildTeamDynamicsMixedAnswerPayloadValidationResult({
    payload: input.payload,
    contextResult,
    runtimeSnapshot,
    mixedRuntimeHandoff,
  });
}
