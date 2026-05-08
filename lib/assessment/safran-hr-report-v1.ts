import type { AssessmentLocale } from "@/lib/assessment/locale";
import type { CompletedAssessmentResults } from "@/lib/assessment/scoring";
import {
  buildSafranCandidateInterpretation,
  type SafranBandKey,
  type SafranCandidateInterpretationScores,
} from "@/lib/assessment/safran-interpretation";

export const SAFRAN_HR_V1_TEST_SLUG = "safran_v1" as const;
export const SAFRAN_HR_REPORT_V1_TYPE = "safran_hr_report_v1" as const;
export const SAFRAN_HR_REPORT_AUDIENCE = "hr" as const;
export const SAFRAN_HR_REPORT_SOURCE_TYPE = "single_test" as const;
export const SAFRAN_HR_REPORT_REPORT_TYPE = "individual" as const;
export const SAFRAN_HR_REPORT_PROMPT_KEY = SAFRAN_HR_REPORT_V1_TYPE;

export type SafranHrReportLocale = Extract<
  AssessmentLocale,
  "bs" | "hr" | "sr" | "en"
>;
export type SafranHrBand = "lower" | "moderate" | "higher";

export type SafranHrScoreSnapshot = {
  rawScore: number;
  maxScore: number;
  scoreLabel: string;
  band: SafranHrBand;
  bandLabel: string;
};

export type SafranHrReportInput = {
  test: {
    slug: typeof SAFRAN_HR_V1_TEST_SLUG;
    audience: typeof SAFRAN_HR_REPORT_AUDIENCE;
    reportType: typeof SAFRAN_HR_REPORT_REPORT_TYPE;
    sourceType: typeof SAFRAN_HR_REPORT_SOURCE_TYPE;
    locale: SafranHrReportLocale;
  };
  scores: {
    overall: SafranHrScoreSnapshot;
    verbal: SafranHrScoreSnapshot;
    figural: SafranHrScoreSnapshot;
    numeric: SafranHrScoreSnapshot;
  };
  interpretationBoundaries: {
    noIq: true;
    noPercentiles: true;
    noNorms: true;
    noHireNoHire: true;
    noScoreRecalculation: true;
    noScoreMutation: true;
  };
  reportRules: {
    useHrPerspective: true;
    generateInterviewQuestions: true;
    generatePointsOfCaution: true;
    generateOnboardingGuidance: true;
    avoidDiagnosticLanguage: true;
    keepSignalsAsHypotheses: true;
  };
};

export type SafranHrReportPointOfCaution = {
  signal: string;
  whyItMatters: string;
  howToCheck: string;
};

export type SafranHrReportInterviewQuestion = {
  category: string;
  question: string;
  whatToListenFor: string;
};

export type SafranHrReportV1 = {
  reportType: typeof SAFRAN_HR_REPORT_V1_TYPE;
  testSlug: typeof SAFRAN_HR_V1_TEST_SLUG;
  audience: typeof SAFRAN_HR_REPORT_AUDIENCE;
  sourceType: typeof SAFRAN_HR_REPORT_SOURCE_TYPE;
  locale: SafranHrReportLocale;
  generatedLanguage: string;
  executiveSummary: {
    title: string;
    summary: string;
  };
  cognitiveSignals: {
    overall: string;
    verbal: string;
    figural: string;
    numeric: string;
  };
  pointsOfCaution: [SafranHrReportPointOfCaution, ...SafranHrReportPointOfCaution[]];
  interviewQuestions: [SafranHrReportInterviewQuestion, ...SafranHrReportInterviewQuestion[]];
  onboardingGuidance: {
    first30Days: [string, ...string[]];
    days60: [string, ...string[]];
    days90: [string, ...string[]];
  };
  interpretationLimits: [string, ...string[]];
  safetyChecks: {
    noIqLanguage: true;
    noPercentiles: true;
    noNormativeClaims: true;
    noHireNoHireDecision: true;
    noScoreMutation: true;
  };
};

