import {
  getIpipNeo120DomainLabel,
  getIpipNeo120FacetLabel,
  IPIP_NEO_120_DOMAIN_ORDER,
  IPIP_NEO_120_FACETS_BY_DOMAIN,
  IPIP_NEO_120_TEST_SLUG,
  type IpipNeo120DomainCode,
} from "./ipip-neo-120-labels";
import {
  getIpipNeo120BandMeaningV2,
  getIpipNeo120DomainDefinitionV2,
  getIpipNeo120FacetDefinitionV2,
  getIpipNeo120ParticipantDisplayBandForDomainV2,
  getIpipNeo120ParticipantDisplayBandLabelForDomainV2,
  getIpipNeo120ParticipantDisplayScoreForDomainV2,
  IPIP_NEO_120_BAND_MEANINGS_V2,
  IPIP_NEO_120_PARTICIPANT_CONSISTENCY_RULES_V2,
  IPIP_NEO_120_PARTICIPANT_GUARDRAILS_V2,
  IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2,
  IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2,
  IPIP_NEO_120_PARTICIPANT_VOCABULARY_RULES_V2,
  validateIpipNeo120ParticipantAiInputV2,
  type IpipNeo120ParticipantAiInputV2,
  type IpipNeo120ParticipantBandV2,
} from "./ipip-neo-120-participant-ai-input-v2";
import {
  isDeclarativeCandidateReflection,
  validateIpipNeo120ParticipantReportV2,
  type IpipNeo120ParticipantReportV2,
  type IpipNeo120ParticipantReportV2Domain,
  type IpipNeo120ParticipantReportV2InterpretationNote,
  type IpipNeo120ParticipantReportV2KeyPattern,
  type IpipNeo120ParticipantReportV2LinkedItem,
  type IpipNeo120ParticipantReportV2Subdimension,
  type IpipNeo120ParticipantReportV2Summary,
  type IpipNeo120ParticipantReportV2WorkStyle,
} from "./ipip-neo-120-participant-report-v2";

export type IpipNeo120ParticipantReportV2OverviewSegment = {
  segment_type: "overview";
  contract_version: "ipip_neo_120_participant_v2_segment_overview";
  summary: IpipNeo120ParticipantReportV2Summary;
  key_patterns: IpipNeo120ParticipantReportV2KeyPattern[];
  work_style: IpipNeo120ParticipantReportV2WorkStyle;
};

export type IpipNeo120ParticipantReportV2DomainSegment = {
  segment_type: "domain";
  contract_version: "ipip_neo_120_participant_v2_segment_domain";
  domain_code: string;
  domain: IpipNeo120ParticipantReportV2Domain;
};

export type IpipNeo120ParticipantReportV2PracticalSegment = {
  segment_type: "practical";
  contract_version: "ipip_neo_120_participant_v2_segment_practical";
  strengths: IpipNeo120ParticipantReportV2LinkedItem[];
  watchouts: IpipNeo120ParticipantReportV2LinkedItem[];
  development_recommendations: Array<IpipNeo120ParticipantReportV2LinkedItem & { action: string }>;
  interpretation_note: IpipNeo120ParticipantReportV2InterpretationNote;
};

export type IpipNeo120ParticipantReportV2SegmentsBundle = {
  overview: IpipNeo120ParticipantReportV2OverviewSegment;
  domains: IpipNeo120ParticipantReportV2DomainSegment[];
  practical: IpipNeo120ParticipantReportV2PracticalSegment;
};

type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };
type UnknownRecord = Record<string, unknown>;

const VALID_BANDS = new Set<string>(["lower", "balanced", "higher"]);
const VALID_DOMAINS = new Set<string>(IPIP_NEO_120_DOMAIN_ORDER);
const VALID_FACETS = new Set<string>(Object.values(IPIP_NEO_120_FACETS_BY_DOMAIN).flat());

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateString(value: unknown, path: string, errors: string[]): void {
  if (!isNonEmptyString(value)) {
    errors.push(`${path}: Expected non-empty string.`);
  }
}

