import type { AssessmentLocale } from "@/lib/assessment/locale";
import {
  MWMS_DIMENSION_CODES,
  MWMS_V1_TEST_SLUG,
  type MwmsDimensionCode,
} from "@/lib/assessment/mwms-scoring";
import mwmsHrReportV1SchemaJson from "@/lib/assessment/schemas/mwms-hr-report-v1.json";
import { formatDimensionLabel } from "@/lib/assessment/result-display";
import type { CompletedAssessmentResults } from "@/lib/assessment/scoring";
import type { ScoringMethod } from "@/lib/assessment/types";

export const MWMS_HR_REPORT_CONTRACT_VERSION = "mwms_hr_report_v1" as const;
export const MWMS_HR_REPORT_TYPE = "mwms_hr_report_v1" as const;
export const MWMS_HR_REPORT_AUDIENCE = "hr" as const;
export const MWMS_HR_REPORT_SOURCE_TYPE = "single_test" as const;
export const MWMS_HR_REPORT_REPORT_TYPE = "individual" as const;
export const MWMS_HR_REPORT_PROMPT_KEY = MWMS_HR_REPORT_TYPE;

export type MwmsHrReportLocale = Extract<AssessmentLocale, "bs" | "hr" | "sr" | "en">;
export type MwmsHrBand = "lower" | "moderate" | "higher";

export type MwmsHrDimensionSnapshot = {
  code: MwmsDimensionCode;
  label: string;
  rawScore: number;
  band: MwmsHrBand;
  bandLabel: string;
};

export type MwmsHrDimensionPromptInput = MwmsHrDimensionSnapshot & {
  interpretationHint: string;
};

export type MwmsHrDerivedProfile = {
  autonomousMotivationScore: number;
  controlledMotivationScore: number;
  amotivationScore: number;
  dominantDimensions: [MwmsDimensionCode, MwmsDimensionCode];
  lowerDimensions: [MwmsDimensionCode, MwmsDimensionCode];
  cautionFlags: {
    elevatedAmotivation: boolean;
    highControlledRelativeToAutonomous: boolean;
    mixedProfile: boolean;
  };
};

export type MwmsHrReportInput = {
  attemptId: string;
  testId: string;
  testSlug: typeof MWMS_V1_TEST_SLUG;
  audience: typeof MWMS_HR_REPORT_AUDIENCE;
  reportType: typeof MWMS_HR_REPORT_REPORT_TYPE;
  sourceType: typeof MWMS_HR_REPORT_SOURCE_TYPE;
  locale: MwmsHrReportLocale;
  scoringMethod: ScoringMethod;
  promptVersion: string;
  scale: {
    min: 1;
    max: 7;
  };
  dimensions: [
    MwmsHrDimensionPromptInput,
    MwmsHrDimensionPromptInput,
    MwmsHrDimensionPromptInput,
    MwmsHrDimensionPromptInput,
    MwmsHrDimensionPromptInput,
    MwmsHrDimensionPromptInput,
  ];
  derivedProfile: MwmsHrDerivedProfile;
  interpretationBoundaries: {
    noScoreRecalculation: true;
    noScoreMutation: true;
    noHiringDecision: true;
    noDiagnosis: true;
    noCompositeInsight: true;
    useAsHrHypotheses: true;
  };
};

export type MwmsHrSignal = {
  title: string;
  evidence: string;
  hrImplication: string;
};

export type MwmsHrFrictionPoint = {
  signal: string;
  whyItMayMatter: string;
  howToCheck: string;
};

export type MwmsHrWorkContextHypothesis = {
  context: string;
  hypothesis: string;
  verification: string;
};

export type MwmsHrManagerGuidance = {
  focus: string;
  recommendation: string;
  rationale: string;
};

export type MwmsHrInterviewQuestion = {
  question: string;
  evaluates: string;
  whatToListenFor: string;
};

export type MwmsHrOnboardingRecommendation = {
  phase: string;
  recommendation: string;
  why: string;
};

