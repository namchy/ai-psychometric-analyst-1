export const TEAM_FIT_REPORT_TYPE = "team_fit_report_v1" as const;
export const TEAM_FIT_REPORT_VERSION = "v1" as const;
export const TEAM_FIT_RELATIONSHIP_PATTERNS = [
  "alignment_signal",
  "complementarity_signal",
  "mixed_signal",
  "needs_validation",
] as const;

export type TeamFitRelationshipPattern =
  (typeof TEAM_FIT_RELATIONSHIP_PATTERNS)[number];

export type TeamFitReportPatternSummary = {
  title: string;
  summary: string;
};

export type TeamFitReportCandidateSignal = {
  title: string;
  summary: string;
  relevanceToFit: string;
};

export type TeamFitReportComplementaritySignal = {
  title: string;
  summary: string;
  practicalValue: string;
};

export type TeamFitReportFrictionRisk = {
  title: string;
  summary: string;
  whyItMayMatter: string;
  mitigationFocus: string;
};

export type TeamFitReportInterviewArea = {
  title: string;
  rationale: string;
  prompts: string[];
};

export type TeamFitReportV1 = {
  reportType: typeof TEAM_FIT_REPORT_TYPE;
  reportVersion: typeof TEAM_FIT_REPORT_VERSION;
  locale: string;
  generatedAt: string;
  inputSnapshotVersion: string;
  teamFitReportVersion: typeof TEAM_FIT_REPORT_VERSION;
  audience: "hr_internal";
  sourceType: "candidate_team_relational";
  teamContext: {
    organizationId: string;
    teamId: string;
    teamName?: string | null;
    teamAssessmentAssignmentId?: string | null;
    teamDynamicsAggregationSnapshotId?: string | null;
    teamDynamicsReportId?: string | null;
  };
  candidateContext: {
    organizationId: string;
    participantId: string;
    assessmentAssignmentId?: string | null;
    compositeInputSnapshotId?: string | null;
    compositeReportId?: string | null;
    displayName?: string | null;
  };
  source: {
    candidateCompositeInputVersion: string;
    candidateSourceReportIds: string[];
    candidateSourceTestSlugs: string[];
    teamInputVersion: string;
    teamSourceReportIds: string[];
    teamSourceSnapshotIds: string[];
    optionalContextKeys: string[];
  };
  fitOverview: {
    relationshipPattern: TeamFitRelationshipPattern;
    headline: string;
    summary: string;
  };
  teamContextSummary: {
    relevantTeamPatterns: TeamFitReportPatternSummary[];
  };
  candidateSignals: TeamFitReportCandidateSignal[];
  complementaritySignals: TeamFitReportComplementaritySignal[];
  frictionRisks: TeamFitReportFrictionRisk[];
  interviewFocus: {
    areas: TeamFitReportInterviewArea[];
  };
  onboardingGuidance: {
    priorities: string[];
    supportNeeds: string[];
  };
  managerGuidance: {
    workingStyleGuidance: string[];
    communicationGuidance: string[];
  };
  watchouts: string[];
  interpretationLimits: string[];
  metadata: {
    provider?: string;
    providerVersion?: string;
    generatedAt: string;
  };
};

export type TeamFitReportValidationResult =
  | { ok: true; snapshot: TeamFitReportV1 }
  | { ok: false; errors: string[] };

const FORBIDDEN_KEY_PATTERNS = [
  /(^|\.)(fitScore|hireScore)$/i,
  /(^|\.)(hireRecommendation|hiringRecommendation|rejectRecommendation|decisionRecommendation)$/i,
  /(^|\.)(rawAnswers|rawResponses|teamMemberAnswers|individualResponses)$/i,
  /(^|\.)(teamMemberScores|individualScores|memberScoreDetails)$/i,
  /(^|\.)(memberReports|individualNarrativeReports)$/i,
  /(^|\.)(candidateVisible)$/i,
];

const FORBIDDEN_TEXT_PATTERNS = [
  /\bno-hire\b/i,
  /\breject\b/i,
  /\bbad fit\b/i,
  /\bpoor fit\b/i,
  /\bdoes not fit\b/i,
  /\bculture fit\b/i,
  /\bcultural fit\b/i,
  /\bperformance will\b/i,
  /\bwill perform\b/i,
  /\bcaused by\b/i,
  /\bdiagnosis\b/i,
  /\bclinical\b/i,
  /\bhire\b/i,
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
): value is string[] {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  value.forEach((entry, index) => {
    validateNonEmptyString(entry, `${path}[${index}]`, errors);
  });

  return true;
}

function containsUndefinedDeep(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => containsUndefinedDeep(entry));
  }

  if (isPlainRecord(value)) {
    return Object.values(value).some((entry) => containsUndefinedDeep(entry));
  }

  return false;
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
      if (/candidateVisible$/i.test(nextPath) && nestedValue !== true) {
        // Candidate visibility is only forbidden when explicitly enabled.
      } else {
        errors.push(`${nextPath}: Forbidden field in Team Fit report snapshot.`);
      }
    }

    hasForbiddenKeyDeep(nestedValue, nextPath, errors);
  }

  return errors;
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

