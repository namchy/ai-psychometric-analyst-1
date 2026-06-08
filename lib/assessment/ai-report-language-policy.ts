import "server-only";

import {
  normalizeAssessmentLocale,
  type AssessmentLocale,
} from "@/lib/assessment/locale";
import {
  buildGlobalBhsUserFacingPromptPolicyBlock,
  canonicalizeGlobalBhsUserFacingOutput,
  validateGlobalBhsUserFacingOutput,
  type BhsUserFacingOutputValidationError,
  type BhsUserFacingPromptPolicyOptions,
} from "@/lib/assessment/ai-report-bhs-language-policy";

export type AiReportLanguagePolicyKey = "bhs_bs_user_facing";

export type AiReportLanguagePolicy = {
  key: AiReportLanguagePolicyKey;
  locale: AssessmentLocale;
  buildPromptPolicyBlock: (options: BhsUserFacingPromptPolicyOptions) => string;
  canonicalizeUserFacingOutput: <T>(value: T) => T;
  validateUserFacingOutput: (
    value: unknown,
    options?: {
      audience?: "hr" | "participant";
    },
  ) => BhsUserFacingOutputValidationError[];
};

export function resolveAiReportLanguagePolicy(
  locale: string | null | undefined,
): AiReportLanguagePolicy | null {
  const normalizedLocale = normalizeAssessmentLocale(locale);

  if (normalizedLocale !== "bs") {
    return null;
  }

  return {
    key: "bhs_bs_user_facing",
    locale: "bs",
    buildPromptPolicyBlock: buildGlobalBhsUserFacingPromptPolicyBlock,
    canonicalizeUserFacingOutput: canonicalizeGlobalBhsUserFacingOutput,
    validateUserFacingOutput: validateGlobalBhsUserFacingOutput,
  };
}