export type MwmsHrReportV1 = {
  contractVersion: typeof MWMS_HR_REPORT_CONTRACT_VERSION;
  reportType: typeof MWMS_HR_REPORT_TYPE;
  testSlug: typeof MWMS_V1_TEST_SLUG;
  audience: typeof MWMS_HR_REPORT_AUDIENCE;
  sourceType: typeof MWMS_HR_REPORT_SOURCE_TYPE;
  locale: MwmsHrReportLocale;
  meta: {
    language: string;
    generatedAt: string;
  };
  motivation_profile_snapshot: {
    scale: {
      min: 1;
      max: 7;
    };
    dimensions: [
      MwmsHrDimensionSnapshot,
      MwmsHrDimensionSnapshot,
      MwmsHrDimensionSnapshot,
      MwmsHrDimensionSnapshot,
      MwmsHrDimensionSnapshot,
      MwmsHrDimensionSnapshot,
    ];
    derivedProfile: MwmsHrDerivedProfile;
  };
  key_motivational_drivers: [MwmsHrSignal, MwmsHrSignal, MwmsHrSignal];
  potential_friction_points: [MwmsHrFrictionPoint, MwmsHrFrictionPoint, MwmsHrFrictionPoint];
  work_context_hypotheses: [
    MwmsHrWorkContextHypothesis,
    MwmsHrWorkContextHypothesis,
    MwmsHrWorkContextHypothesis,
  ];
  manager_support_guidance: [
    MwmsHrManagerGuidance,
    MwmsHrManagerGuidance,
    MwmsHrManagerGuidance,
    MwmsHrManagerGuidance,
  ];
  interview_questions: [
    MwmsHrInterviewQuestion,
    MwmsHrInterviewQuestion,
    MwmsHrInterviewQuestion,
    MwmsHrInterviewQuestion,
    MwmsHrInterviewQuestion,
  ];
  onboarding_recommendations: [
    MwmsHrOnboardingRecommendation,
    MwmsHrOnboardingRecommendation,
    MwmsHrOnboardingRecommendation,
    MwmsHrOnboardingRecommendation,
  ];
  decision_support_note: [string, string, ...string[]];
  interpretation_note: string;
  safety_checks: {
    noScoreRecalculation: true;
    noScoreMutation: true;
    noHireNoHireDecision: true;
    noDiagnosticLanguage: true;
    hypothesesOnly: true;
    singleTestOnly: true;
  };
};

export const mwmsHrReportV1OpenAiSchema = mwmsHrReportV1SchemaJson;

export const MWMS_HR_REPORT_V1_CONTRACT = {
  family: "mwms",
  reportType: MWMS_HR_REPORT_REPORT_TYPE,
  sourceType: MWMS_HR_REPORT_SOURCE_TYPE,
  promptKey: MWMS_HR_REPORT_PROMPT_KEY,
  schemaId: "mwms-hr-report-v1",
  schemaPath: "@/lib/assessment/schemas/mwms-hr-report-v1.json",
  outputSchemaJson: mwmsHrReportV1SchemaJson,
} as const;

const MWMS_HR_DIMENSION_HINTS: Record<MwmsDimensionCode, string> = {
  amotivation:
    "Signal slabije jasnoce, energije ili povezanosti izmedju posla i razloga za ulaganje truda.",
  external_social:
    "Signal motivacije vezane za priznanje, odobravanje, reputaciju ili izbjegavanje kritike drugih.",
  external_material:
    "Signal motivacije vezane za materijalne ishode, sigurnost, nagrade ili prakticne vanjske koristi.",
  introjected:
    "Signal motivacije kroz unutrasnji pritisak, obavezu, dokazivanje sebi, ponos ili stid.",
  identified:
    "Signal motivacije kroz prepoznavanje vrijednosti, svrhe ili vaznosti posla.",
  intrinsic:
    "Signal motivacije kroz interes, zadovoljstvo, radoznalost ili unutrasnji angazman u samom radu.",
};

