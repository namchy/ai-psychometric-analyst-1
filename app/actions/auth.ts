"use server";

import { redirect } from "next/navigation";
import { getPostLoginRedirectPathForUserId } from "@/lib/auth/app-context";
import { persistAppLocaleCookie } from "@/lib/auth/app-locale";
import { clearAuthSession, persistAuthSession } from "@/lib/auth/session";
import { createSupabaseAuthClient } from "@/lib/supabase/server";

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResult =
  | {
      ok: true;
      redirectPath: "/hr" | "/app" | "/dashboard";
    }
  | {
      ok: false;
      message: string;
    };

function normalizeCredential(value: string): string {
  return value.trim();
}

export async function loginWithPassword(input: LoginInput): Promise<LoginResult> {
  const email = normalizeCredential(input.email).toLowerCase();
  const password = normalizeCredential(input.password);

  if (!email || !password) {
    return {
      ok: false,
      message: "Email and password are required.",
    };
  }

  const supabase = createSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return {
      ok: false,
      message: "Invalid email or password.",
    };
  }

  persistAuthSession(data.session);
  persistAppLocaleCookie();

  const redirectPath = await getPostLoginRedirectPathForUserId(data.user.id);

  return { ok: true, redirectPath };
}

export async function logout() {
  clearAuthSession();
  redirect("/login");
}
