import "server-only";

import {
  getAssessmentLocaleFallbacks,
  getPreferredAssessmentLocaleRecord,
  type AssessmentLocale,
} from "@/lib/assessment/locale";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type TestLocalizationRow = {
  locale: string;
  name: string;
  description: string | null;
};

export type LocalizedTestMetadata = {
  name: string;
  description: string | null;
  locale: string | null;
};

export function resolveLocalizedTestMetadata(
  fallbackMetadata: {
    name: string;
    description: string | null;
  },
  localizations: TestLocalizationRow[],
  locale?: AssessmentLocale | null,
): LocalizedTestMetadata {
  const localization = getPreferredAssessmentLocaleRecord(localizations, locale);

  if (!localization) {
    return {
      ...fallbackMetadata,
      locale: null,
    };
  }

  return {
    name: localization.name,
    description: localization.description,
    locale: localization.locale,
  };
}

export async function getLocalizedTestMetadata(
  testId: string,
  fallbackMetadata: {
    name: string;
    description: string | null;
  },
  locale?: AssessmentLocale | null,
): Promise<LocalizedTestMetadata> {
  if (!locale) {
    return {
      ...fallbackMetadata,
      locale: null,
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("test_localizations")
    .select("locale, name, description")
    .eq("test_id", testId)
    .in("locale", getAssessmentLocaleFallbacks(locale));

  if (error) {
    throw new Error(`Failed to load test localizations: ${error.message}`);
  }

  return resolveLocalizedTestMetadata(
    fallbackMetadata,
    (data ?? []) as TestLocalizationRow[],
    locale,
  );
}