const FORBIDDEN_REPORT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /hire\/no-hire/i, label: "hire/no-hire" },
  { pattern: /\bhire\b/i, label: "hire" },
  { pattern: /\bno-hire\b/i, label: "no-hire" },
  { pattern: /hiring score/i, label: "hiring score" },
  { pattern: /fit score/i, label: "fit score" },
  { pattern: /preporucuje se zaposljavanje/i, label: "preporucuje se zaposljavanje" },
  { pattern: /preporučuje se zapošljavanje/i, label: "preporučuje se zapošljavanje" },
  { pattern: /ne preporucuje se zaposljavanje/i, label: "ne preporucuje se zaposljavanje" },
  { pattern: /ne preporučuje se zapošljavanje/i, label: "ne preporučuje se zapošljavanje" },
  { pattern: /zaposliti kandidata/i, label: "zaposliti kandidata" },
  { pattern: /ne zaposliti kandidata/i, label: "ne zaposliti kandidata" },
  { pattern: /idealan kandidat/i, label: "idealan kandidat" },
  { pattern: /idealni kandidat/i, label: "idealni kandidat" },
  { pattern: /los kandidat/i, label: "los kandidat" },
  { pattern: /loš kandidat/i, label: "loš kandidat" },
  { pattern: /slab kandidat/i, label: "slab kandidat" },
  { pattern: /red flag/i, label: "red flag" },
  { pattern: /rizican kandidat/i, label: "rizican kandidat" },
  { pattern: /rizičan kandidat/i, label: "rizičan kandidat" },
  { pattern: /dijagnoz/i, label: "dijagnoza" },
  { pattern: /klinick/i, label: "klinicki" },
  { pattern: /kliničk/i, label: "klinički" },
  { pattern: /patolog/i, label: "patologija" },
  { pattern: /dokazuje da/i, label: "dokazuje da" },
  { pattern: /garantuje da/i, label: "garantuje da" },
  { pattern: /sigurno ce/i, label: "sigurno ce" },
  { pattern: /sigurno će/i, label: "sigurno će" },
  { pattern: /predvidja performans/i, label: "predvidja performans" },
  { pattern: /predviđa performans/i, label: "predviđa performans" },
  { pattern: /\bIPIP\b/i, label: "IPIP" },
  { pattern: /\bSAFRAN\b/i, label: "SAFRAN" },
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

function isValidLocale(value: unknown): value is MwmsHrReportLocale {
  return value === "bs" || value === "hr" || value === "sr" || value === "en";
}

