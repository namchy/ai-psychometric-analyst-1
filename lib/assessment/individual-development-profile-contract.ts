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

export type IndividualDevelopmentOnboardingPlanStage = {
  focus: string;
  managerActions: string[];
  feedbackGuidance: string[];
  riskSignals: string[];
};

export type IndividualDevelopmentOnboardingPlan = {
  summary: string;
  first7Days: IndividualDevelopmentOnboardingPlanStage;
  first30Days: IndividualDevelopmentOnboardingPlanStage;
  days31To60: IndividualDevelopmentOnboardingPlanStage;
  days61To90: IndividualDevelopmentOnboardingPlanStage;
  managerCheckpoints: string[];
  watchouts: string[];
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
  onboardingPlan: IndividualDevelopmentOnboardingPlan;
  managerWatchpoints: IndividualDevelopmentManagerWatchpoint[];
  interpretationLimits: string[];
  metadata: {
    generatedAt: string;
    generatorType?: string;
    generatorVersion?: string;
    inputVersion?: string;
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

function validateOnboardingPlanStage(
  value: unknown,
  path: string,
  errors: string[],
): value is IndividualDevelopmentOnboardingPlanStage {
  if (!isPlainRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return false;
  }

  validateNonEmptyString(value.focus, `${path}.focus`, errors);
  validateStringArray(value.managerActions, `${path}.managerActions`, errors, { minLength: 1 });
  validateStringArray(
    value.feedbackGuidance,
    `${path}.feedbackGuidance`,
    errors,
    { minLength: 1 },
  );
  validateStringArray(value.riskSignals, `${path}.riskSignals`, errors, { minLength: 1 });

  return true;
}

function buildStageFromLegacyItems(
  items: string[],
  fallbackFocus: string,
): IndividualDevelopmentOnboardingPlanStage {
  const normalizedItems = items.filter(isNonEmptyString);
  const focus = normalizedItems[0] ?? fallbackFocus;
  const managerActions = normalizedItems.length > 0 ? normalizedItems : [fallbackFocus];

  return {
    focus,
    managerActions,
    feedbackGuidance: [
      "Tokom ove faze vrijedi koristiti kratak, konkretan feedback i provjeriti da li osoba razumije prioritet, standard i naredni korak.",
    ],
    riskSignals: [
      "Ako se i dalje traži mnogo dodatnog pojašnjenja ili nema jasnog ritma napretka, plan podrške treba dodatno precizirati.",
    ],
  };
}

function buildOnboardingPlanFromLegacy(value: unknown): IndividualDevelopmentOnboardingPlan | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const first30Days = Array.isArray(value.first30Days)
    ? value.first30Days.filter(isNonEmptyString)
    : [];
  const days31To60 = Array.isArray(value.days31To60)
    ? value.days31To60.filter(isNonEmptyString)
    : [];
  const days61To90 = Array.isArray(value.days61To90)
    ? value.days61To90.filter(isNonEmptyString)
    : [];

  if (first30Days.length === 0 || days31To60.length === 0 || days61To90.length === 0) {
    return null;
  }

  return {
    summary:
      "Legacy onboarding plan je normalizovan u 7 / 30 / 60 / 90 format kako bi ostao čitljiv u HR razvojnim pregledima.",
    first7Days: {
      focus: "U prvoj sedmici fokus je na jasnim očekivanjima, ritmu podrške i sigurnom početnom kontekstu.",
      managerActions: [
        "Rano objasniti šta je prioritet, kako izgleda dobar početni rezultat i kada treba tražiti dodatnu podršku.",
      ],
      feedbackGuidance: [
        "Držati feedback kratak, operativan i dovoljno čest da osoba ne ostane sama sa nejasnim očekivanjima.",
      ],
      riskSignals: [
        "Ako osoba i dalje nema jasan osjećaj prioriteta ili standarda rada, onboarding plan treba dodatno precizirati.",
      ],
    },
    first30Days: buildStageFromLegacyItems(
      first30Days,
      "U prvih 30 dana treba postaviti pregledan okvir saradnje i razvojne podrške.",
    ),
    days31To60: buildStageFromLegacyItems(
      days31To60,
      "Između 31. i 60. dana fokus je na provjeri autonomije, saradnje i održivog ritma rada.",
    ),
    days61To90: buildStageFromLegacyItems(
      days61To90,
      "Između 61. i 90. dana fokus je na učvršćivanju vlasništva nad ulogom i razvojnim prioritetima.",
    ),
    managerCheckpoints: [
      "Provjeriti da li su očekivanja, način saradnje i feedback ritam ostali dovoljno jasni kroz cijeli onboarding period.",
    ],
    watchouts: [
      "Legacy plan ne sadrži punu 7 / 30 / 60 / 90 strukturu, pa ove stavke treba čitati kao operacionalizovan minimum, ne kao bogatiji onboarding model.",
    ],
  };
}

export function validateIndividualDevelopmentProfileSnapshot(
  value: unknown,
): IndividualDevelopmentProfileValidationResult {
  const errors: string[] = [];

  if (!isPlainRecord(value)) {
    return { ok: false, errors: ["<root>: Expected object."] };
  }

  const normalizedValue = { ...value } as Record<string, any>;

  if (!("onboardingPlan" in normalizedValue) || !isPlainRecord(normalizedValue.onboardingPlan)) {
    const legacyOnboardingPlan = buildOnboardingPlanFromLegacy(
      normalizedValue.onboardingAndDevelopmentPlan,
    );

    if (legacyOnboardingPlan) {
      normalizedValue.onboardingPlan = legacyOnboardingPlan;
    }
  }

  if (normalizedValue.reportType !== INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE) {
    errors.push(`reportType: Expected ${INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE}.`);
  }

  if (normalizedValue.reportVersion !== INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION) {
    errors.push(`reportVersion: Expected ${INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION}.`);
  }

  if (normalizedValue.audience !== INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE) {
    errors.push(`audience: Expected ${INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE}.`);
  }

  validateNonEmptyString(normalizedValue.locale, "locale", errors);

  if (!isPlainRecord(normalizedValue.developmentSummary)) {
    errors.push("developmentSummary: Expected object.");
  } else {
    validateNonEmptyString(normalizedValue.developmentSummary.headline, "developmentSummary.headline", errors);
    validateNonEmptyString(
      normalizedValue.developmentSummary.overallPattern,
      "developmentSummary.overallPattern",
      errors,
    );
    validateStringArray(
      normalizedValue.developmentSummary.strongestContributionSignals,
      "developmentSummary.strongestContributionSignals",
      errors,
      { minLength: 1 },
    );
    validateNonEmptyString(
      normalizedValue.developmentSummary.mainSupportNeed,
      "developmentSummary.mainSupportNeed",
      errors,
    );
    validateNonEmptyString(normalizedValue.developmentSummary.usageNote, "developmentSummary.usageNote", errors);
  }

  if (!isPlainRecord(normalizedValue.contributionPattern)) {
    errors.push("contributionPattern: Expected object.");
  } else {
    validateStringArray(normalizedValue.contributionPattern.bestConditions, "contributionPattern.bestConditions", errors, {
      minLength: 1,
    });
    validateStringArray(
      normalizedValue.contributionPattern.collaborationConditions,
      "contributionPattern.collaborationConditions",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      normalizedValue.contributionPattern.supportPreferences,
      "contributionPattern.supportPreferences",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      normalizedValue.contributionPattern.roleShapingImplications,
      "contributionPattern.roleShapingImplications",
      errors,
      { minLength: 1 },
    );
  }

  validateDevelopmentRisks(normalizedValue.developmentRisks, "developmentRisks", errors);

  if (!isPlainRecord(normalizedValue.communicationAndFeedbackGuidance)) {
    errors.push("communicationAndFeedbackGuidance: Expected object.");
  } else {
    validateStringArray(
      normalizedValue.communicationAndFeedbackGuidance.whatHelps,
      "communicationAndFeedbackGuidance.whatHelps",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      normalizedValue.communicationAndFeedbackGuidance.whatToAvoid,
      "communicationAndFeedbackGuidance.whatToAvoid",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      normalizedValue.communicationAndFeedbackGuidance.howToPhraseFeedback,
      "communicationAndFeedbackGuidance.howToPhraseFeedback",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      normalizedValue.communicationAndFeedbackGuidance.whatToClarify,
      "communicationAndFeedbackGuidance.whatToClarify",
      errors,
      { minLength: 1 },
    );
  }

  if (!isPlainRecord(normalizedValue.motivationAndEnergyGuidance)) {
    errors.push("motivationAndEnergyGuidance: Expected object.");
  } else {
    validateStringArray(
      normalizedValue.motivationAndEnergyGuidance.likelySourcesOfEnergy,
      "motivationAndEnergyGuidance.likelySourcesOfEnergy",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      normalizedValue.motivationAndEnergyGuidance.likelySourcesOfDrain,
      "motivationAndEnergyGuidance.likelySourcesOfDrain",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      normalizedValue.motivationAndEnergyGuidance.supportSignals,
      "motivationAndEnergyGuidance.supportSignals",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      normalizedValue.motivationAndEnergyGuidance.whatToValidate,
      "motivationAndEnergyGuidance.whatToValidate",
      errors,
      { minLength: 1 },
    );
  }

  validateOneOnOneGuidance(normalizedValue.oneOnOneGuidance, "oneOnOneGuidance", errors);

  if (!isPlainRecord(normalizedValue.onboardingPlan)) {
    errors.push("onboardingPlan: Expected object.");
  } else {
    validateNonEmptyString(normalizedValue.onboardingPlan.summary, "onboardingPlan.summary", errors);
    validateOnboardingPlanStage(normalizedValue.onboardingPlan.first7Days, "onboardingPlan.first7Days", errors);
    validateOnboardingPlanStage(normalizedValue.onboardingPlan.first30Days, "onboardingPlan.first30Days", errors);
    validateOnboardingPlanStage(normalizedValue.onboardingPlan.days31To60, "onboardingPlan.days31To60", errors);
    validateOnboardingPlanStage(normalizedValue.onboardingPlan.days61To90, "onboardingPlan.days61To90", errors);
    validateStringArray(
      normalizedValue.onboardingPlan.managerCheckpoints,
      "onboardingPlan.managerCheckpoints",
      errors,
      { minLength: 1 },
    );
    validateStringArray(normalizedValue.onboardingPlan.watchouts, "onboardingPlan.watchouts", errors, {
      minLength: 1,
    });
  }

  validateManagerWatchpoints(normalizedValue.managerWatchpoints, "managerWatchpoints", errors);
  validateStringArray(normalizedValue.interpretationLimits, "interpretationLimits", errors, { minLength: 1 });

  if (!isPlainRecord(normalizedValue.metadata)) {
    errors.push("metadata: Expected object.");
  } else {
    validateNonEmptyString(normalizedValue.metadata.generatedAt, "metadata.generatedAt", errors);
  }

  hasForbiddenKeyDeep(normalizedValue, "", errors);
  errors.push(...findForbiddenWording(normalizedValue));

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: normalizedValue as IndividualDevelopmentProfileSnapshot };
}
