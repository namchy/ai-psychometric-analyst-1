import ipipNeo120HrSchemaJson from "@/lib/assessment/schemas/ipip-neo-120-hr-v1.json";
import ipipNeo120ParticipantSchemaJson from "@/lib/assessment/schemas/ipip-neo-120-participant-v1.json";
import {
  IPIP_NEO_120_DOMAIN_ORDER,
  IPIP_NEO_120_FACETS_BY_DOMAIN,
  getIpipNeo120DomainLabel,
  getIpipNeo120FacetLabel,
  type IpipNeo120DomainCode,
  type IpipNeo120FacetCode,
} from "@/lib/assessment/ipip-neo-120-labels";

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

type IpipNeo120HrDomainCode = "N" | "E" | "O" | "A" | "C";

type HrFacet = {
  code: string;
  label: string;
  score_band: HrBand;
  summary: string;
};

type HrDomain = {
  code: IpipNeo120HrDomainCode;
  label: string;
  score_band: HrBand;
  summary: string;
  workplace_strengths: [string, string];
  workplace_watchouts: [string, string];
  management_notes: [string, string];
  facets: [HrFacet, HrFacet, HrFacet, HrFacet, HrFacet, HrFacet];
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
  contract_version: "ipip_neo_120_hr_v1";
  test: {
    code: "ipip_neo_120";
    name: "IPIP-NEO-120";
  };
  meta: {
    language: "bs";
    audience: "hr";
  };
  headline: string;
  executive_summary: string;
  workplace_signals: [string, string, string, string, string];
  domains: [HrDomain, HrDomain, HrDomain, HrDomain, HrDomain];
  collaboration_style: string;
  communication_style: string;
  leadership_and_influence: string;
  team_watchouts: [string, string, string];
  onboarding_or_management_recommendations: [string, string, string];
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

function validateHrFacet(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is HrFacet {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "HR report: Expected an object." });
    return false;
  }

  errors.push(...validateExactKeys(value, ["code", "label", "score_band", "summary"], path));
  const codeOk = validateNonEmptyString(value.code, `${path}.code`, errors);
  const labelOk = validateNonEmptyString(value.label, `${path}.label`, errors);
  const bandOk = validateHrBand(value.score_band, `${path}.score_band`, errors);
  const summaryOk = validateNonEmptyString(value.summary, `${path}.summary`, errors);

  return codeOk && labelOk && bandOk && summaryOk;
}

function validateHrDomain(
  value: unknown,
  path: string,
  seenDomainCodes: Set<IpipNeo120HrDomainCode>,
  errors: ValidationError[],
): value is HrDomain {
  const allowedCodes = ["N", "E", "O", "A", "C"] satisfies IpipNeo120HrDomainCode[];

  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "HR report: Expected an object." });
    return false;
  }

  errors.push(
    ...validateExactKeys(
      value,
      [
        "code",
        "label",
        "score_band",
        "summary",
        "workplace_strengths",
        "workplace_watchouts",
        "management_notes",
        "facets",
      ],
      path,
    ),
  );

  const codeOk = validateNonEmptyString(value.code, `${path}.code`, errors);

  if (typeof value.code === "string") {
    if (!allowedCodes.includes(value.code as IpipNeo120HrDomainCode)) {
      errors.push({
        path: `${path}.code`,
        message: 'HR report: Expected one of "N", "E", "O", "A", or "C".',
      });
    } else if (seenDomainCodes.has(value.code as IpipNeo120HrDomainCode)) {
      errors.push({
        path: `${path}.code`,
        message: `HR report: Duplicate domain code "${value.code}".`,
      });
    } else {
      seenDomainCodes.add(value.code as IpipNeo120HrDomainCode);
    }
  }

  const labelOk = validateNonEmptyString(value.label, `${path}.label`, errors);
  const bandOk = validateHrBand(value.score_band, `${path}.score_band`, errors);
  const summaryOk = validateNonEmptyString(value.summary, `${path}.summary`, errors);
  const strengthsOk = validateExactStringArrayLength(
    value.workplace_strengths,
    `${path}.workplace_strengths`,
    2,
    errors,
  );
  const watchoutsOk = validateExactStringArrayLength(
    value.workplace_watchouts,
    `${path}.workplace_watchouts`,
    2,
    errors,
  );
  const managementNotesOk = validateExactStringArrayLength(
    value.management_notes,
    `${path}.management_notes`,
    2,
    errors,
  );

  let facetsOk = true;

  if (!Array.isArray(value.facets) || value.facets.length !== 6) {
    errors.push({
      path: `${path}.facets`,
      message: "HR report: Expected exactly 6 facets.",
    });
    facetsOk = false;
  } else {
    value.facets.forEach((facet, facetIndex) => {
      if (!validateHrFacet(facet, `${path}.facets[${facetIndex}]`, errors)) {
        facetsOk = false;
      }
    });
  }

  return (
    codeOk &&
    labelOk &&
    bandOk &&
    summaryOk &&
    strengthsOk &&
    watchoutsOk &&
    managementNotesOk &&
    facetsOk
  );
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(normalizeTextField).filter(Boolean) : [];
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

