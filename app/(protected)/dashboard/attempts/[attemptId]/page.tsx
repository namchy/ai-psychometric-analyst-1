import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveOrganizationForUser } from "@/lib/b2b/organizations";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AttemptDetailPageProps = {
  params: {
    attemptId: string;
  };
};

type AttemptDetail = {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  participant_id: string | null;
  status: "in_progress" | "completed" | "abandoned";
  started_at: string;
  tests: {
    slug: string;
    name: string;
  } | null;
  participants: {
    full_name: string;
    email: string;
  } | null;
  organizations: {
    name: string;
    slug: string;
  } | null;
};

async function getAttemptDetailForOrganization(
  attemptId: string,
  organizationId: string,
): Promise<AttemptDetail | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attempts")
    .select(
      "id, user_id, organization_id, participant_id, status, started_at, tests(slug, name), participants(full_name, email), organizations(name, slug)",
    )
    .eq("id", attemptId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load attempt detail: ${error.message}`);
  }

  return (data as AttemptDetail | null) ?? null;
}

export const dynamic = "force-dynamic";

export default async function AttemptDetailPage({ params }: AttemptDetailPageProps) {
  const user = await requireAuthenticatedUser();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    notFound();
  }

  const attempt = await getAttemptDetailForOrganization(params.attemptId, organization.id);

  if (!attempt) {
    notFound();
  }

  return (
    <main className="stack-md">
      <section className="card stack-sm">
        <div className="stack-xs">
          <h1>Attempt created</h1>
          <p>The B2B attempt was created successfully and is scoped to the active organization.</p>
        </div>

        <dl>
          <dt>Attempt ID</dt>
          <dd>{attempt.id}</dd>
          <dt>Status</dt>
          <dd>{attempt.status}</dd>
          <dt>Organization</dt>
          <dd>{attempt.organizations?.name ?? organization.name}</dd>
          <dt>Participant</dt>
          <dd>{attempt.participants?.full_name ?? attempt.participant_id}</dd>
          <dt>Participant email</dt>
          <dd>{attempt.participants?.email ?? "N/A"}</dd>
          <dt>Test</dt>
          <dd>{attempt.tests?.name ?? attempt.tests?.slug ?? "Unknown test"}</dd>
          <dt>Ownership user</dt>
          <dd>{attempt.user_id ?? "N/A"}</dd>
        </dl>

        <p>
          <Link href="/dashboard">Back to dashboard</Link>
        </p>
      </section>
    </main>
  );
}
