import type { QuestionType, ScoringMethod } from "@/lib/assessment/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AttemptRecord = {
  id: string;
  status: "in_progress" | "completed" | "abandoned";
};

type TestRecord = {
  id: string;
  slug: string;
  scoring_method: ScoringMethod;
};

type QuestionRecord = {
  id: string;
  code: string;
  text: string;
  dimension: string | null;
  question_type: QuestionType;
  question_order: number;
  reverse_scored: boolean;
  weight: number;
};

type TestDimensionRecord = {
  id: string;
  code: string;
  display_order: number;
};

type QuestionDimensionMappingRecord = {
  question_id: string;
  dimension_id: string;
  weight: number;
  reverse_scored: boolean;
};

type AnswerOptionRecord = {
  id: string;
  question_id: string;
  value: number | null;
};

type ResponseRecord = {
  id: string;
  question_id: string;
  response_kind: QuestionType;
  answer_option_id: string | null;
  raw_value: number | null;
  scored_value: number | null;
};

export type CompletedAssessmentResultDimension = {
  dimension: string;
  rawScore: number;
  scoredQuestionCount: number;
};

export type CompletedAssessmentUnscoredResponse = {
  questionId: string;
  questionCode: string;
  questionText: string;
  questionType: QuestionType;
  reason: "question_type_not_scoreable" | "missing_numeric_option_value";
};

export type CompletedAssessmentResults = {
  attemptId: string;
  scoringMethod: ScoringMethod;
  dimensions: CompletedAssessmentResultDimension[];
  scoredResponseCount: number;
  unscoredResponses: CompletedAssessmentUnscoredResponse[];
  derived?: CompletedAssessmentDerivedResults;
};

export type IpcOctantCode = "PA" | "BC" | "DE" | "FG" | "HI" | "JK" | "LM" | "NO";

export type IpcPrimaryDisc = "D" | "I" | "S" | "C" | null;

export type IpcDerivedResults = {
  dominance: number;
  warmth: number;
  primaryDisc: IpcPrimaryDisc;
  dominantOctant: IpcOctantCode | null;
  secondaryOctant: IpcOctantCode | null;
};

export type CompletedAssessmentDerivedResults = {
  ipc: IpcDerivedResults;
};

type ComputedResponseScore = {
  responseId: string;
  rawValue: number | null;
  scoredValue: number | null;
};

type ComputedDimensionScore = {
  dimension: string;
  rawScore: number;
  scoredQuestionCount: number;
  sortOrder: number;
};

type QuestionDimensionContribution = {
  dimension: string;
  weight: number;
  reverseScored: boolean;
  sortOrder: number;
};

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

const IPC_TEST_SLUG = "ipip-ipc-v1";
const IPC_OCTANT_ORDER: IpcOctantCode[] = ["PA", "BC", "DE", "FG", "HI", "JK", "LM", "NO"];

function isIpcTestSlug(testSlug: string): boolean {
  return testSlug === IPC_TEST_SLUG;
}

function getDimensionScoreByCode(
  dimensions: CompletedAssessmentResultDimension[],
): Map<string, CompletedAssessmentResultDimension> {
  return new Map(dimensions.map((dimension) => [dimension.dimension, dimension]));
}

function getIpcOctantRawScore(
  dimensionsByCode: Map<string, CompletedAssessmentResultDimension>,
  octant: IpcOctantCode,
): number {
  return dimensionsByCode.get(octant)?.rawScore ?? 0;
}

function getIpcPrimaryDisc(dominance: number, warmth: number): IpcPrimaryDisc {
  if (dominance === 0 && warmth === 0) {
    return null;
  }

  if (dominance > 0 && warmth < 0) {
    return "D";
  }

  if (dominance > 0 && warmth > 0) {
    return "I";
  }

  if (dominance < 0 && warmth > 0) {
    return "S";
  }

  if (dominance < 0 && warmth < 0) {
    return "C";
  }

  return null;
}

