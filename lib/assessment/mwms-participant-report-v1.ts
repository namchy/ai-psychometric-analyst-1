import mwmsParticipantReportV1SchemaJson from "@/lib/assessment/schemas/mwms-participant-report-v1.json";

export const MWMS_PARTICIPANT_REPORT_SCHEMA_VERSION = "mwms_participant_report_v1" as const;

export type MwmsParticipantReportV1 = {
  schema_version: typeof MWMS_PARTICIPANT_REPORT_SCHEMA_VERSION;
  test_slug: "mwms_v1";
  audience: "participant";
  title: "Radna motivacija";
  summary: {
    headline: string;
    paragraph: string;
  };
  motivation_pattern: {
    autonomous: string;
    controlled: string;
    amotivation: string;
  };
  key_observations: string[];
  possible_tensions: string[];
  reflection_questions: string[];
  development_suggestions: string[];
  interpretation_note: string;
};

export const mwmsParticipantReportV1OpenAiSchema =
  mwmsParticipantReportV1SchemaJson;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateStringArray(
  value: unknown,
  path: string,
  errors: string[],
): value is string[] {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  if (value.length < 1 || value.length > 3) {
    errors.push(`${path}: Expected 1-3 items.`);
  }

  value.forEach((item, index) => {
    if (!isNonEmptyString(item)) {
      errors.push(`${path}[${index}]: Expected non-empty string.`);
    }
  });

  return value.every(isNonEmptyString) && value.length >= 1 && value.length <= 3;
}

function validateSummary(value: unknown, errors: string[]): value is MwmsParticipantReportV1["summary"] {
  if (!isRecord(value)) {
    errors.push("summary: Expected object.");
    return false;
  }

  if (!isNonEmptyString(value.headline)) {
    errors.push("summary.headline: Expected non-empty string.");
  }

  if (!isNonEmptyString(value.paragraph)) {
    errors.push("summary.paragraph: Expected non-empty string.");
  }

  return isNonEmptyString(value.headline) && isNonEmptyString(value.paragraph);
}

function validateMotivationPattern(
  value: unknown,
  errors: string[],
): value is MwmsParticipantReportV1["motivation_pattern"] {
  if (!isRecord(value)) {
    errors.push("motivation_pattern: Expected object.");
    return false;
  }

  for (const key of ["autonomous", "controlled", "amotivation"] as const) {
    if (!isNonEmptyString(value[key])) {
      errors.push(`motivation_pattern.${key}: Expected non-empty string.`);
    }
  }

  return (
    isNonEmptyString(value.autonomous) &&
    isNonEmptyString(value.controlled) &&
    isNonEmptyString(value.amotivation)
  );
}

export function validateMwmsParticipantReportV1(
  value: unknown,
): { ok: true; value: MwmsParticipantReportV1 } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["<root>: Expected object."] };
  }

  if (value.schema_version !== MWMS_PARTICIPANT_REPORT_SCHEMA_VERSION) {
    errors.push(`schema_version: Expected ${MWMS_PARTICIPANT_REPORT_SCHEMA_VERSION}.`);
  }

  if (value.test_slug !== "mwms_v1") {
    errors.push("test_slug: Expected mwms_v1.");
  }

  if (value.audience !== "participant") {
    errors.push("audience: Expected participant.");
  }

  if (value.title !== "Radna motivacija") {
    errors.push("title: Expected Radna motivacija.");
  }

  const summaryOk = validateSummary(value.summary, errors);
  const patternOk = validateMotivationPattern(value.motivation_pattern, errors);
  const observationsOk = validateStringArray(value.key_observations, "key_observations", errors);
  const tensionsOk = validateStringArray(value.possible_tensions, "possible_tensions", errors);
  const questionsOk = validateStringArray(value.reflection_questions, "reflection_questions", errors);
  const suggestionsOk = validateStringArray(
    value.development_suggestions,
    "development_suggestions",
    errors,
  );

  if (!isNonEmptyString(value.interpretation_note)) {
    errors.push("interpretation_note: Expected non-empty string.");
  }

  if (
    errors.length > 0 ||
    !summaryOk ||
    !patternOk ||
    !observationsOk ||
    !tensionsOk ||
    !questionsOk ||
    !suggestionsOk
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: value as MwmsParticipantReportV1,
  };
}

export function formatMwmsParticipantReportV1ValidationErrors(errors: string[]): string {
  return errors.join(" | ");
}
