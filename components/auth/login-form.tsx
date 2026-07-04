"use client";

import type { LoginScreenContent } from "@/components/auth/login-content";
import { loginWithPassword } from "@/app/actions/auth";
import type { AssessmentLocale } from "@/lib/assessment/locale";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

function getDesktopLoginMessage(message: string) {
  switch (message) {
    case "Email and password are required.":
      return "E-mail i lozinka su obavezni.";
    case "Invalid email or password.":
      return "E-mail ili lozinka nisu ispravni.";
    default:
      return message;
  }
}

type LoginFormProps = {
  content: LoginScreenContent;
  initialLocale: AssessmentLocale;
};

const localeOptions = [
  { value: "bs", label: "Bosanski" },
  { value: "hr", label: "Hrvatski" },
  { value: "en", label: "English" },
  { value: "sr", label: "Srpski" },
] as const;

export function LoginForm({ content, initialLocale }: LoginFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [locale, setLocale] = useState<AssessmentLocale>(initialLocale);
  const localeId = useId();
  const emailId = useId();
  const passwordId = useId();
  const inputClassName =
    "block h-11 w-full rounded-md border border-[#8bb8d4]/35 bg-[#fffefe] px-3 font-body text-sm text-[#00374d] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition-colors placeholder:text-[#54809a]/60 focus:border-[#29667b] focus:bg-white focus:ring-2 focus:ring-[#abe5fe]/80 disabled:cursor-not-allowed disabled:opacity-60";
  const localeSelectClassName =
    "block h-10 w-full rounded-md border border-[#8bb8d4]/25 bg-[#fbfdff] px-3 font-body text-sm text-[#37647d] shadow-none outline-none transition-colors focus:border-[#29667b] focus:bg-white focus:ring-2 focus:ring-[#abe5fe]/70 disabled:cursor-not-allowed disabled:opacity-60";
  const labelClassName =
    "font-label text-sm font-medium leading-none text-[#00374d]";

  return (
    <div className="flex flex-col">
      <section className="rounded-lg border border-[#8bb8d4]/25 bg-white shadow-[0_18px_44px_rgba(0,55,77,0.08)]">
        <header className="space-y-1.5 px-6 pb-5 pt-6 text-center">
          <h1 className="font-headline text-xl font-semibold tracking-tight text-[#00374d]">
            Dobro došli
          </h1>
          <p className="text-sm leading-6 text-[#37647d]">
            Prijavite se na svoj Deep Profile nalog
          </p>
        </header>
        <div className="px-6 pb-6 pt-0">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const email = String(formData.get("email") ?? "");
              const password = String(formData.get("password") ?? "");
              const locale = String(formData.get("locale") ?? "");

              startTransition(async () => {
                const result = await loginWithPassword({ email, password, locale });

                if (!result.ok) {
                  setMessage(result.message);
                  return;
                }

                setMessage(null);
                router.push(result.redirectPath);
                router.refresh();
              });
            }}
          >
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <label className={labelClassName} htmlFor={emailId}>
                  {content.emailLabel}
                </label>
                <input
                  autoComplete="email"
                  className={inputClassName}
                  disabled={isPending}
                  id={emailId}
                  name="email"
                  placeholder="name@company.com"
                  required
                  type="email"
                />
              </div>

              <div className="grid gap-2">
                <label className={labelClassName} htmlFor={passwordId}>
                  {content.passwordLabel}
                </label>
                <input
                  autoComplete="current-password"
                  className={inputClassName}
                  disabled={isPending}
                  id={passwordId}
                  name="password"
                  required
                  type="password"
                />
              </div>

              <div className="grid gap-2 pt-1">
                <label
                  className="font-label text-xs font-medium leading-none text-[#37647d]"
                  htmlFor={localeId}
                >
                  Jezik
                </label>
                <select
                  className={localeSelectClassName}
                  disabled={isPending}
                  id={localeId}
                  name="locale"
                  value={locale}
                  onChange={(event) => setLocale(event.target.value as AssessmentLocale)}
                >
                  {localeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="inline-flex h-12 w-full items-center justify-center rounded-md bg-[#29667b] px-4 py-2 font-label text-sm font-bold text-white shadow-[0_10px_22px_rgba(41,102,123,0.18)] transition-colors hover:bg-[#195a6f] focus:outline-none focus:ring-2 focus:ring-primary-container focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPending}
                type="submit"
              >
                {isPending ? content.primaryButtonPendingLabel : "Prijavi se"}
              </button>

              {message ? (
                <p className="rounded-md border border-[#fda18a]/40 bg-[#fef1ed] px-4 py-3 text-sm leading-6 text-[#70030f]">
                  {getDesktopLoginMessage(message)}
                </p>
              ) : null}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
