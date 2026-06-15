import ipipNeo120HrSchemaJson from "@/lib/assessment/schemas/ipip-neo-120-hr-v1.json";
import ipipNeo120ParticipantSchemaJson from "@/lib/assessment/schemas/ipip-neo-120-participant-v1.json";
import {
  validateAiReportProseField,
} from "@/lib/assessment/ai-report-prose-validation";
import {
  IPIP_NEO_120_HR_FORBIDDEN_AGREEABLENESS_SHORTHANDS,
  IPIP_NEO_120_HR_FORBIDDEN_ENGLISH_LEAK_TERMS,
  IPIP_NEO_120_DOMAIN_ORDER,
  IPIP_NEO_120_FACETS_BY_DOMAIN,
  getIpipNeo120DomainLabel,
  getIpipNeo120FacetLabel,
  getIpipNeo120HrDomainLabel,
  type IpipNeo120DomainCode,
  type IpipNeo120FacetCode,
} from "@/lib/assessment/ipip-neo-120-labels";
import type {
  IpipNeo120HrReportPromptInput,
} from "@/lib/assessment/ipip-neo-120-report-contract";

type ValidationError = {
  path: string;
  message: string;
};

type Band = "lower" | "balanced" | "higher";

type Summary = {
  headline: string;
  overview: string;
};

type Subdimension = {
  facet_code: IpipNeo120FacetCode;
  label: string;
  score: number;
  band: Band;
  summary: string;
};

type Domain = {
  domain_code: IpipNeo120DomainCode;
  label: string;
  score: number;
  band: Band;
  summary: string;
  strengths: string[];
  watchouts: string[];
  development_tip: string;
  subdimensions: Subdimension[];
};

type HrBand = "low" | "moderate" | "high";

type HrRelevantFacet = {
  facet_name: string;
  score_label_or_band: HrBand;
  relevance: string;
};

type HrKeySignal = {
  title: string;
  evidence: string;
  hr_implication: string;
};

type HrVerificationFocus = {
  area: string;
  why_it_matters: string;
  how_to_check: string;
};

type HrInterviewQuestion = {
  question: string;
  evaluates: string;
  what_good_answer_may_show: string;
};

type HrStrengthsAndOveruseRisk = {
  trait_or_pattern: string;
  possible_strengths: [string, string, string];
  possible_overuse_risks: [string, string, string];
  hr_handling_tip: string;
};

type HrDomainOverview = {
  domain_name: string;
  score_label_or_band: HrBand;
  concise_meaning: string;
  hr_relevance: string;
  check_in_interview: string;
  top_facets: HrRelevantFacet[];
};

type HrOnboardingGuidance = {
  recommendation: string;
  why: string;
  first_30_days_application: string;
};

type HrTeamFitNote = {
  fit_condition: string;
  may_work_well_when: string;
  watchout: string;
};

type HrFacetScoreReference = {
  facet_code: IpipNeo120FacetCode;
  facet_name: string;
  score: number;
  score_label_or_band: HrBand;
};

type HrDomainScoreReference = {
  domain_code: IpipNeo120DomainCode;
  domain_name: string;
  score: number;
  score_label_or_band: HrBand;
  facets: HrFacetScoreReference[];
};

type HrScoreReferences = {
  test_slug: "ipip-neo-120-v1";
  locale: string;
  domains: HrDomainScoreReference[];
};

type LegacyIpipNeo120HrDomainCode = "N" | "E" | "O" | "A" | "C";

type LegacyHrFacet = {
  code: string;
  label: string;
  score_band: HrBand;
  summary: string;
};

type LegacyHrDomain = {
  code: LegacyIpipNeo120HrDomainCode;
  label: string;
  score_band: HrBand;
  summary: string;
  workplace_strengths: [string, string];
  workplace_watchouts: [string, string];
  management_notes: [string, string];
  facets: [LegacyHrFacet, LegacyHrFacet, LegacyHrFacet, LegacyHrFacet, LegacyHrFacet, LegacyHrFacet];
};

export type IpipNeo120ParticipantReportV1 = {
  contract_version: "ipip_neo_120_participant_v1";
  test: {
    slug: "ipip-neo-120-v1";
    name: string;
    locale: "bs";
  };
  meta: {
    report_type: "participant";
    generated_at: string;
    scale_hint: {
      min: number;
      max: number;
      display_mode: "visual_with_discreet_numeric_support";
    };
  };
  summary: Summary;
  dominant_signals: [string, string, string, string, string];
  domains: [Domain, Domain, Domain, Domain, Domain];
  strengths: [string, string, string, ...string[]];
  watchouts: [string, string, string, ...string[]];
  development_recommendations: [string, string, string];
  interpretation_note: string;
};

export const ipipNeo120ParticipantReportV1Schema = ipipNeo120ParticipantSchemaJson;
export const ipipNeo120HrReportV1Schema = ipipNeo120HrSchemaJson;

export type IpipNeo120HrReportV1 = {
  contract_version: "ipip_neo_120_hr_v2";
  test: {
    code: "ipip_neo_120";
    name: "IPIP-NEO-120";
  };
  meta: {
    language: "bs";
    audience: "hr";
  };
  score_references?: HrScoreReferences;
  headline: string;
  executive_summary: string;
  key_hr_signals: [HrKeySignal, HrKeySignal, HrKeySignal];
  verification_focus: [HrVerificationFocus, HrVerificationFocus, HrVerificationFocus];
  interview_questions: [
    HrInterviewQuestion,
    HrInterviewQuestion,
    HrInterviewQuestion,
    HrInterviewQuestion,
    HrInterviewQuestion,
  ];
  strengths_and_overuse_risks: [
    HrStrengthsAndOveruseRisk,
    HrStrengthsAndOveruseRisk,
    ...HrStrengthsAndOveruseRisk[],
  ];
  domain_overview: [
    HrDomainOverview,
    HrDomainOverview,
    HrDomainOverview,
    HrDomainOverview,
    HrDomainOverview,
  ];
  onboarding_and_management_guidance: [
    HrOnboardingGuidance,
    HrOnboardingGuidance,
    HrOnboardingGuidance,
    HrOnboardingGuidance,
  ];
  team_fit_notes: [HrTeamFitNote, HrTeamFitNote, HrTeamFitNote];
  decision_support_note: [string, string, ...string[]];
  interpretation_note: string;
};

function isNonArrayObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeTextField(value: unknown): string {
  return typeof value === "string" ? normalizeWhitespace(value) : "";
}

function validateExactKeys(
  value: Record<string, unknown>,
  allowedKeys: string[],
  path: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const allowed = new Set(allowedKeys);

  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push({
        path,
        message: `Unexpected property "${key}".`,
      });
    }
  }

  return errors;
}

function normalizeHrScoreReferences(value: unknown): HrScoreReferences | undefined {
  if (!isNonArrayObject(value)) {
    return undefined;
  }

  return {
    test_slug: value.test_slug as "ipip-neo-120-v1",
    locale: typeof value.locale === "string" ? value.locale : "",
    domains: (Array.isArray(value.domains) ? value.domains : []).map((domain) => {
      const domainValue = isNonArrayObject(domain) ? domain : {};

      return {
        domain_code: domainValue.domain_code as IpipNeo120DomainCode,
        domain_name: typeof domainValue.domain_name === "string" ? domainValue.domain_name : "",
        score: domainValue.score as number,
        score_label_or_band: domainValue.score_label_or_band as HrBand,
        facets: (Array.isArray(domainValue.facets) ? domainValue.facets : []).map((facet) => {
          const facetValue = isNonArrayObject(facet) ? facet : {};

          return {
            facet_code: facetValue.facet_code as IpipNeo120FacetCode,
            facet_name: typeof facetValue.facet_name === "string" ? facetValue.facet_name : "",
            score: facetValue.score as number,
            score_label_or_band: facetValue.score_label_or_band as HrBand,
          };
        }),
      };
    }),
  };
}