function getTopIpcOctants(
  dimensionsByCode: Map<string, CompletedAssessmentResultDimension>,
): Pick<IpcDerivedResults, "dominantOctant" | "secondaryOctant"> {
  const rankedOctants = [...IPC_OCTANT_ORDER].sort((left, right) => {
    return (
      getIpcOctantRawScore(dimensionsByCode, right) - getIpcOctantRawScore(dimensionsByCode, left) ||
      IPC_OCTANT_ORDER.indexOf(left) - IPC_OCTANT_ORDER.indexOf(right)
    );
  });

  return {
    dominantOctant: rankedOctants[0] ?? null,
    secondaryOctant: rankedOctants[1] ?? null,
  };
}

function calculateIpcDerivedResults(
  dimensions: CompletedAssessmentResultDimension[],
): IpcDerivedResults {
  const dimensionsByCode = getDimensionScoreByCode(dimensions);
  const PA = getIpcOctantRawScore(dimensionsByCode, "PA");
  const BC = getIpcOctantRawScore(dimensionsByCode, "BC");
  const DE = getIpcOctantRawScore(dimensionsByCode, "DE");
  const FG = getIpcOctantRawScore(dimensionsByCode, "FG");
  const HI = getIpcOctantRawScore(dimensionsByCode, "HI");
  const JK = getIpcOctantRawScore(dimensionsByCode, "JK");
  const LM = getIpcOctantRawScore(dimensionsByCode, "LM");
  const NO = getIpcOctantRawScore(dimensionsByCode, "NO");

  const dominance = roundScore(PA - HI + 0.707 * (BC + NO - FG - JK));
  const warmth = roundScore(LM - DE + 0.707 * (NO + JK - BC - FG));
  const { dominantOctant, secondaryOctant } = getTopIpcOctants(dimensionsByCode);

  return {
    dominance,
    warmth,
    primaryDisc: getIpcPrimaryDisc(dominance, warmth),
    dominantOctant,
    secondaryOctant,
  };
}

function buildCompletedAssessmentResults(
  attemptId: string,
  scoringMethod: ScoringMethod,
  testSlug: string,
  computedResults: {
    dimensions: ComputedDimensionScore[];
    scoredResponseCount: number;
    unscoredResponses: CompletedAssessmentUnscoredResponse[];
  },
): CompletedAssessmentResults {
  const dimensions = computedResults.dimensions.map((dimension) => ({
    dimension: dimension.dimension,
    rawScore: dimension.rawScore,
    scoredQuestionCount: dimension.scoredQuestionCount,
  }));

  return {
    attemptId,
    scoringMethod,
    dimensions,
    scoredResponseCount: computedResults.scoredResponseCount,
    unscoredResponses: computedResults.unscoredResponses,
    derived: isIpcTestSlug(testSlug)
      ? {
          ipc: calculateIpcDerivedResults(dimensions),
        }
      : undefined,
  };
}

function valuesEqual(left: number | null, right: number | null): boolean {
  if (left === null || right === null) {
    return left === right;
  }

  return roundScore(left) === roundScore(right);
}

function getLikertScaleBounds(options: AnswerOptionRecord[]): { min: number; max: number } | null {
  const numericValues = options
    .map((option) => option.value)
    .filter((value): value is number => typeof value === "number");

  if (numericValues.length === 0) {
    return null;
  }

  return {
    min: Math.min(...numericValues),
    max: Math.max(...numericValues),
  };
}

