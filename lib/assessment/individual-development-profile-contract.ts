export const INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE =
  "individual_development_profile_v1" as const;
export const INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION = "v1" as const;
export const INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE = "hr" as const;

export type IndividualDevelopmentRisk = {
  possibleBlocker: string;
  whyItMatters: string;
  whatToCheck: string;
  howToSupport: string;
};

export type IndividualDevelopmentOneOnOneGuidanceItem = {
  question: string;
  whatToListenFor: string;
  signalBeingChecked: string;
  possibleFollowUp: string;
};

export type IndividualDevelopmentManagerWatchpoint = {
  watchpoint: string;
  whyItMatters: string;
  earlySignal: string;
  suggestedManagerResponse: string;
};

export type IndividualDevelopmentProfileSnapshot = {
  reportType: typeof INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE;
  reportVersion: typeof INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION;
  locale: string;
  audience: typeof INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE;
  developmentSummary: {
    headline: string;
    overallPattern: string;
    strongestContributionSignals: string[];
    mainSupportNeed: string;
    usageNote: string;
  };
  contributionPattern: {
    bestConditions: string[];
    collaborationConditions: string[];
    supportPreferences: string[];
    roleShapingImplications: string[];
  };
  developmentRisks: IndividualDevelopmentRisk[];
  communicationAndFeedbackGuidance: {
    whatHelps: string[];
    whatToAvoid: string[];
    howToPhraseFeedback: string[];
    whatToClarify: string[];
  };
  motivationAndEnergyGuidance: {
    likelySourcesOfEnergy: string[];
    likelySourcesOfDrain: string[];
    supportSignals: string[];
    whatToValidate: string[];
  };
  oneOnOneGuidance: IndividualDevelopmentOneOnOneGuidanceItem[];
  onboardingAndDevelopmentPlan: {
    first30Days: string[];
    days31To60: string[];
    days61To90: string[];
  };
  managerWatchpoints: IndividualDevelopmentManagerWatchpoint[];
  interpretationLimits: string[];
  metadata: {
    generatedAt: string;
  };
};

export type IndividualDevelopmentProfileValidationResult =
  | { ok: true; value: IndividualDevelopmentProfileSnapshot }
  | { ok: false; errors: string[] };

const FORBIDDEN_KEY_PATTERNS = [
  /(^|\.)(fitScore|hireScore)$/i,
  /(^|\.)(hireRecommendation|hiringRecommendation|rejectRecommendation|decisionRecommendation)$/i,
  /(^|\.)(rawAnswers|rawResponses|itemText|rawItemText)$/i,
  /(^|\.)(scoringKeys|scoreKeys|memberScores|individualScores)$/i,
  /(^|\.)(candidateVisible|candidateFacing)$/i,
];

const FORBIDDEN_TEXT_PATTERNS = [
  /\bno-hire\b/i,
  /\bhire recommendation\b/i,
  /\brecommend(?:ed)? for hire\b/i,
  /\bdo not hire\b/i,
  /\bfit score\b/i,
  /\bmatch score\b/i,
  /\b\d{1,3}(?:\.\d+)?\s*\/\s*100\b/i,
  /\b\d{1,3}(?:\.\d+)?%\s*(?:fit|match)\b/i,
  /\bdiagnos(?:is|e|ed|tic)\b/i,
  /\bclinical\b/i,
  /\bdisorder\b/i,
  /\bbad fit\b/i,
  /\bpoor fit\b/i,
  /\bnot suitable\b/i,
  /\bwill perform\b/i,
  /\bwill succeed\b/i,
  /\bwill fail\b/i,
  /\btop candidate\b/i,
  /\brank(?:ing|ed)? candidates?\b/i,
  /\bbetter than other candidates\b/i,
  /\bbecause of (?:their|the candidate'?s)?\s*(?:age|gender|sex|race|ethnicity|religion|disability|pregnancy|sexual orientation|marital status)\b/i,
  /\binfer(?:red|s)?\s+(?:age|gender|sex|race|ethnicity|religion|disability|pregnancy|sexual orientation|marital status)\b/i,
];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateNonEmptyString(value: unknown, path: string, errors: string[]): value is string {
  if (!isNonEmptyString(value)) {
    errors.push(`${path}: Expected non-empty string.`);
    return false;
  }

  return true;
}

function validateStringArray(
  value: unknown,
  path: string,
  errors: string[],
  options?: { minLength?: number },
): value is string[] {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  if (options?.minLength && value.length < options.minLength) {
    errors.push(`${path}: Expected at least ${options.minLength} items.`);
  }

  value.forEach((entry, index) => {
    validateNonEmptyString(entry, `${path}[${index}]`, errors);
  });

  return true;
}

function collectStringLeaves(value: unknown, output: string[] = []): string[] {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectStringLeaves(entry, output));
    return output;
  }

  if (isPlainRecord(value)) {
    Object.values(value).forEach((entry) => collectStringLeaves(entry, output));
  }

  return output;
}