export const safranHrReportV1OpenAiSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "reportType",
    "testSlug",
    "audience",
    "sourceType",
    "locale",
    "generatedLanguage",
    "executiveSummary",
    "cognitiveSignals",
    "pointsOfCaution",
    "interviewQuestions",
    "onboardingGuidance",
    "interpretationLimits",
    "safetyChecks",
  ],
  properties: {
    reportType: {
      type: "string",
      const: SAFRAN_HR_REPORT_V1_TYPE,
    },
    testSlug: {
      type: "string",
      const: SAFRAN_HR_V1_TEST_SLUG,
    },
    audience: {
      type: "string",
      const: SAFRAN_HR_REPORT_AUDIENCE,
    },
    sourceType: {
      type: "string",
      const: SAFRAN_HR_REPORT_SOURCE_TYPE,
    },
    locale: {
      type: "string",
      enum: ["bs", "hr", "sr", "en"],
    },
    generatedLanguage: {
      type: "string",
      minLength: 2,
      maxLength: 40,
    },
    executiveSummary: {
      type: "object",
      additionalProperties: false,
      required: ["title", "summary"],
      properties: {
        title: { type: "string", minLength: 1, maxLength: 120 },
        summary: { type: "string", minLength: 1, maxLength: 600 },
      },
    },
    cognitiveSignals: {
      type: "object",
      additionalProperties: false,
      required: ["overall", "verbal", "figural", "numeric"],
      properties: {
        overall: { type: "string", minLength: 1, maxLength: 360 },
        verbal: { type: "string", minLength: 1, maxLength: 360 },
        figural: { type: "string", minLength: 1, maxLength: 360 },
        numeric: { type: "string", minLength: 1, maxLength: 360 },
      },
    },
    pointsOfCaution: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["signal", "whyItMatters", "howToCheck"],
        properties: {
          signal: { type: "string", minLength: 1, maxLength: 240 },
          whyItMatters: { type: "string", minLength: 1, maxLength: 320 },
          howToCheck: { type: "string", minLength: 1, maxLength: 320 },
        },
      },
    },
    interviewQuestions: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "question", "whatToListenFor"],
        properties: {
          category: { type: "string", minLength: 1, maxLength: 120 },
          question: { type: "string", minLength: 1, maxLength: 280 },
          whatToListenFor: { type: "string", minLength: 1, maxLength: 320 },
        },
      },
    },
    onboardingGuidance: {
      type: "object",
      additionalProperties: false,
      required: ["first30Days", "days60", "days90"],
      properties: {
        first30Days: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: { type: "string", minLength: 1, maxLength: 220 },
        },
        days60: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: { type: "string", minLength: 1, maxLength: 220 },
        },
        days90: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: { type: "string", minLength: 1, maxLength: 220 },
        },
      },
    },
    interpretationLimits: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: { type: "string", minLength: 1, maxLength: 260 },
    },
    safetyChecks: {
      type: "object",
      additionalProperties: false,
      required: [
        "noIqLanguage",
        "noPercentiles",
        "noNormativeClaims",
        "noHireNoHireDecision",
        "noScoreMutation",
      ],
      properties: {
        noIqLanguage: { type: "boolean", const: true },
        noPercentiles: { type: "boolean", const: true },
        noNormativeClaims: { type: "boolean", const: true },
        noHireNoHireDecision: { type: "boolean", const: true },
        noScoreMutation: { type: "boolean", const: true },
      },
    },
  },
} as const satisfies Record<string, unknown>;

export const SAFRAN_HR_REPORT_V1_CONTRACT = {
  family: "safran",
  reportType: SAFRAN_HR_REPORT_REPORT_TYPE,
  sourceType: SAFRAN_HR_REPORT_SOURCE_TYPE,
  promptKey: SAFRAN_HR_REPORT_PROMPT_KEY,
  schemaId: "safran-hr-report-v1",
  outputSchemaJson: safranHrReportV1OpenAiSchema as Record<string, unknown>,
} as const;

const SAFRAN_SCORE_LIMITS = {
  overall: 54,
  verbal: 18,
  figural: 18,
  numeric: 18,
} as const;

