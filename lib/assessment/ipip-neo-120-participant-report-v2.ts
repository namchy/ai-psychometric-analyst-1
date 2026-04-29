import {
  getIpipNeo120DomainLabel,
  getIpipNeo120FacetLabel,
  IPIP_NEO_120_DOMAIN_ORDER,
  IPIP_NEO_120_FACETS_BY_DOMAIN,
  IPIP_NEO_120_TEST_SLUG,
  type IpipNeo120DomainCode,
  type IpipNeo120FacetCode,
} from "./ipip-neo-120-labels";
import {
  getIpipNeo120BandMeaningV2,
  getIpipNeo120FacetDefinitionV2,
  getIpipNeo120DomainDefinitionV2,
  getIpipNeo120ParticipantDisplayBandForDomainV2,
  getIpipNeo120ParticipantDisplayBandLabelForDomainV2,
  getIpipNeo120ParticipantDisplayScoreForDomainV2,
  IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2,
  type IpipNeo120ParticipantBandV2,
} from "./ipip-neo-120-participant-ai-input-v2";

export type IpipNeo120ParticipantReportV2Badge = {
  label: string;
  related_domains: string[];
  related_facets: string[];
};

export type IpipNeo120ParticipantReportV2KeyPattern = {
  title: string;
  description: string;
  related_domains: string[];
  related_facets: string[];
};

export type IpipNeo120ParticipantReportV2Subdimension = {
  facet_code: string;
  label: string;
  participant_display_label: string;
  score: number;
  band: IpipNeo120ParticipantBandV2;
  band_label: string;
  card_title: string;
  summary: string;
  practical_signal: string;
  candidate_reflection: string;
};

export type IpipNeo120ParticipantReportV2Domain = {
  domain_code: string;
  label: string;
  participant_display_label: string;
  score: number;
  band: IpipNeo120ParticipantBandV2;
  band_label: string;
  display_score: number;
  display_band: IpipNeo120ParticipantBandV2;
  display_band_label: string;
  card_title: string;
  summary: string;
  practical_signal: string;
  candidate_reflection: string;
  strengths: [string, string];
  watchouts: [string, string];
  subdimensions: [
    IpipNeo120ParticipantReportV2Subdimension,
    IpipNeo120ParticipantReportV2Subdimension,
    IpipNeo120ParticipantReportV2Subdimension,
    IpipNeo120ParticipantReportV2Subdimension,
    IpipNeo120ParticipantReportV2Subdimension,
    IpipNeo120ParticipantReportV2Subdimension,
  ];
  development_tip: string;
};

export type IpipNeo120ParticipantReportV2LinkedItem = {
  title: string;
  description: string;
  related_domains: string[];
  related_facets: string[];
};

export type IpipNeo120ParticipantReportV2WorkStyle = {
  title: string;
  paragraphs: [string, string];
};

export type IpipNeo120ParticipantReportV2InterpretationNote = {
  title: string;
  text: string;
};

export type IpipNeo120ParticipantReportV2Summary = {
  headline: string;
  overview: string;
  badges: [
    IpipNeo120ParticipantReportV2Badge,
    IpipNeo120ParticipantReportV2Badge,
    IpipNeo120ParticipantReportV2Badge,
  ];
};

export type IpipNeo120ParticipantReportV2 = {
  contract_version: "ipip_neo_120_participant_v2";
  test: {
    slug: "ipip-neo-120-v1";
    name: string | null;
    locale: string;
  };
  meta: {
    report_type: "participant";
    generated_at: string;
    scale_hint: {
      min: number;
      max: number;
    };
  };
  summary: IpipNeo120ParticipantReportV2Summary;
  key_patterns: [
    IpipNeo120ParticipantReportV2KeyPattern,
    IpipNeo120ParticipantReportV2KeyPattern,
    IpipNeo120ParticipantReportV2KeyPattern,
  ];
  domains: [
    IpipNeo120ParticipantReportV2Domain,
    IpipNeo120ParticipantReportV2Domain,
    IpipNeo120ParticipantReportV2Domain,
    IpipNeo120ParticipantReportV2Domain,
    IpipNeo120ParticipantReportV2Domain,
  ];
  strengths: [
    IpipNeo120ParticipantReportV2LinkedItem,
    IpipNeo120ParticipantReportV2LinkedItem,
    IpipNeo120ParticipantReportV2LinkedItem,
    IpipNeo120ParticipantReportV2LinkedItem,
  ];
  watchouts: [
    IpipNeo120ParticipantReportV2LinkedItem,
    IpipNeo120ParticipantReportV2LinkedItem,
    IpipNeo120ParticipantReportV2LinkedItem,
  ];
  work_style: IpipNeo120ParticipantReportV2WorkStyle;
  development_recommendations: [
    IpipNeo120ParticipantReportV2LinkedItem & { action: string },
    IpipNeo120ParticipantReportV2LinkedItem & { action: string },
    IpipNeo120ParticipantReportV2LinkedItem & { action: string },
    IpipNeo120ParticipantReportV2LinkedItem & { action: string },
  ];
  interpretation_note: IpipNeo120ParticipantReportV2InterpretationNote;
};

