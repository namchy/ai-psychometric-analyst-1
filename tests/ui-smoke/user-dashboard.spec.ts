import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginForDashboard } from "./auth";

test("candidate dashboard renders core smoke signal", async ({ page }, testInfo) => {
  await loginForDashboard(page, "candidate");
  await page.goto("/app");

  await expect(
    page.getByRole("heading", {
      name: "Integrisana procjena",
    }),
  ).toBeVisible();

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("user-dashboard.png"),
  });
});

const DEFAULT_CANDIDATE_EMAIL = process.env.PLAYWRIGHT_CANDIDATE_EMAIL ?? "user1@nesto.com";
const TARGET_TEST_SLUG = "safran_v1";
const DEFAULT_LOCALE = "bs";

type ParticipantRow = {
  id: string;
};

type TestRow = {
  id: string;
};

type QuestionRow = {
  id: string;
  code: string;
  question_type: "single_choice" | "multiple_choice" | "text";
  question_order: number;
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

async function prepareSafranResumeAttempt() {
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

  const participant = participantData as ParticipantRow;
  const assessment = testData as TestRow;
  const { data: questionData, error: questionError } = await supabase
    .from("questions")
    .select("id, code, question_type, question_order")
    .eq("test_id", assessment.id)
    .eq("is_active", true)
    .order("question_order", { ascending: true })
    .limit(3);

  if (questionError) {
    throw new Error(`Unable to load SAFRAN questions: ${questionError.message}.`);
  }

  const questions = (questionData ?? []) as QuestionRow[];

  if (questions.length < 3) {
    throw new Error("Expected at least 3 SAFRAN questions.");
  }

  const { count: totalQuestionCount, error: totalQuestionCountError } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("test_id", assessment.id)
    .eq("is_active", true);

  if (totalQuestionCountError) {
    throw new Error(`Unable to count SAFRAN questions: ${totalQuestionCountError.message}.`);
  }

  const { data: attemptData, error: attemptError } = await supabase
    .from("attempts")
    .insert({
      test_id: assessment.id,
      participant_id: participant.id,
      locale: DEFAULT_LOCALE,
      status: "in_progress",
    })
    .select("id")
    .single();

  if (attemptError || !attemptData) {
    throw new Error(`Unable to create SAFRAN attempt: ${attemptError?.message ?? "unknown error"}.`);
  }

  return {
    attemptId: String(attemptData.id),
    questions,
    totalQuestionCount: totalQuestionCount ?? questions.length,
    async cleanup() {
      await supabase.from("responses").delete().eq("attempt_id", attemptData.id);
      await supabase.from("attempts").delete().eq("id", attemptData.id);
    },
  };
}

async function answerCurrentSafranQuestion(page: import("@playwright/test").Page, question: QuestionRow) {
  if (question.question_type === "text") {
    await page.locator("input.assessment-text-input, textarea.assessment-textarea").fill(
      question.code.startsWith("NZ") ? "7" : "Odgovor",
    );
    return;
  }

  await page.locator(`input[name="${question.id}"]`).first().check();
}

test("candidate dashboard resumes SAFRAN scored attempt from the first unanswered question", async ({
  page,
}) => {
  const fixture = await prepareSafranResumeAttempt();

  try {
    await loginForDashboard(page, "candidate");
    await page.goto(`/app/attempts/${fixture.attemptId}/run?mode=scored`);

    await expect(page.getByText("Pitanje 1 od")).toBeVisible();

    await answerCurrentSafranQuestion(page, fixture.questions[0]);
    await page.getByRole("button", { name: "Nastavi" }).click();
    await expect(page.getByText("Pitanje 2 od")).toBeVisible();

    await answerCurrentSafranQuestion(page, fixture.questions[1]);
    await page.getByRole("button", { name: "Nastavi" }).click();
    await expect(page.getByText("Pitanje 3 od")).toBeVisible();

    await page.getByRole("button", { name: "Povratak na dashboard" }).click();
    await page.waitForURL("**/app");

    const progressLabel = `2 / ${fixture.totalQuestionCount} pitanja`;
    const attemptCard = page.locator("article").filter({
      has: page.getByText(progressLabel),
      hasText: "Nastavi procjenu",
    });

    await expect(attemptCard).toHaveCount(1);
    await attemptCard.getByRole("button", { name: "Nastavi procjenu" }).click();
    await page.waitForURL(`**/app/attempts/${fixture.attemptId}/run?mode=scored`);
    await expect(page.getByText("Pitanje 3 od")).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});
