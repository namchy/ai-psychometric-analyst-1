import { logout } from "@/app/actions/auth";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "inactive";
};

type MembershipRow = {
  id: string;
  role: "org_owner" | "hr_admin" | "manager";
  status: "active" | "invited" | "disabled";
  organizations: OrganizationSummary[];
};

async function getMembershipsForUser(userId: string): Promise<MembershipRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("id, role, status, organizations(id, name, slug, status)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load organization memberships: ${error.message}`);
  }

  return ((data ?? []) as MembershipRow[]).map((membership) => ({
    ...membership,
    organizations: membership.organizations ?? [],
  }));
}

function getOrganizationName(membership: MembershipRow | null): string {
  return membership?.organizations[0]?.name ?? "No active organization";
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();
  const memberships = await getMembershipsForUser(user.id);
  const activeMembership = memberships.find((membership) => membership.status === "active") ?? null;

  return (
    <main className="stack-md">
      <section className="card stack-sm">
        <div className="stack-xs">
          <h1>Dashboard</h1>
          <p>Signed in as {user.email ?? user.id}</p>
          <p>Active organization: {getOrganizationName(activeMembership)}</p>
        </div>

        <form action={logout}>
          <button type="submit">Sign out</button>
        </form>
      </section>

      <section className="card stack-sm">
        <h2>Memberships</h2>

        {memberships.length === 0 ? (
          <p>No organization memberships found for this user yet.</p>
        ) : (
          <ul>
            {memberships.map((membership) => (
              <li key={membership.id}>
                {getOrganizationName(membership)} ({membership.role}, {membership.status})
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