function validateNumber(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${path}: Expected number.`);
  }
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

function validateMaxChars(
  value: unknown,
  budgetKey: keyof typeof IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2,
  path: string,
  errors: string[],
): void {
  const maxChars = IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2[budgetKey].max_chars;

  if (typeof value === "string" && typeof maxChars === "number" && value.length > maxChars) {
    errors.push(`${path}: Exceeds max_chars ${maxChars}.`);
  }
}

function validateBand(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string" || !VALID_BANDS.has(value)) {
    errors.push(`${path}: Expected lower, balanced, or higher.`);
  }
}

function validateBandLabel(
  band: unknown,
  bandLabel: unknown,
  path: string,
  errors: string[],
): void {
  if (typeof band !== "string" || !VALID_BANDS.has(band)) {
    return;
  }

  const expected = getIpipNeo120BandMeaningV2(band)?.label;

  if (bandLabel !== expected) {
    errors.push(`${path}.band_label: Expected ${expected ?? "(unknown)"}.`);
  }
}

function validateRelatedCodes(item: UnknownRecord, path: string, errors: string[]): void {
  if (Array.isArray(item.related_domains)) {
    item.related_domains.forEach((domainCode, index) => {
      if (typeof domainCode !== "string" || !VALID_DOMAINS.has(domainCode)) {
        errors.push(`${path}.related_domains[${index}]: Unknown domain code.`);
      }
    });
  } else {
    errors.push(`${path}.related_domains: Expected array.`);
  }

  if (Array.isArray(item.related_facets)) {
    item.related_facets.forEach((facetCode, index) => {
      if (typeof facetCode !== "string" || !VALID_FACETS.has(facetCode)) {
        errors.push(`${path}.related_facets[${index}]: Unknown facet code.`);
      }
    });
  } else {
    errors.push(`${path}.related_facets: Expected array.`);
  }
}

function validateBadge(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return;
  }

  validateString(value.label, `${path}.label`, errors);
  validateMaxChars(value.label, "summary.badges[].label", `${path}.label`, errors);
  validateRelatedCodes(value, path, errors);
}

function validateKeyPattern(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return;
  }

  validateString(value.title, `${path}.title`, errors);
  validateString(value.description, `${path}.description`, errors);
  validateMaxChars(value.title, "key_patterns[].title", `${path}.title`, errors);
  validateMaxChars(value.description, "key_patterns[].description", `${path}.description`, errors);
  validateRelatedCodes(value, path, errors);
}

function validateLinkedItem(
  value: unknown,
  path: string,
  errors: string[],
  budgetKeys: {
    title: keyof typeof IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2;
    description: keyof typeof IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2;
    action?: keyof typeof IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2;
  },
): void {
  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return;
  }

  validateString(value.title, `${path}.title`, errors);
  validateString(value.description, `${path}.description`, errors);
  validateMaxChars(value.title, budgetKeys.title, `${path}.title`, errors);
  validateMaxChars(value.description, budgetKeys.description, `${path}.description`, errors);
  validateRelatedCodes(value, path, errors);

  if (budgetKeys.action) {
    validateString(value.action, `${path}.action`, errors);
    validateMaxChars(value.action, budgetKeys.action, `${path}.action`, errors);
  }
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

  const facetDefinition = getIpipNeo120FacetDefinitionV2(expectedFacetCode);
  const canonicalLabel = getIpipNeo120FacetLabel(expectedFacetCode);

  if (value.facet_code !== expectedFacetCode) {
    errors.push(`${path}.facet_code: Expected ${expectedFacetCode}.`);
  }

  if (value.label !== canonicalLabel) {
    errors.push(`${path}.label: Expected ${canonicalLabel ?? "(unknown)"}.`);
  }

  if (value.participant_display_label !== facetDefinition?.participant_display_label) {
    errors.push(
      `${path}.participant_display_label: Expected ${
        facetDefinition?.participant_display_label ?? "(unknown)"
      }.`,
    );
  }

  validateNumber(value.score, `${path}.score`, errors);
  validateBand(value.band, `${path}.band`, errors);
  validateBandLabel(value.band, value.band_label, path, errors);
  validateString(value.card_title, `${path}.card_title`, errors);
  validateString(value.summary, `${path}.summary`, errors);
  validateString(value.practical_signal, `${path}.practical_signal`, errors);
  validateString(value.candidate_reflection, `${path}.candidate_reflection`, errors);
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
  if (typeof value.candidate_reflection === "string" && !isDeclarativeCandidateReflection(value.candidate_reflection)) {
    errors.push(
      `${path}.candidate_reflection: candidate_reflection must be a declarative sentence, not a question`,
    );
  }
}

function validateDomainObject(
  value: unknown,
  expectedDomainCode: IpipNeo120DomainCode,
  path: string,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return;
  }

  const domainDefinition = getIpipNeo120DomainDefinitionV2(expectedDomainCode);
  const canonicalLabel = getIpipNeo120DomainLabel(expectedDomainCode);

  if (value.domain_code !== expectedDomainCode) {
    errors.push(`${path}.domain_code: Expected ${expectedDomainCode}.`);
  }

  if (value.label !== canonicalLabel) {
    errors.push(`${path}.label: Expected ${canonicalLabel ?? "(unknown)"}.`);
  }

  if (value.participant_display_label !== domainDefinition?.participant_display_label) {
    errors.push(
      `${path}.participant_display_label: Expected ${
        domainDefinition?.participant_display_label ?? "(unknown)"
      }.`,
    );
  }

  validateNumber(value.score, `${path}.score`, errors);
  validateBand(value.band, `${path}.band`, errors);
  validateBandLabel(value.band, value.band_label, path, errors);
  validateNumber(value.display_score, `${path}.display_score`, errors);
  validateBand(value.display_band, `${path}.display_band`, errors);
  validateBandLabel(value.display_band, value.display_band_label, path, errors);

  if (typeof value.score !== "number" || typeof value.band !== "string") {
    return;
  }

  const expectedDisplayScore = getIpipNeo120ParticipantDisplayScoreForDomainV2(
    expectedDomainCode,
    value.score,
  );
  const expectedDisplayBand = getIpipNeo120ParticipantDisplayBandForDomainV2(
    expectedDomainCode,
    value.band,
  );
  const expectedDisplayBandLabel = getIpipNeo120ParticipantDisplayBandLabelForDomainV2(
    expectedDomainCode,
    value.band,
  );

  if (expectedDisplayScore === null || expectedDisplayBand === null || expectedDisplayBandLabel === null) {
    errors.push(`${path}: Unable to resolve participant display fields.`);
  } else {
    if (value.display_score !== expectedDisplayScore) {
      errors.push(`${path}.display_score: Expected ${expectedDisplayScore}.`);
    }

    if (value.display_band !== expectedDisplayBand) {
      errors.push(`${path}.display_band: Expected ${expectedDisplayBand}.`);
    }

    if (value.display_band_label !== expectedDisplayBandLabel) {
      errors.push(`${path}.display_band_label: Expected ${expectedDisplayBandLabel}.`);
    }
  }

  if (expectedDomainCode !== "NEUROTICISM") {
    if (value.display_score !== value.score) {
      errors.push(`${path}.display_score: Expected canonical score for direct domain.`);
    }

    if (value.display_band !== value.band) {
      errors.push(`${path}.display_band: Expected canonical band for direct domain.`);
    }

    if (value.display_band_label !== value.band_label) {
      errors.push(`${path}.display_band_label: Expected canonical band label for direct domain.`);
    }
  }

  validateString(value.card_title, `${path}.card_title`, errors);
  validateString(value.summary, `${path}.summary`, errors);
  validateString(value.practical_signal, `${path}.practical_signal`, errors);
  validateString(value.candidate_reflection, `${path}.candidate_reflection`, errors);
  validateString(value.development_tip, `${path}.development_tip`, errors);
  validateMaxChars(value.card_title, "domains[].card_title", `${path}.card_title`, errors);
  validateMaxChars(value.summary, "domains[].summary", `${path}.summary`, errors);
  validateMaxChars(value.practical_signal, "domains[].practical_signal", `${path}.practical_signal`, errors);
  validateMaxChars(
    value.candidate_reflection,
    "domains[].candidate_reflection",
    `${path}.candidate_reflection`,
    errors,
  );
  if (typeof value.candidate_reflection === "string" && !isDeclarativeCandidateReflection(value.candidate_reflection)) {
    errors.push(
      `${path}.candidate_reflection: candidate_reflection must be a declarative sentence, not a question`,
    );
  }
  validateMaxChars(value.development_tip, "domains[].development_tip", `${path}.development_tip`, errors);

  if (validateArrayLength(value.strengths, `${path}.strengths`, 2, errors)) {
    value.strengths.forEach((item, index) => {
      validateString(item, `${path}.strengths[${index}]`, errors);
      validateMaxChars(item, "domains[].strengths[]", `${path}.strengths[${index}]`, errors);
    });
  }

  if (validateArrayLength(value.watchouts, `${path}.watchouts`, 2, errors)) {
    value.watchouts.forEach((item, index) => {
      validateString(item, `${path}.watchouts[${index}]`, errors);
      validateMaxChars(item, "domains[].watchouts[]", `${path}.watchouts[${index}]`, errors);
    });
  }

  const subdimensions = value.subdimensions;

  if (validateArrayLength(subdimensions, `${path}.subdimensions`, 6, errors)) {
    IPIP_NEO_120_FACETS_BY_DOMAIN[expectedDomainCode].forEach((facetCode, index) => {
      validateSubdimension(subdimensions[index], facetCode, `${path}.subdimensions[${index}]`, errors);
    });
  }
}

export function validateIpipNeo120ParticipantReportV2OverviewSegment(
  value: unknown,
): ValidationResult<IpipNeo120ParticipantReportV2OverviewSegment> {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["overview: Expected object."] };
  }

  if (value.segment_type !== "overview") {
    errors.push("segment_type: Expected overview.");
  }

  if (value.contract_version !== "ipip_neo_120_participant_v2_segment_overview") {
    errors.push("contract_version: Expected ipip_neo_120_participant_v2_segment_overview.");
  }

  if (isRecord(value.summary)) {
    validateString(value.summary.headline, "summary.headline", errors);
    validateString(value.summary.overview, "summary.overview", errors);
    validateMaxChars(value.summary.headline, "summary.headline", "summary.headline", errors);
    validateMaxChars(value.summary.overview, "summary.overview", "summary.overview", errors);

    if (validateArrayLength(value.summary.badges, "summary.badges", 3, errors)) {
      value.summary.badges.forEach((badge, index) => validateBadge(badge, `summary.badges[${index}]`, errors));
    }
  } else {
    errors.push("summary: Expected object.");
  }

  if (validateArrayLength(value.key_patterns, "key_patterns", 3, errors)) {
    value.key_patterns.forEach((pattern, index) => validateKeyPattern(pattern, `key_patterns[${index}]`, errors));
  }

  if (isRecord(value.work_style)) {
    validateString(value.work_style.title, "work_style.title", errors);
    validateMaxChars(value.work_style.title, "work_style.title", "work_style.title", errors);

    if (validateArrayLength(value.work_style.paragraphs, "work_style.paragraphs", 2, errors)) {
      value.work_style.paragraphs.forEach((paragraph, index) => {
        validateString(paragraph, `work_style.paragraphs[${index}]`, errors);
        validateMaxChars(paragraph, "work_style.paragraphs[]", `work_style.paragraphs[${index}]`, errors);
      });
    }
  } else {
    errors.push("work_style: Expected object.");
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: value as IpipNeo120ParticipantReportV2OverviewSegment };
}

export function validateIpipNeo120ParticipantReportV2DomainSegment(
  value: unknown,
  expectedDomainCode?: string,
): ValidationResult<IpipNeo120ParticipantReportV2DomainSegment> {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["domain segment: Expected object."] };
  }

  if (value.segment_type !== "domain") {
    errors.push("segment_type: Expected domain.");
  }

  if (value.contract_version !== "ipip_neo_120_participant_v2_segment_domain") {
    errors.push("contract_version: Expected ipip_neo_120_participant_v2_segment_domain.");
  }

  if (typeof value.domain_code !== "string" || !VALID_DOMAINS.has(value.domain_code)) {
    errors.push("domain_code: Unknown domain code.");
  }

  if (expectedDomainCode && value.domain_code !== expectedDomainCode) {
    errors.push(`domain_code: Expected ${expectedDomainCode}.`);
  }

  if (isRecord(value.domain)) {
    if (value.domain.domain_code !== value.domain_code) {
      errors.push("domain.domain_code: Expected to match segment domain_code.");
    }

    if (typeof value.domain_code === "string" && VALID_DOMAINS.has(value.domain_code)) {
      validateDomainObject(value.domain, value.domain_code as IpipNeo120DomainCode, "domain", errors);
    }
  } else {
    errors.push("domain: Expected object.");
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: value as IpipNeo120ParticipantReportV2DomainSegment };
}

export function validateIpipNeo120ParticipantReportV2PracticalSegment(
  value: unknown,
): ValidationResult<IpipNeo120ParticipantReportV2PracticalSegment> {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["practical: Expected object."] };
  }

  if (value.segment_type !== "practical") {
    errors.push("segment_type: Expected practical.");
  }

  if (value.contract_version !== "ipip_neo_120_participant_v2_segment_practical") {
    errors.push("contract_version: Expected ipip_neo_120_participant_v2_segment_practical.");
  }

  if (validateArrayLength(value.strengths, "strengths", 4, errors)) {
    value.strengths.forEach((item, index) =>
      validateLinkedItem(item, `strengths[${index}]`, errors, {
        title: "strengths[].title",
        description: "strengths[].description",
      }),
    );
  }

  if (validateArrayLength(value.watchouts, "watchouts", 3, errors)) {
    value.watchouts.forEach((item, index) =>
      validateLinkedItem(item, `watchouts[${index}]`, errors, {
        title: "watchouts[].title",
        description: "watchouts[].description",
      }),
    );
  }

  if (validateArrayLength(value.development_recommendations, "development_recommendations", 4, errors)) {
    value.development_recommendations.forEach((item, index) =>
      validateLinkedItem(item, `development_recommendations[${index}]`, errors, {
        title: "development_recommendations[].title",
        description: "development_recommendations[].description",
        action: "development_recommendations[].action",
      }),
    );
  }

  if (isRecord(value.interpretation_note)) {
    validateString(value.interpretation_note.title, "interpretation_note.title", errors);
    validateString(value.interpretation_note.text, "interpretation_note.text", errors);
    validateMaxChars(value.interpretation_note.text, "interpretation_note.text", "interpretation_note.text", errors);

    if (value.interpretation_note.text !== IPIP_NEO_120_PARTICIPANT_STATIC_TEXT_V2.interpretation_note.text) {
      errors.push("interpretation_note.text: Expected static V2 interpretation note text.");
    }
  } else {
    errors.push("interpretation_note: Expected object.");
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: value as IpipNeo120ParticipantReportV2PracticalSegment };
}

export function validateIpipNeo120ParticipantReportV2SegmentsBundle(
  value: unknown,
): ValidationResult<IpipNeo120ParticipantReportV2SegmentsBundle> {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["bundle: Expected object."] };
  }

  const overviewValidation = validateIpipNeo120ParticipantReportV2OverviewSegment(value.overview);
  if (!overviewValidation.ok) {
    errors.push(...overviewValidation.errors.map((error) => `overview.${error}`));
  }

  const practicalValidation = validateIpipNeo120ParticipantReportV2PracticalSegment(value.practical);
  if (!practicalValidation.ok) {
    errors.push(...practicalValidation.errors.map((error) => `practical.${error}`));
  }

  if (validateArrayLength(value.domains, "domains", 5, errors)) {
    const seen = new Set<string>();

    value.domains.forEach((domainSegment, index) => {
      const expectedDomainCode = IPIP_NEO_120_DOMAIN_ORDER[index];
      const validation = validateIpipNeo120ParticipantReportV2DomainSegment(domainSegment, expectedDomainCode);

      if (isRecord(domainSegment) && typeof domainSegment.domain_code === "string") {
        if (seen.has(domainSegment.domain_code)) {
          errors.push(`domains[${index}].domain_code: Duplicate domain code.`);
        }
        seen.add(domainSegment.domain_code);
      }

      if (!validation.ok) {
        errors.push(...validation.errors.map((error) => `domains[${index}].${error}`));
      }
    });
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: value as IpipNeo120ParticipantReportV2SegmentsBundle };
}

const nonEmptyStringSchema = { type: "string", minLength: 1 } as const;
const relatedDomainsSchema = {
  type: "array",
  items: { type: "string", enum: IPIP_NEO_120_DOMAIN_ORDER },
} as const;
const relatedFacetsSchema = {
  type: "array",
  items: { type: "string", enum: Object.values(IPIP_NEO_120_FACETS_BY_DOMAIN).flat() },
} as const;
const linkedItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "related_domains", "related_facets"],
  properties: {
    title: nonEmptyStringSchema,
    description: nonEmptyStringSchema,
    related_domains: relatedDomainsSchema,
    related_facets: relatedFacetsSchema,
  },
} as const;
const badgeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "related_domains", "related_facets"],
  properties: {
    label: nonEmptyStringSchema,
    related_domains: relatedDomainsSchema,
    related_facets: relatedFacetsSchema,
  },
} as const;
const keyPatternSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "related_domains", "related_facets"],
  properties: {
    title: nonEmptyStringSchema,
    description: nonEmptyStringSchema,
    related_domains: relatedDomainsSchema,
    related_facets: relatedFacetsSchema,
  },
} as const;
const subdimensionSchema = {
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
    facet_code: { type: "string", enum: Object.values(IPIP_NEO_120_FACETS_BY_DOMAIN).flat() },
    label: nonEmptyStringSchema,
    participant_display_label: nonEmptyStringSchema,
    score: { type: "number" },
    band: { type: "string", enum: ["lower", "balanced", "higher"] },
    band_label: nonEmptyStringSchema,
    card_title: nonEmptyStringSchema,
    summary: nonEmptyStringSchema,
    practical_signal: nonEmptyStringSchema,
    candidate_reflection: nonEmptyStringSchema,
  },
} as const;
const domainSchema = {
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
    domain_code: { type: "string", enum: IPIP_NEO_120_DOMAIN_ORDER },
    label: nonEmptyStringSchema,
    participant_display_label: nonEmptyStringSchema,
    score: { type: "number" },
    band: { type: "string", enum: ["lower", "balanced", "higher"] },
    band_label: nonEmptyStringSchema,
    display_score: { type: "number" },
    display_band: { type: "string", enum: ["lower", "balanced", "higher"] },
    display_band_label: nonEmptyStringSchema,
    card_title: nonEmptyStringSchema,
    summary: nonEmptyStringSchema,
    practical_signal: nonEmptyStringSchema,
    candidate_reflection: nonEmptyStringSchema,
    strengths: { type: "array", minItems: 2, maxItems: 2, items: nonEmptyStringSchema },
    watchouts: { type: "array", minItems: 2, maxItems: 2, items: nonEmptyStringSchema },
    development_tip: nonEmptyStringSchema,
    subdimensions: { type: "array", minItems: 6, maxItems: 6, items: subdimensionSchema },
  },
} as const;

export const ipipNeo120ParticipantReportV2OverviewSegmentOpenAiSchema = {
  type: "object",
  additionalProperties: false,
  required: ["segment_type", "contract_version", "summary", "key_patterns", "work_style"],
  properties: {
    segment_type: { type: "string", const: "overview" },
    contract_version: { type: "string", const: "ipip_neo_120_participant_v2_segment_overview" },
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "overview", "badges"],
      properties: {
        headline: nonEmptyStringSchema,
        overview: nonEmptyStringSchema,
        badges: { type: "array", minItems: 3, maxItems: 3, items: badgeSchema },
      },
    },
    key_patterns: { type: "array", minItems: 3, maxItems: 3, items: keyPatternSchema },
    work_style: {
      type: "object",
      additionalProperties: false,
      required: ["title", "paragraphs"],
      properties: {
        title: nonEmptyStringSchema,
        paragraphs: { type: "array", minItems: 2, maxItems: 2, items: nonEmptyStringSchema },
      },
    },
  },
} as const;

export const ipipNeo120ParticipantReportV2DomainSegmentOpenAiSchema = {
  type: "object",
  additionalProperties: false,
  required: ["segment_type", "contract_version", "domain_code", "domain"],
  properties: {
    segment_type: { type: "string", const: "domain" },
    contract_version: { type: "string", const: "ipip_neo_120_participant_v2_segment_domain" },
    domain_code: { type: "string", enum: IPIP_NEO_120_DOMAIN_ORDER },
    domain: domainSchema,
  },
} as const;

export const ipipNeo120ParticipantReportV2PracticalSegmentOpenAiSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "segment_type",
    "contract_version",
    "strengths",
    "watchouts",
    "development_recommendations",
    "interpretation_note",
  ],
  properties: {
    segment_type: { type: "string", const: "practical" },
    contract_version: { type: "string", const: "ipip_neo_120_participant_v2_segment_practical" },
    strengths: { type: "array", minItems: 4, maxItems: 4, items: linkedItemSchema },
    watchouts: { type: "array", minItems: 3, maxItems: 3, items: linkedItemSchema },
    development_recommendations: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "action", "related_domains", "related_facets"],
        properties: {
          title: nonEmptyStringSchema,
          description: nonEmptyStringSchema,
          action: nonEmptyStringSchema,
          related_domains: relatedDomainsSchema,
          related_facets: relatedFacetsSchema,
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

export function assembleIpipNeo120ParticipantReportV2FromSegments(
  input: IpipNeo120ParticipantAiInputV2,
  bundle: IpipNeo120ParticipantReportV2SegmentsBundle,
): ValidationResult<IpipNeo120ParticipantReportV2> {
  const inputValidation = validateIpipNeo120ParticipantAiInputV2(input);

  if (!inputValidation.ok) {
    return {
      ok: false,
      errors: inputValidation.errors.map((error) => `input.${error}`),
    };
  }

  const bundleValidation = validateIpipNeo120ParticipantReportV2SegmentsBundle(bundle);

  if (!bundleValidation.ok) {
    return {
      ok: false,
      errors: bundleValidation.errors,
    };
  }

  const report: IpipNeo120ParticipantReportV2 = {
    contract_version: "ipip_neo_120_participant_v2",
    test: {
      slug: IPIP_NEO_120_TEST_SLUG,
      name: input.test_name,
      locale: input.locale,
    },
    meta: {
      report_type: "participant",
      generated_at: new Date().toISOString(),
      scale_hint: {
        min: input.scale_hint.min,
        max: input.scale_hint.max,
      },
    },
    summary: bundle.overview.summary,
    key_patterns: bundle.overview.key_patterns as IpipNeo120ParticipantReportV2["key_patterns"],
    domains: bundle.domains.map((segment) => segment.domain) as IpipNeo120ParticipantReportV2["domains"],
    strengths: bundle.practical.strengths as IpipNeo120ParticipantReportV2["strengths"],
    watchouts: bundle.practical.watchouts as IpipNeo120ParticipantReportV2["watchouts"],
    work_style: bundle.overview.work_style,
    development_recommendations:
      bundle.practical.development_recommendations as IpipNeo120ParticipantReportV2["development_recommendations"],
    interpretation_note: bundle.practical.interpretation_note,
  };

  const reportValidation = validateIpipNeo120ParticipantReportV2(report);

  if (!reportValidation.ok) {
    return {
      ok: false,
      errors: reportValidation.errors.map((error) => `final.${error}`),
    };
  }

  return {
    ok: true,
    value: reportValidation.value,
  };
}

const OVERVIEW_TEXT_BUDGET_KEYS = [
  "summary.headline",
  "summary.overview",
  "summary.badges[].label",
  "key_patterns[].title",
  "key_patterns[].description",
  "work_style.title",
  "work_style.paragraphs[]",
] as const;
const DOMAIN_TEXT_BUDGET_KEYS = [
  "domains[].card_title",
  "domains[].summary",
  "domains[].practical_signal",
  "domains[].candidate_reflection",
  "domains[].strengths[]",
  "domains[].watchouts[]",
  "domains[].development_tip",
  "subdimensions[].card_title",
  "subdimensions[].summary",
  "subdimensions[].practical_signal",
  "subdimensions[].candidate_reflection",
] as const;
const PRACTICAL_TEXT_BUDGET_KEYS = [
  "strengths[].title",
  "strengths[].description",
  "watchouts[].title",
  "watchouts[].description",
  "development_recommendations[].title",
  "development_recommendations[].description",
  "development_recommendations[].action",
  "interpretation_note.text",
] as const;

function pickTextBudgets<const T extends readonly (keyof typeof IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2)[]>(
  keys: T,
) {
  return Object.fromEntries(keys.map((key) => [key, IPIP_NEO_120_PARTICIPANT_TEXT_BUDGETS_V2[key]]));
}

function buildMeta(input: IpipNeo120ParticipantAiInputV2) {
  return {
    input_version: input.input_version,
    target_contract_version: input.target_contract_version,
    test_slug: input.test_slug,
    test_name: input.test_name,
    audience: input.audience,
    locale: input.locale,
    language_rules: input.language_rules,
    scale_hint: input.scale_hint,
  };
}

function briefDomain(domain: IpipNeo120ParticipantAiInputV2["domains"][number]) {
  return {
    domain_code: domain.domain_code,
    label: domain.label,
    display_label: domain.display_label,
    participant_display_label: domain.participant_display_label,
    narrative_label: domain.narrative_label,
    score: domain.score,
    band: domain.band,
    band_label: domain.band_label,
    display_score: domain.display_score,
    display_band: domain.display_band,
    display_band_label: domain.display_band_label,
    definition: domain.definition,
    display_direction: domain.display_direction,
    band_meaning: domain.band_meaning,
  };
}

function briefSubdimension(subdimension: IpipNeo120ParticipantAiInputV2["domains"][number]["subdimensions"][number]) {
  return {
    facet_code: subdimension.facet_code,
    label: subdimension.label,
    participant_display_label: subdimension.participant_display_label,
    score: subdimension.score,
    band: subdimension.band,
    band_label: subdimension.band_label,
    display_direction: subdimension.display_direction,
  };
}

export function buildIpipNeo120ParticipantOverviewSegmentPromptInput(
  input: IpipNeo120ParticipantAiInputV2,
) {
  return {
    meta: buildMeta(input),
    report_blueprint: {
      summary: input.report_blueprint.summary,
      key_patterns_count: input.report_blueprint.key_patterns_count,
      work_style_paragraphs_count: input.report_blueprint.work_style_paragraphs_count,
    },
    text_budgets: pickTextBudgets(OVERVIEW_TEXT_BUDGET_KEYS),
    band_meanings: IPIP_NEO_120_BAND_MEANINGS_V2,
    vocabulary_rules: IPIP_NEO_120_PARTICIPANT_VOCABULARY_RULES_V2,
    consistency_rules: IPIP_NEO_120_PARTICIPANT_CONSISTENCY_RULES_V2,
    guardrails: IPIP_NEO_120_PARTICIPANT_GUARDRAILS_V2,
    deterministic_summary: input.deterministic_summary,
    domains: input.domains.map((domain) => ({
      ...briefDomain(domain),
      subdimensions: domain.subdimensions.map(briefSubdimension),
    })),
  };
}

export function buildIpipNeo120ParticipantDomainSegmentPromptInput(
  input: IpipNeo120ParticipantAiInputV2,
  domainCode: string,
) {
  const domain = input.domains.find((item) => item.domain_code === domainCode);

  if (!domain) {
    throw new Error(`Unknown IPIP-NEO-120 V2 input domain: ${domainCode}`);
  }

  return {
    meta: buildMeta(input),
    text_budgets: pickTextBudgets(DOMAIN_TEXT_BUDGET_KEYS),
    band_meanings: IPIP_NEO_120_BAND_MEANINGS_V2,
    vocabulary_rules: IPIP_NEO_120_PARTICIPANT_VOCABULARY_RULES_V2,
    consistency_rules: IPIP_NEO_120_PARTICIPANT_CONSISTENCY_RULES_V2,
    guardrails: IPIP_NEO_120_PARTICIPANT_GUARDRAILS_V2,
    domain: {
      ...briefDomain(domain),
      display_rule: domain.display_rule,
      subdimensions: domain.subdimensions,
    },
  };
}

export function buildIpipNeo120ParticipantPracticalSegmentPromptInput(
  input: IpipNeo120ParticipantAiInputV2,
) {
  return {
    meta: buildMeta(input),
    report_blueprint: {
      strengths_count: input.report_blueprint.strengths_count,
      watchouts_count: input.report_blueprint.watchouts_count,
      development_recommendations_count: input.report_blueprint.development_recommendations_count,
      interpretation_note_mode: input.report_blueprint.interpretation_note_mode,
    },
    text_budgets: pickTextBudgets(PRACTICAL_TEXT_BUDGET_KEYS),
    band_meanings: IPIP_NEO_120_BAND_MEANINGS_V2,
    vocabulary_rules: IPIP_NEO_120_PARTICIPANT_VOCABULARY_RULES_V2,
    consistency_rules: IPIP_NEO_120_PARTICIPANT_CONSISTENCY_RULES_V2,
    guardrails: IPIP_NEO_120_PARTICIPANT_GUARDRAILS_V2,
    deterministic_summary: input.deterministic_summary,
    static_text: input.static_text,
    domains: input.domains.map((domain) => ({
      ...briefDomain(domain),
      subdimensions: domain.subdimensions.map(briefSubdimension),
    })),
  };
}

export function formatIpipNeo120ParticipantReportV2SegmentValidationErrors(
  errors: string[],
): string {
  return errors.map((error) => `- ${error}`).join("\n");
}