function hasForbiddenKeyDeep(value: unknown, path = "", errors: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      hasForbiddenKeyDeep(entry, `${path}[${index}]`, errors);
    });
    return errors;
  }

  if (!isPlainRecord(value)) {
    return errors;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;

    if (FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(nextPath))) {
      errors.push(`${nextPath}: Forbidden field in Individual Development Profile snapshot.`);
    }

    hasForbiddenKeyDeep(nestedValue, nextPath, errors);
  }

  return errors;
}

function findForbiddenWording(value: unknown): string[] {
  const errors: string[] = [];

  collectStringLeaves(value).forEach((entry) => {
    FORBIDDEN_TEXT_PATTERNS.forEach((pattern) => {
      if (pattern.test(entry)) {
        errors.push(`forbiddenText: Found forbidden phrase matching ${pattern}.`);
      }
    });
  });

  return errors;
}

function validateDevelopmentRisks(
  value: unknown,
  path: string,
  errors: string[],
): value is IndividualDevelopmentRisk[] {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  if (value.length < 1) {
    errors.push(`${path}: Expected at least 1 item.`);
  }

  value.forEach((entry, index) => {
    if (!isPlainRecord(entry)) {
      errors.push(`${path}[${index}]: Expected object.`);
      return;
    }

    validateNonEmptyString(entry.possibleBlocker, `${path}[${index}].possibleBlocker`, errors);
    validateNonEmptyString(entry.whyItMatters, `${path}[${index}].whyItMatters`, errors);
    validateNonEmptyString(entry.whatToCheck, `${path}[${index}].whatToCheck`, errors);
    validateNonEmptyString(entry.howToSupport, `${path}[${index}].howToSupport`, errors);
  });

  return true;
}

function validateOneOnOneGuidance(
  value: unknown,
  path: string,
  errors: string[],
): value is IndividualDevelopmentOneOnOneGuidanceItem[] {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  if (value.length < 1) {
    errors.push(`${path}: Expected at least 1 item.`);
  }

  value.forEach((entry, index) => {
    if (!isPlainRecord(entry)) {
      errors.push(`${path}[${index}]: Expected object.`);
      return;
    }

    validateNonEmptyString(entry.question, `${path}[${index}].question`, errors);
    validateNonEmptyString(entry.whatToListenFor, `${path}[${index}].whatToListenFor`, errors);
    validateNonEmptyString(
      entry.signalBeingChecked,
      `${path}[${index}].signalBeingChecked`,
      errors,
    );
    validateNonEmptyString(entry.possibleFollowUp, `${path}[${index}].possibleFollowUp`, errors);
  });

  return true;
}

function validateManagerWatchpoints(
  value: unknown,
  path: string,
  errors: string[],
): value is IndividualDevelopmentManagerWatchpoint[] {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  if (value.length < 1) {
    errors.push(`${path}: Expected at least 1 item.`);
  }

  value.forEach((entry, index) => {
    if (!isPlainRecord(entry)) {
      errors.push(`${path}[${index}]: Expected object.`);
      return;
    }

    validateNonEmptyString(entry.watchpoint, `${path}[${index}].watchpoint`, errors);
    validateNonEmptyString(entry.whyItMatters, `${path}[${index}].whyItMatters`, errors);
    validateNonEmptyString(entry.earlySignal, `${path}[${index}].earlySignal`, errors);
    validateNonEmptyString(
      entry.suggestedManagerResponse,
      `${path}[${index}].suggestedManagerResponse`,
      errors,
    );
  });

  return true;
}

