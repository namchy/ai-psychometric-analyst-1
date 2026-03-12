import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";

const APP_URL = "http://127.0.0.1:3100";
const ATTEMPT_COOKIE_NAME = "assessment_attempt_id";
const ACTIVE_TEST_SLUG = "big5-mini";
const TEMP_TEST_ID = "39999999-1111-1111-1111-111111111111";

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

function assertResumeAttemptId(html, attemptId) {
  const expectedSnippet = attemptId === null
    ? 'initialAttemptId\\":null'
    : `initialAttemptId\\":\\"${attemptId}\\"`;

  assertIncludes(html, expectedSnippet, `Expected resume payload to contain ${expectedSnippet}.`);
}

function assertSelectionPresent(html, questionId, expectedValue) {
  const questionSnippet = `\\"${questionId}\\":`;
  assertIncludes(html, questionSnippet, `Expected resume payload to contain question ${questionId}.`);

  if (typeof expectedValue === "string") {
    assertIncludes(
      html,
      `\\"${questionId}\\":\\"${expectedValue}\\"`,
      `Expected resume payload to contain selection ${expectedValue} for ${questionId}.`,
    );
    return;
  }

  for (const optionId of expectedValue) {
    assertIncludes(
      html,
      optionId,
      `Expected resume payload to contain option ${optionId} for ${questionId}.`,
    );
  }
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
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(APP_URL);

      if (response.ok) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await delay(1000);
  }

  fail("Next.js server did not become ready in time.");
}

async function saveSelections(supabase, testId, attemptId, selectionsByQuestionId, questionTypeById) {
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

  const responseRows = [];
  const multipleChoiceSelectionsByQuestionId = new Map();

  for (const [questionId, selection] of Object.entries(selectionsByQuestionId)) {
    const questionType = questionTypeById.get(questionId);

    if (questionType === "text") {
      if (!selection) {
        continue;
      }

      responseRows.push({
        attempt_id: nextAttemptId,
        question_id: questionId,
        response_kind: "text",
        text_value: selection,
      });
      continue;
    }

    if (questionType === "single_choice") {
      if (!selection) {
        continue;
      }

      responseRows.push({
        attempt_id: nextAttemptId,
        question_id: questionId,
        response_kind: "single_choice",
        answer_option_id: selection,
      });
      continue;
    }

    const optionIds = [...new Set(selection)].filter(Boolean);

    if (optionIds.length === 0) {
      continue;
    }

    responseRows.push({
      attempt_id: nextAttemptId,
      question_id: questionId,
      response_kind: "multiple_choice",
    });
    multipleChoiceSelectionsByQuestionId.set(questionId, optionIds);
  }

  const { data: insertedResponses, error: insertResponsesError } = await supabase
    .from("responses")
    .insert(responseRows)
    .select("id, question_id, response_kind");

  if (insertResponsesError || !insertedResponses) {
    fail(`Unable to insert responses: ${insertResponsesError?.message ?? "Unknown error"}`);
  }

  const selectionRows = insertedResponses.flatMap((response) => {
    if (response.response_kind !== "multiple_choice") {
      return [];
    }

    return (multipleChoiceSelectionsByQuestionId.get(response.question_id) ?? []).map(
      (answerOptionId) => ({
        response_id: response.id,
        question_id: response.question_id,
        answer_option_id: answerOptionId,
      }),
    );
  });

  if (selectionRows.length > 0) {
    const { error: insertSelectionsError } = await supabase
      .from("response_selections")
      .insert(selectionRows);

    if (insertSelectionsError) {
      fail(`Unable to insert response selections: ${insertSelectionsError.message}`);
    }
  }

  return nextAttemptId;
}

