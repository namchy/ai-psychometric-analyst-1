import detailedReportV1SchemaJson from "@/lib/assessment/schemas/detailed-report-v1.json";
import detailedReportV1OpenAiSchemaJson from "@/lib/assessment/schemas/detailed-report-v1-openai.json";
import { formatDimensionLabel } from "@/lib/assessment/result-display";

export const CANONICAL_DETAILED_REPORT_DIMENSION_ORDER = [
  "EXTRAVERSION",
  "AGREEABLENESS",
  "CONSCIENTIOUSNESS",
  "EMOTIONAL_STABILITY",
  "INTELLECT",
] as const;

export const DETAILED_REPORT_SCORE_BANDS = ["low", "moderate", "high"] as const;

export type DetailedReportDimensionCode =
  (typeof CANONICAL_DETAILED_REPORT_DIMENSION_ORDER)[number];

export type DetailedReportScoreBand = (typeof DETAILED_REPORT_SCORE_BANDS)[number];

export type DetailedReportTitleDescriptionItem = {
  title: string;
  description: string;
};

export type DetailedReportDevelopmentRecommendationItem = {
  title: string;
  description: string;
  action: string;
};

export type DetailedReportDimensionInsight = {
  dimension_code: DetailedReportDimensionCode;
  dimension_label: string;
  score_band: DetailedReportScoreBand;
  summary: string;
  work_style: string;
  risks: string;
  development_focus: string;
};

export type DetailedReportV1 = {
  report_title: string;
  report_subtitle: string;
  summary: {
    headline: string;
    overview: string;
  };
  strengths: DetailedReportTitleDescriptionItem[];
  blind_spots: DetailedReportTitleDescriptionItem[];
  development_recommendations: DetailedReportDevelopmentRecommendationItem[];
  dimension_insights: DetailedReportDimensionInsight[];
  disclaimer: string;
};

type ValidationError = {
  path: string;
  message: string;
};

export const detailedReportV1Schema = detailedReportV1SchemaJson;
export const detailedReportV1OpenAiSchema = detailedReportV1OpenAiSchemaJson;

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
    errors.push({
      path,
      message: "Expected a non-empty string.",
    });
    return false;
  }

  return true;
}

function validateTitleDescriptionItem(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is DetailedReportTitleDescriptionItem {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "Expected an object." });
    return false;
  }

  errors.push(...validateExactKeys(value, ["title", "description"], path));

  const titleOk = validateNonEmptyString(value.title, `${path}.title`, errors);
  const descriptionOk = validateNonEmptyString(
    value.description,
    `${path}.description`,
    errors,
  );

  return titleOk && descriptionOk;
}

function validateDevelopmentRecommendationItem(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is DetailedReportDevelopmentRecommendationItem {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "Expected an object." });
    return false;
  }

  errors.push(...validateExactKeys(value, ["title", "description", "action"], path));

  const titleOk = validateNonEmptyString(value.title, `${path}.title`, errors);
  const descriptionOk = validateNonEmptyString(
    value.description,
    `${path}.description`,
    errors,
  );
  const actionOk = validateNonEmptyString(value.action, `${path}.action`, errors);

  return titleOk && descriptionOk && actionOk;
}

function validateSummary(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is DetailedReportV1["summary"] {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "Expected an object." });
    return false;
  }

  errors.push(...validateExactKeys(value, ["headline", "overview"], path));

  const headlineOk = validateNonEmptyString(value.headline, `${path}.headline`, errors);
  const overviewOk = validateNonEmptyString(value.overview, `${path}.overview`, errors);

  return headlineOk && overviewOk;
}

