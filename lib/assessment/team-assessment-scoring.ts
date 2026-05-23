import "server-only";

import {
  loadTeamAssessmentExecutionContext,
  type TeamAssessmentExecutionContext,
  type TeamAssessmentUiOnlyItem,
} from "@/lib/assessment/team-assessment-execution";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type TeamAssessmentMinimalScoreStatus =
  | "scored"
  | "not_ready"
  | "not_completed"
  | "no_supported_items"
  | "not_scored";

export type TeamAssessmentMinimalScoreResult = {
  status: TeamAssessmentMinimalScoreStatus;
  supportedQuestionCount: number;
  scoredQuestionCount: number;
  rawTotal: number | null;
  meanRaw: number | null;
  score0To100: number | null;
  missingQuestionIds: string[];
  ignoredInvalidAnswerCount: number;
  scaleMin: number | null;
  scaleMax: number | null;
  scoreValueSource: "answer_option_value" | null;
  reason:
    | "wrapper_or_attempt_not_completed"
    | "completion_readiness_not_satisfied"
    | "missing_numeric_option_value"
    | "inconsistent_numeric_scale"
    | "invalid_numeric_scale"
    | null;
};

type TeamAssessmentMinimalScoreAnswerOptionRecord = {
  id: string;
  question_id: string;
  value: number | null;
};

type TeamAssessmentMinimalScoreResponseRecord = {
  question_id: string;
  answer_option_id: string | null;
  response_kind: string;
};

