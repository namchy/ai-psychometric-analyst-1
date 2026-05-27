import "server-only";

import type { TeamAssessmentExecutionContext } from "@/lib/assessment/team-assessment-execution";
import type { TeamDynamicsMixedRuntimeHandoff } from "@/lib/assessment/team-dynamics-mixed-runtime";
import { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG } from "@/lib/assessment/team-dynamics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ExistingResponseSelectionRecord = {
  question_id: string;
  answer_option_id: string | null;
  selection_role: string | null;
};

type ExistingResponseRecord = {
  id: string;
  question_id: string;
  response_kind: string;
  answer_option_id: string | null;
  response_selections: ExistingResponseSelectionRecord[] | null;
};

export type TeamDynamicsMixedSavedAnswerState = {
  savedLikertSelectionsByQuestionId: Record<string, string>;
  savedSjtSelectionsByQuestionId: Record<
    string,
    {
      bestOptionId: string;
      worstOptionId: string;
    }
  >;
  savedAnswerCount: number;
  invalidSavedAnswerCount: number;
  ignoredStaleAnswerCount: number;
  warnings: string[];
};

type TeamDynamicsMixedAnswerRehydrationDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

function buildEmptyMixedSavedAnswerState(
  warnings: string[] = [],
): TeamDynamicsMixedSavedAnswerState {
  return {
    savedLikertSelectionsByQuestionId: {},
    savedSjtSelectionsByQuestionId: {},
    savedAnswerCount: 0,
    invalidSavedAnswerCount: 0,
    ignoredStaleAnswerCount: 0,
    warnings,
  };
}

function buildSjtSelectionState(
  responseSelections: ExistingResponseSelectionRecord[],
): {
  bestOptionId: string | null;
  worstOptionId: string | null;
  isCanonicalPair: boolean;
} {
  const bestSelections = responseSelections.filter(
    (selection) => selection.selection_role === "best",
  );
  const worstSelections = responseSelections.filter(
    (selection) => selection.selection_role === "worst",
  );

  return {
    bestOptionId:
      bestSelections.length === 1 ? bestSelections[0]?.answer_option_id ?? null : null,
    worstOptionId:
      worstSelections.length === 1 ? worstSelections[0]?.answer_option_id ?? null : null,
    isCanonicalPair:
      responseSelections.length === 2 &&
      bestSelections.length === 1 &&
      worstSelections.length === 1,
  };
}

export function buildTeamDynamicsMixedSavedAnswerState(input: {
  context: Pick<TeamAssessmentExecutionContext, "packageSlug" | "test">;
  runtimeHandoff: TeamDynamicsMixedRuntimeHandoff;
  responseRows: ExistingResponseRecord[];
}): TeamDynamicsMixedSavedAnswerState {
  if (
    input.context.packageSlug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG ||
    input.context.test.slug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG ||
    input.runtimeHandoff.testSlug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG ||
    input.runtimeHandoff.scoringMethod !== "mixed_v1"
  ) {
    return buildEmptyMixedSavedAnswerState([
      `unsupported:${TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG}`,
    ]);
  }

  const savedState = buildEmptyMixedSavedAnswerState();
  const runtimeItemsByQuestionId = new Map(
    input.runtimeHandoff.items.map((item) => [item.questionId, item] as const),
  );

  for (const responseRow of input.responseRows) {
    const runtimeItem = runtimeItemsByQuestionId.get(responseRow.question_id);

    if (!runtimeItem) {
      savedState.ignoredStaleAnswerCount += 1;
      continue;
    }

    const validOptionIds = new Set(runtimeItem.options.map((option) => option.optionId));

    if (runtimeItem.responseFormat === "single_select_likert") {
      if (
        responseRow.response_kind !== "single_choice" ||
        !responseRow.answer_option_id ||
        !validOptionIds.has(responseRow.answer_option_id)
      ) {
        if (
          responseRow.response_kind === "single_choice" &&
          responseRow.answer_option_id &&
          !validOptionIds.has(responseRow.answer_option_id)
        ) {
          savedState.ignoredStaleAnswerCount += 1;
        } else {
          savedState.invalidSavedAnswerCount += 1;
        }
        continue;
      }

      savedState.savedLikertSelectionsByQuestionId[runtimeItem.questionId] =
        responseRow.answer_option_id;
      continue;
    }

    if (runtimeItem.responseFormat !== "best_worst") {
      savedState.invalidSavedAnswerCount += 1;
      continue;
    }

    if (responseRow.response_kind !== "best_worst") {
      savedState.invalidSavedAnswerCount += 1;
      continue;
    }

    const selectionState = buildSjtSelectionState(responseRow.response_selections ?? []);

    if (
      !selectionState.isCanonicalPair ||
      !selectionState.bestOptionId ||
      !selectionState.worstOptionId
    ) {
      savedState.invalidSavedAnswerCount += 1;
      continue;
    }

    if (
      selectionState.bestOptionId === selectionState.worstOptionId ||
      !validOptionIds.has(selectionState.bestOptionId) ||
      !validOptionIds.has(selectionState.worstOptionId)
    ) {
      if (
        !validOptionIds.has(selectionState.bestOptionId) ||
        !validOptionIds.has(selectionState.worstOptionId)
      ) {
        savedState.ignoredStaleAnswerCount += 1;
      } else {
        savedState.invalidSavedAnswerCount += 1;
      }
      continue;
    }

    savedState.savedSjtSelectionsByQuestionId[runtimeItem.questionId] = {
      bestOptionId: selectionState.bestOptionId,
      worstOptionId: selectionState.worstOptionId,
    };
  }

  savedState.savedAnswerCount =
    Object.keys(savedState.savedLikertSelectionsByQuestionId).length +
    Object.keys(savedState.savedSjtSelectionsByQuestionId).length;

  return savedState;
}

export async function loadTeamDynamicsMixedSavedAnswersForContext(
  input: {
    context: TeamAssessmentExecutionContext;
    runtimeHandoff: TeamDynamicsMixedRuntimeHandoff;
  },
  deps: TeamDynamicsMixedAnswerRehydrationDependencies = {},
): Promise<TeamDynamicsMixedSavedAnswerState> {
  if (
    input.context.packageSlug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG ||
    input.context.test.slug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG
  ) {
    return buildEmptyMixedSavedAnswerState([
      `unsupported:${TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG}`,
    ]);
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("responses")
    .select(
      "id, question_id, response_kind, answer_option_id, response_selections(question_id, answer_option_id, selection_role)",
    )
    .eq("attempt_id", input.context.attemptId);

  if (error) {
    throw new Error(
      `Failed to load Team Dynamics mixed saved answers: ${error.message}`,
    );
  }

  return buildTeamDynamicsMixedSavedAnswerState({
    context: input.context,
    runtimeHandoff: input.runtimeHandoff,
    responseRows: (data ?? []) as ExistingResponseRecord[],
  });
}