export function normalizeIpipNeo120HrReportV1(value: unknown): IpipNeo120HrReportV1 {
  const report = value as Partial<IpipNeo120HrReportV1>;

  return {
    contract_version: "ipip_neo_120_hr_v1",
    test: {
      code: "ipip_neo_120",
      name: "IPIP-NEO-120",
    },
    meta: {
      language: "bs",
      audience: "hr",
    },
    headline: normalizeTextField(report.headline),
    executive_summary: normalizeTextField(report.executive_summary),
    workplace_signals: normalizeStringList(report.workplace_signals).slice(0, 5) as IpipNeo120HrReportV1["workplace_signals"],
    domains: (Array.isArray(report.domains) ? report.domains : []).map((domain) => ({
      code: typeof domain?.code === "string" ? (domain.code as IpipNeo120HrDomainCode) : "N",
      label: normalizeTextField(domain?.label),
      score_band: domain?.score_band as HrBand,
      summary: normalizeTextField(domain?.summary),
      workplace_strengths: normalizeStringList(domain?.workplace_strengths).slice(0, 2) as HrDomain["workplace_strengths"],
      workplace_watchouts: normalizeStringList(domain?.workplace_watchouts).slice(0, 2) as HrDomain["workplace_watchouts"],
      management_notes: normalizeStringList(domain?.management_notes).slice(0, 2) as HrDomain["management_notes"],
      facets: (Array.isArray(domain?.facets) ? domain.facets : []).map((facet) => ({
        code: normalizeTextField(facet?.code),
        label: normalizeTextField(facet?.label),
        score_band: facet?.score_band as HrBand,
        summary: normalizeTextField(facet?.summary),
      })) as HrDomain["facets"],
    })) as IpipNeo120HrReportV1["domains"],
    collaboration_style: normalizeTextField(report.collaboration_style),
    communication_style: normalizeTextField(report.communication_style),
    leadership_and_influence: normalizeTextField(report.leadership_and_influence),
    team_watchouts: normalizeStringList(report.team_watchouts).slice(0, 3) as IpipNeo120HrReportV1["team_watchouts"],
    onboarding_or_management_recommendations: normalizeStringList(
      report.onboarding_or_management_recommendations,
    ).slice(0, 3) as IpipNeo120HrReportV1["onboarding_or_management_recommendations"],
    interpretation_note: normalizeTextField(report.interpretation_note),
  };
}

