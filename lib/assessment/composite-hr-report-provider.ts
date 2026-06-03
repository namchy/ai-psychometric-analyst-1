import "server-only";

import type { CompositeHrInputSnapshot } from "@/lib/assessment/composite-input";
import type { CompositeHrReportSnapshot } from "@/lib/assessment/composite-hr-report-contract";
import { getAiReportConfig, type AiReportConfig } from "@/lib/assessment/report-config";
import {
  generateMockCompositeHrReport,
  COMPOSITE_HR_REPORT_MOCK_PROVIDER,
  COMPOSITE_HR_REPORT_MOCK_PROVIDER_VERSION,
} from "@/lib/assessment/composite-hr-report-provider-mock";
import {
  generateOpenAiCompositeHrReport,
  COMPOSITE_HR_REPORT_OPENAI_PROVIDER,
  COMPOSITE_HR_REPORT_OPENAI_PROVIDER_VERSION,
} from "@/lib/assessment/composite-hr-report-provider-openai";

type CompositeHrProviderConfig = Pick<
  AiReportConfig,
  "provider" | "model" | "openAiApiKey" | "openAiTimeoutMs"
>;

export type CompositeHrReportGenerationResult = {
  snapshot: CompositeHrReportSnapshot | unknown;
  generatorType: "mock" | "openai";
  generatorVersion: string;
  modelName: string | null;
};

type CompositeHrReportProviderDependencies = {
  config?: CompositeHrProviderConfig;
  generateMockReport?: typeof generateMockCompositeHrReport;
  generateOpenAiReport?: typeof generateOpenAiCompositeHrReport;
};

export function getCompositeHrReportProviderConfig(
  config: CompositeHrProviderConfig = getAiReportConfig(),
): CompositeHrProviderConfig {
  return {
    provider: config.provider === "openai" ? "openai" : "mock",
    model: config.model ?? null,
    openAiApiKey: config.openAiApiKey ?? null,
    openAiTimeoutMs: config.openAiTimeoutMs,
  };
}

export async function generateCompositeHrReportSnapshot(
  input: CompositeHrInputSnapshot,
  deps?: CompositeHrReportProviderDependencies,
): Promise<CompositeHrReportGenerationResult> {
  const config = getCompositeHrReportProviderConfig(deps?.config);

  if (config.provider === "openai") {
    const generateOpenAiReport = deps?.generateOpenAiReport ?? generateOpenAiCompositeHrReport;

    return {
      snapshot: await generateOpenAiReport(input, {
        apiKey: config.openAiApiKey,
        model: config.model,
        timeoutMs: config.openAiTimeoutMs,
      }),
      generatorType: COMPOSITE_HR_REPORT_OPENAI_PROVIDER,
      generatorVersion: COMPOSITE_HR_REPORT_OPENAI_PROVIDER_VERSION,
      modelName: config.model,
    };
  }

  const generateMockReport = deps?.generateMockReport ?? generateMockCompositeHrReport;

  return {
    snapshot: await generateMockReport(input),
    generatorType: COMPOSITE_HR_REPORT_MOCK_PROVIDER,
    generatorVersion: COMPOSITE_HR_REPORT_MOCK_PROVIDER_VERSION,
    modelName: null,
  };
}
