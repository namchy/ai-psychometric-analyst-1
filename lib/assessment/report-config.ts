import "server-only";

import type { ReportGeneratorType } from "@/lib/assessment/report-providers";

export type AiReportConfig = {
  provider: ReportGeneratorType;
  model: string | null;
  promptVersion: string;
  fallbackToMock: boolean;
  openAiApiKey: string | null;
  openAiTimeoutMs: number;
};

function normalizeBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  return value.toLowerCase() === "true";
}

function normalizeTimeoutEnv(value: string | undefined, defaultValue: number): number {
  if (!value) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return parsed;
}

export function getAiReportConfig(): AiReportConfig {
  const provider = (process.env.AI_REPORT_PROVIDER ?? "mock").toLowerCase();

  return {
    provider: provider === "openai" ? "openai" : "mock",
    model: process.env.AI_REPORT_MODEL ?? null,
    promptVersion: process.env.AI_REPORT_PROMPT_VERSION ?? "v1",
    fallbackToMock: normalizeBooleanEnv(process.env.AI_REPORT_FALLBACK_TO_MOCK, true),
    openAiApiKey: process.env.OPENAI_API_KEY ?? null,
    openAiTimeoutMs: normalizeTimeoutEnv(process.env.AI_REPORT_OPENAI_TIMEOUT_MS, 120000),
  };
}
