import "server-only";

import type { ReportGeneratorType } from "@/lib/assessment/report-providers";

export type AiReportConfig = {
  provider: ReportGeneratorType;
  model: string | null;
  reasoningEffort: AiReportReasoningEffort | null;
  promptVersion: string;
  ipipNeo120ParticipantReportVersion: IpipNeo120ParticipantReportVersion;
  ipipNeo120ParticipantGenerationMode: IpipNeo120ParticipantGenerationMode;
  fallbackToMock: boolean;
  openAiApiKey: string | null;
  openAiTimeoutMs: number;
};

export type AiReportReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export type IpipNeo120ParticipantReportVersion = "v1" | "v2";
export type IpipNeo120ParticipantGenerationMode = "single" | "segmented";

export function normalizeAiReportReasoningEffort(
  value: string | null | undefined,
): AiReportReasoningEffort | null {
  const normalized = value?.trim().toLowerCase();

  return normalized === "none" ||
    normalized === "minimal" ||
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high" ||
    normalized === "xhigh"
    ? normalized
    : null;
}

export function getAiReportReasoningEffort(): AiReportReasoningEffort | null {
  return normalizeAiReportReasoningEffort(process.env.AI_REPORT_REASONING_EFFORT);
}

export function getAiReportReasoningEffortForModel(
  model: string,
  configuredReasoningEffort: AiReportReasoningEffort | null = getAiReportReasoningEffort(),
): AiReportReasoningEffort | null {
  return model.toLowerCase().startsWith("gpt-5")
    ? configuredReasoningEffort
    : null;
}

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

export function normalizeAiReportModel(model: string | null | undefined): string | null {
  if (!model) {
    return null;
  }

  if (model === "gpt-5.4-thinking") {
    return "gpt-5.1";
  }

  return model;
}

export function normalizeIpipNeo120ParticipantReportVersion(
  value: string | null | undefined,
): IpipNeo120ParticipantReportVersion {
  return value === "v2" ? "v2" : "v1";
}

export function getIpipNeo120ParticipantReportVersion(): IpipNeo120ParticipantReportVersion {
  return normalizeIpipNeo120ParticipantReportVersion(
    process.env.IPIP_NEO_120_PARTICIPANT_REPORT_VERSION,
  );
}

export function normalizeIpipNeo120ParticipantGenerationMode(
  value: string | null | undefined,
): IpipNeo120ParticipantGenerationMode {
  return value === "segmented" ? "segmented" : "single";
}

export function getIpipNeo120ParticipantGenerationMode(): IpipNeo120ParticipantGenerationMode {
  return normalizeIpipNeo120ParticipantGenerationMode(
    process.env.IPIP_NEO_120_PARTICIPANT_GENERATION_MODE,
  );
}

export function getAiReportConfig(): AiReportConfig {
  const provider = (process.env.AI_REPORT_PROVIDER ?? "mock").toLowerCase();

  return {
    provider: provider === "openai" ? "openai" : "mock",
    model: normalizeAiReportModel(process.env.AI_REPORT_MODEL ?? null),
    reasoningEffort: getAiReportReasoningEffort(),
    promptVersion: process.env.AI_REPORT_PROMPT_VERSION ?? "v1",
    ipipNeo120ParticipantReportVersion: getIpipNeo120ParticipantReportVersion(),
    ipipNeo120ParticipantGenerationMode: getIpipNeo120ParticipantGenerationMode(),
    fallbackToMock: normalizeBooleanEnv(process.env.AI_REPORT_FALLBACK_TO_MOCK, true),
    openAiApiKey: process.env.OPENAI_API_KEY ?? null,
    openAiTimeoutMs: normalizeTimeoutEnv(process.env.AI_REPORT_OPENAI_TIMEOUT_MS, 120000),
  };
}