const FORBIDDEN_REPORT_PATTERNS: Array<{
  pattern: RegExp;
  label: string;
}> = [
  { pattern: /\biq\b/i, label: "IQ" },
  { pattern: /kvocijent inteligencije/i, label: "kvocijent inteligencije" },
  { pattern: /\binteligentan\b/i, label: "inteligentan" },
  { pattern: /\bneinteligentan\b/i, label: "neinteligentan" },
  { pattern: /\bnadaren\b/i, label: "nadaren" },
  { pattern: /slab kandidat/i, label: "slab kandidat" },
  { pattern: /iznadprosječan/i, label: "iznadprosječan" },
  { pattern: /ispodprosječan/i, label: "ispodprosječan" },
  { pattern: /prosječan u populaciji/i, label: "prosječan u populaciji" },
  { pattern: /\bpercentile\b/i, label: "percentile" },
  { pattern: /\bpercentil\b/i, label: "percentil" },
  { pattern: /\bnorma\b/i, label: "norma" },
  { pattern: /normativno poređenje/i, label: "normativno poređenje" },
  { pattern: /preporučuje se zapošljavanje/i, label: "preporučuje se zapošljavanje" },
  { pattern: /ne preporučuje se zapošljavanje/i, label: "ne preporučuje se zapošljavanje" },
  { pattern: /hiring score/i, label: "hiring score" },
  { pattern: /idealni kandidat/i, label: "idealni kandidat" },
  { pattern: /loš fit/i, label: "loš fit" },
  { pattern: /red flag/i, label: "red flag" },
  { pattern: /rizičan kandidat/i, label: "rizičan kandidat" },
  { pattern: /hire\/no-hire/i, label: "hire/no-hire" },
  { pattern: /\bhire\b/i, label: "hire" },
  { pattern: /\bno-hire\b/i, label: "no-hire" },
  { pattern: /promijenjen score/i, label: "promijenjen score" },
  { pattern: /izmijenjen score/i, label: "izmijenjen score" },
  { pattern: /rekalkulis/i, label: "rekalkulacija score-a" },
  { pattern: /preračunat/i, label: "preračunat rezultat" },
];

