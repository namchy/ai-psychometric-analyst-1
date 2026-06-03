import "server-only";

import type { TeamAssessmentExecutionContext } from "@/lib/assessment/team-assessment-execution";
import type { TeamDynamicsMixedSavedAnswerState } from "@/lib/assessment/team-dynamics-mixed-answer-rehydration";
import { loadTeamDynamicsMixedSavedAnswersForContext } from "@/lib/assessment/team-dynamics-mixed-answer-rehydration";
import {
  buildTeamDynamicsMixedCompletionReadiness,
} from "@/lib/assessment/team-dynamics-mixed-completion-readiness";
import {
  loadTeamDynamicsMixedRuntimeHandoff,
  type TeamDynamicsMixedRuntimeHandoff,
} from "@/lib/assessment/team-dynamics-mixed-runtime";
import { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG } from "@/lib/assessment/team-dynamics";

type JsonRecord = Record<string, unknown>;

export type TeamDynamicsMixedScoreStatus =
  | "scored"
  | "not_ready"
  | "not_completed"
  | "no_supported_items"
  | "not_scored"
  | "failed";

export type TeamDynamicsMixedScoreReason =
  | "wrapper_or_attempt_not_completed"
  | "completion_readiness_not_satisfied"
  | "unsupported_assessment"
  | "unsupported_runtime_scoring_shape"
  | "unsupported_likert_scoring_contract"
  | "missing_reverse_scored_metadata"
  | "invalid_tdm_domain_metadata"
  | "missing_numeric_option_value"
  | "invalid_numeric_option_scale"
  | "missing_sjt_scoring_metadata"
  | null;

export type TeamDynamicsMixedScoreEntry = {
  scoreKey: string;
  label: string;
  blockKey: string;
  scoreModel: "simple_linear_v1" | "expert_key_partial_credit_v1";
  itemCount: number;
  scoredItemCount: number;
  rawTotal: number;
  meanRaw: number;
  score0To100: number;
  scaleMin: number;
  scaleMax: number;
  metadata: JsonRecord;
};

export type TeamDynamicsMixedScoreBlockSummary = {
  blockKey: string;
  blockType: "likert" | "sjt_best_worst";
  itemCount: number;
  scoredItemCount: number;
  scoreKeys: string[];
};

export type TeamDynamicsMixedScoreResult = {
  status: TeamDynamicsMixedScoreStatus;
  supportedQuestionCount: number;
  scoredQuestionCount: number;
  rawTotal: number | null;
  meanRaw: number | null;
  score0To100: number | null;
  missingQuestionIds: string[];
  ignoredInvalidAnswerCount: number;
  invalidSavedAnswerCount: number;
  ignoredStaleAnswerCount: number;
  savedLikertAnswerCount: number;
  savedSjtAnswerCount: number;
  scaleMin: number | null;
  scaleMax: number | null;
  scoreValueSource: "mixed_runtime_db_truth" | null;
  reason: TeamDynamicsMixedScoreReason;
  runtimeWarnings: string[];
  unsupportedQuestionIds: string[];
  blocks: TeamDynamicsMixedScoreBlockSummary[];
  scoreEntries: TeamDynamicsMixedScoreEntry[];
};

type TeamDynamicsMixedScoringDependencies = {
  loadRuntimeHandoff?: typeof loadTeamDynamicsMixedRuntimeHandoff;
  loadSavedAnswers?: typeof loadTeamDynamicsMixedSavedAnswersForContext;
};

function coerceRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function getTdmItemNumber(itemCode: string): number | null {
  const match = /^TDM31_(\d{2})$/.exec(itemCode);

  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function getNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
    : [];
}