function computeLikertResults(
  questions: QuestionRecord[],
  answerOptions: AnswerOptionRecord[],
  responses: ResponseRecord[],
  dimensionContributionsByQuestionId?: Map<string, QuestionDimensionContribution[]>,
): {
  responseScores: ComputedResponseScore[];
  dimensions: ComputedDimensionScore[];
  scoredResponseCount: number;
  unscoredResponses: CompletedAssessmentUnscoredResponse[];
} {
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const optionsById = new Map(answerOptions.map((option) => [option.id, option]));
  const answerOptionsByQuestionId = answerOptions.reduce<Map<string, AnswerOptionRecord[]>>(
    (groupedOptions, option) => {
      const questionOptions = groupedOptions.get(option.question_id) ?? [];
      questionOptions.push(option);
      groupedOptions.set(option.question_id, questionOptions);
      return groupedOptions;
    },
    new Map<string, AnswerOptionRecord[]>(),
  );

  const dimensionsByName = new Map<string, ComputedDimensionScore>();
  const responseScores: ComputedResponseScore[] = [];
  const unscoredResponses: CompletedAssessmentUnscoredResponse[] = [];
  let scoredResponseCount = 0;

  for (const response of responses) {
    const question = questionsById.get(response.question_id);

    if (!question) {
      continue;
    }

    if (response.response_kind !== "single_choice") {
      responseScores.push({
        responseId: response.id,
        rawValue: null,
        scoredValue: null,
      });
      unscoredResponses.push({
        questionId: question.id,
        questionCode: question.code,
        questionText: question.text,
        questionType: question.question_type,
        reason: "question_type_not_scoreable",
      });
      continue;
    }

    const selectedOption = response.answer_option_id
      ? optionsById.get(response.answer_option_id)
      : null;
    const scaleBounds = getLikertScaleBounds(answerOptionsByQuestionId.get(question.id) ?? []);

    if (!selectedOption || selectedOption.value === null || !scaleBounds) {
      responseScores.push({
        responseId: response.id,
        rawValue: null,
        scoredValue: null,
      });
      unscoredResponses.push({
        questionId: question.id,
        questionCode: question.code,
        questionText: question.text,
        questionType: question.question_type,
        reason: "missing_numeric_option_value",
      });
      continue;
    }

    const rawValue = selectedOption.value;
    const dimensionContributions =
      dimensionContributionsByQuestionId?.get(question.id) ??
      (question.dimension
        ? [
            {
              dimension: question.dimension,
              weight: question.weight,
              reverseScored: question.reverse_scored,
              sortOrder: question.question_order,
            },
          ]
        : []);
    const primaryContribution = dimensionContributions[0];
    const scoredValue = primaryContribution?.reverseScored
      ? scaleBounds.min + scaleBounds.max - rawValue
      : rawValue;

    responseScores.push({
      responseId: response.id,
      rawValue,
      scoredValue,
    });

    for (const contribution of dimensionContributions) {
      const contributionScore = contribution.reverseScored
        ? scaleBounds.min + scaleBounds.max - rawValue
        : rawValue;
      const dimensionScore = dimensionsByName.get(contribution.dimension) ?? {
        dimension: contribution.dimension,
        rawScore: 0,
        scoredQuestionCount: 0,
        sortOrder: contribution.sortOrder,
      };

      dimensionScore.rawScore = roundScore(
        dimensionScore.rawScore + contributionScore * contribution.weight,
      );
      dimensionScore.scoredQuestionCount += 1;
      dimensionScore.sortOrder = Math.min(dimensionScore.sortOrder, contribution.sortOrder);
      dimensionsByName.set(contribution.dimension, dimensionScore);
    }

    scoredResponseCount += 1;
  }

  return {
    responseScores,
    dimensions: [...dimensionsByName.values()].sort((left, right) => left.sortOrder - right.sortOrder),
    scoredResponseCount,
    unscoredResponses,
  };
}

