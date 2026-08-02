import "server-only";

import { getAiReportConfig, type AiReportConfig } from "@/lib/assessment/report-config";
import { mockReportProvider } from "@/lib/assessment/report-provider-mock";
import { createOpenAiReportProvider } from "@/lib/assessment/report-provider-openai";
import type { ReportProvider } from "@/lib/assessment/report-providers";
import type { AiUsageRecorder } from "@/lib/assessment/ai-usage-accounting";

export function createSelectedReportProvider(
  config: AiReportConfig = getAiReportConfig(),
  options?: { aiUsageRecorder?: AiUsageRecorder },
): ReportProvider {

  if (config.provider === "openai") {
    return createOpenAiReportProvider({
      apiKey: config.openAiApiKey,
      model: config.model,
      reasoningEffort: config.reasoningEffort,
      timeoutMs: config.openAiTimeoutMs,
      usageRecorder: options?.aiUsageRecorder,
    });
  }

  return mockReportProvider;
}
