import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CandidateAttemptSummary } from "@/lib/candidate/attempts";
import {
  buildAssessmentCardsFromTests,
  mapInitialAttemptsToDashboardAttempts,
  type CandidateDashboardInitialAttempt,
  type CandidateDashboardPreparedData,
  type DashboardOrganizationTestAccessRow,
  type DashboardTestRow,
} from "@/lib/dashboard/candidate-dashboard-model";

type DashboardQuestionRow = {
  test_id: string;
};

type DashboardDimensionScoreRow = {
  attempt_id: string;
  normalized_score: number | string | null;
};

type DashboardResponseRow = {
  attempt_id: string;
  answered_at: string | null;
};

function mapCandidateAttemptsToDashboardInitialAttempts(
  attempts: CandidateAttemptSummary[],
): CandidateDashboardInitialAttempt[] {
  return attempts.map((attempt) => ({
    id: attempt.id,
    test_id: attempt.test_id,
    status: attempt.status,
    responseCount: attempt.responseCount,
    started_at: attempt.started_at,
    scored_started_at: attempt.scored_started_at,
    created_at: attempt.started_at,
    updated_at: attempt.completed_at ?? attempt.started_at,
    completed_at: attempt.completed_at,
    total_time_seconds: attempt.total_time_seconds,
  }));
}

export function getEmptyCandidateDashboardData(): CandidateDashboardPreparedData {
  return {
    assessments: [],
    completedAttempts: 0,
    totalPaidTestsCount: 0,
    totalTimeSeconds: 0,
    averageNormalizedScore: 0,
  };
}

export async function getCandidateDashboardData({
  attempts,
  organizationId,
}: {
  attempts: CandidateAttemptSummary[];
  organizationId: string;
}): Promise<CandidateDashboardPreparedData> {
  const supabase = createSupabaseAdminClient();
  const initialAttempts = mapCandidateAttemptsToDashboardInitialAttempts(attempts);
  const mappedAttempts = mapInitialAttemptsToDashboardAttempts(initialAttempts);
  const attemptIds = mappedAttempts.map((attempt) => attempt.id);
  const [
    { data: testsData, error: testsError },
    { data: accessData, error: accessError },
  ] = await Promise.all([
    supabase
      .from("tests")
      .select(
        "id, slug, name, category, description, status, scoring_method, duration_minutes, is_active",
      )
      .order("created_at", { ascending: true }),
    supabase
      .from("organization_test_access")
      .select("organization_id, test_id")
      .eq("organization_id", organizationId),
  ]);

  if (testsError) {
    throw new Error(`Failed to load dashboard tests: ${testsError.message}`);
  }

  if (accessError) {
    throw new Error(`Failed to load dashboard access rows: ${accessError.message}`);
  }

  const testRows = (testsData ?? []) as DashboardTestRow[];
  const accessRows = (accessData ?? []) as DashboardOrganizationTestAccessRow[];
  const testIds = testRows.map((test) => test.id);

  let questionRows: DashboardQuestionRow[] = [];

  if (testIds.length > 0) {
    const { data: questionsData, error: questionsError } = await supabase
      .from("questions")
      .select("test_id")
      .in("test_id", testIds)
      .eq("is_active", true);

    if (questionsError) {
      throw new Error(`Failed to load dashboard questions: ${questionsError.message}`);
    }

    questionRows = (questionsData ?? []) as DashboardQuestionRow[];
  }

  let dimensionScoreRows: DashboardDimensionScoreRow[] = [];
  let responseRows: DashboardResponseRow[] = [];

  if (attemptIds.length > 0) {
    const [
      { data: dimensionScoresData, error: dimensionScoresError },
      { data: responsesData, error: responsesError },
    ] = await Promise.all([
      supabase
        .from("dimension_scores")
        .select("attempt_id, normalized_score")
        .in("attempt_id", attemptIds),
      supabase
        .from("responses")
        .select("attempt_id, answered_at")
        .in("attempt_id", attemptIds),
    ]);

    if (dimensionScoresError) {
      throw new Error(
        `Failed to load dashboard dimension scores: ${dimensionScoresError.message}`,
      );
    }

    if (responsesError) {
      throw new Error(`Failed to load dashboard responses: ${responsesError.message}`);
    }

    dimensionScoreRows = (dimensionScoresData ?? []) as DashboardDimensionScoreRow[];
    responseRows = (responsesData ?? []) as DashboardResponseRow[];
  }

  const questionCountsByTestId = questionRows.reduce((counts, question) => {
    counts.set(question.test_id, (counts.get(question.test_id) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const lastAnsweredAtByAttemptId = responseRows.reduce((timestamps, response) => {
    if (!response.answered_at) {
      return timestamps;
    }

    const previousTimestamp = timestamps.get(response.attempt_id);

    if (!previousTimestamp || Date.parse(response.answered_at) > Date.parse(previousTimestamp)) {
      timestamps.set(response.attempt_id, response.answered_at);
    }

    return timestamps;
  }, new Map<string, string>());
  const attemptsWithActivity = mappedAttempts.map((attempt) => ({
    ...attempt,
    last_answered_at: lastAnsweredAtByAttemptId.get(attempt.id) ?? null,
  }));
  const normalizedScores = dimensionScoreRows
    .map((score) =>
      score.normalized_score === null ? null : Number(score.normalized_score),
    )
    .filter((score): score is number => Number.isFinite(score));

  return {
    assessments: buildAssessmentCardsFromTests(
      testRows,
      attemptsWithActivity,
      accessRows,
      questionCountsByTestId,
    ),
    completedAttempts: mappedAttempts.filter((attempt) => attempt.status === "completed").length,
    totalPaidTestsCount: accessRows.length,
    totalTimeSeconds: mappedAttempts.reduce(
      (sum, attempt) => sum + (attempt.total_time_seconds ?? 0),
      0,
    ),
    averageNormalizedScore:
      normalizedScores.length > 0
        ? normalizedScores.reduce((sum, score) => sum + score, 0) / normalizedScores.length
        : 0,
  };
}