function validateDimensionInsight(
  value: unknown,
  index: number,
  errors: ValidationError[],
): value is DetailedReportDimensionInsight {
  const path = `dimension_insights[${index}]`;

  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "Expected an object." });
    return false;
  }

  errors.push(
    ...validateExactKeys(
      value,
      [
        "dimension_code",
        "dimension_label",
        "score_band",
        "summary",
        "work_style",
        "risks",
        "development_focus",
      ],
      path,
    ),
  );

  if (
    !CANONICAL_DETAILED_REPORT_DIMENSION_ORDER.includes(
      value.dimension_code as DetailedReportDimensionCode,
    )
  ) {
    errors.push({
      path: `${path}.dimension_code`,
      message: `Expected one of ${CANONICAL_DETAILED_REPORT_DIMENSION_ORDER.join(", ")}.`,
    });
  }

  if (
    value.score_band !== "low" &&
    value.score_band !== "moderate" &&
    value.score_band !== "high"
  ) {
    errors.push({
      path: `${path}.score_band`,
      message: 'Expected one of "low", "moderate", or "high".',
    });
  }

  validateNonEmptyString(value.dimension_label, `${path}.dimension_label`, errors);
  validateNonEmptyString(value.summary, `${path}.summary`, errors);
  validateNonEmptyString(value.work_style, `${path}.work_style`, errors);
  validateNonEmptyString(value.risks, `${path}.risks`, errors);
  validateNonEmptyString(value.development_focus, `${path}.development_focus`, errors);

  return true;
}

function validateDimensionInsightSequence(
  value: unknown[],
  errors: ValidationError[],
): void {
  const seenCodes = new Set<string>();

  value.forEach((item, index) => {
    if (!isNonArrayObject(item)) {
      return;
    }

    const code = item.dimension_code;

    if (typeof code !== "string") {
      return;
    }

    if (seenCodes.has(code)) {
      errors.push({
        path: `dimension_insights[${index}].dimension_code`,
        message: `Duplicate dimension_code "${code}" is not allowed.`,
      });
      return;
    }

    seenCodes.add(code);

    const expectedCode = CANONICAL_DETAILED_REPORT_DIMENSION_ORDER[index];

    if (code !== expectedCode) {
      errors.push({
        path: `dimension_insights[${index}].dimension_code`,
        message: `Expected "${expectedCode}" at position ${index + 1}.`,
      });
    }
  });

  CANONICAL_DETAILED_REPORT_DIMENSION_ORDER.forEach((expectedCode) => {
    if (!seenCodes.has(expectedCode)) {
      errors.push({
        path: "dimension_insights",
        message: `Missing required dimension_code "${expectedCode}".`,
      });
    }
  });
}

function normalizeTitleDescriptionItem(
  item: DetailedReportTitleDescriptionItem,
): DetailedReportTitleDescriptionItem {
  return {
    title: normalizeWhitespace(item.title),
    description: normalizeWhitespace(item.description),
  };
}

function normalizeDevelopmentRecommendationItem(
  item: DetailedReportDevelopmentRecommendationItem,
): DetailedReportDevelopmentRecommendationItem {
  return {
    title: normalizeWhitespace(item.title),
    description: normalizeWhitespace(item.description),
    action: normalizeWhitespace(item.action),
  };
}

function normalizeDimensionInsight(
  insight: DetailedReportDimensionInsight,
): DetailedReportDimensionInsight {
  return {
    dimension_code: insight.dimension_code,
    dimension_label: normalizeWhitespace(insight.dimension_label),
    score_band: insight.score_band,
    summary: normalizeWhitespace(insight.summary),
    work_style: normalizeWhitespace(insight.work_style),
    risks: normalizeWhitespace(insight.risks),
    development_focus: normalizeWhitespace(insight.development_focus),
  };
}

export function normalizeDimensionCode(value: string): DetailedReportDimensionCode | null {
  const normalized = value.trim().toUpperCase();
  const aliases: Record<string, DetailedReportDimensionCode> = {
    EXTRAVERSION: "EXTRAVERSION",
    AGREEABLENESS: "AGREEABLENESS",
    CONSCIENTIOUSNESS: "CONSCIENTIOUSNESS",
    EMOTIONAL_STABILITY: "EMOTIONAL_STABILITY",
    EMOTIONALSTABILITY: "EMOTIONAL_STABILITY",
    INTELLECT: "INTELLECT",
  };

  return aliases[normalized] ?? null;
}

