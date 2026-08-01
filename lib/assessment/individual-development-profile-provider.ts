import "server-only";

import type { IndividualDevelopmentProfileSnapshot } from "@/lib/assessment/individual-development-profile-contract";
import type { IndividualDevelopmentProfileInputSnapshot } from "@/lib/assessment/individual-development-profile-input";
import {
  generateIndividualDevelopmentProfileWithOpenAi,
  INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_OPENAI,
  type IndividualDevelopmentProfileOpenAiProviderOptions,
} from "@/lib/assessment/individual-development-profile-openai-provider";
import {
  generateIndividualDevelopmentProfileWithMock,
} from "@/lib/assessment/individual-development-profile-mock-provider";
import { getAiReportConfig, type AiReportConfig } from "@/lib/assessment/report-config";
import {
  getActiveReportRuntimeConfig,
  type ActiveReportRuntimeConfig,
} from "@/lib/assessment/report-runtime-config";
import { shouldOmitOpenAiTemperature } from "@/lib/assessment/report-provider-openai";

export { INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_OPENAI };
export const INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_MOCK = "mock" as const;
export const DEFAULT_INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER =
  INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_MOCK;

export type IndividualDevelopmentProfileProviderKind =
  | typeof INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_MOCK
  | typeof INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_OPENAI;

export type IndividualDevelopmentProfileProviderFailureReason =
  | "invalid_input"
  | "provider_failed"
  | "validation_failed";

export type IndividualDevelopmentProfileProviderSeamResult =
  | {
      ok: true;
      provider: IndividualDevelopmentProfileProviderKind;
      reportSnapshot: IndividualDevelopmentProfileSnapshot;
      modelName: string | null;
    }
  | {
      ok: false;
      provider: IndividualDevelopmentProfileProviderKind;
      reason: IndividualDevelopmentProfileProviderFailureReason;
      errors: string[];
    };

type IndividualDevelopmentProfileProviderConfig = Pick<
  AiReportConfig,
  "provider" | "model" | "reasoningEffort" | "openAiApiKey" | "openAiTimeoutMs"
>;

type IndividualDevelopmentProfileProviderDependencies = {
  config?: IndividualDevelopmentProfileProviderConfig;
  generateMock?: typeof generateIndividualDevelopmentProfileWithMock;
  generateOpenAi?: typeof generateIndividualDevelopmentProfileWithOpenAi;
  loadRuntimeConfig?: typeof getActiveReportRuntimeConfig;
  runtimeConfig?: Pick<
    ActiveReportRuntimeConfig,
    "modelName" | "temperature"
  > | null;
  openAiOptions?: Pick<
    IndividualDevelopmentProfileOpenAiProviderOptions,
    "client" | "fetchImpl" | "now"
  >;
};

export async function generateIndividualDevelopmentProfileReport(
  inputSnapshot: IndividualDevelopmentProfileInputSnapshot,
  deps: IndividualDevelopmentProfileProviderDependencies = {},
): Promise<IndividualDevelopmentProfileProviderSeamResult> {
  const config = deps.config ?? getAiReportConfig();

  if (config.provider === INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_OPENAI) {
    let runtimeConfig = deps.runtimeConfig;

    if (runtimeConfig === undefined) {
      try {
        runtimeConfig = await (
          deps.loadRuntimeConfig ?? getActiveReportRuntimeConfig
        )({
          reportType: "individual_development_profile",
          audience: "hr",
          sourceType: "assessment",
          generatorType: "openai",
        });
      } catch (error) {
        return {
          ok: false,
          provider: INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_OPENAI,
          reason: "provider_failed",
          errors: [
            error instanceof Error
              ? error.message
              : "Failed to load IDP OpenAI runtime config.",
          ],
        };
      }
    }

    const result = await (
      deps.generateOpenAi ?? generateIndividualDevelopmentProfileWithOpenAi
    )(inputSnapshot, {
      apiKey: config.openAiApiKey,
      model: config.model,
      reasoningEffort: config.reasoningEffort,
      timeoutMs: config.openAiTimeoutMs,
      temperature:
        config.model && !shouldOmitOpenAiTemperature(config.model) ? 0.2 : null,
      ...deps.openAiOptions,
    });

    if (!result.ok) {
      return {
        ok: false,
        provider: INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_OPENAI,
        reason:
          result.reason === "invalid_input"
            ? "invalid_input"
            : result.reason === "validation_failed"
              ? "validation_failed"
              : "provider_failed",
        errors: result.errors,
      };
    }

    return {
      ok: true,
      provider: INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_OPENAI,
      reportSnapshot: result.reportSnapshot,
      modelName: result.modelName,
    };
  }

  const result = (deps.generateMock ?? generateIndividualDevelopmentProfileWithMock)(
    inputSnapshot,
  );

  if (!result.ok) {
    return {
      ok: false,
      provider: DEFAULT_INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER,
      reason: result.reason,
      errors: result.errors,
    };
  }

  return {
    ok: true,
    provider: DEFAULT_INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER,
    reportSnapshot: result.reportSnapshot,
    modelName: null,
  };
}