function validateHrScoreReferences(
  value: unknown,
  expectedInput: IpipNeo120HrReportPromptInput,
  errors: ValidationError[],
) {
  const path = "score_references";

  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "Expected an object." });
    return;
  }

  errors.push(...validateExactKeys(value, ["test_slug", "locale", "domains"], path));

  if (value.test_slug !== expectedInput.test_slug) {
    errors.push({
      path: `${path}.test_slug`,
      message: `Expected ${JSON.stringify(expectedInput.test_slug)}.`,
    });
  }

  if (value.locale !== expectedInput.locale) {
    errors.push({
      path: `${path}.locale`,
      message: `Expected ${JSON.stringify(expectedInput.locale)}.`,
    });
  }

  if (!Array.isArray(value.domains) || value.domains.length !== expectedInput.domains.length) {
    errors.push({
      path: `${path}.domains`,
      message: `Expected exactly ${expectedInput.domains.length} domain references.`,
    });
    return;
  }

  value.domains.forEach((domain, domainIndex) => {
    const domainPath = `${path}.domains[${domainIndex}]`;
    const expectedDomain = expectedInput.domains[domainIndex];

    if (!isNonArrayObject(domain)) {
      errors.push({ path: domainPath, message: "Expected an object." });
      return;
    }

    errors.push(
      ...validateExactKeys(
        domain,
        ["domain_code", "domain_name", "score", "score_label_or_band", "facets"],
        domainPath,
      ),
    );

    for (const [key, expectedValue] of [
      ["domain_code", expectedDomain.domain_code],
      ["domain_name", expectedDomain.label],
      ["score", expectedDomain.score],
      ["score_label_or_band", expectedDomain.score_band],
    ] as const) {
      if (domain[key] !== expectedValue) {
        errors.push({
          path: `${domainPath}.${key}`,
          message: `Expected ${JSON.stringify(expectedValue)}.`,
        });
      }
    }

    if (!Array.isArray(domain.facets) || domain.facets.length !== expectedDomain.facets.length) {
      errors.push({
        path: `${domainPath}.facets`,
        message: `Expected exactly ${expectedDomain.facets.length} facet references.`,
      });
      return;
    }

    domain.facets.forEach((facet, facetIndex) => {
      const facetPath = `${domainPath}.facets[${facetIndex}]`;
      const expectedFacet = expectedDomain.facets[facetIndex];

      if (!isNonArrayObject(facet)) {
        errors.push({ path: facetPath, message: "Expected an object." });
        return;
      }

      errors.push(
        ...validateExactKeys(
          facet,
          ["facet_code", "facet_name", "score", "score_label_or_band"],
          facetPath,
        ),
      );

      for (const [key, expectedValue] of [
        ["facet_code", expectedFacet.facet_code],
        ["facet_name", expectedFacet.label],
        ["score", expectedFacet.score],
        ["score_label_or_band", expectedFacet.score_band],
      ] as const) {
        if (facet[key] !== expectedValue) {
          errors.push({
            path: `${facetPath}.${key}`,
            message: `Expected ${JSON.stringify(expectedValue)}.`,
          });
        }
      }
    });
  });
}

function validateNonEmptyString(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is string {
  if (typeof value !== "string" || normalizeWhitespace(value).length === 0) {
    errors.push({ path, message: "Expected a non-empty string." });
    return false;
  }

  return true;
}

function validateBand(value: unknown, path: string, errors: ValidationError[]): value is Band {
  if (value === "lower" || value === "balanced" || value === "higher") {
    return true;
  }

  errors.push({
    path,
    message: 'Expected one of "lower", "balanced", or "higher".',
  });
  return false;
}

function validateNumber(value: unknown, path: string, errors: ValidationError[]): value is number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return true;
  }

  errors.push({ path, message: "Expected a finite number." });
  return false;
}

function prefixValidationErrors(
  errors: ValidationError[],
  prefix: string,
): ValidationError[] {
  return errors.map((error) => ({
    ...error,
    message: error.message.startsWith(prefix) ? error.message : `${prefix}${error.message}`,
  }));
}

function validateExactStringArrayLength(
  value: unknown,
  path: string,
  expectedLength: number,
  errors: ValidationError[],
): value is string[] {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    errors.push({
      path,
      message: `Expected exactly ${expectedLength} non-empty string item(s).`,
    });
    return false;
  }

  value.forEach((item, index) => {
    validateNonEmptyString(item, `${path}[${index}]`, errors);
  });

  return true;
}

function validateHrBand(value: unknown, path: string, errors: ValidationError[]): value is HrBand {
  if (value === "low" || value === "moderate" || value === "high") {
    return true;
  }

  errors.push({
    path,
    message: 'HR report: Expected one of "low", "moderate", or "high".',
  });
  return false;
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(normalizeTextField).filter(Boolean) : [];
}

function countSentences(value: string): number {
  return normalizeWhitespace(value)
    .split(/[.!?]+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
}

function validateSentenceRange(
  value: string,
  path: string,
  minSentences: number,
  maxSentences: number,
  errors: ValidationError[],
) {
  const sentenceCount = countSentences(value);

  if (sentenceCount < minSentences || sentenceCount > maxSentences) {
    errors.push({
      path,
      message: `Expected ${minSentences} to ${maxSentences} sentence(s).`,
    });
  }
}

function validateExactObjectArrayLength(
  value: unknown,
  path: string,
  expectedLength: number,
  errors: ValidationError[],
): value is Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    errors.push({
      path,
      message: `Expected exactly ${expectedLength} item(s).`,
    });
    return false;
  }

  return true;
}

function validateStringArrayRange(
  value: unknown,
  path: string,
  minLength: number,
  maxLength: number,
  errors: ValidationError[],
): value is string[] {
  if (!Array.isArray(value) || value.length < minLength || value.length > maxLength) {
    errors.push({
      path,
      message: `Expected ${minLength} to ${maxLength} non-empty string item(s).`,
    });
    return false;
  }

  value.forEach((item, index) => {
    validateNonEmptyString(item, `${path}[${index}]`, errors);
  });

  return true;
}

function validateHrRelevantFacet(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is HrRelevantFacet {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "HR report: Expected an object." });
    return false;
  }

  errors.push(...validateExactKeys(value, ["facet_name", "score_label_or_band", "relevance"], path));
  const facetNameOk = validateNonEmptyString(value.facet_name, `${path}.facet_name`, errors);
  const bandOk = validateHrBand(value.score_label_or_band, `${path}.score_label_or_band`, errors);
  const relevanceOk = validateNonEmptyString(value.relevance, `${path}.relevance`, errors);

  return facetNameOk && bandOk && relevanceOk;
}

function validateHrKeySignal(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is HrKeySignal {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "HR report: Expected an object." });
    return false;
  }

  errors.push(...validateExactKeys(value, ["title", "evidence", "hr_implication"], path));
  return (
    validateNonEmptyString(value.title, `${path}.title`, errors) &&
    validateNonEmptyString(value.evidence, `${path}.evidence`, errors) &&
    validateNonEmptyString(value.hr_implication, `${path}.hr_implication`, errors)
  );
}

function validateHrVerificationFocus(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is HrVerificationFocus {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "HR report: Expected an object." });
    return false;
  }

  errors.push(...validateExactKeys(value, ["area", "why_it_matters", "how_to_check"], path));
  return (
    validateNonEmptyString(value.area, `${path}.area`, errors) &&
    validateNonEmptyString(value.why_it_matters, `${path}.why_it_matters`, errors) &&
    validateNonEmptyString(value.how_to_check, `${path}.how_to_check`, errors)
  );
}