async function loadScoringInputs(testId: string, attemptId: string) {
  const supabase = createSupabaseAdminClient();

  const { data: attemptData, error: attemptError } = await supabase
    .from("attempts")
    .select("id, status")
    .eq("id", attemptId)
    .eq("test_id", testId)
    .maybeSingle();

  if (attemptError) {
    throw new Error(`Failed to load attempt for scoring: ${attemptError.message}`);
  }

  const attempt = attemptData as AttemptRecord | null;

  if (!attempt || attempt.status !== "completed") {
    return null;
  }

  const { data: testData, error: testError } = await supabase
    .from("tests")
    .select("id, slug, scoring_method")
    .eq("id", testId)
    .single();

  if (testError || !testData) {
    throw new Error(
      `Failed to load test scoring configuration: ${testError?.message ?? "Unknown error"}`,
    );
  }

  const { data: questionsData, error: questionsError } = await supabase
    .from("questions")
    .select("id, code, text, dimension, question_type, question_order, reverse_scored, weight")
    .eq("test_id", testId)
    .order("question_order", { ascending: true });

  if (questionsError) {
    throw new Error(`Failed to load questions for scoring: ${questionsError.message}`);
  }

  const questions = (questionsData ?? []) as QuestionRecord[];
  const questionIds = questions.map((question) => question.id);
  const { data: testDimensionsData, error: testDimensionsError } = await supabase
    .from("test_dimensions")
    .select("id, code, display_order")
    .eq("test_id", testId)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("code", { ascending: true });

  if (testDimensionsError) {
    throw new Error(`Failed to load test dimensions for scoring: ${testDimensionsError.message}`);
  }

  const testDimensions = (testDimensionsData ?? []) as TestDimensionRecord[];
  const testDimensionIds = testDimensions.map((dimension) => dimension.id);
  let questionDimensionMappings: QuestionDimensionMappingRecord[] = [];

  if (questionIds.length > 0 && testDimensionIds.length > 0) {
    const { data: mappingsData, error: mappingsError } = await supabase
      .from("question_dimension_mappings")
      .select("question_id, dimension_id, weight, reverse_scored")
      .in("question_id", questionIds)
      .in("dimension_id", testDimensionIds);

    if (mappingsError) {
      throw new Error(`Failed to load question dimension mappings: ${mappingsError.message}`);
    }

    questionDimensionMappings = (mappingsData ?? []) as QuestionDimensionMappingRecord[];
  }

  const { data: answerOptionsData, error: answerOptionsError } = await supabase
    .from("answer_options")
    .select("id, question_id, value")
    .in("question_id", questionIds);

  if (answerOptionsError) {
    throw new Error(`Failed to load answer options for scoring: ${answerOptionsError.message}`);
  }

  const { data: responsesData, error: responsesError } = await supabase
    .from("responses")
    .select("id, question_id, response_kind, answer_option_id, raw_value, scored_value")
    .eq("attempt_id", attemptId);

  if (responsesError) {
    throw new Error(`Failed to load responses for scoring: ${responsesError.message}`);
  }

  return {
    supabase,
    test: testData as TestRecord,
    questions,
    testDimensions,
    questionDimensionMappings,
    answerOptions: (answerOptionsData ?? []) as AnswerOptionRecord[],
    responses: (responsesData ?? []) as ResponseRecord[],
  };
}

function buildMappingContributionsByQuestionId(
  questions: QuestionRecord[],
  testDimensions: TestDimensionRecord[],
  questionDimensionMappings: QuestionDimensionMappingRecord[],
): Map<string, QuestionDimensionContribution[]> | null {
  if (questionDimensionMappings.length === 0) {
    return null;
  }

  const sortOrderByQuestionId = new Map(
    questions.map((question) => [question.id, question.question_order]),
  );
  const dimensionsById = new Map(testDimensions.map((dimension) => [dimension.id, dimension]));
  const contributionsByQuestionId = new Map<string, QuestionDimensionContribution[]>();

  for (const mapping of questionDimensionMappings) {
    const dimension = dimensionsById.get(mapping.dimension_id);

    if (!dimension) {
      continue;
    }

    const contributions = contributionsByQuestionId.get(mapping.question_id) ?? [];
    contributions.push({
      dimension: dimension.code,
      weight: mapping.weight,
      reverseScored: mapping.reverse_scored,
      sortOrder: sortOrderByQuestionId.get(mapping.question_id) ?? dimension.display_order,
    });
    contributionsByQuestionId.set(mapping.question_id, contributions);
  }

  for (const contributions of contributionsByQuestionId.values()) {
    contributions.sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.dimension.localeCompare(right.dimension),
    );
  }

  return contributionsByQuestionId;
}

