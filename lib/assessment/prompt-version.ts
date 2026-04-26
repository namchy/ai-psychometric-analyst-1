import "server-only";

import {
  getAssessmentLocaleFallbacks,
  getPreferredAssessmentLocaleRecord,
  type AssessmentLocale,
} from "@/lib/assessment/locale";
import type { ReportGeneratorType } from "@/lib/assessment/report-providers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ActivePromptVersionRow = {
  id: string;
  test_id: string | null;
  report_type: string;
  audience: "participant" | "hr";
  source_type: string;
  generator_type: ReportGeneratorType;
  prompt_key: string;
  version: string;
  system_prompt: string;
  user_prompt_template: string;
  output_schema_json: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

type PromptVersionLocalizationRow = {
  locale: string;
  system_prompt: string;
  user_prompt_template: string;
};

export type ActivePromptVersion = {
  id: string;
  testId: string | null;
  reportType: string;
  audience: "participant" | "hr";
  sourceType: string;
  generatorType: ReportGeneratorType;
  promptKey: string;
  version: string;
  systemPrompt: string;
  userPromptTemplate: string;
  outputSchemaJson: unknown;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type ActivePromptVersionSelector = {
  testId: string | null;
  reportType: string | null;
  audience: "participant" | "hr";
  sourceType: string | null;
  generatorType: ReportGeneratorType;
  promptKey: string | null;
};

function normalizeActivePromptVersion(value: unknown): ActivePromptVersion | null {
  const row = Array.isArray(value) ? value[0] : value;

  if (!row || typeof row !== "object") {
    return null;
  }

  const candidate = row as Partial<ActivePromptVersionRow>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.report_type !== "string" ||
    (candidate.audience !== "participant" && candidate.audience !== "hr") ||
    typeof candidate.source_type !== "string" ||
    (candidate.generator_type !== "mock" && candidate.generator_type !== "openai") ||
    typeof candidate.prompt_key !== "string" ||
    typeof candidate.version !== "string" ||
    typeof candidate.system_prompt !== "string" ||
    typeof candidate.user_prompt_template !== "string" ||
    typeof candidate.created_at !== "string" ||
    typeof candidate.updated_at !== "string"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    testId: typeof candidate.test_id === "string" ? candidate.test_id : null,
    reportType: candidate.report_type,
    audience: candidate.audience,
    sourceType: candidate.source_type,
    generatorType: candidate.generator_type,
    promptKey: candidate.prompt_key,
    version: candidate.version,
    systemPrompt: candidate.system_prompt,
    userPromptTemplate: candidate.user_prompt_template,
    outputSchemaJson: candidate.output_schema_json ?? null,
    notes: typeof candidate.notes === "string" ? candidate.notes : null,
    createdAt: candidate.created_at,
    updatedAt: candidate.updated_at,
    updatedBy: typeof candidate.updated_by === "string" ? candidate.updated_by : null,
  };
}

export async function getActivePromptVersion(
  selector: ActivePromptVersionSelector,
  options?: {
    locale?: AssessmentLocale | null;
  },
): Promise<ActivePromptVersion | null> {
  if (!selector.reportType || !selector.sourceType || !selector.promptKey) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("get_active_prompt_version", {
    p_test_id: selector.testId,
    p_report_type: selector.reportType,
    p_audience: selector.audience,
    p_source_type: selector.sourceType,
    p_generator_type: selector.generatorType,
    p_prompt_key: selector.promptKey,
  });

  if (error) {
    throw new Error(`Failed to load active prompt version: ${error.message}`);
  }

  const promptVersion = normalizeActivePromptVersion(data);

  if (!promptVersion || !options?.locale) {
    return promptVersion;
  }

  const { data: localizationData, error: localizationError } = await supabase
    .from("prompt_version_localizations")
    .select("locale, system_prompt, user_prompt_template")
    .eq("prompt_version_id", promptVersion.id)
    .in("locale", getAssessmentLocaleFallbacks(options.locale));

  if (localizationError) {
    throw new Error(
      `Failed to load prompt version localization: ${localizationError.message}`,
    );
  }

  const localization = getPreferredAssessmentLocaleRecord(
    (localizationData ?? []) as PromptVersionLocalizationRow[],
    options.locale,
  );

  if (!localization) {
    return promptVersion;
  }

  return {
    ...promptVersion,
    systemPrompt: localization.system_prompt,
    userPromptTemplate: localization.user_prompt_template,
  };
}
