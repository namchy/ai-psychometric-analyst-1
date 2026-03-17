export const SUPABASE_ACCESS_TOKEN_COOKIE_NAME = "sb-access-token";
export const SUPABASE_REFRESH_TOKEN_COOKIE_NAME = "sb-refresh-token";
export const DEFAULT_REFRESH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type AuthCookieName =
  | typeof SUPABASE_ACCESS_TOKEN_COOKIE_NAME
  | typeof SUPABASE_REFRESH_TOKEN_COOKIE_NAME;

export function getAuthCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
