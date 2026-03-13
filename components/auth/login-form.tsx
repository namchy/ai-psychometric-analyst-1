"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { loginWithPassword } from "@/app/actions/auth";

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="stack-sm"
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
          router.push("/dashboard");
          router.refresh();
        });
      }}
    >
      <label className="stack-xs" htmlFor="email">
        <span>Email</span>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </label>

      <label className="stack-xs" htmlFor="password">
        <span>Password</span>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>

      <button type="submit" disabled={isPending}>
        {isPending ? "Signing in..." : "Sign in"}
      </button>

      {message ? <p>{message}</p> : null}
    </form>
  );
}