function isMwmsDimensionCode(value: unknown): value is MwmsDimensionCode {
  return typeof value === "string" && MWMS_DIMENSION_CODES.includes(value as MwmsDimensionCode);
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getMwmsHrBand(score: number): MwmsHrBand {
  if (score < 1 || score > 7 || !Number.isFinite(score)) {
    throw new Error(`MWMS HR band requires a finite score between 1 and 7, received ${String(score)}.`);
  }

  if (score < 3) {
    return "lower";
  }

  if (score < 5) {
    return "moderate";
  }

  return "higher";
}

export function getMwmsHrBandLabel(band: MwmsHrBand): string {
  switch (band) {
    case "lower":
      return "Nize izrazeno";
    case "moderate":
      return "Umjereno izrazeno";
    case "higher":
      return "Vise izrazeno";
  }
}

function requireMwmsHrScore(scoreByDimension: Map<string, number>, dimensionCode: MwmsDimensionCode): number {
  const score = scoreByDimension.get(dimensionCode);

  if (!isFiniteNumber(score) || score < 1 || score > 7) {
    throw new Error(`MWMS HR report input requires ${dimensionCode} rawScore between 1 and 7.`);
  }

  return roundScore(score);
}

function getRankedDimensions(dimensions: readonly MwmsHrDimensionPromptInput[]) {
  return [...dimensions].sort(
    (left, right) => right.rawScore - left.rawScore || left.code.localeCompare(right.code),
  );
}

function buildDerivedProfile(dimensions: readonly MwmsHrDimensionPromptInput[]): MwmsHrDerivedProfile {
  const score = (dimensionCode: MwmsDimensionCode) =>
    dimensions.find((dimension) => dimension.code === dimensionCode)?.rawScore ?? 0;
  const autonomousMotivationScore = roundScore((score("identified") + score("intrinsic")) / 2);
  const controlledMotivationScore = roundScore(
    (score("introjected") + score("external_social") + score("external_material")) / 3,
  );
  const rankedDimensions = getRankedDimensions(dimensions);
  const ascendingDimensions = [...rankedDimensions].reverse();

  return {
    autonomousMotivationScore,
    controlledMotivationScore,
    amotivationScore: score("amotivation"),
    dominantDimensions: [
      rankedDimensions[0]?.code ?? "amotivation",
      rankedDimensions[1]?.code ?? "external_social",
    ],
    lowerDimensions: [
      ascendingDimensions[0]?.code ?? "intrinsic",
      ascendingDimensions[1]?.code ?? "identified",
    ],
    cautionFlags: {
      elevatedAmotivation: score("amotivation") >= 5,
      highControlledRelativeToAutonomous:
        controlledMotivationScore - autonomousMotivationScore >= 0.75,
      mixedProfile: autonomousMotivationScore >= 4.5 && controlledMotivationScore >= 4.5,
    },
  };
}

export function buildMwmsHrReportInput(request: {
  attemptId: string;
  testId: string;
  testSlug: string;
  audience: "hr";
  locale: AssessmentLocale;
  scoringMethod: ScoringMethod;
  promptVersion: string;
  results: CompletedAssessmentResults;
}): MwmsHrReportInput {
  if (request.testSlug !== MWMS_V1_TEST_SLUG) {
    throw new Error(`MWMS HR report input cannot be built for ${request.testSlug}.`);
  }

  if (request.audience !== MWMS_HR_REPORT_AUDIENCE) {
    throw new Error("MWMS HR report input supports only HR audience.");
  }

  if (!isValidLocale(request.locale)) {
    throw new Error("MWMS HR report input requires a supported locale.");
  }

  const scoreByDimension = new Map(
    request.results.dimensions.map((dimension) => [dimension.dimension, dimension.rawScore]),
  );
  const dimensions = MWMS_DIMENSION_CODES.map((dimensionCode) => {
    const rawScore = requireMwmsHrScore(scoreByDimension, dimensionCode);
    const band = getMwmsHrBand(rawScore);

    return {
      code: dimensionCode,
      label: formatDimensionLabel(dimensionCode),
      rawScore,
      band,
      bandLabel: getMwmsHrBandLabel(band),
      interpretationHint: MWMS_HR_DIMENSION_HINTS[dimensionCode],
    };
  }) as MwmsHrReportInput["dimensions"];

  return {
    attemptId: request.attemptId,
    testId: request.testId,
    testSlug: MWMS_V1_TEST_SLUG,
    audience: MWMS_HR_REPORT_AUDIENCE,
    reportType: MWMS_HR_REPORT_REPORT_TYPE,
    sourceType: MWMS_HR_REPORT_SOURCE_TYPE,
    locale: request.locale,
    scoringMethod: request.scoringMethod,
    promptVersion: request.promptVersion,
    scale: {
      min: 1,
      max: 7,
    },
    dimensions,
    derivedProfile: buildDerivedProfile(dimensions),
    interpretationBoundaries: {
      noScoreRecalculation: true,
      noScoreMutation: true,
      noHiringDecision: true,
      noDiagnosis: true,
      noCompositeInsight: true,
      useAsHrHypotheses: true,
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

function validateNonEmptyString(value: unknown, path: string, errors: string[]): value is string {
  if (!isNonEmptyString(value)) {
    errors.push(`${path}: Expected non-empty string.`);
    return false;
  }

  return true;
}

function validateExactArrayLength<T>(
  value: unknown,
  path: string,
  expectedLength: number,
  errors: string[],
  validateItem: (item: unknown, itemPath: string, errors: string[]) => item is T,
): value is T[] {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    errors.push(`${path}: Expected exactly ${expectedLength} item(s).`);
    return false;
  }

  value.forEach((item, index) => {
    validateItem(item, `${path}[${index}]`, errors);
  });

  return true;
}

function validateStringArrayRange(
  value: unknown,
  path: string,
  minItems: number,
  maxItems: number,
  errors: string[],
): value is string[] {
  if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) {
    errors.push(`${path}: Expected ${minItems}-${maxItems} string item(s).`);
    return false;
  }

  value.forEach((item, index) => validateNonEmptyString(item, `${path}[${index}]`, errors));
  return true;
}

function validateDimensionSnapshot(
  value: unknown,
  path: string,
  errors: string[],
): value is MwmsHrDimensionSnapshot {
  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return false;
  }

  validateAdditionalProperties(value, path, ["code", "label", "rawScore", "band", "bandLabel"], errors);

  if (!isMwmsDimensionCode(value.code)) {
    errors.push(`${path}.code: Expected canonical MWMS dimension code.`);
  }

  validateNonEmptyString(value.label, `${path}.label`, errors);

  if (!isFiniteNumber(value.rawScore) || value.rawScore < 1 || value.rawScore > 7) {
    errors.push(`${path}.rawScore: Expected number between 1 and 7.`);
  }

  if (value.band !== "lower" && value.band !== "moderate" && value.band !== "higher") {
    errors.push(`${path}.band: Expected lower, moderate, or higher.`);
  }

  validateNonEmptyString(value.bandLabel, `${path}.bandLabel`, errors);

  if (isFiniteNumber(value.rawScore) && value.rawScore >= 1 && value.rawScore <= 7) {
    const expectedBand = getMwmsHrBand(value.rawScore);

    if (value.band !== expectedBand) {
      errors.push(`${path}.band: Expected ${expectedBand} for rawScore ${value.rawScore}.`);
    }

    if (value.band === expectedBand && value.bandLabel !== getMwmsHrBandLabel(expectedBand)) {
      errors.push(`${path}.bandLabel: Expected ${getMwmsHrBandLabel(expectedBand)}.`);
    }
  }

  return errors.length === 0;
}

function validateDerivedProfile(
  value: unknown,
  path: string,
  errors: string[],
): value is MwmsHrDerivedProfile {
  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return false;
  }

  validateAdditionalProperties(value, path, [
    "autonomousMotivationScore",
    "controlledMotivationScore",
    "amotivationScore",
    "dominantDimensions",
    "lowerDimensions",
    "cautionFlags",
  ], errors);

  for (const key of ["autonomousMotivationScore", "controlledMotivationScore", "amotivationScore"] as const) {
    if (!isFiniteNumber(value[key]) || value[key] < 1 || value[key] > 7) {
      errors.push(`${path}.${key}: Expected number between 1 and 7.`);
    }
  }

  validateExactArrayLength(
    value.dominantDimensions,
    `${path}.dominantDimensions`,
    2,
    errors,
    (item, itemPath, itemErrors): item is MwmsDimensionCode => {
      if (!isMwmsDimensionCode(item)) {
        itemErrors.push(`${itemPath}: Expected canonical MWMS dimension code.`);
        return false;
      }

      return true;
    },
  );
  validateExactArrayLength(
    value.lowerDimensions,
    `${path}.lowerDimensions`,
    2,
    errors,
    (item, itemPath, itemErrors): item is MwmsDimensionCode => {
      if (!isMwmsDimensionCode(item)) {
        itemErrors.push(`${itemPath}: Expected canonical MWMS dimension code.`);
        return false;
      }

      return true;
    },
  );

  if (!isRecord(value.cautionFlags)) {
    errors.push(`${path}.cautionFlags: Expected object.`);
  } else {
    validateAdditionalProperties(value.cautionFlags, `${path}.cautionFlags`, [
      "elevatedAmotivation",
      "highControlledRelativeToAutonomous",
      "mixedProfile",
    ], errors);

    for (const key of ["elevatedAmotivation", "highControlledRelativeToAutonomous", "mixedProfile"] as const) {
      if (typeof value.cautionFlags[key] !== "boolean") {
        errors.push(`${path}.cautionFlags.${key}: Expected boolean.`);
      }
    }
  }

  return errors.length === 0;
}

