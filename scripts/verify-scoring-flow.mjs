import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";

const APP_URL = process.env.APP_URL ?? "http://localhost:3100";
const ATTEMPT_COOKIE_NAME = "assessment_attempt_id";
const HEALTH_URL = `${APP_URL}/api/health`;
const ACTIVE_TEST_SLUG = "big5-mini";

function fail(message) {
  throw new Error(message);
}

function getRequiredEnvVar(name) {
  const value = process.env[name];

  if (!value) {
    fail(`Missing required env var: ${name}`);
  }

  return value;
}

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
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
  const supabaseUrl = getRequiredEnvVar("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnvVar("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  await waitForServer();

  const { data: activeTest, error: activeTestError } = await supabase
    .from("tests")
    .select("id")
    .eq("slug", ACTIVE_TEST_SLUG)
    .single();

  if (activeTestError || !activeTest) {
    fail(`Unable to load active test: ${activeTestError?.message ?? "Unknown error"}`);
  }

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, code, question_type")
    .eq("test_id", activeTest.id)
    .order("question_order", { ascending: true });

  if (questionsError || !questions) {
    fail(`Unable to load questions: ${questionsError?.message ?? "Unknown error"}`);
  }

  const questionByCode = new Map(questions.map((question) => [question.code, question]));
  const requiredCodes = ["E1", "E2", "C1", "C2", "A1", "O1"];

  for (const code of requiredCodes) {
    if (!questionByCode.has(code)) {
      fail(`Expected seeded question ${code} was not found.`);
    }
  }

  const scoredQuestionIds = ["E1", "E2", "C1", "C2"].map((code) => questionByCode.get(code).id);
  const unscoredQuestionIds = [questionByCode.get("A1").id, questionByCode.get("O1").id];

  const { data: answerOptions, error: answerOptionsError } = await supabase
    .from("answer_options")
    .select("id, question_id, option_order")
    .in("question_id", [...scoredQuestionIds, questionByCode.get("A1").id])
    .order("option_order", { ascending: true });

  if (answerOptionsError || !answerOptions) {
    fail(`Unable to load answer options: ${answerOptionsError?.message ?? "Unknown error"}`);
  }

  const answerOptionsByQuestionId = answerOptions.reduce((grouped, option) => {
    const questionOptions = grouped.get(option.question_id) ?? [];
    questionOptions.push(option);
    grouped.set(option.question_id, questionOptions);
    return grouped;
  }, new Map());

  const e1Option = answerOptionsByQuestionId.get(questionByCode.get("E1").id)?.[4];
  const e2Option = answerOptionsByQuestionId.get(questionByCode.get("E2").id)?.[3];
  const c1Option = answerOptionsByQuestionId.get(questionByCode.get("C1").id)?.[2];
  const c2Option = answerOptionsByQuestionId.get(questionByCode.get("C2").id)?.[1];
  const multiOptions = answerOptionsByQuestionId.get(questionByCode.get("A1").id) ?? [];

  if (!e1Option || !e2Option || !c1Option || !c2Option || multiOptions.length < 2) {
    fail("Expected seeded answer options for scoring verification were not found.");
  }

  const { data: attemptData, error: attemptError } = await supabase
    .from("attempts")
    .insert({ test_id: activeTest.id, status: "completed", completed_at: new Date().toISOString() })
    .select("id")
    .single();

  if (attemptError || !attemptData) {
    fail(`Unable to create completed attempt: ${attemptError?.message ?? "Unknown error"}`);
  }

  const attemptId = attemptData.id;

  const { data: responseData, error: responseError } = await supabase
    .from("responses")
    .insert([
      {
        attempt_id: attemptId,
        question_id: questionByCode.get("E1").id,
        response_kind: "single_choice",
        answer_option_id: e1Option.id,
      },
      {
        attempt_id: attemptId,
        question_id: questionByCode.get("E2").id,
        response_kind: "single_choice",
        answer_option_id: e2Option.id,
      },
      {
        attempt_id: attemptId,
        question_id: questionByCode.get("C1").id,
        response_kind: "single_choice",
        answer_option_id: c1Option.id,
      },
      {
        attempt_id: attemptId,
        question_id: questionByCode.get("C2").id,
        response_kind: "single_choice",
        answer_option_id: c2Option.id,
      },
      {
        attempt_id: attemptId,
        question_id: questionByCode.get("A1").id,
        response_kind: "multiple_choice",
      },
      {
        attempt_id: attemptId,
        question_id: questionByCode.get("O1").id,
        response_kind: "text",
        text_value: "Scoring verification text.",
      },
    ])
    .select("id, question_id, response_kind");

  if (responseError || !responseData) {
    fail(`Unable to create responses: ${responseError?.message ?? "Unknown error"}`);
  }

  const multipleChoiceParent = responseData.find(
    (response) =>
      response.question_id === questionByCode.get("A1").id && response.response_kind === "multiple_choice",
  );

  if (!multipleChoiceParent) {
    fail("Multiple choice parent response was not created.");
  }

  const { error: selectionError } = await supabase
    .from("response_selections")
    .insert([
      {
        response_id: multipleChoiceParent.id,
        question_id: questionByCode.get("A1").id,
        answer_option_id: multiOptions[0].id,
      },
      {
        response_id: multipleChoiceParent.id,
        question_id: questionByCode.get("A1").id,
        answer_option_id: multiOptions[1].id,
      },
    ]);

  if (selectionError) {
    fail(`Unable to create response selections: ${selectionError.message}`);
  }

  const html = await fetchAssessmentPage(attemptId);
  assertIncludes(html, "Results", "Expected results section to render for a completed attempt.");
  assertIncludes(html, "Scored responses", "Expected scored response summary to render.");
  assertIncludes(html, "Extraversion", "Expected Extraversion result to render.");
  assertIncludes(html, "Conscientiousness", "Expected Conscientiousness result to render.");
  assertIncludes(
    html,
    "Recorded but unscored responses",
    "Expected completed results to explain unscored response types.",
  );
  assertIncludes(html, "A1", "Expected unscored multiple choice question to be listed.");
  assertIncludes(html, "O1", "Expected unscored text question to be listed.");
  assertIncludes(html, "Scoring verification text.", "Expected saved text response to remain visible.");

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

  const expectedScores = new Map([
    [questionByCode.get("E1").id, { raw: 5, scored: 5 }],
    [questionByCode.get("E2").id, { raw: 4, scored: 2 }],
    [questionByCode.get("C1").id, { raw: 3, scored: 3 }],
    [questionByCode.get("C2").id, { raw: 2, scored: 4 }],
  ]);

  for (const [questionId, expectedScore] of expectedScores.entries()) {
    const response = scoredResponseByQuestionId.get(questionId);

    if (!response) {
      fail(`Missing scored response for question ${questionId}.`);
    }

    if (response.raw_value !== expectedScore.raw || response.scored_value !== expectedScore.scored) {
      fail(`Unexpected stored response score for question ${questionId}.`);
    }
  }

  for (const questionId of unscoredQuestionIds) {
    const response = scoredResponseByQuestionId.get(questionId);

    if (!response) {
      fail(`Missing unscored response for question ${questionId}.`);
    }

    if (response.raw_value !== null || response.scored_value !== null) {
      fail(`Unscored question ${questionId} should not receive numeric scores.`);
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

  if (dimensionScores.length !== 2) {
    fail(`Expected 2 persisted dimension scores, received ${dimensionScores.length}.`);
  }

  const dimensionScoreByName = new Map(
    dimensionScores.map((dimensionScore) => [dimensionScore.dimension, Number(dimensionScore.raw_score)]),
  );

  if (dimensionScoreByName.get("conscientiousness") !== 7) {
    fail("Expected conscientiousness raw score to persist as 7.");
  }

  if (dimensionScoreByName.get("extraversion") !== 7) {
    fail("Expected extraversion raw score to persist as 7.");
  }

  const reloadHtml = await fetchAssessmentPage(attemptId);
  assertIncludes(reloadHtml, "Results", "Expected results section to remain on reload.");
  assertIncludes(reloadHtml, "Scored responses", "Expected persisted results summary to remain on reload.");

  console.log("Scoring flow verification passed.");
  console.log(`Verified attempt id: ${attemptId}`);
  console.log("Verified behaviors:");
  console.log("- completed attempt results are derived server-side from persisted responses");
  console.log("- response raw_value and scored_value are persisted only for scoreable single-choice items");
  console.log("- dimension_scores are persisted for completed attempts and remain stable on reload");
  console.log("- multiple_choice and text responses remain explicit recorded-but-unscored inputs");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});


