export const TEAM_FIT_REPORT_V2_TYPE = "team_fit_report_v2" as const;
export const TEAM_FIT_REPORT_V2_VERSION = "v2" as const;
export const TEAM_FIT_REPORT_V2_AUDIENCE = "hr_internal" as const;
export const TEAM_FIT_REPORT_V2_SOURCE_TYPE = "candidate_team_relational" as const;

export const TEAM_FIT_REPORT_V2_ASSESSMENT_CATEGORIES = [
  "strong_fit",
  "good_fit_with_conditions",
  "mixed_fit",
  "weak_fit",
  "insufficient_evidence",
] as const;

export type TeamFitReportV2AssessmentCategory =
  (typeof TEAM_FIT_REPORT_V2_ASSESSMENT_CATEGORIES)[number];

export const TEAM_FIT_REPORT_V2_ACTION_OWNERS = [
  "hr",
  "hiring_manager",
  "team_lead",
  "candidate",
  "team",
  "shared",
] as const;

export type TeamFitReportV2ActionOwner =
  (typeof TEAM_FIT_REPORT_V2_ACTION_OWNERS)[number];

export const TEAM_FIT_REPORT_V2_EVIDENCE_SOURCES = ["candidate", "team"] as const;

export type TeamFitReportV2EvidenceSource =
  (typeof TEAM_FIT_REPORT_V2_EVIDENCE_SOURCES)[number];

export type TeamFitReportV2EvidenceReference = {
  source: TeamFitReportV2EvidenceSource;
  key: string;
};