function validateDimensionsComplete(
  dimensions: readonly MwmsHrDimensionSnapshot[],
  errors: string[],
): void {
  const codes = new Set(dimensions.map((dimension) => dimension.code));

  for (const dimensionCode of MWMS_DIMENSION_CODES) {
    if (!codes.has(dimensionCode)) {
      errors.push(`motivation_profile_snapshot.dimensions: Missing ${dimensionCode}.`);
    }
  }

  if (codes.size !== MWMS_DIMENSION_CODES.length) {
    errors.push("motivation_profile_snapshot.dimensions: Expected unique canonical MWMS dimension codes.");
  }
}

function validateSignal(value: unknown, path: string, errors: string[]): value is MwmsHrSignal {
  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return false;
  }

  validateAdditionalProperties(value, path, ["title", "evidence", "hrImplication"], errors);
  validateNonEmptyString(value.title, `${path}.title`, errors);
  validateNonEmptyString(value.evidence, `${path}.evidence`, errors);
  validateNonEmptyString(value.hrImplication, `${path}.hrImplication`, errors);
  return true;
}

function validateFrictionPoint(value: unknown, path: string, errors: string[]): value is MwmsHrFrictionPoint {
  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return false;
  }

  validateAdditionalProperties(value, path, ["signal", "whyItMayMatter", "howToCheck"], errors);
  validateNonEmptyString(value.signal, `${path}.signal`, errors);
  validateNonEmptyString(value.whyItMayMatter, `${path}.whyItMayMatter`, errors);
  validateNonEmptyString(value.howToCheck, `${path}.howToCheck`, errors);
  return true;
}