function buildBaseScoreResult(
  overrides: Partial<TeamDynamicsMixedScoreResult> & {
    status: TeamDynamicsMixedScoreStatus;
  },
): TeamDynamicsMixedScoreResult {
  return {
    status: overrides.status,
    supportedQuestionCount: overrides.supportedQuestionCount ?? 0,
    scoredQuestionCount: overrides.scoredQuestionCount ?? 0,
    rawTotal: overrides.rawTotal ?? null,
    meanRaw: overrides.meanRaw ?? null,
    score0To100: overrides.score0To100 ?? null,
    missingQuestionIds: overrides.missingQuestionIds ?? [],
    ignoredInvalidAnswerCount: overrides.ignoredInvalidAnswerCount ?? 0,
    invalidSavedAnswerCount: overrides.invalidSavedAnswerCount ?? 0,
    ignoredStaleAnswerCount: overrides.ignoredStaleAnswerCount ?? 0,
    savedLikertAnswerCount: overrides.savedLikertAnswerCount ?? 0,
    savedSjtAnswerCount: overrides.savedSjtAnswerCount ?? 0,
    scaleMin: overrides.scaleMin ?? null,
    scaleMax: overrides.scaleMax ?? null,
    scoreValueSource: overrides.scoreValueSource ?? null,
    reason: overrides.reason ?? null,
    runtimeWarnings: overrides.runtimeWarnings ?? [],
    unsupportedQuestionIds: overrides.unsupportedQuestionIds ?? [],
    blocks: overrides.blocks ?? [],
    scoreEntries: overrides.scoreEntries ?? [],
  };
}

function buildLikertScoreEntry(input: {
  scoreKey: string;
  label: string;
  blockKey: string;
  values: number[];
  metadata?: JsonRecord;
}): TeamDynamicsMixedScoreEntry | null {
  if (input.values.length === 0) {
    return null;
  }

  const scaleMin = 1;
  const scaleMax = 4;
  const rawTotal = roundScore(input.values.reduce((sum, value) => sum + value, 0));
  const meanRaw = roundScore(rawTotal / input.values.length);
  const score0To100 = roundScore(((meanRaw - scaleMin) / (scaleMax - scaleMin)) * 100);

  return {
    scoreKey: input.scoreKey,
    label: input.label,
    blockKey: input.blockKey,
    scoreModel: "simple_linear_v1",
    itemCount: input.values.length,
    scoredItemCount: input.values.length,
    rawTotal,
    meanRaw,
    score0To100,
    scaleMin,
    scaleMax,
    metadata: input.metadata ?? {},
  };
}

function buildSjtScoreEntry(input: {
  blockKey: string;
  label: string;
  scenarioScores: number[];
}): TeamDynamicsMixedScoreEntry | null {
  if (input.scenarioScores.length === 0) {
    return null;
  }

  const scaleMin = -2 * input.scenarioScores.length;
  const scaleMax = 4 * input.scenarioScores.length;
  const rawTotal = roundScore(input.scenarioScores.reduce((sum, value) => sum + value, 0));
  const meanRaw = roundScore(rawTotal / input.scenarioScores.length);
  const score0To100 = roundScore(((rawTotal - scaleMin) / (scaleMax - scaleMin)) * 100);

  return {
    scoreKey: `${input.blockKey}_overall`,
    label: input.label,
    blockKey: input.blockKey,
    scoreModel: "expert_key_partial_credit_v1",
    itemCount: input.scenarioScores.length,
    scoredItemCount: input.scenarioScores.length,
    rawTotal,
    meanRaw,
    score0To100,
    scaleMin,
    scaleMax,
    metadata: {},
  };
}

