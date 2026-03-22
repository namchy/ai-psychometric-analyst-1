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
    <main className="auth-shell auth-shell--login-page">
      <section className="auth-shell__panel auth-shell__panel--login card stack-lg">
        <div className="stack-md auth-shell__intro">
          <div className="stack-xs auth-shell__title-group">
            <p className="eyebrow auth-shell__brand auth-copy-mobile">Assessment Platform</p>
            <p className="eyebrow auth-shell__brand auth-copy-desktop">Deep Profile</p>
            <h1 className="auth-copy-mobile">Sign in to continue</h1>
            <h1 className="auth-copy-desktop auth-shell__title">Prijava na platformu</h1>
          </div>

          <p className="page-lead auth-copy-mobile">
            Use your Supabase Auth email and password to access the candidate or HR workspace.
          </p>
          <p className="page-lead auth-copy-desktop auth-shell__lead">
            Unesi korisničko ime i lozinku iz e-mail poruke kako bi se prijavio na svoj nalog.
          </p>
        </div>

        <div className="auth-shell__form-wrap auth-shell__form-wrap--login">
          <LoginForm />
        </div>

        <div className="auth-shell__note">
          <p className="auth-copy-mobile">
            Access is role-aware after sign-in, so each account is redirected to the correct
            workspace.
          </p>
          <p className="auth-copy-desktop auth-shell__helper">
            Nakon prijave otvorit će ti se kontrolna ploča sa dostupnim testovima.
          </p>
        </div>
      </section>
    </main>
  );
}
