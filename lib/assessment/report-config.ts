import "server-only";

import type { ReportGeneratorType } from "@/lib/assessment/report-providers";

export type AiReportConfig = {
  provider: ReportGeneratorType;
  model: string | null;
  promptVersion: string;
  fallbackToMock: boolean;
  openAiApiKey: string | null;
};

function normalizeBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  return value.toLowerCase() === "true";
}

export function getAiReportConfig(): AiReportConfig {
  const provider = (process.env.AI_REPORT_PROVIDER ?? "mock").toLowerCase();

  return {
    provider: provider === "openai" ? "openai" : "mock",
    model: process.env.AI_REPORT_MODEL ?? null,
    promptVersion: process.env.AI_REPORT_PROMPT_VERSION ?? "v1",
    fallbackToMock: normalizeBooleanEnv(process.env.AI_REPORT_FALLBACK_TO_MOCK, true),
    openAiApiKey: process.env.OPENAI_API_KEY ?? null,
  };
}
