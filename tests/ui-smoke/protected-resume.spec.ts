import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginForDashboard } from "./auth";

const TARGET_TEST_SLUG = process.env.VERIFY_TEST_SLUG ?? "ipip-neo-120-v1";
const DEFAULT_CANDIDATE_EMAIL = process.env.PLAYWRIGHT_CANDIDATE_EMAIL ?? "user1@nesto.com";
const DEFAULT_LOCALE = "bs";

type ParticipantRow = {
  id: string;
};

type TestRow = {
  id: string;
};

type QuestionRow = {
  id: string;
  text: string;
  question_order: number;
};

type AnswerOptionRow = {
  id: string;
  question_id: string;
  option_order: number;
};

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}.`);
  }

  return value;
}

function createServiceSupabase() {
  return createClient(
    readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

async function prepareProtectedResumeAttempt() {
  const supabase = createServiceSupabase();
  const { data: participantData, error: participantError } = await supabase
    .from("participants")
    .select("id")
    .eq("email", DEFAULT_CANDIDATE_EMAIL)
    .maybeSingle();

  if (participantError || !(participantData as ParticipantRow | null)) {
    throw new Error(
      `Unable to resolve participant for ${DEFAULT_CANDIDATE_EMAIL}: ${participantError?.message ?? "not found"}.`,
    );
  }

  const participant = participantData as ParticipantRow;
  const { data: testData, error: testError } = await supabase
    .from("tests")
    .select("id")
    .eq("slug", TARGET_TEST_SLUG)
    .maybeSingle();

  if (testError || !(testData as TestRow | null)) {
    throw new Error(
      `Unable to resolve test ${TARGET_TEST_SLUG}: ${testError?.message ?? "not found"}.`,
    );
  }

  const assessment = testData as TestRow;
  const { data: questionData, error: questionError } = await supabase
    .from("questions")
    .select("id, text, question_order")
    .eq("test_id", assessment.id)
    .order("question_order", { ascending: true })
    .limit(4);

  if (questionError) {
    throw new Error(`Unable to load questions for ${TARGET_TEST_SLUG}: ${questionError.message}.`);
  }

  const questions = (questionData ?? []) as QuestionRow[];

  if (questions.length < 4) {
    throw new Error(`Expected at least 4 questions for ${TARGET_TEST_SLUG}.`);
  }

  const { count: totalQuestionCount, error: totalQuestionCountError } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("test_id", assessment.id);

  if (totalQuestionCountError) {
    throw new Error(
      `Unable to count questions for ${TARGET_TEST_SLUG}: ${totalQuestionCountError.message}.`,
    );
  }

  const { data: attemptData, error: attemptError } = await supabase
    .from("attempts")
    .insert({
      test_id: assessment.id,
      participant_id: participant.id,
      locale: DEFAULT_LOCALE,
    })
    .select("id")
    .single();

  if (attemptError || !attemptData) {
    throw new Error(`Unable to create protected resume attempt: ${attemptError?.message ?? "unknown error"}.`);
  }

  const attemptId = attemptData.id as string;
  const { data: answerOptionData, error: answerOptionError } = await supabase
    .from("answer_options")
    .select("id, question_id, option_order")
    .in(
      "question_id",
      questions.slice(0, 3).map((question) => question.id),
    )
    .order("option_order", { ascending: true });

  if (answerOptionError) {
    throw new Error(`Unable to load answer options: ${answerOptionError.message}.`);
  }

  const answerOptions = (answerOptionData ?? []) as AnswerOptionRow[];
  const answerOptionIdsByQuestionId = answerOptions.reduce((lookup, option) => {
    const optionsForQuestion = lookup.get(option.question_id) ?? [];
    optionsForQuestion.push(option.id);
    lookup.set(option.question_id, optionsForQuestion);
    return lookup;
  }, new Map<string, string[]>());

  return {
    attemptId,
    questions,
    totalQuestionCount: totalQuestionCount ?? questions.length,
    answerOptionIdsByQuestionId,
    async cleanup() {
      await supabase.from("attempts").delete().eq("id", attemptId);
    },
  };
}

test("protected resume continues from the first unanswered question without refresh", async ({
  page,
}) => {
  const fixture = await prepareProtectedResumeAttempt();

  try {
    await loginForDashboard(page, "candidate");
    await page.goto(`/app/attempts/${fixture.attemptId}/run`);

    await expect(page.getByText("Pitanje 1 od")).toBeVisible();

    for (let index = 0; index < 3; index += 1) {
      const question = fixture.questions[index];
      const optionIds = fixture.answerOptionIdsByQuestionId.get(question.id) ?? [];

      expect(optionIds.length).toBeGreaterThanOrEqual(3);
      await page.locator(`input[type="radio"][name="${question.id}"]`).nth(2).check();
    }

    await expect(page.getByText("Pitanje 4 od")).toBeVisible();

    await page.getByRole("button", { name: "Povratak na dashboard" }).click();
    await page.waitForURL("**/app");

    const progressLabel = `3 / ${fixture.totalQuestionCount} pitanja`;
    const attemptCard = page.locator("article").filter({
      has: page.getByText(progressLabel),
      hasText: "Nastavi procjenu",
    });

    await expect(attemptCard).toHaveCount(1);
    await attemptCard.getByRole("button", { name: "Nastavi procjenu" }).click();
    await page.waitForURL(`**/app/attempts/${fixture.attemptId}/run`);

    await expect(page.getByText("Pitanje 4 od")).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});

test("protected IPIP back navigation preserves visibly selected answers", async ({
  page,
}) => {
  const fixture = await prepareProtectedResumeAttempt();

  try {
    await loginForDashboard(page, "candidate");
    await page.goto(`/app/attempts/${fixture.attemptId}/run`);

    const firstQuestion = fixture.questions[0];
    const secondQuestion = fixture.questions[1];

    const firstQuestionChoice = page.locator(`input[type="radio"][name="${firstQuestion.id}"]`).nth(2);
    const secondQuestionChoice = page.locator(`input[type="radio"][name="${secondQuestion.id}"]`).nth(1);
    const firstQuestionChoiceCard = firstQuestionChoice.locator("..");
    const secondQuestionChoiceCard = secondQuestionChoice.locator("..");

    await expect(page.getByText("Pitanje 1 od")).toBeVisible();
    await firstQuestionChoice.check();
    await expect(page.getByText("Pitanje 2 od")).toBeVisible();

    await secondQuestionChoice.check();
    await expect(page.getByText("Pitanje 3 od")).toBeVisible();

    await page.getByRole("button", { name: "Nazad" }).click();
    await expect(page.getByText("Pitanje 2 od")).toBeVisible();
    await expect(secondQuestionChoice).toBeChecked();
    await expect(secondQuestionChoiceCard).toHaveClass(/assessment-likert-option--selected/);

    await page.getByRole("button", { name: "Nazad" }).click();
    await expect(page.getByText("Pitanje 1 od")).toBeVisible();
    await expect(firstQuestionChoice).toBeChecked();
    await expect(firstQuestionChoiceCard).toHaveClass(/assessment-likert-option--selected/);

    await firstQuestionChoice.click();
    await expect(page.getByText("Pitanje 2 od")).toBeVisible();
    await expect(secondQuestionChoice).toBeChecked();

    await page.getByRole("button", { name: "Nazad na dashboard" }).click();
    await page.waitForURL("**/app");

    const progressLabel = `2 / ${fixture.totalQuestionCount} pitanja`;
    const attemptCard = page.locator("article").filter({
      has: page.getByText(progressLabel),
      hasText: "Nastavi procjenu",
    });

    await expect(attemptCard).toHaveCount(1);
    await attemptCard.getByRole("button", { name: "Nastavi procjenu" }).click();
    await page.waitForURL(`**/app/attempts/${fixture.attemptId}/run`);

    await expect(page.getByText("Pitanje 3 od")).toBeVisible();
    await page.getByRole("button", { name: "Nazad" }).click();
    await expect(page.getByText("Pitanje 2 od")).toBeVisible();
    await expect(secondQuestionChoice).toBeChecked();
    await expect(secondQuestionChoiceCard).toHaveClass(/assessment-likert-option--selected/);
  } finally {
    await fixture.cleanup();
  }
});