const REQUIRED_HYPOTHESIS_PATTERNS = [
  /rezultat može ukazivati/i,
  /u ovom setu zadataka/i,
  /ovaj signal treba provjeriti/i,
  /korisno je provjeriti kroz intervju ili radni zadatak/i,
  /čitati zajedno sa iskustvom, intervjuom i kontekstom uloge/i,
  /tačka opreza/i,
  /hipoteza za provjeru/i,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidLocale(value: unknown): value is SafranHrReportLocale {
  return value === "bs" || value === "hr" || value === "sr" || value === "en";
}

function mapSafranBandKeyToHrBand(bandKey: SafranBandKey): SafranHrBand {
  switch (bandKey) {
    case "lower_raw":
      return "lower";
    case "moderate_raw":
      return "moderate";
    case "higher_raw":
      return "higher";
  }
}

function formatScoreLabel(rawScore: number, maxScore: number): string {
  return `${rawScore}/${maxScore}`;
}

function getSafranDerivedScores(
  results: CompletedAssessmentResults,
): SafranCandidateInterpretationScores {
  const derived = results.derived?.safranV1;
  const dimensions = new Map(
    results.dimensions.map((dimension) => [dimension.dimension, dimension.rawScore]),
  );

  return {
    verbal_score: derived?.verbalScore ?? dimensions.get("verbal_score") ?? null,
    figural_score: derived?.figuralScore ?? dimensions.get("figural_score") ?? null,
    numerical_series_score:
      derived?.numericalAdjustedScore ??
      derived?.numericalSeriesScore ??
      dimensions.get("numerical_series_score") ??
      null,
    cognitive_composite_v1:
      derived?.cognitiveCompositeScore ??
      derived?.cognitiveCompositeV1 ??
      dimensions.get("cognitive_composite_v1") ??
      null,
  };
}

function requireSafranScore(
  score: number | null | undefined,
  label: keyof SafranCandidateInterpretationScores,
): number {
  if (!isFiniteNumber(score)) {
    throw new Error(`SAFRAN HR report input requires ${label}.`);
  }

  return score;
}

function buildScoreSnapshot(args: {
  scoreKey: keyof SafranCandidateInterpretationScores;
  maxScore: number;
  scores: SafranCandidateInterpretationScores;
}): SafranHrScoreSnapshot {
  const interpretation = buildSafranCandidateInterpretation(args.scores);
  const score = requireSafranScore(args.scores[args.scoreKey], args.scoreKey);

  const interpreted =
    args.scoreKey === "cognitive_composite_v1"
      ? interpretation.overall
      : interpretation.domains.find((domain) => domain.scoreKey === args.scoreKey);

  if (!interpreted) {
    throw new Error(`Missing SAFRAN HR interpretation for ${args.scoreKey}.`);
  }

  return {
    rawScore: score,
    maxScore: args.maxScore,
    scoreLabel: formatScoreLabel(score, args.maxScore),
    band: mapSafranBandKeyToHrBand(interpreted.bandKey),
    bandLabel: interpreted.bandLabelBs,
  };
}

export function isSafranHrReportTestSlug(testSlug: string): boolean {
  return testSlug === SAFRAN_HR_V1_TEST_SLUG;
}

export function buildSafranHrReportInput(request: {
  testSlug: string;
  locale: AssessmentLocale;
  results: CompletedAssessmentResults;
}): SafranHrReportInput {
  if (!isSafranHrReportTestSlug(request.testSlug)) {
    throw new Error(`SAFRAN HR report input builder requires ${SAFRAN_HR_V1_TEST_SLUG}.`);
  }

  if (!isValidLocale(request.locale)) {
    throw new Error("SAFRAN HR report input requires a supported locale.");
  }

  const scores = getSafranDerivedScores(request.results);

  return {
    test: {
      slug: SAFRAN_HR_V1_TEST_SLUG,
      audience: SAFRAN_HR_REPORT_AUDIENCE,
      reportType: SAFRAN_HR_REPORT_REPORT_TYPE,
      sourceType: SAFRAN_HR_REPORT_SOURCE_TYPE,
      locale: request.locale,
    },
    scores: {
      overall: buildScoreSnapshot({
        scoreKey: "cognitive_composite_v1",
        maxScore: SAFRAN_SCORE_LIMITS.overall,
        scores,
      }),
      verbal: buildScoreSnapshot({
        scoreKey: "verbal_score",
        maxScore: SAFRAN_SCORE_LIMITS.verbal,
        scores,
      }),
      figural: buildScoreSnapshot({
        scoreKey: "figural_score",
        maxScore: SAFRAN_SCORE_LIMITS.figural,
        scores,
      }),
      numeric: buildScoreSnapshot({
        scoreKey: "numerical_series_score",
        maxScore: SAFRAN_SCORE_LIMITS.numeric,
        scores,
      }),
    },
    interpretationBoundaries: {
      noIq: true,
      noPercentiles: true,
      noNorms: true,
      noHireNoHire: true,
      noScoreRecalculation: true,
      noScoreMutation: true,
    },
    reportRules: {
      useHrPerspective: true,
      generateInterviewQuestions: true,
      generatePointsOfCaution: true,
      generateOnboardingGuidance: true,
      avoidDiagnosticLanguage: true,
      keepSignalsAsHypotheses: true,
    },
  };
}

function validateAdditionalProperties(
  value: Record<string, unknown>,
  path: string,
  allowedKeys: string[],
  errors: string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      errors.push(`${path}.${key}: Unexpected property.`);
    }
  }
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStrings(item));
  }

  if (isRecord(value)) {
    return Object.values(value).flatMap((item) => collectStrings(item));
  }

  return [];
}

function validateForbiddenPhrases(report: SafranHrReportV1, errors: string[]): void {
  for (const text of collectStrings({
    executiveSummary: report.executiveSummary,
    cognitiveSignals: report.cognitiveSignals,
    pointsOfCaution: report.pointsOfCaution,
    interviewQuestions: report.interviewQuestions,
    onboardingGuidance: report.onboardingGuidance,
    interpretationLimits: report.interpretationLimits,
  })) {
    for (const { pattern, label } of FORBIDDEN_REPORT_PATTERNS) {
      if (pattern.test(text)) {
        errors.push(`Forbidden phrase "${label}" found in report text: ${text}`);
      }
    }
  }
}

function validateHrNarrativeBoundaries(report: SafranHrReportV1, errors: string[]): void {
  const summaryText = report.executiveSummary.summary;

  if (!REQUIRED_HYPOTHESIS_PATTERNS.some((pattern) => pattern.test(summaryText))) {
    errors.push(
      "executiveSummary.summary: Must frame the interpretation as a cautious HR hypothesis.",
    );
  }

  if (
    !report.interpretationLimits.some((item) =>
      /čitati zajedno sa iskustvom, intervjuom i kontekstom uloge/i.test(item),
    )
  ) {
    errors.push(
      "interpretationLimits: Missing guidance to read the signal with experience, interview and role context.",
    );
  }
}