export async function calculateCompletedAssessmentResults(
  testId: string,
  attemptId: string,
): Promise<CompletedAssessmentResults | null> {
  const scoringInputs = await loadScoringInputs(testId, attemptId);

  if (!scoringInputs) {
    return null;
  }

  if (scoringInputs.test.scoring_method !== "likert_sum") {
    throw new Error(
      `Unsupported scoring method for MVP results flow: ${scoringInputs.test.scoring_method}`,
    );
  }

  const computedResults = computeLikertResults(
    scoringInputs.questions,
    scoringInputs.answerOptions,
    scoringInputs.responses,
    buildMappingContributionsByQuestionId(
      scoringInputs.questions,
      scoringInputs.testDimensions,
      scoringInputs.questionDimensionMappings,
    ) ?? undefined,
  );

  return buildCompletedAssessmentResults(
    attemptId,
    scoringInputs.test.scoring_method,
    scoringInputs.test.slug,
    computedResults,
  );
}

export async function persistCompletedAssessmentResults(
  testId: string,
  attemptId: string,
): Promise<CompletedAssessmentResults | null> {
  const scoringInputs = await loadScoringInputs(testId, attemptId);

  if (!scoringInputs) {
    return null;
  }

  if (scoringInputs.test.scoring_method !== "likert_sum") {
    throw new Error(
      `Unsupported scoring method for MVP results flow: ${scoringInputs.test.scoring_method}`,
    );
  }

  const computedResults = computeLikertResults(
    scoringInputs.questions,
    scoringInputs.answerOptions,
    scoringInputs.responses,
    buildMappingContributionsByQuestionId(
      scoringInputs.questions,
      scoringInputs.testDimensions,
      scoringInputs.questionDimensionMappings,
    ) ?? undefined,
  );

  const responsesById = new Map(scoringInputs.responses.map((response) => [response.id, response]));
  const responseUpdates = computedResults.responseScores.filter((score) => {
    const existingResponse = responsesById.get(score.responseId);

    if (!existingResponse) {
      return false;
    }

    return (
      !valuesEqual(existingResponse.raw_value, score.rawValue) ||
      !valuesEqual(existingResponse.scored_value, score.scoredValue)
    );
  });

  for (const responseUpdate of responseUpdates) {
    const { error: responseUpdateError } = await scoringInputs.supabase
      .from("responses")
      .update({
        raw_value: responseUpdate.rawValue,
        scored_value: responseUpdate.scoredValue,
      })
      .eq("id", responseUpdate.responseId);

    if (responseUpdateError) {
      throw new Error(`Failed to persist response score: ${responseUpdateError.message}`);
    }
  }

  const { error: deleteScoresError } = await scoringInputs.supabase
    .from("dimension_scores")
    .delete()
    .eq("attempt_id", attemptId);

  if (deleteScoresError) {
    throw new Error(`Failed to replace dimension scores: ${deleteScoresError.message}`);
  }

  if (computedResults.dimensions.length > 0) {
    const { error: insertScoresError } = await scoringInputs.supabase
      .from("dimension_scores")
      .insert(
        computedResults.dimensions.map((dimension) => ({
          attempt_id: attemptId,
          dimension: dimension.dimension,
          raw_score: dimension.rawScore,
          normalized_score: null,
          percentile_score: null,
          interpretation: null,
        })),
      );

    if (insertScoresError) {
      throw new Error(`Failed to persist dimension scores: ${insertScoresError.message}`);
    }
  }

  return buildCompletedAssessmentResults(
    attemptId,
    scoringInputs.test.scoring_method,
    scoringInputs.test.slug,
    computedResults,
  );
}
