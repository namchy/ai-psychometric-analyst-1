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
    <div className="login-experience min-h-screen w-screen overflow-x-hidden bg-[#f5faff] font-body text-[#00374d]">
      <div className="flex min-h-screen w-full flex-col">
        <main className="m-0 flex min-h-0 w-full max-w-none flex-1 flex-col overflow-hidden lg:flex-row">
          <section className="relative hidden flex-col justify-between bg-[linear-gradient(135deg,#00101a_0%,#00374d_100%)] px-16 py-16 lg:flex lg:w-1/2 xl:px-20 xl:py-20">
            <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
              <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary-container blur-[120px]" />
              <div className="absolute -right-24 bottom-1/4 h-80 w-80 rounded-full bg-tertiary blur-[100px]" />
            </div>

            <div className="relative z-10 flex w-full flex-1 flex-col justify-between">
              <div className="mx-auto w-full max-w-[620px]">
                <p className="font-headline text-[22px] leading-none font-extrabold tracking-[-0.03em] text-[#abe5fe]">
                  {loginScreenContent.brandName}
                </p>

                <div className="mt-8">
                  <h1 className="font-headline text-[64px] font-extrabold leading-[1.02] tracking-[-0.045em] text-white">
                    <span className="block">{loginScreenContent.heroTitleLine1}</span>
                    <span className="block text-[#abe5fe]">
                      {loginScreenContent.heroTitleEmphasis}
                    </span>
                  </h1>
                  <p className="mt-8 font-body text-[20px] font-light leading-[1.75] tracking-[-0.01em] text-white/78">
                    {loginScreenContent.heroDescription}
                  </p>
                </div>

                <div
                  className="mt-14 flex w-full flex-row gap-4"
                  aria-label="Ključne prednosti platforme"
                >
                  {heroStats.map((stat) => (
                    <div
                      className="min-h-[124px] min-w-0 flex-1 rounded-[22px] border border-white/[0.03] bg-white/[0.04] px-5 py-4 shadow-none backdrop-blur-[6px]"
                      key={stat.label}
                    >
                      <p className="mb-2 font-headline text-[15px] font-semibold leading-6 text-white/92">
                        {stat.value}
                      </p>
                      <p className="font-body text-[13px] font-normal leading-6 text-white/68">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mx-auto mt-12 flex w-full max-w-[620px] items-center gap-4">
                <div className="h-[4px] w-[44px] rounded-full bg-[#ee947d]" />
                <span className="font-label text-[12px] leading-none font-semibold uppercase tracking-[0.22em] text-[#8bb8d4]">
                  {loginScreenContent.heroBadge}
                </span>
              </div>
            </div>
          </section>

          <section className="relative flex w-full items-center justify-center bg-[#f5faff] px-8 py-16 md:px-12 xl:px-16 lg:w-1/2">
            <div className="absolute left-8 top-8 lg:hidden">
              <span className="font-headline text-xl font-bold tracking-tight text-[#00374d]">
                {loginScreenContent.brandName}
              </span>
            </div>

            <div className="mx-auto w-full max-w-md lg:pt-10 xl:pt-14">
              <header className="mb-12">
                <h2 className="font-headline text-[48px] leading-[1.05] font-extrabold tracking-[-0.04em] text-[#00374d]">
                  {loginScreenContent.welcomeTitle}
                </h2>
                <p className="mt-4 max-w-[420px] font-body text-[18px] font-normal leading-[1.6] text-[#37647d]">
                  {loginScreenContent.welcomeDescription}
                </p>
              </header>

              <LoginForm content={loginScreenContent} />
            </div>
          </section>
        </main>

        <footer className="w-full shrink-0 border-t border-[#8bb8d4]/10 bg-[#e9f5ff]">
          <div className="flex flex-col items-center justify-between gap-4 px-10 py-7 md:flex-row xl:px-12">
            <p className="text-center font-label text-[11px] leading-none font-bold uppercase tracking-[0.20em] text-[#37647d]/65 md:text-left">
              {loginScreenContent.footerLegalText}
            </p>
            <nav className="flex items-center gap-8" aria-label="Legal">
              <a
                className="font-label text-[11px] leading-none font-bold uppercase tracking-[0.20em] text-[#37647d]/90 transition-colors hover:text-[#29667b] focus:outline-none focus:ring-2 focus:ring-primary-container focus:ring-offset-0"
                href={loginScreenContent.footerLink1Href}
              >
                {loginScreenContent.footerLink1}
              </a>
              <a
                className="font-label text-[11px] leading-none font-bold uppercase tracking-[0.20em] text-[#37647d]/90 transition-colors hover:text-[#29667b] focus:outline-none focus:ring-2 focus:ring-primary-container focus:ring-offset-0"
                href={loginScreenContent.footerLink2Href}
              >
                {loginScreenContent.footerLink2}
              </a>
              <a
                className="font-label text-[11px] leading-none font-bold uppercase tracking-[0.20em] text-[#37647d]/90 transition-colors hover:text-[#29667b] focus:outline-none focus:ring-2 focus:ring-primary-container focus:ring-offset-0"
                href={loginScreenContent.footerLink3Href}
              >
                {loginScreenContent.footerLink3}
              </a>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