export function validateSafranHrReport(
  value: unknown,
  options?: {
    expectedInput?: SafranHrReportInput | null;
  },
): { ok: true; value: SafranHrReportV1 } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["<root>: Expected object."] };
  }

  validateAdditionalProperties(
    value,
    "<root>",
    [
      "reportType",
      "testSlug",
      "audience",
      "sourceType",
      "locale",
      "generatedLanguage",
      "executiveSummary",
      "cognitiveSignals",
      "pointsOfCaution",
      "interviewQuestions",
      "onboardingGuidance",
      "interpretationLimits",
      "safetyChecks",
    ],
    errors,
  );

  if (value.reportType !== SAFRAN_HR_REPORT_V1_TYPE) {
    errors.push(`reportType: Expected ${SAFRAN_HR_REPORT_V1_TYPE}.`);
  }

  if (value.testSlug !== SAFRAN_HR_V1_TEST_SLUG) {
    errors.push(`testSlug: Expected ${SAFRAN_HR_V1_TEST_SLUG}.`);
  }

  if (value.audience !== SAFRAN_HR_REPORT_AUDIENCE) {
    errors.push("audience: Expected hr.");
  }

  if (value.sourceType !== SAFRAN_HR_REPORT_SOURCE_TYPE) {
    errors.push(`sourceType: Expected ${SAFRAN_HR_REPORT_SOURCE_TYPE}.`);
  }

  if (!isValidLocale(value.locale)) {
    errors.push("locale: Expected bs, hr, sr or en.");
  }

  if (!isNonEmptyString(value.generatedLanguage)) {
    errors.push("generatedLanguage: Expected non-empty string.");
  }

  if (!isRecord(value.executiveSummary)) {
    errors.push("executiveSummary: Expected object.");
  } else {
    validateAdditionalProperties(
      value.executiveSummary,
      "executiveSummary",
      ["title", "summary"],
      errors,
    );

    if (!isNonEmptyString(value.executiveSummary.title)) {
      errors.push("executiveSummary.title: Expected non-empty string.");
    }

    if (!isNonEmptyString(value.executiveSummary.summary)) {
      errors.push("executiveSummary.summary: Expected non-empty string.");
    }
  }

  if (!isRecord(value.cognitiveSignals)) {
    errors.push("cognitiveSignals: Expected object.");
  } else {
    validateAdditionalProperties(
      value.cognitiveSignals,
      "cognitiveSignals",
      ["overall", "verbal", "figural", "numeric"],
      errors,
    );

    for (const key of ["overall", "verbal", "figural", "numeric"] as const) {
      if (!isNonEmptyString(value.cognitiveSignals[key])) {
        errors.push(`cognitiveSignals.${key}: Expected non-empty string.`);
      }
    }
  }

  if (!Array.isArray(value.pointsOfCaution) || value.pointsOfCaution.length === 0) {
    errors.push("pointsOfCaution: Expected non-empty array.");
  } else {
    value.pointsOfCaution.forEach((item, index) => {
      if (!isRecord(item)) {
        errors.push(`pointsOfCaution[${index}]: Expected object.`);
        return;
      }

      validateAdditionalProperties(
        item,
        `pointsOfCaution[${index}]`,
        ["signal", "whyItMatters", "howToCheck"],
        errors,
      );

      for (const key of ["signal", "whyItMatters", "howToCheck"] as const) {
        if (!isNonEmptyString(item[key])) {
          errors.push(`pointsOfCaution[${index}].${key}: Expected non-empty string.`);
        }
      }
    });
  }

  if (!Array.isArray(value.interviewQuestions) || value.interviewQuestions.length === 0) {
    errors.push("interviewQuestions: Expected non-empty array.");
  } else {
    value.interviewQuestions.forEach((item, index) => {
      if (!isRecord(item)) {
        errors.push(`interviewQuestions[${index}]: Expected object.`);
        return;
      }

      validateAdditionalProperties(
        item,
        `interviewQuestions[${index}]`,
        ["category", "question", "whatToListenFor"],
        errors,
      );

      for (const key of ["category", "question", "whatToListenFor"] as const) {
        if (!isNonEmptyString(item[key])) {
          errors.push(`interviewQuestions[${index}].${key}: Expected non-empty string.`);
        }
      }
    });
  }

  if (!isRecord(value.onboardingGuidance)) {
    errors.push("onboardingGuidance: Expected object.");
  } else {
    validateAdditionalProperties(
      value.onboardingGuidance,
      "onboardingGuidance",
      ["first30Days", "days60", "days90"],
      errors,
    );

    for (const key of ["first30Days", "days60", "days90"] as const) {
      const items = value.onboardingGuidance[key];

      if (!Array.isArray(items) || items.length === 0) {
        errors.push(`onboardingGuidance.${key}: Expected non-empty array.`);
        continue;
      }

      items.forEach((item, index) => {
        if (!isNonEmptyString(item)) {
          errors.push(`onboardingGuidance.${key}[${index}]: Expected non-empty string.`);
        }
      });
    }
  }

  if (!Array.isArray(value.interpretationLimits) || value.interpretationLimits.length === 0) {
    errors.push("interpretationLimits: Expected non-empty array.");
  } else {
    value.interpretationLimits.forEach((item, index) => {
      if (!isNonEmptyString(item)) {
        errors.push(`interpretationLimits[${index}]: Expected non-empty string.`);
      }
    });
  }

  if (!isRecord(value.safetyChecks)) {
    errors.push("safetyChecks: Expected object.");
  } else {
    validateAdditionalProperties(
      value.safetyChecks,
      "safetyChecks",
      [
        "noIqLanguage",
        "noPercentiles",
        "noNormativeClaims",
        "noHireNoHireDecision",
        "noScoreMutation",
      ],
      errors,
    );

    for (const key of [
      "noIqLanguage",
      "noPercentiles",
      "noNormativeClaims",
      "noHireNoHireDecision",
      "noScoreMutation",
    ] as const) {
      if (value.safetyChecks[key] !== true) {
        errors.push(`safetyChecks.${key}: Expected true.`);
      }
    }
  }

  const expectedInput = options?.expectedInput ?? null;

  if (errors.length === 0 && expectedInput) {
    if (value.testSlug !== expectedInput.test.slug) {
      errors.push("testSlug: Must match deterministic input.");
    }

    if (value.audience !== expectedInput.test.audience) {
      errors.push("audience: Must match deterministic input.");
    }

    if (value.sourceType !== expectedInput.test.sourceType) {
      errors.push("sourceType: Must match deterministic input.");
    }

    if (value.locale !== expectedInput.test.locale) {
      errors.push("locale: Must match deterministic input.");
    }
  }

  if (errors.length === 0) {
    validateForbiddenPhrases(value as SafranHrReportV1, errors);
  }

  if (errors.length === 0) {
    validateHrNarrativeBoundaries(value as SafranHrReportV1, errors);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: value as SafranHrReportV1,
  };
}