export type TeamFitReportV2 = {
  reportType: typeof TEAM_FIT_REPORT_V2_TYPE;
  reportVersion: typeof TEAM_FIT_REPORT_V2_VERSION;
  locale: string;
  generatedAt: string;
  inputSnapshotVersion: string;
  teamFitReportVersion: typeof TEAM_FIT_REPORT_V2_VERSION;
  audience: typeof TEAM_FIT_REPORT_V2_AUDIENCE;
  sourceType: typeof TEAM_FIT_REPORT_V2_SOURCE_TYPE;
  teamContext: {
    organizationId: string;
    teamId: string;
    teamName: string | null;
    teamAssessmentAssignmentId: string | null;
    teamDynamicsAggregationSnapshotId: string | null;
    teamDynamicsReportId: string | null;
  };
  candidateContext: {
    organizationId: string;
    participantId: string;
    assessmentAssignmentId: string | null;
    compositeInputSnapshotId: string | null;
    compositeReportId: string | null;
    displayName: string | null;
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
  executiveAssessment: {
    category: TeamFitReportV2AssessmentCategory;
    headline: string;
    conclusion: string;
    decisionGuidance: string;
    mainReasons: Array<{
      title: string;
      explanation: string;
      practicalConsequence: string;
      evidenceRefs: TeamFitReportV2EvidenceReference[];
    }>;
  };
  keySignals: Array<{
    title: string;
    explanation: string;
    practicalMeaning: string;
    evidenceRefs: TeamFitReportV2EvidenceReference[];
  }>;
  likelyContributions: Array<{
    title: string;
    explanation: string;
    conditions: string;
    evidenceRefs: TeamFitReportV2EvidenceReference[];
  }>;
  successConditions: Array<{
    title: string;
    condition: string;
    whyItMatters: string;
    owner: TeamFitReportV2ActionOwner;
    timing: string;
  }>;
  frictionRisks: Array<{
    title: string;
    trigger: string;
    likelyPattern: string;
    teamImpact: string;
    mitigation: string;
    owner: TeamFitReportV2ActionOwner;
    timing: string;
    evidenceRefs: TeamFitReportV2EvidenceReference[];
  }>;
  interviewPlan: Array<{
    question: string;
    purpose: string;
    whatToListenFor: string;
    positiveSignals: string[];
    concernSignals: string[];
    evidenceRefs: TeamFitReportV2EvidenceReference[];
  }>;
  teamIntegrationPlan: {
    summary: string;
    adaptForThisTeam: Array<{
      action: string;
      owner: TeamFitReportV2ActionOwner;
      timing: string;
      expectedResult: string;
    }>;
    teamPreparations: Array<{
      action: string;
      owner: TeamFitReportV2ActionOwner;
      timing: string;
    }>;
    first30Days: Array<{
      timing: string;
      action: string;
      owner: TeamFitReportV2ActionOwner;
      expectedResult: string;
    }>;
    successSignals: string[];
    earlyFrictionSignals: string[];
  };
  managerGuidance: Array<{
    action: string;
    rationale: string;
    timing: string;
    watchFor: string;
  }>;
  interpretationLimits: string[];
  metadata: {
    provider: string | null;
    providerVersion: string | null;
    generatedAt: string;
  };
};

export type TeamFitReportV2ValidationIssueCode =
  | "missing_field"
  | "unknown_field"
  | "invalid_type"
  | "empty_string"
  | "invalid_enum"
  | "array_too_short"
  | "array_too_long"
  | "invalid_format"
  | "missing_candidate_evidence"
  | "missing_team_evidence";

export type TeamFitReportV2ValidationIssue = {
  path: string;
  code: TeamFitReportV2ValidationIssueCode;
  message: string;
};

export type TeamFitReportV2ValidationResult =
  | {
      ok: true;
      complete: true;
      value: TeamFitReportV2;
      issues: [];
    }
  | {
      ok: false;
      complete: false;
      issues: TeamFitReportV2ValidationIssue[];
    };

type ValidationContext = {
  issues: TeamFitReportV2ValidationIssue[];
};

type ArrayLimits = {
  min: number;
  max: number;
};

function addIssue(
  context: ValidationContext,
  path: string,
  code: TeamFitReportV2ValidationIssueCode,
  message: string,
): void {
  context.issues.push({ path, code, message });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateJsonSafe(
  value: unknown,
  path: string,
  context: ValidationContext,
  ancestors: WeakSet<object> = new WeakSet<object>(),
): void {
  if (
    value === undefined ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint" ||
    (typeof value === "number" && !Number.isFinite(value))
  ) {
    addIssue(context, path, "invalid_format", "Expected a JSON-safe value.");
    return;
  }

  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      addIssue(context, path, "invalid_format", "Circular values are not JSON-safe.");
      return;
    }
    ancestors.add(value);
    value.forEach((entry, index) =>
      validateJsonSafe(entry, `${path}[${index}]`, context, ancestors),
    );
    ancestors.delete(value);
    return;
  }

  if (value !== null && typeof value === "object") {
    if (!isPlainObject(value)) {
      addIssue(context, path, "invalid_format", "Expected a JSON-safe plain object.");
      return;
    }

    if (ancestors.has(value)) {
      addIssue(context, path, "invalid_format", "Circular values are not JSON-safe.");
      return;
    }
    ancestors.add(value);
    Object.entries(value).forEach(([key, entry]) => {
      validateJsonSafe(
        entry,
        path === "<root>" ? key : `${path}.${key}`,
        context,
        ancestors,
      );
    });
    ancestors.delete(value);
  }
}

function validateObject(
  value: unknown,
  path: string,
  requiredKeys: readonly string[],
  context: ValidationContext,
): value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    addIssue(context, path, "invalid_type", "Expected a plain object.");
    return false;
  }

  const allowedKeys = new Set(requiredKeys);
  requiredKeys.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      addIssue(
        context,
        path === "<root>" ? key : `${path}.${key}`,
        "missing_field",
        "Required field is missing.",
      );
    }
  });

  Object.keys(value).forEach((key) => {
    if (!allowedKeys.has(key)) {
      addIssue(
        context,
        path === "<root>" ? key : `${path}.${key}`,
        "unknown_field",
        "Unknown field is not allowed.",
      );
    }
  });

  return true;
}

function validateString(
  value: unknown,
  path: string,
  context: ValidationContext,
): value is string {
  if (value === undefined) {
    return false;
  }

  if (typeof value !== "string") {
    addIssue(context, path, "invalid_type", "Expected a string.");
    return false;
  }

  if (value.trim().length === 0) {
    addIssue(context, path, "empty_string", "Expected a trimmed non-empty string.");
    return false;
  }

  return true;
}

