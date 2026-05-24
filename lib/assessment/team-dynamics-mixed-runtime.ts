import "server-only";

import {
  getAssessmentLocaleFallbacks,
  getPreferredAssessmentLocaleRecord,
  normalizeAssessmentLocale,
  type AssessmentLocale,
} from "@/lib/assessment/locale";
import { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG } from "@/lib/assessment/team-dynamics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const LOCALIZATION_QUERY_CHUNK_SIZE = 50;

type JsonRecord = Record<string, unknown>;

type TeamDynamicsTestRow = {
  id: string;
  slug: string;
  scoring_method: string;
  metadata: JsonRecord | null;
};

type TeamDynamicsDimensionRow = {
  code: string;
  display_order: number;
  metadata: JsonRecord | null;
};

type TeamDynamicsQuestionRow = {
  id: string;
  code: string;
  text: string;
  question_order: number;
  question_type: string;
  metadata: JsonRecord | null;
};

type TeamDynamicsOptionRow = {
  id: string;
  question_id: string;
  code: string | null;
  label: string;
  value: number | null;
  option_order: number;
  metadata: JsonRecord | null;
};

type QuestionLocalizationRow = {
  question_id: string;
  locale: string;
  text: string;
};

type AnswerOptionLocalizationRow = {
  answer_option_id: string;
  locale: string;
  label: string;
};

export type TeamDynamicsMixedRuntimeHandoffBlockType =
  | "likert"
  | "sjt_best_worst"
  | "unsupported";

export type TeamDynamicsMixedRuntimeHandoffOption = {
  optionId: string;
  code: string | null;
  label: string;
  value: number | null;
  order: number;
  metadata: JsonRecord;
};

export type TeamDynamicsMixedRuntimeHandoffItem = {
  questionId: string;
  code: string;
  order: number;
  blockKey: string;
  responseFormat: string | null;
  questionType: string;
  localizedText: string;
  metadata: JsonRecord;
  options: TeamDynamicsMixedRuntimeHandoffOption[];
};

export type TeamDynamicsMixedRuntimeHandoffBlock = {
  blockKey: string;
  blockType: TeamDynamicsMixedRuntimeHandoffBlockType;
  displayOrder: number;
  title: string;
  itemCodes: string[];
  itemCount: number;
  metadata: JsonRecord;
};

export type TeamDynamicsMixedRuntimeUnsupportedItem = {
  questionId: string;
  code: string;
  blockKey: string;
  reason: string;
};

export type TeamDynamicsMixedRuntimeHandoff = {
  testSlug: string;
  assessmentKey: string | null;
  importMode: string | null;
  locale: AssessmentLocale;
  scoringMethod: string;
  blockCount: number;
  itemCount: number;
  likertItemCount: number;
  sjtScenarioCount: number;
  outcomePulseItemCount: number;
  blocks: TeamDynamicsMixedRuntimeHandoffBlock[];
  items: TeamDynamicsMixedRuntimeHandoffItem[];
  unsupportedItems: TeamDynamicsMixedRuntimeUnsupportedItem[];
  warnings: string[];
};

export type TeamDynamicsMixedRuntimeDbSnapshot = {
  testRow: TeamDynamicsTestRow;
  dimensionRows: TeamDynamicsDimensionRow[];
  questionRows: TeamDynamicsQuestionRow[];
  optionRows: TeamDynamicsOptionRow[];
  questionLocalizations?: QuestionLocalizationRow[];
  optionLocalizations?: AnswerOptionLocalizationRow[];
  locale?: string | null;
};

function coerceRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function compareByOrder(
  left: { question_order?: number; option_order?: number; display_order?: number },
  right: { question_order?: number; option_order?: number; display_order?: number },
): number {
  return (
    (left.question_order ?? left.option_order ?? left.display_order ?? 0) -
    (right.question_order ?? right.option_order ?? right.display_order ?? 0)
  );
}

