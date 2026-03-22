"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { loginWithPassword } from "@/app/actions/auth";

function getDesktopLoginMessage(message: string) {
  switch (message) {
    case "Email and password are required.":
      return "Korisničko ime i lozinka su obavezni.";
    case "Invalid email or password.":
      return "Korisničko ime ili lozinka nisu ispravni.";
    default:
      return message;
  }
}

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="form-stack"
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
      <label className="field" htmlFor="email">
        <span className="field__label auth-copy-mobile">Email</span>
        <span className="field__label auth-copy-desktop">Korisničko ime</span>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </label>

      <label className="field" htmlFor="password">
        <span className="field__label auth-copy-mobile">Password</span>
        <span className="field__label auth-copy-desktop">Lozinka</span>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>

      <button className="button-primary button-block" type="submit" disabled={isPending}>
        <span className="auth-copy-mobile">{isPending ? "Signing in..." : "Sign in"}</span>
        <span className="auth-copy-desktop">{isPending ? "Prijava u toku..." : "Prijavi se"}</span>
      </button>

      {message ? (
        <p className="status-message status-message--danger">
          <span className="auth-copy-mobile">{message}</span>
          <span className="auth-copy-desktop">{getDesktopLoginMessage(message)}</span>
        </p>
      ) : null}
    </form>
  );
}
