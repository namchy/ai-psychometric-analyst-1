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
  assertReportLanguageQuality,
  COMPOSITE_HR_BHS_GLOSSARY_PROMPT,
  COMPOSITE_HR_BHS_LANGUAGE_RULES,
  COMPOSITE_HR_BHS_REVIEWER_RULES,
} from "@/lib/assessment/report-language-quality";

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

type CompositeHrReviewIssue = {
  code: string;
  severity: "blocking" | "warning";
  message: string;
};

type CompositeHrReviewResult = {
  approved: boolean;
  issues: CompositeHrReviewIssue[];
  summary: string;
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
      ],
      structure_rules: [
        "summary.headline should be one short HR-facing headline.",
        "summary.profileOverview should be a short executive HR conclusion, not a generic description of assessment results.",
        "summary.profileOverview should usually contain 2 or 3 short sentences, not one overloaded sentence.",
        "The first sentence should state the main integrated work signal in a style such as: 'Najvažniji radni signal je...'.",
        "The second sentence should state what HR should verify first in interview in a style such as: 'U intervjuu prvo provjerite...'.",
        "The optional third sentence should explain how HR should use the finding in interview, role-scoping or onboarding in a style such as: 'Ovaj nalaz je najkorisnije koristiti za...'.",
        "summary.keyStrengths should contain 2 to 4 concise items.",
        "summary.watchouts should contain 2 to 4 concrete verification priorities, not passive cautions.",
        "summary.watchouts should prefer action formulations such as: 'U intervjuu direktno provjerite...', 'Prvo razjasnite...' or 'Posebno provjerite kroz primjer...'.",
        "Avoid passive watchout openings such as 'Područje za dodatnu provjeru je...' or 'Vrijedi provjeriti...' unless the sentence gives a specific action, context and behaviour to verify.",
        "integratedSignals should contain 3 to 5 items with evidence arrays tied to real tests from the input.",
        "Each integratedSignals item should make the body useful for HR: explain what the signal likely means in work and what HR should verify next.",
        "In integratedSignals.body, include a concrete verification angle, such as a behavioural example to request, a working condition to clarify or a tension to confirm/disconfirm.",
        "interviewGuidance.focusAreas should contain 2 to 4 items with practical questions.",
        "interviewGuidance questions should be direct, ready to ask and include what HR should listen for when the existing field allows it naturally.",
        "onboardingGuidance.managementTips should contain 2 to 4 items.",
        "onboardingGuidance.supportNeeds should contain 2 to 4 items.",
        "onboardingGuidance should give concrete manager actions: in the first weeks agree priorities, define quality criteria, set expectation rhythm, check progress weekly, give autonomy where the signal supports it and add structure where friction may appear.",
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
  const rawReview = await requestOpenAiStructuredJson(options, {
    label: "composite HR report review",
    schemaName: "composite_hr_report_review_v1",
    schema: compositeHrReviewOpenAiSchema as Record<string, unknown>,
    systemPrompt: buildCompositeHrReviewerSystemPrompt(),
    userPrompt: buildCompositeHrReviewerUserPrompt(input, snapshot),
  });

  const review = validateCompositeHrReviewResult(rawReview);

  if (!review.approved) {
    const details = review.issues.length > 0
      ? review.issues.map((issue) => `${issue.severity}:${issue.code}:${issue.message}`).join("; ")
      : review.summary;
    throw new Error(`Composite HR reviewer rejected report: ${details}`);
  }
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
    const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        temperature: 0.2,
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
      }),
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
  const rawReport = await requestOpenAiStructuredJson(options, {
    label: "composite HR report",
    schemaName: COMPOSITE_HR_REPORT_CONTRACT_VERSION,
    schema: compositeHrReportOpenAiSchema as Record<string, unknown>,
    systemPrompt: buildCompositeHrOpenAiSystemPrompt(input),
    userPrompt: buildCompositeHrOpenAiUserPrompt(input),
  });

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
  assertReportLanguageQuality({
    snapshot: lockedValidation.value,
    locale: lockedValidation.value.locale,
    audience: "hr",
    reportType: "composite",
    context: "composite_hr_report",
  });
  assertAddressingFormConsistency(lockedValidation.value, input);

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

  await reviewCompositeHrOpenAiReport(input, normalizedValidation.value, options);

  return normalizedValidation.value;
}
