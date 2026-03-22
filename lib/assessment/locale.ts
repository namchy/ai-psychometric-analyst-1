export const DEFAULT_ASSESSMENT_LOCALE = "bs" as const;
export const SUPPORTED_ASSESSMENT_LOCALES = ["bs", "hr"] as const;

export type AssessmentLocale = (typeof SUPPORTED_ASSESSMENT_LOCALES)[number];

export function isAssessmentLocale(value: string | null | undefined): value is AssessmentLocale {
  return value === "bs" || value === "hr";
}

export function normalizeAssessmentLocale(
  value: string | null | undefined,
): AssessmentLocale {
  return isAssessmentLocale(value) ? value : DEFAULT_ASSESSMENT_LOCALE;
}

export function getAssessmentLocaleLabel(locale: AssessmentLocale): string {
  return locale === "hr" ? "Hrvatski" : "Bosanski";
}
