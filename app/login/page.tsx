import { LoginForm } from "@/components/auth/login-form";
import { loginScreenContent } from "@/components/auth/login-content";
import { getPostLoginRedirectPathForUserId } from "@/lib/auth/app-context";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const heroStats = [
  {
    value: loginScreenContent.stat1Value,
    label: loginScreenContent.stat1Label,
  },
  {
    value: loginScreenContent.stat2Value,
    label: loginScreenContent.stat2Label,
  },
  {
    value: loginScreenContent.stat3Value,
    label: loginScreenContent.stat3Label,
  },
] as const;

export default async function LoginPage() {
  const user = await getAuthenticatedUser();

  if (user) {
    redirect(await getPostLoginRedirectPathForUserId(user.id));
  }

  return (
    <main className="login-experience">
      <section className="login-experience__shell">
        <div className="login-experience__hero">
          <div className="login-experience__hero-inner">
            <p className="login-experience__badge">{loginScreenContent.heroBadge}</p>

            <div className="login-experience__title-block">
              <h1 className="login-experience__title">
                <span className="login-experience__title-line">
                  {loginScreenContent.heroTitleLine1}
                </span>
                <span className="login-experience__title-accent">
                  {loginScreenContent.heroTitleEmphasis}
                </span>
              </h1>
              <p className="login-experience__description">{loginScreenContent.heroDescription}</p>
            </div>

            <div className="login-experience__stats" aria-label="Ključne prednosti platforme">
              {heroStats.map((stat) => (
                <div className="login-experience__stat" key={stat.label}>
                  <p className="login-experience__stat-value">{stat.value}</p>
                  <p className="login-experience__stat-label">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="login-experience__auth-column">
          <div className="login-card">
            <div className="login-card__header">
              <p className="login-card__brand">{loginScreenContent.brandName}</p>
              <div className="login-card__heading-group">
                <h2>{loginScreenContent.welcomeTitle}</h2>
                <p>{loginScreenContent.welcomeDescription}</p>
              </div>
            </div>

            <LoginForm content={loginScreenContent} />
          </div>
        </div>
      </section>

      <footer className="login-experience__footer">
        <p>{loginScreenContent.footerLegalText}</p>
        <nav aria-label="Legal">
          <a href={loginScreenContent.footerLink1Href}>{loginScreenContent.footerLink1}</a>
          <a href={loginScreenContent.footerLink2Href}>{loginScreenContent.footerLink2}</a>
          <a href={loginScreenContent.footerLink3Href}>{loginScreenContent.footerLink3}</a>
        </nav>
      </footer>
    </main>
  );
}