function validateNullableString(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (value === undefined || value === null) {
    return;
  }

  validateString(value, path, context);
}

function validateConst(
  value: unknown,
  expected: string,
  path: string,
  context: ValidationContext,
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string") {
    addIssue(context, path, "invalid_type", "Expected a string.");
  } else if (value !== expected) {
    addIssue(context, path, "invalid_enum", `Expected ${expected}.`);
  }
}

function validateEnum(
  value: unknown,
  allowedValues: readonly string[],
  path: string,
  context: ValidationContext,
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string") {
    addIssue(context, path, "invalid_type", "Expected a string.");
  } else if (!allowedValues.includes(value)) {
    addIssue(context, path, "invalid_enum", "Value is not in the allowed enum.");
  }
}

function validateArray(
  value: unknown,
  path: string,
  limits: ArrayLimits,
  context: ValidationContext,
  validateEntry: (entry: unknown, path: string, context: ValidationContext) => void,
): value is unknown[] {
  if (value === undefined) {
    return false;
  }

  if (!Array.isArray(value)) {
    addIssue(context, path, "invalid_type", "Expected an array.");
    return false;
  }

  if (value.length < limits.min) {
    addIssue(context, path, "array_too_short", `Expected at least ${limits.min} items.`);
  }
  if (value.length > limits.max) {
    addIssue(context, path, "array_too_long", `Expected at most ${limits.max} items.`);
  }

  value.forEach((entry, index) => validateEntry(entry, `${path}[${index}]`, context));
  return true;
}

function validateStringArray(
  value: unknown,
  path: string,
  limits: ArrayLimits,
  context: ValidationContext,
): void {
  validateArray(value, path, limits, context, (entry, entryPath, entryContext) => {
    validateString(entry, entryPath, entryContext);
  });
}

function validateEvidenceReference(
  value: unknown,
  path: string,
  context: ValidationContext,
): void {
  if (!validateObject(value, path, ["source", "key"], context)) {
    return;
  }

  validateEnum(value.source, TEAM_FIT_REPORT_V2_EVIDENCE_SOURCES, `${path}.source`, context);
  validateString(value.key, `${path}.key`, context);
}

function validateEvidenceReferences(
  value: unknown,
  path: string,
  context: ValidationContext,
  requireBothSides: boolean,
): void {
  if (
    !validateArray(value, path, { min: 2, max: 6 }, context, validateEvidenceReference)
  ) {
    return;
  }

  if (requireBothSides) {
    if (!value.some((entry) => isPlainObject(entry) && entry.source === "candidate")) {
      addIssue(
        context,
        path,
        "missing_candidate_evidence",
        "Expected at least one candidate evidence reference.",
      );
    }
    if (!value.some((entry) => isPlainObject(entry) && entry.source === "team")) {
      addIssue(
        context,
        path,
        "missing_team_evidence",
        "Expected at least one team evidence reference.",
      );
    }
  }
}

function validateTeamContext(value: unknown, path: string, context: ValidationContext): void {
  const keys = [
    "organizationId",
    "teamId",
    "teamName",
    "teamAssessmentAssignmentId",
    "teamDynamicsAggregationSnapshotId",
    "teamDynamicsReportId",
  ];
  if (!validateObject(value, path, keys, context)) return;
  validateString(value.organizationId, `${path}.organizationId`, context);
  validateString(value.teamId, `${path}.teamId`, context);
  validateNullableString(value.teamName, `${path}.teamName`, context);
  validateNullableString(value.teamAssessmentAssignmentId, `${path}.teamAssessmentAssignmentId`, context);
  validateNullableString(
    value.teamDynamicsAggregationSnapshotId,
    `${path}.teamDynamicsAggregationSnapshotId`,
    context,
  );
  validateNullableString(value.teamDynamicsReportId, `${path}.teamDynamicsReportId`, context);
}