function validateHrInterviewQuestion(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is HrInterviewQuestion {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "HR report: Expected an object." });
    return false;
  }

  errors.push(
    ...validateExactKeys(
      value,
      ["question", "evaluates", "what_good_answer_may_show"],
      path,
    ),
  );

  return (
    validateNonEmptyString(value.question, `${path}.question`, errors) &&
    validateNonEmptyString(value.evaluates, `${path}.evaluates`, errors) &&
    validateNonEmptyString(
      value.what_good_answer_may_show,
      `${path}.what_good_answer_may_show`,
      errors,
    )
  );
}

function validateHrStrengthsAndOveruseRisk(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is HrStrengthsAndOveruseRisk {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "HR report: Expected an object." });
    return false;
  }

  errors.push(
    ...validateExactKeys(
      value,
      [
        "trait_or_pattern",
        "possible_strengths",
        "possible_overuse_risks",
        "hr_handling_tip",
      ],
      path,
    ),
  );

  const traitOk = validateNonEmptyString(value.trait_or_pattern, `${path}.trait_or_pattern`, errors);
  const strengthsOk = validateExactStringArrayLength(
    value.possible_strengths,
    `${path}.possible_strengths`,
    3,
    errors,
  );
  const risksOk = validateExactStringArrayLength(
    value.possible_overuse_risks,
    `${path}.possible_overuse_risks`,
    3,
    errors,
  );
  const tipOk = validateNonEmptyString(value.hr_handling_tip, `${path}.hr_handling_tip`, errors);

  return traitOk && strengthsOk && risksOk && tipOk;
}

function validateHrDomainOverview(
  value: unknown,
  path: string,
  expectedDomainCode: IpipNeo120DomainCode,
  enforceProseProfiles: boolean,
  errors: ValidationError[],
): value is HrDomainOverview {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "HR report: Expected an object." });
    return false;
  }

  errors.push(
    ...validateExactKeys(
      value,
      [
        "domain_name",
        "score_label_or_band",
        "concise_meaning",
        "hr_relevance",
        "check_in_interview",
        "top_facets",
      ],
      path,
    ),
  );

  const expectedLabel = getIpipNeo120HrDomainLabel(expectedDomainCode) ?? expectedDomainCode;
  const domainNameOk = validateNonEmptyString(value.domain_name, `${path}.domain_name`, errors);

  if (typeof value.domain_name === "string" && normalizeWhitespace(value.domain_name) !== expectedLabel) {
    errors.push({
      path: `${path}.domain_name`,
      message: `Expected canonical label "${expectedLabel}".`,
    });
  }

  const bandOk = validateHrBand(value.score_label_or_band, `${path}.score_label_or_band`, errors);
  const conciseMeaningOk = validateNonEmptyString(
    value.concise_meaning,
    `${path}.concise_meaning`,
    errors,
  );
  const relevanceOk = validateNonEmptyString(value.hr_relevance, `${path}.hr_relevance`, errors);
  const interviewOk = validateNonEmptyString(
    value.check_in_interview,
    `${path}.check_in_interview`,
    errors,
  );

  if (enforceProseProfiles) {
    validateAiReportProseField(
      value.concise_meaning,
      `${path}.concise_meaning`,
      "ipipDomainMeaning",
      errors,
    );
    validateAiReportProseField(
      value.hr_relevance,
      `${path}.hr_relevance`,
      "ipipDomainHrRelevance",
      errors,
    );
    validateAiReportProseField(
      value.check_in_interview,
      `${path}.check_in_interview`,
      "ipipInterviewCheck",
      errors,
    );
  }

  let facetsOk = true;

  if (!Array.isArray(value.top_facets) || value.top_facets.length > 2) {
    errors.push({
      path: `${path}.top_facets`,
      message: "Expected at most 2 top_facets.",
    });
    facetsOk = false;
  } else {
    value.top_facets.forEach((item, index) => {
      if (!validateHrRelevantFacet(item, `${path}.top_facets[${index}]`, errors)) {
        facetsOk = false;
      }
    });
  }

  return domainNameOk && bandOk && conciseMeaningOk && relevanceOk && interviewOk && facetsOk;
}

function validateHrOnboardingGuidance(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is HrOnboardingGuidance {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "HR report: Expected an object." });
    return false;
  }

  errors.push(
    ...validateExactKeys(
      value,
      ["recommendation", "why", "first_30_days_application"],
      path,
    ),
  );

  return (
    validateNonEmptyString(value.recommendation, `${path}.recommendation`, errors) &&
    validateNonEmptyString(value.why, `${path}.why`, errors) &&
    validateNonEmptyString(
      value.first_30_days_application,
      `${path}.first_30_days_application`,
      errors,
    )
  );
}

function validateHrTeamFitNote(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is HrTeamFitNote {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "HR report: Expected an object." });
    return false;
  }

  errors.push(...validateExactKeys(value, ["fit_condition", "may_work_well_when", "watchout"], path));

  return (
    validateNonEmptyString(value.fit_condition, `${path}.fit_condition`, errors) &&
    validateNonEmptyString(value.may_work_well_when, `${path}.may_work_well_when`, errors) &&
    validateNonEmptyString(value.watchout, `${path}.watchout`, errors)
  );
}

function validateSummary(value: unknown, path: string, errors: ValidationError[]): value is Summary {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "Expected an object." });
    return false;
  }

  errors.push(...validateExactKeys(value, ["headline", "overview"], path));
  const headlineOk = validateNonEmptyString(value.headline, `${path}.headline`, errors);
  const overviewOk = validateNonEmptyString(value.overview, `${path}.overview`, errors);

  return headlineOk && overviewOk;
}

function validateSubdimension(
  value: unknown,
  path: string,
  expectedFacetCode: IpipNeo120FacetCode,
  errors: ValidationError[],
): value is Subdimension {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "Expected an object." });
    return false;
  }

  errors.push(...validateExactKeys(value, ["facet_code", "label", "score", "band", "summary"], path));
  const facetCodeOk =
    validateNonEmptyString(value.facet_code, `${path}.facet_code`, errors) &&
    value.facet_code === expectedFacetCode;

  if (typeof value.facet_code === "string" && value.facet_code !== expectedFacetCode) {
    errors.push({
      path: `${path}.facet_code`,
      message: `Expected "${expectedFacetCode}".`,
    });
  }

  const labelOk = validateNonEmptyString(value.label, `${path}.label`, errors);
  const expectedLabel = getIpipNeo120FacetLabel(expectedFacetCode);

  if (expectedLabel && typeof value.label === "string" && normalizeWhitespace(value.label) !== expectedLabel) {
    errors.push({
      path: `${path}.label`,
      message: `Expected canonical label "${expectedLabel}".`,
    });
  }

  const scoreOk = validateNumber(value.score, `${path}.score`, errors);
  const bandOk = validateBand(value.band, `${path}.band`, errors);
  const summaryOk = validateNonEmptyString(value.summary, `${path}.summary`, errors);

  return facetCodeOk && labelOk && scoreOk && bandOk && summaryOk;
}

