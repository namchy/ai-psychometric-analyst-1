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

  const missingQuestionIds = supportedItems
    .map((item) => item.questionId)
    .filter((questionId) => {
      return (
        !(questionId in input.savedAnswerState.savedLikertSelectionsByQuestionId) &&
        !(questionId in input.savedAnswerState.savedSjtSelectionsByQuestionId)
      );
    });
  const savedLikertAnswerCount = Object.keys(
    input.savedAnswerState.savedLikertSelectionsByQuestionId,
  ).length;
  const savedSjtAnswerCount = Object.keys(
    input.savedAnswerState.savedSjtSelectionsByQuestionId,
  ).length;
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
