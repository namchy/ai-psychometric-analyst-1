import "server-only";

import type { CompositeHrInputSnapshot } from "@/lib/assessment/composite-input";
import {
  COMPOSITE_HR_REPORT_AUDIENCE,
  COMPOSITE_HR_REPORT_CONTRACT_VERSION,
  COMPOSITE_HR_REPORT_SOURCE_TYPE,
  COMPOSITE_HR_REPORT_TYPE,
  formatCompositeHrReportValidationErrors,
  validateCompositeHrReportSnapshot,
  type CompositeHrReportSnapshot,
} from "@/lib/assessment/composite-hr-report-contract";
import {
  COMPOSITE_HR_BHS_GLOSSARY_PROMPT,
  COMPOSITE_HR_BHS_LANGUAGE_RULES,
  COMPOSITE_HR_BHS_REVIEWER_RULES,
  validateReportLanguageQuality,
  type ReportLanguageQualityIssue,
  type ReportLanguageQualityResult,
} from "@/lib/assessment/report-language-quality";
import {
  shouldOmitOpenAiTemperature,
} from "@/lib/assessment/report-provider-openai";

export const COMPOSITE_HR_REPORT_OPENAI_PROVIDER = "openai" as const;
export const COMPOSITE_HR_REPORT_OPENAI_PROVIDER_VERSION = "v1" as const;

type OpenAiCompositeHrProviderOptions = {
  apiKey: string | null;
  model: string | null;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => string;
};

type ErrorWithCause = Error & {
  cause?: unknown;
};

export type CompositeHrReviewIssue = {
  code: string;
  severity: "blocking" | "warning";
  message: string;
};

export type CompositeHrReviewResult = {
  approved: boolean;
  issues: CompositeHrReviewIssue[];
  summary: string;
};

export type CompositeHrValidatorBoundaryDiagnostic = {
  rawParsedOutput: unknown;
  canonicalizedOutput: CompositeHrReportSnapshot | null;
  contractValidationResult: { ok: true; errors: string[] } | { ok: false; errors: string[] };
  evidenceLockedValidationResult:
    | { ok: true; errors: string[] }
    | { ok: false; errors: string[] }
    | { ok: false; skipped: true; reason: string; errors: string[] };
  sourceIntegrityResult: { ok: true; error: null } | { ok: false; error: string } | { skipped: true; reason: string };
  evidenceIntegrityResult: { ok: true; error: null } | { ok: false; error: string } | { skipped: true; reason: string };
  languageQualityResult: ReportLanguageQualityResult | { skipped: true; reason: string };
  languageQualityHardIssues: ReportLanguageQualityIssue[];
  languageQualityWarnings: ReportLanguageQualityIssue[];
  hardSafetyResult:
    | { ok: true; issues: CompositeHrHardSafetyIssue[] }
    | { ok: false; issues: CompositeHrHardSafetyIssue[] }
    | { skipped: true; reason: string };
  addressingFormResult: { ok: true; error: null } | { ok: false; error: string } | { skipped: true; reason: string };
  normalizedValidationResult:
    | { ok: true; errors: string[] }
    | { ok: false; errors: string[] }
    | { skipped: true; reason: string };
  hardGateWouldPersist: boolean;
  validatorOnWouldPersist: boolean;
  failureReasons: string[];
};

export type CompositeHrHardSafetyIssue = {
  code: "RAW_ANSWER_LEAKAGE" | "DIAGNOSTIC_LANGUAGE" | "PROVIDER_DEBUG_LEAKAGE";
  phrase: string;
  path: string;
};

export type CompositeHrReviewerBoundary = {
  hardIssues: CompositeHrReviewIssue[];
  warnings: CompositeHrReviewIssue[];
  hardFailureReasons: string[];
};

export type CompositeHrBoundaryCategory =
  | "data_contract_blocking"
  | "deterministic_reference_blocking"
  | "evidence_integrity_blocking"
  | "prose_style_diagnostic_only"
  | "bhs_language_diagnostic_only"
  | "reviewer_quality_diagnostic_only"
  | "mutation_or_rewrite_risk";

export type CompositeHrBoundaryInventoryItem = {
  id: string;
  category: CompositeHrBoundaryCategory;
  recommendedBlocking: boolean;
  currentProductionBehavior: string;
  futureStrictReferenceRequirement: string | null;
};

export type CompositeHrBoundaryDiagnostic = {
  mode: "read_only_dev_diagnostic";
  reportSnapshotStatus:
    | "evaluated"
    | "not_evaluated_no_report_snapshot"
    | "invalid_report_snapshot";
  productionBehaviorChanged: false;
  validationInventory: CompositeHrBoundaryInventoryItem[];
  dataOnlyReadiness: {
    status: "not_ready";
    blockingCandidates: CompositeHrBoundaryCategory[];
    diagnosticOnlyCategories: CompositeHrBoundaryCategory[];
    reasons: string[];
  };
  persistedSnapshotEvaluation: {
    contract: { status: "pass" | "fail" | "not_evaluated"; findings: string[] };
    deterministicReference: { status: "pass" | "fail" | "not_evaluated"; findings: string[] };
    evidenceIntegrity: { status: "pass" | "fail" | "not_evaluated"; findings: string[] };
  };
  diagnosticOnlyCategories: CompositeHrBoundaryCategory[];
  mutationRiskInventory: CompositeHrBoundaryInventoryItem[];
};

export type CompositeHrDataOnlyShadowFinding = {
  code: string;
  category: CompositeHrBoundaryCategory | "renderer_display_rewrite_risk";
  message: string;
  path?: string;
};

export type CompositeHrDataOnlyShadowResult = {
  shadowMode: true;
  productionBehaviorChanged: false;
  wouldPassDataOnlyBlockingValidation: boolean | "not_evaluated";
  dataOnlyBlockingCategories: CompositeHrBoundaryCategory[];
  diagnosticOnlyCategories: CompositeHrBoundaryCategory[];
  blockingFindings: CompositeHrDataOnlyShadowFinding[];
  diagnosticOnlyFindings: CompositeHrDataOnlyShadowFinding[];
  mutationRiskFindings: CompositeHrDataOnlyShadowFinding[];
  referenceIntegrityFindings: CompositeHrDataOnlyShadowFinding[];
  proseStyleFindings: CompositeHrDataOnlyShadowFinding[];
  bhsLanguageFindings: CompositeHrDataOnlyShadowFinding[];
  reviewerQualityFindings: CompositeHrDataOnlyShadowFinding[];
  notEvaluatedReasons: string[];
};

type CompositeHrOpenAiChatCompletionsRequestBody = {
  model: string;
  response_format: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: true;
      schema: Record<string, unknown>;
    };
  };
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>;
  temperature?: number;
};

export type CompositeHrOpenAiRequestPayload = {
  label: string;
  schemaName: string;
  schema: Record<string, unknown>;
  systemPrompt: string;
  userPrompt: string;
};

type LockedCompositeEvidenceEntry = {
  testSlug: string;
  label: string;
  value: string;
  sourcePath: string;
};

const FEMININE_ADDRESSING_MISMATCH_PATTERNS = [
  /\bspreman na saradnju\b/i,
  /\bkonstruktivan u\b/i,
  /\borijentisan\b/i,
  /\bsklon\s/i,
];

function collectNarrativeStrings(snapshot: CompositeHrReportSnapshot): string[] {
  return [
    snapshot.summary.headline,
    snapshot.summary.profileOverview,
    ...snapshot.summary.keyStrengths,
    ...snapshot.summary.watchouts,
    ...snapshot.integratedSignals.flatMap((signal) => [signal.title, signal.body]),
    ...snapshot.interviewGuidance.focusAreas.flatMap((area) => [
      area.title,
      area.rationale,
      ...area.questions,
    ]),
    ...snapshot.onboardingGuidance.managementTips,
    ...snapshot.onboardingGuidance.supportNeeds,
    ...snapshot.limitations,
  ];
}

function collectCompositeHrUserFacingEntries(
  snapshot: CompositeHrReportSnapshot,
): Array<{ path: string; value: string }> {
  const entries: Array<{ path: string; value: string }> = [];
  const push = (path: string, value: unknown) => {
    if (typeof value === "string" && value.trim().length > 0) {
      entries.push({ path, value });
    }
  };

  push("summary.headline", snapshot.summary.headline);
  push("summary.profileOverview", snapshot.summary.profileOverview);
  snapshot.summary.keyStrengths.forEach((value, index) => push(`summary.keyStrengths[${index}]`, value));
  snapshot.summary.watchouts.forEach((value, index) => push(`summary.watchouts[${index}]`, value));

  snapshot.integratedSignals.forEach((signal, index) => {
    push(`integratedSignals[${index}].title`, signal.title);
    push(`integratedSignals[${index}].body`, signal.body);
    signal.evidence.forEach((evidence, evidenceIndex) => {
      push(`integratedSignals[${index}].evidence[${evidenceIndex}].label`, evidence.label);
      push(`integratedSignals[${index}].evidence[${evidenceIndex}].value`, evidence.value);
    });
  });

  snapshot.interviewGuidance.focusAreas.forEach((area, index) => {
    push(`interviewGuidance.focusAreas[${index}].title`, area.title);
    push(`interviewGuidance.focusAreas[${index}].rationale`, area.rationale);
    area.questions.forEach((value, questionIndex) =>
      push(`interviewGuidance.focusAreas[${index}].questions[${questionIndex}]`, value),
    );
  });

  snapshot.onboardingGuidance.managementTips.forEach((value, index) =>
    push(`onboardingGuidance.managementTips[${index}]`, value),
  );
  snapshot.onboardingGuidance.supportNeeds.forEach((value, index) =>
    push(`onboardingGuidance.supportNeeds[${index}]`, value),
  );
  snapshot.limitations.forEach((value, index) => push(`limitations[${index}]`, value));

  return entries;
}