function validateDomain(
  value: unknown,
  index: number,
  errors: ValidationError[],
): value is Domain {
  const path = `domains[${index}]`;
  const expectedDomainCode = IPIP_NEO_120_DOMAIN_ORDER[index];

  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "Expected an object." });
    return false;
  }

  errors.push(
    ...validateExactKeys(
      value,
      [
        "domain_code",
        "label",
        "score",
        "band",
        "summary",
        "strengths",
        "watchouts",
        "development_tip",
        "subdimensions",
      ],
      path,
    ),
  );

  const domainCodeOk =
    validateNonEmptyString(value.domain_code, `${path}.domain_code`, errors) &&
    value.domain_code === expectedDomainCode;

  if (typeof value.domain_code === "string" && value.domain_code !== expectedDomainCode) {
    errors.push({
      path: `${path}.domain_code`,
      message: `Expected "${expectedDomainCode}" at position ${index + 1}.`,
    });
  }

  const labelOk = validateNonEmptyString(value.label, `${path}.label`, errors);
  const expectedLabel = getIpipNeo120DomainLabel(expectedDomainCode);

  if (expectedLabel && typeof value.label === "string" && normalizeWhitespace(value.label) !== expectedLabel) {
    errors.push({
      path: `${path}.label`,
      message: `Expected canonical label "${expectedLabel}".`,
    });
  }

  const scoreOk = validateNumber(value.score, `${path}.score`, errors);
  const bandOk = validateBand(value.band, `${path}.band`, errors);
  const summaryOk = validateNonEmptyString(value.summary, `${path}.summary`, errors);
  const developmentTipOk = validateNonEmptyString(
    value.development_tip,
    `${path}.development_tip`,
    errors,
  );

  if (!Array.isArray(value.strengths) || value.strengths.length < 2) {
    errors.push({ path: `${path}.strengths`, message: "Expected at least 2 strengths." });
  } else {
    value.strengths.forEach((item, itemIndex) => {
      validateNonEmptyString(item, `${path}.strengths[${itemIndex}]`, errors);
    });
  }

  if (!Array.isArray(value.watchouts) || value.watchouts.length < 2) {
    errors.push({ path: `${path}.watchouts`, message: "Expected at least 2 watchouts." });
  } else {
    value.watchouts.forEach((item, itemIndex) => {
      validateNonEmptyString(item, `${path}.watchouts[${itemIndex}]`, errors);
    });
  }

  const expectedFacets = IPIP_NEO_120_FACETS_BY_DOMAIN[expectedDomainCode];

  if (!Array.isArray(value.subdimensions) || value.subdimensions.length !== expectedFacets.length) {
    errors.push({
      path: `${path}.subdimensions`,
      message: `Expected exactly ${expectedFacets.length} poddimenzija.`,
    });
  } else {
    value.subdimensions.forEach((item, itemIndex) => {
      validateSubdimension(item, `${path}.subdimensions[${itemIndex}]`, expectedFacets[itemIndex], errors);
    });
  }

  return domainCodeOk && labelOk && scoreOk && bandOk && summaryOk && developmentTipOk;
}

export function normalizeIpipNeo120ParticipantReportV1(
  value: unknown,
): IpipNeo120ParticipantReportV1 {
  const report = value as IpipNeo120ParticipantReportV1;

  return {
    contract_version: "ipip_neo_120_participant_v1",
    test: {
      slug: "ipip-neo-120-v1",
      name: normalizeTextField(report.test?.name),
      locale: "bs",
    },
    meta: {
      report_type: "participant",
      generated_at: normalizeTextField(report.meta?.generated_at),
      scale_hint: {
        min: typeof report.meta?.scale_hint?.min === "number" ? report.meta.scale_hint.min : 0,
        max: typeof report.meta?.scale_hint?.max === "number" ? report.meta.scale_hint.max : 0,
        display_mode: "visual_with_discreet_numeric_support",
      },
    },
    summary: {
      headline: normalizeTextField(report.summary?.headline),
      overview: normalizeTextField(report.summary?.overview),
    },
    dominant_signals: (normalizeStringList(report.dominant_signals).slice(0, 5) as IpipNeo120ParticipantReportV1["dominant_signals"]),
    domains: ((Array.isArray(report.domains) ? report.domains : []).map((domain, index) => ({
      domain_code: IPIP_NEO_120_DOMAIN_ORDER[index] ?? domain.domain_code,
      label: normalizeTextField(domain.label),
      score: typeof domain.score === "number" ? domain.score : 0,
      band: domain.band,
      summary: normalizeTextField(domain.summary),
      strengths: normalizeStringList(domain.strengths),
      watchouts: normalizeStringList(domain.watchouts),
      development_tip: normalizeTextField(domain.development_tip),
      subdimensions: (Array.isArray(domain.subdimensions) ? domain.subdimensions : []).map((subdimension) => ({
        facet_code: subdimension.facet_code,
        label: normalizeTextField(subdimension.label),
        score: typeof subdimension.score === "number" ? subdimension.score : 0,
        band: subdimension.band,
        summary: normalizeTextField(subdimension.summary),
      })),
    })) as IpipNeo120ParticipantReportV1["domains"]),
    strengths: normalizeStringList(report.strengths) as IpipNeo120ParticipantReportV1["strengths"],
    watchouts: normalizeStringList(report.watchouts) as IpipNeo120ParticipantReportV1["watchouts"],
    development_recommendations: normalizeStringList(
      report.development_recommendations,
    ) as IpipNeo120ParticipantReportV1["development_recommendations"],
    interpretation_note: normalizeTextField(report.interpretation_note),
  };
}

export function validateIpipNeo120ParticipantReportV1(value: unknown):
  | { ok: true; value: IpipNeo120ParticipantReportV1 }
  | { ok: false; errors: ValidationError[] } {
  const normalized = normalizeIpipNeo120ParticipantReportV1(value);
  const errors: ValidationError[] = [];

  if (!isNonArrayObject(value)) {
    return {
      ok: false,
      errors: [{ path: "", message: "Expected a report object." }],
    };
  }

  errors.push(
    ...validateExactKeys(
      value,
      [
        "contract_version",
        "test",
        "meta",
        "summary",
        "dominant_signals",
        "domains",
        "strengths",
        "watchouts",
        "development_recommendations",
        "interpretation_note",
      ],
      "",
    ),
  );

  if (normalized.contract_version !== "ipip_neo_120_participant_v1") {
    errors.push({
      path: "contract_version",
      message: 'Expected "ipip_neo_120_participant_v1".',
    });
  }

  if (!isNonArrayObject(value.test)) {
    errors.push({ path: "test", message: "Expected an object." });
  } else {
    errors.push(...validateExactKeys(value.test, ["slug", "name", "locale"], "test"));

    if (value.test.slug !== "ipip-neo-120-v1") {
      errors.push({ path: "test.slug", message: 'Expected "ipip-neo-120-v1".' });
    }

    validateNonEmptyString(normalized.test.name, "test.name", errors);

    if (value.test.locale !== "bs") {
      errors.push({ path: "test.locale", message: 'Expected "bs".' });
    }
  }

  if (!isNonArrayObject(value.meta)) {
    errors.push({ path: "meta", message: "Expected an object." });
  } else {
    errors.push(...validateExactKeys(value.meta, ["report_type", "generated_at", "scale_hint"], "meta"));

    if (value.meta.report_type !== "participant") {
      errors.push({ path: "meta.report_type", message: 'Expected "participant".' });
    }

    validateNonEmptyString(normalized.meta.generated_at, "meta.generated_at", errors);

    if (!isNonArrayObject(value.meta.scale_hint)) {
      errors.push({ path: "meta.scale_hint", message: "Expected an object." });
    } else {
      errors.push(
        ...validateExactKeys(
          value.meta.scale_hint,
          ["min", "max", "display_mode"],
          "meta.scale_hint",
        ),
      );
      validateNumber(value.meta.scale_hint.min, "meta.scale_hint.min", errors);
      validateNumber(value.meta.scale_hint.max, "meta.scale_hint.max", errors);

      if (value.meta.scale_hint.display_mode !== "visual_with_discreet_numeric_support") {
        errors.push({
          path: "meta.scale_hint.display_mode",
          message: 'Expected "visual_with_discreet_numeric_support".',
        });
      }
    }
  }

  validateSummary(value.summary, "summary", errors);

  if (!Array.isArray(value.dominant_signals) || value.dominant_signals.length !== 5) {
    errors.push({
      path: "dominant_signals",
      message: "Expected exactly 5 dominant_signals.",
    });
  } else {
    value.dominant_signals.forEach((item, index) => {
      validateNonEmptyString(item, `dominant_signals[${index}]`, errors);
    });
  }

  if (!Array.isArray(value.domains) || value.domains.length !== 5) {
    errors.push({
      path: "domains",
      message: "Expected exactly 5 domains.",
    });
  } else {
    value.domains.forEach((domain, index) => {
      validateDomain(domain, index, errors);
    });
  }

  if (!Array.isArray(value.strengths) || value.strengths.length < 3) {
    errors.push({ path: "strengths", message: "Expected at least 3 strengths." });
  } else {
    value.strengths.forEach((item, index) => {
      validateNonEmptyString(item, `strengths[${index}]`, errors);
    });
  }

  if (!Array.isArray(value.watchouts) || value.watchouts.length < 3) {
    errors.push({ path: "watchouts", message: "Expected at least 3 watchouts." });
  } else {
    value.watchouts.forEach((item, index) => {
      validateNonEmptyString(item, `watchouts[${index}]`, errors);
    });
  }

  if (
    !Array.isArray(value.development_recommendations) ||
    value.development_recommendations.length !== 3
  ) {
    errors.push({
      path: "development_recommendations",
      message: "Expected exactly 3 development_recommendations.",
    });
  } else {
    value.development_recommendations.forEach((item, index) => {
      validateNonEmptyString(item, `development_recommendations[${index}]`, errors);
    });
  }

  validateNonEmptyString(normalized.interpretation_note, "interpretation_note", errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: normalized };
}