function findForbiddenWording(value: unknown): string[] {
  const hits: string[] = [];

  collectStringLeaves(value).forEach((entry) => {
    FORBIDDEN_TEXT_PATTERNS.forEach((pattern) => {
      if (pattern.test(entry)) {
        hits.push(`forbiddenText: Found forbidden phrase matching ${pattern}.`);
      }
    });
  });

  return hits;
}

function validatePatternSummaryArray(value: unknown, path: string, errors: string[]): boolean {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  value.forEach((entry, index) => {
    if (!isPlainRecord(entry)) {
      errors.push(`${path}[${index}]: Expected object.`);
      return;
    }

    validateNonEmptyString(entry.title, `${path}[${index}].title`, errors);
    validateNonEmptyString(entry.summary, `${path}[${index}].summary`, errors);
  });

  return true;
}

function validateCandidateSignals(value: unknown, path: string, errors: string[]): boolean {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  value.forEach((entry, index) => {
    if (!isPlainRecord(entry)) {
      errors.push(`${path}[${index}]: Expected object.`);
      return;
    }

    validateNonEmptyString(entry.title, `${path}[${index}].title`, errors);
    validateNonEmptyString(entry.summary, `${path}[${index}].summary`, errors);
    validateNonEmptyString(entry.relevanceToFit, `${path}[${index}].relevanceToFit`, errors);
  });

  return true;
}

function validateComplementaritySignals(value: unknown, path: string, errors: string[]): boolean {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  value.forEach((entry, index) => {
    if (!isPlainRecord(entry)) {
      errors.push(`${path}[${index}]: Expected object.`);
      return;
    }

    validateNonEmptyString(entry.title, `${path}[${index}].title`, errors);
    validateNonEmptyString(entry.summary, `${path}[${index}].summary`, errors);
    validateNonEmptyString(entry.practicalValue, `${path}[${index}].practicalValue`, errors);
  });

  return true;
}

function validateFrictionRisks(value: unknown, path: string, errors: string[]): boolean {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  value.forEach((entry, index) => {
    if (!isPlainRecord(entry)) {
      errors.push(`${path}[${index}]: Expected object.`);
      return;
    }

    validateNonEmptyString(entry.title, `${path}[${index}].title`, errors);
    validateNonEmptyString(entry.summary, `${path}[${index}].summary`, errors);
    validateNonEmptyString(entry.whyItMayMatter, `${path}[${index}].whyItMayMatter`, errors);
    validateNonEmptyString(entry.mitigationFocus, `${path}[${index}].mitigationFocus`, errors);
  });

  return true;
}

function validateInterviewFocus(value: unknown, path: string, errors: string[]): boolean {
  if (!isPlainRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return false;
  }

  if (!Array.isArray(value.areas)) {
    errors.push(`${path}.areas: Expected array.`);
    return false;
  }

  value.areas.forEach((entry, index) => {
    if (!isPlainRecord(entry)) {
      errors.push(`${path}.areas[${index}]: Expected object.`);
      return;
    }

    validateNonEmptyString(entry.title, `${path}.areas[${index}].title`, errors);
    validateNonEmptyString(entry.rationale, `${path}.areas[${index}].rationale`, errors);
    validateStringArray(entry.prompts, `${path}.areas[${index}].prompts`, errors);
  });

  return true;
}

function validateOnboardingGuidance(value: unknown, path: string, errors: string[]): boolean {
  if (!isPlainRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return false;
  }

  validateStringArray(value.priorities, `${path}.priorities`, errors);
  validateStringArray(value.supportNeeds, `${path}.supportNeeds`, errors);
  return true;
}

function validateManagerGuidance(value: unknown, path: string, errors: string[]): boolean {
  if (!isPlainRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return false;
  }

  validateStringArray(value.workingStyleGuidance, `${path}.workingStyleGuidance`, errors);
  validateStringArray(value.communicationGuidance, `${path}.communicationGuidance`, errors);
  return true;
}

