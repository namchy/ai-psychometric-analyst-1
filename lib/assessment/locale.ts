export const DEFAULT_ASSESSMENT_LOCALE = "bs" as const;
export const SUPPORTED_ASSESSMENT_LOCALES = ["bs", "hr", "sr", "en"] as const;
export const SUPPORTED_BCP47_ASSESSMENT_LOCALES = [
  "bs-Latn-BA",
  "hr-Latn-HR",
  "sr-Cyrl-RS",
] as const;

export type AssessmentLocale = (typeof SUPPORTED_ASSESSMENT_LOCALES)[number];
export type AssessmentLocaleAlias =
  | AssessmentLocale
  | (typeof SUPPORTED_BCP47_ASSESSMENT_LOCALES)[number];

export function isAssessmentLocale(
  value: string | null | undefined,
): value is AssessmentLocale {
  return value === "bs" || value === "hr" || value === "sr" || value === "en";
}

export function isAssessmentLocaleAlias(
  value: string | null | undefined,
): value is AssessmentLocaleAlias {
  return (
    isAssessmentLocale(value) ||
    value === "bs-Latn-BA" ||
    value === "hr-Latn-HR" ||
    value === "sr-Cyrl-RS"
  );
}

export function normalizeAssessmentLocale(
  value: string | null | undefined,
): AssessmentLocale {
  if (value === "bs" || value === "bs-Latn-BA") {
    return "bs";
  }

  if (value === "hr" || value === "hr-Latn-HR") {
    return "hr";
  }

  if (value === "sr" || value === "sr-Cyrl-RS") {
    return "sr";
  }

  if (value === "en") {
    return "en";
  }

  return DEFAULT_ASSESSMENT_LOCALE;
}

export function toLegacyAssessmentLocale(
  value: string | null | undefined,
): AssessmentLocale {
  return normalizeAssessmentLocale(value);
}

export function getAssessmentLocaleFallbacks(
  value: string | null | undefined,
): AssessmentLocale[] {
  const locale = normalizeAssessmentLocale(value);

  if (locale === "hr") {
    return ["hr", "bs"];
  }

  if (locale === "sr") {
    return ["sr", "bs"];
  }

  if (locale === "en") {
    return ["en", "bs"];
  }

  return ["bs"];
}

export function getPreferredAssessmentLocaleRecord<T extends { locale: string }>(
  rows: T[],
  locale: string | null | undefined,
): T | null {
  const fallbacks = getAssessmentLocaleFallbacks(locale);

  for (const fallbackLocale of fallbacks) {
    const exactMatch = rows.find((row) => row.locale === fallbackLocale);

    if (exactMatch) {
      return exactMatch;
    }

    const normalizedMatch = rows.find(
      (row) => normalizeAssessmentLocale(row.locale) === fallbackLocale,
    );

    if (normalizedMatch) {
      return normalizedMatch;
    }
  }

  return rows[0] ?? null;
}

export function getAssessmentLocaleLabel(locale: string | null | undefined): string {
  switch (normalizeAssessmentLocale(locale)) {
    case "hr":
      return "Hrvatski";
    case "sr":
      return "Srpski";
    case "en":
      return "English";
    default:
      return "Bosanski";
  }
}
