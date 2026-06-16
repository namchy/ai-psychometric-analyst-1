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

export const TEAM_FIT_REPORT_CONTRACT_VERSION = "team_fit_report_v1" as const;
export const TEAM_FIT_REPORT_CONTRACT_REPORT_TYPE = "team_fit" as const;
export const TEAM_FIT_REPORT_CONTRACT_AUDIENCE = "hr" as const;
export const TEAM_FIT_REPORT_EVIDENCE_SOURCE_TYPES = [
  "candidate_deep_profile_signal",
  "team_style_collaboration_signal",
  "team_dynamics_aggregation_signal",
  "team_dynamics_executive_overview_signal",
  "hr_admin_optional_context",
  "interpretive_link",
] as const;

export type TeamFitReportEvidenceSourceType =
  (typeof TEAM_FIT_REPORT_EVIDENCE_SOURCE_TYPES)[number];

export type TeamFitReportEvidenceReference = {
  id: string;
  sourceType: TeamFitReportEvidenceSourceType;
  sourceLabel: string;
  signalLabel: string;
  summary: string;
  relationToClaim: string;
  snapshotId?: string | null;
  version?: string | null;
};

export type TeamFitEvidenceLinkedSection = {
  headline: string;
  summary: string;
  evidence: TeamFitReportEvidenceReference[];
};

export type TeamFitEvidenceLinkedItem = {
  title: string;
  signal: string;
  interpretation: string;
  recommendation?: string;
  evidence: TeamFitReportEvidenceReference[];
};

export type TeamFitInterviewProbe = {
  question: string;
  rationale: string;
  whatToListenFor: string[];
  evidence: TeamFitReportEvidenceReference[];
};

export type TeamFitRiskMitigationItem = {
  risk: string;
  trigger: string;
  mitigation: string;
  owner: "hr" | "manager" | "team_lead";
  evidence: TeamFitReportEvidenceReference[];
};

export type TeamFitReportV1ContractSnapshot = {
  contractVersion: typeof TEAM_FIT_REPORT_CONTRACT_VERSION;
  reportType: typeof TEAM_FIT_REPORT_CONTRACT_REPORT_TYPE;
  audience: typeof TEAM_FIT_REPORT_CONTRACT_AUDIENCE;
  sourceType: "candidate_team_relational";
  locale: string;
  generatedFor: {
    organizationId: string;
    teamId: string;
    participantId: string;
    teamName?: string | null;
    candidateDisplayName?: string | null;
  };
  source: {
    candidateDeepProfileSignals: TeamFitReportEvidenceReference[];
    teamStyleCollaborationSignals: TeamFitReportEvidenceReference[];
    teamDynamicsAggregationSignals: TeamFitReportEvidenceReference[];
    teamDynamicsExecutiveOverviewSignals: TeamFitReportEvidenceReference[];
    hrAdminOptionalContextSignals: TeamFitReportEvidenceReference[];
    interpretiveLinks: TeamFitReportEvidenceReference[];
  };
  summary: TeamFitEvidenceLinkedSection;
  fitOverview: TeamFitEvidenceLinkedSection & {
    relationshipPattern: TeamFitRelationshipPattern;
  };
  likelyTeamContribution: {
    items: TeamFitEvidenceLinkedItem[];
  };
  possibleFrictionPoints: {
    items: TeamFitEvidenceLinkedItem[];
  };
  teamConditionsThatImproveFit: {
    items: TeamFitEvidenceLinkedItem[];
  };
  interviewProbes: {
    items: TeamFitInterviewProbe[];
  };
  onboardingAndManagerGuidance: {
    items: TeamFitEvidenceLinkedItem[];
  };
  riskAndMitigationMap: {
    items: TeamFitRiskMitigationItem[];
  };
  evidenceAppendix: {
    entries: TeamFitReportEvidenceReference[];
  };
  interpretationLimits: {
    limits: string[];
    evidence: TeamFitReportEvidenceReference[];
  };
  metadata: {
    generatedAt: string;
    schemaVersion: string;
    provider?: string;
    providerVersion?: string;
  };
};

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

export type TeamFitReportV1ContractValidationResult =
  | { ok: true; snapshot: TeamFitReportV1ContractSnapshot }
  | { ok: false; errors: string[] };

