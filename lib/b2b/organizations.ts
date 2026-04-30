import "server-only";

import { getAssessmentAttemptLifecycle, type AssessmentAttemptLifecycle } from "@/lib/assessment/attempt-lifecycle";
import { STANDARD_ASSESSMENT_BATTERY_SLUGS } from "@/lib/assessment/standard-battery";
import type { AssessmentLocale } from "@/lib/assessment/locale";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "inactive";
};

export type MembershipSummary = {
  id: string;
  role: "org_owner" | "hr_admin" | "manager";
  status: "active" | "invited" | "disabled";
  created_at: string;
  organization: OrganizationSummary | null;
};

export type ParticipantSummary = {
  id: string;
  organization_id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  participant_type: "employee" | "candidate";
  status: "active" | "inactive";
  created_at: string;
};

export type OrganizationAvailableTestSummary = {
  id: string;
  slug: string;
  name: string;
};

export type OrganizationRunnableStandardBatteryTestSummary = {
  id: string;
  slug: (typeof STANDARD_ASSESSMENT_BATTERY_SLUGS)[number];
  name: string;
};

export type OrganizationScopedAttemptSummary = {
  id: string;
  test_id: string;
  locale: AssessmentLocale;
  user_id: string | null;
  organization_id: string | null;
  participant_id: string | null;
  status: "in_progress" | "completed" | "abandoned";
  started_at: string;
  scored_started_at: string | null;
  completed_at: string | null;
  responseCount: number;
  lifecycle: AssessmentAttemptLifecycle;
  tests: {
    slug: string;
    name: string;
  } | null;
  participants: {
    id: string;
    organization_id: string;
    full_name: string;
    email: string;
  } | null;
  organizations: {
    name: string;
    slug: string;
  } | null;
};

type AttemptRelation<T> = T | T[] | null;

type MembershipRow = {
  id: string;
  role: MembershipSummary["role"];
  status: MembershipSummary["status"];
  created_at: string;
  organizations:
    | OrganizationSummary
    | OrganizationSummary[]
    | null;
};

type OrganizationTestAccessRow = {
  test_id: string;
  tests:
    | OrganizationAvailableTestSummary
    | OrganizationAvailableTestSummary[]
    | null;
};

type AttemptRow = {
  id: string;
  test_id: string;
  locale: AssessmentLocale;
  user_id: string | null;
  organization_id: string | null;
  participant_id: string | null;
  status: OrganizationScopedAttemptSummary["status"];
  started_at: string;
  scored_started_at: string | null;
  completed_at: string | null;
  tests: AttemptRelation<OrganizationScopedAttemptSummary["tests"] extends infer T ? NonNullable<T> : never>;
  participants: AttemptRelation<
    OrganizationScopedAttemptSummary["participants"] extends infer T ? NonNullable<T> : never
  >;
  organizations: AttemptRelation<
    OrganizationScopedAttemptSummary["organizations"] extends infer T ? NonNullable<T> : never
  >;
};

type AttemptResponseRow = {
  attempt_id: string;
};

type OrganizationRunnableStandardBatteryTestRow = {
  test_id: string;
  tests:
    | {
        id: string;
        slug: string;
        name: string;
        status: string;
        is_active: boolean;
      }
    | Array<{
        id: string;
        slug: string;
        name: string;
        status: string;
        is_active: boolean;
      }>
    | null;
};

function normalizeOrganization(
  value: MembershipRow["organizations"],
): OrganizationSummary | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeAttemptRelation<T>(value: AttemptRelation<T>): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function isLegacyIcarTest(test: OrganizationAvailableTestSummary): boolean {
  const normalizedSlug = test.slug.toLowerCase();
  const normalizedName = test.name.toLowerCase();

  return normalizedSlug.includes("icar") || normalizedName.includes("icar");
}

