import { LoginForm } from "@/components/auth/login-form";
import { getPostLoginRedirectPathForUserId } from "@/lib/auth/app-context";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getAuthenticatedUser();

  if (user) {
    redirect(await getPostLoginRedirectPathForUserId(user.id));
  }

  return (
    <main>
      <section className="card stack-md">
        <div className="stack-xs">
          <h1>Sign in</h1>
          <p>Use your Supabase Auth email/password credentials to access the HR or candidate area.</p>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
