import { createClient } from "@supabase/supabase-js";

const TARGET_TEST_SLUG = process.env.VERIFY_TEST_SLUG ?? "ipip50-hr-v1";
const EXPECTED_QUESTION_COUNT = 50;
const EXPECTED_OPTION_VALUES = [1, 2, 3, 4, 5];
const SUPPORTED_SCORING_METHODS = new Set(["likert_sum"]);

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
  const { data: targetTest, error: targetTestError } = await supabase
    .from("tests")
    .select("id, slug, name, scoring_method, is_active")
    .eq("slug", TARGET_TEST_SLUG)
    .maybeSingle();

  if (targetTestError) {
    fail(`Supabase query failed: ${targetTestError.message}`);
  }

  assert(Boolean(targetTest), `No test found for slug ${TARGET_TEST_SLUG}.`);
  assert(
    targetTest.is_active === true,
    `Expected ${TARGET_TEST_SLUG} to be active.`,
  );
  assert(
    SUPPORTED_SCORING_METHODS.has(targetTest.scoring_method),
    `Unsupported scoring method for ${TARGET_TEST_SLUG}: ${targetTest.scoring_method}.`,
  );

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, code, question_type")
    .eq("test_id", targetTest.id)
    .eq("is_active", true)
    .order("question_order", { ascending: true });

  if (questionsError) {
    fail(`Question verification failed: ${questionsError.message}`);
  }

  assert((questions?.length ?? 0) > 0, `${TARGET_TEST_SLUG} has no active questions.`);
  assert(
    (questions?.length ?? 0) === EXPECTED_QUESTION_COUNT,
    `Expected ${EXPECTED_QUESTION_COUNT} active questions, received ${questions?.length ?? 0}.`,
  );
  assert(
    (questions ?? []).every((question) => question.question_type === "single_choice"),
    `Expected all active questions to be single_choice for ${TARGET_TEST_SLUG}.`,
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

  assert((answerOptions?.length ?? 0) > 0, `${TARGET_TEST_SLUG} has no answer options.`);

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
  console.log("Verified test:", targetTest.slug);
  console.log("Verified test scoring method:", targetTest.scoring_method);
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
    .insert({ test_id: targetTest.id })
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