export type IpipNeo120ParticipantReportV2ValidationResult =
  | { ok: true; value: IpipNeo120ParticipantReportV2 }
  | { ok: false; errors: string[] };

type UnknownRecord = Record<string, unknown>;

const VALID_BANDS = new Set<IpipNeo120ParticipantBandV2>([
  "lower",
  "balanced",
  "higher",
]);
const VALID_DOMAIN_CODES = new Set<string>(IPIP_NEO_120_DOMAIN_ORDER);
const VALID_FACET_CODES = new Set<string>(
  Object.values(IPIP_NEO_120_FACETS_BY_DOMAIN).flat(),
);
const CANDIDATE_REFLECTION_FORBIDDEN_PREFIXES = [
  "kako ",
  "šta ",
  "kada ",
  "gdje ",
  "zašto ",
  "na koji način ",
  "da li ",
  "možeš li ",
  "možete li ",
] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateArrayLength(
  value: unknown,
  path: string,
  expectedLength: number,
  errors: string[],
): value is unknown[] {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  if (value.length !== expectedLength) {
    errors.push(`${path}: Expected exactly ${expectedLength} items.`);
  }

  return true;
}

function validateRequiredString(value: unknown, path: string, errors: string[]): void {
  if (!isNonEmptyString(value)) {
    errors.push(`${path}: Expected non-empty string.`);
  }
}

function validateRequiredNumber(value: unknown, path: string, errors: string[]): void {
  if (!isNumber(value)) {
    errors.push(`${path}: Expected number.`);
  }
}

export function isDeclarativeCandidateReflection(text: string): boolean {
  const normalized = text.trim();

  if (normalized.length === 0 || normalized.endsWith("?")) {
    return false;
  }

  const sentenceBreaks = normalized.match(/[.!?]/g);

  if (sentenceBreaks && sentenceBreaks.length > 1) {
    return false;
  }

  const lower = normalized.toLocaleLowerCase("bs");

  return !CANDIDATE_REFLECTION_FORBIDDEN_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function validateCandidateReflection(value: unknown, path: string, errors: string[]): void {
  validateRequiredString(value, path, errors);

  if (typeof value === "string" && !isDeclarativeCandidateReflection(value)) {
    errors.push(`${path}: candidate_reflection must be a declarative sentence, not a question`);
  }
}

function validateBand(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string" || !VALID_BANDS.has(value as IpipNeo120ParticipantBandV2)) {
    errors.push(`${path}: Expected lower, balanced, or higher.`);
  }
}

function validateBandLabel(
  band: unknown,
  bandLabel: unknown,
  path: string,
  errors: string[],
): void {
  if (typeof band !== "string" || !VALID_BANDS.has(band as IpipNeo120ParticipantBandV2)) {
    return;
  }

  const expectedLabel = getIpipNeo120BandMeaningV2(band)?.label;

  if (typeof bandLabel !== "string" || bandLabel !== expectedLabel) {
    errors.push(`${path}: Expected band_label ${expectedLabel ?? "(unknown)"}.`);
  }
}

