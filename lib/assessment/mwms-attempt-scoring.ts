import {
  MWMS_DIMENSION_CODES,
  MWMS_ITEM_CODES,
  MWMS_REQUIRED_ITEM_COUNT,
  MWMS_V1_TEST_SLUG,
  scoreMwmsV1Responses,
  type MwmsScoringCompleteResult,
  type MwmsScoringErrorCode,
  type MwmsScoringInvalidResult,
} from "./mwms-scoring";

export type MwmsResponseInput = {
  questionCode: string;
  value: number;
};

export type MwmsAttemptScoringErrorCode =
  | MwmsScoringErrorCode
  | "response_count_mismatch"
  | "duplicate_question_code"
  | "response_mapping_error";

export type MwmsAttemptScoringInvalidResult = {
  testSlug: typeof MWMS_V1_TEST_SLUG;
  isComplete: false;
  error: {
    code: MwmsAttemptScoringErrorCode;
    message: string;
    details: string[];
  };
};

export type MwmsAttemptScoringResult =
  | MwmsScoringCompleteResult
  | MwmsScoringInvalidResult
  | MwmsAttemptScoringInvalidResult;

export type MwmsAttemptDimensionScoreWriteResult = {
  scoringResult: MwmsScoringCompleteResult;
  writtenDimensionScoreCount: number;
};

function buildInvalidResult(
  code: MwmsAttemptScoringErrorCode,
  message: string,
  details: string[],
): MwmsAttemptScoringInvalidResult {
  return {
    testSlug: MWMS_V1_TEST_SLUG,
    isComplete: false,
    error: {
      code,
      message,
      details,
    },
  };
}

export function scoreMwmsAttemptResponses(
  responses: MwmsResponseInput[],
): MwmsAttemptScoringResult {
  if (responses.length !== MWMS_REQUIRED_ITEM_COUNT) {
    return buildInvalidResult(
      "response_count_mismatch",
      "MWMS attempt scoring requires exactly 19 responses.",
      [
        `Expected ${MWMS_REQUIRED_ITEM_COUNT} MWMS responses, received ${responses.length}.`,
      ],
    );
  }

  const responseByQuestionCode: Record<string, number> = {};
  const seenQuestionCodes = new Set<string>();

  for (const response of responses) {
    const questionCode = response.questionCode;

    if (seenQuestionCodes.has(questionCode)) {
      return buildInvalidResult(
        "duplicate_question_code",
        "MWMS attempt scoring received duplicate question codes.",
        [`Duplicate MWMS question code: ${questionCode}`],
      );
    }

    seenQuestionCodes.add(questionCode);
    responseByQuestionCode[questionCode] = response.value;
  }

  const unknownQuestionCodes = responses
    .map((response) => response.questionCode)
    .filter((questionCode) => !MWMS_ITEM_CODES.includes(questionCode as (typeof MWMS_ITEM_CODES)[number]));

  if (unknownQuestionCodes.length > 0) {
    return buildInvalidResult(
      "unknown_item",
      "MWMS attempt scoring received unknown question codes.",
      unknownQuestionCodes.map((questionCode) => `Unknown MWMS question code: ${questionCode}`),
    );
  }

  const invalidValues = responses.filter(
    (response) => !Number.isInteger(response.value) || response.value < 1 || response.value > 7,
  );

  if (invalidValues.length > 0) {
    return buildInvalidResult(
      "invalid_value",
      "MWMS attempt scoring accepts only integer response values from 1 to 7.",
      invalidValues.map(
        (response) =>
          `Invalid MWMS response value for ${response.questionCode}: expected integer 1-7, received ${String(response.value)}`,
      ),
    );
  }

  return scoreMwmsV1Responses(responseByQuestionCode);
}

type SupabaseLikeClient = {
  from(table: string): any;
};

type AttemptLookupRow = {
  id: string;
  test_id: string;
};

type TestLookupRow = {
  id: string;
  slug: string;
};

type ResponseLookupRow = {
  question_id: string;
  answer_option_id: string | null;
  raw_value: number | null;
};

type QuestionLookupRow = {
  id: string;
  code: string;
};

type AnswerOptionLookupRow = {
  id: string;
  value: number | null;
};

function executeListQuery<T>(query: Promise<{
  data: T[] | null;
  error: { message: string } | null;
}> | { then: Promise<{ data: T[] | null; error: { message: string } | null }>["then"] }) {
  return Promise.resolve(query);
}

function executeWriteQuery<T>(query: Promise<{
  data: T[] | null;
  error: { message: string } | null;
}> | { then: Promise<{ data: T[] | null; error: { message: string } | null }>["then"] }) {
  return Promise.resolve(query);
}