export function formatSafranHrReportValidationErrors(errors: string[]): string {
  return errors.join(" | ");
}

export function buildMockSafranHrReportV1(
  input: SafranHrReportInput,
): SafranHrReportV1 {
  const report: SafranHrReportV1 = {
    reportType: SAFRAN_HR_REPORT_V1_TYPE,
    testSlug: SAFRAN_HR_V1_TEST_SLUG,
    audience: SAFRAN_HR_REPORT_AUDIENCE,
    sourceType: SAFRAN_HR_REPORT_SOURCE_TYPE,
    locale: input.test.locale,
    generatedLanguage: input.test.locale,
    executiveSummary: {
      title: "Sažetak za HR čitanje",
      summary:
        "Ovaj rezultat treba čitati kao opreznu HR hipotezu, ne kao zaključak o kandidatu. Rezultat može ukazivati na to da kandidat u ovom setu zadataka pokazuje različit ritam između verbalnog, figuralnog i numeričkog dijela, a ovaj signal treba provjeriti kroz intervju ili radni zadatak i čitati zajedno sa iskustvom, intervjuom i kontekstom uloge.",
    },
    cognitiveSignals: {
      overall:
        "Ukupni rezultat je 26/54. U ovoj procjeni, taj odnos sugeriše neujednačen ritam između tipova zadataka. Za HR je korisno provjeriti kako kandidat održava kvalitet rada kada se format zadatka promijeni.",
      verbal:
        "Verbalni rezultat je 12/18. U ovoj procjeni, taj signal sugeriše stabilnije snalaženje u zadacima sa pisanim pravilima i pojmovima. U intervjuu je korisno provjeriti kako kandidat brzo izdvaja bitno iz pisanih informacija.",
      figural:
        "Figuralni rezultat je 9/18. Ovaj dio rezultata treba čitati kao signal o tome kako je kandidat u ovoj procjeni pratio obrasce među oblicima. Za HR je korisno provjeriti kako osoba prepoznaje vizuelne obrasce u konkretnim radnim zadacima.",
      numeric:
        "Numerički rezultat je 5/18. U ovoj procjeni, taj dio sugeriše da je brojčani niz tražio više provjere prije zaključka. Kroz radni zadatak vrijedi provjeriti kako kandidat radi sa pravilima u tabelama, nizovima ili kvantitativnim podacima.",
    },
    pointsOfCaution: [
      {
        signal: "Ukupni rezultat može sakriti razlike između tipova zadataka.",
        whyItMatters:
          "Ako uloga traži različite oblike rezonovanja, razlika između verbalnog, figuralnog i numeričkog dijela može biti važnija od samog ukupnog utiska.",
        howToCheck:
          "U intervjuu ili kratkom zadatku korisno je provjeriti kako kandidat mijenja pristup kada se format problema promijeni.",
      },
      {
        signal: "Slabiji numerički signal može biti važan ako uloga traži rad sa brojčanim podacima.",
        whyItMatters:
          "Ako posao uključuje tabele, nizove ili kvantitativne odluke, sporije prepoznavanje pravila može uticati na brzinu i sigurnost zaključivanja.",
        howToCheck:
          "Dajte kratak brojčani ili analitički zadatak i tražite da kandidat naglas objasni kako provjerava pravilo prije odluke.",
      },
    ],
    interviewQuestions: [
      {
        category: "Pristup problemu",
        question:
          "Opišite situaciju kada ste morali brzo prepoznati pravilo ili obrazac. Kako ste provjerili da ste ga dobro razumjeli?",
        whatToListenFor:
          "Slušati da li kandidat jasno objašnjava korake provjere, prilagođavanje strategije i kako razlikuje pretpostavku od potvrđenog zaključka.",
      },
      {
        category: "Pisane informacije",
        question:
          "Kada dobijete veću količinu pisanih informacija, kako izdvojite ono što je najvažnije za odluku?",
        whatToListenFor:
          "Slušati kako kandidat strukturira informacije, izdvaja bitno i povezuje tekst sa narednim korakom u radu.",
      },
      {
        category: "Brojčani podaci",
        question:
          "Kako obično provjeravate da ste dobro razumjeli brojčani obrazac ili pravilo prije nego što nastavite dalje?",
        whatToListenFor:
          "Slušati da li kandidat ima jasan način provjere pravila, uočava greške na vrijeme i objašnjava zaključivanje korak po korak.",
      },
    ],
    onboardingGuidance: {
      first30Days: [
        "U prvih 30 dana dati jasne prioritete, očekivane ishode i kratke provjere razumijevanja zadataka.",
      ],
      days60: [
        "Do 60. dana korisno je postepeno širiti složenost zadataka i pratiti kako kandidat objašnjava odluke i provjerava pretpostavke.",
      ],
      days90: [
        "Do 90. dana korisno je povezati signal sa stvarnim radnim primjerima i povratnom informacijom iz konteksta uloge.",
      ],
    },
    interpretationLimits: [
      "Ovaj signal treba čitati kao hipotezu za provjeru, ne kao konačan zaključak o osobi.",
      "Rezultat treba čitati zajedno sa iskustvom, intervjuom i kontekstom uloge.",
    ],
    safetyChecks: {
      noIqLanguage: true,
      noPercentiles: true,
      noNormativeClaims: true,
      noHireNoHireDecision: true,
      noScoreMutation: true,
    },
  };

  const validationResult = validateSafranHrReport(report, {
    expectedInput: input,
  });

  if (!validationResult.ok) {
    throw new Error(
      `Mock SAFRAN HR report failed validation: ${formatSafranHrReportValidationErrors(
        validationResult.errors,
      )}`,
    );
  }

  return validationResult.value;
}