async function getResponseSnapshot(supabase, attemptId) {
  const { data, error } = await supabase
    .from("responses")
    .select("id, question_id, response_kind, answer_option_id, text_value, response_selections(answer_option_id)")
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
    .select("id, slug")
    .eq("slug", ACTIVE_TEST_SLUG)
    .single();

  if (activeTestError || !activeTest) {
    fail(`Unable to load active test: ${activeTestError?.message ?? "Unknown error"}`);
  }

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, code, question_type")
    .eq("test_id", activeTest.id);

  if (questionsError || !questions) {
    fail(`Unable to load questions: ${questionsError?.message ?? "Unknown error"}`);
  }

  const questionByCode = new Map(questions.map((question) => [question.code, question]));
  const questionTypeById = new Map(questions.map((question) => [question.id, question.question_type]));
  const singleQuestion = questionByCode.get("E1");
  const multiQuestion = questionByCode.get("A1");
  const textQuestion = questionByCode.get("O1");

  if (!singleQuestion || !multiQuestion || !textQuestion) {
    fail("Expected seeded questions E1, A1, and O1 were not found.");
  }

  const { data: answerOptions, error: answerOptionsError } = await supabase
    .from("answer_options")
    .select("id, question_id, option_order")
    .in("question_id", [singleQuestion.id, multiQuestion.id])
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

  const singleOptions = answerOptionsByQuestionId.get(singleQuestion.id) ?? [];
  const multipleOptions = answerOptionsByQuestionId.get(multiQuestion.id) ?? [];

  if (singleOptions.length < 4 || multipleOptions.length < 4) {
    fail("Expected seeded answer options were not found.");
  }

  const initialSelections = {
    [singleQuestion.id]: singleOptions[1].id,
    [multiQuestion.id]: [multipleOptions[0].id, multipleOptions[1].id],
    [textQuestion.id]: "Initial resume verification text.",
  };
  const updatedSelections = {
    [singleQuestion.id]: singleOptions[3].id,
    [multiQuestion.id]: [multipleOptions[2].id, multipleOptions[3].id],
    [textQuestion.id]: "Updated resume verification text.",
  };

  const attemptId = await saveSelections(
    supabase,
    activeTest.id,
    null,
    initialSelections,
    questionTypeById,
  );

  const initialSnapshot = await getResponseSnapshot(supabase, attemptId);
  const initialMultiResponse = initialSnapshot.find(
    (response) => response.question_id === multiQuestion.id,
  );

  if (!initialMultiResponse) {
    fail("Initial multiple choice response row was not created.");
  }

  const initialHtml = await fetchAssessmentPage(attemptId);
  assertResumeAttemptId(initialHtml, attemptId);
  assertSelectionPresent(initialHtml, singleQuestion.id, singleOptions[1].id);
  assertSelectionPresent(initialHtml, multiQuestion.id, [multipleOptions[0].id, multipleOptions[1].id]);
  assertSelectionPresent(initialHtml, textQuestion.id, "Initial resume verification text.");
  assertNotIncludes(
    initialHtml,
    `\\"${singleQuestion.id}\\":\\"${singleOptions[3].id}\\"`,
    "Initial resume payload still contained the edited single-choice option.",
  );

  await saveSelections(
    supabase,
    activeTest.id,
    attemptId,
    updatedSelections,
    questionTypeById,
  );

  const updatedSnapshot = await getResponseSnapshot(supabase, attemptId);
  const singleResponse = updatedSnapshot.find(
    (response) => response.question_id === singleQuestion.id,
  );
  const updatedMultiResponse = updatedSnapshot.find(
    (response) => response.question_id === multiQuestion.id,
  );
  const textResponse = updatedSnapshot.find(
    (response) => response.question_id === textQuestion.id,
  );

  if (!singleResponse || !updatedMultiResponse || !textResponse) {
    fail("Updated response snapshot is missing expected questions.");
  }

  if (singleResponse.answer_option_id !== singleOptions[3].id) {
    fail("Single choice response did not update to the new option.");
  }

  if (textResponse.text_value !== "Updated resume verification text.") {
    fail("Text response did not update to the new value.");
  }

  const updatedSelectionIds = (updatedMultiResponse.response_selections ?? [])
    .map((selection) => selection.answer_option_id)
    .sort();
  const expectedUpdatedSelectionIds = [multipleOptions[2].id, multipleOptions[3].id].sort();

  if (updatedMultiResponse.answer_option_id !== null || updatedMultiResponse.text_value !== null) {
    fail("Multiple choice parent response shape is invalid after re-save.");
  }

  if (updatedSelectionIds.join(",") !== expectedUpdatedSelectionIds.join(",")) {
    fail("Multiple choice selections did not update to the expected option set.");
  }

  if (updatedSelectionIds.includes(multipleOptions[0].id) || updatedSelectionIds.includes(multipleOptions[1].id)) {
    fail("Stale multiple choice child rows remained after re-save.");
  }

  if (updatedMultiResponse.id === initialMultiResponse.id) {
    fail("Expected multiple choice parent response row to be replaced on re-save.");
  }

  const updatedHtml = await fetchAssessmentPage(attemptId);
  assertResumeAttemptId(updatedHtml, attemptId);
  assertSelectionPresent(updatedHtml, singleQuestion.id, singleOptions[3].id);
  assertSelectionPresent(updatedHtml, multiQuestion.id, [multipleOptions[2].id, multipleOptions[3].id]);
  assertSelectionPresent(updatedHtml, textQuestion.id, "Updated resume verification text.");
  assertNotIncludes(
    updatedHtml,
    `\\"${singleQuestion.id}\\":\\"${singleOptions[1].id}\\"`,
    "Updated resume payload still contained the stale single-choice option.",
  );
  assertNotIncludes(
    updatedHtml,
    multipleOptions[0].id,
    "Updated resume payload still contained a stale multiple-choice option.",
  );

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
  console.log("- initial save DB truth for single_choice, multiple_choice, and text");
  console.log("- reload response payload carried the saved resume state into the client form");
  console.log("- edit + re-save replaced DB truth correctly");
  console.log("- multiple_choice stale child rows were removed");
  console.log("- deleted-attempt and wrong-test cookies fall back to empty resume state");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});


