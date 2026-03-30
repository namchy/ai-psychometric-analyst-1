import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";

const APP_URL = process.env.APP_URL ?? "http://localhost:3100";
const ATTEMPT_COOKIE_NAME = "assessment_attempt_id";
const HEALTH_URL = `${APP_URL}/api/health`;
const TARGET_TEST_SLUG = process.env.VERIFY_TEST_SLUG ?? "ipip50-hr-v1";
const EXPECTED_REPORT_BEHAVIOR = process.env.VERIFY_REPORT_EXPECTED_BEHAVIOR ?? "snapshot";
const EXPECTED_REPORT_GENERATOR = process.env.VERIFY_REPORT_EXPECTED_GENERATOR ?? "mock";
const REPORT_CASES = [
  { code: "E01", optionIndex: 4 },
  { code: "A01", optionIndex: 3 },
  { code: "C01", optionIndex: 2 },
  { code: "ES01", optionIndex: 1 },
  { code: "O01", optionIndex: 0 },
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

async function loadRequiredQuestionsWithOptions(supabase, testId) {
  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, code, question_type, is_required")
    .eq("test_id", testId)
    .eq("is_active", true)
    .order("question_order", { ascending: true });

  if (questionsError || !questions) {
    fail(`Unable to load report verification questions: ${questionsError?.message ?? "Unknown error"}`);
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

  if (answerOptionsError || !answerOptions) {
    fail(
      `Unable to load report verification options: ${answerOptionsError?.message ?? "Unknown error"}`,
    );
  }

  const answerOptionsByQuestionId = answerOptions.reduce((groupedOptions, option) => {
    const questionOptions = groupedOptions.get(option.question_id) ?? [];
    questionOptions.push(option);
    groupedOptions.set(option.question_id, questionOptions);
    return groupedOptions;
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
    fail(`Expected option index ${optionIndex} for ${question.code}.`);
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

async function createAttempt(supabase, testId, status) {
  const insert = status === "completed"
    ? { test_id: testId, status: "completed", completed_at: new Date().toISOString() }
    : { test_id: testId };

  const { data, error } = await supabase.from("attempts").insert(insert).select("id").single();

  if (error || !data) {
    fail(`Unable to create ${status} attempt: ${error?.message ?? "Unknown error"}`);
  }

  return data.id;
}

async function assertSnapshotBehavior(supabase, validAttemptId) {
  const firstHtml = await fetchAssessmentPage(validAttemptId);
  assertIncludes(firstHtml, "Izvještaj procjene", "Expected assessment report section to render.");
  assertIncludes(firstHtml, "Top uvidi", "Expected top insights section to render.");
  assertIncludes(firstHtml, "Zaključak", "Expected conclusion section to render.");
  assertIncludes(
    firstHtml,
    "Preporuke",
    "Expected recommendations section to render.",
  );

  const { data: firstReportRow, error: firstReportError } = await supabase
    .from("attempt_reports")
    .select("generated_at, generator_type, report_snapshot")
    .eq("attempt_id", validAttemptId)
    .single();

  if (firstReportError || !firstReportRow) {
    fail(
      `Unable to load persisted report snapshot: ${firstReportError?.message ?? "Unknown error"}`,
    );
  }

  if (firstReportRow.generator_type !== EXPECTED_REPORT_GENERATOR) {
    fail(`Expected persisted generator_type ${EXPECTED_REPORT_GENERATOR}, received ${firstReportRow.generator_type}.`);
  }

  if (!firstReportRow.report_snapshot?.report_title) {
    fail("Expected persisted report snapshot to include report_title.");
  }

  if (!Array.isArray(firstReportRow.report_snapshot?.dimension_insights)) {
    fail("Expected persisted report snapshot to include dimension_insights.");
  }

  if (firstReportRow.report_snapshot.dimension_insights.length !== 5) {
    fail(
      `Expected persisted report snapshot to include 5 dimension_insights, received ${firstReportRow.report_snapshot.dimension_insights.length}.`,
    );
  }

  const firstGeneratedAt = firstReportRow.generated_at;
  const secondHtml = await fetchAssessmentPage(validAttemptId);
  assertIncludes(secondHtml, "Izvještaj procjene", "Expected assessment report section to remain on reload.");
  assertIncludes(secondHtml, "Top uvidi", "Expected top insights section to remain on reload.");

  const { data: secondReportRow, error: secondReportError } = await supabase
    .from("attempt_reports")
    .select("generated_at")
    .eq("attempt_id", validAttemptId)
    .single();

  if (secondReportError || !secondReportRow) {
    fail(
      `Unable to reload persisted report snapshot: ${secondReportError?.message ?? "Unknown error"}`,
    );
  }

  if (secondReportRow.generated_at !== firstGeneratedAt) {
    fail("Expected report snapshot to stay stable on reload without regeneration.");
  }
}

async function assertUnavailableBehavior(supabase, validAttemptId) {
  const firstHtml = await fetchAssessmentPage(validAttemptId);
  assertIncludes(firstHtml, "Izvještaj procjene", "Unavailable report should still render a stable report section.");
  assertIncludes(
    firstHtml,
    "Izvještaj trenutno nije dostupan",
    "Unavailable report message should render.",
  );

  const { data: firstReportRow, error: firstReportError } = await supabase
    .from("attempt_reports")
    .select("report_status, generator_type, generated_at, report_snapshot, failure_code")
    .eq("attempt_id", validAttemptId)
    .single();

  if (firstReportError) {
    fail(`Unable to inspect unavailable report state: ${firstReportError.message}`);
  }

  if (firstReportRow.report_status !== "unavailable") {
    fail(`Expected unavailable report status, received ${firstReportRow.report_status}.`);
  }

  if (firstReportRow.generator_type !== EXPECTED_REPORT_GENERATOR) {
    fail(`Expected unavailable generator_type ${EXPECTED_REPORT_GENERATOR}, received ${firstReportRow.generator_type}.`);
  }

  if (firstReportRow.report_snapshot !== null) {
    fail("Unavailable report scenario should persist a null report snapshot.");
  }

  if (firstReportRow.failure_code !== "report_generation_failed") {
    fail(`Expected failure_code report_generation_failed, received ${firstReportRow.failure_code}.`);
  }

  const firstGeneratedAt = firstReportRow.generated_at;
  const secondHtml = await fetchAssessmentPage(validAttemptId);
  assertIncludes(
    secondHtml,
    "Izvještaj trenutno nije dostupan",
    "Unavailable report message should remain stable on reload.",
  );

  const { data: secondReportRow, error: secondReportError } = await supabase
    .from("attempt_reports")
    .select("generated_at")
    .eq("attempt_id", validAttemptId)
    .single();

  if (secondReportError || !secondReportRow) {
    fail(
      `Unable to reload unavailable report snapshot: ${secondReportError?.message ?? "Unknown error"}`,
    );
  }

  if (secondReportRow.generated_at !== firstGeneratedAt) {
    fail("Expected unavailable report marker to stay stable on reload without regeneration.");
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
    .eq("slug", TARGET_TEST_SLUG)
    .eq("is_active", true)
    .maybeSingle();

  if (activeTestError || !activeTest) {
    fail(`Unable to load active test ${TARGET_TEST_SLUG}: ${activeTestError?.message ?? "Unknown error"}`);
  }

  const { requiredQuestions, answerOptionsByQuestionId } = await loadRequiredQuestionsWithOptions(
    supabase,
    activeTest.id,
  );
  const reportOverrides = new Map(REPORT_CASES.map((reportCase) => [reportCase.code, reportCase.optionIndex]));

  const incompleteAttemptId = await createAttempt(supabase, activeTest.id, "completed");
  const partialQuestion = requiredQuestions.find((question) => question.code === REPORT_CASES[0].code);

  if (!partialQuestion) {
    fail(`Expected seeded question ${REPORT_CASES[0].code} was not found.`);
  }

  await insertAnswerForQuestion(
    supabase,
    incompleteAttemptId,
    partialQuestion,
    answerOptionsByQuestionId,
    REPORT_CASES[0].optionIndex,
  );

  const incompleteHtml = await fetchAssessmentPage(incompleteAttemptId);
  assertNotIncludes(
    incompleteHtml,
    "AI izvještaj procjene",
    "Incomplete completed attempt should not render a report.",
  );

  const { data: incompleteReportRow, error: incompleteReportError } = await supabase
    .from("attempt_reports")
    .select("attempt_id")
    .eq("attempt_id", incompleteAttemptId)
    .maybeSingle();

  if (incompleteReportError) {
    fail(`Unable to inspect incomplete attempt report state: ${incompleteReportError.message}`);
  }

  if (incompleteReportRow) {
    fail("Incomplete completed attempt should not persist a report snapshot.");
  }

  const validAttemptId = await createAttempt(supabase, activeTest.id, "completed");

  for (const question of requiredQuestions) {
    await insertAnswerForQuestion(
      supabase,
      validAttemptId,
      question,
      answerOptionsByQuestionId,
      reportOverrides.get(question.code) ?? 0,
    );
  }

  if (EXPECTED_REPORT_BEHAVIOR === "unavailable") {
    await assertUnavailableBehavior(supabase, validAttemptId);
  } else {
    await assertSnapshotBehavior(supabase, validAttemptId);
  }

  console.log("Report flow verification passed.");
  console.log(`Verified incomplete attempt id: ${incompleteAttemptId}`);
  console.log(`Verified valid completed attempt id: ${validAttemptId}`);
  console.log("Verified behaviors:");
  console.log("- incomplete completed attempt does not generate or render a report");

  if (EXPECTED_REPORT_BEHAVIOR === "unavailable") {
    console.log("- fully answered completed attempt stays stable when report generation is unavailable");
  } else {
    console.log(`- fully answered completed attempt generates a persisted ${EXPECTED_REPORT_GENERATOR} report snapshot on first render`);
    console.log("- reload reuses the same generated_at timestamp instead of regenerating a new report");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
