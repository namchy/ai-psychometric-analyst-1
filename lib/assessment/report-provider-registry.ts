import "server-only";

import { getAiReportConfig, type AiReportConfig } from "@/lib/assessment/report-config";
import { mockReportProvider } from "@/lib/assessment/report-provider-mock";
import { createOpenAiReportProvider } from "@/lib/assessment/report-provider-openai";
import type { ReportProvider } from "@/lib/assessment/report-providers";

export function createSelectedReportProvider(config: AiReportConfig = getAiReportConfig()): ReportProvider {

  if (config.provider === "openai") {
    return createOpenAiReportProvider({
      apiKey: config.openAiApiKey,
      model: config.model,
      timeoutMs: config.openAiTimeoutMs,
    });
  }

  return mockReportProvider;
}
