import "server-only";

import type { TeamAssessmentExecutionContext } from "@/lib/assessment/team-assessment-execution";
import type { TeamDynamicsMixedRuntimeHandoff } from "@/lib/assessment/team-dynamics-mixed-runtime";
import {
  loadTeamDynamicsMixedSavedAnswersForContext,
  type TeamDynamicsMixedSavedAnswerState,
} from "@/lib/assessment/team-dynamics-mixed-answer-rehydration";
import { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG } from "@/lib/assessment/team-dynamics";

export type TeamDynamicsMixedCompletionReadiness = {
  readinessStatus: "not_ready" | "ready" | "no_supported_items";
  isReadyForCompletion: boolean;
  supportedItemCount: number;
  savedValidAnswerCount: number;
  missingQuestionIds: string[];
  invalidSavedAnswerCount: number;
  ignoredStaleAnswerCount: number;
  likertItemCount: number;
  sjtItemCount: number;
  savedLikertAnswerCount: number;
  savedSjtAnswerCount: number;
  warnings: string[];
};

type TeamDynamicsMixedCompletionReadinessDependencies = {
  loadSavedAnswers?: typeof loadTeamDynamicsMixedSavedAnswersForContext;
};

function buildEmptyMixedCompletionReadiness(
  warnings: string[] = [],
): TeamDynamicsMixedCompletionReadiness {
  return {
    readinessStatus: "no_supported_items",
    isReadyForCompletion: false,
    supportedItemCount: 0,
    savedValidAnswerCount: 0,
    missingQuestionIds: [],
    invalidSavedAnswerCount: 0,
    ignoredStaleAnswerCount: 0,
    likertItemCount: 0,
    sjtItemCount: 0,
    savedLikertAnswerCount: 0,
    savedSjtAnswerCount: 0,
    warnings,
  };
}

function isSavedLikertSelectionValid(input: {
  item: TeamDynamicsMixedRuntimeHandoff["items"][number];
  savedAnswerState: TeamDynamicsMixedSavedAnswerState;
}): boolean {
  const optionId =
    input.savedAnswerState.savedLikertSelectionsByQuestionId[input.item.questionId] ?? null;

  return (
    input.item.responseFormat === "single_select_likert" &&
    typeof optionId === "string" &&
    input.item.options.some((option) => option.optionId === optionId)
  );
}

function isSavedSjtSelectionValid(input: {
  item: TeamDynamicsMixedRuntimeHandoff["items"][number];
  savedAnswerState: TeamDynamicsMixedSavedAnswerState;
}): boolean {
  const savedSelection =
    input.savedAnswerState.savedSjtSelectionsByQuestionId[input.item.questionId] ?? null;

  if (!savedSelection || input.item.responseFormat !== "best_worst") {
    return false;
  }

  const optionIds = new Set(input.item.options.map((option) => option.optionId));

  return (
    typeof savedSelection.bestOptionId === "string" &&
    typeof savedSelection.worstOptionId === "string" &&
    savedSelection.bestOptionId !== savedSelection.worstOptionId &&
    optionIds.has(savedSelection.bestOptionId) &&
    optionIds.has(savedSelection.worstOptionId)
  );
}

export function buildTeamDynamicsMixedCompletionReadiness(input: {
  context: Pick<TeamAssessmentExecutionContext, "packageSlug" | "test">;
  runtimeHandoff: TeamDynamicsMixedRuntimeHandoff;
  savedAnswerState: TeamDynamicsMixedSavedAnswerState;
}): TeamDynamicsMixedCompletionReadiness {
  if (
    input.context.packageSlug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG ||
    input.context.test.slug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG ||
    input.runtimeHandoff.testSlug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG ||
    input.runtimeHandoff.scoringMethod !== "mixed_v1"
  ) {
    return buildEmptyMixedCompletionReadiness([
      `unsupported:${TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG}`,
    ]);
  }

  const supportedItems = input.runtimeHandoff.items.filter(
    (item) =>
      item.responseFormat === "single_select_likert" ||
      item.responseFormat === "best_worst",
  );
  const likertItems = supportedItems.filter(
    (item) => item.responseFormat === "single_select_likert",
  );
  const sjtItems = supportedItems.filter((item) => item.responseFormat === "best_worst");

  if (supportedItems.length === 0) {
    return buildEmptyMixedCompletionReadiness(input.savedAnswerState.warnings);
  }

  const validLikertQuestionIds = likertItems
    .filter((item) =>
      isSavedLikertSelectionValid({
        item,
        savedAnswerState: input.savedAnswerState,
      }),
    )
    .map((item) => item.questionId);
  const validSjtQuestionIds = sjtItems
    .filter((item) =>
      isSavedSjtSelectionValid({
        item,
        savedAnswerState: input.savedAnswerState,
      }),
    )
    .map((item) => item.questionId);
  const validAnsweredQuestionIds = new Set([
    ...validLikertQuestionIds,
    ...validSjtQuestionIds,
  ]);
  const missingQuestionIds = supportedItems
    .map((item) => item.questionId)
    .filter((questionId) => !validAnsweredQuestionIds.has(questionId));
  const savedLikertAnswerCount = validLikertQuestionIds.length;
  const savedSjtAnswerCount = validSjtQuestionIds.length;
  const savedValidAnswerCount = savedLikertAnswerCount + savedSjtAnswerCount;
  const isReadyForCompletion =
    supportedItems.length > 0 && missingQuestionIds.length === 0;

  return {
    readinessStatus: isReadyForCompletion ? "ready" : "not_ready",
    isReadyForCompletion,
    supportedItemCount: supportedItems.length,
    savedValidAnswerCount,
    missingQuestionIds,
    invalidSavedAnswerCount: input.savedAnswerState.invalidSavedAnswerCount,
    ignoredStaleAnswerCount: input.savedAnswerState.ignoredStaleAnswerCount,
    likertItemCount: likertItems.length,
    sjtItemCount: sjtItems.length,
    savedLikertAnswerCount,
    savedSjtAnswerCount,
    warnings: input.savedAnswerState.warnings,
  };
}

export async function loadTeamDynamicsMixedCompletionReadinessForContext(
  input: {
    context: TeamAssessmentExecutionContext;
    runtimeHandoff: TeamDynamicsMixedRuntimeHandoff;
  },
  deps: TeamDynamicsMixedCompletionReadinessDependencies = {},
): Promise<TeamDynamicsMixedCompletionReadiness> {
  const loadSavedAnswers =
    deps.loadSavedAnswers ?? loadTeamDynamicsMixedSavedAnswersForContext;

  if (
    input.context.packageSlug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG ||
    input.context.test.slug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG
  ) {
    return buildEmptyMixedCompletionReadiness([
      `unsupported:${TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG}`,
    ]);
  }

  const savedAnswerState = await loadSavedAnswers({
    context: input.context,
    runtimeHandoff: input.runtimeHandoff,
  });

  return buildTeamDynamicsMixedCompletionReadiness({
    context: input.context,
    runtimeHandoff: input.runtimeHandoff,
    savedAnswerState,
  });
}
