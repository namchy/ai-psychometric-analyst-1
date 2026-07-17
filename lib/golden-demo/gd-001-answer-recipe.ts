export const GD_001_ANSWER_RECIPE_VERSION = "gd_001_answer_recipe_v1";

export const GD_001_IPIP_FACET_TARGET_SUMS = {
  ANXIETY: 9,
  ANGER: 7,
  DEPRESSION: 7,
  SELF_CONSCIOUSNESS: 10,
  IMMODERATION: 8,
  VULNERABILITY: 10,
  FRIENDLINESS: 16,
  GREGARIOUSNESS: 11,
  ASSERTIVENESS: 13,
  ACTIVITY_LEVEL: 15,
  EXCITEMENT_SEEKING: 9,
  CHEERFULNESS: 15,
  IMAGINATION: 12,
  ARTISTIC_INTERESTS: 9,
  EMOTIONALITY: 12,
  ADVENTUROUSNESS: 14,
  INTELLECT: 15,
  LIBERALISM: 12,
  TRUST: 14,
  MORALITY: 17,
  ALTRUISM: 16,
  COOPERATION: 17,
  MODESTY: 13,
  SYMPATHY: 16,
  SELF_EFFICACY: 17,
  ORDERLINESS: 16,
  DUTIFULNESS: 18,
  ACHIEVEMENT_STRIVING: 16,
  SELF_DISCIPLINE: 17,
  CAUTIOUSNESS: 16,
} as const;

export const GD_001_MWMS_ITEM_VALUES = {
  MWMS_01: 1,
  MWMS_02: 1,
  MWMS_03: 2,
  MWMS_04: 2,
  MWMS_05: 2,
  MWMS_06: 3,
  MWMS_07: 4,
  MWMS_08: 4,
  MWMS_09: 5,
  MWMS_10: 4,
  MWMS_11: 5,
  MWMS_12: 3,
  MWMS_13: 4,
  MWMS_14: 6,
  MWMS_15: 7,
  MWMS_16: 6,
  MWMS_17: 6,
  MWMS_18: 5,
  MWMS_19: 6,
} as const;

export const GD_001_SAFRAN_CORRECT_QUOTAS = {
  VW: 7,
  VA: 7,
  FA: 5,
  FM: 5,
  NZ: 7,
} as const;

export type GoldenDemoAnswerRecord = {
  candidate_id: string;
  test_slug: "ipip-neo-120-v1" | "mwms_v1" | "safran_v1";
  question_code: string;
  response_kind: "single_choice" | "text";
  answer_value: string;
  answer_option_code: string;
  recipe_note: string;
  recipe_version: typeof GD_001_ANSWER_RECIPE_VERSION;
};

type PackageItem = {
  code: string;
  question_order: number;
  mappings: Array<{
    dimension_code: string;
    reverse_scored: boolean;
  }>;
};

type PackageOption = { code: string; value: number };

type SafranItem = {
  item_id: string;
  subtest_code: keyof typeof GD_001_SAFRAN_CORRECT_QUOTAS;
  renderer_type: "text_choice" | "image_choice" | "numeric_input";
  display_order: number;
  options?: Array<{ option_id: string; is_correct: boolean }>;
  correct_answer_display: string;
};

function distributeFacetSum(targetSum: number, itemCount: number): number[] {
  const base = Math.floor(targetSum / itemCount);
  const remainder = targetSum % itemCount;
  const values = Array.from({ length: itemCount }, (_, index) => base + (index < remainder ? 1 : 0));

  if (values.some((value) => value < 1 || value > 5)) {
    throw new Error(`IPIP target sum ${targetSum} is not realizable across ${itemCount} items.`);
  }

  return values;
}