export function validateTeamFitReportSnapshot(
  snapshot: unknown,
): TeamFitReportValidationResult {
  const errors: string[] = [];

  if (!isPlainRecord(snapshot)) {
    return { ok: false, errors: ["<root>: Expected object."] };
  }

  if (containsUndefinedDeep(snapshot)) {
    errors.push("<root>: Snapshot contains undefined values and is not JSON-safe.");
  }

  errors.push(...hasForbiddenKeyDeep(snapshot));
  errors.push(...findForbiddenWording(snapshot));

  if (snapshot.reportType !== TEAM_FIT_REPORT_TYPE) {
    errors.push(`reportType: Expected ${TEAM_FIT_REPORT_TYPE}.`);
  }

  if (snapshot.reportVersion !== TEAM_FIT_REPORT_VERSION) {
    errors.push(`reportVersion: Expected ${TEAM_FIT_REPORT_VERSION}.`);
  }

  if (snapshot.audience !== "hr_internal") {
    errors.push("audience: Expected hr_internal.");
  }

  if (snapshot.sourceType !== "candidate_team_relational") {
    errors.push("sourceType: Expected candidate_team_relational.");
  }

  validateNonEmptyString(snapshot.locale, "locale", errors);
  validateNonEmptyString(snapshot.generatedAt, "generatedAt", errors);
  validateNonEmptyString(snapshot.inputSnapshotVersion, "inputSnapshotVersion", errors);

  if (snapshot.teamFitReportVersion !== TEAM_FIT_REPORT_VERSION) {
    errors.push(`teamFitReportVersion: Expected ${TEAM_FIT_REPORT_VERSION}.`);
  }

  if (!isPlainRecord(snapshot.teamContext)) {
    errors.push("teamContext: Expected object.");
  } else {
    validateNonEmptyString(snapshot.teamContext.organizationId, "teamContext.organizationId", errors);
    validateNonEmptyString(snapshot.teamContext.teamId, "teamContext.teamId", errors);
    if (snapshot.teamContext.teamName != null) {
      validateNonEmptyString(snapshot.teamContext.teamName, "teamContext.teamName", errors);
    }
  }

  if (!isPlainRecord(snapshot.candidateContext)) {
    errors.push("candidateContext: Expected object.");
  } else {
    validateNonEmptyString(
      snapshot.candidateContext.organizationId,
      "candidateContext.organizationId",
      errors,
    );
    validateNonEmptyString(snapshot.candidateContext.participantId, "candidateContext.participantId", errors);
    if (snapshot.candidateContext.displayName != null) {
      validateNonEmptyString(snapshot.candidateContext.displayName, "candidateContext.displayName", errors);
    }
  }

  if (!isPlainRecord(snapshot.source)) {
    errors.push("source: Expected object.");
  } else {
    validateNonEmptyString(
      snapshot.source.candidateCompositeInputVersion,
      "source.candidateCompositeInputVersion",
      errors,
    );
    validateStringArray(snapshot.source.candidateSourceReportIds, "source.candidateSourceReportIds", errors);
    validateStringArray(snapshot.source.candidateSourceTestSlugs, "source.candidateSourceTestSlugs", errors);
    validateNonEmptyString(snapshot.source.teamInputVersion, "source.teamInputVersion", errors);
    validateStringArray(snapshot.source.teamSourceReportIds, "source.teamSourceReportIds", errors);
    validateStringArray(snapshot.source.teamSourceSnapshotIds, "source.teamSourceSnapshotIds", errors);
    validateStringArray(snapshot.source.optionalContextKeys, "source.optionalContextKeys", errors);
  }

  if (!isPlainRecord(snapshot.fitOverview)) {
    errors.push("fitOverview: Expected object.");
  } else {
    if (!TEAM_FIT_RELATIONSHIP_PATTERNS.includes(snapshot.fitOverview.relationshipPattern as TeamFitRelationshipPattern)) {
      errors.push("fitOverview.relationshipPattern: Expected allowed relationship pattern.");
    }

    validateNonEmptyString(snapshot.fitOverview.headline, "fitOverview.headline", errors);
    validateNonEmptyString(snapshot.fitOverview.summary, "fitOverview.summary", errors);
  }

  if (!isPlainRecord(snapshot.teamContextSummary)) {
    errors.push("teamContextSummary: Expected object.");
  } else {
    validatePatternSummaryArray(
      snapshot.teamContextSummary.relevantTeamPatterns,
      "teamContextSummary.relevantTeamPatterns",
      errors,
    );
  }

  validateCandidateSignals(snapshot.candidateSignals, "candidateSignals", errors);
  validateComplementaritySignals(snapshot.complementaritySignals, "complementaritySignals", errors);
  validateFrictionRisks(snapshot.frictionRisks, "frictionRisks", errors);
  validateInterviewFocus(snapshot.interviewFocus, "interviewFocus", errors);
  validateOnboardingGuidance(snapshot.onboardingGuidance, "onboardingGuidance", errors);
  validateManagerGuidance(snapshot.managerGuidance, "managerGuidance", errors);
  validateStringArray(snapshot.watchouts, "watchouts", errors);
  validateStringArray(snapshot.interpretationLimits, "interpretationLimits", errors);

  if (!isPlainRecord(snapshot.metadata)) {
    errors.push("metadata: Expected object.");
  } else {
    validateNonEmptyString(snapshot.metadata.generatedAt, "metadata.generatedAt", errors);
    if (snapshot.metadata.provider != null) {
      validateNonEmptyString(snapshot.metadata.provider, "metadata.provider", errors);
    }
    if (snapshot.metadata.providerVersion != null) {
      validateNonEmptyString(snapshot.metadata.providerVersion, "metadata.providerVersion", errors);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, snapshot: snapshot as TeamFitReportV1 };
}
