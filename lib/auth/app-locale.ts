import "server-only";

import { cookies } from "next/headers";
import {
  DEFAULT_ASSESSMENT_LOCALE,
  normalizeAssessmentLocale,
  type AssessmentLocale,
} from "@/lib/assessment/locale";

export const APP_LOCALE_COOKIE_NAME = "app-locale";
export const DEFAULT_APP_LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function getAppLocaleCookieOptions(maxAge = DEFAULT_APP_LOCALE_COOKIE_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function getAppLocaleCookieValue(): AssessmentLocale {
  return normalizeAssessmentLocale(cookies().get(APP_LOCALE_COOKIE_NAME)?.value);
}

export function persistAppLocaleCookie(locale?: string | null): AssessmentLocale {
  const resolvedLocale = normalizeAssessmentLocale(locale ?? cookies().get(APP_LOCALE_COOKIE_NAME)?.value);

  cookies().set(APP_LOCALE_COOKIE_NAME, resolvedLocale, getAppLocaleCookieOptions());

  return resolvedLocale;
}

export function clearAppLocaleCookie() {
  cookies().set(APP_LOCALE_COOKIE_NAME, DEFAULT_ASSESSMENT_LOCALE, getAppLocaleCookieOptions(0));
}