function isMissingScoredStartedAtColumnError(message: string | undefined): boolean {
  return typeof message === "string" && message.includes("scored_started_at");
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
    throw new Error(`Failed to load organization attempt responses: ${error.message}`);
  }

  return ((data ?? []) as AttemptResponseRow[]).reduce((counts, response) => {
    counts.set(response.attempt_id, (counts.get(response.attempt_id) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
}

function mapOrganizationAttemptSummary(
  attemptRow: AttemptRow,
  responseCount: number,
): OrganizationScopedAttemptSummary {
  const tests = normalizeAttemptRelation(attemptRow.tests);

  return {
    ...attemptRow,
    responseCount,
    lifecycle: getAssessmentAttemptLifecycle({
      status: attemptRow.status,
      responseCount,
      testSlug: tests?.slug,
      scoredStartedAt: attemptRow.scored_started_at,
    }),
    tests,
    participants: normalizeAttemptRelation(attemptRow.participants),
    organizations: normalizeAttemptRelation(attemptRow.organizations),
  };
}

export async function getMembershipsForUser(userId: string): Promise<MembershipSummary[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("id, role, status, created_at, organizations(id, name, slug, status)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Failed to load organization memberships: ${error.message}`);
  }

  return ((data ?? []) as MembershipRow[]).map((membership) => ({
    id: membership.id,
    role: membership.role,
    status: membership.status,
    created_at: membership.created_at,
    organization: normalizeOrganization(membership.organizations),
  }));
}

export async function getActiveOrganizationForUser(
  userId: string,
): Promise<OrganizationSummary | null> {
  const memberships = await getMembershipsForUser(userId);

  const activeMembership = memberships.find(
    (membership) =>
      membership.status === "active" && membership.organization?.status === "active",
  );

  return activeMembership?.organization ?? null;
}

export async function getParticipantsForOrganization(
  organizationId: string,
): Promise<ParticipantSummary[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("participants")
    .select("id, organization_id, user_id, email, full_name, participant_type, status, created_at")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Failed to load organization participants: ${error.message}`);
  }

  return (data ?? []) as ParticipantSummary[];
}

export async function getParticipantForOrganization(
  organizationId: string,
  participantId: string,
): Promise<ParticipantSummary | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("participants")
    .select("id, organization_id, user_id, email, full_name, participant_type, status, created_at")
    .eq("organization_id", organizationId)
    .eq("id", participantId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load organization participant: ${error.message}`);
  }

  return (data as ParticipantSummary | null) ?? null;
}

export async function getAvailableTestsForOrganization(
  organizationId: string,
): Promise<OrganizationAvailableTestSummary[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("organization_test_access")
    .select("test_id, tests(id, slug, name)")
    .eq("organization_id", organizationId)
    .order("test_id", { ascending: true });

  if (error) {
    throw new Error(`Failed to load organization test access: ${error.message}`);
  }

  return ((data ?? []) as OrganizationTestAccessRow[])
    .map((row) => normalizeAttemptRelation(row.tests))
    .filter((test): test is OrganizationAvailableTestSummary => !!test)
    .filter((test) => !isLegacyIcarTest(test))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function getRunnableStandardBatteryTestsForOrganization(
  organizationId: string,
): Promise<OrganizationRunnableStandardBatteryTestSummary[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("organization_test_access")
    .select("test_id, tests(id, slug, name, status, is_active)")
    .eq("organization_id", organizationId)
    .order("test_id", { ascending: true });

  if (error) {
    throw new Error(`Failed to load organization standard battery access: ${error.message}`);
  }

  const candidateTests = ((data ?? []) as OrganizationRunnableStandardBatteryTestRow[])
    .map((row) => normalizeAttemptRelation(row.tests))
    .filter(
      (
        test,
      ): test is {
        id: string;
        slug: string;
        name: string;
        status: string;
        is_active: boolean;
      } => !!test,
    )
    .filter(
      (test) =>
        STANDARD_ASSESSMENT_BATTERY_SLUGS.includes(
          test.slug as (typeof STANDARD_ASSESSMENT_BATTERY_SLUGS)[number],
        ) &&
        test.status === "active" &&
        test.is_active === true,
    );

  if (candidateTests.length === 0) {
    return [];
  }

  const { data: questionRows, error: questionError } = await supabase
    .from("questions")
    .select("test_id")
    .in(
      "test_id",
      candidateTests.map((test) => test.id),
    )
    .eq("is_active", true);

  if (questionError) {
    throw new Error(`Failed to load standard battery questions: ${questionError.message}`);
  }

  const activeQuestionTestIds = new Set((questionRows ?? []).map((row) => String(row.test_id)));
  const orderLookup = new Map(STANDARD_ASSESSMENT_BATTERY_SLUGS.map((slug, index) => [slug, index]));

  return candidateTests
    .filter((test) => activeQuestionTestIds.has(test.id))
    .map((test) => ({
      id: test.id,
      slug: test.slug as (typeof STANDARD_ASSESSMENT_BATTERY_SLUGS)[number],
      name: test.name,
    }))
    .sort(
      (left, right) =>
        (orderLookup.get(left.slug) ?? Number.MAX_SAFE_INTEGER) -
        (orderLookup.get(right.slug) ?? Number.MAX_SAFE_INTEGER),
    );
}

export async function getLinkedParticipantForUser(
  userId: string,
): Promise<ParticipantSummary | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("participants")
    .select("id, organization_id, user_id, email, full_name, participant_type, status, created_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load linked participant: ${error.message}`);
  }

  return (data as ParticipantSummary | null) ?? null;
}

export async function getAttemptForOrganization(
  organizationId: string,
  attemptId: string,
): Promise<OrganizationScopedAttemptSummary | null> {
  const supabase = createSupabaseAdminClient();
  let { data, error } = await supabase
    .from("attempts")
    .select(
      "id, test_id, locale, user_id, organization_id, participant_id, status, started_at, scored_started_at, completed_at, tests(slug, name), participants(id, organization_id, full_name, email), organizations(name, slug)",
    )
    .eq("id", attemptId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error && isMissingScoredStartedAtColumnError(error.message)) {
    const fallbackResult = await supabase
      .from("attempts")
      .select(
        "id, test_id, locale, user_id, organization_id, participant_id, status, started_at, completed_at, tests(slug, name), participants(id, organization_id, full_name, email), organizations(name, slug)",
      )
      .eq("id", attemptId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    data = fallbackResult.data
      ? {
          ...fallbackResult.data,
          scored_started_at: null,
        }
      : null;
    error = fallbackResult.error;
  }

  if (error) {
    throw new Error(`Failed to load organization attempt: ${error.message}`);
  }

  const attemptRow = (data as AttemptRow | null) ?? null;

  if (!attemptRow) {
    return null;
  }

  const responseCounts = await getResponseCountsForAttemptIds([attemptRow.id]);
  const attempt = mapOrganizationAttemptSummary(attemptRow, responseCounts.get(attemptRow.id) ?? 0);

  if (
    attempt.participants &&
    attempt.participants.organization_id !== organizationId
  ) {
    return null;
  }

  return attempt;
}

export async function getAttemptsForOrganization(
  organizationId: string,
): Promise<OrganizationScopedAttemptSummary[]> {
  const supabase = createSupabaseAdminClient();
  let { data, error } = await supabase
    .from("attempts")
    .select(
      "id, test_id, locale, user_id, organization_id, participant_id, status, started_at, scored_started_at, completed_at, tests(slug, name), participants(id, organization_id, full_name, email), organizations(name, slug)",
    )
    .eq("organization_id", organizationId)
    .order("started_at", { ascending: false })
    .order("id", { ascending: false });

  if (error && isMissingScoredStartedAtColumnError(error.message)) {
    const fallbackResult = await supabase
      .from("attempts")
      .select(
        "id, test_id, locale, user_id, organization_id, participant_id, status, started_at, completed_at, tests(slug, name), participants(id, organization_id, full_name, email), organizations(name, slug)",
      )
      .eq("organization_id", organizationId)
      .order("started_at", { ascending: false })
      .order("id", { ascending: false });

    data = (fallbackResult.data ?? []).map((attempt) => ({
      ...attempt,
      scored_started_at: null,
    }));
    error = fallbackResult.error;
  }

  if (error) {
    throw new Error(`Failed to load organization attempts: ${error.message}`);
  }

  const attemptRows = ((data ?? []) as AttemptRow[]).filter((attempt) => {
    const participant = normalizeAttemptRelation(attempt.participants);
    return !participant || participant.organization_id === organizationId;
  });
  const responseCounts = await getResponseCountsForAttemptIds(attemptRows.map((attempt) => attempt.id));

  return attemptRows
    .map((attempt) => mapOrganizationAttemptSummary(attempt, responseCounts.get(attempt.id) ?? 0))
    .sort((left, right) => {
      const leftPriority = left.lifecycle === "in_progress" ? 0 : left.lifecycle === "not_started" ? 1 : 2;
      const rightPriority = right.lifecycle === "in_progress" ? 0 : right.lifecycle === "not_started" ? 1 : 2;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return Date.parse(right.started_at) - Date.parse(left.started_at);
    });
}
