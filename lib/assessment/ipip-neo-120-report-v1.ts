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

export function formatIpipNeo120ReportValidationErrors(errors: ValidationError[]): string {
  return errors.map((error) => `${error.path || "<root>"}: ${error.message}`).join(" | ");
}
