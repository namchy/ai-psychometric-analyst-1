import "server-only";

import { normalizeAiReportModel } from "@/lib/assessment/report-config";
import type { ReportGeneratorType } from "@/lib/assessment/report-providers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ActiveReportRuntimeConfigRow = {
  id: string;
  report_type: string;
  audience: "participant" | "hr";
  source_type: string;
  generator_type: ReportGeneratorType;
  model_name: string | null;
  reasoning_effort: string | null;
  temperature: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type ActiveReportRuntimeConfig = {
  id: string;
  reportType: string;
  audience: "participant" | "hr";
  sourceType: string;
  generatorType: ReportGeneratorType;
  modelName: string | null;
  reasoningEffort: string | null;
  temperature: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type ActiveReportRuntimeConfigSelector = {
  reportType: string | null;
  audience: "participant" | "hr";
  sourceType: string | null;
  generatorType: ReportGeneratorType;
};

function normalizeTemperature(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeActiveReportRuntimeConfig(
  value: unknown,
): ActiveReportRuntimeConfig | null {
  const row = Array.isArray(value) ? value[0] : value;

  if (!row || typeof row !== "object") {
    return null;
  }

  const candidate = row as Partial<ActiveReportRuntimeConfigRow>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.report_type !== "string" ||
    (candidate.audience !== "participant" && candidate.audience !== "hr") ||
    typeof candidate.source_type !== "string" ||
    (candidate.generator_type !== "mock" && candidate.generator_type !== "openai") ||
    typeof candidate.created_at !== "string" ||
    typeof candidate.updated_at !== "string"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    reportType: candidate.report_type,
    audience: candidate.audience,
    sourceType: candidate.source_type,
    generatorType: candidate.generator_type,
    modelName: normalizeAiReportModel(candidate.model_name ?? null),
    reasoningEffort:
      typeof candidate.reasoning_effort === "string" ? candidate.reasoning_effort : null,
    temperature: normalizeTemperature(candidate.temperature),
    notes: typeof candidate.notes === "string" ? candidate.notes : null,
    createdAt: candidate.created_at,
    updatedAt: candidate.updated_at,
    updatedBy: typeof candidate.updated_by === "string" ? candidate.updated_by : null,
  };
}

export async function getActiveReportRuntimeConfig(
  selector: ActiveReportRuntimeConfigSelector,
): Promise<ActiveReportRuntimeConfig | null> {
  if (!selector.reportType || !selector.sourceType) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("get_active_report_runtime_config", {
    p_report_type: selector.reportType,
    p_audience: selector.audience,
    p_source_type: selector.sourceType,
    p_generator_type: selector.generatorType,
  });

  if (error) {
    throw new Error(`Failed to load active report runtime config: ${error.message}`);
  }

  return normalizeActiveReportRuntimeConfig(data);
}
