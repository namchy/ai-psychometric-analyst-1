import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";

const APP_URL = process.env.APP_URL ?? "http://localhost:3100";
const ATTEMPT_COOKIE_NAME = "assessment_attempt_id";
const HEALTH_URL = `${APP_URL}/api/health`;
const EXPECTED_ACTIVE_TEST_SLUG = "ipip50-hr-v1";
const COMPLETION_CODE = "E01";

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

async function loadRequiredQuestionsWithOptions(supabase, testId) {
  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, code, question_type, is_required")
    .eq("test_id", testId)
    .eq("is_active", true)
    .order("question_order", { ascending: true });

  if (questionsError || !questions) {
    fail(`Unable to load active questions: ${questionsError?.message ?? "Unknown error"}`);
  }

  const requiredQuestions = questions.filter((question) => question.is_required);
  const nonTextQuestionIds = requiredQuestions
    .filter((question) => question.question_type !== "text")
    .map((question) => question.id);

  const { data: answerOptions, error: answerOptionsError } = await supabase
    .from("answer_options")
    .select("id, question_id, option_order")
    .in("question_id", nonTextQuestionIds)
    .order("question_id", { ascending: true })
    .order("option_order", { ascending: true });

  if (answerOptionsError) {
    fail(`Unable to load answer options: ${answerOptionsError.message}`);
  }

  const answerOptionsByQuestionId = (answerOptions ?? []).reduce((grouped, option) => {
    const questionOptions = grouped.get(option.question_id) ?? [];
    questionOptions.push(option);
    grouped.set(option.question_id, questionOptions);
    return grouped;
  }, new Map());

  return { requiredQuestions, answerOptionsByQuestionId };
}

async function insertAnswerForQuestion(supabase, attemptId, question, answerOptionsByQuestionId, optionIndex = 0) {
  if (question.question_type === "text") {
    const { error } = await supabase.from("responses").insert({
      attempt_id: attemptId,
      question_id: question.id,
      response_kind: "text",
      text_value: `Verification response for ${question.code}`,
    });

    if (error) {
      fail(`Unable to create text response for ${question.code}: ${error.message}`);
    }

    return;
  }

  const options = answerOptionsByQuestionId.get(question.id) ?? [];
  const selectedOption = options[optionIndex] ?? options[0];

  if (!selectedOption) {
    fail(`Unable to find answer option for ${question.code}.`);
  }

  if (question.question_type === "single_choice") {
    const { error } = await supabase.from("responses").insert({
      attempt_id: attemptId,
      question_id: question.id,
      response_kind: "single_choice",
      answer_option_id: selectedOption.id,
    });

    if (error) {
      fail(`Unable to create single choice response for ${question.code}: ${error.message}`);
    }

    return;
  }

  const { data: responseRow, error: responseError } = await supabase
    .from("responses")
    .insert({
      attempt_id: attemptId,
      question_id: question.id,
      response_kind: "multiple_choice",
    })
    .select("id")
    .single();

  if (responseError || !responseRow) {
    fail(`Unable to create multiple choice response for ${question.code}: ${responseError?.message ?? "Unknown error"}`);
  }

  const { error: selectionError } = await supabase.from("response_selections").insert({
    response_id: responseRow.id,
    question_id: question.id,
    answer_option_id: selectedOption.id,
  });

  if (selectionError) {
    fail(`Unable to create multiple choice selection for ${question.code}: ${selectionError.message}`);
  }
}

async function createAttempt(supabase, testId, status = "in_progress") {
  const insert = status === "completed"
    ? { test_id: testId, status: "completed", completed_at: new Date().toISOString() }
    : { test_id: testId };

  const { data, error } = await supabase.from("attempts").insert(insert).select("id").single();

  if (error || !data) {
    fail(`Unable to create attempt: ${error?.message ?? "Unknown error"}`);
  }

  return data.id;
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
    .eq("is_active", true)
    .maybeSingle();

  if (activeTestError || !activeTest) {
    fail(`Unable to load active test: ${activeTestError?.message ?? "Unknown error"}`);
  }

  if (activeTest.slug !== EXPECTED_ACTIVE_TEST_SLUG) {
    fail(`Expected active test ${EXPECTED_ACTIVE_TEST_SLUG}, received ${activeTest.slug}.`);
  }

  const { requiredQuestions, answerOptionsByQuestionId } = await loadRequiredQuestionsWithOptions(
    supabase,
    activeTest.id,
  );

  const completionQuestion = requiredQuestions.find((question) => question.code === COMPLETION_CODE);

  if (!completionQuestion) {
    fail(`Expected required question ${COMPLETION_CODE} was not found.`);
  }

  const inProgressAttemptId = await createAttempt(supabase, activeTest.id);
  await insertAnswerForQuestion(
    supabase,
    inProgressAttemptId,
    completionQuestion,
    answerOptionsByQuestionId,
    3,
  );

  const inProgressHtml = await fetchAssessmentPage(inProgressAttemptId);
  assertIncludes(
    inProgressHtml,
    "Answer the remaining",
    "Expected incomplete completion guidance to render for an in-progress attempt.",
  );
  assertIncludes(
    inProgressHtml,
    "Complete assessment",
    "Expected completion button to remain visible before completion.",
  );
  assertNotIncludes(
    inProgressHtml,
    "Procjena je završena.",
    "Incomplete in-progress attempt should not render completed messaging.",
  );

  const completedAttemptId = await createAttempt(supabase, activeTest.id, "completed");

  for (const question of requiredQuestions) {
    const optionIndex = question.code === COMPLETION_CODE ? 3 : 0;
    await insertAnswerForQuestion(
      supabase,
      completedAttemptId,
      question,
      answerOptionsByQuestionId,
      optionIndex,
    );
  }

  const html = await fetchAssessmentPage(completedAttemptId);
  assertIncludes(html, "Procjena je završena.", "Expected completed state message to render.");
  assertIncludes(
    html,
    "Vaši odgovori su sada dostupni samo za pregled.",
    "Expected read-only completed messaging to render.",
  );
  assertIncludes(html, "fieldset disabled", "Expected completed page fieldsets to be disabled.");
  assertIncludes(html, "Rezultati", "Expected results section to render for a completed attempt.");
  assertIncludes(html, "Extraversion", "Expected the completed result dimension to render.");
  assertNotIncludes(
    html,
    "Answer the remaining",
    "Completed attempt should not render incomplete completion messaging.",
  );
  assertNotIncludes(html, "Save progress", "Completed attempt should not render the save button.");

  console.log("Completion flow verification passed.");
  console.log(`Verified in-progress attempt id: ${inProgressAttemptId}`);
  console.log(`Verified completed attempt id: ${completedAttemptId}`);
  console.log("Verified behaviors:");
  console.log("- incomplete in-progress attempt keeps save/resume state and shows completion guidance");
  console.log("- fully answered required-question attempt reloads as completed and read-only");
  console.log("- completed attempt renders results and hides save actions");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