const COMPOSITE_HR_RAW_ANSWER_PATTERNS = [
  /\braw answers?\b/iu,
  /\braw responses?\b/iu,
  /\bselected option\b/iu,
  /\bresponse_id\b/iu,
  /\bquestion\s+\d+\b/iu,
  /\bpitanje\s+\d+\b/iu,
  /\bodgovor(?:i|a)?\s+na\s+pitanj/iu,
  /\blikert\s+(?:odgovor|answer|response|skor|score|opcija|option)\b/iu,
  /\b(?:odgovor|answer|response|opcija|option)\s+likert\b/iu,
] as const;

const COMPOSITE_HR_DIAGNOSTIC_PATTERNS = [
  /\bdijagnoz\w*\b/iu,
  /\bdijagnostic\w*\b/iu,
  /\bclinical\b/iu,
  /\bmedical\b/iu,
  /\bdepresij\w*\b/iu,
  /\banksiozn\w*\s+poremec/iu,
  /\banksiozn\w*\s+poremeć/iu,
  /\badhd\b/iu,
  /\bautiz\w*\b/iu,
] as const;

const COMPOSITE_HR_PROVIDER_DEBUG_PATTERNS = [
  /\bdebug\b/iu,
  /\bjson schema\b/iu,
  /\bstructured output\b/iu,
  /\bgenerator metadata\b/iu,
  /\bsource attempts?\b/iu,
  /\blinked attempts?\b/iu,
  /\bopenai\s+request\b/iu,
  /\bprovider\s+request\b/iu,
  /\bprovider\s+metadata\b/iu,
  /\braw\s+provider\b/iu,
] as const;

function collectCompositeHrHardSafetyIssues(
  snapshot: CompositeHrReportSnapshot,
): CompositeHrHardSafetyIssue[] {
  const issues: CompositeHrHardSafetyIssue[] = [];

  for (const entry of collectCompositeHrUserFacingEntries(snapshot)) {
    for (const pattern of COMPOSITE_HR_RAW_ANSWER_PATTERNS) {
      const match = entry.value.match(pattern);

      if (match) {
        issues.push({
          code: "RAW_ANSWER_LEAKAGE",
          phrase: match[0],
          path: entry.path,
        });
      }
    }

    for (const pattern of COMPOSITE_HR_DIAGNOSTIC_PATTERNS) {
      const match = entry.value.match(pattern);

      if (match) {
        issues.push({
          code: "DIAGNOSTIC_LANGUAGE",
          phrase: match[0],
          path: entry.path,
        });
      }
    }

    for (const pattern of COMPOSITE_HR_PROVIDER_DEBUG_PATTERNS) {
      const match = entry.value.match(pattern);

      if (match) {
        issues.push({
          code: "PROVIDER_DEBUG_LEAKAGE",
          phrase: match[0],
          path: entry.path,
        });
      }
    }
  }

  return issues;
}

function isCompositeHrHardLanguageQualityIssue(issue: ReportLanguageQualityIssue): boolean {
  if (issue.code === "FORBIDDEN_HIRING_DECISION" || issue.code === "FORBIDDEN_DEBUG_LANGUAGE") {
    return true;
  }

  if (issue.code !== "FORBIDDEN_TERM") {
    return false;
  }

  return /^(fit score|hire|no-hire)$/iu.test(issue.phrase.trim());
}

function classifyCompositeHrLanguageQualityResult(
  result: ReportLanguageQualityResult,
): {
  hardIssues: ReportLanguageQualityIssue[];
  warnings: ReportLanguageQualityIssue[];
  hardFailureReasons: string[];
} {
  const hardIssues = result.issues.filter(isCompositeHrHardLanguageQualityIssue);
  const warnings = result.issues.filter((issue) => !isCompositeHrHardLanguageQualityIssue(issue));

  return {
    hardIssues,
    warnings,
    hardFailureReasons: hardIssues.map((issue) =>
      issue.suggestion
        ? `${issue.code}: "${issue.phrase}" -> "${issue.suggestion}"`
        : `${issue.code}: "${issue.phrase}"`,
    ),
  };
}

function isCompositeHrHardReviewerIssue(issue: CompositeHrReviewIssue): boolean {
  const text = `${issue.code} ${issue.message}`.toLowerCase();

  return (
    issue.severity === "blocking" &&
    /\b(hire|no-hire|zaposl|hiring|safety|source|attempt|score|evidence|identifier|generatedfor|raw answer|raw response|debug|technical|provider|openai|clinical|medical|diagnos|diagnos|dijagnoz|protected|schema|shape|contract)\b/i.test(text)
  );
}

export function classifyCompositeHrReviewerBoundary(
  review: CompositeHrReviewResult,
): CompositeHrReviewerBoundary {
  const hardIssues = review.issues.filter(isCompositeHrHardReviewerIssue);
  const warnings = review.issues.filter((issue) => !isCompositeHrHardReviewerIssue(issue));

  return {
    hardIssues,
    warnings,
    hardFailureReasons: hardIssues.map((issue) => `${issue.severity}:${issue.code}:${issue.message}`),
  };
}

function buildOpenAiSchemaName(schemaName: string): string {
  const sanitized = schemaName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "");

  if (sanitized.length <= 64) {
    return sanitized || "schema";
  }

  return sanitized.slice(0, 64) || "schema";
}

function parseStructuredContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      `OpenAI composite HR report returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function buildLocaleInstruction(locale: CompositeHrInputSnapshot["locale"]): string {
  switch (locale) {
    case "bs":
      return "Write narrative text in Bosnian, Latin script, ijekavica.";
    case "hr":
      return "Write narrative text in Croatian, Latin script.";
    case "sr":
      return "Write narrative text in Serbian, Latin script.";
    case "en":
      return "Write narrative text in English.";
    default:
      return `Write narrative text in locale ${locale}.`;
  }
}

function assertAddressingFormConsistency(
  snapshot: CompositeHrReportSnapshot,
  input: CompositeHrInputSnapshot,
): void {
  if (input.addressingForm !== "feminine") {
    return;
  }

  const text = collectNarrativeStrings(snapshot).join("\n");

  for (const pattern of FEMININE_ADDRESSING_MISMATCH_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(`Composite HR report contains feminine addressing mismatch: ${pattern}`);
    }
  }
}

function assertImmutableSource(snapshot: CompositeHrReportSnapshot, input: CompositeHrInputSnapshot): void {
  const expectedAttemptIds = input.sourceAttempts.map((attempt) => attempt.attemptId);
  const expectedTestSlugs = input.coverage.completedTestSlugs.length > 0
    ? [...input.coverage.completedTestSlugs]
    : input.sourceAttempts.map((attempt) => attempt.testSlug);

  const sourceAttemptIdsMatch =
    snapshot.source.sourceAttemptIds.length === expectedAttemptIds.length &&
    snapshot.source.sourceAttemptIds.every((value, index) => value === expectedAttemptIds[index]);
  const testSlugsMatch =
    snapshot.source.testSlugs.length === expectedTestSlugs.length &&
    snapshot.source.testSlugs.every((value, index) => value === expectedTestSlugs[index]);

  if (!sourceAttemptIdsMatch) {
    throw new Error("Composite HR report sourceAttemptIds do not match CompositeHrInputSnapshot.");
  }

  if (!testSlugsMatch) {
    throw new Error("Composite HR report testSlugs do not match CompositeHrInputSnapshot.");
  }

  if (snapshot.source.inputContractVersion !== input.contractVersion) {
    throw new Error("Composite HR report inputContractVersion does not match CompositeHrInputSnapshot.");
  }

  if (snapshot.generatedFor.organizationId !== input.generatedFor.organizationId) {
    throw new Error("Composite HR report organizationId does not match CompositeHrInputSnapshot.");
  }

  if (snapshot.generatedFor.participantId !== input.generatedFor.participantId) {
    throw new Error("Composite HR report participantId does not match CompositeHrInputSnapshot.");
  }

  if (snapshot.generatedFor.assessmentAssignmentId !== input.generatedFor.assessmentAssignmentId) {
    throw new Error("Composite HR report assessmentAssignmentId does not match CompositeHrInputSnapshot.");
  }

  if (snapshot.locale !== input.locale) {
    throw new Error("Composite HR report locale does not match CompositeHrInputSnapshot.");
  }
}

function normalizeEvidenceKey(testSlug: string, label: string): string {
  return `${testSlug.trim().toLowerCase()}::${normalizeCompositeEvidenceLabelForLock(
    testSlug,
    label,
  )
    .trim()
    .toLowerCase()}`;
}

function normalizeCompositeEvidenceLabelForLock(testSlug: string, label: string): string {
  const normalizedTestSlug = testSlug.trim().toLowerCase();
  const normalizedLabel = label.trim().toLowerCase();

  if (
    normalizedTestSlug === "ipip-neo-120-v1" &&
    ["ugodnost", "saradljivost", "saradnja", "agreeableness"].includes(normalizedLabel)
  ) {
    return "Spremnost na saradnju";
  }

  return label;
}

function formatCompositeEvidenceScore(value: number): string {
  return value.toFixed(2);
}

function buildLockedCompositeEvidenceCatalog(
  input: CompositeHrInputSnapshot,
): LockedCompositeEvidenceEntry[] {
  const ipipEntries = input.deterministicInputs.ipip.domains.flatMap((domain) => {
    if (
      typeof domain.label !== "string" ||
      domain.label.trim().length === 0 ||
      typeof domain.averageScore !== "number" ||
      !Number.isFinite(domain.averageScore) ||
      typeof domain.bandLabel !== "string" ||
      domain.bandLabel.trim().length === 0
    ) {
      return [];
    }

    return [{
      testSlug: input.deterministicInputs.ipip.testSlug,
      label:
        domain.domainCode === "AGREEABLENESS"
          ? "Spremnost na saradnju"
          : domain.label,
      value: `${formatCompositeEvidenceScore(domain.averageScore)} (${domain.bandLabel})`,
      sourcePath: `deterministicInputs.ipip.domains.${domain.domainCode}`,
    }];
  });
  const mwmsEntries = input.deterministicInputs.mwms.dimensions.flatMap((dimension) => {
    if (
      typeof dimension.label !== "string" ||
      dimension.label.trim().length === 0 ||
      typeof dimension.rawScore !== "number" ||
      !Number.isFinite(dimension.rawScore) ||
      typeof dimension.bandLabel !== "string" ||
      dimension.bandLabel.trim().length === 0
    ) {
      return [];
    }

    return [{
      testSlug: input.deterministicInputs.mwms.testSlug,
      label: dimension.label,
      value: `${formatCompositeEvidenceScore(dimension.rawScore)} (${dimension.bandLabel})`,
      sourcePath: `deterministicInputs.mwms.dimensions.${dimension.code}`,
    }];
  });
  const safranEntries = [
    {
      testSlug: input.deterministicInputs.safran.testSlug,
      label: "Ukupni kognitivni rezultat",
      value: `${input.deterministicInputs.safran.overall.rawScore}/${input.deterministicInputs.safran.overall.maxScore}`,
      sourcePath: "deterministicInputs.safran.overall",
    },
    {
      testSlug: input.deterministicInputs.safran.testSlug,
      label: "Verbalni rezultat",
      value: `${input.deterministicInputs.safran.verbal.rawScore}/${input.deterministicInputs.safran.verbal.maxScore}`,
      sourcePath: "deterministicInputs.safran.verbal",
    },
    {
      testSlug: input.deterministicInputs.safran.testSlug,
      label: "Figuralni rezultat",
      value: `${input.deterministicInputs.safran.figural.rawScore}/${input.deterministicInputs.safran.figural.maxScore}`,
      sourcePath: "deterministicInputs.safran.figural",
    },
    {
      testSlug: input.deterministicInputs.safran.testSlug,
      label: "Numericki rezultat",
      value: `${input.deterministicInputs.safran.numeric.rawScore}/${input.deterministicInputs.safran.numeric.maxScore}`,
      sourcePath: "deterministicInputs.safran.numeric",
    },
  ] satisfies LockedCompositeEvidenceEntry[];

  return [...ipipEntries, ...mwmsEntries, ...safranEntries];
}

function applyLockedCompositeEvidenceValues(
  snapshot: CompositeHrReportSnapshot,
  input: CompositeHrInputSnapshot,
): CompositeHrReportSnapshot {
  const lockedEvidenceByKey = new Map(
    buildLockedCompositeEvidenceCatalog(input).map((entry) => [
      normalizeEvidenceKey(entry.testSlug, entry.label),
      entry,
    ]),
  );

  return {
    ...snapshot,
    integratedSignals: snapshot.integratedSignals.map((signal) => ({
      ...signal,
      evidence: signal.evidence.map((entry) => {
        const lockedEntry = lockedEvidenceByKey.get(
          normalizeEvidenceKey(entry.testSlug, entry.label),
        );

        if (!lockedEntry) {
          return entry;
        }

        if (entry.value === lockedEntry.value) {
          return {
            ...entry,
            label: lockedEntry.label,
          };
        }

        return {
          ...entry,
          label: lockedEntry.label,
          value: lockedEntry.value,
        };
      }),
    })),
  };
}

function assertLockedCompositeEvidenceIntegrity(
  snapshot: CompositeHrReportSnapshot,
  input: CompositeHrInputSnapshot,
): void {
  const lockedEntries = buildLockedCompositeEvidenceCatalog(input);
  const lockedEntryByKey = new Map(
    lockedEntries.map((entry) => [normalizeEvidenceKey(entry.testSlug, entry.label), entry]),
  );
  const lockedTestSlugByNormalizedLabel = new Map(
    lockedEntries.map((entry) => [entry.label.trim().toLowerCase(), entry.testSlug]),
  );

  for (const signal of snapshot.integratedSignals) {
    for (const evidence of signal.evidence) {
      const directMatch = lockedEntryByKey.get(
        normalizeEvidenceKey(evidence.testSlug, evidence.label),
      );

      if (directMatch && evidence.value !== directMatch.value) {
        throw new Error(
          `Composite HR report evidence value mismatch for ${evidence.testSlug}/${evidence.label}. Expected "${directMatch.value}" from ${directMatch.sourcePath}, received "${evidence.value}".`,
        );
      }

      const expectedTestSlug = lockedTestSlugByNormalizedLabel.get(
        evidence.label.trim().toLowerCase(),
      );

      if (expectedTestSlug && expectedTestSlug !== evidence.testSlug) {
        throw new Error(
          `Composite HR report evidence label "${evidence.label}" must use testSlug ${expectedTestSlug}, received ${evidence.testSlug}.`,
        );
      }
    }
  }
}

function buildCompositeHrOpenAiSystemPrompt(input: CompositeHrInputSnapshot): string {
  return [
    "You generate HR-facing composite assessment reports.",
    "Return only JSON that matches the supplied JSON schema exactly.",
    "Use only the provided deterministic CompositeHrInputSnapshot.",
    "Do not read or infer any data outside the provided snapshot.",
    "Do not change scores, bands, source attempts, completed test slugs, coverage or generatedFor identifiers.",
    "If you cite evidence labels that correspond to deterministic source facts, copy testSlug, label and value verbatim from the locked evidence catalog.",
    "Never freehand or estimate numeric evidence values, domain scores, band labels, motivation scores or cognitive totals.",
    "Never type a new score string for an IPIP domain. If you cite a domain such as Neuroticizam, use the exact locked value from the input catalog.",
    "Do not invent source attempts, tests, evidence or hidden attributes.",
    "Do not produce hire/no-hire advice, fit scores, rankings, medical claims, clinical language, protected-trait inferences or absolute statements.",
    "Write advisory decision-support text for HR, focused on clear work hypotheses, interview verification and onboarding actions.",
    "Use a confident HR-advisory tone: concrete, operational and methodologically safe, without turning signals into verdicts.",
    "Answer what the most important work signal is, what HR should verify first, which behaviours to confirm or disconfirm, where performance may be strongest, where friction may emerge and how the manager should set priorities, expectations, support and onboarding.",
    "Every integrated signal must be traceable to evidence from the provided tests.",
    "Keep limitations explicit, calm and short; limitations must not dominate the report tone.",
    `Input contains addressingForm=${input.addressingForm}. Use it only for grammatical form when directly describing the candidate/person.`,
    "Do not change scores, bands, evidence, interpretation, risk level or recommendation because of addressingForm.",
    "For feminine addressingForm, use feminine forms such as spremna, konstruktivna, orijentisana, sklona, stabilna, pouzdana and kandidatkinja where natural.",
    "For feminine addressingForm, avoid masculine-only forms such as spreman, konstruktivan, orijentisan or sklon when directly referring to the person.",
    "For feminine addressingForm, never output phrases like 'spreman na saradnju', 'konstruktivan u', 'orijentisan' or 'sklon' when they describe the person.",
    "For masculine addressingForm, use masculine forms such as spreman, konstruktivan, orijentisan, sklon, stabilan, pouzdan and kandidat where natural.",
    "Prefer neutral nouns such as osoba or profil where that produces more natural BHS business language.",
    "Do not overuse gendered wording when a neutral formulation is more natural.",
    "Use premium Bosnian/Croatian/Serbian business language: natural, precise, practical, without hype or generic AI phrasing.",
    "For BHS narrative sentences, write domain and motivation dimension names in lowercase when they appear mid-sentence, e.g. 'više izražena savjesnost', 'spremnost na saradnju', 'niže izražen neuroticizam', 'intrinzična motivacija'.",
    "Do not use English-style title casing for domains or dimensions inside BHS narrative sentences.",
    "Display/evidence labels may remain capitalized, e.g. 'Savjesnost' and 'Spremnost na saradnju'; do not lowercase evidence labels or chip labels.",
    ...COMPOSITE_HR_BHS_LANGUAGE_RULES,
    ...COMPOSITE_HR_BHS_GLOSSARY_PROMPT,
    "Write shorter, more scannable HR copy: short sentences, clear rhythm, concrete HR verbs and fewer dense paragraphs.",
    "Avoid abstract constructions, multi-clause sentences and phrases like 'kombinacija X, Y i Z' when a direct HR implication is clearer.",
    "Use action verbs such as dogovorite, postavite, provjerite, definisite, usaglasite, dajte, trazite and razjasnite where natural.",
    "Avoid awkward literal translations, vague abstractions and overly long sentences.",
    buildLocaleInstruction(input.locale),
  ].join(" ");
}

function buildCompositeHrOpenAiUserPrompt(input: CompositeHrInputSnapshot): string {
  return JSON.stringify({
    instructions: {
      output_contract: COMPOSITE_HR_REPORT_CONTRACT_VERSION,
      audience: "HR only",
      source_rule: "Use only the provided deterministic CompositeHrInputSnapshot as source.",
      traceability_rule:
        "sourceAttemptIds, testSlugs and generatedFor identifiers must match the provided input exactly.",
      score_integrity_rule:
        "Do not change, reinterpret or normalize score values, bands, coverage or source attempts.",
      evidence_lock_rule:
        "When evidence cites a deterministic source fact, copy testSlug, label and value exactly from lockedEvidenceCatalog. Do not rewrite numeric values, bands or domain scores.",
      addressing_form_rule:
        `Input contains addressingForm=${input.addressingForm}. Use it only for grammatical form when directly describing the candidate/person.`,
      content_rules: [
        "Do not write hire/no-hire decisions.",
        ...COMPOSITE_HR_BHS_LANGUAGE_RULES,
        ...COMPOSITE_HR_BHS_GLOSSARY_PROMPT,
        "Do not make medical, clinical or protected-trait claims.",
        "Do not present results as absolute truth.",
        "Do not add evidence that is not directly traceable to the input snapshot.",
        "Do not improvise score strings for IPIP domains, MWMS dimensions or SAFRAN totals.",
      ],
      style_rules: [
        "Use premium B2B tone: stručan, konkretan, savjetodavan, HR-operativan, metodološki siguran, bez hype-a.",
        "Prefer clear HR hypotheses over sterile hedging; avoid defaulting to vague phrases like 'može upućivati' when the source supports a firmer hypothesis.",
        "Do not write psychometric verdicts. Frame stronger statements as work hypotheses, verification priorities and management guidance.",
        "Write in natural Bosnian/Croatian/Serbian business language, not in direct or awkward translationese.",
        "In narrative text, use sentence-case/lowercase domain and dimension names when they are not at the start of a sentence: 'više izražena savjesnost', 'spremnost na saradnju', 'niže izražen neuroticizam', 'intrinzična motivacija'.",
        "Do not write title-cased domain or dimension names mid-sentence, such as 'Savjesnosti', 'Spremnosti na saradnju', 'Neuroticizma', 'Ekstraverzije', 'Otvorenosti', 'Intrinzične motivacije' or 'Identifikovane motivacije'.",
        "Keep display/evidence labels separate from narrative labels: evidence labels can be capitalized exactly as provided, while narrative mentions should be lowercase mid-sentence.",
        ...COMPOSITE_HR_BHS_GLOSSARY_PROMPT,
        "Prefer formulations such as spreman na saradnju, saradnicka orijentacija, kooperativan, otvoren za saradnju or sklon saradnji when the evidence supports them.",
        "Avoid generic AI phrasing and awkward literal translations.",
        "Use addressingForm only for grammatical agreement, not for any interpretive change.",
        "For feminine, prefer forms such as spremna, konstruktivna, orijentisana, sklona, stabilna and pouzdana when directly describing the person.",
        "For feminine, never use masculine phrases such as 'spreman na saradnju', 'konstruktivan u', 'orijentisan' or 'sklon' for the person.",
        "For masculine, prefer forms such as spreman, konstruktivan, orijentisan, sklon, stabilan and pouzdan when directly describing the person.",
        "Prefer neutral nouns such as osoba or profil when they read more naturally than repeated gendered wording.",
        "Avoid overly long sentences; keep sentences readable and controlled.",
        "Prefer short paragraphs and a scan-friendly rhythm over dense explanatory blocks.",
        "Use concrete HR action verbs instead of passive or abstract formulations.",
        "Avoid sentences that combine finding, explanation, risk and recommendation in one long chain.",
        "Avoid generic constructions such as 'kombinacija X, Y i Z' when the practical HR meaning can be stated directly.",
      ],
      structure_rules: [
        "summary.headline should be one short HR-facing headline, ideally close to 90 characters or less.",
        "summary.headline must avoid long compound labels and overly narrow labels such as 'izvrsiteljica' unless the role context truly requires them.",
        "Prefer neutral headline patterns such as: 'Pouzdan radni profil...', 'Snažna motivacija uz analitičku jasnoću...' or 'Pouzdan stil rada uz dobar analitički kapacitet...'.",
        "summary.profileOverview should be a short executive HR conclusion, not a generic description of assessment results.",
        "summary.profileOverview should contain at most 3 clear sentences, not one overloaded sentence.",
        "The first sentence should state the most important work signal.",
        "The second sentence should state what HR should verify first in interview, using direct wording such as: 'U intervjuu prvo provjerite...'.",
        "The third sentence, if needed, should explain how HR should use the finding for role scope or onboarding, using wording such as: 'Koristite ovaj nalaz za...'.",
        "Do not put more than two main ideas in one summary.profileOverview sentence.",
        "summary.keyStrengths should contain 2 to 4 concise items.",
        "summary.watchouts should contain 2 to 4 concrete verification priorities, not passive cautions.",
        "Each summary.watchouts item should be 1 direct HR action sentence or at most 2 short sentences.",
        "summary.watchouts should prefer action formulations such as: 'U intervjuu provjerite...', 'Direktno razjasnite...', 'Tražite primjer...' or 'Slušajte da li...'.",
        "Do not start summary.watchouts with passive openings such as 'Područje za dodatnu provjeru je...', 'Vrijedi provjeriti...' or 'Može biti korisno razmotriti...'.",
        "integratedSignals should contain 3 to 5 items with evidence arrays tied to real tests from the input.",
        "Each integratedSignals item should make the body useful for HR: briefly state what the signal means in work and what HR should verify next.",
        "In integratedSignals.body, make the verification part an action instruction: 'Tražite konkretan primjer...', 'Provjerite kako...' or 'Slušajte da li kandidat opisuje...'.",
        "Do not use one long integratedSignals.body sentence to combine finding, explanation, risk and recommendation.",
        "interviewGuidance.focusAreas should contain 2 to 4 items with practical questions.",
        "interviewGuidance questions should be direct, ready to ask and include what HR should listen for when the existing field allows it naturally.",
        "interviewGuidance rationale should be short and should naturally indicate what HR should listen for in the answer when possible.",
        "onboardingGuidance.managementTips should contain 2 to 4 items.",
        "onboardingGuidance.supportNeeds should contain 2 to 4 items.",
        "onboardingGuidance should be concise and operational: dogovorite prioritete, postavite ritam provjera, definisite kriterije kvaliteta, usaglasite ocekivanja, dajte autonomiju where supported and add structure where friction may appear.",
        "Avoid generic onboardingGuidance wording that does not name a clear manager action.",
        "limitations should contain 2 to 4 items and remain explicit, calm and short.",
      ],
      metadata_rules: [
        "metadata.provider must be openai",
        "metadata.providerVersion must be v1",
        "metadata.generatedAt must be an ISO timestamp string",
      ],
      integration_rules: [
        "Explicitly integrate IPIP as the behavioural/personality signal, SAFRAN as the cognitive signal and MWMS as the motivational signal.",
        "Do not merely list each test separately; explain the combination, reinforcement or tension between signals.",
        "Translate combinations into practical HR meaning, such as reliability in collaboration/execution, pressure risks or task-fit questions.",
        "A strong overall cognitive result with a relatively lower figural result must be treated as a task-shape question, not as a general cognitive deficit claim.",
      ],
      hr_translation_rules: [
        "Each key strength should be translated into a plausible work behaviour.",
        "Each watchout should be translated into a concrete interview action, verification question or management checkpoint.",
        "Each important insight should answer at least one HR operating question: what matters most, what to verify first, what behaviour to confirm or disconfirm, where the person may perform best, where friction may arise or how the manager should support onboarding.",
        "For strengths, name the likely working context where the signal can create value.",
        "For risks or friction, name the condition under which the issue may appear and the first practical check HR or the manager should run.",
        "Avoid abstract statements that have no operational HR use.",
      ],
      anti_repetition_rules: [
        "Do not repeat the phrase korisno je provjeriti across the report.",
        "Vary formulations such as: U intervjuu vrijedi razjasniti..., Preporučuje se tražiti konkretan primjer..., Za menadžera je važno pratiti..., U radnom kontekstu ovo se može pokazati kao..., Rizik nastaje ako....",
      ],
      safety_rules: [
        "The report does not decide whether the candidate should be hired.",
        "The report is for interview structure, working-condition checks and management guidance.",
        "addressingForm must never change scoring, interpretation, evidence, risk level or recommendation.",
      ],
    },
    lockedEvidenceCatalog: buildLockedCompositeEvidenceCatalog(input),
    input,
  });
}

function buildCompositeHrReviewerSystemPrompt(): string {
  return [
    "You review a candidate HR-facing composite assessment report before it is accepted.",
    "Return only JSON matching the supplied schema exactly.",
    "Reject the report if there is any blocking language, HR safety, source integrity or user-facing clarity issue.",
    "Use blocking severity for issues that should prevent acceptance.",
    "Evaluate forbidden language and user-facing clarity only in candidateReportSnapshot.",
    "Use sourceSnapshot only to verify source integrity such as identifiers, scores, bands and referenced instruments.",
    "Reject any candidateReportSnapshot evidence item that changes a locked deterministic value from sourceSnapshot.lockedEvidenceCatalog.",
    "Do not reject because sourceSnapshot contains legacy or internal labels if candidateReportSnapshot itself uses correct user-facing terminology.",
    "ASCII-only BHS spellings without diacritics are acceptable if the wording is otherwise natural and terminologically correct.",
    "For AGREEABLENESS labels in candidateReportSnapshot, only 'Spremnost na saradnju' is valid.",
    "Do not use 'Saradnja' as an AGREEABLENESS domain label or evidence label.",
    "Do not reject ordinary narrative uses of the word 'saradnja' when they do not replace the AGREEABLENESS label.",
    ...COMPOSITE_HR_BHS_LANGUAGE_RULES,
    ...COMPOSITE_HR_BHS_GLOSSARY_PROMPT,
    ...COMPOSITE_HR_BHS_REVIEWER_RULES,
  ].join(" ");
}

function buildCompositeHrReviewerUserPrompt(
  input: CompositeHrInputSnapshot,
  snapshot: CompositeHrReportSnapshot,
): string {
  return JSON.stringify({
    instructions: {
      audience: "HR reviewer only",
      decision_rule: "Approve only when the candidate snapshot is safe, natural, source-faithful and HR-appropriate.",
      blocking_rule: "Any blocking issue means approved=false.",
      candidate_report_scope_rule:
        "Review forbidden terminology, hiring language and user-facing clarity only inside candidateReportSnapshot.",
      source_snapshot_scope_rule:
        "Use sourceSnapshot only for deterministic source integrity checks. Do not block on legacy/internal labels that appear only in sourceSnapshot.",
      ascii_bhs_rule:
        "Do not reject candidateReportSnapshot only because preferred BHS wording appears without diacritics when the wording is otherwise natural and terminologically correct.",
      agreeableness_label_rule:
        "Inside candidateReportSnapshot, AGREEABLENESS domain/evidence labels must use 'Spremnost na saradnju'. 'Saradnja' is not allowed as the label replacement.",
      saradnja_narrative_rule:
        "Do not reject ordinary narrative uses of the word 'saradnja' when they are not acting as AGREEABLENESS labels.",
      review_rules: COMPOSITE_HR_BHS_REVIEWER_RULES,
      glossary_rules: COMPOSITE_HR_BHS_GLOSSARY_PROMPT,
      language_rules: COMPOSITE_HR_BHS_LANGUAGE_RULES,
    },
    sourceSnapshot: {
      generatedFor: input.generatedFor,
      sourceAttempts: input.sourceAttempts.map((attempt) => ({
        attemptId: attempt.attemptId,
        testSlug: attempt.testSlug,
      })),
      completedTestSlugs: input.coverage.completedTestSlugs,
      deterministicInputs: input.deterministicInputs,
      summarySignals: input.summarySignals,
      lockedEvidenceCatalog: buildLockedCompositeEvidenceCatalog(input),
    },
    candidateReportSnapshot: snapshot,
  });
}

const compositeHrReviewOpenAiSchema = {
  type: "object",
  additionalProperties: false,
  required: ["approved", "issues", "summary"],
  properties: {
    approved: {
      type: "boolean",
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "severity", "message"],
        properties: {
          code: { type: "string", minLength: 1 },
          severity: {
            type: "string",
            enum: ["blocking", "warning"],
          },
          message: { type: "string", minLength: 1 },
        },
      },
    },
    summary: {
      type: "string",
      minLength: 1,
    },
  },
} as const satisfies Record<string, unknown>;

export function buildOpenAiCompositeHrReportRequestPayload(
  input: CompositeHrInputSnapshot,
): CompositeHrOpenAiRequestPayload {
  return {
    label: "composite HR report",
    schemaName: COMPOSITE_HR_REPORT_CONTRACT_VERSION,
    schema: compositeHrReportOpenAiSchema as Record<string, unknown>,
    systemPrompt: buildCompositeHrOpenAiSystemPrompt(input),
    userPrompt: buildCompositeHrOpenAiUserPrompt(input),
  };
}

export function buildCompositeHrOpenAiChatCompletionsRequestBody(
  payload: CompositeHrOpenAiRequestPayload,
  options: Pick<OpenAiCompositeHrProviderOptions, "model">,
): CompositeHrOpenAiChatCompletionsRequestBody {
  if (!options.model) {
    throw new Error("Missing required env var: AI_REPORT_MODEL");
  }

  const requestBody: CompositeHrOpenAiChatCompletionsRequestBody = {
    model: options.model,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: buildOpenAiSchemaName(payload.schemaName),
        strict: true,
        schema: payload.schema,
      },
    },
    messages: [
      {
        role: "system",
        content: payload.systemPrompt,
      },
      {
        role: "user",
        content: payload.userPrompt,
      },
    ],
  };

  if (!shouldOmitOpenAiTemperature(options.model)) {
    requestBody.temperature = 0.2;
  }

  return requestBody;
}

function validateCompositeHrReviewResult(value: unknown): CompositeHrReviewResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Composite HR reviewer returned invalid payload root.");
  }

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.approved !== "boolean") {
    throw new Error("Composite HR reviewer payload missing approved boolean.");
  }

  if (typeof candidate.summary !== "string" || candidate.summary.trim().length === 0) {
    throw new Error("Composite HR reviewer payload missing summary.");
  }

  if (!Array.isArray(candidate.issues)) {
    throw new Error("Composite HR reviewer payload missing issues array.");
  }

  const issues = candidate.issues.map((issue, index) => {
    if (!issue || typeof issue !== "object" || Array.isArray(issue)) {
      throw new Error(`Composite HR reviewer issue ${index} is invalid.`);
    }

    const candidateIssue = issue as Record<string, unknown>;

    if (typeof candidateIssue.code !== "string" || candidateIssue.code.trim().length === 0) {
      throw new Error(`Composite HR reviewer issue ${index} missing code.`);
    }

    if (candidateIssue.severity !== "blocking" && candidateIssue.severity !== "warning") {
      throw new Error(`Composite HR reviewer issue ${index} missing severity.`);
    }

    const severity: CompositeHrReviewIssue["severity"] = candidateIssue.severity;

    if (typeof candidateIssue.message !== "string" || candidateIssue.message.trim().length === 0) {
      throw new Error(`Composite HR reviewer issue ${index} missing message.`);
    }

    return {
      code: candidateIssue.code,
      severity,
      message: candidateIssue.message,
    };
  });

  return {
    approved: candidate.approved,
    issues,
    summary: candidate.summary,
  };
}

async function reviewCompositeHrOpenAiReport(
  input: CompositeHrInputSnapshot,
  snapshot: CompositeHrReportSnapshot,
  options: OpenAiCompositeHrProviderOptions,
): Promise<void> {
  const review = await reviewOpenAiCompositeHrReportForDiagnostic(input, snapshot, options);
  const boundary = classifyCompositeHrReviewerBoundary(review);

  if (boundary.hardIssues.length > 0) {
    const details = boundary.hardFailureReasons.length > 0
      ? boundary.hardFailureReasons.join("; ")
      : review.summary;
    throw new Error(`Composite HR reviewer rejected report: ${details}`);
  }
}

async function collectCompositeHrReviewerDiagnostic(
  input: CompositeHrInputSnapshot,
  snapshot: CompositeHrReportSnapshot,
  options: OpenAiCompositeHrProviderOptions,
): Promise<void> {
  try {
    await reviewOpenAiCompositeHrReportForDiagnostic(input, snapshot, options);
  } catch {
    // Reviewer remains a diagnostic-only signal for Composite HR and must not block persistence.
  }
}

export async function reviewOpenAiCompositeHrReportForDiagnostic(
  input: CompositeHrInputSnapshot,
  snapshot: CompositeHrReportSnapshot,
  options: OpenAiCompositeHrProviderOptions,
): Promise<CompositeHrReviewResult> {
  const rawReview = await requestOpenAiStructuredJson(options, {
    label: "composite HR report review",
    schemaName: "composite_hr_report_review_v1",
    schema: compositeHrReviewOpenAiSchema as Record<string, unknown>,
    systemPrompt: buildCompositeHrReviewerSystemPrompt(),
    userPrompt: buildCompositeHrReviewerUserPrompt(input, snapshot),
  });

  return validateCompositeHrReviewResult(rawReview);
}

export const compositeHrReportOpenAiSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "contractVersion",
    "reportType",
    "audience",
    "sourceType",
    "locale",
    "generatedFor",
    "source",
    "summary",
    "integratedSignals",
    "interviewGuidance",
    "onboardingGuidance",
    "limitations",
    "metadata",
  ],
  properties: {
    contractVersion: {
      type: "string",
      const: COMPOSITE_HR_REPORT_CONTRACT_VERSION,
    },
    reportType: {
      type: "string",
      const: COMPOSITE_HR_REPORT_TYPE,
    },
    audience: {
      type: "string",
      const: COMPOSITE_HR_REPORT_AUDIENCE,
    },
    sourceType: {
      type: "string",
      const: COMPOSITE_HR_REPORT_SOURCE_TYPE,
    },
    locale: {
      type: "string",
      minLength: 1,
    },
    generatedFor: {
      type: "object",
      additionalProperties: false,
      required: ["organizationId", "participantId", "assessmentAssignmentId"],
      properties: {
        organizationId: { type: "string", minLength: 1 },
        participantId: { type: "string", minLength: 1 },
        assessmentAssignmentId: { type: "string", minLength: 1 },
      },
    },
    source: {
      type: "object",
      additionalProperties: false,
      required: ["inputContractVersion", "sourceAttemptIds", "testSlugs"],
      properties: {
        inputContractVersion: { type: "string", minLength: 1 },
        sourceAttemptIds: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
        testSlugs: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
      },
    },
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "profileOverview", "keyStrengths", "watchouts"],
      properties: {
        headline: { type: "string", minLength: 1 },
        profileOverview: { type: "string", minLength: 1 },
        keyStrengths: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
        watchouts: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
      },
    },
    integratedSignals: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "body", "evidence"],
        properties: {
          id: { type: "string", minLength: 1 },
          title: { type: "string", minLength: 1 },
          body: { type: "string", minLength: 1 },
          evidence: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["testSlug", "label", "value"],
              properties: {
                testSlug: { type: "string", minLength: 1 },
                label: { type: "string", minLength: 1 },
                value: { type: "string", minLength: 1 },
              },
            },
          },
        },
      },
    },
    interviewGuidance: {
      type: "object",
      additionalProperties: false,
      required: ["focusAreas"],
      properties: {
        focusAreas: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "rationale", "questions"],
            properties: {
              title: { type: "string", minLength: 1 },
              rationale: { type: "string", minLength: 1 },
              questions: {
                type: "array",
                minItems: 1,
                items: { type: "string", minLength: 1 },
              },
            },
          },
        },
      },
    },
    onboardingGuidance: {
      type: "object",
      additionalProperties: false,
      required: ["managementTips", "supportNeeds"],
      properties: {
        managementTips: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
        supportNeeds: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
      },
    },
    limitations: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 1 },
    },
    metadata: {
      type: "object",
      additionalProperties: false,
      required: ["provider", "providerVersion", "generatedAt"],
      properties: {
        provider: { type: "string", minLength: 1 },
        providerVersion: { type: "string", minLength: 1 },
        generatedAt: { type: "string", minLength: 1 },
      },
    },
  },
} as const satisfies Record<string, unknown>;

async function requestOpenAiStructuredJson(
  options: OpenAiCompositeHrProviderOptions,
  payload: {
    label: string;
    schemaName: string;
    schema: Record<string, unknown>;
    systemPrompt: string;
    userPrompt: string;
  },
): Promise<unknown> {
  if (!options.apiKey) {
    throw new Error("Missing required env var: OPENAI_API_KEY");
  }

  if (!options.model) {
    throw new Error("Missing required env var: AI_REPORT_MODEL");
  }

  const timeoutMs = options.timeoutMs ?? 120000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(
    () =>
      controller.abort(
        new Error(`OpenAI composite HR report timed out after ${timeoutMs}ms.`),
      ),
    timeoutMs,
  );

  try {
    const requestBody = buildCompositeHrOpenAiChatCompletionsRequestBody(payload, options);

    const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI composite HR report request failed with status ${response.status}: ${errorText}`,
      );
    }

    const responsePayload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = responsePayload.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      throw new Error(`OpenAI ${payload.label} response did not contain structured content.`);
    }

    return parseStructuredContent(content);
  } catch (error) {
    const normalizedError = error instanceof Error ? (error as ErrorWithCause) : null;
    throw new Error(
      `OpenAI ${payload.label} failed: ${normalizedError?.message ?? String(error)}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateOpenAiCompositeHrReport(
  input: CompositeHrInputSnapshot,
  options: OpenAiCompositeHrProviderOptions,
): Promise<CompositeHrReportSnapshot> {
  const rawReport = await requestOpenAiCompositeHrReportRaw(input, options);

  const initialValidation = validateCompositeHrReportSnapshot(rawReport);

  if (!initialValidation.ok) {
    throw new Error(
      `OpenAI composite HR report failed validation: ${formatCompositeHrReportValidationErrors(initialValidation.errors)}`,
    );
  }

  const lockedReport = applyLockedCompositeEvidenceValues(initialValidation.value, input);
  const lockedValidation = validateCompositeHrReportSnapshot(lockedReport);

  if (!lockedValidation.ok) {
    throw new Error(
      `OpenAI composite HR report failed evidence-locked validation: ${formatCompositeHrReportValidationErrors(lockedValidation.errors)}`,
    );
  }

  assertImmutableSource(lockedValidation.value, input);
  assertLockedCompositeEvidenceIntegrity(lockedValidation.value, input);

  const normalizedReport: CompositeHrReportSnapshot = {
    ...lockedValidation.value,
    metadata: {
      provider: COMPOSITE_HR_REPORT_OPENAI_PROVIDER,
      providerVersion: COMPOSITE_HR_REPORT_OPENAI_PROVIDER_VERSION,
      generatedAt: options.now?.() ?? new Date().toISOString(),
    },
  };
  const normalizedValidation = validateCompositeHrReportSnapshot(normalizedReport);

  if (!normalizedValidation.ok) {
    throw new Error(
      `OpenAI composite HR report failed normalized validation: ${formatCompositeHrReportValidationErrors(normalizedValidation.errors)}`,
    );
  }

  await collectCompositeHrReviewerDiagnostic(input, normalizedValidation.value, options);

  return normalizedValidation.value;
}

export async function requestOpenAiCompositeHrReportRaw(
  input: CompositeHrInputSnapshot,
  options: OpenAiCompositeHrProviderOptions,
): Promise<unknown> {
  return requestOpenAiStructuredJson(options, buildOpenAiCompositeHrReportRequestPayload(input));
}

function formatDiagnosticError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function buildCompositeHrBoundaryDiagnostic(
  input: CompositeHrInputSnapshot,
  persistedReportSnapshot?: unknown | null,
): CompositeHrBoundaryDiagnostic {
  const validationInventory: CompositeHrBoundaryInventoryItem[] = [
    {
      id: "report_contract_shape",
      category: "data_contract_blocking",
      recommendedBlocking: true,
      currentProductionBehavior: "The production provider validates the Composite HR report contract before persistence.",
      futureStrictReferenceRequirement: null,
    },
    {
      id: "immutable_source_identity",
      category: "deterministic_reference_blocking",
      recommendedBlocking: true,
      currentProductionBehavior: "The production provider compares source attempts, test slugs, generatedFor identifiers, locale and input contract version.",
      futureStrictReferenceRequirement: "Keep exact equality against the production CompositeHrInputSnapshot.",
    },
    {
      id: "locked_evidence_integrity",
      category: "evidence_integrity_blocking",
      recommendedBlocking: true,
      currentProductionBehavior: "The production provider validates evidence after applying locked evidence values.",
      futureStrictReferenceRequirement: "Validate raw AI evidence against deterministic catalog entries before any rewrite.",
    },
    {
      id: "prose_style_heuristics",
      category: "prose_style_diagnostic_only",
      recommendedBlocking: false,
      currentProductionBehavior: "Some prose, addressing-form and hard-safety string heuristics currently block the production provider.",
      futureStrictReferenceRequirement: null,
    },
    {
      id: "bhs_language_quality",
      category: "bhs_language_diagnostic_only",
      recommendedBlocking: false,
      currentProductionBehavior: "Selected BHS language-quality findings currently block the production provider.",
      futureStrictReferenceRequirement: null,
    },
    {
      id: "openai_reviewer_quality",
      category: "reviewer_quality_diagnostic_only",
      recommendedBlocking: false,
      currentProductionBehavior: "The production provider calls an AI reviewer and can reject the report.",
      futureStrictReferenceRequirement: null,
    },
    {
      id: "locked_evidence_value_rewrite",
      category: "mutation_or_rewrite_risk",
      recommendedBlocking: false,
      currentProductionBehavior: "The production provider rewrites matching evidence labels and values from the locked deterministic catalog before persistence.",
      futureStrictReferenceRequirement: "Define exact allowed evidence references and reject raw mismatches instead of repairing them.",
    },
    {
      id: "provider_metadata_rewrite",
      category: "mutation_or_rewrite_risk",
      recommendedBlocking: false,
      currentProductionBehavior: "The production provider replaces provider metadata and generatedAt before persistence.",
      futureStrictReferenceRequirement: "Separate provider-owned metadata from AI-owned report content in the strict reference contract.",
    },
  ];
  const diagnosticOnlyCategories: CompositeHrBoundaryCategory[] = [
    "prose_style_diagnostic_only",
    "bhs_language_diagnostic_only",
    "reviewer_quality_diagnostic_only",
  ];
  const blockingCandidates: CompositeHrBoundaryCategory[] = [
    "data_contract_blocking",
    "deterministic_reference_blocking",
    "evidence_integrity_blocking",
  ];
  const persistedSnapshotEvaluation: CompositeHrBoundaryDiagnostic["persistedSnapshotEvaluation"] = {
    contract: { status: "not_evaluated", findings: [] },
    deterministicReference: { status: "not_evaluated", findings: [] },
    evidenceIntegrity: { status: "not_evaluated", findings: [] },
  };
  let reportSnapshotStatus: CompositeHrBoundaryDiagnostic["reportSnapshotStatus"] =
    "not_evaluated_no_report_snapshot";

  if (persistedReportSnapshot !== undefined && persistedReportSnapshot !== null) {
    const validation = validateCompositeHrReportSnapshot(persistedReportSnapshot);

    if (!validation.ok) {
      reportSnapshotStatus = "invalid_report_snapshot";
      persistedSnapshotEvaluation.contract = {
        status: "fail",
        findings: validation.errors,
      };
    } else {
      reportSnapshotStatus = "evaluated";
      persistedSnapshotEvaluation.contract = { status: "pass", findings: [] };

      try {
        assertImmutableSource(validation.value, input);
        persistedSnapshotEvaluation.deterministicReference = { status: "pass", findings: [] };
      } catch (error) {
        persistedSnapshotEvaluation.deterministicReference = {
          status: "fail",
          findings: [formatDiagnosticError(error)],
        };
      }

      try {
        assertLockedCompositeEvidenceIntegrity(validation.value, input);
        persistedSnapshotEvaluation.evidenceIntegrity = { status: "pass", findings: [] };
      } catch (error) {
        persistedSnapshotEvaluation.evidenceIntegrity = {
          status: "fail",
          findings: [formatDiagnosticError(error)],
        };
      }
    }
  }

  return {
    mode: "read_only_dev_diagnostic",
    reportSnapshotStatus,
    productionBehaviorChanged: false,
    validationInventory,
    dataOnlyReadiness: {
      status: "not_ready",
      blockingCandidates,
      diagnosticOnlyCategories,
      reasons: [
        "Production still hard-blocks prose, BHS language and AI reviewer heuristics.",
        "Raw AI evidence is repaired through locked evidence mutation before persistence.",
        "A future strict boundary must validate raw deterministic references without canonicalization or repair.",
      ],
    },
    persistedSnapshotEvaluation,
    diagnosticOnlyCategories,
    mutationRiskInventory: validationInventory.filter(
      (item) => item.category === "mutation_or_rewrite_risk",
    ),
  };
}

function buildCompositeHrDataOnlyReferenceFindings(
  input: CompositeHrInputSnapshot,
  snapshot: CompositeHrReportSnapshot,
): CompositeHrDataOnlyShadowFinding[] {
  const findings: CompositeHrDataOnlyShadowFinding[] = [];
  const catalog = buildLockedCompositeEvidenceCatalog(input);
  const catalogByKey = new Map(
    catalog.map((entry) => [normalizeEvidenceKey(entry.testSlug, entry.label), entry]),
  );

  if (snapshot.integratedSignals.length === 0) {
    findings.push({
      code: "MISSING_REQUIRED_INTEGRATED_SIGNALS",
      category: "data_contract_blocking",
      message: "Composite HR report has no integrated signals with deterministic evidence references.",
      path: "integratedSignals",
    });
  }

  snapshot.integratedSignals.forEach((signal, signalIndex) => {
    if (signal.evidence.length === 0) {
      findings.push({
        code: "MISSING_DETERMINISTIC_EVIDENCE_REFERENCE",
        category: "evidence_integrity_blocking",
        message: "Integrated signal has no deterministic evidence reference.",
        path: `integratedSignals[${signalIndex}].evidence`,
      });
    }

    signal.evidence.forEach((evidence, evidenceIndex) => {
      const path = `integratedSignals[${signalIndex}].evidence[${evidenceIndex}]`;
      const expected = catalogByKey.get(normalizeEvidenceKey(evidence.testSlug, evidence.label));

      if (!expected) {
        findings.push({
          code: "INVENTED_OR_UNKNOWN_EVIDENCE_REFERENCE",
          category: "evidence_integrity_blocking",
          message: `Evidence ${evidence.testSlug}/${evidence.label} does not match a deterministic reference anchor.`,
          path,
        });
        return;
      }

      if (evidence.value !== expected.value) {
        findings.push({
          code: "DETERMINISTIC_EVIDENCE_VALUE_MISMATCH",
          category: "evidence_integrity_blocking",
          message: `Expected "${expected.value}" from ${expected.sourcePath}, received "${evidence.value}".`,
          path: `${path}.value`,
        });
      }
    });
  });

  return findings;
}

export function compareCompositeHrDataOnlyValidationShadow(
  input: CompositeHrInputSnapshot,
  persistedReportSnapshot?: unknown | null,
  boundaryDiagnostic?: CompositeHrBoundaryDiagnostic,
): CompositeHrDataOnlyShadowResult {
  const diagnostic =
    boundaryDiagnostic ?? buildCompositeHrBoundaryDiagnostic(input, persistedReportSnapshot);
  const dataOnlyBlockingCategories: CompositeHrBoundaryCategory[] = [
    "data_contract_blocking",
    "deterministic_reference_blocking",
    "evidence_integrity_blocking",
  ];
  const diagnosticOnlyCategories: CompositeHrBoundaryCategory[] = [
    "prose_style_diagnostic_only",
    "bhs_language_diagnostic_only",
    "reviewer_quality_diagnostic_only",
  ];
  const blockingFindings: CompositeHrDataOnlyShadowFinding[] = [];
  const referenceIntegrityFindings: CompositeHrDataOnlyShadowFinding[] = [];
  const proseStyleFindings: CompositeHrDataOnlyShadowFinding[] = [];
  const bhsLanguageFindings: CompositeHrDataOnlyShadowFinding[] = [];
  const reviewerQualityFindings: CompositeHrDataOnlyShadowFinding[] = [
    {
      code: "AI_REVIEWER_NOT_RUN_IN_SHADOW",
      category: "reviewer_quality_diagnostic_only",
      message: "Reviewer quality is diagnostic-only and was not evaluated because this shadow comparator makes no OpenAI call.",
    },
  ];
  const mutationRiskFindings: CompositeHrDataOnlyShadowFinding[] =
    diagnostic.mutationRiskInventory.map((item) => ({
      code: item.id.toUpperCase(),
      category: "mutation_or_rewrite_risk",
      message: `${item.currentProductionBehavior} Future plan: ${item.futureStrictReferenceRequirement ?? "Document ownership before a production switch."}`,
    }));
  mutationRiskFindings.push({
    code: "RENDERER_DISPLAY_STRING_SANITIZATION",
    category: "renderer_display_rewrite_risk",
    message: "Composite HR display view model sanitizes selected visible strings before rendering; this comparator does not call or change that layer.",
  });

  const notEvaluatedReasons: string[] = [];

  if (persistedReportSnapshot === undefined || persistedReportSnapshot === null) {
    notEvaluatedReasons.push("No persisted/current Composite HR report snapshot was provided.");
  } else {
    const validation = validateCompositeHrReportSnapshot(persistedReportSnapshot);

    if (!validation.ok) {
      blockingFindings.push(
        ...validation.errors.map((message) => ({
          code: "REPORT_CONTRACT_INVALID",
          category: "data_contract_blocking" as const,
          message,
        })),
      );
    } else {
      try {
        assertImmutableSource(validation.value, input);
      } catch (error) {
        const findings = [
          {
            code: "DETERMINISTIC_SOURCE_MISMATCH",
            category: "deterministic_reference_blocking" as const,
            message: formatDiagnosticError(error),
          },
        ];
        blockingFindings.push(...findings);
        referenceIntegrityFindings.push(...findings);
      }

      const evidenceFindings = buildCompositeHrDataOnlyReferenceFindings(input, validation.value);
      blockingFindings.push(...evidenceFindings);
      referenceIntegrityFindings.push(...evidenceFindings);

      const languageQuality = validateReportLanguageQuality({
        snapshot: validation.value,
        locale: validation.value.locale,
        audience: "hr",
        reportType: "composite",
        context: "composite_hr_report",
      });
      const bhsCodes = new Set<ReportLanguageQualityIssue["code"]>([
        "FORBIDDEN_TERM",
        "GLOSSARY_VIOLATION",
        "NARRATIVE_CASING_VIOLATION",
        "FORBIDDEN_SCRIPT",
      ]);

      for (const issue of languageQuality.issues) {
        const finding: CompositeHrDataOnlyShadowFinding = {
          code: issue.code,
          category: bhsCodes.has(issue.code)
            ? "bhs_language_diagnostic_only"
            : "prose_style_diagnostic_only",
          message: issue.suggestion
            ? `${issue.phrase} -> ${issue.suggestion}`
            : issue.phrase,
          path: issue.path,
        };

        if (finding.category === "bhs_language_diagnostic_only") {
          bhsLanguageFindings.push(finding);
        } else {
          proseStyleFindings.push(finding);
        }
      }

      for (const issue of collectCompositeHrHardSafetyIssues(validation.value)) {
        proseStyleFindings.push({
          code: issue.code,
          category: "prose_style_diagnostic_only",
          message: issue.phrase,
          path: issue.path,
        });
      }

      try {
        assertAddressingFormConsistency(validation.value, input);
      } catch (error) {
        proseStyleFindings.push({
          code: "ADDRESSING_FORM_WORDING",
          category: "prose_style_diagnostic_only",
          message: formatDiagnosticError(error),
        });
      }
    }
  }

  const diagnosticOnlyFindings = [
    ...proseStyleFindings,
    ...bhsLanguageFindings,
    ...reviewerQualityFindings,
  ];
  const wouldPassDataOnlyBlockingValidation =
    notEvaluatedReasons.length > 0
      ? "not_evaluated"
      : blockingFindings.length === 0;

  return {
    shadowMode: true,
    productionBehaviorChanged: false,
    wouldPassDataOnlyBlockingValidation,
    dataOnlyBlockingCategories,
    diagnosticOnlyCategories,
    blockingFindings,
    diagnosticOnlyFindings,
    mutationRiskFindings,
    referenceIntegrityFindings,
    proseStyleFindings,
    bhsLanguageFindings,
    reviewerQualityFindings,
    notEvaluatedReasons,
  };
}

export function evaluateCompositeHrReportValidatorBoundary(
  input: CompositeHrInputSnapshot,
  rawReport: unknown,
  options?: {
    now?: () => string;
  },
): CompositeHrValidatorBoundaryDiagnostic {
  const failureReasons: string[] = [];
  const initialValidation = validateCompositeHrReportSnapshot(rawReport);
  const contractValidationResult = initialValidation.ok
    ? { ok: true as const, errors: [] }
    : { ok: false as const, errors: initialValidation.errors };

  if (!initialValidation.ok) {
    failureReasons.push(
      `contract validation failed: ${formatCompositeHrReportValidationErrors(initialValidation.errors)}`,
    );

    return {
      rawParsedOutput: rawReport,
      canonicalizedOutput: null,
      contractValidationResult,
      evidenceLockedValidationResult: {
        ok: false,
        skipped: true,
        reason: "Initial contract validation failed.",
        errors: [],
      },
      sourceIntegrityResult: { skipped: true, reason: "Initial contract validation failed." },
      evidenceIntegrityResult: { skipped: true, reason: "Initial contract validation failed." },
      languageQualityResult: { skipped: true, reason: "Initial contract validation failed." },
      languageQualityHardIssues: [],
      languageQualityWarnings: [],
      hardSafetyResult: { skipped: true, reason: "Initial contract validation failed." },
      addressingFormResult: { skipped: true, reason: "Initial contract validation failed." },
      normalizedValidationResult: { skipped: true, reason: "Initial contract validation failed." },
      hardGateWouldPersist: false,
      validatorOnWouldPersist: false,
      failureReasons,
    };
  }

  const lockedReport = applyLockedCompositeEvidenceValues(initialValidation.value, input);
  const lockedValidation = validateCompositeHrReportSnapshot(lockedReport);
  const evidenceLockedValidationResult = lockedValidation.ok
    ? { ok: true as const, errors: [] }
    : { ok: false as const, errors: lockedValidation.errors };

  if (!lockedValidation.ok) {
    failureReasons.push(
      `evidence-locked validation failed: ${formatCompositeHrReportValidationErrors(lockedValidation.errors)}`,
    );

    return {
      rawParsedOutput: rawReport,
      canonicalizedOutput: null,
      contractValidationResult,
      evidenceLockedValidationResult,
      sourceIntegrityResult: { skipped: true, reason: "Evidence-locked validation failed." },
      evidenceIntegrityResult: { skipped: true, reason: "Evidence-locked validation failed." },
      languageQualityResult: { skipped: true, reason: "Evidence-locked validation failed." },
      languageQualityHardIssues: [],
      languageQualityWarnings: [],
      hardSafetyResult: { skipped: true, reason: "Evidence-locked validation failed." },
      addressingFormResult: { skipped: true, reason: "Evidence-locked validation failed." },
      normalizedValidationResult: { skipped: true, reason: "Evidence-locked validation failed." },
      hardGateWouldPersist: false,
      validatorOnWouldPersist: false,
      failureReasons,
    };
  }

  let sourceIntegrityResult: CompositeHrValidatorBoundaryDiagnostic["sourceIntegrityResult"] = {
    ok: true,
    error: null,
  };

  try {
    assertImmutableSource(lockedValidation.value, input);
  } catch (error) {
    sourceIntegrityResult = { ok: false, error: formatDiagnosticError(error) };
    failureReasons.push(`source integrity failed: ${sourceIntegrityResult.error}`);
  }

  let evidenceIntegrityResult: CompositeHrValidatorBoundaryDiagnostic["evidenceIntegrityResult"] = {
    ok: true,
    error: null,
  };

  try {
    assertLockedCompositeEvidenceIntegrity(lockedValidation.value, input);
  } catch (error) {
    evidenceIntegrityResult = { ok: false, error: formatDiagnosticError(error) };
    failureReasons.push(`locked evidence integrity failed: ${evidenceIntegrityResult.error}`);
  }

  const languageQualityResult = validateReportLanguageQuality({
    snapshot: lockedValidation.value,
    locale: lockedValidation.value.locale,
    audience: "hr",
    reportType: "composite",
    context: "composite_hr_report",
  });
  const languageQualityBoundary = classifyCompositeHrLanguageQualityResult(languageQualityResult);

  const hardSafetyIssues = collectCompositeHrHardSafetyIssues(lockedValidation.value);
  const hardSafetyResult = hardSafetyIssues.length === 0
    ? { ok: true as const, issues: [] }
    : { ok: false as const, issues: hardSafetyIssues };

  let addressingFormResult: CompositeHrValidatorBoundaryDiagnostic["addressingFormResult"] = {
    ok: true,
    error: null,
  };

  try {
    assertAddressingFormConsistency(lockedValidation.value, input);
  } catch (error) {
    addressingFormResult = { ok: false, error: formatDiagnosticError(error) };
  }

  const normalizedReport: CompositeHrReportSnapshot = {
    ...lockedValidation.value,
    metadata: {
      provider: COMPOSITE_HR_REPORT_OPENAI_PROVIDER,
      providerVersion: COMPOSITE_HR_REPORT_OPENAI_PROVIDER_VERSION,
      generatedAt: options?.now?.() ?? new Date().toISOString(),
    },
  };
  const normalizedValidation = validateCompositeHrReportSnapshot(normalizedReport);
  const normalizedValidationResult = normalizedValidation.ok
    ? { ok: true as const, errors: [] }
    : { ok: false as const, errors: normalizedValidation.errors };

  if (!normalizedValidation.ok) {
    failureReasons.push(
      `normalized validation failed: ${formatCompositeHrReportValidationErrors(normalizedValidation.errors)}`,
    );
  }

  const hardGateWouldPersist =
    sourceIntegrityResult.ok === true &&
    evidenceIntegrityResult.ok === true &&
    normalizedValidation.ok;

  return {
    rawParsedOutput: rawReport,
    canonicalizedOutput: normalizedValidation.ok ? normalizedValidation.value : normalizedReport,
    contractValidationResult,
    evidenceLockedValidationResult,
    sourceIntegrityResult,
    evidenceIntegrityResult,
    languageQualityResult,
    languageQualityHardIssues: languageQualityBoundary.hardIssues,
    languageQualityWarnings: languageQualityBoundary.warnings,
    hardSafetyResult,
    addressingFormResult,
    normalizedValidationResult,
    hardGateWouldPersist,
    validatorOnWouldPersist: hardGateWouldPersist,
    failureReasons,
  };
}
