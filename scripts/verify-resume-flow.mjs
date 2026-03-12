import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";

const APP_URL = process.env.APP_URL ?? "http://localhost:3100";
const ATTEMPT_COOKIE_NAME = "assessment_attempt_id";
const HEALTH_URL = `${APP_URL}/api/health`;
const EXPECTED_ACTIVE_TEST_SLUG = "ipip50-hr-v1";
const TEMP_TEST_ID = "39999999-1111-1111-1111-111111111111";
const REQUIRED_CODES = ["E01", "A01", "O01"];

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

function assertResumeAttemptId(html, attemptId) {
  const expectedSnippet = attemptId === null
    ? 'initialAttemptId\\":null'
    : `initialAttemptId\\":\\"${attemptId}\\"`;

  assertIncludes(html, expectedSnippet, `Expected resume payload to contain ${expectedSnippet}.`);
}

function assertSerializedSelection(html, questionId, answerOptionId) {
  assertIncludes(
    html,
    `\\"${questionId}\\":\\"${answerOptionId}\\"`,
    `Expected resume payload to contain selection ${answerOptionId} for ${questionId}.`,
  );
}

function assertSelectionsEmpty(html) {
  assertIncludes(
    html,
    'initialSelections\\":{}',
    "Expected resume payload to contain an empty initialSelections object.",
  );
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

async function saveSelections(supabase, testId, attemptId, selectionsByQuestionId) {
  let nextAttemptId = attemptId;

  if (!nextAttemptId) {
    const { data: attemptData, error: attemptError } = await supabase
      .from("attempts")
      .insert({ test_id: testId })
      .select("id")
      .single();

    if (attemptError || !attemptData) {
      fail(`Unable to create attempt: ${attemptError?.message ?? "Unknown error"}`);
    }

    nextAttemptId = attemptData.id;
  }

  const questionIds = Object.keys(selectionsByQuestionId);
  const { error: deleteResponsesError } = await supabase
    .from("responses")
    .delete()
    .eq("attempt_id", nextAttemptId)
    .in("question_id", questionIds);

  if (deleteResponsesError) {
    fail(`Unable to replace responses: ${deleteResponsesError.message}`);
  }

  const responseRows = Object.entries(selectionsByQuestionId)
    .filter(([, answerOptionId]) => Boolean(answerOptionId))
    .map(([questionId, answerOptionId]) => ({
      attempt_id: nextAttemptId,
      question_id: questionId,
      response_kind: "single_choice",
      answer_option_id: answerOptionId,
    }));

  const { error: insertResponsesError } = await supabase
    .from("responses")
    .insert(responseRows);

  if (insertResponsesError) {
    fail(`Unable to insert responses: ${insertResponsesError.message}`);
  }

  return nextAttemptId;
}

async function getResponseSnapshot(supabase, attemptId) {
  const { data, error } = await supabase
    .from("responses")
    .select("id, question_id, response_kind, answer_option_id")
    .eq("attempt_id", attemptId)
    .order("question_id", { ascending: true });

  if (error) {
    fail(`Unable to load response snapshot: ${error.message}`);
  }

  return data ?? [];
}

async function ensureTempOtherTest(supabase) {
  const { error } = await supabase.from("tests").upsert({
    id: TEMP_TEST_ID,
    slug: "verification-other-test",
    name: "Verification Other Test",
    category: "personality",
    description: null,
    status: "draft",
    scoring_method: "likert_sum",
    duration_minutes: null,
    is_active: false,
  });

  if (error) {
    fail(`Unable to create temp test: ${error.message}`);
  }
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
    fail("Resume verification expects the active test to contain only single_choice questions.");
  }

  const questionByCode = new Map(questions.map((question) => [question.code, question]));

  for (const code of REQUIRED_CODES) {
    if (!questionByCode.has(code)) {
      fail(`Expected seeded question ${code} was not found.`);
    }
  }

  const targetQuestions = REQUIRED_CODES.map((code) => questionByCode.get(code));
  const { data: answerOptions, error: answerOptionsError } = await supabase
    .from("answer_options")
    .select("id, question_id, option_order")
    .in("question_id", targetQuestions.map((question) => question.id))
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

  for (const question of targetQuestions) {
    const options = answerOptionsByQuestionId.get(question.id) ?? [];

    if (options.length !== 5) {
      fail(`Expected 5 answer options for ${question.code}, received ${options.length}.`);
    }
  }

  const initialSelections = {
    [targetQuestions[0].id]: answerOptionsByQuestionId.get(targetQuestions[0].id)[1].id,
    [targetQuestions[1].id]: answerOptionsByQuestionId.get(targetQuestions[1].id)[2].id,
    [targetQuestions[2].id]: answerOptionsByQuestionId.get(targetQuestions[2].id)[3].id,
  };
  const updatedSelections = {
    [targetQuestions[0].id]: answerOptionsByQuestionId.get(targetQuestions[0].id)[4].id,
    [targetQuestions[1].id]: answerOptionsByQuestionId.get(targetQuestions[1].id)[0].id,
    [targetQuestions[2].id]: answerOptionsByQuestionId.get(targetQuestions[2].id)[1].id,
  };

  const attemptId = await saveSelections(supabase, activeTest.id, null, initialSelections);

  const initialSnapshot = await getResponseSnapshot(supabase, attemptId);
  if (initialSnapshot.length !== REQUIRED_CODES.length) {
    fail(`Expected ${REQUIRED_CODES.length} saved responses, received ${initialSnapshot.length}.`);
  }

  if (!initialSnapshot.every((response) => response.response_kind === "single_choice")) {
    fail("Initial save did not persist only single_choice response rows.");
  }

  const initialResponseIdByQuestionId = new Map(
    initialSnapshot.map((response) => [response.question_id, response.id]),
  );

  const initialHtml = await fetchAssessmentPage(attemptId);
  assertResumeAttemptId(initialHtml, attemptId);
  for (const [questionId, answerOptionId] of Object.entries(initialSelections)) {
    assertSerializedSelection(initialHtml, questionId, answerOptionId);
  }
  for (const [questionId, answerOptionId] of Object.entries(updatedSelections)) {
    assertNotIncludes(
      initialHtml,
      `\\"${questionId}\\":\\"${answerOptionId}\\"`,
      `Initial resume payload still contained the edited option ${answerOptionId}.`,
    );
  }

  await saveSelections(supabase, activeTest.id, attemptId, updatedSelections);

  const updatedSnapshot = await getResponseSnapshot(supabase, attemptId);
  if (updatedSnapshot.length !== REQUIRED_CODES.length) {
    fail(`Expected ${REQUIRED_CODES.length} updated responses, received ${updatedSnapshot.length}.`);
  }

  for (const response of updatedSnapshot) {
    if (response.answer_option_id !== updatedSelections[response.question_id]) {
      fail(`Updated response for ${response.question_id} did not persist the expected option id.`);
    }

    if (response.id === initialResponseIdByQuestionId.get(response.question_id)) {
      fail(`Expected response row for ${response.question_id} to be replaced on re-save.`);
    }
  }

  const updatedHtml = await fetchAssessmentPage(attemptId);
  assertResumeAttemptId(updatedHtml, attemptId);
  for (const [questionId, answerOptionId] of Object.entries(updatedSelections)) {
    assertSerializedSelection(updatedHtml, questionId, answerOptionId);
  }
  for (const [questionId, answerOptionId] of Object.entries(initialSelections)) {
    assertNotIncludes(
      updatedHtml,
      `\\"${questionId}\\":\\"${answerOptionId}\\"`,
      `Updated resume payload still contained the stale option ${answerOptionId}.`,
    );
  }

  const { error: deleteAttemptError } = await supabase
    .from("attempts")
    .delete()
    .eq("id", attemptId);

  if (deleteAttemptError) {
    fail(`Unable to delete attempt for stale-cookie verification: ${deleteAttemptError.message}`);
  }

  const deletedAttemptHtml = await fetchAssessmentPage(attemptId);
  assertResumeAttemptId(deletedAttemptHtml, null);
  assertSelectionsEmpty(deletedAttemptHtml);

  await ensureTempOtherTest(supabase);

  const { data: wrongAttempt, error: wrongAttemptError } = await supabase
    .from("attempts")
    .insert({ test_id: TEMP_TEST_ID })
    .select("id")
    .single();

  if (wrongAttemptError || !wrongAttempt) {
    fail(`Unable to create wrong-test attempt: ${wrongAttemptError?.message ?? "Unknown error"}`);
  }

  const wrongTestHtml = await fetchAssessmentPage(wrongAttempt.id);
  assertResumeAttemptId(wrongTestHtml, null);
  assertSelectionsEmpty(wrongTestHtml);

  console.log("Resume flow verification passed.");
  console.log(`Verified attempt id: ${attemptId}`);
  console.log("Verified behaviors:");
  console.log("- initial save DB truth for single_choice responses only");
  console.log("- reload response payload carried the saved resume state into the client form");
  console.log("- edit + re-save replaced DB truth correctly for the same question ids");
  console.log("- deleted-attempt and wrong-test cookies fall back to empty resume state");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
