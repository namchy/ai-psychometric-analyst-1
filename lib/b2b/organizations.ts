import "server-only";

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

function normalizeOrganization(
  value: MembershipRow["organizations"],
): OrganizationSummary | null {
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