function getLikertSelectedValue(input: {
  item: TeamDynamicsMixedRuntimeHandoff["items"][number];
  savedAnswerState: TeamDynamicsMixedSavedAnswerState;
}): { ok: true; value: number } | { ok: false; reason: TeamDynamicsMixedScoreReason } {
  const selectedOptionId =
    input.savedAnswerState.savedLikertSelectionsByQuestionId[input.item.questionId] ?? null;
  const selectedOption = input.item.options.find(
    (option) => option.optionId === selectedOptionId,
  );

  if (!selectedOption || typeof selectedOption.value !== "number") {
    return {
      ok: false,
      reason: "missing_numeric_option_value",
    };
  }

  if (![1, 2, 3, 4].includes(selectedOption.value)) {
    return {
      ok: false,
      reason: "invalid_numeric_option_scale",
    };
  }

  const reverseScored = coerceRecord(input.item.metadata).reverse_scored === true;
  return {
    ok: true,
    value: reverseScored ? 5 - selectedOption.value : selectedOption.value,
  };
}

function getSjtScenarioScore(input: {
  item: TeamDynamicsMixedRuntimeHandoff["items"][number];
  savedAnswerState: TeamDynamicsMixedSavedAnswerState;
}): { ok: true; value: number } | { ok: false; reason: TeamDynamicsMixedScoreReason } {
  const selection =
    input.savedAnswerState.savedSjtSelectionsByQuestionId[input.item.questionId] ?? null;

  if (!selection) {
    return {
      ok: false,
      reason: "completion_readiness_not_satisfied",
    };
  }

  const bestOption = input.item.options.find(
    (option) => option.optionId === selection.bestOptionId,
  );
  const worstOption = input.item.options.find(
    (option) => option.optionId === selection.worstOptionId,
  );

  const bestPoints = bestOption?.metadata.best_choice_points;
  const worstPoints = worstOption?.metadata.worst_choice_points;

  if (
    typeof bestPoints !== "number" ||
    typeof worstPoints !== "number" ||
    Number.isFinite(bestPoints) === false ||
    Number.isFinite(worstPoints) === false
  ) {
    return {
      ok: false,
      reason: "missing_sjt_scoring_metadata",
    };
  }

  return {
    ok: true,
    value: bestPoints + worstPoints,
  };
}

function validateLikertBlockContract(input: {
  block: TeamDynamicsMixedRuntimeHandoff["blocks"][number];
}): { ok: true } | { ok: false; reason: TeamDynamicsMixedScoreReason } {
  const metadata = coerceRecord(input.block.metadata);

  if (metadata.response_scale !== "likert_1_4_agreement") {
    return {
      ok: false,
      reason: "unsupported_likert_scoring_contract",
    };
  }

  if (input.block.blockKey === "tdm-31-V1") {
    const scoring = coerceRecord(metadata.scoring);
    const phase1 = coerceRecord(scoring.phase_1);

    if (phase1.method !== "simple_linear_v1") {
      return {
        ok: false,
        reason: "unsupported_likert_scoring_contract",
      };
    }

    return { ok: true };
  }

  if (metadata.scoring_mode !== "simple_linear_v1") {
    return {
      ok: false,
      reason: "unsupported_likert_scoring_contract",
    };
  }

  return { ok: true };
}