const FORBIDDEN_HR_REPORT_PHRASES = [
  "najistaknutiji profesionalni signal",
  "djeluje kao najstabilniji izvor radnog ritma",
  "može pomoći finijem razumijevanju",
  "zaposliti",
  "ne zaposliti",
  "hiring odluka",
] as const;

const FORBIDDEN_HR_REPORT_TERM_PATTERNS: Array<{
  label: string;
  pattern: RegExp;
  message: string;
}> = [
  {
    label: "Ugodnost",
    pattern: /\bugodnost\b/u,
    message: 'Forbidden term detected: "Ugodnost". Use "Spremnost na saradnju" instead.',
  },
  {
    label: "Saradljivost",
    pattern: /\bsaradljivost\b/u,
    message: 'Forbidden term detected: "Saradljivost". Use "Spremnost na saradnju" instead.',
  },
  {
    label: "Kooperativnost",
    pattern: /\bkooperativnost\b/u,
    message: 'Forbidden term detected: "Kooperativnost". Use "Spremnost na saradnju" instead.',
  },
  {
    label: "Saradnički profil",
    pattern: /\bsaradnički profil\b/u,
    message:
      'Forbidden shorthand detected: "Saradnički profil". Use "Spremnost na saradnju" instead of a shorthand domain summary.',
  },
  {
    label: "overuse",
    pattern: /\boveruse\b/u,
    message:
      'Forbidden English leakage detected: "overuse". Use BHS terminology such as "rizik prekomjernog oslanjanja".',
  },
  {
    label: "handling",
    pattern: /\bhandling\b/u,
    message:
      'Forbidden English leakage detected: "handling". Use BHS terminology such as "postupanje" or "upravljanje".',
  },
] as const;

function isLegacyIpipNeo120HrReportShape(value: unknown): value is {
  contract_version: "ipip_neo_120_hr_v1";
  workplace_signals: unknown;
  domains: unknown;
} {
  return (
    isNonArrayObject(value) &&
    value.contract_version === "ipip_neo_120_hr_v1" &&
    Array.isArray(value.workplace_signals) &&
    Array.isArray(value.domains)
  );
}

function normalizeHrRelevantFacets(value: unknown): HrRelevantFacet[] {
  return Array.isArray(value)
    ? value
        .map((item) => ({
          facet_name: normalizeTextField(item?.facet_name),
          score_label_or_band: item?.score_label_or_band as HrBand,
          relevance: normalizeTextField(item?.relevance),
        }))
        .filter((item) => item.facet_name)
        .slice(0, 2)
    : [];
}

function legacyDomainCodeToIpipCode(code: LegacyIpipNeo120HrDomainCode): IpipNeo120DomainCode {
  switch (code) {
    case "E":
      return "EXTRAVERSION";
    case "A":
      return "AGREEABLENESS";
    case "C":
      return "CONSCIENTIOUSNESS";
    case "N":
      return "NEUROTICISM";
    case "O":
    default:
      return "OPENNESS_TO_EXPERIENCE";
  }
}