function validateParticipantDisplayBandFields(
  domainCode: string,
  score: unknown,
  band: unknown,
  bandLabel: unknown,
  displayScore: unknown,
  displayBand: unknown,
  displayBandLabel: unknown,
  path: string,
  errors: string[],
): void {
  if (
    typeof score !== "number" ||
    typeof band !== "string" ||
    !VALID_BANDS.has(band as IpipNeo120ParticipantBandV2)
  ) {
    return;
  }

  const expectedDisplayScore = getIpipNeo120ParticipantDisplayScoreForDomainV2(domainCode, score);
  const expectedDisplayBand = getIpipNeo120ParticipantDisplayBandForDomainV2(domainCode, band);
  const expectedDisplayBandLabel = getIpipNeo120ParticipantDisplayBandLabelForDomainV2(
    domainCode,
    band,
  );

  if (expectedDisplayScore === null || expectedDisplayBand === null || expectedDisplayBandLabel === null) {
    errors.push(`${path}: Expected participant display fields to be derivable.`);
    return;
  }

  if (displayScore !== expectedDisplayScore) {
    errors.push(`${path}.display_score: Expected ${expectedDisplayScore}.`);
  }

  if (displayBand !== expectedDisplayBand) {
    errors.push(`${path}.display_band: Expected ${expectedDisplayBand}.`);
  }

  if (displayBandLabel !== expectedDisplayBandLabel) {
    errors.push(`${path}.display_band_label: Expected ${expectedDisplayBandLabel}.`);
  }

  if (domainCode !== "NEUROTICISM") {
    if (displayScore !== score) {
      errors.push(`${path}.display_score: Expected display_score to equal canonical score.`);
    }

    if (displayBand !== band) {
      errors.push(`${path}.display_band: Expected display_band to equal canonical band.`);
    }

    if (displayBandLabel !== bandLabel) {
      errors.push(`${path}.display_band_label: Expected display_band_label to equal canonical band_label.`);
    }
  }
}

function validateRelatedCodes(
  item: UnknownRecord,
  path: string,
  errors: string[],
): void {
  const relatedDomains = item.related_domains;
  const relatedFacets = item.related_facets;

  if (Array.isArray(relatedDomains)) {
    relatedDomains.forEach((domainCode, index) => {
      if (typeof domainCode !== "string" || !VALID_DOMAIN_CODES.has(domainCode)) {
        errors.push(`${path}.related_domains[${index}]: Unknown domain code.`);
      }
    });
  } else {
    errors.push(`${path}.related_domains: Expected array.`);
  }

  if (Array.isArray(relatedFacets)) {
    relatedFacets.forEach((facetCode, index) => {
      if (typeof facetCode !== "string" || !VALID_FACET_CODES.has(facetCode)) {
        errors.push(`${path}.related_facets[${index}]: Unknown facet code.`);
      }
    });
  } else {
    errors.push(`${path}.related_facets: Expected array.`);
  }
}

function validateMaxChars(
  value: unknown,
  budgetKey: keyof typeof IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2,
  path: string,
  errors: string[],
): void {
  const maxChars = IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2[budgetKey].max_chars;

  if (typeof maxChars !== "number" || typeof value !== "string") {
    return;
  }

  if (value.length > maxChars) {
    errors.push(`${path}: Exceeds max_chars ${maxChars}.`);
  }
}

function validateLinkedItem(
  value: unknown,
  path: string,
  errors: string[],
  options: {
    titleBudgetKey: keyof typeof IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2;
    descriptionBudgetKey: keyof typeof IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2;
    actionBudgetKey?: keyof typeof IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2;
  },
): void {
  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return;
  }

  validateRequiredString(value.title, `${path}.title`, errors);
  validateRequiredString(value.description, `${path}.description`, errors);
  validateRelatedCodes(value, path, errors);
  validateMaxChars(value.title, options.titleBudgetKey, `${path}.title`, errors);
  validateMaxChars(value.description, options.descriptionBudgetKey, `${path}.description`, errors);

  if (options.actionBudgetKey) {
    validateRequiredString(value.action, `${path}.action`, errors);
    validateMaxChars(value.action, options.actionBudgetKey, `${path}.action`, errors);
  }
}

function validateBadge(value: unknown, index: number, errors: string[]): void {
  const path = `summary.badges[${index}]`;

  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return;
  }

  validateRequiredString(value.label, `${path}.label`, errors);
  validateRelatedCodes(value, path, errors);
  validateMaxChars(value.label, "summary.badges[].label", `${path}.label`, errors);
}