function validateTdmItemMetadata(input: {
  item: TeamDynamicsMixedRuntimeHandoff["items"][number];
  block: TeamDynamicsMixedRuntimeHandoff["blocks"][number] | undefined;
}): { ok: true } | { ok: false; reason: TeamDynamicsMixedScoreReason } {
  if (input.item.blockKey !== "tdm-31-V1") {
    return { ok: true };
  }

  const itemNumber = getTdmItemNumber(input.item.code);
  const itemMetadata = coerceRecord(input.item.metadata);
  const blockMetadata = coerceRecord(input.block?.metadata);
  const reverseScoredItems = new Set(
    getNumberArray(blockMetadata.reverse_scored_items),
  );
  const domainMapping = coerceRecord(blockMetadata.domain_mapping);
  let expectedDomainGroup: string | null = null;

  for (const [domainGroup, mappedValues] of Object.entries(domainMapping)) {
    if (getNumberArray(mappedValues).includes(itemNumber ?? Number.NaN)) {
      expectedDomainGroup = domainGroup;
      break;
    }
  }

  if (typeof itemMetadata.reverse_scored !== "boolean") {
    return {
      ok: false,
      reason: "missing_reverse_scored_metadata",
    };
  }

  if (itemNumber === null) {
    return {
      ok: false,
      reason: "invalid_tdm_domain_metadata",
    };
  }

  const expectedReverseScored = reverseScoredItems.has(itemNumber);

  if (itemMetadata.reverse_scored !== expectedReverseScored) {
    return {
      ok: false,
      reason: "missing_reverse_scored_metadata",
    };
  }

  if (typeof itemMetadata.domain_scored !== "boolean") {
    return {
      ok: false,
      reason: "invalid_tdm_domain_metadata",
    };
  }

  if (!expectedDomainGroup) {
    return {
      ok: false,
      reason: "invalid_tdm_domain_metadata",
    };
  }

  const shouldBeDomainScored = expectedDomainGroup !== "overall_rasch_only";

  if (itemMetadata.domain_scored !== shouldBeDomainScored) {
    return {
      ok: false,
      reason: "invalid_tdm_domain_metadata",
    };
  }

  if (typeof itemMetadata.domain_group !== "string" || itemMetadata.domain_group !== expectedDomainGroup) {
    return {
      ok: false,
      reason: "invalid_tdm_domain_metadata",
    };
  }

  return { ok: true };
}

