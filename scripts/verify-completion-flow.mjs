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

  const { data: question, error: questionError } = await supabase
    .from("questions")
    .select("id, code, dimension, question_type")
    .eq("test_id", activeTest.id)
    .eq("is_active", true)
    .eq("code", COMPLETION_CODE)
    .maybeSingle();

  if (questionError || !question) {
    fail(`Unable to load completion verification question: ${questionError?.message ?? "Unknown error"}`);
  }

  if (question.question_type !== "single_choice") {
    fail(`Expected ${COMPLETION_CODE} to be single_choice.`);
  }

  const { data: answerOptions, error: answerOptionsError } = await supabase
    .from("answer_options")
    .select("id")
    .eq("question_id", question.id)
    .order("option_order", { ascending: true });

  if (answerOptionsError || !answerOptions || answerOptions.length !== 5) {
    fail(`Unable to load answer options for ${COMPLETION_CODE}.`);
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

  const { error: responseError } = await supabase
    .from("responses")
    .insert({
      attempt_id: attemptId,
      question_id: question.id,
      response_kind: "single_choice",
      answer_option_id: answerOptions[3].id,
    });

  if (responseError) {
    fail(`Unable to create response: ${responseError.message}`);
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
  assertIncludes(html, "Assessment completed.", "Expected completed state message to render.");
  assertIncludes(html, "Your answers are now read-only.", "Expected read-only completed messaging to render.");
  assertIncludes(html, "fieldset disabled", "Expected completed page fieldsets to be disabled.");
  assertIncludes(html, "Results", "Expected results section to render for a completed attempt.");
  assertIncludes(html, "Extraversion", "Expected the completed result dimension to render.");
  assertNotIncludes(html, "Complete assessment", "Completed attempt should not render the completion button.");
  assertNotIncludes(html, "Save progress", "Completed attempt should not render the save button.");

  console.log("Completion flow verification passed.");
  console.log(`Verified attempt id: ${attemptId}`);
  console.log("Verified behaviors:");
  console.log("- attempt completion is persisted in attempts.status and attempts.completed_at");
  console.log("- completed attempts reload as completed, not editable in-progress");
  console.log("- completed UI renders as read-only, hides save/complete actions, and shows results");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