function normalizeLegacyIpipNeo120HrReportV1(
  value: Partial<{
    headline: unknown;
    executive_summary: unknown;
    workplace_signals: unknown;
    domains: unknown;
    collaboration_style: unknown;
    communication_style: unknown;
    leadership_and_influence: unknown;
    team_watchouts: unknown;
    onboarding_or_management_recommendations: unknown;
    interpretation_note: unknown;
  }>,
): IpipNeo120HrReportV1 {
  const domains = (Array.isArray(value.domains) ? value.domains : []) as Array<Partial<LegacyHrDomain>>;
  const domainsByCode = new Map(
    domains
      .map((domain) =>
        typeof domain.code === "string"
          ? [legacyDomainCodeToIpipCode(domain.code as LegacyIpipNeo120HrDomainCode), domain]
          : null,
      )
      .filter(Boolean) as Array<[IpipNeo120DomainCode, Partial<LegacyHrDomain>]>,
  );
  const workplaceSignals = normalizeStringList(value.workplace_signals);
  const watchouts = normalizeStringList(value.team_watchouts);
  const onboardingNotes = normalizeStringList(value.onboarding_or_management_recommendations);
  const interviewQuestions: IpipNeo120HrReportV1["interview_questions"] = [
    {
      question: "Opišite situaciju kada ste morali zauzeti stav uprkos neslaganju tima. Kako ste postupili?",
      evaluates: "Postavljanje granica i ponašanje u neslaganju.",
      what_good_answer_may_show:
        "Jasan primjer kako osoba održava saradnju, ali i štiti odluku, prioritet ili standard rada.",
    },
    {
      question: "Recite primjer kada ste morali dati direktnu, neugodnu povratnu informaciju.",
      evaluates: "Direktna komunikacija i odgovornost u zahtjevnim razgovorima.",
      what_good_answer_may_show:
        "Sposobnost da ostane konkretna, poštena i profesionalna bez izbjegavanja teških tema.",
    },
    {
      question: "Kako reagujete kada zadatak postane nejasan ili se prioriteti promijene u zadnji čas?",
      evaluates: "Reakcija na promjenu, nejasnoću i operativni pritisak.",
      what_good_answer_may_show:
        "Primjer samoregulacije, traženja pojašnjenja i očuvanja fokusa kada kontekst nije stabilan.",
    },
    {
      question: "Opišite situaciju kada ste morali balansirati brzinu odluke i kvalitet odnosa u timu.",
      evaluates: "Balans saradnje, odlučnosti i praktičnog prosuđivanja.",
      what_good_answer_may_show:
        "Kako osoba procjenjuje kada treba graditi saglasnost, a kada donijeti odluku bez odlaganja.",
    },
    {
      question: "Kada pomažete drugima, kako procjenjujete granicu između podrške i preuzimanja tuđeg posla?",
      evaluates: "Upravljanje saradnjom, prioritetima i ličnom odgovornošću.",
      what_good_answer_may_show:
        "Zdrav osjećaj granice, prioriteta i odgovornosti prema vlastitim obavezama.",
    },
  ];

  return {
    contract_version: "ipip_neo_120_hr_v2",
    test: {
      code: "ipip_neo_120",
      name: "IPIP-NEO-120",
    },
    meta: {
      language: "bs",
      audience: "hr",
    },
    headline:
      normalizeTextField(value.headline) ||
      "Profil ukazuje na obrasce saradnje i samoregulacije koje vrijedi provjeriti kroz konkretne radne situacije.",
    executive_summary:
      normalizeTextField(value.executive_summary) ||
      "Ovaj raniji HR snapshot sažima dominantne obrasce rada i saradnje. U intervjuu ga vrijedi koristiti za provjeru ponašanja pod pritiskom, u neslaganju i pri postavljanju prioriteta.",
    key_hr_signals: [
      {
        title: workplaceSignals[0] || "Prepoznatljiv radni obrazac",
        evidence: "Preuzeto iz ranije verzije HR izvještaja i vezano za dominantne domene i facete iz snapshota.",
        hr_implication:
          "Koristiti kao hipotezu za intervju i provjeriti kako se obrazac vidi u konkretnim radnim situacijama.",
      },
      {
        title: workplaceSignals[1] || "Način saradnje i komunikacije",
        evidence:
          normalizeTextField(value.collaboration_style) || "Raniji izvještaj naglašava saradnju i komunikaciju kao ključni kontekst čitanja profila.",
        hr_implication:
          "Provjeriti kako osoba održava saradnju kada treba dati direktan feedback ili zauzeti stav.",
      },
      {
        title: workplaceSignals[2] || "Razvojna tačka za provjeru",
        evidence:
          normalizeTextField(value.leadership_and_influence) || "Raniji snapshot daje dodatni signal o uticaju, inicijativi i ponašanju u timskom kontekstu.",
        hr_implication:
          "Povezati nalaz sa zahtjevima konkretne uloge i provjeriti ga kroz primjere ponašanja.",
      },
    ],
    verification_focus: [
      {
        area: "Postavljanje granica",
        why_it_matters:
          "Raniji HR snapshot sugeriše da stil saradnje vrijedi provjeriti i kroz situacije kada treba zaštititi prioritet ili odluku.",
        how_to_check:
          "U strukturiranom intervjuu tražiti konkretan primjer neslaganja, zaštite prioriteta ili odbijanja zahtjeva.",
      },
      {
        area: "Direktna povratna informacija",
        why_it_matters:
          "Profil je korisno čitati i kroz to kako osoba komunicira kada razgovor postane neugodan ili osjetljiv.",
        how_to_check:
          "Zatražiti primjer davanja direktnog feedbacka i provjeriti kako je osoba održala jasnoću i odnos.",
      },
      {
        area: "Reakcija na pritisak",
        why_it_matters:
          "Bez provjere pod pritiskom, stari snapshot može ostati preširoka interpretacija svakodnevnog radnog stila.",
        how_to_check:
          "Kroz intervju ili onboarding razgovor tražiti primjer rada kada su rokovi, nejasnoća ili promjena prioriteta bili pojačani.",
      },
    ],
    interview_questions: interviewQuestions,
    strengths_and_overuse_risks: IPIP_NEO_120_DOMAIN_ORDER.map((domainCode) => {
      const domain = domainsByCode.get(domainCode);
      if (!domain) {
        return null;
      }

      return {
        trait_or_pattern:
          normalizeTextField(domain.label) ||
          getIpipNeo120HrDomainLabel(domainCode) ||
          getIpipNeo120DomainLabel(domainCode) ||
          domainCode,
        possible_strengths: [
          normalizeStringList(domain.workplace_strengths)[0] || "Može podržati stabilniji način rada u kontekstu koji traži ovu osobinu.",
          normalizeStringList(domain.workplace_strengths)[1] || "Može pomoći predvidivijoj saradnji i jasnijem usklađivanju s očekivanjima.",
          "Može dati koristan signal o tome kako osoba prirodnije pristupa radu i odnosima.",
        ] as [string, string, string],
        possible_overuse_risks: [
          normalizeStringList(domain.workplace_watchouts)[0] ||
            "U određenim kontekstima može preći u prekomjerno oslanjanje i zato traži dodatnu provjeru kroz konkretne situacije.",
          normalizeStringList(domain.workplace_watchouts)[1] || "Vrijedi provjeriti kako se obrazac vidi kada su pritisak i nejasnoća veći.",
          "Ako se čita bez konteksta uloge, može voditi preširokoj interpretaciji.",
        ] as [string, string, string],
        hr_handling_tip:
          normalizeStringList(domain.management_notes)[0] ||
          "U intervjuu i onboardingu povezati nalaz sa konkretnim zadacima, saradnjom i povratnom informacijom.",
      };
    })
      .filter(Boolean)
      .slice(0, 3) as IpipNeo120HrReportV1["strengths_and_overuse_risks"],
    domain_overview: IPIP_NEO_120_DOMAIN_ORDER.map((domainCode) => {
      const domain = domainsByCode.get(domainCode);
      const fallbackLabel = getIpipNeo120HrDomainLabel(domainCode) ?? getIpipNeo120DomainLabel(domainCode) ?? domainCode;
      const facets = Array.isArray(domain?.facets) ? domain.facets : [];

      return {
        domain_name: normalizeTextField(domain?.label) || fallbackLabel,
        score_label_or_band: (domain?.score_band as HrBand) ?? "moderate",
        concise_meaning:
          normalizeTextField(domain?.summary) ||
          `${fallbackLabel} daje dodatni signal o radnom stilu koji vrijedi čitati uz kontekst uloge.`,
        hr_relevance:
          normalizeStringList(domain?.management_notes)[0] ||
          `U HR kontekstu ovaj domen vrijedi povezati sa zahtjevima saradnje, odlučivanja i svakodnevnog rada.`,
        check_in_interview:
          normalizeStringList(domain?.management_notes)[1] ||
          "U intervjuu tražiti primjer ponašanja koji potvrđuje kako se ovaj obrazac vidi u praksi.",
        top_facets: facets.slice(0, 2).map((facet) => ({
          facet_name: normalizeTextField(facet.label),
          score_label_or_band: (facet.score_band as HrBand) ?? "moderate",
          relevance:
            normalizeTextField(facet.summary) ||
            "Ova faceta daje dodatni signal za praktičnu provjeru u intervjuu.",
        })),
      };
    }) as IpipNeo120HrReportV1["domain_overview"],
    onboarding_and_management_guidance: [
      {
        recommendation: onboardingNotes[0] || "U prvim sedmicama razjasniti prioritete, odgovornosti i očekivanja saradnje.",
        why:
          "Stari HR snapshot daje veću vrijednost kada se profil odmah poveže sa stvarnim radnim zahtjevima i granicama uloge.",
        first_30_days_application:
          "Dogovoriti ritam kratkih check-in razgovora nakon prvih timskih i zadatkovnih situacija.",
      },
      {
        recommendation: onboardingNotes[1] || "Rano provjeriti kako osoba traži pojašnjenje kada zadatak nije potpuno jasan.",
        why:
          "To pomaže da se razlikuje stabilan radni obrazac od ponašanja koje zavisi od strukture, podrške ili pritiska.",
        first_30_days_application:
          "Tokom prvih 30 dana uvesti barem jedan zadatak sa djelimično otvorenim parametrima i refleksiju nakon toga.",
      },
      {
        recommendation: onboardingNotes[2] || "Dogovoriti kako će izgledati direktan feedback i eskalacija neslaganja.",
        why:
          "Profil vrijedi čitati i kroz to kako osoba štiti prioritete, daje feedback i reaguje kada saradnja postane zahtjevnija.",
        first_30_days_application:
          "Nakon prvih zahtjevnijih interakcija kratko pregledati kako je osoba komunicirala, šta je zaštitila i šta bi uradila drugačije.",
      },
      {
        recommendation: "Povezati profil sa konkretnim zahtjevima uloge, a ne samo sa opštim opisom ličnosti.",
        why:
          "Time se smanjuje rizik da se stari snapshot tumači preširoko ili van konteksta stvarnog posla.",
        first_30_days_application:
          "Na kraju prvog mjeseca pregledati koje su se hipoteze iz izvještaja potvrdile, a koje traže dodatnu provjeru.",
      },
    ],
    team_fit_notes: [
      {
        fit_condition: "Tim koji traži stabilnu saradnju i razmjenu informacija",
        may_work_well_when:
          "Uloga zavisi od koordinacije, međuzavisnosti i redovnog usklađivanja sa drugima.",
        watchout:
          watchouts[0] || "Provjeriti kako osoba reaguje kada tim traži češće neslaganje, direktniji konflikt ili brže odluke.",
      },
      {
        fit_condition: "Okruženje sa jasnim očekivanjima i odgovornostima",
        may_work_well_when:
          "Radni kontekst ima dovoljno jasnoće da se vidi kako osoba postavlja prioritete i prati dogovoreno.",
        watchout:
          watchouts[1] || "Vrijedi provjeriti kako funkcioniše kada se očekivanja mijenjaju ili ostanu djelimično nejasna.",
      },
      {
        fit_condition: "Tim koji koristi strukturirani feedback i kratke razvojne check-in razgovore",
        may_work_well_when:
          "Postoji prostor da se dominantni obrasci brzo prevedu u konkretno ponašanje i podršku.",
        watchout:
          watchouts[2] || "Ne oslanjati se na snapshot bez provjere kroz stvarne primjere rada i zahtjeve konkretne uloge.",
      },
    ],
    decision_support_note: [
      "Ne koristiti ovaj profil kao samostalnu odluku o kandidatu.",
      "Koristiti ga za pripremu strukturiranog intervjua i provjeru ponašanja u relevantnim radnim situacijama.",
      "Ključne hipoteze provjeriti kroz konkretne primjere ponašanja, reference i zahtjeve konkretne uloge.",
      "Zaključke kombinovati sa iskustvom, intervjuom, referencama i drugim relevantnim izvorima informacija.",
    ],
    interpretation_note:
      normalizeTextField(value.interpretation_note) ||
      "Ovaj izvještaj nije dijagnoza niti odluka o zapošljavanju, ne potvrđuje zaštićene osobine i treba ga čitati uz kontekst uloge i druge izvore informacija.",
  };
}

