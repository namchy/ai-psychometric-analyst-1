import type { AssessmentLocale } from "@/lib/assessment/locale";
import type { CompletedAssessmentReportRequest } from "@/lib/assessment/report-providers";
import type { CompletedAssessmentResults } from "@/lib/assessment/scoring";
import {
  buildSafranCandidateInterpretation,
  type SafranBandKey,
  type SafranCandidateInterpretationScores,
} from "@/lib/assessment/safran-interpretation";

export const SAFRAN_V1_TEST_SLUG = "safran_v1" as const;
export const SAFRAN_PARTICIPANT_AI_REPORT_TYPE =
  "safran_participant_ai_report_v1" as const;
export const SAFRAN_PARTICIPANT_REPORT_TYPE = "individual" as const;
export const SAFRAN_PARTICIPANT_REPORT_SOURCE_TYPE = "single_test" as const;
export const SAFRAN_PARTICIPANT_PROMPT_KEY =
  SAFRAN_PARTICIPANT_AI_REPORT_TYPE;

export type SafranAiReportLocale = Extract<
  AssessmentLocale,
  "bs" | "hr" | "sr" | "en"
>;
export type SafranAiBand = "lower" | "moderate" | "higher";
export type SafranAiDomainCode = "verbal" | "figural" | "numeric";

export type SafranAiReportInput = {
  test: {
    slug: typeof SAFRAN_V1_TEST_SLUG;
    displayName: "SAFRAN";
    purpose: string;
    audience: "participant";
    locale: SafranAiReportLocale;
  };
  scores: {
    overall: {
      rawScore: number;
      maxScore: number;
      scoreLabel: string;
      band: SafranAiBand;
      bandLabel: string;
    };
    domains: Array<{
      code: SafranAiDomainCode;
      label: string;
      rawScore: number;
      maxScore: number;
      scoreLabel: string;
      band: SafranAiBand;
      bandLabel: string;
      deterministicMeaning: string;
    }>;
  };
  interpretationBoundaries: {
    noIq: true;
    noPercentiles: true;
    noNorms: true;
    noHireNoHire: true;
    noDiagnosis: true;
    noClinicalClaims: true;
    noFixedAbilityClaims: true;
  };
  reportRules: {
    maxSummarySentences: number;
    maxDomainSentences: number;
    maxSignals: number;
    tone: "neutral_candidate_facing";
  };
};

export type SafranParticipantAiReport = {
  reportType: typeof SAFRAN_PARTICIPANT_AI_REPORT_TYPE;
  testSlug: typeof SAFRAN_V1_TEST_SLUG;
  audience: "participant";
  locale: SafranAiReportLocale;
  generatedLanguage: string;
  header: {
    title: string;
    subtitle: string;
    statusLabel: string;
  };
  summary: {
    title: string;
    scoreLabel: string;
    bandLabel: string;
    interpretation: string;
  };
  domains: [
    {
      code: "verbal";
      title: "Verbalni rezultat";
      scoreLabel: string;
      bandLabel: string;
      interpretation: string;
    },
    {
      code: "figural";
      title: "Figuralni rezultat";
      scoreLabel: string;
      bandLabel: string;
      interpretation: string;
    },
    {
      code: "numeric";
      title: "Numerički rezultat";
      scoreLabel: string;
      bandLabel: string;
      interpretation: string;
    },
  ];
  cognitiveSignals: {
    title: string;
    primarySignal: string;
    cautionSignal: string;
    balanceNote: string;
  };
  readingGuide: {
    title: string;
    bullets: string[];
  };
  nextStep: {
    title: string;
    body: string;
    ctaLabel: string;
  };
  safetyChecks: {
    containsIqClaim: false;
    containsPercentileClaim: false;
    containsNormClaim: false;
    containsHireNoHireClaim: false;
    containsDiagnosisClaim: false;
    containsClinicalClaim: false;
    containsFixedAbilityClaim: false;
  };
};

export const SafranAiReportTextLimits = {
  headerTitleMaxChars: 40,
  headerSubtitleMaxChars: 160,
  summaryInterpretationMaxChars: 420,
  domainInterpretationMaxChars: 360,
  cognitiveSignalMaxChars: 260,
  readingGuideBulletMaxChars: 220,
  nextStepBodyMaxChars: 260,
} as const;

const SAFRAN_AI_DOMAIN_ORDER: SafranAiDomainCode[] = [
  "verbal",
  "figural",
  "numeric",
];