function validateKeyPattern(value: unknown, index: number, errors: string[]): void {
  const path = `key_patterns[${index}]`;

  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return;
  }

  validateRequiredString(value.title, `${path}.title`, errors);
  validateRequiredString(value.description, `${path}.description`, errors);
  validateRelatedCodes(value, path, errors);
  validateMaxChars(value.title, "key_patterns[].title", `${path}.title`, errors);
  validateMaxChars(value.description, "key_patterns[].description", `${path}.description`, errors);
}

function validateSubdimension(
  value: unknown,
  expectedFacetCode: string,
  path: string,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return;
  }

  if (value.facet_code !== expectedFacetCode) {
    errors.push(`${path}.facet_code: Expected ${expectedFacetCode}.`);
  }

  const canonicalLabel = getIpipNeo120FacetLabel(expectedFacetCode);
  const definition = getIpipNeo120FacetDefinitionV2(expectedFacetCode);

  if (value.label !== canonicalLabel) {
    errors.push(`${path}.label: Expected canonical label ${canonicalLabel ?? "(unknown)"}.`);
  }

  if (value.participant_display_label !== definition?.participant_display_label) {
    errors.push(
      `${path}.participant_display_label: Expected ${
        definition?.participant_display_label ?? "(unknown)"
      }.`,
    );
  }

  validateRequiredNumber(value.score, `${path}.score`, errors);
  validateBand(value.band, `${path}.band`, errors);
  validateRequiredString(value.band_label, `${path}.band_label`, errors);
  validateBandLabel(value.band, value.band_label, path, errors);
  validateRequiredString(value.card_title, `${path}.card_title`, errors);
  validateRequiredString(value.summary, `${path}.summary`, errors);
  validateRequiredString(value.practical_signal, `${path}.practical_signal`, errors);
  validateCandidateReflection(value.candidate_reflection, `${path}.candidate_reflection`, errors);
  validateMaxChars(value.card_title, "subdimensions[].card_title", `${path}.card_title`, errors);
  validateMaxChars(value.summary, "subdimensions[].summary", `${path}.summary`, errors);
  validateMaxChars(
    value.practical_signal,
    "subdimensions[].practical_signal",
    `${path}.practical_signal`,
    errors,
  );
  validateMaxChars(
    value.candidate_reflection,
    "subdimensions[].candidate_reflection",
    `${path}.candidate_reflection`,
    errors,
  );
}

function validateDomain(
  value: unknown,
  expectedDomainCode: IpipNeo120DomainCode,
  index: number,
  errors: string[],
): number {
  const path = `domains[${index}]`;

  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return 0;
  }

  if (value.domain_code !== expectedDomainCode) {
    errors.push(`${path}.domain_code: Expected ${expectedDomainCode}.`);
  }

  const canonicalLabel = getIpipNeo120DomainLabel(expectedDomainCode);
  const definition = getIpipNeo120DomainDefinitionV2(expectedDomainCode);

  if (value.label !== canonicalLabel) {
    errors.push(`${path}.label: Expected canonical label ${canonicalLabel ?? "(unknown)"}.`);
  }

  if (value.participant_display_label !== definition?.participant_display_label) {
    errors.push(
      `${path}.participant_display_label: Expected ${
        definition?.participant_display_label ?? "(unknown)"
      }.`,
    );
  }

  validateRequiredNumber(value.score, `${path}.score`, errors);
  validateBand(value.band, `${path}.band`, errors);
  validateRequiredString(value.band_label, `${path}.band_label`, errors);
  validateBandLabel(value.band, value.band_label, path, errors);
  validateRequiredNumber(value.display_score, `${path}.display_score`, errors);
  validateBand(value.display_band, `${path}.display_band`, errors);
  validateRequiredString(value.display_band_label, `${path}.display_band_label`, errors);
  validateParticipantDisplayBandFields(
    expectedDomainCode,
    value.score,
    value.band,
    value.band_label,
    value.display_score,
    value.display_band,
    value.display_band_label,
    path,
    errors,
  );
  validateRequiredString(value.card_title, `${path}.card_title`, errors);
  validateRequiredString(value.summary, `${path}.summary`, errors);
  validateRequiredString(value.practical_signal, `${path}.practical_signal`, errors);
  validateCandidateReflection(value.candidate_reflection, `${path}.candidate_reflection`, errors);
  validateRequiredString(value.development_tip, `${path}.development_tip`, errors);
  validateMaxChars(value.card_title, "domains[].card_title", `${path}.card_title`, errors);
  validateMaxChars(value.summary, "domains[].summary", `${path}.summary`, errors);
  validateMaxChars(
    value.practical_signal,
    "domains[].practical_signal",
    `${path}.practical_signal`,
    errors,
  );
  validateMaxChars(
    value.candidate_reflection,
    "domains[].candidate_reflection",
    `${path}.candidate_reflection`,
    errors,
  );
  validateMaxChars(
    value.development_tip,
    "domains[].development_tip",
    `${path}.development_tip`,
    errors,
  );

  if (validateArrayLength(value.strengths, `${path}.strengths`, 2, errors)) {
    value.strengths.forEach((strength, strengthIndex) => {
      validateRequiredString(strength, `${path}.strengths[${strengthIndex}]`, errors);
      validateMaxChars(
        strength,
        "domains[].strengths[]",
        `${path}.strengths[${strengthIndex}]`,
        errors,
      );
    });
  }

  if (validateArrayLength(value.watchouts, `${path}.watchouts`, 2, errors)) {
    value.watchouts.forEach((watchout, watchoutIndex) => {
      validateRequiredString(watchout, `${path}.watchouts[${watchoutIndex}]`, errors);
      validateMaxChars(
        watchout,
        "domains[].watchouts[]",
        `${path}.watchouts[${watchoutIndex}]`,
        errors,
      );
    });
  }

  if (!validateArrayLength(value.subdimensions, `${path}.subdimensions`, 6, errors)) {
    return 0;
  }

  const expectedFacets = IPIP_NEO_120_FACETS_BY_DOMAIN[expectedDomainCode];
  value.subdimensions.forEach((subdimension, subdimensionIndex) => {
    const expectedFacetCode = expectedFacets[subdimensionIndex];

    if (!expectedFacetCode) {
      return;
    }

    validateSubdimension(
      subdimension,
      expectedFacetCode,
      `${path}.subdimensions[${subdimensionIndex}]`,
      errors,
    );
  });

  return value.subdimensions.length;
}

