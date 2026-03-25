import "server-only";

import { getQuestionsForTest } from "@/lib/assessment/tests";
import {
  getLinkedParticipantForUser,
  type ParticipantSummary,
} from "@/lib/b2b/organizations";
import type { AssessmentLocale } from "@/lib/assessment/locale";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CandidateAttemptRelation<T> = T | T[] | null;

type CandidateAttemptTestSummary = {
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
};

type CandidateAttemptParticipantSummary = {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
};

type CandidateAttemptOrganizationSummary = {
  name: string;
  slug: string;
};

type CandidateAttemptRow = {
  id: string;
  test_id: string;
  locale: AssessmentLocale;
  user_id: string | null;
  organization_id: string | null;
  participant_id: string | null;
  status: "in_progress" | "completed" | "abandoned";
  started_at: string;
  completed_at: string | null;
  total_time_seconds: number | null;
  tests: CandidateAttemptRelation<CandidateAttemptTestSummary>;
  participants: CandidateAttemptRelation<CandidateAttemptParticipantSummary>;
  organizations: CandidateAttemptRelation<CandidateAttemptOrganizationSummary>;
};

type AttemptResponseRow = {
  attempt_id: string;
};

export type CandidateAttemptLifecycle =
  | "in_progress"
  | "not_started"
  | "completed"
  | "abandoned";

export type CandidateAttemptSummary = {
  id: string;
  test_id: string;
  locale: AssessmentLocale;
  user_id: string | null;
  organization_id: string | null;
  participant_id: string | null;
  status: "in_progress" | "completed" | "abandoned";
  lifecycle: CandidateAttemptLifecycle;
  started_at: string;
  completed_at: string | null;
  total_time_seconds: number | null;
  responseCount: number;
  tests: CandidateAttemptTestSummary | null;
  participants: CandidateAttemptParticipantSummary | null;
  organizations: CandidateAttemptOrganizationSummary | null;
};

export type CandidateAttemptLookup = {
  linkedParticipant: ParticipantSummary | null;
  attempts: CandidateAttemptSummary[];
  primaryAttempt: CandidateAttemptSummary | null;
};

function normalizeRelation<T>(value: CandidateAttemptRelation<T>): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function getCandidateAttemptLifecycle(
  attempt: Pick<CandidateAttemptSummary, "status" | "responseCount">,
): CandidateAttemptLifecycle {
  if (attempt.status === "completed") {
    return "completed";
  }

  if (attempt.status === "abandoned") {
    return "abandoned";
  }

  return attempt.responseCount > 0 ? "in_progress" : "not_started";
}

function getPrimaryAttemptPriority(lifecycle: CandidateAttemptLifecycle): number {
  switch (lifecycle) {
    case "in_progress":
      return 0;
    case "not_started":
      return 1;
    case "completed":
      return 2;
    default:
      return 3;
  }
}

function getAttemptSortTimestamp(attempt: CandidateAttemptSummary): number {
  return Date.parse(attempt.completed_at ?? attempt.started_at);
}

function selectPrimaryCandidateAttempt(
  attempts: CandidateAttemptSummary[],
): CandidateAttemptSummary | null {
  if (attempts.length === 0) {
    return null;
  }

  return [...attempts].sort((left, right) => {
    // Transitional heuristic for the single-entry candidate home:
    // resume a started attempt first, otherwise offer an untouched open attempt,
    // and only fall back to the latest completed report when no open work exists.
    const priorityDifference =
      getPrimaryAttemptPriority(left.lifecycle) - getPrimaryAttemptPriority(right.lifecycle);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return getAttemptSortTimestamp(right) - getAttemptSortTimestamp(left);
  })[0] ?? null;
}

async function getResponseCountsForAttemptIds(
  attemptIds: string[],
): Promise<Map<string, number>> {
  if (attemptIds.length === 0) {
    return new Map();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("responses")
    .select("attempt_id")
    .in("attempt_id", attemptIds);

  if (error) {
    throw new Error(`Failed to load candidate attempt responses: ${error.message}`);
  }

  return ((data ?? []) as AttemptResponseRow[]).reduce((counts, response) => {
    counts.set(response.attempt_id, (counts.get(response.attempt_id) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
}

function mapCandidateAttemptSummary(
  attemptRow: CandidateAttemptRow,
  responseCount: number,
): CandidateAttemptSummary {
  const attempt: CandidateAttemptSummary = {
    ...attemptRow,
    responseCount,
    lifecycle: "not_started",
    tests: normalizeRelation(attemptRow.tests),
    participants: normalizeRelation(attemptRow.participants),
    organizations: normalizeRelation(attemptRow.organizations),
  };

  attempt.lifecycle = getCandidateAttemptLifecycle(attempt);
  return attempt;
}

async function getCandidateAttemptsForParticipantId(
  participantId: string,
): Promise<CandidateAttemptSummary[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attempts")
    .select(
      "id, test_id, locale, user_id, organization_id, participant_id, status, started_at, completed_at, total_time_seconds, tests(slug, name, description, duration_minutes), participants(id, organization_id, full_name, email), organizations(name, slug)",
    )
    .eq("participant_id", participantId)
    .order("started_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw new Error(`Failed to load candidate attempts: ${error.message}`);
  }

  const attemptRows = (data ?? []) as CandidateAttemptRow[];
  const responseCounts = await getResponseCountsForAttemptIds(attemptRows.map((attempt) => attempt.id));

  return attemptRows.map((attempt) =>
    mapCandidateAttemptSummary(attempt, responseCounts.get(attempt.id) ?? 0),
  );
}

export async function getCandidateAttemptLookupForUser(
  userId: string,
): Promise<CandidateAttemptLookup> {
  const linkedParticipant = await getLinkedParticipantForUser(userId);

  if (!linkedParticipant) {
    return {
      linkedParticipant: null,
      attempts: [],
      primaryAttempt: null,
    };
  }

  const attempts = await getCandidateAttemptsForParticipantId(linkedParticipant.id);

  return {
    linkedParticipant,
    attempts,
    primaryAttempt: selectPrimaryCandidateAttempt(attempts),
  };
}

export async function getCandidateAttemptForUser(
  userId: string,
  attemptId: string,
): Promise<CandidateAttemptSummary | null> {
  const lookup = await getCandidateAttemptLookupForUser(userId);

  if (!lookup.linkedParticipant) {
    return null;
  }

  return lookup.attempts.find((attempt) => attempt.id === attemptId) ?? null;
}

export async function getCandidateAttemptQuestionCount(testId: string): Promise<number> {
  const questions = await getQuestionsForTest(testId);
  return questions.length;
}
