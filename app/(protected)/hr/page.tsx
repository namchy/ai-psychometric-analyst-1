import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getAppContextForUserId } from "@/lib/auth/app-context";
import { requireAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HrEntryPage() {
  const user = await requireAuthenticatedUser();
  const context = await getAppContextForUserId(user.id);

  return (
    <main className="stack-md">
      <section className="card stack-sm">
        <div className="stack-xs">
          <h1>HR Workspace</h1>
          <p>Operational area for organization management, participant setup, and assessment oversight.</p>
          <p>
            {context.activeOrganizationId
              ? `Active organization context is available for this account.`
              : "This transitional HR entry is ready, but no active organization context is available yet."}
          </p>
          <p>
            This is the future canonical <code>/hr</code> namespace. The current dashboard remains active during the
            transition.
          </p>
        </div>

        <p>
          <Link href="/dashboard">Open current dashboard</Link>
        </p>

        <form action={logout}>
          <button type="submit">Sign out</button>
        </form>
      </section>
    </main>
  );
}