function validateCandidateContext(value: unknown, path: string, context: ValidationContext): void {
  const keys = [
    "organizationId",
    "participantId",
    "assessmentAssignmentId",
    "compositeInputSnapshotId",
    "compositeReportId",
    "displayName",
  ];
  if (!validateObject(value, path, keys, context)) return;
  validateString(value.organizationId, `${path}.organizationId`, context);
  validateString(value.participantId, `${path}.participantId`, context);
  validateNullableString(value.assessmentAssignmentId, `${path}.assessmentAssignmentId`, context);
  validateNullableString(value.compositeInputSnapshotId, `${path}.compositeInputSnapshotId`, context);
  validateNullableString(value.compositeReportId, `${path}.compositeReportId`, context);
  validateNullableString(value.displayName, `${path}.displayName`, context);
}

function validateSource(value: unknown, path: string, context: ValidationContext): void {
  const keys = [
    "candidateCompositeInputVersion",
    "candidateSourceReportIds",
    "candidateSourceTestSlugs",
    "teamInputVersion",
    "teamSourceReportIds",
    "teamSourceSnapshotIds",
    "optionalContextKeys",
  ];
  if (!validateObject(value, path, keys, context)) return;
  validateString(value.candidateCompositeInputVersion, `${path}.candidateCompositeInputVersion`, context);
  validateStringArray(value.candidateSourceReportIds, `${path}.candidateSourceReportIds`, { min: 0, max: Number.MAX_SAFE_INTEGER }, context);
  validateStringArray(value.candidateSourceTestSlugs, `${path}.candidateSourceTestSlugs`, { min: 0, max: Number.MAX_SAFE_INTEGER }, context);
  validateString(value.teamInputVersion, `${path}.teamInputVersion`, context);
  validateStringArray(value.teamSourceReportIds, `${path}.teamSourceReportIds`, { min: 0, max: Number.MAX_SAFE_INTEGER }, context);
  validateStringArray(value.teamSourceSnapshotIds, `${path}.teamSourceSnapshotIds`, { min: 0, max: Number.MAX_SAFE_INTEGER }, context);
  validateStringArray(value.optionalContextKeys, `${path}.optionalContextKeys`, { min: 0, max: Number.MAX_SAFE_INTEGER }, context);
}

function validateMainReason(value: unknown, path: string, context: ValidationContext): void {
  if (!validateObject(value, path, ["title", "explanation", "practicalConsequence", "evidenceRefs"], context)) return;
  validateString(value.title, `${path}.title`, context);
  validateString(value.explanation, `${path}.explanation`, context);
  validateString(value.practicalConsequence, `${path}.practicalConsequence`, context);
  validateEvidenceReferences(value.evidenceRefs, `${path}.evidenceRefs`, context, true);
}

function validateExecutiveAssessment(value: unknown, path: string, context: ValidationContext): void {
  if (!validateObject(value, path, ["category", "headline", "conclusion", "decisionGuidance", "mainReasons"], context)) return;
  validateEnum(value.category, TEAM_FIT_REPORT_V2_ASSESSMENT_CATEGORIES, `${path}.category`, context);
  validateString(value.headline, `${path}.headline`, context);
  validateString(value.conclusion, `${path}.conclusion`, context);
  validateString(value.decisionGuidance, `${path}.decisionGuidance`, context);
  validateArray(value.mainReasons, `${path}.mainReasons`, { min: 2, max: 4 }, context, validateMainReason);
}

function validateKeySignal(value: unknown, path: string, context: ValidationContext): void {
  if (!validateObject(value, path, ["title", "explanation", "practicalMeaning", "evidenceRefs"], context)) return;
  validateString(value.title, `${path}.title`, context);
  validateString(value.explanation, `${path}.explanation`, context);
  validateString(value.practicalMeaning, `${path}.practicalMeaning`, context);
  validateEvidenceReferences(value.evidenceRefs, `${path}.evidenceRefs`, context, true);
}

function validateContribution(value: unknown, path: string, context: ValidationContext): void {
  if (!validateObject(value, path, ["title", "explanation", "conditions", "evidenceRefs"], context)) return;
  validateString(value.title, `${path}.title`, context);
  validateString(value.explanation, `${path}.explanation`, context);
  validateString(value.conditions, `${path}.conditions`, context);
  validateEvidenceReferences(value.evidenceRefs, `${path}.evidenceRefs`, context, false);
}