function validateWorkContextHypothesis(
  value: unknown,
  path: string,
  errors: string[],
): value is MwmsHrWorkContextHypothesis {
  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return false;
  }

  validateAdditionalProperties(value, path, ["context", "hypothesis", "verification"], errors);
  validateNonEmptyString(value.context, `${path}.context`, errors);
  validateNonEmptyString(value.hypothesis, `${path}.hypothesis`, errors);
  validateNonEmptyString(value.verification, `${path}.verification`, errors);
  return true;
}

function validateManagerGuidance(value: unknown, path: string, errors: string[]): value is MwmsHrManagerGuidance {
  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return false;
  }

  validateAdditionalProperties(value, path, ["focus", "recommendation", "rationale"], errors);
  validateNonEmptyString(value.focus, `${path}.focus`, errors);
  validateNonEmptyString(value.recommendation, `${path}.recommendation`, errors);
  validateNonEmptyString(value.rationale, `${path}.rationale`, errors);
  return true;
}

function validateInterviewQuestion(
  value: unknown,
  path: string,
  errors: string[],
): value is MwmsHrInterviewQuestion {
  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return false;
  }

  validateAdditionalProperties(value, path, ["question", "evaluates", "whatToListenFor"], errors);
  validateNonEmptyString(value.question, `${path}.question`, errors);
  validateNonEmptyString(value.evaluates, `${path}.evaluates`, errors);
  validateNonEmptyString(value.whatToListenFor, `${path}.whatToListenFor`, errors);
  return true;
}

function validateOnboardingRecommendation(
  value: unknown,
  path: string,
  errors: string[],
): value is MwmsHrOnboardingRecommendation {
  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return false;
  }

  validateAdditionalProperties(value, path, ["phase", "recommendation", "why"], errors);
  validateNonEmptyString(value.phase, `${path}.phase`, errors);
  validateNonEmptyString(value.recommendation, `${path}.recommendation`, errors);
  validateNonEmptyString(value.why, `${path}.why`, errors);
  return true;
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

function validateForbiddenContent(report: MwmsHrReportV1, errors: string[]): void {
  const reportText = collectStrings({
    key_motivational_drivers: report.key_motivational_drivers,
    potential_friction_points: report.potential_friction_points,
    work_context_hypotheses: report.work_context_hypotheses,
    manager_support_guidance: report.manager_support_guidance,
    interview_questions: report.interview_questions,
    onboarding_recommendations: report.onboarding_recommendations,
    decision_support_note: report.decision_support_note,
    interpretation_note: report.interpretation_note,
  });

  for (const text of reportText) {
    for (const { pattern, label } of FORBIDDEN_REPORT_PATTERNS) {
      if (pattern.test(text)) {
        errors.push(`Forbidden phrase "${label}" found in report text: ${text}`);
      }
    }
  }
}

