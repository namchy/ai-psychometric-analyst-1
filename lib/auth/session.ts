import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseAuthClient } from "@/lib/supabase/server";

export const SUPABASE_ACCESS_TOKEN_COOKIE_NAME = "sb-access-token";
export const SUPABASE_REFRESH_TOKEN_COOKIE_NAME = "sb-refresh-token";
const DEFAULT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type AuthCookieName =
  | typeof SUPABASE_ACCESS_TOKEN_COOKIE_NAME
  | typeof SUPABASE_REFRESH_TOKEN_COOKIE_NAME;

function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

function getTokenCookieValue(name: AuthCookieName): string | null {
  return cookies().get(name)?.value ?? null;
}

export function persistAuthSession(session: {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}) {
  const maxAge = session.expires_in ?? DEFAULT_COOKIE_MAX_AGE_SECONDS;

  cookies().set(
    SUPABASE_ACCESS_TOKEN_COOKIE_NAME,
    session.access_token,
    getCookieOptions(maxAge),
  );
  cookies().set(
    SUPABASE_REFRESH_TOKEN_COOKIE_NAME,
    session.refresh_token,
    getCookieOptions(DEFAULT_COOKIE_MAX_AGE_SECONDS),
  );
}

export function clearAuthSession() {
  cookies().set(SUPABASE_ACCESS_TOKEN_COOKIE_NAME, "", getCookieOptions(0));
  cookies().set(SUPABASE_REFRESH_TOKEN_COOKIE_NAME, "", getCookieOptions(0));
}

export async function getAuthenticatedUser(): Promise<User | null> {
  const accessToken = getTokenCookieValue(SUPABASE_ACCESS_TOKEN_COOKIE_NAME);

  if (!accessToken) {
    return null;
  }

  const supabase = createSupabaseAuthClient();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error) {
    return null;
  }

  return data.user ?? null;
}

export async function requireAuthenticatedUser(): Promise<User> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function redirectAuthenticatedUserToDashboard() {
  const user = await getAuthenticatedUser();

  if (user) {
    redirect("/dashboard");
  }
}