export async function scoreMwmsAttemptResponsesFromDatabase(
  supabase: SupabaseLikeClient,
  attemptId: string,
): Promise<MwmsAttemptScoringResult> {
  const { data: attemptData, error: attemptError } = await supabase
    .from("attempts")
    .select("id, test_id")
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptError) {
    throw new Error(`Failed to load MWMS attempt: ${attemptError.message}`);
  }

  const attempt = attemptData as AttemptLookupRow | null;

  if (!attempt) {
    throw new Error(`MWMS attempt not found: ${attemptId}`);
  }

  const { data: testData, error: testError } = await supabase
    .from("tests")
    .select("id, slug")
    .eq("id", attempt.test_id)
    .single();

  if (testError) {
    throw new Error(`Failed to load MWMS attempt test: ${testError.message}`);
  }

  const test = testData as TestLookupRow | null;

  if (!test || test.slug !== MWMS_V1_TEST_SLUG) {
    throw new Error(
      `Attempt ${attemptId} does not belong to ${MWMS_V1_TEST_SLUG}.`,
    );
  }

  const { data: responsesData, error: responsesError } = await supabase
    .from("responses")
    .select("question_id, answer_option_id, raw_value")
    .eq("attempt_id", attemptId);

  if (responsesError) {
    throw new Error(`Failed to load MWMS responses: ${responsesError.message}`);
  }

  const responses = ((responsesData ?? []) as ResponseLookupRow[]);
  const questionIds = [...new Set(responses.map((response) => response.question_id))];
  const answerOptionIds = [
    ...new Set(
      responses
        .map((response) => response.answer_option_id)
        .filter((answerOptionId): answerOptionId is string => typeof answerOptionId === "string"),
    ),
  ];

  const questionsFilter = supabase
    .from("questions")
    .select("id, code");
  const questionsQuery =
    questionIds.length > 0 && questionsFilter.in
      ? questionsFilter.in("id", questionIds)
      : questionsFilter;
  const { data: questionsData, error: questionsError } = await executeListQuery(questionsQuery);

  if (questionsError) {
    throw new Error(`Failed to load MWMS questions: ${questionsError.message}`);
  }

  const answerOptionsFilter = supabase
    .from("answer_options")
    .select("id, value");
  const answerOptionsQuery =
    answerOptionIds.length > 0 && answerOptionsFilter.in
      ? answerOptionsFilter.in("id", answerOptionIds)
      : answerOptionsFilter;
  const { data: answerOptionsData, error: answerOptionsError } = await executeListQuery(
    answerOptionsQuery,
  );

  if (answerOptionsError) {
    throw new Error(`Failed to load MWMS answer options: ${answerOptionsError.message}`);
  }

  const questionCodeById = new Map(
    ((questionsData ?? []) as QuestionLookupRow[]).map((question) => [question.id, question.code]),
  );
  const answerOptionValueById = new Map(
    ((answerOptionsData ?? []) as AnswerOptionLookupRow[]).map((option) => [option.id, option.value]),
  );

  const mappingErrors: string[] = [];
  const mappedResponses: MwmsResponseInput[] = [];

  for (const response of responses) {
    const questionCode = questionCodeById.get(response.question_id);

    if (!questionCode) {
      mappingErrors.push(`Missing MWMS question mapping for question_id ${response.question_id}.`);
      continue;
    }

    let value: number | null = null;

    if (response.answer_option_id) {
      value = answerOptionValueById.get(response.answer_option_id) ?? null;

      if (value === null) {
        mappingErrors.push(
          `Missing MWMS answer option value for answer_option_id ${response.answer_option_id}.`,
        );
        continue;
      }
    } else if (typeof response.raw_value === "number") {
      value = response.raw_value;
    } else {
      mappingErrors.push(
        `MWMS response for ${questionCode} is missing both answer_option_id and raw_value.`,
      );
      continue;
    }

    mappedResponses.push({
      questionCode,
      value,
    });
  }

  if (mappingErrors.length > 0) {
    return buildInvalidResult(
      "response_mapping_error",
      "MWMS attempt responses could not be mapped to scoring input.",
      mappingErrors,
    );
  }

  return scoreMwmsAttemptResponses(mappedResponses);
}

export async function writeMwmsAttemptDimensionScores(
  supabase: SupabaseLikeClient,
  attemptId: string,
): Promise<MwmsAttemptDimensionScoreWriteResult> {
  const scoringResult = await scoreMwmsAttemptResponsesFromDatabase(supabase, attemptId);

  if (!scoringResult.isComplete) {
    throw new Error(
      `MWMS attempt scoring did not produce a complete result for ${attemptId}: ${scoringResult.error.message}`,
    );
  }

  const dimensionScoresTable = supabase.from("dimension_scores");

  if (!dimensionScoresTable.delete) {
    throw new Error("Supabase client does not support deleting dimension scores.");
  }

  const deleteQuery = dimensionScoresTable.delete().eq("attempt_id", attemptId);
  const deleteResult = deleteQuery.in
    ? await executeWriteQuery(deleteQuery.in("dimension", MWMS_DIMENSION_CODES))
    : await executeWriteQuery(deleteQuery);

  if (deleteResult.error) {
    throw new Error(
      `Failed to delete existing MWMS dimension scores: ${deleteResult.error.message}`,
    );
  }

  const rowsToInsert = MWMS_DIMENSION_CODES.map((dimensionCode) => ({
    attempt_id: attemptId,
    dimension: dimensionCode,
    raw_score: scoringResult.dimensions[dimensionCode].score,
    normalized_score: null,
    percentile_score: null,
    interpretation: null,
  }));

  const insertTable = supabase.from("dimension_scores");

  if (!insertTable.insert) {
    throw new Error("Supabase client does not support inserting dimension scores.");
  }

  const insertQuery = insertTable.insert(rowsToInsert);
  const insertResult = insertQuery.select
    ? await insertQuery.select("dimension")
    : await executeWriteQuery(insertQuery);

  if (insertResult.error) {
    throw new Error(`Failed to insert MWMS dimension scores: ${insertResult.error.message}`);
  }

  return {
    scoringResult,
    writtenDimensionScoreCount: rowsToInsert.length,
  };
}