const FORBIDDEN_KEY_PATTERNS = [
  /(^|\.)(fitScore|hireScore)$/i,
  /(^|\.)(numericScore|fitPercentage|fitPercent|percentageFit)$/i,
  /(^|\.)(decision|hireDecision|hiringDecision|hireRecommendation|hiringRecommendation|rejectRecommendation|decisionRecommendation|passFail)$/i,
  /(^|\.)(rank|ranking|candidateRank)$/i,
  /(^|\.)(rawAnswers|rawResponses|teamMemberAnswers|individualResponses)$/i,
  /(^|\.)(teamMemberScores|individualScores|memberScoreDetails)$/i,
  /(^|\.)(teamMemberNames|namedTeamMembers|individualTeamMembers)$/i,
  /(^|\.)(memberReports|individualNarrativeReports)$/i,
  /(^|\.)(candidateVisible)$/i,
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

function validateEvidenceReference(
  value: unknown,
  path: string,
  errors: string[],
): value is TeamFitReportEvidenceReference {
  if (!isPlainRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return false;
  }

  validateNonEmptyString(value.id, `${path}.id`, errors);

  if (!TEAM_FIT_REPORT_EVIDENCE_SOURCE_TYPES.includes(value.sourceType as TeamFitReportEvidenceSourceType)) {
    errors.push(`${path}.sourceType: Expected allowed evidence source type.`);
  }

  validateNonEmptyString(value.sourceLabel, `${path}.sourceLabel`, errors);
  validateNonEmptyString(value.signalLabel, `${path}.signalLabel`, errors);
  validateNonEmptyString(value.summary, `${path}.summary`, errors);
  validateNonEmptyString(value.relationToClaim, `${path}.relationToClaim`, errors);

  if (value.snapshotId != null) {
    validateNonEmptyString(value.snapshotId, `${path}.snapshotId`, errors);
  }

  if (value.version != null) {
    validateNonEmptyString(value.version, `${path}.version`, errors);
  }

  return true;
}

function validateEvidenceReferences(
  value: unknown,
  path: string,
  errors: string[],
  options: { requireNonEmpty: boolean },
): value is TeamFitReportEvidenceReference[] {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  if (options.requireNonEmpty && value.length === 0) {
    errors.push(`${path}: Expected at least one evidence reference.`);
  }

  value.forEach((entry, index) => {
    validateEvidenceReference(entry, `${path}[${index}]`, errors);
  });

  return true;
}

function validateEvidenceLinkedSection(
  value: unknown,
  path: string,
  errors: string[],
): value is TeamFitEvidenceLinkedSection {
  if (!isPlainRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return false;
  }

  validateNonEmptyString(value.headline, `${path}.headline`, errors);
  validateNonEmptyString(value.summary, `${path}.summary`, errors);
  validateEvidenceReferences(value.evidence, `${path}.evidence`, errors, {
    requireNonEmpty: true,
  });

  return true;
}

function validateEvidenceLinkedItems(
  value: unknown,
  path: string,
  errors: string[],
): value is TeamFitEvidenceLinkedItem[] {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  if (value.length === 0) {
    errors.push(`${path}: Expected at least one item.`);
  }

  value.forEach((entry, index) => {
    if (!isPlainRecord(entry)) {
      errors.push(`${path}[${index}]: Expected object.`);
      return;
    }

    validateNonEmptyString(entry.title, `${path}[${index}].title`, errors);
    validateNonEmptyString(entry.signal, `${path}[${index}].signal`, errors);
    validateNonEmptyString(entry.interpretation, `${path}[${index}].interpretation`, errors);

    if (entry.recommendation != null) {
      validateNonEmptyString(entry.recommendation, `${path}[${index}].recommendation`, errors);
    }

    validateEvidenceReferences(entry.evidence, `${path}[${index}].evidence`, errors, {
      requireNonEmpty: true,
    });
  });

  return true;
}

function validateInterviewProbes(value: unknown, path: string, errors: string[]): boolean {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  if (value.length === 0) {
    errors.push(`${path}: Expected at least one item.`);
  }

  value.forEach((entry, index) => {
    if (!isPlainRecord(entry)) {
      errors.push(`${path}[${index}]: Expected object.`);
      return;
    }

    validateNonEmptyString(entry.question, `${path}[${index}].question`, errors);
    validateNonEmptyString(entry.rationale, `${path}[${index}].rationale`, errors);
    validateStringArray(entry.whatToListenFor, `${path}[${index}].whatToListenFor`, errors);
    validateEvidenceReferences(entry.evidence, `${path}[${index}].evidence`, errors, {
      requireNonEmpty: true,
    });
  });

  return true;
}

function validateRiskAndMitigationItems(value: unknown, path: string, errors: string[]): boolean {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  if (value.length === 0) {
    errors.push(`${path}: Expected at least one item.`);
  }

  value.forEach((entry, index) => {
    if (!isPlainRecord(entry)) {
      errors.push(`${path}[${index}]: Expected object.`);
      return;
    }

    validateNonEmptyString(entry.risk, `${path}[${index}].risk`, errors);
    validateNonEmptyString(entry.trigger, `${path}[${index}].trigger`, errors);
    validateNonEmptyString(entry.mitigation, `${path}[${index}].mitigation`, errors);

    if (!["hr", "manager", "team_lead"].includes(String(entry.owner))) {
      errors.push(`${path}[${index}].owner: Expected hr, manager, or team_lead.`);
    }

    validateEvidenceReferences(entry.evidence, `${path}[${index}].evidence`, errors, {
      requireNonEmpty: true,
    });
  });

  return true;
}

export function validateTeamFitReportV1ContractSnapshot(
  snapshot: unknown,
): TeamFitReportV1ContractValidationResult {
  const errors: string[] = [];

  if (!isPlainRecord(snapshot)) {
    return { ok: false, errors: ["<root>: Expected object."] };
  }

  if (containsUndefinedDeep(snapshot)) {
    errors.push("<root>: Snapshot contains undefined values and is not JSON-safe.");
  }

  errors.push(...hasForbiddenKeyDeep(snapshot));

  if (snapshot.contractVersion !== TEAM_FIT_REPORT_CONTRACT_VERSION) {
    errors.push(`contractVersion: Expected ${TEAM_FIT_REPORT_CONTRACT_VERSION}.`);
  }

  if (snapshot.reportType !== TEAM_FIT_REPORT_CONTRACT_REPORT_TYPE) {
    errors.push(`reportType: Expected ${TEAM_FIT_REPORT_CONTRACT_REPORT_TYPE}.`);
  }

  if (snapshot.audience !== TEAM_FIT_REPORT_CONTRACT_AUDIENCE) {
    errors.push(`audience: Expected ${TEAM_FIT_REPORT_CONTRACT_AUDIENCE}.`);
  }

  if (snapshot.sourceType !== "candidate_team_relational") {
    errors.push("sourceType: Expected candidate_team_relational.");
  }

  validateNonEmptyString(snapshot.locale, "locale", errors);

  if (!isPlainRecord(snapshot.generatedFor)) {
    errors.push("generatedFor: Expected object.");
  } else {
    validateNonEmptyString(snapshot.generatedFor.organizationId, "generatedFor.organizationId", errors);
    validateNonEmptyString(snapshot.generatedFor.teamId, "generatedFor.teamId", errors);
    validateNonEmptyString(snapshot.generatedFor.participantId, "generatedFor.participantId", errors);

    if (snapshot.generatedFor.teamName != null) {
      validateNonEmptyString(snapshot.generatedFor.teamName, "generatedFor.teamName", errors);
    }

    if (snapshot.generatedFor.candidateDisplayName != null) {
      validateNonEmptyString(
        snapshot.generatedFor.candidateDisplayName,
        "generatedFor.candidateDisplayName",
        errors,
      );
    }
  }

  if (!isPlainRecord(snapshot.source)) {
    errors.push("source: Expected object.");
  } else {
    validateEvidenceReferences(
      snapshot.source.candidateDeepProfileSignals,
      "source.candidateDeepProfileSignals",
      errors,
      { requireNonEmpty: true },
    );
    validateEvidenceReferences(
      snapshot.source.teamStyleCollaborationSignals,
      "source.teamStyleCollaborationSignals",
      errors,
      { requireNonEmpty: false },
    );
    validateEvidenceReferences(
      snapshot.source.teamDynamicsAggregationSignals,
      "source.teamDynamicsAggregationSignals",
      errors,
      { requireNonEmpty: true },
    );
    validateEvidenceReferences(
      snapshot.source.teamDynamicsExecutiveOverviewSignals,
      "source.teamDynamicsExecutiveOverviewSignals",
      errors,
      { requireNonEmpty: false },
    );
    validateEvidenceReferences(
      snapshot.source.hrAdminOptionalContextSignals,
      "source.hrAdminOptionalContextSignals",
      errors,
      { requireNonEmpty: false },
    );
    validateEvidenceReferences(snapshot.source.interpretiveLinks, "source.interpretiveLinks", errors, {
      requireNonEmpty: true,
    });
  }

  validateEvidenceLinkedSection(snapshot.summary, "summary", errors);

  if (!isPlainRecord(snapshot.fitOverview)) {
    errors.push("fitOverview: Expected object.");
  } else {
    validateEvidenceLinkedSection(snapshot.fitOverview, "fitOverview", errors);

    if (
      !TEAM_FIT_RELATIONSHIP_PATTERNS.includes(
        snapshot.fitOverview.relationshipPattern as TeamFitRelationshipPattern,
      )
    ) {
      errors.push("fitOverview.relationshipPattern: Expected allowed relationship pattern.");
    }
  }

  if (!isPlainRecord(snapshot.likelyTeamContribution)) {
    errors.push("likelyTeamContribution: Expected object.");
  } else {
    validateEvidenceLinkedItems(snapshot.likelyTeamContribution.items, "likelyTeamContribution.items", errors);
  }

  if (!isPlainRecord(snapshot.possibleFrictionPoints)) {
    errors.push("possibleFrictionPoints: Expected object.");
  } else {
    validateEvidenceLinkedItems(snapshot.possibleFrictionPoints.items, "possibleFrictionPoints.items", errors);
  }

  if (!isPlainRecord(snapshot.teamConditionsThatImproveFit)) {
    errors.push("teamConditionsThatImproveFit: Expected object.");
  } else {
    validateEvidenceLinkedItems(
      snapshot.teamConditionsThatImproveFit.items,
      "teamConditionsThatImproveFit.items",
      errors,
    );
  }

  if (!isPlainRecord(snapshot.interviewProbes)) {
    errors.push("interviewProbes: Expected object.");
  } else {
    validateInterviewProbes(snapshot.interviewProbes.items, "interviewProbes.items", errors);
  }

  if (!isPlainRecord(snapshot.onboardingAndManagerGuidance)) {
    errors.push("onboardingAndManagerGuidance: Expected object.");
  } else {
    validateEvidenceLinkedItems(
      snapshot.onboardingAndManagerGuidance.items,
      "onboardingAndManagerGuidance.items",
      errors,
    );
  }

  if (!isPlainRecord(snapshot.riskAndMitigationMap)) {
    errors.push("riskAndMitigationMap: Expected object.");
  } else {
    validateRiskAndMitigationItems(snapshot.riskAndMitigationMap.items, "riskAndMitigationMap.items", errors);
  }

  if (!isPlainRecord(snapshot.evidenceAppendix)) {
    errors.push("evidenceAppendix: Expected object.");
  } else {
    validateEvidenceReferences(snapshot.evidenceAppendix.entries, "evidenceAppendix.entries", errors, {
      requireNonEmpty: true,
    });
  }

  if (!isPlainRecord(snapshot.interpretationLimits)) {
    errors.push("interpretationLimits: Expected object.");
  } else {
    validateStringArray(snapshot.interpretationLimits.limits, "interpretationLimits.limits", errors);
    validateEvidenceReferences(snapshot.interpretationLimits.evidence, "interpretationLimits.evidence", errors, {
      requireNonEmpty: true,
    });
  }

  if (!isPlainRecord(snapshot.metadata)) {
    errors.push("metadata: Expected object.");
  } else {
    validateNonEmptyString(snapshot.metadata.generatedAt, "metadata.generatedAt", errors);
    validateNonEmptyString(snapshot.metadata.schemaVersion, "metadata.schemaVersion", errors);

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

  return { ok: true, snapshot: snapshot as TeamFitReportV1ContractSnapshot };
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
