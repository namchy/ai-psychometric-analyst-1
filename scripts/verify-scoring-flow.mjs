import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";

const APP_URL = process.env.APP_URL ?? "http://localhost:3100";
const ATTEMPT_COOKIE_NAME = "assessment_attempt_id";
const HEALTH_URL = `${APP_URL}/api/health`;
const TARGET_TEST_SLUG = process.env.VERIFY_TEST_SLUG ?? "ipip50-hr-v1";
const SCORING_CASES = [
  { code: "E01", optionIndex: 4, expectedRaw: 5, expectedScored: 5, dimension: "Ekstraverzija" },
  { code: "A01", optionIndex: 3, expectedRaw: 4, expectedScored: 2, dimension: "Kooperativnost" },
  { code: "C01", optionIndex: 2, expectedRaw: 3, expectedScored: 3, dimension: "Savjesnost" },
  { code: "ES01", optionIndex: 1, expectedRaw: 2, expectedScored: 4, dimension: "Emocionalna stabilnost" },
  { code: "O01", optionIndex: 0, expectedRaw: 1, expectedScored: 1, dimension: "Intelekt / imaginacija" },
];

function fail(message) {
  throw new Error(message);
}

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    fail(message);
  }
}

function assertNotIncludes(haystack, needle, message) {
  if (haystack.includes(needle)) {
    fail(message);
  }
}

async function fetchAssessmentPage(attemptId) {
  const response = await fetch(APP_URL, {
    headers: {
      cookie: `${ATTEMPT_COOKIE_NAME}=${attemptId}`,
    },
  });

  if (!response.ok) {
    fail(`Page request failed with status ${response.status}.`);
  }

  return response.text();
}