type TeamAssessmentMinimalScoreDependencies = {
  loadExecutionContext?: typeof loadTeamAssessmentExecutionContext;
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildBaseScoreResult(
  overrides: Partial<TeamAssessmentMinimalScoreResult> & {
    status: TeamAssessmentMinimalScoreStatus;
  },
): TeamAssessmentMinimalScoreResult {
  return {
    status: overrides.status,
    supportedQuestionCount: overrides.supportedQuestionCount ?? 0,
    scoredQuestionCount: overrides.scoredQuestionCount ?? 0,
    rawTotal: overrides.rawTotal ?? null,
    meanRaw: overrides.meanRaw ?? null,
    score0To100: overrides.score0To100 ?? null,
    missingQuestionIds: overrides.missingQuestionIds ?? [],
    ignoredInvalidAnswerCount: overrides.ignoredInvalidAnswerCount ?? 0,
    scaleMin: overrides.scaleMin ?? null,
    scaleMax: overrides.scaleMax ?? null,
    scoreValueSource: overrides.scoreValueSource ?? null,
    reason: overrides.reason ?? null,
  };
}

export function buildTeamAssessmentMinimalScore(input: {
  context: TeamAssessmentExecutionContext;
  uiOnlyItems: TeamAssessmentUiOnlyItem[];
  savedResponses: TeamAssessmentMinimalScoreResponseRecord[];
  answerOptions: TeamAssessmentMinimalScoreAnswerOptionRecord[];
}): TeamAssessmentMinimalScoreResult {
  if (
    input.context.wrapperStatus !== "completed" ||
    input.context.attemptStatus !== "completed"
  ) {
    return buildBaseScoreResult({
      status: "not_completed",
      supportedQuestionCount: input.uiOnlyItems.length,
      missingQuestionIds: input.uiOnlyItems.map((item) => item.questionId),
      reason: "wrapper_or_attempt_not_completed",
    });
  }

  if (input.uiOnlyItems.length === 0) {
    return buildBaseScoreResult({
      status: "no_supported_items",
    });
  }

  const optionRecordsById = new Map(
    input.answerOptions.map((option) => [option.id, option]),
  );
  const optionRecordsByQuestionId = input.answerOptions.reduce<
    Map<string, TeamAssessmentMinimalScoreAnswerOptionRecord[]>
  >((grouped, option) => {
    const options = grouped.get(option.question_id) ?? [];
    options.push(option);
    grouped.set(option.question_id, options);
    return grouped;
  }, new Map<string, TeamAssessmentMinimalScoreAnswerOptionRecord[]>());
  const validOptionIdsByQuestionId = new Map<string, Set<string>>();
  let sharedScaleMin: number | null = null;
  let sharedScaleMax: number | null = null;

  for (const item of input.uiOnlyItems) {
    validOptionIdsByQuestionId.set(item.questionId, new Set(item.optionIds));

    const optionRows = optionRecordsByQuestionId.get(item.questionId) ?? [];
    const numericValues = optionRows
      .filter((option) => item.optionIds.includes(option.id))
      .map((option) => option.value)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    if (numericValues.length !== item.optionIds.length || numericValues.length === 0) {
      return buildBaseScoreResult({
        status: "not_scored",
        supportedQuestionCount: input.uiOnlyItems.length,
        missingQuestionIds: input.uiOnlyItems.map((entry) => entry.questionId),
        reason: "missing_numeric_option_value",
      });
    }

    const questionScaleMin = Math.min(...numericValues);
    const questionScaleMax = Math.max(...numericValues);

    if (questionScaleMax <= questionScaleMin) {
      return buildBaseScoreResult({
        status: "not_scored",
        supportedQuestionCount: input.uiOnlyItems.length,
        missingQuestionIds: input.uiOnlyItems.map((entry) => entry.questionId),
        reason: "invalid_numeric_scale",
        scaleMin: questionScaleMin,
        scaleMax: questionScaleMax,
      });
    }

    if (sharedScaleMin === null || sharedScaleMax === null) {
      sharedScaleMin = questionScaleMin;
      sharedScaleMax = questionScaleMax;
      continue;
    }

    if (sharedScaleMin !== questionScaleMin || sharedScaleMax !== questionScaleMax) {
      return buildBaseScoreResult({
        status: "not_scored",
        supportedQuestionCount: input.uiOnlyItems.length,
        missingQuestionIds: input.uiOnlyItems.map((entry) => entry.questionId),
        reason: "inconsistent_numeric_scale",
        scaleMin: sharedScaleMin,
        scaleMax: sharedScaleMax,
      });
    }
  }

  const selectedOptionIdsByQuestionId = new Map<string, string>();
  let ignoredInvalidAnswerCount = 0;

  for (const savedResponse of input.savedResponses) {
    const validOptionIds = validOptionIdsByQuestionId.get(savedResponse.question_id);

    if (!validOptionIds) {
      continue;
    }

    if (
      savedResponse.response_kind !== "single_choice" ||
      !savedResponse.answer_option_id ||
      validOptionIds.has(savedResponse.answer_option_id) === false
    ) {
      ignoredInvalidAnswerCount += 1;
      continue;
    }

    selectedOptionIdsByQuestionId.set(savedResponse.question_id, savedResponse.answer_option_id);
  }

  const missingQuestionIds = input.uiOnlyItems
    .map((item) => item.questionId)
    .filter((questionId) => !selectedOptionIdsByQuestionId.has(questionId));

  if (missingQuestionIds.length > 0) {
    return buildBaseScoreResult({
      status: "not_ready",
      supportedQuestionCount: input.uiOnlyItems.length,
      scoredQuestionCount: input.uiOnlyItems.length - missingQuestionIds.length,
      missingQuestionIds,
      ignoredInvalidAnswerCount,
      scaleMin: sharedScaleMin,
      scaleMax: sharedScaleMax,
      reason: "completion_readiness_not_satisfied",
    });
  }

  const selectedValues: number[] = [];

  for (const item of input.uiOnlyItems) {
    const selectedOptionId = selectedOptionIdsByQuestionId.get(item.questionId);
    const selectedOption = selectedOptionId ? optionRecordsById.get(selectedOptionId) : null;

    if (!selectedOption || typeof selectedOption.value !== "number" || !Number.isFinite(selectedOption.value)) {
      return buildBaseScoreResult({
        status: "not_scored",
        supportedQuestionCount: input.uiOnlyItems.length,
        scoredQuestionCount: selectedValues.length,
        missingQuestionIds: [],
        ignoredInvalidAnswerCount,
        scaleMin: sharedScaleMin,
        scaleMax: sharedScaleMax,
        reason: "missing_numeric_option_value",
      });
    }

    selectedValues.push(selectedOption.value);
  }

  const rawTotal = roundScore(selectedValues.reduce((sum, value) => sum + value, 0));
  const meanRaw = roundScore(rawTotal / selectedValues.length);
  const score0To100 = roundScore(
    ((meanRaw - sharedScaleMin!) / (sharedScaleMax! - sharedScaleMin!)) * 100,
  );

  return buildBaseScoreResult({
    status: "scored",
    supportedQuestionCount: input.uiOnlyItems.length,
    scoredQuestionCount: selectedValues.length,
    rawTotal,
    meanRaw,
    score0To100,
    missingQuestionIds: [],
    ignoredInvalidAnswerCount,
    scaleMin: sharedScaleMin,
    scaleMax: sharedScaleMax,
    scoreValueSource: "answer_option_value",
  });
}

export async function loadTeamAssessmentMinimalScoreForContext(
  input: {
    context: TeamAssessmentExecutionContext;
    uiOnlyItems: TeamAssessmentUiOnlyItem[];
  },
  deps: {
    supabase?: ReturnType<typeof createSupabaseAdminClient>;
  } = {},
): Promise<TeamAssessmentMinimalScoreResult> {
  if (input.uiOnlyItems.length === 0) {
    return buildBaseScoreResult({
      status: "no_supported_items",
    });
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const questionIds = input.uiOnlyItems.map((item) => item.questionId);
  const optionIds = input.uiOnlyItems.flatMap((item) => item.optionIds);

  const [responsesResult, answerOptionsResult] = await Promise.all([
    supabase
      .from("responses")
      .select("question_id, answer_option_id, response_kind")
      .eq("attempt_id", input.context.attemptId)
      .in("question_id", questionIds),
    supabase
      .from("answer_options")
      .select("id, question_id, value")
      .in("id", optionIds),
  ]);

  if (responsesResult.error) {
    throw new Error(
      `Failed to load Team Dynamics minimal scoring responses: ${responsesResult.error.message}`,
    );
  }

  if (answerOptionsResult.error) {
    throw new Error(
      `Failed to load Team Dynamics minimal scoring answer options: ${answerOptionsResult.error.message}`,
    );
  }

  return buildTeamAssessmentMinimalScore({
    context: input.context,
    uiOnlyItems: input.uiOnlyItems,
    savedResponses:
      (responsesResult.data ?? []) as TeamAssessmentMinimalScoreResponseRecord[],
    answerOptions:
      (answerOptionsResult.data ?? []) as TeamAssessmentMinimalScoreAnswerOptionRecord[],
  });
}

export async function loadTeamAssessmentMinimalScore(input: {
  userId: string;
  teamAssessmentParticipantId: string;
  uiOnlyItems: TeamAssessmentUiOnlyItem[];
}, deps: TeamAssessmentMinimalScoreDependencies = {}): Promise<TeamAssessmentMinimalScoreResult> {
  const loadExecutionContext =
    deps.loadExecutionContext ?? loadTeamAssessmentExecutionContext;
  const contextResult = await loadExecutionContext({
    teamAssessmentParticipantId: input.teamAssessmentParticipantId,
    userId: input.userId,
  });

  if (!contextResult.ok) {
    return buildBaseScoreResult({
      status: "not_completed",
      supportedQuestionCount: input.uiOnlyItems.length,
      missingQuestionIds: input.uiOnlyItems.map((item) => item.questionId),
      reason: "wrapper_or_attempt_not_completed",
    });
  }

  return loadTeamAssessmentMinimalScoreForContext(
    {
      context: contextResult.context,
      uiOnlyItems: input.uiOnlyItems,
    },
    {
      supabase: deps.supabase,
    },
  );
}
