import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  DEFAULT_REFRESH_COOKIE_MAX_AGE_SECONDS,
  type AuthCookieName,
  SUPABASE_ACCESS_TOKEN_COOKIE_NAME,
  SUPABASE_REFRESH_TOKEN_COOKIE_NAME,
  getAuthCookieOptions,
} from "@/lib/auth/cookies";
import { createSupabaseAuthClient } from "@/lib/supabase/server";

export class AuthenticationRequiredError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

function getTokenCookieValue(name: AuthCookieName): string | null {
  return cookies().get(name)?.value ?? null;
}

export function persistAuthSession(session: {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}) {
  const maxAge = session.expires_in ?? DEFAULT_REFRESH_COOKIE_MAX_AGE_SECONDS;

  cookies().set(
    SUPABASE_ACCESS_TOKEN_COOKIE_NAME,
    session.access_token,
    getAuthCookieOptions(maxAge),
  );
  cookies().set(
    SUPABASE_REFRESH_TOKEN_COOKIE_NAME,
    session.refresh_token,
    getAuthCookieOptions(DEFAULT_REFRESH_COOKIE_MAX_AGE_SECONDS),
  );
}

export function clearAuthSession() {
  cookies().set(SUPABASE_ACCESS_TOKEN_COOKIE_NAME, "", getAuthCookieOptions(0));
  cookies().set(SUPABASE_REFRESH_TOKEN_COOKIE_NAME, "", getAuthCookieOptions(0));
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

export async function requireAuthenticatedUserForAction(): Promise<User> {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new AuthenticationRequiredError();
  }

  return user;
}

export async function redirectAuthenticatedUserToDashboard() {
  const user = await getAuthenticatedUser();

  if (user) {
    redirect("/dashboard");
  }
}
