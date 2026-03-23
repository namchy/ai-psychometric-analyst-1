"use client";

import type { LoginScreenContent } from "@/components/auth/login-content";
import { loginWithPassword } from "@/app/actions/auth";
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
};

function MailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
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
    <svg aria-hidden="true" viewBox="0 0 24 24">
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

export function LoginForm({ content }: LoginFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [rememberDevice, setRememberDevice] = useState(true);
  const rememberId = useId();

  return (
    <form
      className="login-form"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const email = String(formData.get("email") ?? "");
        const password = String(formData.get("password") ?? "");

        startTransition(async () => {
          const result = await loginWithPassword({ email, password });

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
      <div className="login-form__fields">
        <label className="login-form__field" htmlFor="email">
          <span className="login-form__label">{content.emailLabel}</span>
          <span className="login-form__input-wrap">
            <span className="login-form__icon">
              <MailIcon />
            </span>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="name@company.com"
              autoComplete="email"
              required
            />
          </span>
        </label>

        <label className="login-form__field" htmlFor="password">
          <span className="login-form__label">{content.passwordLabel}</span>
          <span className="login-form__input-wrap">
            <span className="login-form__icon">
              <LockIcon />
            </span>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </span>
        </label>
      </div>

      <div className="login-form__meta">
        <label className="login-form__checkbox" htmlFor={rememberId}>
          <input
            id={rememberId}
            type="checkbox"
            checked={rememberDevice}
            onChange={(event) => setRememberDevice(event.target.checked)}
          />
          <span>{content.rememberLabel}</span>
        </label>
      </div>

      <button className="login-form__submit" type="submit" disabled={isPending}>
        {isPending ? content.primaryButtonPendingLabel : content.primaryButtonLabel}
      </button>

      {message ? (
        <p className="status-message status-message--danger">{getDesktopLoginMessage(message)}</p>
      ) : null}

      <p className="login-form__bottom-helper">
        {content.bottomHelperText} <a href={content.bottomHelperHref}>{content.bottomHelperLinkLabel}</a>
      </p>
    </form>
  );
}
