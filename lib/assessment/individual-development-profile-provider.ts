import "server-only";

import type { IndividualDevelopmentProfileSnapshot } from "@/lib/assessment/individual-development-profile-contract";
import type { IndividualDevelopmentProfileInputSnapshot } from "@/lib/assessment/individual-development-profile-input";
import {
  generateIndividualDevelopmentProfileWithMock,
} from "@/lib/assessment/individual-development-profile-mock-provider";

export const INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_MOCK = "mock" as const;
export const DEFAULT_INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER =
  INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_MOCK;

export type IndividualDevelopmentProfileProviderKind =
  typeof INDIVIDUAL_DEVELOPMENT_PROFILE_PROVIDER_MOCK;

export type IndividualDevelopmentProfileProviderFailureReason =
  | "invalid_input"
  | "validation_failed";

export type IndividualDevelopmentProfileProviderSeamResult =
  | {
      ok: true;
      provider: IndividualDevelopmentProfileProviderKind;
      reportSnapshot: IndividualDevelopmentProfileSnapshot;
    }
  | {
      ok: false;
      provider: IndividualDevelopmentProfileProviderKind;
      reason: IndividualDevelopmentProfileProviderFailureReason;
      errors: string[];
    };

export async function generateIndividualDevelopmentProfileReport(
  inputSnapshot: IndividualDevelopmentProfileInputSnapshot,
): Promise<IndividualDevelopmentProfileProviderSeamResult> {
  const result = generateIndividualDevelopmentProfileWithMock(inputSnapshot);

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
  };
}
