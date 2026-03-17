import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_REFRESH_COOKIE_MAX_AGE_SECONDS,
  SUPABASE_ACCESS_TOKEN_COOKIE_NAME,
  SUPABASE_REFRESH_TOKEN_COOKIE_NAME,
  getAuthCookieOptions,
} from "@/lib/auth/cookies";
import { getSupabaseEnv } from "@/lib/supabase/env";

function createSupabaseMiddlewareClient() {
  const { url, publishableKey } = getSupabaseEnv();

  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function persistSessionCookies(response: NextResponse, session: {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}) {
  const accessTokenMaxAge = session.expires_in ?? DEFAULT_REFRESH_COOKIE_MAX_AGE_SECONDS;

  response.cookies.set(
    SUPABASE_ACCESS_TOKEN_COOKIE_NAME,
    session.access_token,
    getAuthCookieOptions(accessTokenMaxAge),
  );
  response.cookies.set(
    SUPABASE_REFRESH_TOKEN_COOKIE_NAME,
    session.refresh_token,
    getAuthCookieOptions(DEFAULT_REFRESH_COOKIE_MAX_AGE_SECONDS),
  );
}

function clearSessionCookies(response: NextResponse) {
  response.cookies.set(SUPABASE_ACCESS_TOKEN_COOKIE_NAME, "", getAuthCookieOptions(0));
  response.cookies.set(SUPABASE_REFRESH_TOKEN_COOKIE_NAME, "", getAuthCookieOptions(0));
}

async function getUserFromAccessToken(accessToken: string) {
  const supabase = createSupabaseMiddlewareClient();
  return supabase.auth.getUser(accessToken);
}

async function refreshSession(refreshToken: string) {
  const supabase = createSupabaseMiddlewareClient();
  return supabase.auth.refreshSession({ refresh_token: refreshToken });
}

function getLoginUrl(request: NextRequest) {
  return new URL("/login", request.url);
}

function getDashboardUrl(request: NextRequest) {
  return new URL("/dashboard", request.url);
}

export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get(SUPABASE_ACCESS_TOKEN_COOKIE_NAME)?.value ?? null;
  const refreshToken = request.cookies.get(SUPABASE_REFRESH_TOKEN_COOKIE_NAME)?.value ?? null;
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = pathname.startsWith("/dashboard");
  const isLoginRoute = pathname === "/login";

  if (!isProtectedRoute && !isLoginRoute) {
    return NextResponse.next();
  }

  if (!accessToken && !refreshToken) {
    if (isProtectedRoute) {
      return NextResponse.redirect(getLoginUrl(request));
    }

    return NextResponse.next();
  }

  if (accessToken) {
    const { data, error } = await getUserFromAccessToken(accessToken);

    if (!error && data.user) {
      if (isLoginRoute) {
        return NextResponse.redirect(getDashboardUrl(request));
      }

      return NextResponse.next();
    }
  }

  if (!refreshToken) {
    const response = isProtectedRoute
      ? NextResponse.redirect(getLoginUrl(request))
      : NextResponse.next();
    clearSessionCookies(response);
    return response;
  }

  const { data, error } = await refreshSession(refreshToken);

  if (error || !data.session || !data.user) {
    const response = isProtectedRoute
      ? NextResponse.redirect(getLoginUrl(request))
      : NextResponse.next();
    clearSessionCookies(response);
    return response;
  }

  const response = isLoginRoute
    ? NextResponse.redirect(getDashboardUrl(request))
    : NextResponse.next();

  persistSessionCookies(response, data.session);
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