const SAFRAN_AI_DOMAIN_LABELS: Record<SafranAiDomainCode, string> = {
  verbal: "Verbalni rezultat",
  figural: "Figuralni rezultat",
  numeric: "Numerički rezultat",
};

const SAFRAN_AI_DEFAULT_PURPOSE =
  "Kandidat-facing interpretacija rezultata SAFRAN kognitivne procjene.";

const GLOBAL_FORBIDDEN_PATTERNS: Array<{
  pattern: RegExp;
  label: string;
}> = [
  { pattern: /\bV1\b/i, label: "V1" },
  { pattern: /Ukupni kognitivni kompozit/i, label: "Ukupni kognitivni kompozit" },
  { pattern: /Rezultat ne znači/i, label: "Rezultat ne znači" },
  { pattern: /koeficijent inteligencije/i, label: "koeficijent inteligencije" },
  { pattern: /\bpercentile\b/i, label: "percentile" },
  { pattern: /iznadprosječan/i, label: "iznadprosječan" },
  { pattern: /ispodprosječan/i, label: "ispodprosječan" },
  { pattern: /\bpametan\b/i, label: "pametan" },
  { pattern: /\bnepametan\b/i, label: "nepametan" },
  { pattern: /\bsposoban\b/i, label: "sposoban" },
  { pattern: /\bnesposoban\b/i, label: "nesposoban" },
  { pattern: /slab kandidat/i, label: "slab kandidat" },
  { pattern: /dobar kandidat/i, label: "dobar kandidat" },
  { pattern: /\bhire\b/i, label: "hire" },
  { pattern: /\bno-hire\b/i, label: "no-hire" },
  { pattern: /zaposliti/i, label: "zaposliti" },
  { pattern: /ne zaposliti/i, label: "ne zaposliti" },
  { pattern: /dijagnoza/i, label: "dijagnoza" },
  { pattern: /poremećaj/i, label: "poremećaj" },
  { pattern: /klinički/i, label: "klinički" },
  { pattern: /garantuje/i, label: "garantuje" },
  { pattern: /dokazuje/i, label: "dokazuje" },
];

export const safranParticipantAiReportV1OpenAiSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "reportType",
    "testSlug",
    "audience",
    "locale",
    "generatedLanguage",
    "header",
    "summary",
    "domains",
    "cognitiveSignals",
    "readingGuide",
    "nextStep",
    "safetyChecks",
  ],
  properties: {
    reportType: {
      type: "string",
      const: SAFRAN_PARTICIPANT_AI_REPORT_TYPE,
    },
    testSlug: {
      type: "string",
      const: SAFRAN_V1_TEST_SLUG,
    },
    audience: {
      type: "string",
      const: "participant",
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
    header: {
      type: "object",
      additionalProperties: false,
      required: ["title", "subtitle", "statusLabel"],
      properties: {
        title: { type: "string", const: "SAFRAN" },
        subtitle: {
          type: "string",
          minLength: 1,
          maxLength: SafranAiReportTextLimits.headerSubtitleMaxChars,
        },
        statusLabel: { type: "string", minLength: 1, maxLength: 40 },
      },
    },
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["title", "scoreLabel", "bandLabel", "interpretation"],
      properties: {
        title: { type: "string", minLength: 1, maxLength: 80 },
        scoreLabel: { type: "string", minLength: 3, maxLength: 20 },
        bandLabel: { type: "string", minLength: 1, maxLength: 120 },
        interpretation: {
          type: "string",
          minLength: 1,
          maxLength: SafranAiReportTextLimits.summaryInterpretationMaxChars,
        },
      },
    },
    domains: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "title", "scoreLabel", "bandLabel", "interpretation"],
        properties: {
          code: {
            type: "string",
            enum: SAFRAN_AI_DOMAIN_ORDER,
          },
          title: {
            type: "string",
            enum: [
              SAFRAN_AI_DOMAIN_LABELS.verbal,
              SAFRAN_AI_DOMAIN_LABELS.figural,
              SAFRAN_AI_DOMAIN_LABELS.numeric,
            ],
          },
          scoreLabel: { type: "string", minLength: 3, maxLength: 20 },
          bandLabel: { type: "string", minLength: 1, maxLength: 120 },
          interpretation: {
            type: "string",
            minLength: 1,
            maxLength: SafranAiReportTextLimits.domainInterpretationMaxChars,
          },
        },
      },
    },
    cognitiveSignals: {
      type: "object",
      additionalProperties: false,
      required: ["title", "primarySignal", "cautionSignal", "balanceNote"],
      properties: {
        title: { type: "string", minLength: 1, maxLength: 80 },
        primarySignal: {
          type: "string",
          minLength: 1,
          maxLength: SafranAiReportTextLimits.cognitiveSignalMaxChars,
        },
        cautionSignal: {
          type: "string",
          minLength: 1,
          maxLength: SafranAiReportTextLimits.cognitiveSignalMaxChars,
        },
        balanceNote: {
          type: "string",
          minLength: 1,
          maxLength: SafranAiReportTextLimits.cognitiveSignalMaxChars,
        },
      },
    },
    readingGuide: {
      type: "object",
      additionalProperties: false,
      required: ["title", "bullets"],
      properties: {
        title: { type: "string", minLength: 1, maxLength: 80 },
        bullets: {
          type: "array",
          minItems: 4,
          maxItems: 6,
          items: {
            type: "string",
            minLength: 1,
            maxLength: SafranAiReportTextLimits.readingGuideBulletMaxChars,
          },
        },
      },
    },
    nextStep: {
      type: "object",
      additionalProperties: false,
      required: ["title", "body", "ctaLabel"],
      properties: {
        title: { type: "string", minLength: 1, maxLength: 80 },
        body: {
          type: "string",
          minLength: 1,
          maxLength: SafranAiReportTextLimits.nextStepBodyMaxChars,
        },
        ctaLabel: { type: "string", minLength: 1, maxLength: 80 },
      },
    },
    safetyChecks: {
      type: "object",
      additionalProperties: false,
      required: [
        "containsIqClaim",
        "containsPercentileClaim",
        "containsNormClaim",
        "containsHireNoHireClaim",
        "containsDiagnosisClaim",
        "containsClinicalClaim",
        "containsFixedAbilityClaim",
      ],
      properties: {
        containsIqClaim: { type: "boolean", const: false },
        containsPercentileClaim: { type: "boolean", const: false },
        containsNormClaim: { type: "boolean", const: false },
        containsHireNoHireClaim: { type: "boolean", const: false },
        containsDiagnosisClaim: { type: "boolean", const: false },
        containsClinicalClaim: { type: "boolean", const: false },
        containsFixedAbilityClaim: { type: "boolean", const: false },
      },
    },
  },
} as const satisfies Record<string, unknown>;