export function validateIndividualDevelopmentProfileSnapshot(
  value: unknown,
): IndividualDevelopmentProfileValidationResult {
  const errors: string[] = [];

  if (!isPlainRecord(value)) {
    return { ok: false, errors: ["<root>: Expected object."] };
  }

  if (value.reportType !== INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE) {
    errors.push(`reportType: Expected ${INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE}.`);
  }

  if (value.reportVersion !== INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION) {
    errors.push(`reportVersion: Expected ${INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION}.`);
  }

  if (value.audience !== INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE) {
    errors.push(`audience: Expected ${INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE}.`);
  }

  validateNonEmptyString(value.locale, "locale", errors);

  if (!isPlainRecord(value.developmentSummary)) {
    errors.push("developmentSummary: Expected object.");
  } else {
    validateNonEmptyString(value.developmentSummary.headline, "developmentSummary.headline", errors);
    validateNonEmptyString(
      value.developmentSummary.overallPattern,
      "developmentSummary.overallPattern",
      errors,
    );
    validateStringArray(
      value.developmentSummary.strongestContributionSignals,
      "developmentSummary.strongestContributionSignals",
      errors,
      { minLength: 1 },
    );
    validateNonEmptyString(
      value.developmentSummary.mainSupportNeed,
      "developmentSummary.mainSupportNeed",
      errors,
    );
    validateNonEmptyString(value.developmentSummary.usageNote, "developmentSummary.usageNote", errors);
  }

  if (!isPlainRecord(value.contributionPattern)) {
    errors.push("contributionPattern: Expected object.");
  } else {
    validateStringArray(value.contributionPattern.bestConditions, "contributionPattern.bestConditions", errors, {
      minLength: 1,
    });
    validateStringArray(
      value.contributionPattern.collaborationConditions,
      "contributionPattern.collaborationConditions",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      value.contributionPattern.supportPreferences,
      "contributionPattern.supportPreferences",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      value.contributionPattern.roleShapingImplications,
      "contributionPattern.roleShapingImplications",
      errors,
      { minLength: 1 },
    );
  }

  validateDevelopmentRisks(value.developmentRisks, "developmentRisks", errors);

  if (!isPlainRecord(value.communicationAndFeedbackGuidance)) {
    errors.push("communicationAndFeedbackGuidance: Expected object.");
  } else {
    validateStringArray(
      value.communicationAndFeedbackGuidance.whatHelps,
      "communicationAndFeedbackGuidance.whatHelps",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      value.communicationAndFeedbackGuidance.whatToAvoid,
      "communicationAndFeedbackGuidance.whatToAvoid",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      value.communicationAndFeedbackGuidance.howToPhraseFeedback,
      "communicationAndFeedbackGuidance.howToPhraseFeedback",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      value.communicationAndFeedbackGuidance.whatToClarify,
      "communicationAndFeedbackGuidance.whatToClarify",
      errors,
      { minLength: 1 },
    );
  }

  if (!isPlainRecord(value.motivationAndEnergyGuidance)) {
    errors.push("motivationAndEnergyGuidance: Expected object.");
  } else {
    validateStringArray(
      value.motivationAndEnergyGuidance.likelySourcesOfEnergy,
      "motivationAndEnergyGuidance.likelySourcesOfEnergy",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      value.motivationAndEnergyGuidance.likelySourcesOfDrain,
      "motivationAndEnergyGuidance.likelySourcesOfDrain",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      value.motivationAndEnergyGuidance.supportSignals,
      "motivationAndEnergyGuidance.supportSignals",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      value.motivationAndEnergyGuidance.whatToValidate,
      "motivationAndEnergyGuidance.whatToValidate",
      errors,
      { minLength: 1 },
    );
  }

  validateOneOnOneGuidance(value.oneOnOneGuidance, "oneOnOneGuidance", errors);

  if (!isPlainRecord(value.onboardingAndDevelopmentPlan)) {
    errors.push("onboardingAndDevelopmentPlan: Expected object.");
  } else {
    validateStringArray(
      value.onboardingAndDevelopmentPlan.first30Days,
      "onboardingAndDevelopmentPlan.first30Days",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      value.onboardingAndDevelopmentPlan.days31To60,
      "onboardingAndDevelopmentPlan.days31To60",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      value.onboardingAndDevelopmentPlan.days61To90,
      "onboardingAndDevelopmentPlan.days61To90",
      errors,
      { minLength: 1 },
    );
  }

  validateManagerWatchpoints(value.managerWatchpoints, "managerWatchpoints", errors);
  validateStringArray(value.interpretationLimits, "interpretationLimits", errors, { minLength: 1 });

  if (!isPlainRecord(value.metadata)) {
    errors.push("metadata: Expected object.");
  } else {
    validateNonEmptyString(value.metadata.generatedAt, "metadata.generatedAt", errors);
  }

  hasForbiddenKeyDeep(value, "", errors);
  errors.push(...findForbiddenWording(value));

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: value as IndividualDevelopmentProfileSnapshot };
}