export function buildTeamDynamicsMixedScore(input: {
  context: TeamAssessmentExecutionContext;
  runtimeHandoff: TeamDynamicsMixedRuntimeHandoff;
  savedAnswerState: TeamDynamicsMixedSavedAnswerState;
}): TeamDynamicsMixedScoreResult {
  const runtimeWarnings = [...input.runtimeHandoff.warnings];

  if (
    input.context.packageSlug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG ||
    input.context.test.slug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG ||
    input.runtimeHandoff.testSlug !== TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG ||
    input.runtimeHandoff.scoringMethod !== "mixed_v1"
  ) {
    return buildBaseScoreResult({
      status: "failed",
      reason: "unsupported_assessment",
      runtimeWarnings,
    });
  }

  const supportedItems = input.runtimeHandoff.items.filter(
    (item) =>
      item.responseFormat === "single_select_likert" ||
      item.responseFormat === "best_worst",
  );

  if (
    input.runtimeHandoff.unsupportedItems.length > 0 ||
    supportedItems.length !== input.runtimeHandoff.items.length
  ) {
    return buildBaseScoreResult({
      status: "failed",
      supportedQuestionCount: input.runtimeHandoff.items.length,
      missingQuestionIds: input.runtimeHandoff.items.map((item) => item.questionId),
      ignoredInvalidAnswerCount:
        input.savedAnswerState.invalidSavedAnswerCount +
        input.savedAnswerState.ignoredStaleAnswerCount,
      invalidSavedAnswerCount: input.savedAnswerState.invalidSavedAnswerCount,
      ignoredStaleAnswerCount: input.savedAnswerState.ignoredStaleAnswerCount,
      savedLikertAnswerCount: Object.keys(
        input.savedAnswerState.savedLikertSelectionsByQuestionId,
      ).length,
      savedSjtAnswerCount: Object.keys(
        input.savedAnswerState.savedSjtSelectionsByQuestionId,
      ).length,
      reason: "unsupported_runtime_scoring_shape",
      runtimeWarnings,
      unsupportedQuestionIds: input.runtimeHandoff.unsupportedItems.map(
        (item) => item.questionId,
      ),
    });
  }

  if (
    input.context.wrapperStatus !== "completed" ||
    input.context.attemptStatus !== "completed"
  ) {
    return buildBaseScoreResult({
      status: "not_completed",
      supportedQuestionCount: supportedItems.length,
      missingQuestionIds: supportedItems.map((item) => item.questionId),
      ignoredInvalidAnswerCount:
        input.savedAnswerState.invalidSavedAnswerCount +
        input.savedAnswerState.ignoredStaleAnswerCount,
      invalidSavedAnswerCount: input.savedAnswerState.invalidSavedAnswerCount,
      ignoredStaleAnswerCount: input.savedAnswerState.ignoredStaleAnswerCount,
      savedLikertAnswerCount: Object.keys(
        input.savedAnswerState.savedLikertSelectionsByQuestionId,
      ).length,
      savedSjtAnswerCount: Object.keys(
        input.savedAnswerState.savedSjtSelectionsByQuestionId,
      ).length,
      reason: "wrapper_or_attempt_not_completed",
      runtimeWarnings,
    });
  }

  const completionReadiness = buildTeamDynamicsMixedCompletionReadiness({
    context: input.context,
    runtimeHandoff: input.runtimeHandoff,
    savedAnswerState: input.savedAnswerState,
  });

  if (
    completionReadiness.readinessStatus === "no_supported_items" ||
    supportedItems.length === 0
  ) {
    return buildBaseScoreResult({
      status: "no_supported_items",
      runtimeWarnings,
    });
  }

  if (
    completionReadiness.readinessStatus !== "ready" ||
    completionReadiness.isReadyForCompletion === false
  ) {
    return buildBaseScoreResult({
      status: "not_ready",
      supportedQuestionCount: completionReadiness.supportedItemCount,
      scoredQuestionCount: completionReadiness.savedValidAnswerCount,
      missingQuestionIds: completionReadiness.missingQuestionIds,
      ignoredInvalidAnswerCount:
        completionReadiness.invalidSavedAnswerCount +
        completionReadiness.ignoredStaleAnswerCount,
      invalidSavedAnswerCount: completionReadiness.invalidSavedAnswerCount,
      ignoredStaleAnswerCount: completionReadiness.ignoredStaleAnswerCount,
      savedLikertAnswerCount: completionReadiness.savedLikertAnswerCount,
      savedSjtAnswerCount: completionReadiness.savedSjtAnswerCount,
      reason: "completion_readiness_not_satisfied",
      runtimeWarnings,
    });
  }

  const scoreEntries: TeamDynamicsMixedScoreEntry[] = [];
  const blocks: TeamDynamicsMixedScoreBlockSummary[] = [];
  const likertItems = supportedItems.filter(
    (item) => item.responseFormat === "single_select_likert",
  );
  const sjtItems = supportedItems.filter((item) => item.responseFormat === "best_worst");

  const likertValuesByBlock = new Map<string, number[]>();
  const tdmDomainValues = new Map<string, number[]>();

  for (const block of input.runtimeHandoff.blocks) {
    if (block.blockType !== "likert") {
      continue;
    }

    const contractResult = validateLikertBlockContract({ block });

    if (!contractResult.ok) {
      return buildBaseScoreResult({
        status: "failed",
        supportedQuestionCount: completionReadiness.supportedItemCount,
        scoredQuestionCount: completionReadiness.savedValidAnswerCount,
        missingQuestionIds: completionReadiness.missingQuestionIds,
        ignoredInvalidAnswerCount:
          completionReadiness.invalidSavedAnswerCount +
          completionReadiness.ignoredStaleAnswerCount,
        invalidSavedAnswerCount: completionReadiness.invalidSavedAnswerCount,
        ignoredStaleAnswerCount: completionReadiness.ignoredStaleAnswerCount,
        savedLikertAnswerCount: completionReadiness.savedLikertAnswerCount,
        savedSjtAnswerCount: completionReadiness.savedSjtAnswerCount,
        reason: contractResult.reason,
        runtimeWarnings,
      });
    }
  }

  for (const item of likertItems) {
    const block = input.runtimeHandoff.blocks.find(
      (entry) => entry.blockKey === item.blockKey,
    );
    const tdmMetadataValidation = validateTdmItemMetadata({
      item,
      block,
    });

    if (!tdmMetadataValidation.ok) {
      return buildBaseScoreResult({
        status: "failed",
        supportedQuestionCount: completionReadiness.supportedItemCount,
        scoredQuestionCount: completionReadiness.savedValidAnswerCount,
        missingQuestionIds: completionReadiness.missingQuestionIds,
        ignoredInvalidAnswerCount:
          completionReadiness.invalidSavedAnswerCount +
          completionReadiness.ignoredStaleAnswerCount,
        invalidSavedAnswerCount: completionReadiness.invalidSavedAnswerCount,
        ignoredStaleAnswerCount: completionReadiness.ignoredStaleAnswerCount,
        savedLikertAnswerCount: completionReadiness.savedLikertAnswerCount,
        savedSjtAnswerCount: completionReadiness.savedSjtAnswerCount,
        reason: tdmMetadataValidation.reason,
        runtimeWarnings,
      });
    }

    const valueResult = getLikertSelectedValue({
      item,
      savedAnswerState: input.savedAnswerState,
    });

    if (!valueResult.ok) {
      return buildBaseScoreResult({
        status: valueResult.reason === "completion_readiness_not_satisfied" ? "not_ready" : "not_scored",
        supportedQuestionCount: completionReadiness.supportedItemCount,
        scoredQuestionCount: completionReadiness.savedValidAnswerCount,
        missingQuestionIds: completionReadiness.missingQuestionIds,
        ignoredInvalidAnswerCount:
          completionReadiness.invalidSavedAnswerCount +
          completionReadiness.ignoredStaleAnswerCount,
        invalidSavedAnswerCount: completionReadiness.invalidSavedAnswerCount,
        ignoredStaleAnswerCount: completionReadiness.ignoredStaleAnswerCount,
        savedLikertAnswerCount: completionReadiness.savedLikertAnswerCount,
        savedSjtAnswerCount: completionReadiness.savedSjtAnswerCount,
        reason: valueResult.reason,
        runtimeWarnings,
      });
    }

    const blockValues = likertValuesByBlock.get(item.blockKey) ?? [];
    blockValues.push(valueResult.value);
    likertValuesByBlock.set(item.blockKey, blockValues);

    if (item.blockKey === "tdm-31-V1") {
      const metadata = coerceRecord(item.metadata);
      if (metadata.domain_scored === true && typeof metadata.domain_group === "string") {
        const domainValues = tdmDomainValues.get(metadata.domain_group) ?? [];
        domainValues.push(valueResult.value);
        tdmDomainValues.set(metadata.domain_group, domainValues);
      }
    }
  }

  for (const block of input.runtimeHandoff.blocks) {
    if (block.blockType !== "likert") {
      continue;
    }

    const blockItems = likertItems.filter((item) => item.blockKey === block.blockKey);
    if (blockItems.length === 0) {
      continue;
    }

    const blockValues = likertValuesByBlock.get(block.blockKey) ?? [];
    const entry = buildLikertScoreEntry({
      scoreKey: `${block.blockKey}_overall`,
      label: block.title,
      blockKey: block.blockKey,
      values: blockValues,
    });

    const scoreKeys: string[] = [];

    if (entry) {
      scoreEntries.push(entry);
      scoreKeys.push(entry.scoreKey);
    }

    if (block.blockKey === "tdm-31-V1") {
      for (const [domainGroup, domainValues] of tdmDomainValues.entries()) {
        const domainEntry = buildLikertScoreEntry({
          scoreKey: `tdm_domain_${domainGroup.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
          label: domainGroup,
          blockKey: block.blockKey,
          values: domainValues,
          metadata: {
            scoreRole: "domain",
          },
        });

        if (domainEntry) {
          scoreEntries.push(domainEntry);
          scoreKeys.push(domainEntry.scoreKey);
        }
      }
    }

    blocks.push({
      blockKey: block.blockKey,
      blockType: "likert",
      itemCount: blockItems.length,
      scoredItemCount: blockItems.length,
      scoreKeys,
    });
  }

  if (sjtItems.length > 0) {
    const sjtScenarioScores: number[] = [];

    for (const item of sjtItems) {
      const scoreResult = getSjtScenarioScore({
        item,
        savedAnswerState: input.savedAnswerState,
      });

      if (!scoreResult.ok) {
        return buildBaseScoreResult({
          status: scoreResult.reason === "completion_readiness_not_satisfied" ? "not_ready" : "not_scored",
          supportedQuestionCount: completionReadiness.supportedItemCount,
          scoredQuestionCount: completionReadiness.savedValidAnswerCount,
          missingQuestionIds: completionReadiness.missingQuestionIds,
          ignoredInvalidAnswerCount:
            completionReadiness.invalidSavedAnswerCount +
            completionReadiness.ignoredStaleAnswerCount,
          invalidSavedAnswerCount: completionReadiness.invalidSavedAnswerCount,
          ignoredStaleAnswerCount: completionReadiness.ignoredStaleAnswerCount,
          savedLikertAnswerCount: completionReadiness.savedLikertAnswerCount,
          savedSjtAnswerCount: completionReadiness.savedSjtAnswerCount,
          reason: scoreResult.reason,
          runtimeWarnings,
        });
      }

      sjtScenarioScores.push(scoreResult.value);
    }

    const sjtBlock = input.runtimeHandoff.blocks.find(
      (block) => block.blockKey === "situational_judgment",
    );
    const sjtEntry = buildSjtScoreEntry({
      blockKey: "situational_judgment",
      label: sjtBlock?.title ?? "Timsko prosudjivanje u situacijama",
      scenarioScores: sjtScenarioScores,
    });

    if (sjtEntry) {
      scoreEntries.push(sjtEntry);
      blocks.push({
        blockKey: "situational_judgment",
        blockType: "sjt_best_worst",
        itemCount: sjtItems.length,
        scoredItemCount: sjtItems.length,
        scoreKeys: [sjtEntry.scoreKey],
      });
    }
  }

  return buildBaseScoreResult({
    status: "scored",
    supportedQuestionCount: completionReadiness.supportedItemCount,
    scoredQuestionCount: completionReadiness.savedValidAnswerCount,
    ignoredInvalidAnswerCount:
      completionReadiness.invalidSavedAnswerCount +
      completionReadiness.ignoredStaleAnswerCount,
    invalidSavedAnswerCount: completionReadiness.invalidSavedAnswerCount,
    ignoredStaleAnswerCount: completionReadiness.ignoredStaleAnswerCount,
    savedLikertAnswerCount: completionReadiness.savedLikertAnswerCount,
    savedSjtAnswerCount: completionReadiness.savedSjtAnswerCount,
    scoreValueSource: "mixed_runtime_db_truth",
    runtimeWarnings,
    blocks,
    scoreEntries,
  });
}

export async function loadTeamDynamicsMixedScoreForContext(
  input: {
    context: TeamAssessmentExecutionContext;
  },
  deps: TeamDynamicsMixedScoringDependencies = {},
): Promise<TeamDynamicsMixedScoreResult> {
  const loadRuntimeHandoff =
    deps.loadRuntimeHandoff ?? loadTeamDynamicsMixedRuntimeHandoff;
  const loadSavedAnswers =
    deps.loadSavedAnswers ?? loadTeamDynamicsMixedSavedAnswersForContext;

  const runtimeHandoff = await loadRuntimeHandoff({
    locale: input.context.locale,
  });
  const savedAnswerState = await loadSavedAnswers({
    context: input.context,
    runtimeHandoff,
  });

  return buildTeamDynamicsMixedScore({
    context: input.context,
    runtimeHandoff,
    savedAnswerState,
  });
}