function validateSuccessCondition(value: unknown, path: string, context: ValidationContext): void {
  if (!validateObject(value, path, ["title", "condition", "whyItMatters", "owner", "timing"], context)) return;
  validateString(value.title, `${path}.title`, context);
  validateString(value.condition, `${path}.condition`, context);
  validateString(value.whyItMatters, `${path}.whyItMatters`, context);
  validateEnum(value.owner, TEAM_FIT_REPORT_V2_ACTION_OWNERS, `${path}.owner`, context);
  validateString(value.timing, `${path}.timing`, context);
}

function validateFrictionRisk(value: unknown, path: string, context: ValidationContext): void {
  const keys = ["title", "trigger", "likelyPattern", "teamImpact", "mitigation", "owner", "timing", "evidenceRefs"];
  if (!validateObject(value, path, keys, context)) return;
  validateString(value.title, `${path}.title`, context);
  validateString(value.trigger, `${path}.trigger`, context);
  validateString(value.likelyPattern, `${path}.likelyPattern`, context);
  validateString(value.teamImpact, `${path}.teamImpact`, context);
  validateString(value.mitigation, `${path}.mitigation`, context);
  validateEnum(value.owner, TEAM_FIT_REPORT_V2_ACTION_OWNERS, `${path}.owner`, context);
  validateString(value.timing, `${path}.timing`, context);
  validateEvidenceReferences(value.evidenceRefs, `${path}.evidenceRefs`, context, true);
}

function validateInterviewItem(value: unknown, path: string, context: ValidationContext): void {
  const keys = ["question", "purpose", "whatToListenFor", "positiveSignals", "concernSignals", "evidenceRefs"];
  if (!validateObject(value, path, keys, context)) return;
  validateString(value.question, `${path}.question`, context);
  validateString(value.purpose, `${path}.purpose`, context);
  validateString(value.whatToListenFor, `${path}.whatToListenFor`, context);
  validateStringArray(value.positiveSignals, `${path}.positiveSignals`, { min: 1, max: 4 }, context);
  validateStringArray(value.concernSignals, `${path}.concernSignals`, { min: 1, max: 4 }, context);
  validateEvidenceReferences(value.evidenceRefs, `${path}.evidenceRefs`, context, true);
}

function validateOwnedAction(
  value: unknown,
  path: string,
  context: ValidationContext,
  includeExpectedResult: boolean,
): void {
  const keys = includeExpectedResult
    ? ["action", "owner", "timing", "expectedResult"]
    : ["action", "owner", "timing"];
  if (!validateObject(value, path, keys, context)) return;
  validateString(value.action, `${path}.action`, context);
  validateEnum(value.owner, TEAM_FIT_REPORT_V2_ACTION_OWNERS, `${path}.owner`, context);
  validateString(value.timing, `${path}.timing`, context);
  if (includeExpectedResult) validateString(value.expectedResult, `${path}.expectedResult`, context);
}

function validateTeamIntegrationPlan(value: unknown, path: string, context: ValidationContext): void {
  const keys = ["summary", "adaptForThisTeam", "teamPreparations", "first30Days", "successSignals", "earlyFrictionSignals"];
  if (!validateObject(value, path, keys, context)) return;
  validateString(value.summary, `${path}.summary`, context);
  validateArray(value.adaptForThisTeam, `${path}.adaptForThisTeam`, { min: 1, max: 5 }, context, (entry, entryPath, entryContext) => validateOwnedAction(entry, entryPath, entryContext, true));
  validateArray(value.teamPreparations, `${path}.teamPreparations`, { min: 1, max: 5 }, context, (entry, entryPath, entryContext) => validateOwnedAction(entry, entryPath, entryContext, false));
  validateArray(value.first30Days, `${path}.first30Days`, { min: 2, max: 6 }, context, (entry, entryPath, entryContext) => validateOwnedAction(entry, entryPath, entryContext, true));
  validateStringArray(value.successSignals, `${path}.successSignals`, { min: 2, max: 5 }, context);
  validateStringArray(value.earlyFrictionSignals, `${path}.earlyFrictionSignals`, { min: 2, max: 5 }, context);
}