export function normalizeIpipNeo120HrReportV1(value: unknown): IpipNeo120HrReportV1 {
  if (isLegacyIpipNeo120HrReportShape(value)) {
    return normalizeLegacyIpipNeo120HrReportV1(value);
  }

  const report = value as Partial<IpipNeo120HrReportV1>;

  return {
    contract_version: "ipip_neo_120_hr_v2",
    test: {
      code: "ipip_neo_120",
      name: "IPIP-NEO-120",
    },
    meta: {
      language: "bs",
      audience: "hr",
    },
    score_references: normalizeHrScoreReferences(report.score_references),
    headline: normalizeTextField(report.headline),
    executive_summary: normalizeTextField(report.executive_summary),
    key_hr_signals: (Array.isArray(report.key_hr_signals) ? report.key_hr_signals : []).map((item) => ({
      title: normalizeTextField(item?.title),
      evidence: normalizeTextField(item?.evidence),
      hr_implication: normalizeTextField(item?.hr_implication),
    })).slice(0, 3) as IpipNeo120HrReportV1["key_hr_signals"],
    verification_focus: (Array.isArray(report.verification_focus) ? report.verification_focus : []).map((item) => ({
      area: normalizeTextField(item?.area),
      why_it_matters: normalizeTextField(item?.why_it_matters),
      how_to_check: normalizeTextField(item?.how_to_check),
    })).slice(0, 3) as IpipNeo120HrReportV1["verification_focus"],
    interview_questions: (Array.isArray(report.interview_questions) ? report.interview_questions : []).map((item) => ({
      question: normalizeTextField(item?.question),
      evaluates: normalizeTextField(item?.evaluates),
      what_good_answer_may_show: normalizeTextField(item?.what_good_answer_may_show),
    })).slice(0, 5) as IpipNeo120HrReportV1["interview_questions"],
    strengths_and_overuse_risks: (Array.isArray(report.strengths_and_overuse_risks)
      ? report.strengths_and_overuse_risks
      : []).map((item) => ({
      trait_or_pattern: normalizeTextField(item?.trait_or_pattern),
      possible_strengths: normalizeStringList(item?.possible_strengths).slice(0, 3) as [string, string, string],
      possible_overuse_risks: normalizeStringList(item?.possible_overuse_risks).slice(0, 3) as [string, string, string],
      hr_handling_tip: normalizeTextField(item?.hr_handling_tip),
    })).slice(0, 3) as IpipNeo120HrReportV1["strengths_and_overuse_risks"],
    domain_overview: (Array.isArray(report.domain_overview) ? report.domain_overview : []).map((item) => ({
      domain_name: normalizeTextField(item?.domain_name),
      score_label_or_band: item?.score_label_or_band as HrBand,
      concise_meaning: normalizeTextField(item?.concise_meaning),
      hr_relevance: normalizeTextField(item?.hr_relevance),
      check_in_interview: normalizeTextField(item?.check_in_interview),
      top_facets: normalizeHrRelevantFacets(item?.top_facets),
    })).slice(0, 5) as IpipNeo120HrReportV1["domain_overview"],
    onboarding_and_management_guidance: (Array.isArray(report.onboarding_and_management_guidance)
      ? report.onboarding_and_management_guidance
      : []).map((item) => ({
      recommendation: normalizeTextField(item?.recommendation),
      why: normalizeTextField(item?.why),
      first_30_days_application: normalizeTextField(item?.first_30_days_application),
    })).slice(0, 4) as IpipNeo120HrReportV1["onboarding_and_management_guidance"],
    team_fit_notes: (Array.isArray(report.team_fit_notes) ? report.team_fit_notes : []).map((item) => ({
      fit_condition: normalizeTextField(item?.fit_condition),
      may_work_well_when: normalizeTextField(item?.may_work_well_when),
      watchout: normalizeTextField(item?.watchout),
    })).slice(0, 3) as IpipNeo120HrReportV1["team_fit_notes"],
    decision_support_note: normalizeStringList(report.decision_support_note).slice(0, 4) as IpipNeo120HrReportV1["decision_support_note"],
    interpretation_note: normalizeTextField(report.interpretation_note),
  };
}

function collectNestedStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectNestedStrings(item));
  }

  if (isNonArrayObject(value)) {
    return Object.values(value).flatMap((item) => collectNestedStrings(item));
  }

  return [];
}

function validateHrGuardrails(
  report: IpipNeo120HrReportV1,
  errors: ValidationError[],
  options?: {
    allowLegacyAgreeablenessAlias?: boolean;
  },
) {
  const { score_references: _scoreReferences, ...narrativeReport } = report;
  const loweredFragments = collectNestedStrings(narrativeReport)
    .map((item) => normalizeWhitespace(item).toLocaleLowerCase("bs"))
    .filter(Boolean);
  const loweredText = loweredFragments.join("\n");

  FORBIDDEN_HR_REPORT_PHRASES.forEach((phrase) => {
    if (loweredText.includes(phrase)) {
      errors.push({
        path: "",
        message: `Forbidden phrase detected: "${phrase}".`,
      });
    }
  });

  FORBIDDEN_HR_REPORT_TERM_PATTERNS.forEach(({ label, pattern, message }) => {
    if ((label !== "Ugodnost" || !options?.allowLegacyAgreeablenessAlias) && pattern.test(loweredText)) {
      errors.push({ path: "", message });
    }
  });

  if (
    IPIP_NEO_120_HR_FORBIDDEN_AGREEABLENESS_SHORTHANDS.some((term) => loweredText.includes(term)) &&
    options?.allowLegacyAgreeablenessAlias
  ) {
    errors.push({
      path: "",
      message:
        'Legacy HR report contains forbidden shorthand beyond the legacy "Ugodnost" alias and cannot be treated as current safe output.',
    });
  }

  if (IPIP_NEO_120_HR_FORBIDDEN_ENGLISH_LEAK_TERMS.some((term) => loweredText.includes(term))) {
    errors.push({
      path: "",
      message:
        'Forbidden English leakage detected in HR report output. Use BHS terminology such as "rizik prekomjernog oslanjanja" and "postupanje".',
    });
  }
}

