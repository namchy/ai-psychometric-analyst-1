import type { ReportLocale } from "@/lib/assessment/locale";

export const COMPOSITE_HR_REPORT_CONTRACT_VERSION = "composite_hr_v1" as const;
export const COMPOSITE_HR_REPORT_TYPE = "composite" as const;
export const COMPOSITE_HR_REPORT_AUDIENCE = "hr" as const;
export const COMPOSITE_HR_REPORT_SOURCE_TYPE = "assessment" as const;

export type CompositeHrReportEvidence = {
  testSlug: string;
  label: string;
  value: string;
};

export type CompositeHrIntegratedSignal = {
  id: string;
  title: string;
  body: string;
  evidence: CompositeHrReportEvidence[];
};

export type CompositeHrInterviewFocusArea = {
  title: string;
  rationale: string;
  questions: string[];
};

export type CompositeHrReportSnapshot = {
  contractVersion: typeof COMPOSITE_HR_REPORT_CONTRACT_VERSION;
  reportType: typeof COMPOSITE_HR_REPORT_TYPE;
  audience: typeof COMPOSITE_HR_REPORT_AUDIENCE;
  sourceType: typeof COMPOSITE_HR_REPORT_SOURCE_TYPE;
  locale: ReportLocale;
  generatedFor: {
    organizationId: string;
    participantId: string;
    assessmentAssignmentId: string;
  };
  source: {
    inputContractVersion: string;
    sourceAttemptIds: string[];
    testSlugs: string[];
  };
  summary: {
    headline: string;
    profileOverview: string;
    keyStrengths: string[];
    watchouts: string[];
  };
  integratedSignals: CompositeHrIntegratedSignal[];
  interviewGuidance: {
    focusAreas: CompositeHrInterviewFocusArea[];
  };
  onboardingGuidance: {
    managementTips: string[];
    supportNeeds: string[];
  };
  limitations: string[];
  metadata: {
    provider: string;
    providerVersion: string;
    generatedAt: string;
  };
};

type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validateNonEmptyString(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${path}: Expected non-empty string.`);
  }
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

function validateEvidenceArray(
  value: unknown,
  path: string,
  errors: string[],
): value is CompositeHrReportEvidence[] {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`${path}[${index}]: Expected object.`);
      return;
    }

    validateNonEmptyString(entry.testSlug, `${path}[${index}].testSlug`, errors);
    validateNonEmptyString(entry.label, `${path}[${index}].label`, errors);
    validateNonEmptyString(entry.value, `${path}[${index}].value`, errors);
  });

  return true;
}

function validateIntegratedSignals(
  value: unknown,
  path: string,
  errors: string[],
): value is CompositeHrIntegratedSignal[] {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`${path}[${index}]: Expected object.`);
      return;
    }

    validateNonEmptyString(entry.id, `${path}[${index}].id`, errors);
    validateNonEmptyString(entry.title, `${path}[${index}].title`, errors);
    validateNonEmptyString(entry.body, `${path}[${index}].body`, errors);
    validateEvidenceArray(entry.evidence, `${path}[${index}].evidence`, errors);
  });

  return true;
}

function validateFocusAreas(
  value: unknown,
  path: string,
  errors: string[],
): value is CompositeHrInterviewFocusArea[] {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`${path}[${index}]: Expected object.`);
      return;
    }

    validateNonEmptyString(entry.title, `${path}[${index}].title`, errors);
    validateNonEmptyString(entry.rationale, `${path}[${index}].rationale`, errors);
    validateStringArray(entry.questions, `${path}[${index}].questions`, errors, { minLength: 1 });
  });

  return true;
}

export function validateCompositeHrReportSnapshot(
  value: unknown,
): ValidationResult<CompositeHrReportSnapshot> {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["<root>: Expected object."] };
  }

  if (value.contractVersion !== COMPOSITE_HR_REPORT_CONTRACT_VERSION) {
    errors.push(`contractVersion: Expected ${COMPOSITE_HR_REPORT_CONTRACT_VERSION}.`);
  }

  if (value.reportType !== COMPOSITE_HR_REPORT_TYPE) {
    errors.push(`reportType: Expected ${COMPOSITE_HR_REPORT_TYPE}.`);
  }

  if (value.audience !== COMPOSITE_HR_REPORT_AUDIENCE) {
    errors.push(`audience: Expected ${COMPOSITE_HR_REPORT_AUDIENCE}.`);
  }

  if (value.sourceType !== COMPOSITE_HR_REPORT_SOURCE_TYPE) {
    errors.push(`sourceType: Expected ${COMPOSITE_HR_REPORT_SOURCE_TYPE}.`);
  }

  validateNonEmptyString(value.locale, "locale", errors);

  if (!isRecord(value.generatedFor)) {
    errors.push("generatedFor: Expected object.");
  } else {
    validateNonEmptyString(value.generatedFor.organizationId, "generatedFor.organizationId", errors);
    validateNonEmptyString(value.generatedFor.participantId, "generatedFor.participantId", errors);
    validateNonEmptyString(
      value.generatedFor.assessmentAssignmentId,
      "generatedFor.assessmentAssignmentId",
      errors,
    );
  }

  if (!isRecord(value.source)) {
    errors.push("source: Expected object.");
  } else {
    validateNonEmptyString(value.source.inputContractVersion, "source.inputContractVersion", errors);
    validateStringArray(value.source.sourceAttemptIds, "source.sourceAttemptIds", errors, {
      minLength: 1,
    });
    validateStringArray(value.source.testSlugs, "source.testSlugs", errors, {
      minLength: 1,
    });
  }

  if (!isRecord(value.summary)) {
    errors.push("summary: Expected object.");
  } else {
    validateNonEmptyString(value.summary.headline, "summary.headline", errors);
    validateNonEmptyString(value.summary.profileOverview, "summary.profileOverview", errors);
    validateStringArray(value.summary.keyStrengths, "summary.keyStrengths", errors);
    validateStringArray(value.summary.watchouts, "summary.watchouts", errors);
  }

  validateIntegratedSignals(value.integratedSignals, "integratedSignals", errors);

  if (!isRecord(value.interviewGuidance)) {
    errors.push("interviewGuidance: Expected object.");
  } else {
    validateFocusAreas(value.interviewGuidance.focusAreas, "interviewGuidance.focusAreas", errors);
  }

  if (!isRecord(value.onboardingGuidance)) {
    errors.push("onboardingGuidance: Expected object.");
  } else {
    validateStringArray(
      value.onboardingGuidance.managementTips,
      "onboardingGuidance.managementTips",
      errors,
    );
    validateStringArray(
      value.onboardingGuidance.supportNeeds,
      "onboardingGuidance.supportNeeds",
      errors,
    );
  }

  validateStringArray(value.limitations, "limitations", errors);

  if (!isRecord(value.metadata)) {
    errors.push("metadata: Expected object.");
  } else {
    validateNonEmptyString(value.metadata.provider, "metadata.provider", errors);
    validateNonEmptyString(value.metadata.providerVersion, "metadata.providerVersion", errors);
    validateNonEmptyString(value.metadata.generatedAt, "metadata.generatedAt", errors);
  }

  return errors.length === 0
    ? { ok: true, value: value as CompositeHrReportSnapshot }
    : { ok: false, errors };
}

export function formatCompositeHrReportValidationErrors(errors: string[]): string {
  return errors.join(" | ");
}