function validateSafetyChecks(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("safety_checks: Expected object.");
    return;
  }

  validateAdditionalProperties(value, "safety_checks", [
    "noScoreRecalculation",
    "noScoreMutation",
    "noHireNoHireDecision",
    "noDiagnosticLanguage",
    "hypothesesOnly",
    "singleTestOnly",
  ], errors);

  for (const key of [
    "noScoreRecalculation",
    "noScoreMutation",
    "noHireNoHireDecision",
    "noDiagnosticLanguage",
    "hypothesesOnly",
    "singleTestOnly",
  ] as const) {
    if (value[key] !== true) {
      errors.push(`safety_checks.${key}: Expected true.`);
    }
  }
}

function validateSnapshotMatchesInput(
  report: MwmsHrReportV1,
  expectedInput: MwmsHrReportInput,
  errors: string[],
): void {
  const expectedDimensions = new Map(expectedInput.dimensions.map((dimension) => [dimension.code, dimension]));

  for (const dimension of report.motivation_profile_snapshot.dimensions) {
    const expectedDimension = expectedDimensions.get(dimension.code);

    if (!expectedDimension) {
      errors.push(`motivation_profile_snapshot.dimensions.${dimension.code}: Unexpected dimension.`);
      continue;
    }

    if (dimension.label !== expectedDimension.label) {
      errors.push(`motivation_profile_snapshot.dimensions.${dimension.code}.label: Expected ${expectedDimension.label}.`);
    }

    if (dimension.rawScore !== expectedDimension.rawScore) {
      errors.push(
        `motivation_profile_snapshot.dimensions.${dimension.code}.rawScore: Expected ${expectedDimension.rawScore}.`,
      );
    }

    if (dimension.band !== expectedDimension.band) {
      errors.push(`motivation_profile_snapshot.dimensions.${dimension.code}.band: Expected ${expectedDimension.band}.`);
    }

    if (dimension.bandLabel !== expectedDimension.bandLabel) {
      errors.push(
        `motivation_profile_snapshot.dimensions.${dimension.code}.bandLabel: Expected ${expectedDimension.bandLabel}.`,
      );
    }
  }

  const actualDerived = report.motivation_profile_snapshot.derivedProfile;
  const expectedDerived = expectedInput.derivedProfile;

  if (actualDerived.autonomousMotivationScore !== expectedDerived.autonomousMotivationScore) {
    errors.push("motivation_profile_snapshot.derivedProfile.autonomousMotivationScore: Score mutation detected.");
  }

  if (actualDerived.controlledMotivationScore !== expectedDerived.controlledMotivationScore) {
    errors.push("motivation_profile_snapshot.derivedProfile.controlledMotivationScore: Score mutation detected.");
  }

  if (actualDerived.amotivationScore !== expectedDerived.amotivationScore) {
    errors.push("motivation_profile_snapshot.derivedProfile.amotivationScore: Score mutation detected.");
  }

  if (actualDerived.dominantDimensions.join("|") !== expectedDerived.dominantDimensions.join("|")) {
    errors.push("motivation_profile_snapshot.derivedProfile.dominantDimensions: Expected deterministic order.");
  }

  if (actualDerived.lowerDimensions.join("|") !== expectedDerived.lowerDimensions.join("|")) {
    errors.push("motivation_profile_snapshot.derivedProfile.lowerDimensions: Expected deterministic order.");
  }
}

