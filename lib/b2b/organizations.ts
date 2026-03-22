import "server-only";

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

export type OrganizationScopedAttemptSummary = {
  id: string;
  test_id: string;
  locale: AssessmentLocale;
  user_id: string | null;
  organization_id: string | null;
  participant_id: string | null;
  status: "in_progress" | "completed" | "abandoned";
  started_at: string;
  completed_at: string | null;
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

type AttemptRow = {
  id: string;
  test_id: string;
  locale: AssessmentLocale;
  user_id: string | null;
  organization_id: string | null;
  participant_id: string | null;
  status: OrganizationScopedAttemptSummary["status"];
  started_at: string;
  completed_at: string | null;
  tests: AttemptRelation<OrganizationScopedAttemptSummary["tests"] extends infer T ? NonNullable<T> : never>;
  participants: AttemptRelation<
    OrganizationScopedAttemptSummary["participants"] extends infer T ? NonNullable<T> : never
  >;
  organizations: AttemptRelation<
    OrganizationScopedAttemptSummary["organizations"] extends infer T ? NonNullable<T> : never
  >;
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
  const { data, error } = await supabase
    .from("attempts")
    .select(
      "id, test_id, locale, user_id, organization_id, participant_id, status, started_at, completed_at, tests(slug, name), participants(id, organization_id, full_name, email), organizations(name, slug)",
    )
    .eq("id", attemptId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load organization attempt: ${error.message}`);
  }

  const attemptRow = (data as AttemptRow | null) ?? null;

  if (!attemptRow) {
    return null;
  }

  const attempt: OrganizationScopedAttemptSummary = {
    ...attemptRow,
    tests: normalizeAttemptRelation(attemptRow.tests),
    participants: normalizeAttemptRelation(attemptRow.participants),
    organizations: normalizeAttemptRelation(attemptRow.organizations),
  };

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
  const { data, error } = await supabase
    .from("attempts")
    .select(
      "id, test_id, locale, user_id, organization_id, participant_id, status, started_at, completed_at, tests(slug, name), participants(id, organization_id, full_name, email), organizations(name, slug)",
    )
    .eq("organization_id", organizationId)
    .order("started_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw new Error(`Failed to load organization attempts: ${error.message}`);
  }

  return ((data ?? []) as AttemptRow[])
    .map((attempt) => ({
      ...attempt,
      tests: normalizeAttemptRelation(attempt.tests),
      participants: normalizeAttemptRelation(attempt.participants),
      organizations: normalizeAttemptRelation(attempt.organizations),
    }))
    .filter(
      (attempt) =>
        !attempt.participants || attempt.participants.organization_id === organizationId,
    )
    .sort((left, right) => {
      const leftPriority = left.status === "in_progress" ? 0 : 1;
      const rightPriority = right.status === "in_progress" ? 0 : 1;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return Date.parse(right.started_at) - Date.parse(left.started_at);
    });
}