export function coerceIpipNeo120HrReportV1ForDisplay(value: unknown): IpipNeo120HrReportV1 | null {
  if (
    !isNonArrayObject(value) ||
    (value.contract_version !== "ipip_neo_120_hr_v1" &&
      value.contract_version !== "ipip_neo_120_hr_v2")
  ) {
    return null;
  }

  return normalizeIpipNeo120HrReportV1(value);
}

export function validateIpipNeo120HrReportV1(
  value: unknown,
  options?: {
    strictContract?: boolean;
    enforceGuardrails?: boolean;
    expectedInput?: IpipNeo120HrReportPromptInput;
  },
):
  | { ok: true; value: IpipNeo120HrReportV1 }
  | { ok: false; errors: ValidationError[] } {
  const normalized = normalizeIpipNeo120HrReportV1(value);
  const errors: ValidationError[] = [];
  const strictContract = options?.strictContract ?? false;
  const enforceGuardrails = options?.enforceGuardrails ?? false;
  const isLegacyShape = isLegacyIpipNeo120HrReportShape(value);
  const enforceNarrativeConstraints = strictContract || !isLegacyShape;

  if (!isNonArrayObject(value)) {
    return {
      ok: false,
      errors: [{ path: "", message: "HR report: Expected a report object." }],
    };
  }

  const objectValue = value as Record<string, unknown>;

  if (strictContract && isLegacyShape) {
    errors.push({
      path: "",
      message: "HR report: Legacy HR snapshot shape is not allowed for strict contract validation.",
    });
  }

  if (strictContract && !isLegacyShape) {
    errors.push(
      ...validateExactKeys(
        value,
        [
          "contract_version",
          "test",
          "meta",
          "score_references",
          "headline",
          "executive_summary",
          "key_hr_signals",
          "verification_focus",
          "interview_questions",
          "strengths_and_overuse_risks",
          "domain_overview",
          "onboarding_and_management_guidance",
          "team_fit_notes",
          "decision_support_note",
          "interpretation_note",
        ],
        "",
      ),
    );
  }

  const isCurrentShape = objectValue.contract_version === "ipip_neo_120_hr_v2";
  const isSupportedLegacyShape = objectValue.contract_version === "ipip_neo_120_hr_v1" && isLegacyShape;

  if (!isCurrentShape && !isSupportedLegacyShape) {
    errors.push({
      path: "contract_version",
      message: 'HR report: Expected "ipip_neo_120_hr_v2" or supported legacy "ipip_neo_120_hr_v1".',
    });
  }

  if (isCurrentShape && options?.expectedInput) {
    validateHrScoreReferences(objectValue.score_references, options.expectedInput, errors);
  }

  if (!isNonArrayObject(objectValue.test)) {
    errors.push({ path: "test", message: "HR report: Expected an object." });
  } else {
    errors.push(...validateExactKeys(objectValue.test, ["code", "name"], "test"));

    if (objectValue.test.code !== "ipip_neo_120") {
      errors.push({ path: "test.code", message: 'HR report: Expected "ipip_neo_120".' });
    }

    if (objectValue.test.name !== "IPIP-NEO-120") {
      errors.push({ path: "test.name", message: 'HR report: Expected "IPIP-NEO-120".' });
    }
  }

  if (!isNonArrayObject(objectValue.meta)) {
    errors.push({ path: "meta", message: "HR report: Expected an object." });
  } else {
    errors.push(...validateExactKeys(objectValue.meta, ["language", "audience"], "meta"));

    if (objectValue.meta.language !== "bs") {
      errors.push({ path: "meta.language", message: 'HR report: Expected "bs".' });
    }

    if (objectValue.meta.audience !== "hr") {
      errors.push({ path: "meta.audience", message: 'HR report: Expected "hr".' });
    }
  }

  validateNonEmptyString(normalized.headline, "headline", errors);
  validateNonEmptyString(normalized.executive_summary, "executive_summary", errors);
  if (enforceNarrativeConstraints) {
    validateAiReportProseField(objectValue.headline, "headline", "ipipHeadline", errors);
    validateAiReportProseField(
      objectValue.executive_summary,
      "executive_summary",
      "ipipExecutiveSummary",
      errors,
    );
  }

  if (validateExactObjectArrayLength(normalized.key_hr_signals, "key_hr_signals", 3, errors)) {
    normalized.key_hr_signals.forEach((item, index) => {
      validateHrKeySignal(item, `key_hr_signals[${index}]`, errors);
    });
  }

  if (validateExactObjectArrayLength(normalized.verification_focus, "verification_focus", 3, errors)) {
    normalized.verification_focus.forEach((item, index) => {
      validateHrVerificationFocus(item, `verification_focus[${index}]`, errors);
    });
  }

  if (validateExactObjectArrayLength(normalized.interview_questions, "interview_questions", 5, errors)) {
    normalized.interview_questions.forEach((item, index) => {
      validateHrInterviewQuestion(item, `interview_questions[${index}]`, errors);
    });
  }

  if (
    !Array.isArray(normalized.strengths_and_overuse_risks) ||
    normalized.strengths_and_overuse_risks.length < 2 ||
    normalized.strengths_and_overuse_risks.length > 3
  ) {
    errors.push({
      path: "strengths_and_overuse_risks",
      message: "HR report: Expected 2 to 3 strengths_and_overuse_risks entries.",
    });
  } else {
    normalized.strengths_and_overuse_risks.forEach((item, index) => {
      validateHrStrengthsAndOveruseRisk(item, `strengths_and_overuse_risks[${index}]`, errors);
    });
  }

  if (validateExactObjectArrayLength(normalized.domain_overview, "domain_overview", 5, errors)) {
    normalized.domain_overview.forEach((item, index) => {
      validateHrDomainOverview(
        item,
        `domain_overview[${index}]`,
        IPIP_NEO_120_DOMAIN_ORDER[index],
        enforceNarrativeConstraints,
        errors,
      );
    });
  }

  if (
    validateExactObjectArrayLength(
      normalized.onboarding_and_management_guidance,
      "onboarding_and_management_guidance",
      4,
      errors,
    )
  ) {
    normalized.onboarding_and_management_guidance.forEach((item, index) => {
      validateHrOnboardingGuidance(item, `onboarding_and_management_guidance[${index}]`, errors);
    });
  }

  if (validateExactObjectArrayLength(normalized.team_fit_notes, "team_fit_notes", 3, errors)) {
    normalized.team_fit_notes.forEach((item, index) => {
      validateHrTeamFitNote(item, `team_fit_notes[${index}]`, errors);
    });
  }

  validateStringArrayRange(normalized.decision_support_note, "decision_support_note", 2, 4, errors);
  validateNonEmptyString(normalized.interpretation_note, "interpretation_note", errors);
  if (enforceNarrativeConstraints) {
    validateAiReportProseField(
      (value as Record<string, unknown>).interpretation_note,
      "interpretation_note",
      "ipipInterpretationNote",
      errors,
    );
  }

  if (enforceGuardrails) {
    validateHrGuardrails(normalized, errors, {
      allowLegacyAgreeablenessAlias: isLegacyShape,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors: prefixValidationErrors(errors, "HR report: ") };
  }

  return { ok: true, value: normalized };
}

export function formatIpipNeo120ReportValidationErrors(errors: ValidationError[]): string {
  return errors.map((error) => `${error.path || "<root>"}: ${error.message}`).join(" | ");
}