export const SAFRAN_PARTICIPANT_AI_REPORT_CONTRACT = {
  family: "safran",
  reportType: SAFRAN_PARTICIPANT_REPORT_TYPE,
  sourceType: SAFRAN_PARTICIPANT_REPORT_SOURCE_TYPE,
  promptKey: SAFRAN_PARTICIPANT_PROMPT_KEY,
  schemaId: "safran-participant-ai-report-v1",
  outputSchemaJson:
    safranParticipantAiReportV1OpenAiSchema as Record<string, unknown>,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidLocale(value: unknown): value is SafranAiReportLocale {
  return value === "bs" || value === "hr" || value === "sr" || value === "en";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function mapSafranBandKeyToAiBand(bandKey: SafranBandKey): SafranAiBand {
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

function parseScoreLabel(scoreLabel: string): { rawScore: number; maxScore: number } | null {
  const match = scoreLabel.match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/);

  if (!match) {
    return null;
  }

  const rawScore = Number.parseFloat(match[1]);
  const maxScore = Number.parseFloat(match[2]);

  if (!Number.isFinite(rawScore) || !Number.isFinite(maxScore)) {
    return null;
  }

  return { rawScore, maxScore };
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

function requireInterpretationScore(
  score: number | null | undefined,
  label: string,
): number {
  if (!isFiniteNumber(score)) {
    throw new Error(`SAFRAN participant AI input requires ${label}.`);
  }

  return score;
}

function getRequiredDomainInterpretation(
  interpretation: ReturnType<typeof buildSafranCandidateInterpretation>,
  scoreKey: "verbal_score" | "figural_score" | "numerical_series_score",
) {
  const domain = interpretation.domains.find((item) => item.scoreKey === scoreKey);

  if (!domain) {
    throw new Error(`Missing SAFRAN interpretation domain for ${scoreKey}.`);
  }

  return domain;
}

export function isSafranTestSlug(testSlug: string): boolean {
  return testSlug === SAFRAN_V1_TEST_SLUG;
}

export function buildSafranParticipantAiReportInput(
  request: Pick<
    CompletedAssessmentReportRequest,
    "testSlug" | "locale" | "results"
  >,
): SafranAiReportInput {
  if (!isSafranTestSlug(request.testSlug)) {
    throw new Error(
      `SAFRAN participant AI input builder requires ${SAFRAN_V1_TEST_SLUG}.`,
    );
  }

  const scores = getSafranDerivedScores(request.results);
  const interpretation = buildSafranCandidateInterpretation(scores);
  const overall = interpretation.overall;

  if (!overall) {
    throw new Error("SAFRAN participant AI input requires complete overall interpretation.");
  }

  const domains = [
    {
      code: "verbal" as const,
      label: "Verbalni rezultat",
      scoreKey: "verbal_score" as const,
      maxScore: 18,
    },
    {
      code: "figural" as const,
      label: "Figuralni rezultat",
      scoreKey: "figural_score" as const,
      maxScore: 18,
    },
    {
      code: "numeric" as const,
      label: "Numerički rezultat",
      scoreKey: "numerical_series_score" as const,
      maxScore: 18,
    },
  ].map((domain) => {
    const interpretationDomain = getRequiredDomainInterpretation(
      interpretation,
      domain.scoreKey,
    );
    const rawScore = requireInterpretationScore(
      scores[domain.scoreKey],
      domain.scoreKey,
    );

    return {
      code: domain.code,
      label: domain.label,
      rawScore,
      maxScore: domain.maxScore,
      scoreLabel: formatScoreLabel(rawScore, domain.maxScore),
      band: mapSafranBandKeyToAiBand(interpretationDomain.bandKey),
      bandLabel: interpretationDomain.bandLabelBs,
      deterministicMeaning: interpretationDomain.textBs,
    };
  });

  const locale = isValidLocale(request.locale) ? request.locale : "bs";
  const overallScore = requireInterpretationScore(
    scores.cognitive_composite_v1,
    "cognitive_composite_v1",
  );

  return {
    test: {
      slug: SAFRAN_V1_TEST_SLUG,
      displayName: "SAFRAN",
      purpose: SAFRAN_AI_DEFAULT_PURPOSE,
      audience: "participant",
      locale,
    },
    scores: {
      overall: {
        rawScore: overallScore,
        maxScore: overall.maxPossible,
        scoreLabel: formatScoreLabel(overallScore, overall.maxPossible),
        band: mapSafranBandKeyToAiBand(overall.bandKey),
        bandLabel: overall.bandLabelBs,
      },
      domains,
    },
    interpretationBoundaries: {
      noIq: true,
      noPercentiles: true,
      noNorms: true,
      noHireNoHire: true,
      noDiagnosis: true,
      noClinicalClaims: true,
      noFixedAbilityClaims: true,
    },
    reportRules: {
      maxSummarySentences: 2,
      maxDomainSentences: 2,
      maxSignals: 3,
      tone: "neutral_candidate_facing",
    },
  };
}

function validateAllowedReadingGuideBoundary(
  bullet: string,
  errors: string[],
  index: number,
): void {
  const normalized = bullet.toLowerCase();
  const mentionsIq = /\biq\b/i.test(bullet);
  const mentionsPercentil = /percentil/i.test(bullet);

  if (
    mentionsIq &&
    !/(nije iq|ne predstavlja iq|ne predstavljaju iq|ne predstavlja mjeru opšte inteligencije)/i.test(
      bullet,
    )
  ) {
    errors.push(
      `readingGuide.bullets[${index}]: IQ is allowed only in a limiting context.`,
    );
  }

  if (
    mentionsPercentil &&
    !/(nije percentil|nisu percentili|ne predstavlja percentil)/i.test(bullet)
  ) {
    errors.push(
      `readingGuide.bullets[${index}]: percentil is allowed only in a limiting context.`,
    );
  }

  if (/percentile/i.test(normalized)) {
    errors.push(`readingGuide.bullets[${index}]: English "percentile" is not allowed.`);
  }
}

function validateForbiddenPhrases(
  report: SafranParticipantAiReport,
  errors: string[],
): void {
  const generalTexts = [
    report.header.title,
    report.header.subtitle,
    report.header.statusLabel,
    report.summary.title,
    report.summary.scoreLabel,
    report.summary.bandLabel,
    report.summary.interpretation,
    ...report.domains.flatMap((domain) => [
      domain.code,
      domain.title,
      domain.scoreLabel,
      domain.bandLabel,
      domain.interpretation,
    ]),
    report.cognitiveSignals.title,
    report.cognitiveSignals.primarySignal,
    report.cognitiveSignals.cautionSignal,
    report.cognitiveSignals.balanceNote,
    report.readingGuide.title,
    report.nextStep.title,
    report.nextStep.body,
    report.nextStep.ctaLabel,
  ];

  for (const text of generalTexts) {
    if (/\biq\b/i.test(text)) {
      errors.push(`Forbidden IQ mention outside reading guide: ${text}`);
    }

    if (/percentil/i.test(text) || /percentile/i.test(text)) {
      errors.push(`Forbidden percentile mention outside reading guide: ${text}`);
    }

    for (const { pattern, label } of GLOBAL_FORBIDDEN_PATTERNS) {
      if (pattern.test(text)) {
        errors.push(`Forbidden phrase "${label}" found in report text: ${text}`);
      }
    }
  }

  report.readingGuide.bullets.forEach((bullet, index) => {
    for (const { pattern, label } of GLOBAL_FORBIDDEN_PATTERNS) {
      if (pattern.test(bullet)) {
        errors.push(
          `Forbidden phrase "${label}" found in readingGuide.bullets[${index}]: ${bullet}`,
        );
      }
    }

    validateAllowedReadingGuideBoundary(bullet, errors, index);
  });
}

function validateReadingGuideCoverage(
  bullets: string[],
  errors: string[],
): void {
  const combined = bullets.join(" ").toLowerCase();

  if (
    !/(nije iq|ne predstavlja iq|ne predstavljaju iq|ne predstavlja mjeru opšte inteligencije|ne predstavljaju mjeru opšte inteligencije)/i.test(
      combined,
    )
  ) {
    errors.push("readingGuide.bullets: Missing IQ boundary.");
  }

  if (
    !/(nije percentil|nisu percentili|ne predstavlja poređenje s lokalnom referentnom grupom|ne predstavlja poređenje s lokalnom normativnom grupom|ne predstavlja lokalno poređenje|ne predstavlja lokalnim poređenjem)/i.test(
      combined,
    )
  ) {
    errors.push("readingGuide.bullets: Missing percentile or local comparison boundary.");
  }

  if (
    !/(nema lokalnih normi|nema lokalnih referentnih poređenja|ne predstavlja poređenje s lokalnom referentnom grupom|ne predstavlja poređenje s lokalnom normativnom grupom|ne predstavlja lokalno poređenje|ne predstavlja lokalnim poređenjem)/i.test(
      combined,
    )
  ) {
    errors.push("readingGuide.bullets: Missing local norms boundary.");
  }

  if (
    !/(nije samostalna odluka o kandidatu|ne treba koristiti kao samostalnu odluku o kandidatu|ne treba koristiti kao samostalna odluka o kandidatu|nije samostalna osnova za odluku o kandidatu|nije samostalna osnova za odluku|ne treba koristiti kao jedinu osnovu)/i.test(
      combined,
    )
  ) {
    errors.push("readingGuide.bullets: Missing standalone decision boundary.");
  }

  if (
    !/practice pitanja .*ne ulaze u scoring|practice pitanja .*ne ulaze u rezultat|practice pitanja .*ne ulaze u ove rezultate|probna pitanja .*ne ulaze u scoring|probna pitanja .*ne ulaze u rezultat|probna pitanja .*ne ulaze u ove rezultate/i.test(
      combined,
    )
  ) {
    errors.push("readingGuide.bullets: Missing practice boundary.");
  }

  if (!/deep profile procjene/i.test(combined)) {
    errors.push("readingGuide.bullets: Missing Deep Profile context note.");
  }
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

export function validateSafranParticipantAiReport(
  value: unknown,
  options?: {
    expectedInput?: SafranAiReportInput | null;
  },
): { ok: true; value: SafranParticipantAiReport } | { ok: false; errors: string[] } {
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
      "locale",
      "generatedLanguage",
      "header",
      "summary",
      "domains",
      "cognitiveSignals",
      "readingGuide",
      "nextStep",
      "safetyChecks",
    ],
    errors,
  );

  if (value.reportType !== SAFRAN_PARTICIPANT_AI_REPORT_TYPE) {
    errors.push(`reportType: Expected ${SAFRAN_PARTICIPANT_AI_REPORT_TYPE}.`);
  }

  if (value.testSlug !== SAFRAN_V1_TEST_SLUG) {
    errors.push(`testSlug: Expected ${SAFRAN_V1_TEST_SLUG}.`);
  }

  if (value.audience !== "participant") {
    errors.push("audience: Expected participant.");
  }

  if (!isValidLocale(value.locale)) {
    errors.push("locale: Expected bs, hr, sr or en.");
  }

  if (!isNonEmptyString(value.generatedLanguage)) {
    errors.push("generatedLanguage: Expected non-empty string.");
  }

  if (!isRecord(value.header)) {
    errors.push("header: Expected object.");
  } else {
    validateAdditionalProperties(
      value.header,
      "header",
      ["title", "subtitle", "statusLabel"],
      errors,
    );

    if (value.header.title !== "SAFRAN") {
      errors.push('header.title: Expected exact value "SAFRAN".');
    }

    if (
      !isNonEmptyString(value.header.subtitle) ||
      value.header.subtitle.length > SafranAiReportTextLimits.headerSubtitleMaxChars
    ) {
      errors.push("header.subtitle: Expected short non-empty string.");
    }

    if (!isNonEmptyString(value.header.statusLabel)) {
      errors.push("header.statusLabel: Expected non-empty string.");
    }
  }

  if (!isRecord(value.summary)) {
    errors.push("summary: Expected object.");
  } else {
    validateAdditionalProperties(
      value.summary,
      "summary",
      ["title", "scoreLabel", "bandLabel", "interpretation"],
      errors,
    );

    if (!isNonEmptyString(value.summary.title)) {
      errors.push("summary.title: Expected non-empty string.");
    }

    if (!isNonEmptyString(value.summary.scoreLabel)) {
      errors.push("summary.scoreLabel: Expected non-empty string.");
    }

    if (!isNonEmptyString(value.summary.bandLabel)) {
      errors.push("summary.bandLabel: Expected non-empty string.");
    }

    if (
      !isNonEmptyString(value.summary.interpretation) ||
      value.summary.interpretation.length >
        SafranAiReportTextLimits.summaryInterpretationMaxChars
    ) {
      errors.push("summary.interpretation: Expected bounded non-empty string.");
    }
  }

  if (!Array.isArray(value.domains)) {
    errors.push("domains: Expected array.");
  } else {
    if (value.domains.length !== 3) {
      errors.push("domains: Expected exactly 3 items.");
    }

    value.domains.forEach((domain, index) => {
      const expectedCode = SAFRAN_AI_DOMAIN_ORDER[index];

      if (!isRecord(domain)) {
        errors.push(`domains[${index}]: Expected object.`);
        return;
      }

      validateAdditionalProperties(
        domain,
        `domains[${index}]`,
        ["code", "title", "scoreLabel", "bandLabel", "interpretation"],
        errors,
      );

      if (domain.code !== expectedCode) {
        errors.push(
          `domains[${index}].code: Expected ${expectedCode} at position ${index}.`,
        );
      }

      if (domain.title !== SAFRAN_AI_DOMAIN_LABELS[expectedCode]) {
        errors.push(
          `domains[${index}].title: Expected ${SAFRAN_AI_DOMAIN_LABELS[expectedCode]}.`,
        );
      }

      if (!isNonEmptyString(domain.scoreLabel)) {
        errors.push(`domains[${index}].scoreLabel: Expected non-empty string.`);
      }

      if (!isNonEmptyString(domain.bandLabel)) {
        errors.push(`domains[${index}].bandLabel: Expected non-empty string.`);
      }

      if (
        !isNonEmptyString(domain.interpretation) ||
        domain.interpretation.length >
          SafranAiReportTextLimits.domainInterpretationMaxChars
      ) {
        errors.push(
          `domains[${index}].interpretation: Expected bounded non-empty string.`,
        );
      }
    });
  }

  if (!isRecord(value.cognitiveSignals)) {
    errors.push("cognitiveSignals: Expected object.");
  } else {
    validateAdditionalProperties(
      value.cognitiveSignals,
      "cognitiveSignals",
      ["title", "primarySignal", "cautionSignal", "balanceNote"],
      errors,
    );

    for (const key of [
      "title",
      "primarySignal",
      "cautionSignal",
      "balanceNote",
    ] as const) {
      if (!isNonEmptyString(value.cognitiveSignals[key])) {
        errors.push(`cognitiveSignals.${key}: Expected non-empty string.`);
      }
    }

    for (const key of [
      "primarySignal",
      "cautionSignal",
      "balanceNote",
    ] as const) {
      const text = value.cognitiveSignals[key];

      if (
        typeof text === "string" &&
        text.length > SafranAiReportTextLimits.cognitiveSignalMaxChars
      ) {
        errors.push(`cognitiveSignals.${key}: Exceeds max char limit.`);
      }
    }
  }

  if (!isRecord(value.readingGuide)) {
    errors.push("readingGuide: Expected object.");
  } else {
    validateAdditionalProperties(
      value.readingGuide,
      "readingGuide",
      ["title", "bullets"],
      errors,
    );

    if (!isNonEmptyString(value.readingGuide.title)) {
      errors.push("readingGuide.title: Expected non-empty string.");
    }

    if (!Array.isArray(value.readingGuide.bullets)) {
      errors.push("readingGuide.bullets: Expected array.");
    } else {
      if (
        value.readingGuide.bullets.length < 4 ||
        value.readingGuide.bullets.length > 6
      ) {
        errors.push("readingGuide.bullets: Expected 4-6 items.");
      }

      value.readingGuide.bullets.forEach((bullet, index) => {
        if (
          !isNonEmptyString(bullet) ||
          bullet.length > SafranAiReportTextLimits.readingGuideBulletMaxChars
        ) {
          errors.push(
            `readingGuide.bullets[${index}]: Expected bounded non-empty string.`,
          );
        }
      });

      validateReadingGuideCoverage(value.readingGuide.bullets as string[], errors);
    }
  }

  if (!isRecord(value.nextStep)) {
    errors.push("nextStep: Expected object.");
  } else {
    validateAdditionalProperties(
      value.nextStep,
      "nextStep",
      ["title", "body", "ctaLabel"],
      errors,
    );

    if (!isNonEmptyString(value.nextStep.title)) {
      errors.push("nextStep.title: Expected non-empty string.");
    }

    if (
      !isNonEmptyString(value.nextStep.body) ||
      value.nextStep.body.length > SafranAiReportTextLimits.nextStepBodyMaxChars
    ) {
      errors.push("nextStep.body: Expected bounded non-empty string.");
    }

    if (!isNonEmptyString(value.nextStep.ctaLabel)) {
      errors.push("nextStep.ctaLabel: Expected non-empty string.");
    }
  }

  if (!isRecord(value.safetyChecks)) {
    errors.push("safetyChecks: Expected object.");
  } else {
    validateAdditionalProperties(
      value.safetyChecks,
      "safetyChecks",
      [
        "containsIqClaim",
        "containsPercentileClaim",
        "containsNormClaim",
        "containsHireNoHireClaim",
        "containsDiagnosisClaim",
        "containsClinicalClaim",
        "containsFixedAbilityClaim",
      ],
      errors,
    );

    for (const key of [
      "containsIqClaim",
      "containsPercentileClaim",
      "containsNormClaim",
      "containsHireNoHireClaim",
      "containsDiagnosisClaim",
      "containsClinicalClaim",
      "containsFixedAbilityClaim",
    ] as const) {
      if (value.safetyChecks[key] !== false) {
        errors.push(`safetyChecks.${key}: Expected false.`);
      }
    }
  }

  if (errors.length === 0) {
    validateForbiddenPhrases(value as SafranParticipantAiReport, errors);
  }

  const expectedInput = options?.expectedInput ?? null;

  if (
    errors.length === 0 &&
    expectedInput &&
    isRecord(value.summary) &&
    Array.isArray(value.domains)
  ) {
    if (value.summary.scoreLabel !== expectedInput.scores.overall.scoreLabel) {
      errors.push("summary.scoreLabel: Must match deterministic input.");
    }

    if (value.summary.bandLabel !== expectedInput.scores.overall.bandLabel) {
      errors.push("summary.bandLabel: Must match deterministic input.");
    }

    value.domains.forEach((domain, index) => {
      const expectedDomain = expectedInput.scores.domains[index];

      if (!isRecord(domain) || !expectedDomain) {
        return;
      }

      if (domain.scoreLabel !== expectedDomain.scoreLabel) {
        errors.push(`domains[${index}].scoreLabel: Must match deterministic input.`);
      }

      if (domain.bandLabel !== expectedDomain.bandLabel) {
        errors.push(`domains[${index}].bandLabel: Must match deterministic input.`);
      }
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: value as SafranParticipantAiReport,
  };
}

export function formatSafranParticipantAiReportValidationErrors(
  errors: string[],
): string {
  return errors.join(" | ");
}

export function buildMockSafranParticipantAiReport(
  input: SafranAiReportInput,
): SafranParticipantAiReport {
  const [verbal, figural, numeric] = input.scores.domains;

  const report: SafranParticipantAiReport = {
    reportType: SAFRAN_PARTICIPANT_AI_REPORT_TYPE,
    testSlug: SAFRAN_V1_TEST_SLUG,
    audience: "participant",
    locale: input.test.locale,
    generatedLanguage: input.test.locale,
    header: {
      title: "SAFRAN",
      subtitle:
        "Kognitivna procjena kroz verbalne, figuralne i numeričke zadatke.",
      statusLabel: "Završeno",
    },
    summary: {
      title: "Sažetak rezultata",
      scoreLabel: input.scores.overall.scoreLabel,
      bandLabel: input.scores.overall.bandLabel,
      interpretation:
        "Ukupni rezultat pokazuje kako je ovaj pokušaj izgledao kroz tri tipa SAFRAN zadataka. Najkorisnije ga je čitati zajedno s pregledom po oblastima, bez širenja značenja izvan ovog testa.",
    },
    domains: [
      {
        code: "verbal",
        title: "Verbalni rezultat",
        scoreLabel: verbal.scoreLabel,
        bandLabel: verbal.bandLabel,
        interpretation:
          "Ovaj dio opisuje učinak na zadacima koji traže razumijevanje riječi, pojmova i odnosa među njima. Rezultat govori o ovom tipu zadataka u SAFRAN formatu, a ne o osobi u cjelini.",
      },
      {
        code: "figural",
        title: "Figuralni rezultat",
        scoreLabel: figural.scoreLabel,
        bandLabel: figural.bandLabel,
        interpretation:
          "Ovaj dio opisuje učinak na zadacima prepoznavanja obrazaca i odnosa među oblicima. Najkorisniji je kao signal za to kako je ovaj pokušaj izgledao u vizuelno-obrasnim zadacima.",
      },
      {
        code: "numeric",
        title: "Numerički rezultat",
        scoreLabel: numeric.scoreLabel,
        bandLabel: numeric.bandLabel,
        interpretation:
          "Ovaj dio opisuje učinak na numeričkim nizovima u kojima je trebalo prepoznati pravilo. Rezultat treba vezati za ovaj format zadataka, bez zaključka o fiksnoj sposobnosti.",
      },
    ],
    cognitiveSignals: {
      title: "Profil kognitivnih signala",
      primarySignal:
        "Relativno jači signal vrijedi tražiti tamo gdje je unutar ovog testa bilo više tačnih odgovora i stabilniji ritam rješavanja.",
      cautionSignal:
        "Mirniji rezultat u jednoj oblasti ne treba čitati odvojeno od formata zadataka, vremena i ukupnog rasporeda rezultata.",
      balanceNote:
        "Najviše smisla ima uporediti verbalni, figuralni i numerički dio kao tri povezana signala iz istog pokušaja.",
    },
    readingGuide: {
      title: "Kako čitati ove rezultate",
      bullets: [
        "Ovi rezultati prikazuju učinak u SAFRAN zadacima i ne predstavljaju mjeru opšte inteligencije.",
        "Ovaj rezultat nije percentil i ne predstavlja poređenje s lokalnom referentnom grupom.",
        "Practice pitanja služe samo za upoznavanje s formatom zadataka i ne ulaze u scoring.",
        "SAFRAN rezultat ne treba koristiti kao samostalnu odluku o kandidatu.",
        "Najkorisnije ga je čitati zajedno s ostalim dijelovima Deep Profile procjene.",
      ],
    },
    nextStep: {
      title: "Sljedeći korak",
      body:
        "Za potpuniju sliku, ovaj rezultat poveži s iskustvom, interesima i ostalim nalazima iz procjene prije nego što zaključiš šta ti je u ovim zadacima djelovalo prirodnije.",
      ctaLabel: "Nazad na pregled",
    },
    safetyChecks: {
      containsIqClaim: false,
      containsPercentileClaim: false,
      containsNormClaim: false,
      containsHireNoHireClaim: false,
      containsDiagnosisClaim: false,
      containsClinicalClaim: false,
      containsFixedAbilityClaim: false,
    },
  };

  const validationResult = validateSafranParticipantAiReport(report, {
    expectedInput: input,
  });

  if (!validationResult.ok) {
    throw new Error(
      `Mock SAFRAN participant AI report failed validation: ${formatSafranParticipantAiReportValidationErrors(
        validationResult.errors,
      )}`,
    );
  }

  return validationResult.value;
}

export function extractSafranParticipantAiDisplayScores(
  results: CompletedAssessmentResults | null,
): SafranCandidateInterpretationScores {
  if (!results) {
    return {
      verbal_score: null,
      figural_score: null,
      numerical_series_score: null,
      cognitive_composite_v1: null,
    };
  }

  return getSafranDerivedScores(results);
}

export function parseSafranAiScoreLabel(
  scoreLabel: string,
): { rawScore: number; maxScore: number } | null {
  return parseScoreLabel(scoreLabel);
}
