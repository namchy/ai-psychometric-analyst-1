export type AiReportProseValidationError = {
  path: string;
  message: string;
};

export type AiReportProseProfile = {
  promptTargetChars: number;
  validatorMaxChars: number;
  allowBullets: boolean;
  allowNewlines: boolean;
  maxSentences?: number;
};

export type AiReportProseProfileName =
  | "ipipHeadline"
  | "ipipExecutiveSummary"
  | "ipipDomainMeaning"
  | "ipipDomainHrRelevance"
  | "ipipInterviewCheck"
  | "ipipInterpretationNote";

const BULLET_OR_LIST_PATTERN = /(^|\n)\s*(?:[-*•]|\d+[.)])\s+/mu;
const NEWLINE_PATTERN = /[\r\n]/u;

const PROFILE_REGISTRY: Record<AiReportProseProfileName, AiReportProseProfile> = {
  ipipHeadline: {
    promptTargetChars: 110,
    validatorMaxChars: 120,
    allowBullets: false,
    allowNewlines: false,
  },
  ipipExecutiveSummary: {
    promptTargetChars: 320,
    validatorMaxChars: 600,
    allowBullets: false,
    allowNewlines: false,
  },
  ipipDomainMeaning: {
    promptTargetChars: 180,
    validatorMaxChars: 300,
    allowBullets: false,
    allowNewlines: false,
  },
  ipipDomainHrRelevance: {
    promptTargetChars: 220,
    validatorMaxChars: 400,
    allowBullets: false,
    allowNewlines: false,
  },
  ipipInterviewCheck: {
    promptTargetChars: 220,
    validatorMaxChars: 400,
    allowBullets: false,
    allowNewlines: false,
  },
  ipipInterpretationNote: {
    promptTargetChars: 220,
    validatorMaxChars: 450,
    allowBullets: false,
    allowNewlines: false,
  },
};

export function getAiReportProseProfile(
  profileName: AiReportProseProfileName,
): AiReportProseProfile {
  return PROFILE_REGISTRY[profileName];
}

export function validateAiReportProseField(
  value: unknown,
  path: string,
  profileName: AiReportProseProfileName,
  errors: AiReportProseValidationError[],
  overrides?: Partial<AiReportProseProfile>,
): value is string {
  const profile = {
    ...getAiReportProseProfile(profileName),
    ...overrides,
  };

  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push({ path, message: "Expected a non-empty string." });
    return false;
  }

  if (!profile.allowNewlines && NEWLINE_PATTERN.test(value)) {
    errors.push({
      path,
      message: "Line breaks are not allowed.",
    });
  }

  if (!profile.allowBullets && BULLET_OR_LIST_PATTERN.test(value)) {
    errors.push({
      path,
      message: "Bullet points or list formatting are not allowed.",
    });
  }

  if (value.trim().length > profile.validatorMaxChars) {
    errors.push({
      path,
      message: `Expected at most ${profile.validatorMaxChars} characters.`,
    });
  }

  if (typeof profile.maxSentences === "number") {
    const sentenceCount = value
      .trim()
      .replace(/\s+/g, " ")
      .split(/[.!?]+/u)
      .map((sentence) => sentence.trim())
      .filter(Boolean).length;

    if (sentenceCount > profile.maxSentences) {
      errors.push({
        path,
        message: `Expected at most ${profile.maxSentences} sentence(s).`,
      });
    }
  }

  return true;
}
