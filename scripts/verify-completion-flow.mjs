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
    .select("id, code")
    .eq("test_id", activeTest.id)
    .order("question_order", { ascending: true });

  if (questionsError || !questions) {
    fail(`Unable to load questions: ${questionsError?.message ?? "Unknown error"}`);
  }

  const singleQuestion = questions.find((question) => question.code === "E1");
  const multiQuestion = questions.find((question) => question.code === "A1");
  const textQuestion = questions.find((question) => question.code === "O1");

  if (!singleQuestion || !multiQuestion || !textQuestion) {
    fail("Expected seeded questions E1, A1, and O1 were not found.");
  }

  const { data: answerOptions, error: answerOptionsError } = await supabase
    .from("answer_options")
    .select("id, question_id")
    .in("question_id", [singleQuestion.id, multiQuestion.id])
    .order("option_order", { ascending: true });

  if (answerOptionsError || !answerOptions) {
    fail(`Unable to load answer options: ${answerOptionsError?.message ?? "Unknown error"}`);
  }

  const singleOption = answerOptions.find((option) => option.question_id === singleQuestion.id);
  const multiOptions = answerOptions.filter((option) => option.question_id === multiQuestion.id);

  if (!singleOption || multiOptions.length < 2) {
    fail("Expected seeded answer options were not found.");
  }

  const { data: attemptData, error: attemptError } = await supabase
    .from("attempts")
    .insert({ test_id: activeTest.id })
    .select("id")
    .single();

  if (attemptError || !attemptData) {
    fail(`Unable to create attempt: ${attemptError?.message ?? "Unknown error"}`);
  }

  const attemptId = attemptData.id;

  const { data: responseData, error: responseError } = await supabase
    .from("responses")
    .insert([
      {
        attempt_id: attemptId,
        question_id: singleQuestion.id,
        response_kind: "single_choice",
        answer_option_id: singleOption.id,
      },
      {
        attempt_id: attemptId,
        question_id: multiQuestion.id,
        response_kind: "multiple_choice",
      },
      {
        attempt_id: attemptId,
        question_id: textQuestion.id,
        response_kind: "text",
        text_value: "Completion verification text.",
      },
    ])
    .select("id, question_id, response_kind");

  if (responseError || !responseData) {
    fail(`Unable to create responses: ${responseError?.message ?? "Unknown error"}`);
  }

  const multipleChoiceParent = responseData.find(
    (response) => response.question_id === multiQuestion.id && response.response_kind === "multiple_choice",
  );

  if (!multipleChoiceParent) {
    fail("Multiple choice parent response was not created.");
  }

  const { error: selectionError } = await supabase
    .from("response_selections")
    .insert([
      {
        response_id: multipleChoiceParent.id,
        question_id: multiQuestion.id,
        answer_option_id: multiOptions[0].id,
      },
      {
        response_id: multipleChoiceParent.id,
        question_id: multiQuestion.id,
        answer_option_id: multiOptions[1].id,
      },
    ]);

  if (selectionError) {
    fail(`Unable to create response selections: ${selectionError.message}`);
  }

  const completedAt = new Date().toISOString();
  const { error: completeError } = await supabase
    .from("attempts")
    .update({
      status: "completed",
      completed_at: completedAt,
    })
    .eq("id", attemptId);

  if (completeError) {
    fail(`Unable to complete attempt: ${completeError.message}`);
  }

  const { data: completedAttempt, error: completedAttemptError } = await supabase
    .from("attempts")
    .select("status, completed_at")
    .eq("id", attemptId)
    .single();

  if (completedAttemptError || !completedAttempt) {
    fail(`Unable to reload completed attempt: ${completedAttemptError?.message ?? "Unknown error"}`);
  }

  if (completedAttempt.status !== "completed" || !completedAttempt.completed_at) {
    fail("Attempt was not persisted as completed.");
  }

  const html = await fetchAssessmentPage(attemptId);
  assertIncludes(
    html,
    "Assessment completed.",
    "Expected completed state message to render.",
  );
  assertIncludes(
    html,
    "Your answers are now read-only.",
    "Expected read-only completed messaging to render.",
  );
  assertIncludes(
    html,
    "Completion verification text.",
    "Expected completed page to render the saved text response.",
  );
  assertIncludes(
    html,
    "fieldset disabled",
    "Expected completed page fieldsets to be disabled.",
  );
  assertNotIncludes(
    html,
    "Complete assessment",
    "Completed attempt should not render the completion button.",
  );
  assertNotIncludes(
    html,
    "Save progress",
    "Completed attempt should not render the save button.",
  );

  console.log("Completion flow verification passed.");
  console.log(`Verified attempt id: ${attemptId}`);
  console.log("Verified behaviors:");
  console.log("- attempt completion is persisted in attempts.status and attempts.completed_at");
  console.log("- completed attempts reload as completed, not editable in-progress");
  console.log("- completed UI renders as read-only and hides save/complete actions");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});


