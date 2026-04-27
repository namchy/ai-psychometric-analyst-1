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

function MailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="m5.5 8.5 5.58 4.18a1.56 1.56 0 0 0 1.84 0L18.5 8.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M7.75 10V8.25a4.25 4.25 0 1 1 8.5 0V10"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function LoginForm({ content, initialLocale }: LoginFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [locale, setLocale] = useState<AssessmentLocale>(initialLocale);
  const [rememberDevice, setRememberDevice] = useState(true);
  const rememberId = useId();
  const localeId = useId();
  const inputClassName =
    "block h-[56px] w-full appearance-none rounded-[18px] border border-[#8bb8d4]/30 bg-[#e9f5ff] font-body text-[17px] font-medium leading-[1.15] text-[#00374d] shadow-none outline-none ring-0 transition-all duration-200 placeholder:text-[#54809a]/78 focus:border-[#8bb8d4]/45 focus:outline-none focus:ring-2 focus:ring-[#abe5fe]";
  const labelClassName =
    "mb-3 ml-1 block font-label text-[11px] leading-none font-bold uppercase tracking-[0.22em] text-[#37647d]";

  return (
    <form
      className="space-y-0"
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
      <div className="space-y-6">
        <label className="block" htmlFor="email">
          <span className={labelClassName}>{content.emailLabel}</span>
          <span className="relative block">
            <span className="pointer-events-none absolute left-6 top-1/2 z-10 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-[#54809a]">
              <MailIcon />
            </span>
            <input
              className={inputClassName}
              id="email"
              name="email"
              type="email"
              placeholder="name@company.com"
              autoComplete="email"
              style={{ paddingLeft: "76px", paddingRight: "84px" }}
              required
            />
          </span>
        </label>

        <label className="block" htmlFor="password">
          <span className={labelClassName}>{content.passwordLabel}</span>
          <span className="relative block">
            <span className="pointer-events-none absolute left-6 top-1/2 z-10 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-[#54809a]">
              <LockIcon />
            </span>
            <input
              className={inputClassName}
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              style={{ paddingLeft: "76px", paddingRight: "84px" }}
              required
            />
          </span>
        </label>
      </div>

      <div className="mt-6 border-b border-[#8bb8d4]/25 pb-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <label className="min-w-0 flex-1" htmlFor={localeId}>
            <span className={labelClassName}>Jezik</span>
            <span className="relative block">
              <select
                className="block h-[48px] w-full appearance-none rounded-[16px] border border-[#8bb8d4]/30 bg-[#e9f5ff] px-5 pr-12 font-body text-[15px] font-medium text-[#00374d] outline-none transition-all duration-200 focus:border-[#8bb8d4]/45 focus:ring-2 focus:ring-[#abe5fe]"
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
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#54809a]">
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
                  <path
                    d="m5.5 7.5 4.5 4.5 4.5-4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </span>
            </span>
          </label>
        </div>
        <div className="flex items-start gap-3">
        <label
          className="inline-flex cursor-pointer items-start gap-3"
          htmlFor={rememberId}
        >
          <input
            className="peer sr-only"
            id={rememberId}
            type="checkbox"
            checked={rememberDevice}
            onChange={(event) => setRememberDevice(event.target.checked)}
          />
          <span
            className={
              rememberDevice
                ? "mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-[#29667b] bg-[#29667b] text-white transition-all duration-200"
                : "mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-[#6f9ab2] bg-[#eef6fb] text-[#6f9ab2] transition-all duration-200"
            }
          >
            {rememberDevice ? (
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
              >
                <path
                  d="M3.5 8.5 6.5 11.5 12.5 5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            ) : null}
          </span>
          <span className="text-[15px] font-medium leading-6 text-[#37647d]">
            {content.rememberLabel}
          </span>
        </label>
        </div>
      </div>

      <div className="pt-6">
        <button
          className="h-[64px] w-full rounded-full bg-[linear-gradient(90deg,#29667b_0%,#195a6f_100%)] font-label text-[15px] font-bold uppercase leading-none tracking-[0.20em] text-white shadow-[0_12px_30px_rgba(41,102,123,0.18)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_16px_36px_rgba(41,102,123,0.24)] focus:outline-none focus:ring-2 focus:ring-primary-container focus:ring-offset-0 active:translate-y-0 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:scale-100"
          type="submit"
          disabled={isPending}
        >
          {isPending ? content.primaryButtonPendingLabel : content.primaryButtonLabel}
        </button>
        {message ? (
          <p className="status-message status-message--danger rounded-[1.5rem] border border-[#fda18a]/40 bg-[#fef1ed] px-4 py-3 text-sm text-[#70030f]">
            {getDesktopLoginMessage(message)}
          </p>
        ) : null}

        <div className="mx-auto mt-5 max-w-[360px] text-center">
          <p className="font-body text-[15px] leading-7 text-[#37647d]">
            {content.bottomHelperText}{" "}
            <a
              className="font-bold text-[#934a38] underline-offset-4 transition-colors hover:underline focus:outline-none focus:ring-2 focus:ring-primary-container focus:ring-offset-0"
              href={content.bottomHelperHref}
            >
              {content.bottomHelperLinkLabel}
            </a>
          </p>
        </div>
      </div>
    </form>
  );
}