export function validateMwmsHrReportV1(
  value: unknown,
  options?: {
    expectedInput?: MwmsHrReportInput;
  },
): { ok: true; value: MwmsHrReportV1 } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["<root>: Expected object."] };
  }

  validateAdditionalProperties(value, "<root>", [
    "contractVersion",
    "reportType",
    "testSlug",
    "audience",
    "sourceType",
    "locale",
    "meta",
    "motivation_profile_snapshot",
    "key_motivational_drivers",
    "potential_friction_points",
    "work_context_hypotheses",
    "manager_support_guidance",
    "interview_questions",
    "onboarding_recommendations",
    "decision_support_note",
    "interpretation_note",
    "safety_checks",
  ], errors);

  if (value.contractVersion !== MWMS_HR_REPORT_CONTRACT_VERSION) {
    errors.push(`contractVersion: Expected ${MWMS_HR_REPORT_CONTRACT_VERSION}.`);
  }

  if (value.reportType !== MWMS_HR_REPORT_TYPE) {
    errors.push(`reportType: Expected ${MWMS_HR_REPORT_TYPE}.`);
  }

  if (value.testSlug !== MWMS_V1_TEST_SLUG) {
    errors.push(`testSlug: Expected ${MWMS_V1_TEST_SLUG}.`);
  }

  if (value.audience !== MWMS_HR_REPORT_AUDIENCE) {
    errors.push("audience: Expected hr.");
  }

  if (value.sourceType !== MWMS_HR_REPORT_SOURCE_TYPE) {
    errors.push("sourceType: Expected single_test.");
  }

  if (!isValidLocale(value.locale)) {
    errors.push("locale: Expected supported report locale.");
  }

  if (!isRecord(value.meta)) {
    errors.push("meta: Expected object.");
  } else {
    validateAdditionalProperties(value.meta, "meta", ["language", "generatedAt"], errors);
    validateNonEmptyString(value.meta.language, "meta.language", errors);
    validateNonEmptyString(value.meta.generatedAt, "meta.generatedAt", errors);
  }

  if (!isRecord(value.motivation_profile_snapshot)) {
    errors.push("motivation_profile_snapshot: Expected object.");
  } else {
    validateAdditionalProperties(value.motivation_profile_snapshot, "motivation_profile_snapshot", [
      "scale",
      "dimensions",
      "derivedProfile",
    ], errors);

    const scale = value.motivation_profile_snapshot.scale;

    if (!isRecord(scale) || scale.min !== 1 || scale.max !== 7) {
      errors.push("motivation_profile_snapshot.scale: Expected min=1 and max=7.");
    }

    const dimensionErrorsStart = errors.length;
    const dimensionsOk = validateExactArrayLength(
      value.motivation_profile_snapshot.dimensions,
      "motivation_profile_snapshot.dimensions",
      MWMS_DIMENSION_CODES.length,
      errors,
      validateDimensionSnapshot,
    );

    if (dimensionsOk || errors.length > dimensionErrorsStart) {
      const dimensions = value.motivation_profile_snapshot.dimensions;

      if (Array.isArray(dimensions)) {
        validateDimensionsComplete(dimensions as MwmsHrDimensionSnapshot[], errors);
      }
    }

    validateDerivedProfile(
      value.motivation_profile_snapshot.derivedProfile,
      "motivation_profile_snapshot.derivedProfile",
      errors,
    );
  }

  validateExactArrayLength(value.key_motivational_drivers, "key_motivational_drivers", 3, errors, validateSignal);
  validateExactArrayLength(
    value.potential_friction_points,
    "potential_friction_points",
    3,
    errors,
    validateFrictionPoint,
  );
  validateExactArrayLength(
    value.work_context_hypotheses,
    "work_context_hypotheses",
    3,
    errors,
    validateWorkContextHypothesis,
  );
  validateExactArrayLength(
    value.manager_support_guidance,
    "manager_support_guidance",
    4,
    errors,
    validateManagerGuidance,
  );
  validateExactArrayLength(value.interview_questions, "interview_questions", 5, errors, validateInterviewQuestion);
  validateExactArrayLength(
    value.onboarding_recommendations,
    "onboarding_recommendations",
    4,
    errors,
    validateOnboardingRecommendation,
  );
  validateStringArrayRange(value.decision_support_note, "decision_support_note", 2, 3, errors);
  validateNonEmptyString(value.interpretation_note, "interpretation_note", errors);
  validateSafetyChecks(value.safety_checks, errors);

  if (errors.length === 0) {
    const report = value as MwmsHrReportV1;
    validateForbiddenContent(report, errors);

    if (options?.expectedInput) {
      validateSnapshotMatchesInput(report, options.expectedInput, errors);
    }
  }

  return errors.length === 0
    ? { ok: true, value: value as MwmsHrReportV1 }
    : { ok: false, errors };
}

export function formatMwmsHrReportValidationErrors(errors: string[]): string {
  return errors.join(" | ");
}