export function getDetailedReportDimensionLabel(
  dimensionCode: DetailedReportDimensionCode,
): string {
  return formatDimensionLabel(dimensionCode);
}

export function getDetailedReportScoreBand(averageScore: number): DetailedReportScoreBand {
  if (averageScore >= 3.67) {
    return "high";
  }

  if (averageScore >= 2.34) {
    return "moderate";
  }

  return "low";
}

export function normalizeDetailedReportV1(value: unknown): DetailedReportV1 {
  const report = value as DetailedReportV1;

  return {
    report_title: normalizeTextField(report.report_title),
    report_subtitle: normalizeTextField(report.report_subtitle),
    summary: {
      headline: normalizeTextField(report.summary?.headline),
      overview: normalizeTextField(report.summary?.overview),
    },
    strengths: Array.isArray(report.strengths)
      ? report.strengths.map(normalizeTitleDescriptionItem)
      : [],
    blind_spots: Array.isArray(report.blind_spots)
      ? report.blind_spots.map(normalizeTitleDescriptionItem)
      : [],
    development_recommendations: Array.isArray(report.development_recommendations)
      ? report.development_recommendations.map(normalizeDevelopmentRecommendationItem)
      : [],
    dimension_insights: Array.isArray(report.dimension_insights)
      ? report.dimension_insights.map(normalizeDimensionInsight)
      : [],
    disclaimer: normalizeTextField(report.disclaimer),
  };
}

export function validateDetailedReportV1(value: unknown):
  | { ok: true; value: DetailedReportV1 }
  | { ok: false; errors: ValidationError[] } {
  const normalized = normalizeDetailedReportV1(value);
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
        "report_title",
        "report_subtitle",
        "summary",
        "strengths",
        "blind_spots",
        "development_recommendations",
        "dimension_insights",
        "disclaimer",
      ],
      "",
    ),
  );

  validateNonEmptyString(normalized.report_title, "report_title", errors);
  validateNonEmptyString(normalized.report_subtitle, "report_subtitle", errors);
  validateSummary(value.summary, "summary", errors);
  validateNonEmptyString(normalized.disclaimer, "disclaimer", errors);

  if (!Array.isArray(value.strengths) || value.strengths.length !== 3) {
    errors.push({
      path: "strengths",
      message: "Expected exactly 3 strengths.",
    });
  } else {
    value.strengths.forEach((item, index) => {
      validateTitleDescriptionItem(item, `strengths[${index}]`, errors);
    });
  }

  if (!Array.isArray(value.blind_spots) || value.blind_spots.length !== 3) {
    errors.push({
      path: "blind_spots",
      message: "Expected exactly 3 blind_spots.",
    });
  } else {
    value.blind_spots.forEach((item, index) => {
      validateTitleDescriptionItem(item, `blind_spots[${index}]`, errors);
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
      validateDevelopmentRecommendationItem(
        item,
        `development_recommendations[${index}]`,
        errors,
      );
    });
  }

  if (!Array.isArray(value.dimension_insights) || value.dimension_insights.length !== 5) {
    errors.push({
      path: "dimension_insights",
      message: "Expected exactly 5 dimension_insights in canonical order.",
    });
  } else {
    value.dimension_insights.forEach((item, index) => {
      validateDimensionInsight(item, index, errors);
    });
    validateDimensionInsightSequence(value.dimension_insights, errors);
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    value: normalized,
  };
}

export function formatDetailedReportValidationErrors(errors: ValidationError[]): string {
  return errors.map((error) => `${error.path || "<root>"}: ${error.message}`).join(" | ");
}
