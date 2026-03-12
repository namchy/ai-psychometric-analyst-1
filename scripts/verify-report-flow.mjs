import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";

const APP_URL = process.env.APP_URL ?? "http://localhost:3100";
const ATTEMPT_COOKIE_NAME = "assessment_attempt_id";
const HEALTH_URL = `${APP_URL}/api/health`;
const EXPECTED_ACTIVE_TEST_SLUG = "ipip50-hr-v1";
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

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, code")
    .eq("test_id", activeTest.id)
    .in("code", REPORT_CASES.map((reportCase) => reportCase.code));

  if (questionsError || !questions) {
    fail(
      `Unable to load report verification questions: ${questionsError?.message ?? "Unknown error"}`,
    );
  }

  const questionByCode = new Map(questions.map((question) => [question.code, question]));

  const { data: answerOptions, error: answerOptionsError } = await supabase
    .from("answer_options")
    .select("id, question_id, option_order")
    .in("question_id", questions.map((question) => question.id))
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

  const { data: attemptData, error: attemptError } = await supabase
    .from("attempts")
    .insert({ test_id: activeTest.id, status: "completed", completed_at: new Date().toISOString() })
    .select("id")
    .single();

  if (attemptError || !attemptData) {
    fail(`Unable to create completed attempt: ${attemptError?.message ?? "Unknown error"}`);
  }

  const attemptId = attemptData.id;
  const responseRows = REPORT_CASES.map((reportCase) => {
    const question = questionByCode.get(reportCase.code);

    if (!question) {
      fail(`Expected seeded question ${reportCase.code} was not found.`);
    }

    const options = answerOptionsByQuestionId.get(question.id) ?? [];
    const selectedOption = options[reportCase.optionIndex];

    if (!selectedOption) {
      fail(`Expected option index ${reportCase.optionIndex} for ${reportCase.code}.`);
    }

    return {
      attempt_id: attemptId,
      question_id: question.id,
      response_kind: "single_choice",
      answer_option_id: selectedOption.id,
    };
  });

  const { error: responseError } = await supabase.from("responses").insert(responseRows);

  if (responseError) {
    fail(`Unable to create report verification responses: ${responseError.message}`);
  }

  const firstHtml = await fetchAssessmentPage(attemptId);
  assertIncludes(firstHtml, "Mock report", "Expected mock report section to render.");
  assertIncludes(firstHtml, "Generator:", "Expected mock generator label to render.");
  assertIncludes(firstHtml, "Snapshot generated at", "Expected report timestamp label to render.");
  assertIncludes(firstHtml, "Strengths", "Expected strengths section to render.");
  assertIncludes(firstHtml, "Blind spots", "Expected blind spots section to render.");
  assertIncludes(
    firstHtml,
    "Development recommendations",
    "Expected recommendations section to render.",
  );

  const { data: firstReportRow, error: firstReportError } = await supabase
    .from("attempt_reports")
    .select("generated_at, generator_type, report_snapshot")
    .eq("attempt_id", attemptId)
    .single();

  if (firstReportError || !firstReportRow) {
    fail(
      `Unable to load persisted report snapshot: ${firstReportError?.message ?? "Unknown error"}`,
    );
  }

  if (firstReportRow.generator_type !== "mock") {
    fail(`Expected persisted generator_type mock, received ${firstReportRow.generator_type}.`);
  }

  if (firstReportRow.report_snapshot?.generator_type !== "mock") {
    fail("Expected persisted report snapshot to include generator_type mock.");
  }

  const firstGeneratedAt = firstReportRow.generated_at;
  const secondHtml = await fetchAssessmentPage(attemptId);
  assertIncludes(secondHtml, "Mock report", "Expected mock report section to remain on reload.");
  assertIncludes(secondHtml, "Generator:", "Expected generator label to remain on reload.");

  const { data: secondReportRow, error: secondReportError } = await supabase
    .from("attempt_reports")
    .select("generated_at")
    .eq("attempt_id", attemptId)
    .single();

  if (secondReportError || !secondReportRow) {
    fail(
      `Unable to reload persisted report snapshot: ${secondReportError?.message ?? "Unknown error"}`,
    );
  }

  if (secondReportRow.generated_at !== firstGeneratedAt) {
    fail("Expected report snapshot to stay stable on reload without regeneration.");
  }

  console.log("Report flow verification passed.");
  console.log(`Verified attempt id: ${attemptId}`);
  console.log("Verified behaviors:");
  console.log("- completed attempt generates a persisted mock report snapshot on first render");
  console.log("- report snapshot is stored in attempt_reports with generator_type mock");
  console.log("- reload reuses the same generated_at timestamp instead of regenerating a new report");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