async function waitForServer() {
  let lastDetail = `No response from ${HEALTH_URL}.`;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(HEALTH_URL);

      if (response.ok) {
        return;
      }

      lastDetail = `HTTP ${response.status} from ${HEALTH_URL}.`;
    } catch (error) {
      lastDetail = error instanceof Error ? error.message : String(error);
    }

    await delay(1000);
  }

  fail(`Next.js server did not become ready at ${HEALTH_URL}. Last check: ${lastDetail}`);
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    fail("Missing required Supabase env vars.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  await waitForServer();

  const { data: activeTest, error: activeTestError } = await supabase
    .from("tests")
    .select("id, slug")
    .eq("slug", TARGET_TEST_SLUG)
    .eq("is_active", true)
    .maybeSingle();

  if (activeTestError || !activeTest) {
    fail(`Unable to load active test ${TARGET_TEST_SLUG}: ${activeTestError?.message ?? "Unknown error"}`);
  }

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, code, question_type")
    .eq("test_id", activeTest.id)
    .eq("is_active", true)
    .order("question_order", { ascending: true });

  if (questionsError || !questions) {
    fail(`Unable to load questions: ${questionsError?.message ?? "Unknown error"}`);
  }

  if (!questions.every((question) => question.question_type === "single_choice")) {
    fail("Scoring verification expects the active test to contain only single_choice questions.");
  }

  const questionByCode = new Map(questions.map((question) => [question.code, question]));

  for (const scoringCase of SCORING_CASES) {
    if (!questionByCode.has(scoringCase.code)) {
      fail(`Expected seeded question ${scoringCase.code} was not found.`);
    }
  }

  const { data: answerOptions, error: answerOptionsError } = await supabase
    .from("answer_options")
    .select("id, question_id, option_order")
    .in("question_id", SCORING_CASES.map((scoringCase) => questionByCode.get(scoringCase.code).id))
    .order("question_id", { ascending: true })
    .order("option_order", { ascending: true });

  if (answerOptionsError || !answerOptions) {
    fail(`Unable to load answer options: ${answerOptionsError?.message ?? "Unknown error"}`);
  }

  const answerOptionsByQuestionId = answerOptions.reduce((groupedOptions, option) => {
    const questionOptions = groupedOptions.get(option.question_id) ?? [];
    questionOptions.push(option);
    groupedOptions.set(option.question_id, questionOptions);
    return groupedOptions;
  }, new Map());

  const { data: attemptData, error: attemptError } = await supabase
    .from("attempts")
    .insert({ test_id: activeTest.id, status: "completed", completed_at: new Date().toISOString() })
    .select("id")
    .single();

  if (attemptError || !attemptData) {
    fail(`Unable to create completed attempt: ${attemptError?.message ?? "Unknown error"}`);
  }

  const attemptId = attemptData.id;
  const responseRows = [];

  for (const scoringCase of SCORING_CASES) {
    const question = questionByCode.get(scoringCase.code);
    const options = answerOptionsByQuestionId.get(question.id) ?? [];
    const selectedOption = options[scoringCase.optionIndex];

    if (!selectedOption) {
      fail(`Expected option index ${scoringCase.optionIndex} for ${scoringCase.code}.`);
    }

    responseRows.push({
      attempt_id: attemptId,
      question_id: question.id,
      response_kind: "single_choice",
      answer_option_id: selectedOption.id,
    });
  }

  const { error: responseError } = await supabase.from("responses").insert(responseRows);
  if (responseError) {
    fail(`Unable to create responses: ${responseError.message}`);
  }

  const html = await fetchAssessmentPage(attemptId);
  assertIncludes(html, "Rezultati", "Expected results section to render for a completed attempt.");
  assertIncludes(html, "Broj bodovanih odgovora", "Expected scored response summary to render.");
  for (const scoringCase of SCORING_CASES) {
    assertIncludes(html, scoringCase.dimension, `Expected ${scoringCase.dimension} result to render.`);
  }
  assertNotIncludes(
    html,
    "Zabilježeni, ali nebodovani odgovori",
    "Did not expect unscored response messaging for an all-single_choice test.",
  );

  const { data: scoredResponses, error: scoredResponsesError } = await supabase
    .from("responses")
    .select("question_id, raw_value, scored_value")
    .eq("attempt_id", attemptId);

  if (scoredResponsesError || !scoredResponses) {
    fail(`Unable to reload scored responses: ${scoredResponsesError?.message ?? "Unknown error"}`);
  }

  const scoredResponseByQuestionId = new Map(
    scoredResponses.map((response) => [response.question_id, response]),
  );

  for (const scoringCase of SCORING_CASES) {
    const questionId = questionByCode.get(scoringCase.code).id;
    const response = scoredResponseByQuestionId.get(questionId);

    if (!response) {
      fail(`Missing scored response for question ${scoringCase.code}.`);
    }

    if (response.raw_value !== scoringCase.expectedRaw || response.scored_value !== scoringCase.expectedScored) {
      fail(`Unexpected stored response score for question ${scoringCase.code}.`);
    }
  }

  const { data: dimensionScores, error: dimensionScoresError } = await supabase
    .from("dimension_scores")
    .select("dimension, raw_score")
    .eq("attempt_id", attemptId)
    .order("dimension", { ascending: true });

  if (dimensionScoresError || !dimensionScores) {
    fail(`Unable to load dimension scores: ${dimensionScoresError?.message ?? "Unknown error"}`);
  }

  if (dimensionScores.length !== SCORING_CASES.length) {
    fail(`Expected ${SCORING_CASES.length} persisted dimension scores, received ${dimensionScores.length}.`);
  }

  const dimensionScoreByName = new Map(
    dimensionScores.map((dimensionScore) => [dimensionScore.dimension, Number(dimensionScore.raw_score)]),
  );
  const expectedDimensionScores = new Map([
    ["extraversion", 5],
    ["agreeableness", 2],
    ["conscientiousness", 3],
    ["emotional_stability", 4],
    ["intellect", 1],
  ]);

  for (const [dimension, expectedRawScore] of expectedDimensionScores.entries()) {
    if (dimensionScoreByName.get(dimension) !== expectedRawScore) {
      fail(`Expected ${dimension} raw score to persist as ${expectedRawScore}.`);
    }
  }

  const reloadHtml = await fetchAssessmentPage(attemptId);
  assertIncludes(reloadHtml, "Rezultati", "Expected results section to remain on reload.");
  assertIncludes(reloadHtml, "Broj bodovanih odgovora", "Expected persisted results summary to remain on reload.");

  console.log("Scoring flow verification passed.");
  console.log(`Verified attempt id: ${attemptId}`);
  console.log("Verified behaviors:");
  console.log("- completed attempt results are derived server-side from persisted single_choice responses");
  console.log("- response raw_value and scored_value are persisted for likert_sum items");
  console.log("- dimension_scores are persisted for completed attempts and remain stable on reload");
  console.log(`- no unscored response branch is exercised for the active ${TARGET_TEST_SLUG} dataset`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
