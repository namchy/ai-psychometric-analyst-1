import { LoginForm } from "@/components/auth/login-form";
import { redirectAuthenticatedUserToDashboard } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await redirectAuthenticatedUserToDashboard();

  return (
    <main>
      <section className="card stack-md">
        <div className="stack-xs">
          <h1>Sign in</h1>
          <p>Use your Supabase Auth email/password credentials to access the B2B admin area.</p>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