export function buildGd001AnswerRecipe(input: {
  ipipItems: PackageItem[];
  ipipOptions: PackageOption[];
  mwmsItems: PackageItem[];
  safranItems: SafranItem[];
}): GoldenDemoAnswerRecord[] {
  const ipipOptionByValue = new Map(input.ipipOptions.map((option) => [option.value, option.code]));
  const ipipItemsByFacet = new Map<string, PackageItem[]>();

  for (const item of input.ipipItems) {
    const facet = item.mappings[0]?.dimension_code;
    if (!facet) {
      throw new Error(`IPIP item ${item.code} is missing its facet mapping.`);
    }
    ipipItemsByFacet.set(facet, [...(ipipItemsByFacet.get(facet) ?? []), item]);
  }

  const ipipScoredValueByCode = new Map<string, number>();
  for (const [facet, targetSum] of Object.entries(GD_001_IPIP_FACET_TARGET_SUMS)) {
    const items = [...(ipipItemsByFacet.get(facet) ?? [])].sort(
      (left, right) => left.question_order - right.question_order,
    );
    if (items.length !== 4) {
      throw new Error(`GD-001 IPIP recipe expected four items for ${facet}, received ${items.length}.`);
    }
    const scoredValues = distributeFacetSum(targetSum, items.length);
    items.forEach((item, index) => ipipScoredValueByCode.set(item.code, scoredValues[index]));
  }

  const ipipAnswers = [...input.ipipItems]
    .sort((left, right) => left.question_order - right.question_order)
    .map<GoldenDemoAnswerRecord>((item) => {
      const mapping = item.mappings[0];
      const scoredValue = ipipScoredValueByCode.get(item.code);
      if (!mapping || scoredValue === undefined) {
        throw new Error(`IPIP recipe target is missing for ${item.code}.`);
      }
      const rawValue = mapping.reverse_scored ? 6 - scoredValue : scoredValue;
      const optionCode = ipipOptionByValue.get(rawValue);
      if (!optionCode) {
        throw new Error(`IPIP raw value ${rawValue} has no option code.`);
      }
      return {
        candidate_id: "GD-001",
        test_slug: "ipip-neo-120-v1",
        question_code: item.code,
        response_kind: "single_choice",
        answer_value: "",
        answer_option_code: optionCode,
        recipe_note: `facet=${mapping.dimension_code};target_sum=${GD_001_IPIP_FACET_TARGET_SUMS[mapping.dimension_code as keyof typeof GD_001_IPIP_FACET_TARGET_SUMS]}`,
        recipe_version: GD_001_ANSWER_RECIPE_VERSION,
      };
    });

  const mwmsAnswers = [...input.mwmsItems]
    .sort((left, right) => left.question_order - right.question_order)
    .map<GoldenDemoAnswerRecord>((item) => {
      const value = GD_001_MWMS_ITEM_VALUES[item.code as keyof typeof GD_001_MWMS_ITEM_VALUES];
      if (value === undefined) {
        throw new Error(`MWMS recipe value is missing for ${item.code}.`);
      }
      return {
        candidate_id: "GD-001",
        test_slug: "mwms_v1",
        question_code: item.code,
        response_kind: "single_choice",
        answer_value: "",
        answer_option_code: `MWMS_LIKERT_${value}`,
        recipe_note: `dimension=${item.mappings[0]?.dimension_code ?? "unknown"}`,
        recipe_version: GD_001_ANSWER_RECIPE_VERSION,
      };
    });

  const subtestIndex = new Map<string, number>();
  const safranAnswers = [...input.safranItems]
    .sort((left, right) => left.display_order - right.display_order)
    .map<GoldenDemoAnswerRecord>((item) => {
      const index = subtestIndex.get(item.subtest_code) ?? 0;
      subtestIndex.set(item.subtest_code, index + 1);
      const shouldBeCorrect = index < GD_001_SAFRAN_CORRECT_QUOTAS[item.subtest_code];
      const recipeNote = `subtest=${item.subtest_code};target_correct=${GD_001_SAFRAN_CORRECT_QUOTAS[item.subtest_code]}`;

      if (item.renderer_type === "numeric_input") {
        const correctValue = Number(item.correct_answer_display);
        if (!Number.isFinite(correctValue)) {
          throw new Error(`SAFRAN numeric correct answer is invalid for ${item.item_id}.`);
        }
        return {
          candidate_id: "GD-001",
          test_slug: "safran_v1",
          question_code: item.item_id,
          response_kind: "text",
          answer_value: shouldBeCorrect ? String(correctValue) : String(correctValue + 1),
          answer_option_code: "",
          recipe_note: recipeNote,
          recipe_version: GD_001_ANSWER_RECIPE_VERSION,
        };
      }

      const selectedOption = shouldBeCorrect
        ? item.options?.find((option) => option.is_correct)
        : item.options?.find((option) => !option.is_correct);
      if (!selectedOption) {
        throw new Error(`SAFRAN recipe cannot resolve a ${shouldBeCorrect ? "correct" : "wrong"} option for ${item.item_id}.`);
      }
      return {
        candidate_id: "GD-001",
        test_slug: "safran_v1",
        question_code: item.item_id,
        response_kind: "single_choice",
        answer_value: "",
        answer_option_code: selectedOption.option_id,
        recipe_note: recipeNote,
        recipe_version: GD_001_ANSWER_RECIPE_VERSION,
      };
    });

  return [...ipipAnswers, ...mwmsAnswers, ...safranAnswers];
}
