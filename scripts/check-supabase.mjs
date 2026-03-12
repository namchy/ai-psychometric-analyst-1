import { createClient } from "@supabase/supabase-js";

const EXPECTED_ACTIVE_TEST_SLUG = "ipip50-hr-v1";
const EXPECTED_QUESTION_COUNT = 50;
const EXPECTED_OPTION_VALUES = [1, 2, 3, 4, 5];

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishableKey) {
    fail("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local");
  }

  const supabase = createClient(url, publishableKey);
  const { data: activeTest, error: activeTestError } = await supabase
    .from("tests")
    .select("id, slug, name")
    .eq("is_active", true)
    .maybeSingle();

  if (activeTestError) {
    fail(`Supabase query failed: ${activeTestError.message}`);
  }

  if (!activeTest) {
    fail("No active test found.");
  }

  assert(
    activeTest.slug === EXPECTED_ACTIVE_TEST_SLUG,
    `Expected active test slug ${EXPECTED_ACTIVE_TEST_SLUG}, received ${activeTest.slug}.`,
  );

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, code, question_type")
    .eq("test_id", activeTest.id)
    .eq("is_active", true)
    .order("question_order", { ascending: true });

  if (questionsError) {
    fail(`Question verification failed: ${questionsError.message}`);
  }

  assert(
    (questions?.length ?? 0) === EXPECTED_QUESTION_COUNT,
    `Expected ${EXPECTED_QUESTION_COUNT} active questions, received ${questions?.length ?? 0}.`,
  );
  assert(
    (questions ?? []).every((question) => question.question_type === "single_choice"),
    "Expected all active questions to be single_choice for ipip50-hr-v1.",
  );

  const questionIds = (questions ?? []).map((question) => question.id);
  const { data: answerOptions, error: answerOptionsError } = await supabase
    .from("answer_options")
    .select("question_id, value, option_order")
    .in("question_id", questionIds)
    .order("question_id", { ascending: true })
    .order("option_order", { ascending: true });

  if (answerOptionsError) {
    fail(`Answer option verification failed: ${answerOptionsError.message}`);
  }

  const optionsByQuestionId = (answerOptions ?? []).reduce((groupedOptions, option) => {
    const questionOptions = groupedOptions.get(option.question_id) ?? [];
    questionOptions.push(option);
    groupedOptions.set(option.question_id, questionOptions);
    return groupedOptions;
  }, new Map());

  for (const question of questions ?? []) {
    const questionOptions = optionsByQuestionId.get(question.id) ?? [];
    assert(
      questionOptions.length === EXPECTED_OPTION_VALUES.length,
      `Expected ${EXPECTED_OPTION_VALUES.length} options for ${question.code}, received ${questionOptions.length}.`,
    );

    const numericValues = questionOptions.map((option) => option.value);
    assert(
      numericValues.join(",") === EXPECTED_OPTION_VALUES.join(","),
      `Expected option values ${EXPECTED_OPTION_VALUES.join(",")} for ${question.code}, received ${numericValues.join(",")}.`,
    );
  }

  console.log("Supabase read checks passed.");
  console.log("Active test:", activeTest.slug);
  console.log("Verified question count:", questions.length);

  if (!serviceRoleKey) {
    fail("Missing SUPABASE_SERVICE_ROLE_KEY in the server environment");
  }

  const adminSupabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: attemptData, error: attemptError } = await adminSupabase
    .from("attempts")
    .insert({ test_id: activeTest.id })
    .select("id")
    .single();

  if (attemptError || !attemptData) {
    fail(`Supabase admin write check failed: ${attemptError?.message ?? "Unknown error"}`);
  }

  const { error: cleanupError } = await adminSupabase
    .from("attempts")
    .delete()
    .eq("id", attemptData.id);

  if (cleanupError) {
    fail(`Supabase admin cleanup failed: ${cleanupError.message}`);
  }

  console.log("Supabase admin write check passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
