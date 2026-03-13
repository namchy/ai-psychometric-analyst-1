import "server-only";

import { getAiReportConfig } from "@/lib/assessment/report-config";
import { mockReportProvider } from "@/lib/assessment/report-provider-mock";
import { createOpenAiReportProvider } from "@/lib/assessment/report-provider-openai";
import type { ReportProvider } from "@/lib/assessment/report-providers";

export function createSelectedReportProvider(): ReportProvider {
  const config = getAiReportConfig();

  if (config.provider === "openai") {
    return createOpenAiReportProvider({
      apiKey: config.openAiApiKey,
      model: config.model,
      timeoutMs: config.openAiTimeoutMs,
    });
  }

  return mockReportProvider;
}