export function validateIpipNeo120ParticipantReportV2(
  value: unknown,
): IpipNeo120ParticipantReportV2ValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["report: Expected object."] };
  }

  if (value.contract_version !== "ipip_neo_120_participant_v2") {
    errors.push("contract_version: Expected ipip_neo_120_participant_v2.");
  }

  if (isRecord(value.test)) {
    if (value.test.slug !== IPIP_NEO_120_TEST_SLUG) {
      errors.push(`test.slug: Expected ${IPIP_NEO_120_TEST_SLUG}.`);
    }

    if (!(typeof value.test.name === "string" || value.test.name === null)) {
      errors.push("test.name: Expected string or null.");
    }

    validateRequiredString(value.test.locale, "test.locale", errors);
  } else {
    errors.push("test: Expected object.");
  }

  if (isRecord(value.meta)) {
    if (value.meta.report_type !== "participant") {
      errors.push("meta.report_type: Expected participant.");
    }

    validateRequiredString(value.meta.generated_at, "meta.generated_at", errors);

    if (isRecord(value.meta.scale_hint)) {
      validateRequiredNumber(value.meta.scale_hint.min, "meta.scale_hint.min", errors);
      validateRequiredNumber(value.meta.scale_hint.max, "meta.scale_hint.max", errors);
    } else {
      errors.push("meta.scale_hint: Expected object.");
    }
  } else {
    errors.push("meta: Expected object.");
  }

  if (isRecord(value.summary)) {
    validateRequiredString(value.summary.headline, "summary.headline", errors);
    validateRequiredString(value.summary.overview, "summary.overview", errors);
    validateMaxChars(value.summary.headline, "summary.headline", "summary.headline", errors);
    validateMaxChars(value.summary.overview, "summary.overview", "summary.overview", errors);

    if (validateArrayLength(value.summary.badges, "summary.badges", 3, errors)) {
      value.summary.badges.forEach((badge, index) => validateBadge(badge, index, errors));
    }
  } else {
    errors.push("summary: Expected object.");
  }

  if (validateArrayLength(value.key_patterns, "key_patterns", 3, errors)) {
    value.key_patterns.forEach((pattern, index) => validateKeyPattern(pattern, index, errors));
  }

  let totalSubdimensions = 0;

  if (validateArrayLength(value.domains, "domains", 5, errors)) {
    value.domains.forEach((domain, index) => {
      const expectedDomainCode = IPIP_NEO_120_DOMAIN_ORDER[index];

      if (!expectedDomainCode) {
        return;
      }

      totalSubdimensions += validateDomain(domain, expectedDomainCode, index, errors);
    });
  }

  if (totalSubdimensions !== 30) {
    errors.push(`domains.subdimensions: Expected exactly 30 total subdimensions.`);
  }

  if (validateArrayLength(value.strengths, "strengths", 4, errors)) {
    value.strengths.forEach((strength, index) =>
      validateLinkedItem(strength, `strengths[${index}]`, errors, {
        titleBudgetKey: "strengths[].title",
        descriptionBudgetKey: "strengths[].description",
      }),
    );
  }

  if (validateArrayLength(value.watchouts, "watchouts", 3, errors)) {
    value.watchouts.forEach((watchout, index) =>
      validateLinkedItem(watchout, `watchouts[${index}]`, errors, {
        titleBudgetKey: "watchouts[].title",
        descriptionBudgetKey: "watchouts[].description",
      }),
    );
  }

  if (isRecord(value.work_style)) {
    validateRequiredString(value.work_style.title, "work_style.title", errors);
    validateMaxChars(value.work_style.title, "work_style.title", "work_style.title", errors);

    if (validateArrayLength(value.work_style.paragraphs, "work_style.paragraphs", 2, errors)) {
      value.work_style.paragraphs.forEach((paragraph, index) => {
        validateRequiredString(paragraph, `work_style.paragraphs[${index}]`, errors);
        validateMaxChars(
          paragraph,
          "work_style.paragraphs[]",
          `work_style.paragraphs[${index}]`,
          errors,
        );
      });
    }
  } else {
    errors.push("work_style: Expected object.");
  }

  if (
    validateArrayLength(value.development_recommendations, "development_recommendations", 4, errors)
  ) {
    value.development_recommendations.forEach((recommendation, index) =>
      validateLinkedItem(recommendation, `development_recommendations[${index}]`, errors, {
        titleBudgetKey: "development_recommendations[].title",
        descriptionBudgetKey: "development_recommendations[].description",
        actionBudgetKey: "development_recommendations[].action",
      }),
    );
  }

  if (isRecord(value.interpretation_note)) {
    validateRequiredString(value.interpretation_note.title, "interpretation_note.title", errors);
    validateRequiredString(value.interpretation_note.text, "interpretation_note.text", errors);
    validateMaxChars(
      value.interpretation_note.text,
      "interpretation_note.text",
      "interpretation_note.text",
      errors,
    );
  } else {
    errors.push("interpretation_note: Expected object.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: value as IpipNeo120ParticipantReportV2 };
}

export function formatIpipNeo120ParticipantReportV2ValidationErrors(
  errors: string[],
): string {
  return errors.map((error) => `- ${error}`).join("\n");
}

const nonEmptyStringSchema = {
  type: "string",
  minLength: 1,
} as const;

const relatedDomainsSchema = {
  type: "array",
  items: {
    type: "string",
    enum: IPIP_NEO_120_DOMAIN_ORDER,
  },
} as const;

const relatedFacetsSchema = {
  type: "array",
  items: {
    type: "string",
    enum: Object.values(IPIP_NEO_120_FACETS_BY_DOMAIN).flat(),
  },
} as const;

const linkedItemPropertiesSchema = {
  title: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
  related_domains: relatedDomainsSchema,
  related_facets: relatedFacetsSchema,
} as const;

const linkedItemRequired = [
  "title",
  "description",
  "related_domains",
  "related_facets",
] as const;

export const ipipNeo120ParticipantReportV2OpenAiSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "contract_version",
    "test",
    "meta",
    "summary",
    "key_patterns",
    "domains",
    "strengths",
    "watchouts",
    "work_style",
    "development_recommendations",
    "interpretation_note",
  ],
  properties: {
    contract_version: {
      type: "string",
      const: "ipip_neo_120_participant_v2",
    },
    test: {
      type: "object",
      additionalProperties: false,
      required: ["slug", "name", "locale"],
      properties: {
        slug: {
          type: "string",
          const: IPIP_NEO_120_TEST_SLUG,
        },
        name: {
          type: ["string", "null"],
        },
        locale: {
          type: "string",
        },
      },
    },
    meta: {
      type: "object",
      additionalProperties: false,
      required: ["report_type", "generated_at", "scale_hint"],
      properties: {
        report_type: {
          type: "string",
          const: "participant",
        },
        generated_at: nonEmptyStringSchema,
        scale_hint: {
          type: "object",
          additionalProperties: false,
          required: ["min", "max"],
          properties: {
            min: {
              type: "number",
            },
            max: {
              type: "number",
            },
          },
        },
      },
    },
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "overview", "badges"],
      properties: {
        headline: nonEmptyStringSchema,
        overview: nonEmptyStringSchema,
        badges: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "related_domains", "related_facets"],
            properties: {
              label: nonEmptyStringSchema,
              related_domains: relatedDomainsSchema,
              related_facets: relatedFacetsSchema,
            },
          },
        },
      },
    },
    key_patterns: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "related_domains", "related_facets"],
        properties: {
          title: nonEmptyStringSchema,
          description: nonEmptyStringSchema,
          related_domains: relatedDomainsSchema,
          related_facets: relatedFacetsSchema,
        },
      },
    },
    domains: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "domain_code",
          "label",
          "participant_display_label",
          "score",
          "band",
          "band_label",
          "display_score",
          "display_band",
          "display_band_label",
          "card_title",
          "summary",
          "practical_signal",
          "candidate_reflection",
          "strengths",
          "watchouts",
          "development_tip",
          "subdimensions",
        ],
        properties: {
          domain_code: {
            type: "string",
            enum: IPIP_NEO_120_DOMAIN_ORDER,
          },
          label: nonEmptyStringSchema,
          participant_display_label: nonEmptyStringSchema,
          score: {
            type: "number",
          },
          band: {
            type: "string",
            enum: ["lower", "balanced", "higher"],
          },
          band_label: nonEmptyStringSchema,
          display_score: {
            type: "number",
          },
          display_band: {
            type: "string",
            enum: ["lower", "balanced", "higher"],
          },
          display_band_label: nonEmptyStringSchema,
          card_title: nonEmptyStringSchema,
          summary: nonEmptyStringSchema,
          practical_signal: nonEmptyStringSchema,
          candidate_reflection: nonEmptyStringSchema,
          strengths: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: nonEmptyStringSchema,
          },
          watchouts: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: nonEmptyStringSchema,
          },
          development_tip: nonEmptyStringSchema,
          subdimensions: {
            type: "array",
            minItems: 6,
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "facet_code",
                "label",
                "participant_display_label",
                "score",
                "band",
                "band_label",
                "card_title",
                "summary",
                "practical_signal",
                "candidate_reflection",
              ],
              properties: {
                facet_code: {
                  type: "string",
                  enum: Object.values(IPIP_NEO_120_FACETS_BY_DOMAIN).flat(),
                },
                label: nonEmptyStringSchema,
                participant_display_label: nonEmptyStringSchema,
                score: {
                  type: "number",
                },
                band: {
                  type: "string",
                  enum: ["lower", "balanced", "higher"],
                },
                band_label: nonEmptyStringSchema,
                card_title: nonEmptyStringSchema,
                summary: nonEmptyStringSchema,
                practical_signal: nonEmptyStringSchema,
                candidate_reflection: nonEmptyStringSchema,
              },
            },
          },
        },
      },
    },
    strengths: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: linkedItemRequired,
        properties: linkedItemPropertiesSchema,
      },
    },
    watchouts: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: linkedItemRequired,
        properties: linkedItemPropertiesSchema,
      },
    },
    work_style: {
      type: "object",
      additionalProperties: false,
      required: ["title", "paragraphs"],
      properties: {
        title: nonEmptyStringSchema,
        paragraphs: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          items: nonEmptyStringSchema,
        },
      },
    },
    development_recommendations: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: [...linkedItemRequired, "action"],
        properties: {
          ...linkedItemPropertiesSchema,
          action: nonEmptyStringSchema,
        },
      },
    },
    interpretation_note: {
      type: "object",
      additionalProperties: false,
      required: ["title", "text"],
      properties: {
        title: nonEmptyStringSchema,
        text: nonEmptyStringSchema,
      },
    },
  },
} as const;