function chunkValues<T>(values: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

function getLocalizedQuestionText(
  question: TeamDynamicsQuestionRow,
  localizedRowsByQuestionId: Map<string, QuestionLocalizationRow[]>,
  locale: AssessmentLocale,
): string {
  return (
    getPreferredAssessmentLocaleRecord(
      localizedRowsByQuestionId.get(question.id) ?? [],
      locale,
    )?.text ?? question.text
  );
}

function getLocalizedOptionLabel(
  option: TeamDynamicsOptionRow,
  localizedRowsByOptionId: Map<string, AnswerOptionLocalizationRow[]>,
  locale: AssessmentLocale,
): string {
  return (
    getPreferredAssessmentLocaleRecord(
      localizedRowsByOptionId.get(option.id) ?? [],
      locale,
    )?.label ?? option.label
  );
}

function inferBlockType(input: {
  blockKey: string;
  questionRows: TeamDynamicsQuestionRow[];
  blockMetadata: JsonRecord;
}): TeamDynamicsMixedRuntimeHandoffBlockType {
  const declaredResponseFormat = input.questionRows[0]
    ? coerceRecord(input.questionRows[0].metadata).response_format
    : null;

  if (declaredResponseFormat === "best_worst") {
    return "sjt_best_worst";
  }

  if (
    input.blockKey === "tdm-31-V1" ||
    input.blockKey === "psychological_safety" ||
    input.blockKey === "outcome_pulse"
  ) {
    return "likert";
  }

  if (
    typeof input.blockMetadata.response_format === "string" &&
    input.blockMetadata.response_format === "best_worst"
  ) {
    return "sjt_best_worst";
  }

  return "unsupported";
}

export function buildTeamDynamicsMixedRuntimeHandoff(
  input: TeamDynamicsMixedRuntimeDbSnapshot,
): TeamDynamicsMixedRuntimeHandoff {
  const locale = normalizeAssessmentLocale(input.locale);
  const testMetadata = coerceRecord(input.testRow.metadata);
  const contentSpec = coerceRecord(testMetadata.content_spec);
  const assessmentSpec = coerceRecord(contentSpec.assessment);
  const contentSpecBlocks = coerceRecord(contentSpec.blocks);
  const questionRows = [...input.questionRows].sort(compareByOrder);
  const optionRows = [...input.optionRows].sort(compareByOrder);
  const dimensionRows = [...input.dimensionRows].sort(compareByOrder);
  const questionLocalizations = input.questionLocalizations ?? [];
  const optionLocalizations = input.optionLocalizations ?? [];
  const localizedRowsByQuestionId = new Map<string, QuestionLocalizationRow[]>();
  const localizedRowsByOptionId = new Map<string, AnswerOptionLocalizationRow[]>();
  const optionsByQuestionId = new Map<string, TeamDynamicsOptionRow[]>();

  for (const row of questionLocalizations) {
    const entries = localizedRowsByQuestionId.get(row.question_id) ?? [];
    entries.push(row);
    localizedRowsByQuestionId.set(row.question_id, entries);
  }

  for (const row of optionLocalizations) {
    const entries = localizedRowsByOptionId.get(row.answer_option_id) ?? [];
    entries.push(row);
    localizedRowsByOptionId.set(row.answer_option_id, entries);
  }

  for (const row of optionRows) {
    const entries = optionsByQuestionId.get(row.question_id) ?? [];
    entries.push(row);
    optionsByQuestionId.set(row.question_id, entries);
  }

  const blockOrder = Array.isArray(testMetadata.blocks)
    ? testMetadata.blocks.filter((value): value is string => typeof value === "string")
    : Array.isArray(assessmentSpec.blocks)
      ? assessmentSpec.blocks.filter((value): value is string => typeof value === "string")
      : [];
  const questionsByBlock = new Map<string, TeamDynamicsQuestionRow[]>();
  const warnings: string[] = [];
  const unsupportedItems: TeamDynamicsMixedRuntimeUnsupportedItem[] = [];
  const items: TeamDynamicsMixedRuntimeHandoffItem[] = [];
  const blocks: TeamDynamicsMixedRuntimeHandoffBlock[] = [];

  for (const question of questionRows) {
    const metadata = coerceRecord(question.metadata);
    const blockKey =
      typeof metadata.block_key === "string" ? metadata.block_key : "unassigned";
    const entries = questionsByBlock.get(blockKey) ?? [];
    entries.push(question);
    questionsByBlock.set(blockKey, entries);
  }

  const orderedBlockKeys = [
    ...blockOrder,
    ...[...questionsByBlock.keys()].filter((blockKey) => !blockOrder.includes(blockKey)),
  ];

  const dimensionMetadataByBlock = new Map<string, JsonRecord[]>();

  for (const dimension of dimensionRows) {
    const metadata = coerceRecord(dimension.metadata);
    const blockKey =
      typeof metadata.block_key === "string" ? metadata.block_key : "unassigned";
    const entries = dimensionMetadataByBlock.get(blockKey) ?? [];
    entries.push({
      code: dimension.code,
      display_order: dimension.display_order,
      ...metadata,
    });
    dimensionMetadataByBlock.set(blockKey, entries);
  }

  for (const [index, blockKey] of orderedBlockKeys.entries()) {
    const blockQuestionRows = [...(questionsByBlock.get(blockKey) ?? [])].sort(compareByOrder);
    const blockSpec = coerceRecord(contentSpecBlocks[blockKey]);
    const blockMetadata: JsonRecord = {
      ...blockSpec,
      dimensionMetadata: dimensionMetadataByBlock.get(blockKey) ?? [],
    };
    const blockType = inferBlockType({
      blockKey,
      questionRows: blockQuestionRows,
      blockMetadata,
    });
    const title =
      typeof blockSpec.display_name === "string" && blockSpec.display_name.length > 0
        ? blockSpec.display_name
        : blockKey;

    blocks.push({
      blockKey,
      blockType,
      displayOrder: index + 1,
      title,
      itemCodes: blockQuestionRows.map((question) => question.code),
      itemCount: blockQuestionRows.length,
      metadata: blockMetadata,
    });

    for (const question of blockQuestionRows) {
      const metadata = coerceRecord(question.metadata);
      const responseFormat =
        typeof metadata.response_format === "string" ? metadata.response_format : null;
      const options = [...(optionsByQuestionId.get(question.id) ?? [])]
        .sort(compareByOrder)
        .map((option) => ({
          optionId: option.id,
          code: option.code,
          label: getLocalizedOptionLabel(option, localizedRowsByOptionId, locale),
          value: option.value,
          order: option.option_order,
          metadata: coerceRecord(option.metadata),
        }));
      const item: TeamDynamicsMixedRuntimeHandoffItem = {
        questionId: question.id,
        code: question.code,
        order: question.question_order,
        blockKey,
        responseFormat,
        questionType: question.question_type,
        localizedText: getLocalizedQuestionText(
          question,
          localizedRowsByQuestionId,
          locale,
        ),
        metadata,
        options,
      };

      if (blockType === "sjt_best_worst") {
        if (responseFormat !== "best_worst") {
          unsupportedItems.push({
            questionId: question.id,
            code: question.code,
            blockKey,
            reason: "sjt_item_missing_best_worst_response_format",
          });
          warnings.push(
            `SJT item ${question.code} is missing response_format="best_worst".`,
          );
        }

        if (options.length !== 4) {
          unsupportedItems.push({
            questionId: question.id,
            code: question.code,
            blockKey,
            reason: "sjt_item_missing_four_options",
          });
          warnings.push(`SJT item ${question.code} does not have exactly 4 options.`);
        }
      } else if (blockType === "likert") {
        if (responseFormat !== "single_select_likert") {
          unsupportedItems.push({
            questionId: question.id,
            code: question.code,
            blockKey,
            reason: "likert_item_missing_single_select_response_format",
          });
          warnings.push(
            `Likert item ${question.code} is missing response_format="single_select_likert".`,
          );
        }

        if (
          options.length !== 4 ||
          options.some((option) => option.value !== 1 && option.value !== 2 && option.value !== 3 && option.value !== 4)
        ) {
          unsupportedItems.push({
            questionId: question.id,
            code: question.code,
            blockKey,
            reason: "likert_item_invalid_option_catalog",
          });
          warnings.push(
            `Likert item ${question.code} does not have a 4-option 1-4 catalog.`,
          );
        }
      } else {
        unsupportedItems.push({
          questionId: question.id,
          code: question.code,
          blockKey,
          reason: "unsupported_block_type",
        });
        warnings.push(`Item ${question.code} belongs to unsupported block ${blockKey}.`);
      }

      items.push(item);
    }
  }

  return {
    testSlug: input.testRow.slug,
    assessmentKey:
      typeof assessmentSpec.assessment_key === "string"
        ? assessmentSpec.assessment_key
        : typeof testMetadata.assessment_key === "string"
          ? testMetadata.assessment_key
          : null,
    importMode:
      typeof testMetadata.import_mode === "string" ? testMetadata.import_mode : null,
    locale,
    scoringMethod: input.testRow.scoring_method,
    blockCount: blocks.length,
    itemCount: items.length,
    likertItemCount: items.filter(
      (item) => item.responseFormat === "single_select_likert",
    ).length,
    sjtScenarioCount: items.filter((item) => item.responseFormat === "best_worst").length,
    outcomePulseItemCount: items.filter((item) => item.blockKey === "outcome_pulse").length,
    blocks,
    items,
    unsupportedItems,
    warnings,
  };
}

export async function loadTeamDynamicsMixedRuntimeDbSnapshot(input?: {
  locale?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const locale = normalizeAssessmentLocale(input?.locale);
  const { data: testRow, error: testError } = await supabase
    .from("tests")
    .select("id, slug, scoring_method, metadata")
    .eq("slug", TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG)
    .maybeSingle();

  if (testError) {
    throw new Error(
      `Failed to load Team Dynamics mixed-format test row: ${testError.message}`,
    );
  }

  if (!testRow?.id) {
    throw new Error(
      `Team Dynamics mixed-format test ${TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG} is not imported.`,
    );
  }

  const [{ data: dimensionRows, error: dimensionError }, { data: questionRows, error: questionError }] =
    await Promise.all([
      supabase
        .from("test_dimensions")
        .select("code, display_order, metadata")
        .eq("test_id", testRow.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("questions")
        .select("id, code, text, question_order, question_type, metadata")
        .eq("test_id", testRow.id)
        .eq("is_active", true)
        .order("question_order", { ascending: true }),
    ]);

  if (dimensionError) {
    throw new Error(
      `Failed to load Team Dynamics mixed-format dimensions: ${dimensionError.message}`,
    );
  }

  if (questionError) {
    throw new Error(
      `Failed to load Team Dynamics mixed-format questions: ${questionError.message}`,
    );
  }

  const questionIds = (questionRows ?? []).map((question) => question.id);
  const localeFallbacks = getAssessmentLocaleFallbacks(locale);
  const questionLocalizationChunks = await Promise.all(
    chunkValues(questionIds, LOCALIZATION_QUERY_CHUNK_SIZE).map(async (questionIdChunk) => {
      if (questionIdChunk.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from("question_localizations")
        .select("question_id, locale, text")
        .in("question_id", questionIdChunk)
        .in("locale", localeFallbacks);

      if (error) {
        throw new Error(
          `Failed to load Team Dynamics question localizations: ${error.message}`,
        );
      }

      return (data ?? []) as QuestionLocalizationRow[];
    }),
  );

  const { data: optionRows, error: optionError } = await supabase
    .from("answer_options")
    .select("id, question_id, code, label, value, option_order, metadata")
    .in("question_id", questionIds)
    .order("question_id", { ascending: true })
    .order("option_order", { ascending: true });

  if (optionError) {
    throw new Error(
      `Failed to load Team Dynamics mixed-format answer options: ${optionError.message}`,
    );
  }

  const optionIds = (optionRows ?? []).map((option) => option.id);
  const optionLocalizationChunks = await Promise.all(
    chunkValues(optionIds, LOCALIZATION_QUERY_CHUNK_SIZE).map(async (optionIdChunk) => {
      if (optionIdChunk.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from("answer_option_localizations")
        .select("answer_option_id, locale, label")
        .in("answer_option_id", optionIdChunk)
        .in("locale", localeFallbacks);

      if (error) {
        throw new Error(
          `Failed to load Team Dynamics answer option localizations: ${error.message}`,
        );
      }

      return (data ?? []) as AnswerOptionLocalizationRow[];
    }),
  );

  return {
    testRow: testRow as TeamDynamicsTestRow,
    dimensionRows: (dimensionRows ?? []) as TeamDynamicsDimensionRow[],
    questionRows: (questionRows ?? []) as TeamDynamicsQuestionRow[],
    optionRows: (optionRows ?? []) as TeamDynamicsOptionRow[],
    questionLocalizations: questionLocalizationChunks.flat(),
    optionLocalizations: optionLocalizationChunks.flat(),
    locale,
  } satisfies TeamDynamicsMixedRuntimeDbSnapshot;
}

export async function loadTeamDynamicsMixedRuntimeHandoff(input?: {
  locale?: string | null;
}): Promise<TeamDynamicsMixedRuntimeHandoff> {
  const snapshot = await loadTeamDynamicsMixedRuntimeDbSnapshot(input);
  return buildTeamDynamicsMixedRuntimeHandoff(snapshot);
}