function validateManagerGuidance(value: unknown, path: string, context: ValidationContext): void {
  if (!validateObject(value, path, ["action", "rationale", "timing", "watchFor"], context)) return;
  validateString(value.action, `${path}.action`, context);
  validateString(value.rationale, `${path}.rationale`, context);
  validateString(value.timing, `${path}.timing`, context);
  validateString(value.watchFor, `${path}.watchFor`, context);
}

function validateMetadata(value: unknown, path: string, context: ValidationContext): void {
  if (!validateObject(value, path, ["provider", "providerVersion", "generatedAt"], context)) return;
  validateNullableString(value.provider, `${path}.provider`, context);
  validateNullableString(value.providerVersion, `${path}.providerVersion`, context);
  validateString(value.generatedAt, `${path}.generatedAt`, context);
}

export function validateTeamFitReportV2(
  input: unknown,
): TeamFitReportV2ValidationResult {
  const context: ValidationContext = { issues: [] };
  validateJsonSafe(input, "<root>", context);

  const topLevelKeys = [
    "reportType", "reportVersion", "locale", "generatedAt", "inputSnapshotVersion",
    "teamFitReportVersion", "audience", "sourceType", "teamContext", "candidateContext",
    "source", "executiveAssessment", "keySignals", "likelyContributions", "successConditions",
    "frictionRisks", "interviewPlan", "teamIntegrationPlan", "managerGuidance",
    "interpretationLimits", "metadata",
  ];

  if (!validateObject(input, "<root>", topLevelKeys, context)) {
    return { ok: false, complete: false, issues: context.issues };
  }

  validateConst(input.reportType, TEAM_FIT_REPORT_V2_TYPE, "reportType", context);
  validateConst(input.reportVersion, TEAM_FIT_REPORT_V2_VERSION, "reportVersion", context);
  validateString(input.locale, "locale", context);
  validateString(input.generatedAt, "generatedAt", context);
  validateString(input.inputSnapshotVersion, "inputSnapshotVersion", context);
  validateConst(input.teamFitReportVersion, TEAM_FIT_REPORT_V2_VERSION, "teamFitReportVersion", context);
  validateConst(input.audience, TEAM_FIT_REPORT_V2_AUDIENCE, "audience", context);
  validateConst(input.sourceType, TEAM_FIT_REPORT_V2_SOURCE_TYPE, "sourceType", context);
  validateTeamContext(input.teamContext, "teamContext", context);
  validateCandidateContext(input.candidateContext, "candidateContext", context);
  validateSource(input.source, "source", context);
  validateExecutiveAssessment(input.executiveAssessment, "executiveAssessment", context);
  validateArray(input.keySignals, "keySignals", { min: 3, max: 6 }, context, validateKeySignal);
  validateArray(input.likelyContributions, "likelyContributions", { min: 2, max: 4 }, context, validateContribution);
  validateArray(input.successConditions, "successConditions", { min: 2, max: 4 }, context, validateSuccessCondition);
  validateArray(input.frictionRisks, "frictionRisks", { min: 2, max: 4 }, context, validateFrictionRisk);
  validateArray(input.interviewPlan, "interviewPlan", { min: 3, max: 5 }, context, validateInterviewItem);
  validateTeamIntegrationPlan(input.teamIntegrationPlan, "teamIntegrationPlan", context);
  validateArray(input.managerGuidance, "managerGuidance", { min: 3, max: 5 }, context, validateManagerGuidance);
  validateStringArray(input.interpretationLimits, "interpretationLimits", { min: 1, max: 4 }, context);
  validateMetadata(input.metadata, "metadata", context);

  if (context.issues.length > 0) {
    return { ok: false, complete: false, issues: context.issues };
  }

  return { ok: true, complete: true, value: input as TeamFitReportV2, issues: [] };
}