export function validateIpipNeo120HrReportV1(value: unknown):
  | { ok: true; value: IpipNeo120HrReportV1 }
  | { ok: false; errors: ValidationError[] } {
  const normalized = normalizeIpipNeo120HrReportV1(value);
  const errors: ValidationError[] = [];

  if (!isNonArrayObject(value)) {
    return {
      ok: false,
      errors: [{ path: "", message: "HR report: Expected a report object." }],
    };
  }

  errors.push(
    ...validateExactKeys(
      value,
      [
        "contract_version",
        "test",
        "meta",
        "headline",
        "executive_summary",
        "workplace_signals",
        "domains",
        "collaboration_style",
        "communication_style",
        "leadership_and_influence",
        "team_watchouts",
        "onboarding_or_management_recommendations",
        "interpretation_note",
      ],
      "",
    ),
  );

  if (value.contract_version !== "ipip_neo_120_hr_v1") {
    errors.push({
      path: "contract_version",
      message: 'HR report: Expected "ipip_neo_120_hr_v1".',
    });
  }

  if (!isNonArrayObject(value.test)) {
    errors.push({ path: "test", message: "HR report: Expected an object." });
  } else {
    errors.push(...validateExactKeys(value.test, ["code", "name"], "test"));

    if (value.test.code !== "ipip_neo_120") {
      errors.push({ path: "test.code", message: 'HR report: Expected "ipip_neo_120".' });
    }

    if (value.test.name !== "IPIP-NEO-120") {
      errors.push({ path: "test.name", message: 'HR report: Expected "IPIP-NEO-120".' });
    }
  }

  if (!isNonArrayObject(value.meta)) {
    errors.push({ path: "meta", message: "HR report: Expected an object." });
  } else {
    errors.push(...validateExactKeys(value.meta, ["language", "audience"], "meta"));

    if (value.meta.language !== "bs") {
      errors.push({ path: "meta.language", message: 'HR report: Expected "bs".' });
    }

    if (value.meta.audience !== "hr") {
      errors.push({ path: "meta.audience", message: 'HR report: Expected "hr".' });
    }
  }

  validateNonEmptyString(normalized.headline, "headline", errors);
  validateNonEmptyString(normalized.executive_summary, "executive_summary", errors);
  validateExactStringArrayLength(value.workplace_signals, "workplace_signals", 5, errors);

  const seenDomainCodes = new Set<IpipNeo120HrDomainCode>();

  if (!Array.isArray(value.domains) || value.domains.length !== 5) {
    errors.push({
      path: "domains",
      message: "HR report: Expected exactly 5 domains.",
    });
  } else {
    value.domains.forEach((domain, index) => {
      validateHrDomain(domain, `domains[${index}]`, seenDomainCodes, errors);
    });

    const expectedCodes = ["N", "E", "O", "A", "C"] satisfies IpipNeo120HrDomainCode[];
    const missingCodes = expectedCodes.filter((code) => !seenDomainCodes.has(code));

    if (missingCodes.length > 0) {
      errors.push({
        path: "domains",
        message: `HR report: Missing domain code(s): ${missingCodes.join(", ")}.`,
      });
    }
  }

  validateNonEmptyString(normalized.collaboration_style, "collaboration_style", errors);
  validateNonEmptyString(normalized.communication_style, "communication_style", errors);
  validateNonEmptyString(normalized.leadership_and_influence, "leadership_and_influence", errors);
  validateExactStringArrayLength(value.team_watchouts, "team_watchouts", 3, errors);
  validateExactStringArrayLength(
    value.onboarding_or_management_recommendations,
    "onboarding_or_management_recommendations",
    3,
    errors,
  );
  validateNonEmptyString(normalized.interpretation_note, "interpretation_note", errors);

  if (errors.length > 0) {
    return { ok: false, errors: prefixValidationErrors(errors, "HR report: ") };
  }

  return { ok: true, value: normalized };
}

export function formatIpipNeo120ReportValidationErrors(errors: ValidationError[]): string {
  return errors.map((error) => `${error.path || "<root>"}: ${error.message}`).join(" | ");
}
